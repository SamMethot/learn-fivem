# 03. QBCore Basics

## Plain English

A **framework** in FiveM is the resource that owns "what is a player". It defines the player object, jobs, gangs, money, inventory hooks, character creation, and the events that fire on login/logout.

Think of it as the server's operating layer for gameplay logic: your scripts plug into the framework instead of reinventing player/account/job systems every time.

**QBCore (`qb-core`)** is one of the most used RP frameworks and the base that inspired Qbox.

### What Makes QBCore Different

- Huge ecosystem: many public scripts are written for QBCore first.
- Familiar `QBCore.Functions` API and `PlayerData` shape used by years of tutorials/resources.
- Compared to Qbox, QBCore is older and less "bridge-first" modernized, but still very common in production servers.

### Who Made It

QBCore is built and maintained by the **QBCore Framework** community/team.

- QBCore docs: [https://docs.qbcore.org/](https://docs.qbcore.org/)
- QBCore GitHub org: [https://github.com/qbcore-framework](https://github.com/qbcore-framework)


This lesson assumes you have the latest version of QBCore.

---

## Get Core Object And Player (Server Side)

```lua
-- ↓ get core object once in server scope
local QBCore = exports['qb-core']:GetCoreObject()

-- ↓ later in an event/command with source
local src = source
local player = QBCore.Functions.GetPlayer(src)

-- ↓ ALWAYS nil-check for join/disconnect race windows
if not player then return end

-- ↓ read common data from PlayerData
print(player.PlayerData.citizenid)
print(player.PlayerData.license)
print(player.PlayerData.name)
print(player.PlayerData.money.cash)
print(player.PlayerData.money.bank)
print(player.PlayerData.job.name)
print(player.PlayerData.job.grade.level)
print(player.PlayerData.metadata.hunger)
```

---

## Money Functions

```lua
local player = QBCore.Functions.GetPlayer(source)
if not player then return end

-- ↓ add money to account
player.Functions.AddMoney('cash', 100, 'shop_refund')
player.Functions.AddMoney('bank', 500, 'salary')

-- ↓ remove money. returns boolean in typical QBCore setups
local ok = player.Functions.RemoveMoney('cash', 80, 'shop_buy_bread')
if not ok then
    return
end

-- ↓ read balances
local cash = player.PlayerData.money.cash
local bank = player.Functions.GetMoney('bank')

-- ↓ set balance directly (admin/migration use)
player.Functions.SetMoney('cash', 1000, 'admin_set')
```

Always check return values and validate price/amount on the server.

---

## Job Functions

```lua
local player = QBCore.Functions.GetPlayer(source)
if not player then return end

-- ↓ assign job and grade level
player.Functions.SetJob('police', 2)

-- ↓ toggle duty state
player.Functions.SetJobDuty(true)

-- ↓ read job data
local job = player.PlayerData.job
if job.name == 'police' and job.grade.level >= 2 then
    -- permitted for police grade 2+
end
```

---

## Client Player Data (Display Only)

```lua
-- ↓ on client
local QBCore = exports['qb-core']:GetCoreObject()
local pdata = QBCore.Functions.GetPlayerData()

print(pdata.citizenid)
print(pdata.job and pdata.job.name)
```

Client data is for UI/UX. Server checks are the real security boundary.

---

## Common Client Events

```lua
RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
    print('character loaded')
end)

RegisterNetEvent('QBCore:Client:OnJobUpdate', function(job)
    print('job updated:', job.name)
end)

RegisterNetEvent('QBCore:Client:OnMoneyChange', function(type, amount, isRemoved)
    print(type, amount, isRemoved)
end)
```

---

## Server Lifecycle Events

```lua
AddEventHandler('QBCore:Server:OnPlayerLoaded', function(player)
    -- initialize player-specific cache/state
end)

AddEventHandler('QBCore:Server:OnPlayerUnload', function(src)
    -- cleanup player-specific cache/state
end)
```

---

## Permission Checks

```lua
local player = QBCore.Functions.GetPlayer(source)
if not player then return end

if player.PlayerData.job.name ~= 'police' then return end
if player.PlayerData.job.grade.level < 2 then return end
```

Do this server-side in the handler that mutates data.

---

## Loop Online Players

```lua
local QBCore = exports['qb-core']:GetCoreObject()

-- ↓ helper table of online players
local players = QBCore.Functions.GetQBPlayers()
for src, player in pairs(players) do
    print(src, player.PlayerData.citizenid)
end

-- ↓ universal fallback
for _, pidStr in ipairs(GetPlayers()) do
    local p = QBCore.Functions.GetPlayer(tonumber(pidStr))
    if p then
        print(p.PlayerData.citizenid)
    end
end
```

---

## Notifications

```lua
-- ↓ framework-style notify event
TriggerClientEvent('QBCore:Notify', source, 'Purchase complete', 'success')

-- ↓ modern alternative if ox_lib is installed
TriggerClientEvent('ox_lib:notify', source, {
    title = 'Shop',
    description = 'You bought bread',
    type = 'success',
})
```

---

## Common Mistakes

### 1. Mutating PlayerData directly

```lua
-- BAD: does not reliably persist/sync
player.PlayerData.money.cash = 999999

-- GOOD: use framework functions
player.Functions.SetMoney('cash', 500, 'admin_fix')
```

### 2. Skipping nil checks

```lua
local player = QBCore.Functions.GetPlayer(source)
if not player then return end
```

### 3. Trusting client values

Never trust client-sent price, quantity, job grade, or item count.

---

## TL;DR

- Get core with `exports['qb-core']:GetCoreObject()`.
- Resolve players with `QBCore.Functions.GetPlayer(src)`.
- Use `player.Functions` for money/job mutations, not direct table edits.
- Client `GetPlayerData()` is display only.
- QBCore has the biggest legacy script ecosystem and docs footprint.

---

## Sources

- [QBCore Docs](https://docs.qbcore.org/)
- [qb-core repository](https://github.com/qbcore-framework/qb-core)
- [QBCore Framework org](https://github.com/qbcore-framework)
- [FiveM Scripting Docs](https://docs.fivem.net/docs/scripting-manual/)

---

Next: [`06-ox-libraries/01-ox-lib.md`](../06-ox-libraries/01-ox-lib.md)