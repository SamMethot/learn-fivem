# 01. What Are Natives

Natives = GTA V API exposed to you via FiveM. Functions like `SpawnVehicle`, `GetEntityCoords`, `SetPedArmor`. Thousands of them.

Rockstar wrote them for the game engine. FiveM lets you call them from Lua.

## Example

```lua
local ped = PlayerPedId()
local coords = GetEntityCoords(ped)
SetEntityCoords(ped, coords.x + 10, coords.y, coords.z, false, false, false, true)
```

Three native calls. Read ped, read position, teleport 10m on X.

## Naming

Natives use **PascalCase**: `GetEntityCoords`, not `get_entity_coords`. Burn it in.

Common prefixes:
- `Get*` = read state
- `Set*` = mutate state
- `Is*` = boolean check
- `Has*` = loaded/feature check
- `Create*` / `Spawn*` = make entity
- `Delete*` / `Remove*` = destroy

## Client vs Server Natives

Some exist on both sides, some client only, some server only. Docs say per-native.

- `GetEntityCoords` = both
- `SetEntityCoords` = client only (server asks owning client)
- `DropPlayer` = server only
- `RequestModel` = client only
- `CreateVehicle` = both, usually spawned client side

Native called on wrong side = error or no-op.

## Finding Natives

1. **FiveM docs**: https://docs.fivem.net/natives/
2. **`fivem_doc_lookup` MCP (if available)** = type native name, get signature + example

Always verify argument order. Many natives have 5+ args.

## Argument Types

Lua types map to native types:
- `number` = int, float, Entity, Ped, Vehicle, Player (handles are numbers)
- `string` = char*
- `boolean` = BOOL
- `vector3(x, y, z)` = Vector3 OR 3 separate floats

Entity handles = just numbers. `PlayerPedId()` returns something like `1`, `256`. That number is a handle to a ped in game memory.

## Hash vs String

Some natives want model names as hashes:

```lua
local hash = GetHashKey('adder')
-- or
local hash = `adder`    -- backtick = auto-hash, Lua 5.3+
```

Backticks only work with `lua54 'yes'` in manifest.

Use hash when signature says `Hash modelHash`. Use string when `char* modelName`.

## Request / Has / Use Pattern

Game assets stream. You request, wait, use.

```lua
local model = `adder`

RequestModel(model)
while not HasModelLoaded(model) do
    Wait(0)
end

local veh = CreateVehicle(model, 0.0, 0.0, 72.0, 0.0, true, false)
SetModelAsNoLongerNeeded(model)
```

Same pattern for:
- Anims: `RequestAnimDict` / `HasAnimDictLoaded`
- PTFX: `RequestNamedPtfxAsset`
- Audio: `RequestScriptAudioBank`
- Textures: `RequestStreamedTextureDict`

Forget `Wait(0)` = crash. Forget `SetModelAsNoLongerNeeded` = leak.

## Entity Cleanup

You create = you own. Cleanup on resource stop or when done:

```lua
AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    if DoesEntityExist(myVeh) then
        DeleteEntity(myVeh)
    end
end)
```

Ghost entities = littered world.

## Common Gotchas

### 1. Vector3 vs separate floats
```lua
local c = GetEntityCoords(ped)    -- returns vector3
SetEntityCoords(ped, c.x, c.y, c.z, false, false, false, true)  -- wants x,y,z
```

### 2. `GetEntityCoords` returns 0,0,0
Player spawning or loading. Check:
```lua
local c = GetEntityCoords(ped)
if c.x == 0 and c.y == 0 then return end
```

### 3. Wrong side
`SetPedArmour(ped, 100)` on server = does nothing. Call from client.

### 4. Hash mismatch
```lua
RequestModel('adder')              -- no auto-hash = fail
RequestModel(`adder`)              -- works
RequestModel(GetHashKey('adder'))  -- works
```

### 5. Missing return check
```lua
local veh = CreateVehicle(...)
if veh == 0 or not DoesEntityExist(veh) then return end
```

## Categories

| Category | Examples |
|----------|---------|
| PLAYER | `PlayerId`, `PlayerPedId`, `GetPlayerName`, `GetPlayers` |
| PED | `CreatePed`, `SetPedComponentVariation`, `IsPedDeadOrDying` |
| VEHICLE | `CreateVehicle`, `SetVehicleEngineOn`, `GetVehicleNumberPlateText` |
| ENTITY | `GetEntityCoords`, `SetEntityHeading`, `DeleteEntity`, `DoesEntityExist` |
| WEAPON | `GiveWeaponToPed`, `SetCurrentPedWeapon`, `GetSelectedPedWeapon` |
| STREAMING | `RequestModel`, `HasModelLoaded`, `SetModelAsNoLongerNeeded` |
| UI | `SetTextFont`, `DrawText`, `AddBlipForCoord` |
| CAM | `CreateCamera`, `SetCamActive`, `RenderScriptCams` |
| CONTROL | `IsControlPressed`, `DisableControlAction` |
| HUD | `SetNotificationTextEntry`, `DrawMarker` |

## Learning Strategy

Don't memorize. Search docs when needed. Look at existing resources on your server for patterns:

```
grep -r "CreateVehicle" resources/
grep -r "GiveWeaponToPed" resources/
```

Copy pattern, adapt.

## TL;DR

- Natives = GTA V API, PascalCase
- Docs + `fivem_doc_lookup`
- Client-only, server-only, or both
- Request/Has/Use pattern for streamed assets
- Cleanup entities
- Hash or backtick for models

## Sources

- Natives reference: https://docs.fivem.net/natives/
- Scripting reference overview: https://docs.fivem.net/docs/scripting-reference/
- Request/Has/Use pattern (streaming): https://docs.fivem.net/docs/game-references/

Next: `02-common-natives.md`
