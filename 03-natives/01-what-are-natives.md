# 01. What Are Natives

## Plain English

A **native** is a function from GTA V's game engine that FiveM exposes to your scripts. Functions like `SpawnVehicle`, `GetEntityCoords`, `SetPedArmor`, `DrawText` - Rockstar wrote thousands of them, FiveM lets you call them from Lua.

If you're going to make anything visible in the game world (cars, peds, animations, UI overlays), you'll be calling natives constantly.

---

## Quick Example

```lua
local ped = PlayerPedId()                                          -- get the local player's ped (their character handle)
local coords = GetEntityCoords(ped)                                -- get that ped's current world position as a vector3
SetEntityCoords(ped, coords.x + 10, coords.y, coords.z, false, false, false, true)
-- ↑ teleport the ped 10 meters east. The 4 booleans are flags (xAxis, yAxis, zAxis, clearArea).
```

Three native calls. Read the player's ped → read its position → move it 10m on the X axis.

---

## Naming Convention

Natives use **PascalCase** (capital letter for each word):

```lua
GetEntityCoords()      -- right
get_entity_coords()    -- WRONG, doesn't exist
```

Burn it in. Common prefixes:

- `Get*` - read state (`GetEntityCoords`, `GetPlayerName`)
- `Set*` - change state (`SetEntityCoords`, `SetPedArmour`)
- `Is*` - boolean check (`IsPedDeadOrDying`, `IsControlPressed`)
- `Has*` - has-it-loaded check (`HasModelLoaded`)
- `Create*` / `Spawn*` - make a new entity (`CreateVehicle`, `CreatePed`)
- `Delete*` / `Remove*` - destroy it (`DeleteEntity`, `RemoveBlip`)
- `Request*` - start streaming an asset (`RequestModel`, `RequestAnimDict`)
- `Draw*` - render to screen this frame (`DrawText`, `DrawMarker`)

---

## Client vs Server Natives

Some natives only work on one side. The official docs tell you per-native.

| Native | Side | What it does |
|--------|------|--------------|
| `GetEntityCoords` | Both | Server reads synced position from owning client |
| `SetEntityCoords` | Client only | Server can ask via `SetEntityCoordsFromNetworkId` |
| `DropPlayer` | Server only | Kick a player |
| `RequestModel` | Client only | Streams a model into memory |
| `CreateVehicle` | Both | Server can spawn server-owned entities |

Calling a native on the wrong side errors silently or no-ops. **Always verify per-native** with the docs.

---

## Finding Natives

Two ways:

1. **The official native database** → [docs.fivem.net/natives](https://docs.fivem.net/natives/) - searchable, filterable by side, has full signatures
2. **VS Code with the cfxlua extension** - autocomplete + signature help right in your editor → [overextended.cfxlua-vscode](https://marketplace.visualstudio.com/items?itemName=overextended.cfxlua-vscode)

Always check argument order before writing - many natives have 5+ arguments and the order matters.

---

## Argument Types

Lua types map to FiveM native types like this:

- `number` - int, float, **and entity handles** (Ped, Vehicle, Object, Player). Handles are just numbers.
- `string` - char* in the native signature
- `boolean` - BOOL
- `vector3(x, y, z)` - sometimes natives take a vector3, sometimes 3 separate floats. Check signature.

Entity handles are simple integers like `1`, `42`, `512`. They're just **references** the engine uses to identify the actual entity - the data isn't in the number, the engine looks it up.

---

## Hash vs String - Models, Anim Dicts, Weapons

Some natives want a **hash** (a number derived from a string). FiveM gives you three ways to produce one:

```lua
-- 1) classic GTA function
local hash = GetHashKey('adder')

-- 2) FiveM-specific, requires lua54 'yes' in fxmanifest. cleanest.
local hash = `adder`

-- 3) the joaat function (joaat = Jenkins-One-At-A-Time, the algorithm)
local hash = joaat('adder')
```

**Backticks `` `adder` `` only work with `lua54 'yes'`** in your fxmanifest. They're computed at file-load time, so they're free at runtime. Use them.

When the native signature says `Hash modelHash`, pass a hash. When it says `char* modelName`, pass a string.

---

## The Request / Has / Use Pattern

Models, anims, particle effects, audio banks - all stream into memory on demand. The pattern is always:

```lua
local model = `adder`                                              -- compute hash at load time

RequestModel(model)                                                -- ask the engine to start loading

while not HasModelLoaded(model) do                                 -- spin until it's actually loaded
    Wait(0)                                                        -- yield each frame so the game can keep loading
end

local veh = CreateVehicle(model, 0.0, 0.0, 72.0, 0.0, true, false) -- now it's safe to use

SetModelAsNoLongerNeeded(model)                                    -- release the streaming slot
```

Same pattern for:
- **Anims** → `RequestAnimDict` / `HasAnimDictLoaded`
- **Particles** → `RequestNamedPtfxAsset` / `HasNamedPtfxAssetLoaded`
- **Audio** → `RequestScriptAudioBank`
- **Texture dictionaries** → `RequestStreamedTextureDict` / `HasStreamedTextureDictLoaded`

**Forget `Wait(0)` in the spin loop = client crash** (busy-loop with no yield).
**Forget `SetModelAsNoLongerNeeded` = memory leak**, future requests fail.

---

## Entity Cleanup

If you spawn it, you own it. Clean up when done OR on resource stop:

```lua
local mySpawnedVeh                                                 -- store the handle somewhere

AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    if mySpawnedVeh and DoesEntityExist(mySpawnedVeh) then         -- check it still exists (player could've crashed it into a wall)
        DeleteEntity(mySpawnedVeh)                                  -- remove it
    end
end)
```

Forgetting this leaves "ghost" entities littering the world after your resource is restarted. Bad UX, bad performance, hard to debug.

---

## Common Gotchas

### 1. Vector3 vs separate floats

```lua
local c = GetEntityCoords(ped)                                     -- returns a vector3
SetEntityCoords(ped, c.x, c.y, c.z, false, false, false, true)     -- wants x, y, z as separate args
```

Read the signature. Some take vector3, some take 3 floats.

### 2. `GetEntityCoords` returns 0,0,0 during loading

Player's ped isn't fully loaded yet. Defend:

```lua
local c = GetEntityCoords(ped)
if c.x == 0 and c.y == 0 then return end                           -- not loaded, bail
```

### 3. Wrong side

```lua
SetPedArmour(ped, 100)         -- on the SERVER = does nothing. armor is client-set.
```

Always verify the side in docs.

### 4. Hash mismatch

```lua
RequestModel('adder')                  -- WRONG: passes the string, native wants a hash
RequestModel(`adder`)                  -- right: backtick gives the hash
RequestModel(GetHashKey('adder'))      -- right: explicit hash conversion
```

### 5. Missing return-value check

```lua
local veh = CreateVehicle(...)
if veh == 0 or not DoesEntityExist(veh) then return end            -- creation can fail; always check
```

---

## Native Categories

The native database groups them by category. Here's what you'll touch most often:

| Category | Examples |
|----------|----------|
| **PLAYER** | `PlayerId`, `PlayerPedId`, `GetPlayerName`, `GetPlayers` |
| **PED** | `CreatePed`, `SetPedComponentVariation`, `IsPedDeadOrDying` |
| **VEHICLE** | `CreateVehicle`, `SetVehicleEngineOn`, `GetVehicleNumberPlateText` |
| **ENTITY** | `GetEntityCoords`, `SetEntityHeading`, `DeleteEntity`, `DoesEntityExist` |
| **WEAPON** | `GiveWeaponToPed`, `SetCurrentPedWeapon`, `GetSelectedPedWeapon` |
| **STREAMING** | `RequestModel`, `HasModelLoaded`, `SetModelAsNoLongerNeeded` |
| **GRAPHICS / UI** | `SetTextFont`, `DrawText`, `DrawMarker` |
| **CAM** | `CreateCamera`, `SetCamActive`, `RenderScriptCams` |
| **CONTROL** | `IsControlPressed`, `IsControlJustPressed`, `DisableControlAction` |
| **HUD** | `SetNotificationTextEntry`, `BeginTextCommandPrint` |

---

## Learning Strategy

**Don't memorize.** There are too many natives. Instead:

1. Search the docs when you need one
2. Read existing resources for patterns
3. Use VS Code autocomplete to discover signatures

A grep across your server is gold:

```bash
grep -r "CreateVehicle" resources/
grep -r "GiveWeaponToPed" resources/
```

Find a working pattern, adapt to your case.

---

## TL;DR

- Natives = GTA V's API exposed via FiveM. PascalCase names.
- Some natives are client-only, server-only, or both - check docs.
- **Request → Has → Use** pattern for streamed assets. Always release with `SetModelAsNoLongerNeeded`.
- Use `` `backticks` `` for model/anim hashes (with `lua54 'yes'`).
- Always cleanup created entities on resource stop.

---

## Sources

- [Native Reference (searchable)](https://docs.fivem.net/natives/) - official database
- [Scripting Reference Overview](https://docs.fivem.net/docs/scripting-reference/)
- [Streaming docs (assets)](https://docs.fivem.net/docs/scripting-manual/working-with-data-files/)
- [VS Code cfxlua extension](https://marketplace.visualstudio.com/items?itemName=overextended.cfxlua-vscode) - autocomplete

---

Next: [`02-common-natives.md`](02-common-natives.md)
