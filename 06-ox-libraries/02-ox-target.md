# 02. ox_target

**ox_target** = third-eye targeting. Player holds a key (default LEFT ALT), crosshair appears, world objects/peds/vehicles highlight with options. Modern standard for interactions.

## When To Use

- Talking to an NPC: ped target
- Interacting with a door / object: model or entity target
- Shop counter, ATM: zone target
- Entering a vehicle trunk: bone target

Way cleaner than "press E while within 1.5m" logic.

## Setup

```lua
-- fxmanifest.lua
dependency 'ox_target'
```

No import needed. Use `exports.ox_target`.

## Add Entity Target

Target a specific spawned entity:

```lua
local ped = CreatePed(...)
exports.ox_target:addLocalEntity(ped, {
    {
        name = 'talk_clerk',
        icon = 'fa-solid fa-comments',
        label = 'Talk to Clerk',
        onSelect = function(data)
            TriggerServerEvent('shop:open')
        end,
        canInteract = function(entity, distance, coords, name, bone)
            return distance < 2.0
        end,
    },
})
```

`data` param inside `onSelect` has `.entity`, `.coords`, `.distance`.

Remove:
```lua
exports.ox_target:removeLocalEntity(ped, 'talk_clerk')
```

## Add Model Target

All entities of a model hash:

```lua
exports.ox_target:addModel({`prop_atm_01`, `prop_atm_02`, `prop_atm_03`}, {
    {
        name = 'use_atm',
        icon = 'fa-solid fa-credit-card',
        label = 'Use ATM',
        onSelect = function()
            openAtmUI()
        end,
    }
})
```

Good for props like ATMs, dumpsters, mailboxes. Don't need to know where they are.

## Add Global Option

All peds, all vehicles, all objects, all players:

```lua
exports.ox_target:addGlobalPed({...})
exports.ox_target:addGlobalVehicle({...})
exports.ox_target:addGlobalObject({...})
exports.ox_target:addGlobalPlayer({...})
```

Example: target any vehicle to check plate:
```lua
exports.ox_target:addGlobalVehicle({
    {
        name = 'check_plate',
        icon = 'fa-solid fa-magnifying-glass',
        label = 'Check Plate',
        groups = 'police',   -- job filter
        onSelect = function(data)
            local plate = GetVehicleNumberPlateText(data.entity)
            lib.notify({ description=plate })
        end,
    }
})
```

## Zone Targets

Target at world coords, no entity required:

```lua
-- box
exports.ox_target:addBoxZone({
    coords = vec3(100.0, 200.0, 30.0),
    size = vec3(2.0, 2.0, 2.0),
    rotation = 0.0,
    debug = false,
    options = {
        { name = 'shop_counter', label = 'Open Shop', icon = 'fa-shop',
          onSelect = function() openShop() end },
    }
})

-- sphere
exports.ox_target:addSphereZone({
    coords = vec3(100.0, 200.0, 30.0),
    radius = 1.5,
    options = { ... }
})
```

`debug = true` = visible wireframe, turn on during development.

Remove:
```lua
exports.ox_target:removeZone('zone_id')   -- if you saved the id
```

## Bone Targets

Vehicle trunk, hood, doors:

```lua
exports.ox_target:addGlobalVehicle({
    {
        name = 'open_trunk',
        bones = { 'boot' },
        label = 'Open Trunk',
        icon = 'fa-solid fa-box-open',
        onSelect = function(data)
            SetVehicleDoorOpen(data.entity, 5, false, false)
        end,
    }
})
```

Bone names: `boot`, `bonnet`, `door_dside_f`, `door_dside_r`, `door_pside_f`, `door_pside_r`, `window_lf`.

## canInteract

Dynamic visibility of option:

```lua
canInteract = function(entity, distance, coords, name, bone)
    if distance > 2.5 then return false end
    local pdata = exports.qbx_core:GetPlayerData()
    return pdata.job.name == 'police'
end,
```

Returns true = show option. False = hide.

## groups

Simpler job filter:

```lua
groups = 'police'
groups = { police = 0, ambulance = 0 }    -- or table with grade minimum
```

## items

Only show if player has item:

```lua
items = 'lockpick'
items = { 'lockpick', 'advancedlockpick' }
items = { lockpick = 1, screwdriver = 2 }    -- require quantities
```

Target handles the check automatically.

## distance

Max distance for this option:

```lua
distance = 1.5
```

Default = 2.0.

## Full Example: ATM

```lua
exports.ox_target:addModel({`prop_atm_01`, `prop_atm_02`, `prop_atm_03`, `prop_fleeca_atm`}, {
    {
        name = 'use_atm',
        icon = 'fa-solid fa-credit-card',
        label = 'Use ATM',
        distance = 1.5,
        onSelect = function()
            TriggerEvent('bank:openATM')
        end,
    },
    {
        name = 'rob_atm',
        icon = 'fa-solid fa-mask',
        label = 'Rob ATM',
        distance = 1.5,
        items = 'drill',
        onSelect = function(data)
            TriggerServerEvent('bank:tryRobAtm', NetworkGetNetworkIdFromEntity(data.entity))
        end,
    }
})
```

## Client Side Only

ox_target = all client. For permission-sensitive ops (money, items), the `onSelect` triggers a server event. Server re-checks everything (see event security).

## Cleanup

On resource stop, remove your targets:

```lua
AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    exports.ox_target:removeModel(`prop_atm_01`, 'use_atm')
    exports.ox_target:removeZone(myZoneId)
end)
```

Otherwise ghost options persist until restart.

## TL;DR

- `dependency 'ox_target'`, use `exports.ox_target:*`
- `addLocalEntity`, `addModel`, `addGlobalVehicle`, `addBoxZone`, `addSphereZone`
- `canInteract`, `groups`, `items`, `distance` for filtering
- `bones` for car parts
- Cleanup on resource stop
- Never trust client, server re-checks on selection

## Sources

- ox_target docs: https://coxdocs.dev/ox_target
- ox_target GitHub: https://github.com/overextended/ox_target

Next: `03-inventories.md`
