# 02. ESX Basics

## Plain English

A **framework** in FiveM is the resource that owns "what is a player". It defines the player object, jobs, gangs, money, inventory hooks, character creation, and the events that fire on login/logout.

Think of it as the server's operating layer for gameplay logic: your scripts plug into the framework instead of reinventing player/account/job systems every time.

**ESX (`es_extended`)** is one of the oldest and most widely used FiveM RP frameworks.

Like Qbox/QBCore, ESX owns the player model: identity, jobs, money/accounts, inventory hooks, and player lifecycle events.

If your server runs:
- **ESX** -> use `ESX.GetPlayerFromId(src)`
- **Qbox/QBCore** -> use their own player objects and function names

This lesson assumes ESX Legacy (`es_extended`) and Lua resources.

---

## Get The Player Object (Server Side)

```lua
-- ↓ get the shared ESX object once (server file scope)
local ESX = exports['es_extended']:getSharedObject()

-- ↓ later, inside an event/command where you have `source`
local src = source
local xPlayer = ESX.GetPlayerFromId(src)

-- ↓ ALWAYS nil-check. Can be nil during load/disconnect race windows.
if not xPlayer then return end

-- ↓ common identity fields
print(xPlayer.identifier)                        -- stable player identifier (license based in modern setups)
print(xPlayer.getName())                         -- character display name

-- ↓ job info
local job = xPlayer.getJob()                     -- table: name, label, grade, grade_name, ...
print(job.name)
print(job.grade)

-- ↓ account balances
print(xPlayer.getMoney())                        -- cash (if your server uses cash)
print(xPlayer.getAccount('bank').money)          -- bank account
```

`xPlayer` is your trusted server-side player object. Client values are never authoritative.

---

## Money And Accounts

ESX usually separates money into accounts (`money`, `bank`, sometimes `black_money`).

```lua
local src = source
local xPlayer = ESX.GetPlayerFromId(src)
if not xPlayer then return end

-- ↓ cash helper methods
xPlayer.addMoney(250)                            -- add cash

-- ↓ safe remove pattern: check first, then remove
local cash = xPlayer.getMoney()
if cash < 100 then
    -- not enough cash
    return
end
xPlayer.removeMoney(100)

-- ↓ account-specific methods
xPlayer.addAccountMoney('bank', 500)
xPlayer.removeAccountMoney('bank', 200)

-- ↓ read account value
local bank = xPlayer.getAccount('bank').money
print(('bank now: %d'):format(bank))
```

Use explicit server-side checks before any remove operation. Never trust a client-reported balance.

---

## Job Functions

```lua
local xPlayer = ESX.GetPlayerFromId(source)
if not xPlayer then return end

-- ↓ assign job and grade
xPlayer.setJob('police', 2)

-- ↓ read job state
local job = xPlayer.getJob()
if job.name == 'police' and job.grade >= 2 then
    -- allowed to access police-grade-2+ features
end
```

`job.grade` is numeric in most ESX setups. Keep checks numeric on the server.

---

## Inventory Helpers (Common ESX Pattern)

Exact behavior depends on your inventory resource (default ESX inventory vs ox_inventory bridge), but these are common patterns:

```lua
local xPlayer = ESX.GetPlayerFromId(source)
if not xPlayer then return end

-- ↓ read item count
local bread = xPlayer.getInventoryItem('bread')
print(bread.count)

-- ↓ can carry check (if available in your setup)
if xPlayer.canCarryItem and not xPlayer.canCarryItem('bread', 1) then
    return
end

-- ↓ add/remove item
xPlayer.addInventoryItem('bread', 1)
xPlayer.removeInventoryItem('bread', 1)
```

Always test these on your exact stack. Inventory APIs vary between servers.

---

## Client Data (For UI Only)

```lua
-- ↓ ESX object on client
local ESX = exports['es_extended']:getSharedObject()

-- ↓ current player's synced data
local pdata = ESX.GetPlayerData()
print(pdata.job and pdata.job.name)
```

Use client data for display (HUD/menu hints). Use server data for permissions, money, and item security.

---

## Events You Will Use Constantly

```lua
-- ↓ client: player finished loading
RegisterNetEvent('esx:playerLoaded', function(playerData)
    print('loaded as', playerData.job and playerData.job.name)
end)

-- ↓ client: job changed
RegisterNetEvent('esx:setJob', function(job)
    print('new job:', job.name, job.grade)
end)
```

```lua
-- ↓ server: player dropped/disconnected (FiveM base event)
AddEventHandler('playerDropped', function(reason)
    local src = source
    -- cleanup server-side caches tied to src
end)
```

Use FiveM base events plus ESX events together. ESX names can vary by version, so confirm on your server docs.

---

## Permission Checks

```lua
local xPlayer = ESX.GetPlayerFromId(source)
if not xPlayer then return end

-- ↓ framework job/grade gate
local job = xPlayer.getJob()
if job.name ~= 'police' or job.grade < 2 then
    return
end

-- ↓ optional admin group check (depends on your permissions setup)
if xPlayer.getGroup and xPlayer.getGroup() ~= 'admin' then
    return
end
```

Server-side permission gates are mandatory. Client-side gates are only UX.

---

## Online Players Loop

```lua
local ESX = exports['es_extended']:getSharedObject()

-- ↓ preferred ESX helper when available
for _, xPlayer in pairs(ESX.GetExtendedPlayers()) do
    print(xPlayer.source, xPlayer.getName())
end

-- ↓ universal fallback: FiveM GetPlayers + resolve each
for _, idStr in ipairs(GetPlayers()) do
    local src = tonumber(idStr)
    local p = ESX.GetPlayerFromId(src)
    if p then
        print(src, p.identifier)
    end
end
```

For large loops, avoid doing heavy DB work inside each iteration.

---

## Notifications

```lua
-- ↓ classic ESX notify
TriggerClientEvent('esx:showNotification', source, 'Purchase complete')

-- ↓ modern alternative with ox_lib (if installed)
TriggerClientEvent('ox_lib:notify', source, {
    title = 'Shop',
    description = 'You bought bread',
    type = 'success',
})
```

Pick one UI style and stay consistent across your resources.

---

## Security Notes (Read Twice)

1. Start every server net event with `local src = source`.
2. Resolve `xPlayer` from `src` on the server, not from client-sent identifiers.
3. Re-check money/items/job on the server right before mutation.
4. Never trust client-sent price, quantity, or grade.
5. Parameterize every SQL query (no string concatenation).

---

## TL;DR

- `ESX.GetPlayerFromId(src)` is the core server entrypoint.
- Use `xPlayer` methods for money, jobs, and inventory.
- Client `ESX.GetPlayerData()` is display-only, never security.
- Job/admin checks belong on server handlers.
- ESX APIs vary by fork/version, so confirm function names on your stack.

---

## Sources

- [ESX Documentation](https://documentation.esx-framework.org/)
- [es_extended (GitHub)](https://github.com/esx-framework/esx_core/tree/main/%5Besx%5D/es_extended)
- [FiveM Scripting Docs](https://docs.fivem.net/docs/scripting-manual/)

---