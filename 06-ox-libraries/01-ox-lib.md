# 01. ox_lib

**ox_lib** = utility library. Notifications, menus, input dialogs, progress bars, zones, callbacks, cache, keybinds. Used by nearly every modern FiveM resource.

## Setup

```lua
-- fxmanifest.lua
shared_script '@ox_lib/init.lua'

lua54 'yes'
```

Now `lib` global available on both sides.

## Notifications

```lua
lib.notify({
    id = 'unique_id',         -- optional, prevents duplicate
    title = 'Shop',
    description = 'You bought bread',
    type = 'success',         -- success, error, inform, warning
    position = 'top-right',   -- optional
    duration = 5000,
    icon = 'fa-bread-slice',  -- FontAwesome
    iconColor = '#F59E0B',
})
```

From server:
```lua
TriggerClientEvent('ox_lib:notify', src, { title='Hi', description='x', type='inform' })
```

## Progress Bar

```lua
-- client
local ok = lib.progressBar({
    duration = 3000,
    label = 'Picking lock...',
    useWhileDead = false,
    canCancel = true,
    disable = { car = true, move = true, combat = true },
    anim = { dict = 'anim@heists@keycard@', clip = 'exit' },
})

if ok then
    -- completed
else
    -- cancelled
end
```

`progressCircle` = circle instead of bar. Same args.

## Context Menu

```lua
lib.registerContext({
    id = 'shop_menu',
    title = 'Shop',
    options = {
        { title = 'Buy Bread', description = '$10', icon = 'bread-slice',
          onSelect = function() buy('bread') end },
        { title = 'Buy Water', description = '$5', icon = 'bottle-water',
          onSelect = function() buy('water') end },
    }
})

lib.showContext('shop_menu')
```

Submenus = set `menu = 'child_id'` in option. Register the child too.

## Input Dialog

```lua
local input = lib.inputDialog('Create Plate', {
    { type = 'input', label = 'Plate number', required = true, min = 2, max = 8 },
    { type = 'number', label = 'Year', default = 2024 },
    { type = 'select', label = 'Color', options = {
        { value = 'red', label = 'Red' },
        { value = 'blue', label = 'Blue' },
    }},
    { type = 'checkbox', label = 'Insured' },
})

if not input then return end    -- cancelled
local plate, year, color, insured = input[1], input[2], input[3], input[4]
```

## Alert Dialog

```lua
local choice = lib.alertDialog({
    header = 'Confirm',
    content = 'Are you sure?',
    centered = true,
    cancel = true,
})

if choice == 'confirm' then ... end
```

## Callbacks

Client -> Server round trip. Already covered in `02-events/04-callbacks.md`. Recap:

```lua
-- server
lib.callback.register('shop:buy', function(src, item)
    return true, 'bought'
end)

-- client
local ok, msg = lib.callback.await('shop:buy', false, 'bread')
```

## Cache

Frequently-read client state cached:

```lua
local ped = cache.ped          -- current ped handle, auto-updated
local veh = cache.vehicle      -- current vehicle or nil
local seat = cache.seat
local weapon = cache.weapon
```

Event when it changes:
```lua
lib.onCache('vehicle', function(new)
    if new then print('entered veh', new) end
    if not new then print('exited veh') end
end)
```

Cheaper than polling every frame.

## Keybinds

```lua
lib.addKeybind({
    name = 'open_menu',
    description = 'Open my menu',
    defaultKey = 'F6',
    onPressed = function(self)
        openMenu()
    end,
})
```

Registers a keybind users can remap in FiveM settings.

## Points (3D Trigger Zones)

```lua
local point = lib.points.new({
    coords = vec3(100.0, 200.0, 20.0),
    distance = 5.0,
})

function point:onEnter()
    lib.notify({ description='near shop' })
end

function point:onExit()
    lib.notify({ description='left shop' })
end

function point:nearby()
    -- called every frame while in distance
    DrawMarker(...)
end
```

Cheaper than manual Wait(0) loops checking distance.

## Zones (Polygons / Boxes)

```lua
local zone = lib.zones.box({
    coords = vec3(100.0, 200.0, 30.0),
    size = vec3(5.0, 5.0, 3.0),
    rotation = 0.0,
    onEnter = function(self) print('entered') end,
    onExit = function(self) print('exited') end,
    inside = function(self) end,
})
```

Polygon zones: `lib.zones.poly({ points = {vec3,...} })`.

Often used for job areas, safe zones.

## Table Helpers

```lua
lib.table.contains(tbl, value)
lib.table.deepclone(tbl)
lib.table.matches(a, b)
lib.table.freeze(tbl)
```

## Math Helpers

```lua
lib.math.round(3.7)                   -- 4
lib.math.round(3.14159, 2)            -- 3.14
lib.math.clamp(15, 0, 10)             -- 10
lib.math.random(1, 10)
```

## Player / Ped / Vehicle Nearby

```lua
local players = lib.getNearbyPlayers(coords, 10.0, false)     -- nearby src list
local peds = lib.getNearbyPeds(coords, 10.0)
local vehicles = lib.getNearbyVehicles(coords, 10.0, false)
```

Batched, cheaper than manually looping.

## Locale

```lua
-- locales/en.json
{ "welcome": "Welcome %s" }

-- code
lib.locale()                              -- load based on convar
local msg = locale('welcome', playerName)
```

Multi-language support.

## Version Check

```lua
lib.versionCheck('yourname/yourrepo')     -- checks GitHub for updates
```

## Server-Side Helpers

```lua
-- banned?
local banned = lib.isPlayerBanned(src)

-- license plate format (random)
-- etc, check docs
```

## Docs

- Official: https://overextended.dev/ox_lib
- Brain: Fivem Brain wiki doesn't have ox_lib, use `fivem_doc_lookup` for signatures

## TL;DR

- `shared_script '@ox_lib/init.lua'` + `lua54 'yes'`
- `lib.notify`, `lib.progressBar`, `lib.registerContext/showContext`
- `lib.callback.register/await`
- `cache.ped`, `cache.vehicle`, `lib.onCache`
- `lib.points`, `lib.zones` over manual Wait loops
- Use for everything. Cleaner than vanilla natives.

## Sources

- ox_lib docs: https://coxdocs.dev/ox_lib
- ox_lib GitHub: https://github.com/overextended/ox_lib
- Cache module: https://coxdocs.dev/ox_lib/Modules/Cache/Client
- Points module (source): https://github.com/communityox/ox_lib/tree/master/imports/points

Next: `02-ox-target.md`
