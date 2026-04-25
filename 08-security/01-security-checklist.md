# 01. Security Checklist

FiveM servers = untrusted clients. Players run modded Lua. Exploiters trigger any event with any args. Your server code is the line of defense.

This file = the checklist. Hit every point on every resource.

## Rule Zero

**Never trust the client for anything that matters.**

"Matters" = money, items, kills, positions used for damage calcs, job status, admin permissions.

Trust the client for: display, inputs, non-critical UI state.

## The 10 Commandments

### 1. Validate Every Net Event Arg

```lua
RegisterNetEvent('shop:buy', function(itemId, qty)
    local src = source
    if not src or src <= 0 then return end

    if type(itemId) ~= 'string' then return end
    if #itemId > 32 then return end
    if type(qty) ~= 'number' then return end
    if qty ~= qty then return end             -- NaN
    if qty <= 0 or qty > 99 then return end
    if qty % 1 ~= 0 then return end           -- integer
end)
```

### 2. Whitelist Allowed Values

```lua
local VALID_ITEMS = { bread = 10, water = 5, burger = 20 }

local price = VALID_ITEMS[itemId]
if not price then return end
```

Never look up price from client. Client sends item ID, server knows price.

### 3. Server Is Source Of Truth For Money

```lua
-- NEVER
local price = clientSentPrice

-- ALWAYS
local price = CONFIG.PRICES[itemId]
```

Same for discounts, multipliers, totals.

### 4. Atomic Money Ops

```lua
-- BAD
local cash = player.PlayerData.money.cash
if cash < price then return end
player.Functions.RemoveMoney('cash', price, 'buy')

-- GOOD (framework's RemoveMoney is atomic, returns false on insufficient)
if not player.Functions.RemoveMoney('cash', price, 'buy') then return end
```

### 5. Job / Permission Checks

```lua
RegisterNetEvent('police:openArmory', function()
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    if not player then return end
    if player.PlayerData.job.name ~= 'police' then return end
    if player.PlayerData.job.grade.level < 2 then return end
end)
```

Every privileged event. No exceptions.

Client-side check = UX. Server-side check = security.

### 6. Distance Checks

Ensure player near the thing they claim to use:

```lua
local CONFIG_COORDS = vec3(25.0, -1347.0, 29.5)

local ped = GetPlayerPed(src)
local pos = GetEntityCoords(ped)
if #(pos - CONFIG_COORDS) > 3.0 then return end
```

Prevents teleport exploits + interact-from-anywhere.

### 7. Rate Limiting

```lua
local cooldowns = {}

RegisterNetEvent('shop:buy', function()
    local src = source
    local now = GetGameTimer()

    if cooldowns[src] and (now - cooldowns[src]) < 500 then return end
    cooldowns[src] = now

    -- process
end)

AddEventHandler('playerDropped', function()
    cooldowns[source] = nil
end)
```

Prevents spam/dupe race windows.

### 8. Locks For Critical Sections

```lua
local busy = {}

RegisterNetEvent('shop:buy', function()
    local src = source
    if busy[src] then return end
    busy[src] = true

    -- money + inventory

    busy[src] = nil
end)
```

Prevents double-fire dupes. Combine with atomic DB ops.

### 9. No SQL Injection

Always `?` + params:

```lua
MySQL.query.await('SELECT * FROM players WHERE name = ?', {name})
```

See `04-database/02-queries-and-security.md`.

### 10. Logs For Money / Items

Every money change, every item add/remove = log it.

```lua
MySQL.insert('INSERT INTO money_log (citizenid, delta, reason) VALUES (?, ?, ?)',
    {cid, -price, 'shop_buy_' .. itemId})
```

When exploit happens, log tells you who.

## Client Event Exposure

`TriggerServerEvent('secret:event', arg)` from client = any player can fire. Name doesn't matter.

Treat every `RegisterNetEvent` as a public API.

## Don't Leak Admin Events

```lua
-- BAD
RegisterNetEvent('admin:giveMoney', function(target, amount)
    local player = exports.qbx_core:GetPlayer(target)
    player.Functions.AddMoney('cash', amount)
end)
```

ANY player triggers it. Free money. Gate it:

```lua
RegisterNetEvent('admin:giveMoney', function(target, amount)
    local src = source
    if not IsPlayerAceAllowed(src, 'admin.money') then
        DropPlayer(src, 'Exploit attempt')
        return
    end
    -- ... now proceed
end)
```

Consider not exposing admin ops as net events at all. Server commands + ACE only.

## Callback Security

Same rules as events. Callbacks are net events under the hood.

```lua
lib.callback.register('shop:price', function(src, itemId)
    if type(itemId) ~= 'string' then return nil end
    return CONFIG.PRICES[itemId]
end)
```

## Don't Send Secrets Client-Side

Don't bundle in NUI:
- Discord webhook URLs
- Database credentials
- Admin passwords
- API keys

Client files = readable by anyone with FiveM cache folder.

## Webhook Hygiene

Discord webhooks in client or even readable server files = exploitable. Attacker spams webhook -> Discord bans it.

Store in convar:
```
set my_webhook "https://discord.com/api/webhooks/..."
```

Read server side:
```lua
local webhook = GetConvar('my_webhook', '')
```

Convars are server-private. Never client-visible.

## Entity Ownership

Client owns entity = can modify it. If you spawn something server-side and want server authority:

```lua
-- on server
local veh = CreateVehicleServerSetter(modelHash, 'automobile', x, y, z, heading)
-- newer Qbox has qbx_core helpers for this
```

Server-owned entities harder to modify client-side.

## Kick / Ban On Detection

Confident exploit = kick:

```lua
if bogusArg then
    DropPlayer(src, 'Exploit attempt: ' .. eventName)
    return
end
```

Don't silently ignore. Exploiter tries again. Log the attempt too.

## Anti-Cheat Note

Your server might run anti-cheat (txAdmin tools, community AC resources, paid solutions). Don't rely on it as sole defense. Server-side validation first, anti-cheat as a second layer.

## Security Audit Checklist

Before shipping a resource, verify:

- [ ] Every net event validates types and ranges
- [ ] Every net event checks permission (job/ACE)
- [ ] Money reads come from server config, not client args
- [ ] All money ops use atomic framework functions
- [ ] SQL queries use `?` parameters
- [ ] Distance checks on location-sensitive events
- [ ] Rate limit on hot events
- [ ] Locks on critical sections
- [ ] No webhooks in client files
- [ ] No secrets in client files
- [ ] Logs for money/inventory changes
- [ ] `onResourceStop` cleanup (NUI focus, threads, entities)

## Red Flags When Reading Existing Code

- `trigger server event without validation` = exploit
- `client sends price/amount/total` = exploit
- `job check only on client` = exploit
- `TriggerClientEvent('add item')` with no server accounting = exploit
- `MySQL.query('... ' .. clientInput .. ' ...')` = SQL injection
- Hardcoded webhook URL = someone can spam

## TL;DR

Client = hostile. Validate every arg, whitelist every value, check every permission server-side, atomic money, rate limit, log critical, no secrets client-side.

## Sources

- FiveM event security: https://docs.fivem.net/docs/scripting-manual/working-with-events/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP input validation: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- ox_lib utilities: https://coxdocs.dev/ox_lib

Next folder: `09-performance/`
