# 02. Optimization Patterns

## Plain English

Beyond `Wait` discipline (previous file), there's a set of patterns that cut CPU without cutting features. Apply them as you write - easier than retrofitting later.

---

## 1. Cache Expensive Reads

Don't call the same native multiple times in one tick.

### Bad

```lua
CreateThread(function()
    while true do
        if IsPedInAnyVehicle(PlayerPedId(), false) then                 -- native call 1
            if GetVehicleClass(GetVehiclePedIsIn(PlayerPedId(), false)) == 18 then  -- 3 more calls
                -- emergency vehicle
            end
        end
        Wait(500)
    end
end)
```

Four native calls per tick. Most of them resolve to the same handles.

### Good

```lua
CreateThread(function()
    while true do
        local ped = PlayerPedId()                                       -- one call, cache it
        if IsPedInAnyVehicle(ped, false) then
            local veh = GetVehiclePedIsIn(ped, false)                   -- one call, cache it
            if GetVehicleClass(veh) == 18 then
                -- emergency
            end
        end
        Wait(500)
    end
end)
```

Half the native calls. Same logic.

---

## 2. Locals Beat Globals In Hot Loops

```lua
-- BAD: math.floor is a global lookup every call (1000 hash lookups)
for i = 1, 1000 do
    print(math.floor(i / 2))
end

-- GOOD: cache the function once. local stack access in the loop.
local floor = math.floor
for i = 1, 1000 do
    print(floor(i / 2))
end
```

Local variables are direct stack reads. Globals are hash table lookups. In hot loops, the difference adds up.

---

## 3. State Bags Over Net Event Spam

If you're continuously syncing some state to all clients, **state bags** beat firing net events 10× per second.

```lua
-- ↓ on the server, set state on the entity. "true" = replicate to all clients.
Entity(vehicle).state:set('fuel', 75, true)
Player(src).state:set('stress', 42, true)

-- ↓ clients read it (synced automatically)
local fuel = Entity(vehicle).state.fuel
```

State bags auto-replicate on change and clean up on disconnect. Use for fuel, stress, ownership flags, anything continuous.

[State Bags docs](https://docs.fivem.net/docs/scripting-manual/networking/state-bags/)

---

## 4. Early Return On "Nothing To Do"

```lua
lib.onCache('ped', function(newPed)
    if not newPed then return end                                       -- ped is nil, skip
    -- only react when there's actually a new ped
end)
```

Most update handlers fire often. Early-exit on the boring cases first.

---

## 5. Batch DB Writes

Writing on every coin earned = tons of tiny queries.

### Bad

```lua
local function onCoinEarn(src)
    MySQL.update('UPDATE players SET coins = coins + 1 WHERE cid = ?', { getCid(src) })
end
```

If 50 players earn 10 coins/min, that's 500 queries/min just for "+1 coin".

### Good - In-Memory Queue + Periodic Flush

```lua
local dirty = {}                                                        -- cid → pending coin delta

local function onCoinEarn(src)
    local cid = getCid(src)
    dirty[cid] = (dirty[cid] or 0) + 1                                  -- bump the counter
end

CreateThread(function()
    while true do
        Wait(30000)                                                     -- flush every 30s
        for cid, amount in pairs(dirty) do
            MySQL.update('UPDATE players SET coins = coins + ? WHERE cid = ?', { amount, cid })
            dirty[cid] = nil
        end
    end
end)

-- ↓ flush a player's pending counter on disconnect (don't lose their coins)
AddEventHandler('playerDropped', function(src)
    local cid = getCid(src)
    if dirty[cid] then
        MySQL.update.await('UPDATE players SET coins = coins + ? WHERE cid = ?',
            { dirty[cid], cid })
        dirty[cid] = nil
    end
end)
```

Tradeoff: up to 30s of coin loss on a server crash. **Acceptable for non-money** - for actual cash, use atomic per-event writes.

---

## 6. Don't Send Full Tables Every Tick

If clients want a list of players, don't broadcast the full list 10× a second. Send deltas:

```lua
-- on player load: tell everyone "this player joined"
AddEventHandler('qbx_core:server:playerLoaded', function(playerData)
    TriggerClientEvent('players:add', -1, playerData.source, playerData.charinfo.firstname)
end)

-- on disconnect: tell everyone "they left"
AddEventHandler('playerDropped', function()
    TriggerClientEvent('players:remove', -1, source)
end)
```

Each client maintains its own copy. Tiny network cost. No periodic sync needed.

---

## 7. Avoid `GetGamePool` In Hot Code

```lua
-- EXPENSIVE: traverses every vehicle the engine tracks
for _, veh in ipairs(GetGamePool('CVehicle')) do
    -- check it
end
```

For nearby entities, prefer:

```lua
local nearby = lib.getNearbyVehicles(coords, 50.0, false)               -- batched, radius-limited
```

Save `GetGamePool` for one-shot operations (cleanup on resource stop, debug commands), not loops.

---

## 8. Use `CreateThread` Sparingly

Each thread = its own coroutine + scheduler overhead. Don't spawn one per NPC.

### Bad - 100 threads for 100 NPCs

```lua
for _, npc in ipairs(npcs) do
    CreateThread(function()
        while true do
            -- manage this one NPC
            Wait(1000)
        end
    end)
end
```

### Good - one thread, iterate

```lua
CreateThread(function()
    while true do
        for _, npc in ipairs(npcs) do
            -- manage each NPC in turn
        end
        Wait(1000)
    end
end)
```

One thread. Same work. Less overhead.

---

## 9. Targeted Event Routing

```lua
-- BAD: broadcasts to all 128 connected clients
TriggerClientEvent('shop:updated', -1, data)

-- GOOD: only the buyer cares
TriggerClientEvent('shop:updated', buyerSrc, data)

-- GOOD: only nearby players (e.g., you opened a robbery, only nearby cops should know)
local nearby = lib.getNearbyPlayers(coords, 50.0)
for _, src in ipairs(nearby) do
    TriggerClientEvent('shop:updated', src, data)
end
```

`-1` broadcast = 128× the network traffic. Only use it when literally every player needs the event.

---

## 10. Stream Models On Demand, Unload After

```lua
local model = `adder`
RequestModel(model)
while not HasModelLoaded(model) do Wait(0) end

local veh = CreateVehicle(model, x, y, z, h, true, false)

SetModelAsNoLongerNeeded(model)                                         -- ALWAYS release after use
```

Forget `SetModelAsNoLongerNeeded` → memory leak, future model requests may fail because the streaming slots are full.

Same for animation dictionaries:

```lua
RequestAnimDict(dict)
-- ... play the anim ...
RemoveAnimDict(dict)                                                    -- release when done
```

---

## 11. Don't Render NUI When Hidden

Even with `visibility: hidden`, your React `useEffect`s still run. Gate expensive work:

```tsx
useEffect(() => {
    if (!visible) return;                                               // bail when hidden
    const timer = setInterval(() => {
        setTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
}, [visible]);
```

Don't run animations, polling, or fetches behind a hidden UI.

---

## 12. Throttle `SendNUIMessage`

Sending every frame to NUI = expensive serialization + CEF overhead.

For HUDs (HP, hunger, etc.):

```lua
local lastSent = {}

CreateThread(function()
    while true do
        local hp = GetEntityHealth(PlayerPedId())
        if hp ~= lastSent.hp then                                       -- only send when changed
            SendNUIMessage({ hp = hp })
            lastSent.hp = hp
        end
        Wait(500)
    end
end)
```

Only send on **actual changes**. Aggressive throttling on HUDs is a huge win.

---

## 13. Profile Before Optimizing

Don't guess. Tools:

- **`resmon`** in F8 console - quick per-resource CPU
- **`profiler record 500` + `profiler save x.json`** - open in Chrome DevTools for flame chart
- **MCP `resmon_snapshot` + `benchmark_compare`** - before/after numbers

Optimizing cold code = wasted effort. Find the 20% of code eating 80% of CPU first.

---

## 14. Lua GC Awareness

Avoid creating garbage in hot loops:

```lua
-- BAD: allocates a new vector3 every frame
while true do
    local c = vec3(1, 2, 3)
    Wait(0)
end
```

Lua garbage collection pauses cause tiny hitches. Reuse values, hoist allocations out of hot loops.

---

## 15. Compile-Time Constants

```lua
-- ↓ ONE config table at the top, easy to find and tune
local CONFIG = {
    SHOP_COORDS = vec3(25.0, -1347.0, 29.5),
    SHOP_RADIUS = 3.0,
    SHOP_ITEMS = { bread = 10, water = 5 },
}
```

Avoid magic numbers sprinkled across the file. Easier to tune, debug, and review.

---

## 16. Preload Critical Assets On Resource Start

If you know you'll need a model or anim, load it once at start:

```lua
CreateThread(function()
    Wait(2000)                                                          -- let the game initialize
    for _, model in ipairs({ `adder`, `zentorno` }) do
        RequestModel(model)
        while not HasModelLoaded(model) do Wait(0) end
        SetModelAsNoLongerNeeded(model)                                 -- still release the slot, the game caches it
    end
end)
```

Models become cached. First in-game use = instant.

---

## 17. Stop Processing When Far Away

The global anti-pattern: a thread doing work for every player even when no player is involved.

```lua
local players = lib.getNearbyPlayers(coords, 50.0)
for _, src in ipairs(players) do
    -- only these players are affected by the event happening at "coords"
end
```

Gate by distance, by visibility, by "am I involved". Idle work is a tax on the whole server.

---

## Pre-Ship Performance Checklist

- [ ] No `while true do ... Wait(0) end` without distance gating or `lib.points`
- [ ] `resmon` < 0.05 ms idle for client resources
- [ ] DB writes batched or event-driven (not per frame)
- [ ] No `GetGamePool` in hot loops
- [ ] Locals cached in hot loops
- [ ] State bags for continuous sync, not net event spam
- [ ] Targeted `TriggerClientEvent`, not `-1` broadcast (unless truly global)
- [ ] `SetModelAsNoLongerNeeded` after every `CreateVehicle`/`CreatePed`
- [ ] NUI receives messages on change, not per frame
- [ ] `onResourceStop` cleanup (NUI focus, threads, entities, blips)

---

## TL;DR

- Cache repeated native calls
- Batch DB ops, send deltas not snapshots
- Event-driven > polling
- Targeted broadcasts, not `-1`
- Unload streamed assets
- Profile with `resmon` + `profiler`
- Gate work by distance / visibility / "am I involved"

---

## Sources

- [FiveM profiler docs](https://docs.fivem.net/docs/scripting-reference/profiler/)
- [State Bags](https://docs.fivem.net/docs/scripting-manual/networking/state-bags/)
- [FiveM Cookbook (performance)](https://cookbook.fivem.net/) - community patterns
- [ox_lib points (source)](https://github.com/communityox/ox_lib/tree/master/imports/points)
- [ox_lib zones](https://coxdocs.dev/ox_lib/Modules/Zones/Shared)
- [Lua performance tips](https://www.lua.org/gems/sample.pdf) - official Lua perf guide

---

Next folder: [`10-first-projects/`](../10-first-projects/) - start with [`01-hello-resource.md`](../10-first-projects/01-hello-resource.md)
