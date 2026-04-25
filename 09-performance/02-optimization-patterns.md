# 02. Optimization Patterns

Beyond waits. Patterns that cut CPU without cutting features.

## 1. Cache Expensive Reads

Don't call the same native over and over in one frame.

### Bad
```lua
CreateThread(function()
    while true do
        if IsPedInAnyVehicle(PlayerPedId(), false) then
            if GetVehicleClass(GetVehiclePedIsIn(PlayerPedId(), false)) == 18 then
                -- emergency vehicle
            end
        end
        Wait(500)
    end
end)
```

### Good
```lua
CreateThread(function()
    while true do
        local ped = PlayerPedId()
        if IsPedInAnyVehicle(ped, false) then
            local veh = GetVehiclePedIsIn(ped, false)
            if GetVehicleClass(veh) == 18 then
                -- emergency
            end
        end
        Wait(500)
    end
end)
```

Call once, store in local.

## 2. Locals Are Faster Than Globals

```lua
-- BAD
for i = 1, 1000 do
    print(math.floor(i / 2))
end

-- GOOD
local floor = math.floor
for i = 1, 1000 do
    print(floor(i / 2))
end
```

Local var = direct stack access. Global = hash lookup each time. Matters in hot loops.

## 3. State Bags Over Net Events For Sync

If you're continuously updating state on all clients, state bags beat event spam.

```lua
-- server sets
Entity(vehicle).state:set('fuel', 75, true)       -- replicated
Player(src).state:set('stress', 42, true)

-- clients read (event or poll)
local fuel = Entity(vehicle).state.fuel
```

State bags auto-replicate and auto-cleanup on disconnect. See FiveM docs.

## 4. Ignore Irrelevant Updates

```lua
lib.onCache('ped', function(newPed)
    if not newPed then return end
    -- only react to actual ped changes, not every check
end)
```

Most update handlers fire often. Early-return on "nothing to do".

## 5. Batch DB Writes

Writing on every coin earned = tons of tiny queries.

### Bad
```lua
function onCoinEarn(src)
    MySQL.update('UPDATE players SET coins = coins + 1 WHERE cid = ?', {getCid(src)})
end
```

### Good: batch with periodic flush
```lua
local dirty = {}

function onCoinEarn(src)
    local cid = getCid(src)
    dirty[cid] = (dirty[cid] or 0) + 1
end

CreateThread(function()
    while true do
        Wait(30000)    -- flush every 30s
        for cid, amount in pairs(dirty) do
            MySQL.update('UPDATE players SET coins = coins + ? WHERE cid = ?', {amount, cid})
            dirty[cid] = nil
        end
    end
end)

-- flush on disconnect
AddEventHandler('playerDropped', function(src)
    local cid = getCid(src)
    if dirty[cid] then
        MySQL.update.await('UPDATE players SET coins = coins + ? WHERE cid = ?', {dirty[cid], cid})
        dirty[cid] = nil
    end
end)
```

Tradeoff: 30s of coin loss on server crash. Acceptable for many games, not for money.

## 6. Don't Send Full Tables Every Tick

Client wants player list? Don't send all 128 players' data every frame. Send on change.

```lua
-- only broadcast delta
AddEventHandler('qbx_core:server:playerLoaded', function(playerData)
    TriggerClientEvent('players:add', -1, playerData.source, playerData.charinfo.firstname)
end)

AddEventHandler('playerDropped', function()
    TriggerClientEvent('players:remove', -1, source)
end)
```

Client maintains local list. Beats polling server.

## 7. Avoid `GetGamePool` If Possible

```lua
-- EXPENSIVE
for _, veh in ipairs(GetGamePool('CVehicle')) do
    -- ...
end
```

Iterates every vehicle tracked by game. Use ox_lib `getNearbyVehicles` with radius instead.

## 8. Use `CreateThread` Sparingly

Each thread = its own coroutine + scheduler overhead. Don't spawn one per NPC:

### Bad
```lua
for _, npc in ipairs(npcs) do
    CreateThread(function()
        while true do
            -- manage this npc
            Wait(1000)
        end
    end)
end
```

100 NPCs = 100 threads.

### Good
```lua
CreateThread(function()
    while true do
        for _, npc in ipairs(npcs) do
            -- manage each
        end
        Wait(1000)
    end
end)
```

One thread, iterate.

## 9. Targeted Event Routing

```lua
-- BAD: broadcast to all 128 players
TriggerClientEvent('shop:updated', -1, data)

-- GOOD: only the one who opened it
TriggerClientEvent('shop:updated', buyerSrc, data)

-- GOOD: only players in a zone
local nearby = lib.getNearbyPlayers(coords, 50.0)
for _, src in ipairs(nearby) do
    TriggerClientEvent('shop:updated', src, data)
end
```

`-1` broadcast = 128x network traffic. Only when truly global.

## 10. Stream Models On Demand, Unload After

```lua
local model = `adder`
RequestModel(model)
while not HasModelLoaded(model) do Wait(0) end

local veh = CreateVehicle(model, x, y, z, h, true, false)

SetModelAsNoLongerNeeded(model)    -- release slot
```

If you forget `SetModelAsNoLongerNeeded`, the game keeps it loaded. Memory leak + new models may fail to load.

Same for anim dicts:
```lua
RequestAnimDict(dict)
-- use anim
RemoveAnimDict(dict)
```

## 11. Don't Render NUI When Hidden

React effect:
```tsx
useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
        setTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
}, [visible]);
```

Don't run animations/timers behind a hidden UI. Gated mounting not always possible (use `visibility:hidden`), but gate expensive work with `if (!visible) return`.

## 12. Minimize `SendNUIMessage` Frequency

Sending every frame to NUI = expensive serialization + CEF overhead.

For HUDs (HP, hunger, etc):
```lua
local lastSent = {}

CreateThread(function()
    while true do
        local hp = GetEntityHealth(PlayerPedId())
        if hp ~= lastSent.hp then
            SendNUIMessage({ hp = hp })
            lastSent.hp = hp
        end
        Wait(500)
    end
end)
```

Send only when changed. Aggressive throttling on HUDs.

## 13. Profile Before Optimizing

Don't guess. Use:
- `resmon` in game
- `profiler record 500` + view in Chrome DevTools (F8: `profiler view`)
- MCP `resmon_snapshot` + `benchmark_compare`

Optimizing cold code = wasted effort. Find the 20% eating 80% first.

## 14. Lua GC Awareness

Avoid creating garbage in hot loops:

```lua
-- allocates a new vector3 every frame
while true do
    local c = vec3(1, 2, 3)
    Wait(0)
end
```

Prefer reusing values. Lua GC pauses = tiny hitches.

## 15. Compile-Time Constants

```lua
local CONFIG = {
    SHOP_COORDS = vec3(25.0, -1347.0, 29.5),
    SHOP_RADIUS = 3.0,
    SHOP_ITEMS = { bread = 10, water = 5 },
}
```

One config table. Avoid hardcoded magic numbers sprinkled everywhere. Easier to tune, debug, review.

## 16. Preload UI / Models On Resource Start

If you know you'll need assets, load once at start:

```lua
CreateThread(function()
    Wait(2000)    -- let game initialize
    for _, model in ipairs({`adder`, `zentorno`}) do
        RequestModel(model)
        while not HasModelLoaded(model) do Wait(0) end
        SetModelAsNoLongerNeeded(model)
    end
end)
```

Models get cached. First use later = instant.

## 17. Stop Processing When Far

Global anti-pattern: a thread processing every resource's logic for every player all the time.

Gate by distance or by "am I involved":

```lua
local players = lib.getNearbyPlayers(coords, 50.0)
for _, src in ipairs(players) do
    -- only these players care
end
```

## Checklist Before Shipping

- [ ] No `while true do ... Wait(0) end` without gating
- [ ] `resmon` < 0.05ms idle
- [ ] DB writes batched or on events (not per frame)
- [ ] No `GetGamePool` in hot loops
- [ ] Locals in hot loops
- [ ] State bags for continuous sync
- [ ] Targeted `TriggerClientEvent`, not `-1` broadcast
- [ ] `SetModelAsNoLongerNeeded` after Create
- [ ] NUI not receiving messages every frame
- [ ] `onResourceStop` cleanup

## TL;DR

- Cache repeated native calls
- Batch DB ops
- Event-driven > polling
- Targeted broadcasts
- Unload assets
- Profile with resmon + profiler
- Gate work by distance / visibility

## Sources

- FiveM profiler: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/
- Cookbook (community performance patterns): https://cookbook.fivem.net/
- ox_lib points (source): https://github.com/communityox/ox_lib/tree/master/imports/points
- ox_lib zones: https://coxdocs.dev/ox_lib/Modules/Zones/Shared

Next folder: `10-first-projects/`
