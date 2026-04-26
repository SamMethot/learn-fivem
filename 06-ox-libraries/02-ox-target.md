# 02. ox_target

## Plain English

**ox_target** = the "third-eye" interaction system. Player holds a key (default LEFT ALT), a crosshair appears, and world objects/peds/vehicles get highlighted with clickable options. It's the modern standard for "press to interact" in FiveM - way cleaner than rolling your own "press E within 1.5m" logic.

If you've played any modern QBox/QBCore server, you've used this - clicking on doors, ATMs, NPCs, vehicle trunks. That's ox_target.

---

## When To Use It

- **Talking to an NPC** → ped target
- **Interacting with a door / object** → model or entity target
- **Shop counter, ATM** → zone target (pinned to a spot in the world)
- **Opening a vehicle trunk** → bone target (specific car part)

---

## Setup

In `fxmanifest.lua`:

```lua
dependency 'ox_target'                                          -- refuse to start without it
```

No `shared_script` needed. You use `exports.ox_target` directly.

---

## Add Target On A Specific Entity

For something YOU spawned (a shop NPC, a custom prop):

```lua
local ped = CreatePed(...)                                      -- spawn the ped (covered in natives lesson)

-- ↓ attach a target option to this exact entity
exports.ox_target:addLocalEntity(ped, {
    {
        name = 'talk_clerk',                                    -- unique ID for this option (used to remove it later)
        icon = 'fa-solid fa-comments',                          -- FontAwesome icon
        label = 'Talk to Clerk',                                -- text shown when targeting
        onSelect = function(data)                               -- runs when player clicks
            -- data has: data.entity, data.coords, data.distance
            TriggerServerEvent('shop:open')
        end,
        canInteract = function(entity, distance, coords, name, bone)
            -- ↑ optional: hide the option dynamically. return true to show, false to hide.
            return distance < 2.0                               -- only if within 2m
        end,
    },
})
```

Remove it later:

```lua
exports.ox_target:removeLocalEntity(ped, 'talk_clerk')
```

---

## Add Target On A Model (Every Entity Of That Type)

Useful for props that exist all over the map (ATMs, dumpsters, mailboxes):

```lua
-- ↓ this option attaches to ALL entities matching any of these model hashes
exports.ox_target:addModel({ `prop_atm_01`, `prop_atm_02`, `prop_atm_03` }, {
    {
        name = 'use_atm',
        icon = 'fa-solid fa-credit-card',
        label = 'Use ATM',
        onSelect = function()
            openAtmUI()
        end,
    },
})
```

You don't need to know where every ATM in the map is - ox_target finds them by model hash automatically.

---

## Add Target On Every Player / Ped / Vehicle / Object

```lua
exports.ox_target:addGlobalPed({...})           -- every ped in the world
exports.ox_target:addGlobalVehicle({...})       -- every vehicle
exports.ox_target:addGlobalObject({...})        -- every object
exports.ox_target:addGlobalPlayer({...})        -- every other player's character
```

Example: cops can check any vehicle's plate:

```lua
exports.ox_target:addGlobalVehicle({
    {
        name = 'check_plate',
        icon = 'fa-solid fa-magnifying-glass',
        label = 'Check Plate',
        groups = 'police',                                      -- only cops see this option
        onSelect = function(data)
            local plate = GetVehicleNumberPlateText(data.entity)
            lib.notify({ description = plate })
        end,
    },
})
```

---

## Zone Targets - Pin To A Coordinate

When there's no entity, just a spot in the world (a counter, a wall safe, a parking spot):

```lua
-- ↓ box zone
exports.ox_target:addBoxZone({
    coords = vec3(100.0, 200.0, 30.0),                          -- center of the box
    size = vec3(2.0, 2.0, 2.0),                                 -- length, width, height
    rotation = 0.0,                                              -- yaw degrees
    debug = false,                                               -- set true to see a wireframe during dev
    options = {
        {
            name = 'shop_counter',
            label = 'Open Shop',
            icon = 'fa-shop',
            onSelect = function() openShop() end,
        },
    },
})

-- ↓ sphere zone (round)
exports.ox_target:addSphereZone({
    coords = vec3(100.0, 200.0, 30.0),
    radius = 1.5,
    options = { ... },
})
```

`debug = true` shows the zone outline in-game. Turn on while developing, turn off before shipping.

Remove a zone (if you saved its returned ID):

```lua
local zoneId = exports.ox_target:addBoxZone({...})
-- later
exports.ox_target:removeZone(zoneId)
```

---

## Bone Targets - Specific Vehicle Parts

Target the trunk, hood, doors, windows of a car:

```lua
exports.ox_target:addGlobalVehicle({
    {
        name = 'open_trunk',
        bones = { 'boot' },                                     -- only show when targeting the trunk bone
        label = 'Open Trunk',
        icon = 'fa-solid fa-box-open',
        onSelect = function(data)
            -- ↓ open the trunk door (door index 5 = trunk)
            SetVehicleDoorOpen(data.entity, 5, false, false)
        end,
    },
})
```

Common bone names:
- `boot` - trunk
- `bonnet` - hood
- `door_dside_f` - driver's front door
- `door_dside_r` - driver's rear door
- `door_pside_f` - passenger front
- `door_pside_r` - passenger rear
- `window_lf` - front-left window

---

## `canInteract` - Dynamic Visibility

Hide an option based on runtime state:

```lua
canInteract = function(entity, distance, coords, name, bone)
    if distance > 2.5 then return false end                     -- too far
    local pdata = exports.qbx_core:GetPlayerData()
    return pdata.job.name == 'police'                            -- only cops see this
end,
```

Returns `true` → show. `false` → hide.

---

## `groups` - Job Filter (Shorthand)

For a simple job check, `groups` is cleaner:

```lua
groups = 'police'                                                -- only cops
groups = { police = 0, ambulance = 0 }                           -- cops OR EMS, grade 0+ (any rank)
groups = { police = 2 }                                          -- cops grade 2+
```

---

## `items` - Require An Item

Only show the option if the player has a specific item:

```lua
items = 'lockpick'                                               -- needs at least 1 lockpick
items = { 'lockpick', 'advancedlockpick' }                       -- ANY of these
items = { lockpick = 1, screwdriver = 2 }                        -- needs both, in those quantities
```

ox_target checks the player's inventory automatically.

---

## `distance` - Override Max Range

```lua
distance = 1.5                                                   -- 1.5m max. default = 2.0
```

---

## Full Example - ATM With Two Options

```lua
exports.ox_target:addModel({ `prop_atm_01`, `prop_atm_02`, `prop_atm_03`, `prop_fleeca_atm` }, {
    {
        name = 'use_atm',
        icon = 'fa-solid fa-credit-card',
        label = 'Use ATM',
        distance = 1.5,
        onSelect = function()
            TriggerEvent('bank:openATM')                         -- local event to bank resource
        end,
    },
    {
        name = 'rob_atm',
        icon = 'fa-solid fa-mask',
        label = 'Rob ATM',
        distance = 1.5,
        items = 'drill',                                         -- need a drill in inventory
        onSelect = function(data)
            -- ↓ pass the network ID so the server can identify this exact ATM
            TriggerServerEvent('bank:tryRobAtm', NetworkGetNetworkIdFromEntity(data.entity))
        end,
    },
})
```

---

## ox_target Is Client Only

The whole library runs on the client. **Permission-sensitive actions** (taking money, giving items) still need `TriggerServerEvent` and full server-side validation. The client UI is just a fancy way to fire the event - never trust that the click actually came from a legitimate context.

---

## Cleanup

On resource stop, remove your targets so they don't ghost:

```lua
AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    exports.ox_target:removeModel(`prop_atm_01`, 'use_atm')      -- remove specific model option
    exports.ox_target:removeZone(myZoneId)                       -- remove zone
end)
```

Without this, restarting the resource leaves duplicate options floating around until the player rejoins.

---

## TL;DR

- `dependency 'ox_target'`. Use `exports.ox_target:*` - no shared_script.
- `addLocalEntity`, `addModel`, `addGlobalVehicle`, `addBoxZone`, `addSphereZone`
- `canInteract`, `groups`, `items`, `distance`, `bones` for filtering
- Always cleanup on `onResourceStop`
- Client side only - server still validates the action

---

## Sources

- [ox_target docs](https://coxdocs.dev/ox_target)
- [ox_target GitHub](https://github.com/communityox/ox_target)
- [Vehicle bone names](https://docs.fivem.net/docs/game-references/bones/) - full list

---

Next: [`03-inventories.md`](03-inventories.md)
