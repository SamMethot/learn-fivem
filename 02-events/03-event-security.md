# 03. Event Security

Most critical file in this folder. Read twice. Every net event = attack surface.

## Threat Model

Attacker = a player. Has:
- Full FiveM client control (can edit client Lua, inject code)
- Cheat menus (Redengine, Eulen, etc.)
- Console access: `TriggerServerEvent('anything', anything)`
- Time. They sit and try 1000 variations.

They cannot:
- Run server Lua
- Read your DB directly
- Fire events that aren't registered with `RegisterNetEvent`

Your job = server validates, server refuses bad input.

## The Checklist

Every server `RegisterNetEvent` handler:

```lua
RegisterNetEvent('shop:buy', function(itemId, qty)
    -- 1. source valid
    local src = source
    if not src or src == 0 then return end

    -- 2. types
    if type(itemId) ~= 'string' then return end
    if type(qty) ~= 'number' then return end

    -- 3. ranges / lengths
    if #itemId > 50 then return end
    if qty ~= qty then return end              -- NaN check
    if qty < 1 or qty > Config.MaxQty then return end

    -- 4. whitelist
    local item = Config.Items[itemId]
    if not item then return end

    -- 5. player loaded
    local player = exports.qbx_core:GetPlayer(src)
    if not player then return end

    -- 6. permission / role
    if item.jobRequired and player.PlayerData.job.name ~= item.jobRequired then
        return
    end

    -- 7. state
    if IsPedDeadOrDying(GetPlayerPed(src), true) then return end

    -- 8. location
    local coords = GetEntityCoords(GetPlayerPed(src))
    if #(coords - Config.ShopCoords) > 5.0 then
        logSuspicious(src, 'shop:buy', 'too far')
        return
    end

    -- 9. rate limit
    if isRateLimited(src, 'shop:buy', 500) then return end

    -- 10. lock
    if locked[src] then return end
    locked[src] = true

    -- 11. atomic DB / money
    if player.PlayerData.money.cash < item.price * qty then
        locked[src] = nil
        return
    end
    player.Functions.RemoveMoney('cash', item.price * qty, 'shop buy')
    exports.ox_inventory:AddItem(src, itemId, qty)

    locked[src] = nil
end)
```

Skip any step = potential exploit.

## 1. Source

```lua
local src = source
if not src or src == 0 then return end
```

`source = 0` = server itself or invalid. Rarely seen but check anyway.

## 2. Types

Client can pass anything:

```lua
TriggerServerEvent('shop:buy', { nested = 'table' }, nil)
```

If you do `qty * price`, that's `nil * number` = Lua error. Handler crashes. Or worse, passes NaN.

```lua
if type(itemId) ~= 'string' then return end
if type(qty) ~= 'number' then return end
```

## 3. Ranges

```lua
if qty ~= qty then return end            -- NaN (only NaN =/= itself)
if qty < 1 or qty > 100 then return end
if qty % 1 ~= 0 then return end          -- must be integer

if #itemId > 50 then return end          -- string length cap
```

Strings unbounded = DoS vector if you log/store raw.

## 4. Whitelist Over Blacklist

Good:
```lua
local item = Config.AllowedItems[itemId]
if not item then return end
```

Bad:
```lua
if itemId == 'admin_weapon' or itemId == 'money_hax' then return end
```

Attacker just uses `'admin_weapon '` (trailing space) or a typo. Whitelist = only known-good passes.

## 5. Identity From Source, Not Args

```lua
-- BAD
RegisterNetEvent('transfer', function(fromId, toId, amount)
    -- who is fromId? The caller? Or anyone?
end)

-- GOOD
RegisterNetEvent('transfer', function(toId, amount)
    local src = source   -- fromId is always src, never trust client
    -- ...
end)
```

Attacker passes `fromId = adminId` and steals money. Derive identity from `source`.

## 6. Role / Permission

Some events only for cops, or bosses, or admins:

```lua
if player.PlayerData.job.name ~= 'police' then return end
if not IsPlayerAceAllowed(src, 'command.admin') then return end
```

## 7. Game State

Player dead can't buy. Player cuffed can't shoot. Check state:

```lua
local ped = GetPlayerPed(src)
if IsEntityDead(ped) then return end
if IsPedCuffed(ped) then return end
```

## 8. Location

Server reads coords (not client-provided) and checks distance from expected point:

```lua
local coords = GetEntityCoords(GetPlayerPed(src))
if #(coords - Config.ShopCoords) > 5.0 then
    return
end
```

Attacker can't move teleport via this event without actually being there.

## 9. Rate Limit

Spam `shop:buy` 1000x/sec = server lag + possible race bugs. Throttle:

```lua
local lastFired = {}
local function isRateLimited(src, eventName, minInterval)
    local key = src .. ':' .. eventName
    local now = GetGameTimer()
    if lastFired[key] and now - lastFired[key] < minInterval then
        return true
    end
    lastFired[key] = now
    return false
end
```

## 10. Locks (Race Defense)

Attacker fires `shop:buy` 10x in parallel. Each handler starts, each passes "has money" check, each deducts. You lose money 10x.

Fix: lock per player while processing:

```lua
local locked = {}

RegisterNetEvent('shop:buy', function(...)
    local src = source
    if locked[src] then return end
    locked[src] = true

    -- all work here

    locked[src] = nil
end)
```

Better: atomic DB operation (next folder). Locks are first line of defense.

## 11. Atomic Money / Inventory

Covered deep in `04-database/02-queries-and-security.md`. Short version: use conditional UPDATE so money can't go negative via race:

```lua
MySQL.update.await(
    'UPDATE accounts SET cash = cash - ? WHERE citizenid = ? AND cash >= ?',
    { price, cid, price }
)
```

If it returns 0 affected rows = didn't have money = don't give item.

## Logging

```lua
local function logSuspicious(src, event, reason)
    local name = GetPlayerName(src) or '?'
    local license = GetPlayerIdentifierByType(src, 'license') or '?'
    print(('[SUSPICIOUS] %s (%s) event=%s reason=%s'):format(name, license, event, reason))
end
```

When validation rejects, LOG it. Anomalies = investigate. Good data = catch repeat offenders.

## Real Exploits You'll See In The Wild

Patterns that keep showing up in leaked / open-source resources:
- `RemoveItem()` implementation that actually calls `AddItem()` = infinite items
- Gang / job boss check copy-pasted from job code = anyone gets boss permissions
- Hardcoded Discord webhooks in client files = webhook gets spammed and banned
- Unvalidated XP / level / skill events = client injects max level instantly

All caused by skipping checklist steps.

## Test Your Own Events

After writing a handler, try:

```
TriggerServerEvent('my:event', nil, nil)
TriggerServerEvent('my:event', 999999, 'admin_item')
TriggerServerEvent('my:event', -1, -999)
TriggerServerEvent('my:event', { a = 1 })
```

From F8 console. Should see nothing happen. If something happens = you have a bug.

## Tools

- `fivem_lint_lua` flags common missing patterns
- Search `TriggerServerEvent` in client code, `RegisterNetEvent` in server = full attack surface list
- `fivem_search_events` = find orphan registrations

## TL;DR

- Every `RegisterNetEvent` = checklist applies
- Source, types, range, whitelist, player, role, state, location, rate limit, lock, atomic
- Identity = `source`, not args
- Log rejections
- Test with malicious inputs before shipping

## Sources

- Securing net events (official): https://docs.fivem.net/docs/scripting-manual/working-with-events/
- RegisterNetEvent: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/RegisterNetEvent/
- OWASP input validation: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html

Next: `04-callbacks.md`
