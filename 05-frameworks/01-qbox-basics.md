# 01. Qbox Basics

**Qbox** (`qbx_core`) = modern fork of QBCore. Most active framework in the scene right now. Player objects, jobs, gangs, money, vehicles, metadata. Framework = the glue between your resource and "player state".

If your server runs legacy QBCore, exports differ slightly but concepts are identical. QBCore uses `QBCore.Functions.GetPlayer(src)`, Qbox uses `exports.qbx_core:GetPlayer(src)`.

## Get Player Server Side

```lua
local player = exports.qbx_core:GetPlayer(src)
if not player then return end

print(player.PlayerData.citizenid)           -- unique ID
print(player.PlayerData.license)             -- license identifier
print(player.PlayerData.name)                -- char name
print(player.PlayerData.charinfo.firstname)
print(player.PlayerData.charinfo.lastname)
print(player.PlayerData.money.cash)
print(player.PlayerData.money.bank)
print(player.PlayerData.job.name)            -- 'police', 'unemployed', etc.
print(player.PlayerData.job.grade.level)     -- 0, 1, 2...
print(player.PlayerData.job.isboss)          -- boolean
print(player.PlayerData.gang.name)
print(player.PlayerData.metadata.hunger)     -- custom stats
```

## Money Functions

```lua
local player = exports.qbx_core:GetPlayer(src)

-- add
player.Functions.AddMoney('cash', 100, 'reason string')
player.Functions.AddMoney('bank', 500, 'salary')

-- remove. Returns true if had enough, false if not.
local ok = player.Functions.RemoveMoney('cash', 80, 'buy_gun')
if not ok then return end

-- get
local cash = player.PlayerData.money.cash
-- or
local cash = player.Functions.GetMoney('cash')

-- set (rare, use add/remove normally)
player.Functions.SetMoney('cash', 1000, 'admin set')
```

Money functions are atomic. Internal lock prevents dupes.

**Reason string** = for logs. Write something meaningful: `'shop_buy_gun'`, `'police_salary'`, `'admin_give'`.

## Job Functions

```lua
-- set job
player.Functions.SetJob('police', 2)          -- name, grade level

-- set duty (police on/off)
player.Functions.SetJobDuty(true)

-- reading already shown above via PlayerData
```

## Client Side: Get Player Data

```lua
local QBX = exports.qbx_core
local pdata = QBX:GetPlayerData()

print(pdata.citizenid)
print(pdata.money.cash)
print(pdata.job.name)
```

Client gets a synced copy. Updated automatically when server changes it.

## Client Events: Data Updates

```lua
RegisterNetEvent('QBCore:Client:OnJobUpdate', function(job)
    print('job changed to:', job.name)
end)

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
    print('player loaded')
end)

RegisterNetEvent('QBCore:Client:OnMoneyChange', function(type, amount, isRemoved)
    print(type, amount, isRemoved)
end)
```

Qbox keeps QB event names for compat. Still fire.

Newer Qbox events:
```lua
RegisterNetEvent('qbx_core:client:playerLoaded', function(data) end)
RegisterNetEvent('qbx_core:client:playerLoggedOut', function() end)
```

Use newer when available.

## Server Events

```lua
AddEventHandler('QBCore:Server:OnPlayerLoaded', function(player)
    -- fired when player logs in and their character loads
end)

AddEventHandler('QBCore:Server:OnPlayerUnload', function(src)
    -- fired when they log out
end)
```

## Job Checks

```lua
-- server
local player = exports.qbx_core:GetPlayer(src)
if player.PlayerData.job.name ~= 'police' then return end
if player.PlayerData.job.grade.level < 2 then return end

-- client
local pdata = exports.qbx_core:GetPlayerData()
local isCop = pdata.job.name == 'police'
```

## Metadata (Custom State)

Metadata = per-player custom storage. Stats like hunger, thirst, stress.

```lua
-- read
local hunger = player.PlayerData.metadata.hunger or 100

-- write
player.Functions.SetMetaData('hunger', 80)

-- client read
local pdata = QBX:GetPlayerData()
print(pdata.metadata.hunger)
```

Saved to DB. Persists.

## Identifiers

Players have multiple identifiers. License = stable, used for accounts.

```lua
-- server
local license = GetPlayerIdentifierByType(src, 'license')
local steam = GetPlayerIdentifierByType(src, 'steam')
local discord = GetPlayerIdentifierByType(src, 'discord')
local fivem = GetPlayerIdentifierByType(src, 'fivem')
local ip = GetPlayerEndpoint(src)
```

Citizenid = generated on character creation. Use for in-game things.
License = use for player-level (all their characters).

## Get All Online Players

```lua
-- server
local players = exports.qbx_core:GetQBPlayers()    -- table keyed by src
for src, player in pairs(players) do
    print(src, player.PlayerData.citizenid)
end

-- or via FiveM
for _, pid in ipairs(GetPlayers()) do
    local p = exports.qbx_core:GetPlayer(tonumber(pid))
    if p then ... end
end
```

## Get Offline Player

```lua
local p = exports.qbx_core:GetOfflinePlayer(citizenid)
```

Useful for admin tools. Not automatic, does DB read.

## Notifications

QB had `QBCore.Functions.Notify(src, msg, type)`. Prefer ox_lib if installed:

```lua
-- server -> client
TriggerClientEvent('ox_lib:notify', src, {
    title = 'Shop',
    description = 'You bought bread',
    type = 'success',
})

-- client directly
lib.notify({ title='Hi', description='Msg', type='inform' })
```

Types: `success`, `error`, `inform`, `warning`.

## Commands With Permission

```lua
-- server
exports.qbx_core:CreateCommand('adminpanel', 'Open admin panel', {}, false, function(source, args)
    -- command logic
end, 'admin')    -- last arg = required permission group
```

Or use `RegisterCommand` with ACE:
```lua
RegisterCommand('adminpanel', function(source, args)
    -- ...
end, true)    -- true = restricted, must have command.adminpanel ACE

-- in server.cfg:
-- add_ace group.admin command.adminpanel allow
```

## Items (via Inventory)

Qbox doesn't store items. Your inventory resource does (ox_inventory, qb-inventory, tgiann-inventory, etc).

```lua
-- ox_inventory example
exports.ox_inventory:AddItem(src, 'bread', 5)
```

Exports vary per inventory. Check your inventory's README.

More: `06-ox-libraries/03-inventories.md`.

## QB Bridge

Some resources use old QBCore API. Qbox ships with a QB bridge so `QBCore = exports['qb-core']:GetCoreObject()` can still work. Prefer native Qbox exports for new code.

## Common Mistakes

### 1. Mutating PlayerData directly
```lua
-- BAD
player.PlayerData.money.cash = 500   -- NOT persisted
-- GOOD
player.Functions.SetMoney('cash', 500, 'reason')
```

### 2. Forgetting `if not player then return end`
Player can be nil if just connecting or disconnecting.

### 3. Using client PlayerData for decisions that matter
Client PlayerData = view of state. Can be edited. Use server PlayerData for security checks.

## TL;DR

- `exports.qbx_core:GetPlayer(src)` server
- `exports.qbx_core:GetPlayerData()` client
- Money: `AddMoney`, `RemoveMoney`, `.money.cash/.bank`
- Job: `.job.name`, `.job.grade.level`, `SetJob`
- Metadata: `.metadata.x`, `SetMetaData`
- citizenid = in-game ID, license = player-level
- `ox_lib:notify` over QB notify

## Sources

- Qbox docs: https://docs.qbox.re/
- qbx_core GitHub: https://github.com/Qbox-project/qbx_core
- QBCore (legacy, similar API): https://docs.qbcore.org/

Next folder: `06-ox-libraries/`
