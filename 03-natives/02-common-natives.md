# 02. Common Natives

Cheat sheet. Natives you use 90% of the time. Bookmark.

## Player

```lua
-- local client
local pid = PlayerId()                       -- local index
local ped = PlayerPedId()                    -- your ped handle
local sid = GetPlayerServerId(pid)           -- server ID (the /admin one)

-- other players (client)
local allIds = GetActivePlayers()            -- indexes in scope
for _, pid in ipairs(allIds) do
    local name = GetPlayerName(pid)
    local ped = GetPlayerPed(pid)
end

-- server
local pid = ...                              -- server ID from GetPlayers()
local ped = GetPlayerPed(pid)
local name = GetPlayerName(pid)
local allIds = GetPlayers()                  -- strings, tonumber() them
```

**Server IDs vs local indexes.** `GetPlayers()` server = strings `"1"`, `"2"`. Always `tonumber()`.

## Entity Basics

```lua
local coords = GetEntityCoords(entity)       -- vector3
local heading = GetEntityHeading(entity)     -- 0-360
local model = GetEntityModel(entity)         -- hash
local alive = not IsEntityDead(entity)
local exists = DoesEntityExist(entity)

SetEntityCoords(entity, x, y, z, false, false, false, true)
SetEntityHeading(entity, 90.0)
SetEntityInvincible(entity, true)
FreezeEntityPosition(entity, true)
DeleteEntity(entity)
```

## Ped

```lua
-- state
IsPedInAnyVehicle(ped, false)
IsPedDeadOrDying(ped, true)
IsPedRunning(ped)
IsPedShooting(ped)
IsPedSwimming(ped)
IsPedFalling(ped)
IsPedRagdoll(ped)
IsPedCuffed(ped)

-- health / armor
local hp = GetEntityHealth(ped)              -- 0-200 for players
SetEntityHealth(ped, 200)
local armor = GetPedArmour(ped)
SetPedArmour(ped, 100)

-- weapons
GiveWeaponToPed(ped, `WEAPON_PISTOL`, 50, false, true)
RemoveWeaponFromPed(ped, `WEAPON_PISTOL`)
RemoveAllPedWeapons(ped, true)
local hash = GetSelectedPedWeapon(ped)
```

## Vehicle

```lua
-- spawn
local model = `adder`
RequestModel(model)
while not HasModelLoaded(model) do Wait(0) end

local veh = CreateVehicle(model, x, y, z, heading, true, false)
SetModelAsNoLongerNeeded(model)

-- attributes
SetVehicleEngineOn(veh, true, true, false)
SetVehicleDoorsLocked(veh, 2)                -- 2 = locked
SetVehicleNumberPlateText(veh, 'LRN 1')
SetVehicleCustomPrimaryColour(veh, 255, 0, 0)
SetVehicleFuelLevel(veh, 100.0)

-- queries
local model = GetEntityModel(veh)
local plate = GetVehicleNumberPlateText(veh)
local class = GetVehicleClass(veh)           -- 0 compact, 18 emergency, etc.
local speed = GetEntitySpeed(veh)            -- m/s

-- occupants
local driver = GetPedInVehicleSeat(veh, -1)  -- -1 = driver
local pass = GetPedInVehicleSeat(veh, 0)

-- enter / exit
TaskEnterVehicle(ped, veh, 5000, -1, 2.0, 1, 0)
TaskLeaveVehicle(ped, veh, 0)
SetPedIntoVehicle(ped, veh, -1)              -- instant
```

## Coords / Math

```lua
local c = GetEntityCoords(ped)
local d = #(c - targetCoords)                -- distance
local d2 = Vdist(c.x, c.y, c.z, tx, ty, tz)  -- same

-- ground z
local ok, z = GetGroundZFor_3dCoord(x, y, 1000.0, false)
```

## Blips

```lua
local blip = AddBlipForCoord(x, y, z)
SetBlipSprite(blip, 108)
SetBlipColour(blip, 3)
SetBlipScale(blip, 0.8)
SetBlipAsShortRange(blip, true)

BeginTextCommandSetBlipName('STRING')
AddTextComponentString('My Blip')
EndTextCommandSetBlipName(blip)

RemoveBlip(blip)
```

Sprite list: https://docs.fivem.net/docs/game-references/blips/

## Markers

```lua
-- every frame (Wait(0) loop)
DrawMarker(
    1,                     -- cylinder
    x, y, z - 0.98,
    0.0, 0.0, 0.0,
    0.0, 0.0, 0.0,
    2.0, 2.0, 1.0,
    0, 255, 0, 100,
    false, true, 2, false, nil, nil, false
)
```

Prefer `lib.zones` / `lib.points` from ox_lib. Batched. Cheaper.

## Text

```lua
-- 2D HUD
SetTextFont(4)
SetTextScale(0.5, 0.5)
SetTextColour(255, 255, 255, 255)
SetTextOutline()
BeginTextCommandDisplayText('STRING')
AddTextComponentString('Hello')
EndTextCommandDisplayText(0.5, 0.5)

-- 3D world
local onScreen, sx, sy = World3dToScreen2d(x, y, z)
if onScreen then
    SetTextFont(4)
    SetTextScale(0.35, 0.35)
    SetTextOutline()
    BeginTextCommandDisplayText('STRING')
    AddTextComponentString('World text')
    EndTextCommandDisplayText(sx, sy)
end
```

## Input

```lua
-- per frame
if IsControlJustPressed(0, 38) then openMenu() end   -- E
if IsControlPressed(0, 21) then sprint() end         -- SHIFT
DisableControlAction(0, 38, true)                    -- disable E
```

Common control IDs:
- 38 E, 47 G, 74 H, 23 F, 29 B
- 21 LSHIFT, 36 LCTRL, 22 SPACE

Full list: https://docs.fivem.net/docs/game-references/controls/

## Vanilla Notifications (ugly)

```lua
SetNotificationTextEntry('STRING')
AddTextComponentString('Hello')
DrawNotification(false, true)
```

Prefer `lib.notify` from ox_lib.

## Streaming (Anims)

```lua
RequestAnimDict('amb@world_human_smoking@male@male_a@base')
while not HasAnimDictLoaded('amb@world_human_smoking@male@male_a@base') do
    Wait(0)
end

TaskPlayAnim(ped, 'amb@world_human_smoking@male@male_a@base', 'base', 8.0, -8.0, -1, 49, 0, false, false, false)
```

## Screen Effects

```lua
DoScreenFadeOut(500)
Wait(500)
-- teleport here
DoScreenFadeIn(500)

StartScreenEffect('DrugsDrivingIn', 0, true)
StopScreenEffect('DrugsDrivingIn')
```

## Time / Weather

```lua
NetworkOverrideClockTime(12, 0, 0)
SetWeatherTypeNowPersist('EXTRASUNNY')
```

Usually gated via `qbx_weathersync` or similar. Don't call raw unless owning it.

## Server-Only

```lua
DropPlayer(src, 'reason')
GetPlayerName(src)
GetPlayerPing(src)
GetPlayerIdentifierByType(src, 'license')
GetPlayerIdentifierByType(src, 'steam')
GetPlayerIdentifierByType(src, 'discord')
ExecuteCommand('kick 1 reason')
```

## Snippets

### Teleport
```lua
SetEntityCoords(PlayerPedId(), x, y, z, false, false, false, true)
```

### Nearest vehicle
```lua
local ped = PlayerPedId()
local pos = GetEntityCoords(ped)
local vehicles = GetGamePool('CVehicle')    -- expensive, rare use
local closest, dist = nil, 999.0
for _, v in ipairs(vehicles) do
    local d = #(GetEntityCoords(v) - pos)
    if d < dist then dist = d; closest = v end
end
```

Prefer `lib.getNearbyPlayers` / `lib.getNearbyPeds` for players/peds.

### Force sprint
```lua
SetRunSprintMultiplierForPlayer(PlayerId(), 1.49)
```

### Tint player
```lua
SetEntityAlpha(PlayerPedId(), 100, false)
ResetEntityAlpha(PlayerPedId())
```

## TL;DR

Reference page. Don't memorize. Use `fivem_doc_lookup` for signatures.

## Sources

- Native DB (searchable): https://docs.fivem.net/natives/
- Community docs: https://runtime.fivem.net/doc/natives.lua

Next folder: `04-database/`
