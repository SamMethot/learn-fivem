# 01. Qbox Basics

## Plain English

A **framework** in FiveM is the resource that owns "what is a player". It defines the player object, jobs, gangs, money, inventory hooks, character creation, and the events that fire on login/logout.

Think of it as the server's operating layer for gameplay logic: your scripts plug into the framework instead of reinventing player/account/job systems every time.

**Qbox (`qbx_core`)** is the most active framework in the FiveM scene right now. It's a modern fork of QBCore - same shape, same concepts, slightly cleaner API.

If your server runs:
- **Qbox** → use `exports.qbx_core:GetPlayer(src)`
- **QBCore** (older) → use `QBCore.Functions.GetPlayer(src)` (Qbox ships a bridge so old code still works)
- **ESX** → totally different API, this lesson doesn't cover it

This lesson assumes Qbox.

---

## Get The Player Object (Server Side)

```lua
-- ↓ on the server, get the framework's player object for a given source
local player = exports.qbx_core:GetPlayer(src)

-- ↓ ALWAYS check it's not nil. Player can be nil if they're still connecting/loading.
if not player then return end

-- ↓ player.PlayerData = the full data blob for this player
print(player.PlayerData.citizenid)               -- unique per-character ID, like "ABC12345"
print(player.PlayerData.license)                 -- per-player ID across all characters
print(player.PlayerData.name)                    -- character display name
print(player.PlayerData.charinfo.firstname)
print(player.PlayerData.charinfo.lastname)
print(player.PlayerData.money.cash)              -- cash in pocket
print(player.PlayerData.money.bank)              -- bank account
print(player.PlayerData.job.name)                -- current job: 'police', 'unemployed', etc.
print(player.PlayerData.job.grade.level)         -- grade rank: 0, 1, 2, ...
print(player.PlayerData.job.isboss)              -- true if this is a boss-level grade
print(player.PlayerData.gang.name)               -- gang affiliation
print(player.PlayerData.metadata.hunger)         -- custom stats stored as JSON
```

---

## Money Functions

Money operations are atomic - Qbox handles internal locks so concurrent calls don't dupe.

```lua
local player = exports.qbx_core:GetPlayer(src)

-- ↓ ADD money. account type ('cash' or 'bank'), amount, reason string for logs
player.Functions.AddMoney('cash', 100, 'reason string')
player.Functions.AddMoney('bank', 500, 'salary')

-- ↓ REMOVE money. RETURNS BOOLEAN: true if had enough, false if short.
-- ALWAYS check the return value.
local ok = player.Functions.RemoveMoney('cash', 80, 'buy_gun')
if not ok then
    -- player didn't have $80, abort
    return
end

-- ↓ READ money. two equivalent ways:
local cash = player.PlayerData.money.cash        -- direct access
local cash2 = player.Functions.GetMoney('cash')  -- via function

-- ↓ SET money to a specific value. Rare. Usually use Add/Remove.
player.Functions.SetMoney('cash', 1000, 'admin set')
```

**Reason strings** matter - they go to logs. Be specific: `'shop_buy_gun'`, `'police_salary_grade2'`, `'admin_giveall'`. Future-you will thank current-you.

---

## Job Functions

```lua
-- ↓ change a player's job (e.g., they got hired)
player.Functions.SetJob('police', 2)             -- name, grade level

-- ↓ toggle on-duty / off-duty (police, EMS, etc.)
player.Functions.SetJobDuty(true)                -- true = on duty

-- reading job state was shown above via PlayerData
```

---

## Get Player Data (Client Side)

The client has a synced copy of its own player data. It's automatically updated when the server changes it.

```lua
local QBX = exports.qbx_core
local pdata = QBX:GetPlayerData()

print(pdata.citizenid)
print(pdata.money.cash)                          -- WARNING: this is for display only
print(pdata.job.name)
```

**Don't trust client PlayerData for security decisions.** Players can edit client Lua to fake values. Only the server's PlayerData is authoritative.

---

## Client Events: React To Data Changes

Qbox fires events when player data changes:

```lua
-- ↓ fires when the player's job changes
RegisterNetEvent('QBCore:Client:OnJobUpdate', function(job)
    print('job changed to:', job.name)
    -- update HUD, refresh menus, etc.
end)

-- ↓ fires when the player finishes loading their character
RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
    print('player loaded - safe to start client logic')
end)

-- ↓ fires whenever money changes. type = 'cash'/'bank', amount = delta, isRemoved = true/false
RegisterNetEvent('QBCore:Client:OnMoneyChange', function(type, amount, isRemoved)
    print(('money changed: %s %s%d'):format(type, isRemoved and '-' or '+', amount))
end)
```

Qbox keeps the old QBCore event names for compatibility.

Newer Qbox-specific events:

```lua
RegisterNetEvent('qbx_core:client:playerLoaded', function(data) end)
RegisterNetEvent('qbx_core:client:playerLoggedOut', function() end)
```

Use the newer ones when available.

---

## Server Events: Player Lifecycle

```lua
-- ↓ fires when a player loads their character
AddEventHandler('QBCore:Server:OnPlayerLoaded', function(player)
    -- player object is passed in. Set up per-player state, send initial data, etc.
end)

-- ↓ fires when a player disconnects
AddEventHandler('QBCore:Server:OnPlayerUnload', function(src)
    -- cleanup per-player state, save anything you cached
end)
```

---

## Job / Permission Checks

```lua
-- ↓ SERVER side check (the trusted one)
local player = exports.qbx_core:GetPlayer(src)
if not player then return end
if player.PlayerData.job.name ~= 'police' then return end       -- must be police
if player.PlayerData.job.grade.level < 2 then return end        -- must be grade 2 or higher

-- ↓ CLIENT side check (UX hint only - server is the gatekeeper)
local pdata = exports.qbx_core:GetPlayerData()
local isCop = pdata.job.name == 'police'
```

**Repeat the lesson: client checks are UX, server checks are security.**

---

## Metadata (Custom Player State)

`metadata` is a free-form table stored per-player and persisted to the DB. Use it for hunger, thirst, stress, custom stats:

```lua
-- ↓ READ
local hunger = player.PlayerData.metadata.hunger or 100         -- default 100 if not set yet

-- ↓ WRITE (server side)
player.Functions.SetMetaData('hunger', 80)                      -- this also auto-saves to DB

-- ↓ READ on client (synced copy)
local pdata = QBX:GetPlayerData()
print(pdata.metadata.hunger)
```

Anything you set with `SetMetaData` persists across sessions.

---

## Identifiers

A player has multiple identifiers. Each is stable in different ways:

```lua
-- ↓ on the server, given a src
local license = GetPlayerIdentifierByType(src, 'license')       -- stable per FiveM account
local steam = GetPlayerIdentifierByType(src, 'steam')           -- only if connected via Steam
local discord = GetPlayerIdentifierByType(src, 'discord')       -- only if Discord linked
local fivem = GetPlayerIdentifierByType(src, 'fivem')           -- forum account
local ip = GetPlayerEndpoint(src)                                -- their IP:port
```

| Identifier | Stable across | Use for |
|------------|---------------|---------|
| `citizenid` | One character | In-game things tied to a character |
| `license` | All characters of one player | Player-level data, ban lists |
| `steam` | Steam account | Optional, not all players have it |
| `discord` | Discord account | Optional |

For ban lists, use **license** (survives character deletion).
For in-game money, jobs, items, use **citizenid**.

---

## Get All Online Players

```lua
-- ↓ Qbox helper: returns a table indexed by source
local players = exports.qbx_core:GetQBPlayers()
for src, player in pairs(players) do
    print(src, player.PlayerData.citizenid)
end

-- ↓ alternative: use FiveM's GetPlayers() and resolve each
for _, pidStr in ipairs(GetPlayers()) do
    local p = exports.qbx_core:GetPlayer(tonumber(pidStr))
    if p then
        -- do something with p
    end
end
```

---

## Get An Offline Player

```lua
-- ↓ load a player object for someone NOT currently online (admin tools, audits)
local p = exports.qbx_core:GetOfflinePlayer(citizenid)
```

This does a DB read. Don't call it in a tight loop.

---

## Notifications

Qbox doesn't ship a notification system itself anymore - use **ox_lib** (covered next folder):

```lua
-- ↓ from server to a specific client
TriggerClientEvent('ox_lib:notify', src, {
    title = 'Shop',
    description = 'You bought bread',
    type = 'success',                                            -- success / error / inform / warning
})

-- ↓ directly on the client
lib.notify({
    title = 'Hi',
    description = 'Hello there',
    type = 'inform',
})
```

---

## Commands With Permission

```lua
-- ↓ Qbox helper: register a command, last arg is the required permission group
exports.qbx_core:CreateCommand('adminpanel', 'Open admin panel', {}, false, function(source, args)
    -- ↑ source = who ran it, args = arg table
    -- command body
end, 'admin')                                                    -- requires the 'admin' group
```

Or use FiveM's `RegisterCommand` with **ACE** (Access Control Entries) for permissions:

```lua
-- ↓ true = restricted to ACE-allowed players only
RegisterCommand('adminpanel', function(source, args)
    -- command body
end, true)
```

```cfg
# in permissions.cfg
add_ace group.admin command.adminpanel allow
```

ACE is FiveM's built-in permission system. More granular than framework groups.

---

## Items (Via The Inventory Resource)

Qbox **doesn't** store items itself. Your inventory resource does (ox_inventory, qb-inventory, tgiann-inventory, etc.). To give an item:

```lua
-- ↓ ox_inventory example. exports vary per inventory resource.
exports.ox_inventory:AddItem(src, 'bread', 5)
```

Each inventory resource has its own export names. Always check that resource's docs.

Full inventory deep-dive: [`06-ox-libraries/03-inventories.md`](../06-ox-libraries/03-inventories.md).

---

## QB Bridge (Legacy Compat)

Some older resources expect QBCore's API:

```lua
local QBCore = exports['qb-core']:GetCoreObject()
QBCore.Functions.GetPlayer(src)
```

Qbox ships a **bridge** that maps these calls onto Qbox's underlying functions. **Old code still works on Qbox servers.** For new code, prefer the native Qbox exports.

---

## Common Mistakes

### 1. Mutating PlayerData directly

```lua
-- ↓ BAD: this changes the local table but doesn't persist or sync
player.PlayerData.money.cash = 500

-- ↓ GOOD: use the framework function
player.Functions.SetMoney('cash', 500, 'reason')
```

### 2. Forgetting the nil check

```lua
local player = exports.qbx_core:GetPlayer(src)
if not player then return end                                   -- ALWAYS this line. ALWAYS.
```

`player` is `nil` if the player just connected and hasn't finished loading. Skipping the check = `attempt to index a nil value` error.

### 3. Trusting client PlayerData

Client PlayerData is for display. **Authoritative checks happen server-side.** A modded client can fake any value in client PlayerData.

---

## TL;DR

- `exports.qbx_core:GetPlayer(src)` server side - always check for nil
- `exports.qbx_core:GetPlayerData()` client side - for display only
- Money: `AddMoney`, `RemoveMoney` (returns bool!), read `.money.cash` / `.money.bank`
- Job: `.job.name`, `.job.grade.level`, `SetJob`
- Metadata: `.metadata.x`, `SetMetaData`
- citizenid = per-character ID. license = per-player ID.
- Notifications: `ox_lib:notify` event or `lib.notify` direct
- Items: through your inventory resource, not the framework

---

## Sources

- [Qbox Docs](https://docs.qbox.re/)
- [qbx_core GitHub](https://github.com/Qbox-project/qbx_core) - read the source
- [QBCore Docs (legacy)](https://docs.qbcore.org/) - same shape, older API
- [GetPlayerIdentifierByType native](https://docs.fivem.net/natives/?_0xA61C8FCDFF1206F4)
- [Resource ACE (permissions)](https://docs.fivem.net/docs/server-manual/setting-up-a-server/#permissions)

---

Next folder: [`06-ox-libraries/`](../06-ox-libraries/) - start with [`01-ox-lib.md`](../06-ox-libraries/01-ox-lib.md)
