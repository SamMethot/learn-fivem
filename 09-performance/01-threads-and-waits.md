# 01. Threads & Waits

## Plain English

Most "FiveM is laggy" problems trace back to **bad threading**. Resources running `while true` loops every frame doing distance checks. Servers with 50 of those running simultaneously eat all the tick budget and you wonder why the framerate's awful.

This lesson teaches the main rule: **`Wait(0)` only when you actually need every-frame execution.** Most of the time, `Wait(500)`, `Wait(1000)`, or - better - event-driven code, is the answer.

---

## Threads

Lua doesn't have OS threads. FiveM gives you **coroutines** via `CreateThread` - cooperative tasks that yield via `Wait`:

```lua
CreateThread(function()
    while true do
        -- do stuff
        Wait(1000)                                              -- yield for 1000 ms
    end
end)
```

`CreateThread` starts a coroutine. `Wait(ms)` yields control back to the FiveM scheduler for at least that many milliseconds before the next tick.

**No `Wait` in `while true`** = busy loop. The game freezes. Possible client/server crash.

```lua
-- BAD: never yields, will freeze the engine
CreateThread(function()
    while true do
        someCheck()
        -- no Wait here = infinite loop
    end
end)
```

---

## Wait Values

Pick the right interval for the job:

| Wait | Frequency | Use for |
|------|-----------|---------|
| `Wait(0)` | Every frame (60+ Hz) | Drawing markers/text, reading per-frame controls |
| `Wait(100)` | 10× / sec | Smooth-feeling state checks |
| `Wait(500)` | 2× / sec | Periodic updates, distance checks |
| `Wait(1000)` | 1× / sec | Slow stat updates, blip refresh |
| `Wait(5000)` | 1× / 5s | Background tasks, heartbeats |
| `Wait(60000)` | 1× / min | DB flushes, long-period jobs |

Default to `Wait(1000)`. Only drop lower when truly needed.

---

## Why `Wait(0)` Hurts

A 60 fps client has a ~16ms budget per frame. Your loop:

```lua
CreateThread(function()
    while true do
        local ped = PlayerPedId()                                -- native call
        local coords = GetEntityCoords(ped)                      -- native call
        if #(coords - targetCoords) < 5.0 then
            DrawText(...)                                        -- expensive at 60fps
        end
        Wait(0)                                                  -- back next frame
    end
end)
```

This runs 60+ times a second. **One resource doing this is fine.** 50 resources doing this = 3,000+ native calls per second + 50 distance computations = noticeable hitches.

**Plus:** if `targetCoords` is across the map, you're doing the distance math forever even though it's never going to be < 5.0.

---

## The Distance Check Pattern

The single most common anti-pattern in FiveM. Three versions, getting better:

### BAD - Always 60 fps

```lua
CreateThread(function()
    while true do
        local coords = GetEntityCoords(PlayerPedId())
        if #(coords - zoneCenter) < 5.0 then
            DrawMarker(...)
            if IsControlJustPressed(0, 38) then openShop() end   -- E key
        end
        Wait(0)
    end
end)
```

Always 60 fps, always doing distance math even when 1km away.

### BETTER - Variable Sleep Based On Distance

```lua
CreateThread(function()
    while true do
        local sleep = 1000                                      -- default: check once a second
        local coords = GetEntityCoords(PlayerPedId())
        local dist = #(coords - zoneCenter)

        if dist < 20.0 then                                     -- player is close
            sleep = 0                                           -- tight loop, draw markers
            DrawMarker(...)
            if IsControlJustPressed(0, 38) then openShop() end
        elseif dist < 100.0 then
            sleep = 500                                         -- mid-range, occasional check
        end
        -- else: sleep stays at 1000 - far away, barely check

        Wait(sleep)
    end
end)
```

Tight only when close. The variable `sleep` is the trick.

### BEST - Use `lib.points`

```lua
local point = lib.points.new({
    coords = zoneCenter,
    distance = 5.0,
})

-- ↓ runs only when player is within distance, batched with all other points by ox_lib
function point:nearby()
    DrawMarker(...)
    if IsControlJustPressed(0, 38) then openShop() end
end
```

ox_lib runs ONE shared loop for all points. Your resource does **zero idle work** - `nearby` only fires when you're close.

---

## Event-Driven > Polling

If you can listen for an event instead of polling state, do it.

### Bad - polling

```lua
CreateThread(function()
    while true do
        local ped = PlayerPedId()
        if IsPedInAnyVehicle(ped, false) then
            -- in vehicle logic
        end
        Wait(500)
    end
end)
```

This runs forever. Twice a second. Even when the player has been on foot for an hour.

### Good - event-driven via `lib.onCache`

```lua
lib.onCache('vehicle', function(newVeh)
    if newVeh then
        -- entered vehicle
    else
        -- exited vehicle
    end
end)
```

Fires only on **state change**. **Zero idle cost.**

---

## Hot Loop Sins

### 1. `GetPlayerServerId(PlayerId())` every frame

The server ID doesn't change after spawn. Cache once:

```lua
local myServerId

CreateThread(function()
    while not NetworkIsSessionStarted() do Wait(100) end        -- wait for connection
    myServerId = GetPlayerServerId(PlayerId())                  -- cache forever
end)
```

### 2. `GetGamePool('CVehicle')` every frame

**EXPENSIVE.** It traverses every vehicle the engine tracks. Rarely needed every frame.

If you need nearby vehicles, use `lib.getNearbyVehicles(coords, radius, false)` - radius-bound and batched.

### 3. Raycasting every frame

`StartShapeTestRay` is expensive. Cache results, only re-cast when state changes (player moved significantly, looked in different direction).

### 4. Drawing too much text/markers every frame

`DrawText` is OK in moderation. `DrawMarker` is expensive. Gate with distance + use `lib.zones` / `lib.points`.

### 5. Server-side `while true` scanning all players

```lua
-- BAD on server
CreateThread(function()
    while true do
        for _, src in ipairs(GetPlayers()) do
            -- some check on every player
        end
        Wait(100)                                               -- 10× per second × 64 players = 640 ops/sec
    end
end)
```

Server tick budget is precious. Use `Wait(1000)` minimum for periodic server checks. Better: drive logic from events (`playerJoining`, `playerDropped`, `gameEventTriggered`) instead of scanning.

---

## Server Threads

Server `Wait(0)` ≈ one server tick (usually 30-50ms). Still respect the budget:

```lua
-- BAD: floods the server
CreateThread(function()
    while true do
        for _, src in ipairs(GetPlayers()) do
            local player = exports.qbx_core:GetPlayer(tonumber(src))
            if player then
                player.Functions.SetMetaData('hunger',
                    (player.PlayerData.metadata.hunger or 100) - 1)
            end
        end
        Wait(1000)                                              -- once per second drain hunger
    end
end)
```

With 128 players, that's 128 `SetMetaData` calls per second + 128 DB writes. Heavy.

Better - stagger or batch:

```lua
CreateThread(function()
    while true do
        Wait(60000)                                             -- every minute
        for _, src in ipairs(GetPlayers()) do
            -- drain hunger by some amount, batched DB write
        end
    end
end)
```

---

## Resource Monitor (`resmon`)

In-game console (F8 or server console):

```
resmon
```

Shows per-resource CPU and memory:

```
Resource          CPU ms     Memory
my_resource       0.05       2.5 MB
laggy_thing       1.20       8.1 MB    ← hot, investigate
```

Rule of thumb (client side):
- **Idle:** under 0.02 ms
- **Active (UI open, near zone):** under 0.1 ms
- **Hot (combat, driving with mods loaded):** under 0.3 ms
- **Anything over 0.5 ms** sustained = needs work

Server-side has its own budget - depends on player count. Use `txAdmin`'s monitor or the cfx server profiler.

---

## Profiling (Detailed)

```
profiler record 500             # records 500 frames
profiler save my_capture.json   # save to disk
```

Open the resulting JSON in Chrome DevTools → Performance → Load Profile. You get a flame chart showing exactly which natives are hot.

Or use the MCP tool if available:

```
resmon_snapshot label='before'
# (apply optimization, restart resource)
resmon_snapshot label='after'
benchmark_compare before after
```

Hard numbers, before/after.

---

## Cleanup Threads On Resource Stop

```lua
local running = true                                            -- shared flag

CreateThread(function()
    while running do                                            -- check the flag instead of `true`
        Wait(1000)
        -- stuff
    end
end)

AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    running = false                                             -- next iteration ends the loop
end)
```

In practice, FiveM kills threads on resource stop anyway - but for long `Wait(5000+)` threads, a clean shutdown avoids weird half-tick state.

---

## Decision Tree - "How Should I Run This Code?"

```
Need to do X?
├── Is there a FiveM event for it? → AddEventHandler
├── Is there lib.onCache for the state? → use it
├── Is it a zone trigger? → lib.points or lib.zones
├── Is it periodic? → CreateThread + Wait(1000+), gate by distance
└── Must run per-frame? → CreateThread + Wait(0), but ONLY the bare minimum
```

---

## TL;DR

- **Never** `while true` without `Wait(...)`
- `Wait(0)` only for true per-frame work; everything else `Wait(500)+`
- Variable sleep based on distance is huge
- Event-driven > polling. `lib.onCache`, `lib.points`, `gameEventTriggered`.
- Server: `Wait(1000+)` for periodic loops
- `resmon` to find hot resources, `profiler` for deep dives

---

## Sources

- [FiveM Lua Runtime](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/) - `CreateThread`, `Wait`
- [resmon and profiler](https://docs.fivem.net/docs/scripting-reference/profiler/) - performance tools
- [ox_lib points (source)](https://github.com/communityox/ox_lib/tree/master/imports/points) - batched distance loop
- [ox_lib zones](https://coxdocs.dev/ox_lib/Modules/Zones/Shared)
- [FiveM Cookbook - performance](https://cookbook.fivem.net/) - community patterns

---

Next: [`02-optimization-patterns.md`](02-optimization-patterns.md)
