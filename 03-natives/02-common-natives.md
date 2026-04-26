# 02. Common Natives

## Plain English

This is a cheat sheet of the natives you'll use 90% of the time. Don't memorize - bookmark and skim.

If a native isn't here, look it up: [docs.fivem.net/natives](https://docs.fivem.net/natives/).

---

## Player

```lua
-- ↓ on the LOCAL CLIENT
local pid = PlayerId()                             -- the local player's "client index" (a small number, NOT the server ID)
local ped = PlayerPedId()                          -- handle to the local player's character ped
local sid = GetPlayerServerId(pid)                 -- the server ID (what /admin sees, the one you target with TriggerClientEvent)

-- ↓ iterate ALL players in scope (client side)
local allIds = GetActivePlayers()                  -- returns local indexes that are nearby/in-scope (NOT all server-wide)
for _, pid in ipairs(allIds) do
    local name = GetPlayerName(pid)                -- their display name
    local ped = GetPlayerPed(pid)                  -- handle to their ped
end

-- ↓ on the SERVER
-- "src" comes from event source or you have it from elsewhere (e.g., a server ID)
local src = ...                                    -- a server ID like 1, 42, 127
local ped = GetPlayerPed(src)                      -- their ped (server-side handle)
local name = GetPlayerName(src)                    -- name string
local allIds = GetPlayers()                        -- ALL connected players, returns STRINGS like "1", "2"...
for _, pidStr in ipairs(allIds) do
    local pid = tonumber(pidStr)                   -- always tonumber() the strings
end
```

**Server IDs vs client indexes** is a confusing point. On the **client**, `PlayerId()` gives you a local 0-based index for use with native functions. On the **server**, you work with server IDs like `1`, `42`. Never mix the two.

---

## Entity Basics

```lua
local coords = GetEntityCoords(entity)             -- returns vector3
local heading = GetEntityHeading(entity)           -- yaw in degrees, 0-360
local model = GetEntityModel(entity)               -- model hash (number)
local alive = not IsEntityDead(entity)             -- inverted because there's no IsEntityAlive
local exists = DoesEntityExist(entity)             -- entity still in the game world?

SetEntityCoords(entity, x, y, z, false, false, false, true)  -- teleport. flags: x/y/z axis booleans, then "clearArea"
SetEntityHeading(entity, 90.0)                     -- face east
SetEntityInvincible(entity, true)                  -- godmode
FreezeEntityPosition(entity, true)                 -- can't be moved by physics or ai
DeleteEntity(entity)                               -- remove from world (only works on owned entities)
```

---

## Ped (Character)

```lua
-- ↓ state checks (booleans)
IsPedInAnyVehicle(ped, false)                      -- second arg "considerEnteringAsInVehicle"
IsPedDeadOrDying(ped, true)                        -- second arg = consider "dying" state too
IsPedRunning(ped)
IsPedShooting(ped)
IsPedSwimming(ped)
IsPedFalling(ped)
IsPedRagdoll(ped)
IsPedCuffed(ped)

-- ↓ health / armor
local hp = GetEntityHealth(ped)                    -- 0-200 for players (100 base + 100 max armor stretches it)
SetEntityHealth(ped, 200)                          -- full HP
local armor = GetPedArmour(ped)                    -- 0-100
SetPedArmour(ped, 100)                             -- full armor

-- ↓ weapons
GiveWeaponToPed(ped, `WEAPON_PISTOL`, 50, false, true)  -- weapon, ammo, isHidden, equipNow
RemoveWeaponFromPed(ped, `WEAPON_PISTOL`)
RemoveAllPedWeapons(ped, true)                     -- second arg "removeAllAmmo"
local hash = GetSelectedPedWeapon(ped)             -- currently held weapon
```

---

## Vehicle

```lua
-- ↓ spawn
local model = `adder`
RequestModel(model)
while not HasModelLoaded(model) do Wait(0) end

-- CreateVehicle args: model, x, y, z, heading, isNetworked, netMissionEntity
local veh = CreateVehicle(model, x, y, z, heading, true, false)
SetModelAsNoLongerNeeded(model)                    -- always release after creating

-- ↓ attributes
SetVehicleEngineOn(veh, true, true, false)         -- on, instantly (no startup), no driver-required
SetVehicleDoorsLocked(veh, 2)                      -- 2 = locked. see SetVehicleDoorsLocked docs for full list
SetVehicleNumberPlateText(veh, 'LRN 1')            -- max 8 chars
SetVehicleCustomPrimaryColour(veh, 255, 0, 0)      -- RGB
SetVehicleFuelLevel(veh, 100.0)                    -- 0-100. needs LegacyFuel-like resource to actually drain.

-- ↓ queries
local model = GetEntityModel(veh)                  -- hash
local plate = GetVehicleNumberPlateText(veh)       -- string, sometimes with trailing spaces
local class = GetVehicleClass(veh)                 -- 0 compact, 1 sedan, 18 emergency, etc.
local speed = GetEntitySpeed(veh)                  -- meters/second

-- ↓ occupants
local driver = GetPedInVehicleSeat(veh, -1)        -- -1 = driver seat
local pass = GetPedInVehicleSeat(veh, 0)           -- 0 = front passenger

-- ↓ enter/exit
TaskEnterVehicle(ped, veh, 5000, -1, 2.0, 1, 0)    -- timeout, seat, speed, flag, p6
TaskLeaveVehicle(ped, veh, 0)                      -- 0 = normal exit
SetPedIntoVehicle(ped, veh, -1)                    -- INSTANT teleport into seat
```

---

## Coords / Math

```lua
local c = GetEntityCoords(ped)                     -- vector3
local d = #(c - targetCoords)                      -- distance using vector subtraction (FiveM Lua quirk: # on a vector = magnitude)
local d2 = Vdist(c.x, c.y, c.z, tx, ty, tz)        -- equivalent, takes 6 floats

-- ↓ "what's the ground height at x,y?"
local ok, z = GetGroundZFor_3dCoord(x, y, 1000.0, false)  -- raycast down from a high z
-- ok = true if ground was found, z = the ground's z coord
```

The `#(v1 - v2)` syntax is **FiveM Lua specific**. Pure Lua doesn't have vector types. FiveM adds `vector2`, `vector3`, `vector4`, and `quat` natively.

---

## Blips (Map Markers)

```lua
local blip = AddBlipForCoord(x, y, z)              -- create a blip at a point
SetBlipSprite(blip, 108)                           -- 108 = scuba mask, see sprite list link below
SetBlipColour(blip, 3)                             -- 3 = blue
SetBlipScale(blip, 0.8)                            -- size multiplier, 1.0 default
SetBlipAsShortRange(blip, true)                    -- only visible when zoomed in

-- ↓ name on the map (3-step "begin/component/end" pattern is common in GTA HUD natives)
BeginTextCommandSetBlipName('STRING')
AddTextComponentString('My Blip')
EndTextCommandSetBlipName(blip)

RemoveBlip(blip)                                   -- delete it
```

Blip sprite list: [docs.fivem.net/docs/game-references/blips](https://docs.fivem.net/docs/game-references/blips/)

---

## Markers (3D World Cylinders, Arrows, etc.)

```lua
-- ↓ MUST be drawn every frame in a Wait(0) loop, otherwise it doesn't appear
DrawMarker(
    1,                                              -- marker type. 1 = vertical cylinder
    x, y, z - 0.98,                                 -- position (offset z by ~1m to stick to ground)
    0.0, 0.0, 0.0,                                  -- direction (rarely used for type 1)
    0.0, 0.0, 0.0,                                  -- rotation
    2.0, 2.0, 1.0,                                  -- scale x, y, z
    0, 255, 0, 100,                                 -- RGBA color (green, semi-transparent)
    false,                                          -- bobUpAndDown
    true,                                           -- faceCamera
    2,                                              -- p19 (always 2)
    false,                                          -- rotate
    nil, nil,                                       -- textureDict, textureName (for type 9)
    false                                           -- drawOnEntities
)
```

Drawing markers is **expensive at 60 fps**. Prefer `lib.zones` or `lib.points` (covered in [`06-ox-libraries/01-ox-lib.md`](../06-ox-libraries/01-ox-lib.md)) - they batch the work.

---

## Text

### 2D HUD Text

```lua
SetTextFont(4)                                      -- 4 = Chalet Comprimé
SetTextScale(0.5, 0.5)
SetTextColour(255, 255, 255, 255)                   -- white, full alpha
SetTextOutline()                                    -- adds black outline for readability
BeginTextCommandDisplayText('STRING')               -- start the text command
AddTextComponentString('Hello')                     -- the actual content
EndTextCommandDisplayText(0.5, 0.5)                 -- screen position (0-1 range, 0.5 = center)
```

### 3D World Text

```lua
local onScreen, sx, sy = World3dToScreen2d(x, y, z) -- project a world point to screen coords
if onScreen then
    SetTextFont(4)
    SetTextScale(0.35, 0.35)
    SetTextOutline()
    BeginTextCommandDisplayText('STRING')
    AddTextComponentString('World text')
    EndTextCommandDisplayText(sx, sy)
end
```

---

## Input (Keys)

```lua
-- ↓ in a per-frame loop (Wait(0))
if IsControlJustPressed(0, 38) then openMenu() end  -- 38 = E key (input "INPUT_PICKUP")
if IsControlPressed(0, 21) then sprint() end        -- 21 = LSHIFT (held)
DisableControlAction(0, 38, true)                   -- disable a control this frame
```

Common control IDs:
- 38 - E
- 47 - G
- 74 - H
- 23 - F
- 29 - B
- 21 - Left Shift
- 36 - Left Ctrl
- 22 - Space

Full list: [docs.fivem.net/docs/game-references/controls](https://docs.fivem.net/docs/game-references/controls/)

---

## Vanilla GTA Notifications (Ugly - Use ox_lib Instead)

```lua
SetNotificationTextEntry('STRING')
AddTextComponentString('Hello')
DrawNotification(false, true)
```

Functional but ancient styling. Modern code uses `lib.notify` from ox_lib.

---

## Streaming (Anims, Models)

```lua
-- ↓ load an anim dict (animation library)
RequestAnimDict('amb@world_human_smoking@male@male_a@base')
while not HasAnimDictLoaded('amb@world_human_smoking@male@male_a@base') do
    Wait(0)
end

-- ↓ play an anim from the loaded dict
TaskPlayAnim(
    ped,
    'amb@world_human_smoking@male@male_a@base',     -- dict name
    'base',                                          -- anim name within the dict
    8.0, -8.0,                                       -- blend in/out speeds
    -1,                                              -- duration (-1 = loop forever)
    49,                                              -- flags. 49 = "play upper body, allow movement"
    0, false, false, false                           -- playback rate, lock x, lock y, lock z
)
```

---

## Screen Effects

```lua
-- ↓ fade to black, do something, fade back in
DoScreenFadeOut(500)                                -- 500ms fade
Wait(500)                                            -- wait for the fade
-- now teleport, swap models, whatever
DoScreenFadeIn(500)

-- ↓ post-process effects
StartScreenEffect('DrugsDrivingIn', 0, true)         -- start the named effect
StopScreenEffect('DrugsDrivingIn')                   -- stop it
```

---

## Time / Weather

```lua
NetworkOverrideClockTime(12, 0, 0)                  -- set time (hour, min, sec). LOCAL only unless synced.
SetWeatherTypeNowPersist('EXTRASUNNY')              -- weather type
```

Usually you let `qbx_weathersync` or similar handle this server-wide. Don't call raw on every client unless you own the time/weather system.

---

## Server-Only Natives

```lua
DropPlayer(src, 'reason')                           -- kick. "reason" shows in disconnect screen.
GetPlayerName(src)                                  -- display name
GetPlayerPing(src)                                  -- ms
GetPlayerIdentifierByType(src, 'license')           -- license, steam, discord, fivem, ip, xbl, live
GetPlayerIdentifierByType(src, 'steam')
GetPlayerIdentifierByType(src, 'discord')
ExecuteCommand('kick 1 reason')                     -- run a server command from code
```

---

## Snippet - Teleport The Player

```lua
SetEntityCoords(PlayerPedId(), x, y, z, false, false, false, true)
```

---

## Snippet - Find The Nearest Vehicle (Client)

```lua
local ped = PlayerPedId()
local pos = GetEntityCoords(ped)
local vehicles = GetGamePool('CVehicle')             -- EXPENSIVE: iterates every vehicle the engine tracks
local closest, dist = nil, 999.0
for _, v in ipairs(vehicles) do
    local d = #(GetEntityCoords(v) - pos)
    if d < dist then
        dist = d
        closest = v
    end
end
```

`GetGamePool('CVehicle')` is **slow**. Don't run it every frame. For peds and players, prefer `lib.getNearbyPlayers` / `lib.getNearbyPeds` from ox_lib.

---

## Snippet - Force Sprint Speed

```lua
SetRunSprintMultiplierForPlayer(PlayerId(), 1.49)   -- 1.0 = default. 1.49 ≈ max safe value before anti-cheats flag
```

---

## Snippet - Make Player Semi-Transparent

```lua
SetEntityAlpha(PlayerPedId(), 100, false)            -- 0-255. 100 = pretty transparent.
ResetEntityAlpha(PlayerPedId())                      -- restore
```

---

## TL;DR

- This is a reference page - bookmark, skim, don't memorize.
- Use `fivem_doc_lookup` (MCP) or VS Code autocomplete for signatures.
- Always release streamed assets (`SetModelAsNoLongerNeeded`).
- Markers and text in `Wait(0)` loops are expensive - prefer `lib.zones` / `lib.points`.

---

## Sources

- [Native database (searchable)](https://docs.fivem.net/natives/) - the truth
- [Game references (controls, blips, peds)](https://docs.fivem.net/docs/game-references/) - sprite IDs, control IDs
- [Vehicle Models](https://docs.fivem.net/docs/game-references/vehicle-models/)
- [Weapon Models](https://docs.fivem.net/docs/game-references/weapon-models/)
- [Ped Models](https://docs.fivem.net/docs/game-references/ped-models/)

---

Next folder: [`04-database/`](../04-database/) - start with [`01-oxmysql-basics.md`](../04-database/01-oxmysql-basics.md)
