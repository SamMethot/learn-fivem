# 01. ox_lib

## Plain English

**ox_lib** is the swiss-army library of FiveM. Every modern resource depends on it. It gives you:

- Notifications, menus, dialogs, progress bars
- Callbacks (covered in [`02-events/04-callbacks.md`](../02-events/04-callbacks.md))
- A cache module for common client state (current ped, current vehicle, etc.)
- Keybinds you can rebind in FiveM settings
- 3D zones and points (way cheaper than rolling your own distance loops)
- Dozens of small helpers for tables, math, locales, version checks

You'll use `lib.notify`, `lib.callback`, and `lib.points` constantly.

---

## Setup

In your `fxmanifest.lua`:

```lua
shared_script '@ox_lib/init.lua'                                -- enable lib globals on both sides

lua54 'yes'                                                     -- ox_lib needs Lua 5.4
```

Now `lib` is a global on both client and server. Some modules are client-only or server-only - docs say which.

---

## Notifications - `lib.notify`

The most-used function in any FiveM script.

```lua
-- ↓ called on the CLIENT
lib.notify({
    id = 'unique_id',                       -- [optional] dedupe key. If a notif with the same id is already showing, replaces it instead of stacking.
    title = 'Shop',                         -- [optional*] header text - *need this OR description
    description = 'You bought bread',       -- [optional*] body, supports markdown
    type = 'success',                       -- [optional] 'inform' (default), 'success', 'error', 'warning'
    position = 'top-right',                 -- [optional] default 'top-right'. Other: 'top', 'top-left', 'bottom-*', 'center-*'
    duration = 5000,                        -- [optional] ms. default 3000.
    icon = 'fa-bread-slice',                -- [optional] FontAwesome 6 icon name (with or without 'fa-' prefix)
    iconColor = '#F59E0B',                  -- [optional] CSS color. Default = matches type.
})
```

From the server (sends to a specific client):

```lua
TriggerClientEvent('ox_lib:notify', src, {
    title = 'Hi',
    description = 'Hello there',
    type = 'inform',
})
```

Bare-minimum call:

```lua
lib.notify({ description = 'Saved' })   -- defaults: type=inform, position=top-right, duration=3000
```

[Full notify options](https://coxdocs.dev/ox_lib/Modules/Interface/Client/notify) - every field documented.

---

## Progress Bar - `lib.progressBar`

Block player input while showing a bar (lockpicking, hacking, drinking):

```lua
local ok = lib.progressBar({
    duration = 3000,                                            -- 3 seconds
    label = 'Picking lock...',
    useWhileDead = false,                                       -- can the action continue if the player dies?
    canCancel = true,                                           -- press X to cancel
    disable = {                                                 -- which controls to block during the bar
        car = true,                                             -- driving
        move = true,                                            -- WASD
        combat = true,                                          -- shooting
    },
    anim = {                                                    -- play an animation
        dict = 'anim@heists@keycard@',
        clip = 'exit',
    },
})

if ok then
    -- bar completed
else
    -- player cancelled or died
end
```

`progressCircle` is the circular variant - same args.

---

## Context Menu - `lib.registerContext` / `lib.showContext`

The menu you see when you target NPCs and pick options. Two-step: register the menu definition, then show it.

```lua
-- ↓ define the menu
lib.registerContext({
    id = 'shop_menu',                                           -- unique ID for this menu
    title = 'Shop',                                             -- shown at top
    options = {
        {
            title = 'Buy Bread',                                -- option label
            description = '$10',                                -- subtext
            icon = 'bread-slice',                               -- FontAwesome icon
            onSelect = function()                               -- runs when player clicks
                buy('bread')
            end,
        },
        {
            title = 'Buy Water',
            description = '$5',
            icon = 'bottle-water',
            onSelect = function() buy('water') end,
        },
    },
})

-- ↓ open it
lib.showContext('shop_menu')
```

For submenus, set `menu = 'child_id'` on an option, and register a child menu with that ID.

---

## Input Dialog - `lib.inputDialog`

Pop up a form with multiple input types. Returns a table of values, or `nil` if cancelled.

```lua
local input = lib.inputDialog('Create Plate', {
    {
        type = 'input',                                          -- text input
        label = 'Plate number',
        required = true,                                         -- must be filled
        min = 2, max = 8,                                        -- length bounds
    },
    {
        type = 'number',                                         -- numeric input
        label = 'Year',
        default = 2024,
    },
    {
        type = 'select',                                         -- dropdown
        label = 'Color',
        options = {
            { value = 'red', label = 'Red' },
            { value = 'blue', label = 'Blue' },
        },
    },
    {
        type = 'checkbox',                                       -- boolean
        label = 'Insured',
    },
})

if not input then return end                                     -- player cancelled

-- ↓ values come back in the same ORDER as the fields above
local plate, year, color, insured = input[1], input[2], input[3], input[4]
```

---

## Alert Dialog - `lib.alertDialog`

Confirm dialog with OK/Cancel:

```lua
local choice = lib.alertDialog({
    header = 'Confirm',
    content = 'Are you sure you want to delete this?',
    centered = true,
    cancel = true,                                              -- show cancel button
})

if choice == 'confirm' then
    -- they clicked OK
end
```

---

## Callbacks - Already Covered

Full deep-dive in [`02-events/04-callbacks.md`](../02-events/04-callbacks.md). Quick recap:

```lua
-- ↓ server side
lib.callback.register('shop:buy', function(src, item)
    return true, 'bought'
end)

-- ↓ client side
local ok, msg = lib.callback.await('shop:buy', false, 'bread')
```

---

## Cache - Auto-Updated Common State

Polling for "is the player in a vehicle" wastes CPU. The cache module gives you these for free:

```lua
-- ↓ these auto-update when state changes
local ped = cache.ped                                           -- current ped handle
local veh = cache.vehicle                                       -- vehicle they're in, or nil
local seat = cache.seat                                         -- seat index, or nil
local weapon = cache.weapon                                     -- equipped weapon hash
```

React to changes via `lib.onCache`:

```lua
-- ↓ fires only when the cached value CHANGES (much cheaper than polling)
lib.onCache('vehicle', function(newVeh)
    if newVeh then
        print('entered vehicle', newVeh)
    else
        print('exited vehicle')
    end
end)
```

This replaces a `while true do Wait(500) end` polling loop entirely.

---

## Keybinds - `lib.addKeybind`

Register keybinds users can remap in FiveM's settings menu:

```lua
lib.addKeybind({
    name = 'open_menu',                                         -- internal name
    description = 'Open my menu',                               -- shown in settings UI
    defaultKey = 'F6',                                          -- default key
    onPressed = function(self)
        openMenu()
    end,
})
```

Players can rebind via Settings → Keybinds → FiveM. Better than hardcoding keys.

---

## Points - 3D Trigger Zones

A "point" = a coordinate with a distance threshold. ox_lib batches all points together so you have ONE shared distance loop instead of 50 separate `while true` loops.

```lua
-- ↓ create a point
local point = lib.points.new({
    coords = vec3(100.0, 200.0, 20.0),
    distance = 5.0,                                              -- player is "near" within 5m
})

-- ↓ fires once when the player crosses INTO range
function point:onEnter()
    lib.notify({ description = 'near shop' })
end

-- ↓ fires once when the player crosses OUT of range
function point:onExit()
    lib.notify({ description = 'left shop' })
end

-- ↓ fires every frame while player is within range
function point:nearby()
    DrawMarker(...)                                              -- draw the marker only when nearby
end
```

Massive perf win over rolling your own. Use this for shop ranges, mission triggers, cutscene starts.

---

## Zones - Polygon / Box / Sphere

For larger or non-spherical areas:

```lua
-- ↓ box zone (rotated rectangle)
local zone = lib.zones.box({
    coords = vec3(100.0, 200.0, 30.0),
    size = vec3(5.0, 5.0, 3.0),                                 -- length, width, height
    rotation = 0.0,
    onEnter = function(self) print('entered') end,
    onExit = function(self) print('exited') end,
    inside = function(self) end,                                -- runs while inside (can be nil)
})

-- ↓ sphere zone (faster, simpler than box for round areas)
local zone2 = lib.zones.sphere({
    coords = vec3(100.0, 200.0, 30.0),
    radius = 5.0,
    onEnter = function(self) end,
    onExit = function(self) end,
})

-- ↓ polygon zone (custom shape, define points)
local zone3 = lib.zones.poly({
    points = { vec3(0,0,0), vec3(10,0,0), vec3(10,10,0), vec3(0,10,0) },
    onEnter = function(self) end,
})
```

Use for job areas, safe zones, no-PVP regions.

---

## Table Helpers

```lua
lib.table.contains(tbl, value)                                  -- is value in tbl?
lib.table.deepclone(tbl)                                        -- deep copy
lib.table.matches(a, b)                                         -- recursive equality
lib.table.freeze(tbl)                                           -- make read-only
```

---

## Math Helpers

```lua
lib.math.round(3.7)                                              -- 4
lib.math.round(3.14159, 2)                                       -- 3.14 (round to 2 decimals)
lib.math.clamp(15, 0, 10)                                        -- 10 (clamp into [0, 10])
lib.math.random(1, 10)                                           -- inclusive random integer
```

---

## Nearby Player / Ped / Vehicle

Batched - way cheaper than `GetGamePool` + manual loop:

```lua
local players = lib.getNearbyPlayers(coords, 10.0, false)       -- nearby player srcs within 10m
local peds = lib.getNearbyPeds(coords, 10.0)                    -- nearby ped handles
local vehicles = lib.getNearbyVehicles(coords, 10.0, false)     -- nearby vehicle handles
```

---

## Locale (Translations)

```json
// locales/en.json
{ "welcome": "Welcome %s" }
```

```lua
-- ↓ load the right locale based on convar
lib.locale()

-- ↓ use it
local msg = locale('welcome', playerName)
```

The active locale is set via `set ox:locale 'en'` in `server.cfg`.

---

## Version Check

```lua
lib.versionCheck('yourname/yourrepo')                           -- pings GitHub for the latest release
```

Useful for resources you ship publicly - warns admins if they're out of date.

---

## Server-Side Helpers (Some)

```lua
local banned = lib.isPlayerBanned(src)                          -- check ban status
-- ↑ check current docs for full server-side surface
```

---

## TL;DR

- `shared_script '@ox_lib/init.lua'` + `lua54 'yes'` to enable
- `lib.notify`, `lib.progressBar`, `lib.registerContext` / `lib.showContext`
- `lib.callback.register` / `lib.callback.await`
- `cache.ped`, `cache.vehicle`, `lib.onCache` instead of polling
- `lib.points`, `lib.zones` for distance-triggered logic
- Use ox_lib helpers everywhere - they're batched and cheaper than rolling your own

---

## Sources

- [ox_lib docs (canonical)](https://coxdocs.dev/ox_lib)
- [ox_lib GitHub](https://github.com/communityox/ox_lib) - source code
- [Notify module](https://coxdocs.dev/ox_lib/Modules/Interface/Client/notify)
- [Callback module (server)](https://coxdocs.dev/ox_lib/Modules/Callback/Lua/Server) and [(client)](https://coxdocs.dev/ox_lib/Modules/Callback/Lua/Client)
- [Cache module](https://coxdocs.dev/ox_lib/Modules/Cache/Client)
- [Points module source](https://github.com/communityox/ox_lib/tree/master/imports/points)
- [Zones module](https://coxdocs.dev/ox_lib/Modules/Zones/Shared)
- [FontAwesome 6 icons](https://fontawesome.com/icons) - icon name reference

---

Next: [`02-ox-target.md`](02-ox-target.md)
