# 01. Threads & Waits

Performance starts with loops. Most bad FiveM code = threads running every frame doing nothing. Know when to `Wait(0)` vs `Wait(1000)` vs event-driven.

## Threads

```lua
CreateThread(function()
    while true do
        -- stuff
        Wait(1000)
    end
end)
```

`CreateThread` creates a coroutine. `Wait(ms)` yields back to scheduler.

No `Wait` in a `while true` = infinite loop, game freezes, server or client crashes.

## Wait Values

| Wait | FPS equivalent | Use for |
|------|---------------|---------|
| `Wait(0)` | Every frame (~60+/sec) | Drawing, controls, input |
| `Wait(100)` | 10x/sec | Smooth-ish checks |
| `Wait(500)` | 2x/sec | Periodic state checks |
| `Wait(1000)` | Once/sec | Stat updates, markers |
| `Wait(5000)` | Once/5s | Background tasks |

Default: `Wait(1000)`. Only drop lower when needed.

## Why Wait(0) Hurts

60+ fps loop = ~16ms budget per frame. Your loop:

```lua
CreateThread(function()
    while true do
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        if #(coords - targetCoords) < 5.0 then
            DrawText(...)
        end
        Wait(0)
    end
end)
```

Runs 60 times per second. Harmless alone. 50 resources doing this = 3000 computations/sec of native calls. Server tick time = 5ms+. Dip on every frame.

## The Distance Check Pattern

Most common anti-pattern: zone detection at 60fps.

### BAD

```lua
CreateThread(function()
    while true do
        local coords = GetEntityCoords(PlayerPedId())
        if #(coords - zoneCenter) < 5.0 then
            DrawMarker(...)
            if IsControlJustPressed(0, 38) then openShop() end
        end
        Wait(0)
    end
end)
```

### BETTER (gated)

```lua
CreateThread(function()
    while true do
        local sleep = 1000
        local coords = GetEntityCoords(PlayerPedId())
        local dist = #(coords - zoneCenter)

        if dist < 20.0 then
            sleep = 0     -- close enough, tight loop
            DrawMarker(...)
            if IsControlJustPressed(0, 38) then openShop() end
        elseif dist < 100.0 then
            sleep = 500   -- mid range, occasional
        end

        Wait(sleep)
    end
end)
```

Variable sleep. Tight only when needed.

### BEST (ox_lib points)

```lua
local point = lib.points.new({
    coords = zoneCenter,
    distance = 5.0,
})

function point:nearby()
    DrawMarker(...)
    if IsControlJustPressed(0, 38) then openShop() end
end
```

Batched with other points. Lib manages the loop.

## Event-Driven Over Polling

Bad:
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

Good:
```lua
lib.onCache('vehicle', function(newVeh)
    if newVeh then
        -- entered vehicle
    else
        -- exited vehicle
    end
end)
```

Fires ONLY when the state changes. Zero idle cost.

## Hot Loop Sins

### 1. Calling `GetPlayerServerId(PlayerId())` every frame
Cache it once:
```lua
local myServerId
CreateThread(function()
    while not NetworkIsSessionStarted() do Wait(100) end
    myServerId = GetPlayerServerId(PlayerId())
end)
```

### 2. `GetGamePool('CVehicle')` every frame
EXPENSIVE. Traverses every vehicle. Rarely needed every frame.

### 3. Raycasting every frame
`StartShapeTestRay` every frame = eats performance. Cache at intervals.

### 4. Drawing too much text / markers every frame
`DrawText` ok occasionally. `DrawMarker` expensive. Gate with distance + ox_lib.

### 5. Server `while true do Wait(100)` scanning all players
```lua
-- BAD on server
CreateThread(function()
    while true do
        for _, src in ipairs(GetPlayers()) do
            -- check something
        end
        Wait(100)
    end
end)
```

Server threads are tick budget too. Wait 1000+ for periodic.

## Server Threads

Server Wait(0) = one server tick. Usually 30-50ms. Still respect:

```lua
-- BAD: floods server
CreateThread(function()
    while true do
        for _, src in ipairs(GetPlayers()) do
            local player = exports.qbx_core:GetPlayer(tonumber(src))
            if player then
                player.Functions.SetMetaData('hunger', (player.PlayerData.metadata.hunger or 100) - 1)
            end
        end
        Wait(1000)    -- every second, -1 hunger to all
    end
end)
```

With 128 players, 128 SetMetaData calls/sec + 128 DB writes if those persist. Eats CPU.

Batch or stagger:
```lua
CreateThread(function()
    while true do
        Wait(60000)   -- every minute
        for _, src in ipairs(GetPlayers()) do ... end
    end
end)
```

## Resource Monitor (resmon)

In game: `resmon` command. Shows:

```
Resource          CPU ms  Memory
my_resource       0.05    2.5 MB
another           1.20    8.1 MB   <- hot
```

Rule of thumb:
- Idle client: < 0.02 ms
- Active interaction: < 0.1 ms
- Hot (combat, driving): < 0.3 ms
- Anything over 0.5 ms = investigate

Profile with `profiler record 500` then `profiler save filename.json` then open in Chrome DevTools.

## Benchmarking

Use MCP tools:
```
resmon_snapshot label='before'
-- change code, restart resource
resmon_snapshot label='after'
benchmark_compare before after
```

Hard numbers before/after.

## Cleanup Threads On Resource Stop

```lua
local running = true

CreateThread(function()
    while running do
        Wait(1000)
        -- stuff
    end
end)

AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    running = false
end)
```

Without this, restart the resource = old thread keeps running? Actually old state discarded on restart, but for long Wait(5000+) threads, dead thread can linger briefly. Clean anyway for good hygiene.

## Summary Decision Tree

```
Need to do X ?
├── Is there a FiveM event for it ? -> AddEventHandler
├── Is there lib.onCache ? -> use it
├── Is it a zone ? -> lib.points or lib.zones
├── Is it periodic ? -> Wait(1000+), gate by distance
└── Must be per-frame ? -> Wait(0) but ONLY the minimum lines
```

## TL;DR

- No `Wait(0)` in `while true` without distance gating
- Event-driven > polling (lib.onCache, points, zones)
- Server threads: Wait 1000+ mostly
- `resmon` to find hot resources
- ox_lib points/zones batch distance checks
- Dynamic sleep in loops

## Sources

- FiveM Lua runtime: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/
- Lua runtime (CreateThread / Wait live here): https://docs.fivem.net/docs/scripting-reference/runtimes/lua/
- resmon (resource monitor): https://docs.fivem.net/docs/server-manual/setting-up-a-server/

Next: `02-optimization-patterns.md`
