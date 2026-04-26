# 03. Event Security

## Plain English

**This is the most important file in the whole course.** Read it twice. Bookmark it. Come back to it.

Every `RegisterNetEvent` you write on the server is a function any player on your server can call from their cheat console with any arguments they want. If you don't validate, they get free items, free money, admin permissions, or a deleted database.

This file is the checklist. Apply every single point to every single net event handler. Skipping a step = potential exploit.

---

## Threat Model - What Attackers Can Actually Do

An attacker on your server is **a player with a FiveM client**. They have:

- **Full client Lua control** - they can modify any client `.lua` file you ship them
- **Cheat menus** (Redengine, Eulen, Susano, dozens more) that inject Lua into running clients
- **Console access** - can manually run `TriggerServerEvent('anything', anything)` from their F8
- **Time** - they sit there and try 1,000 variations of arguments to find what works

What they **can't** do:

- Run server-side Lua (server stays on your machine)
- Read your DB directly (DB is server-only)
- Fire events that aren't registered with `RegisterNetEvent` (FiveM blocks unregistered routes)

**Your job is server-side validation.** Refuse bad input, log it, kick repeat offenders.

---

## The Full Checklist (Every Net Event)

```lua
RegisterNetEvent('shop:buy', function(itemId, qty)
    -- 1. SOURCE valid
    local src = source                                         -- cache first
    if not src or src == 0 then return end                     -- bail on missing/invalid

    -- 2. TYPES of every argument
    if type(itemId) ~= 'string' then return end                -- itemId must be a string
    if type(qty) ~= 'number' then return end                   -- qty must be a number

    -- 3. RANGES / lengths / NaN
    if #itemId > 50 then return end                            -- string length cap
    if qty ~= qty then return end                              -- NaN check (only NaN ≠ itself)
    if qty < 1 or qty > Config.MaxQty then return end          -- numeric range
    if qty % 1 ~= 0 then return end                            -- must be a whole number (no 0.5 tricks)

    -- 4. WHITELIST of allowed values
    local item = Config.Items[itemId]                          -- look up in server config
    if not item then return end                                -- not on the list, bail

    -- 5. PLAYER loaded
    local player = exports.qbx_core:GetPlayer(src)             -- get the framework player
    if not player then return end                              -- still loading, bail

    -- 6. PERMISSION / role check
    if item.jobRequired and player.PlayerData.job.name ~= item.jobRequired then
        return                                                  -- wrong job, bail
    end

    -- 7. GAME STATE - is the player in a state where this makes sense?
    if IsPedDeadOrDying(GetPlayerPed(src), true) then return end -- can't buy while dead

    -- 8. LOCATION - is the player physically near the shop?
    local coords = GetEntityCoords(GetPlayerPed(src))
    if #(coords - Config.ShopCoords) > 5.0 then                -- "#(a-b)" = distance between vector3s
        logSuspicious(src, 'shop:buy', 'too far from shop')
        return
    end

    -- 9. RATE LIMIT - not spamming?
    if isRateLimited(src, 'shop:buy', 500) then return end     -- max once per 500ms

    -- 10. LOCK - prevent parallel races
    if locked[src] then return end
    locked[src] = true

    -- 11. ATOMIC money + inventory
    if player.PlayerData.money.cash < item.price * qty then
        locked[src] = nil
        return
    end
    player.Functions.RemoveMoney('cash', item.price * qty, 'shop buy')
    exports.ox_inventory:AddItem(src, itemId, qty)

    locked[src] = nil
end)
```

That's the model. Every step is explained below.

---

## 1. Source

```lua
local src = source
if not src or src == 0 then return end
```

`source = 0` is "the server itself" - useful for some internal things, but a **player triggering an event will always have a positive source ID**. If you see `0`, something weird is going on. Bail.

---

## 2. Types

The client can pass anything:

```lua
TriggerServerEvent('shop:buy', { nested = 'table' }, nil)
```

If your handler does `qty * price` without checking, that's `nil * number` → Lua error → handler crashes. Or with NaN, you get gibberish math.

```lua
if type(itemId) ~= 'string' then return end                    -- expected string, got something else
if type(qty) ~= 'number' then return end                       -- expected number
```

---

## 3. Ranges, Lengths, NaN

```lua
if qty ~= qty then return end                                  -- NaN (only NaN is not equal to itself)
if qty < 1 or qty > 100 then return end                        -- valid range
if qty % 1 ~= 0 then return end                                -- must be integer (rejects 1.5)

if #itemId > 50 then return end                                -- string length cap
```

Why string-length cap? Unbounded strings = DoS vector. If you log it or store it raw, someone could send a 10MB string and tank your server.

---

## 4. Whitelist Over Blacklist

**Good:**
```lua
local item = Config.AllowedItems[itemId]
if not item then return end                                    -- if not in the table, bail
```

**Bad:**
```lua
if itemId == 'admin_weapon' or itemId == 'money_hax' then return end
```

Attackers will use `'admin_weapon '` (trailing space), `'Admin_Weapon'` (case), or any name you didn't think of. **Whitelist = only known-good passes. Period.**

---

## 5. Identity Comes From `source`, Not From Args

```lua
-- BAD: client tells you who they are
RegisterNetEvent('transfer', function(fromId, toId, amount)
    -- who is fromId? whatever the client claims!
end)

-- GOOD: server knows who they are from `source`
RegisterNetEvent('transfer', function(toId, amount)
    local src = source                                         -- THIS is who fired the event
    -- ↑ "fromId" is always src - never trust client to identify itself
end)
```

If you trust client-supplied identity, attackers pass `fromId = adminId` and steal admin's money.

---

## 6. Permission / Role Checks

Some events should only work for cops, EMS, bosses, admins:

```lua
if player.PlayerData.job.name ~= 'police' then return end       -- must be police
if not IsPlayerAceAllowed(src, 'command.admin') then return end  -- must have ACE permission
```

Client-side permission checks are UX - they hide buttons. **Server-side checks are security** - they actually stop the action.

---

## 7. Game State

Player state must make sense for the action:

```lua
local ped = GetPlayerPed(src)
if IsEntityDead(ped) then return end                            -- dead players can't buy
if IsPedCuffed(ped) then return end                             -- cuffed players can't shoot
```

---

## 8. Location

Check that the **server-read coords** of the player are near the expected location:

```lua
local coords = GetEntityCoords(GetPlayerPed(src))               -- read pos from SERVER (synced from client, but server-trusted)
if #(coords - Config.ShopCoords) > 5.0 then                     -- "#(a-b)" = distance
    return
end
```

This stops "use shop from anywhere" exploits. The `5.0` is meters - adjust per shop.

---

## 9. Rate Limit

Stop spammers from hammering an event:

```lua
local lastFired = {}

local function isRateLimited(src, eventName, minIntervalMs)
    local key = src .. ':' .. eventName                         -- unique key per player+event
    local now = GetGameTimer()                                  -- current ms timestamp
    if lastFired[key] and now - lastFired[key] < minIntervalMs then
        return true                                              -- still within cooldown
    end
    lastFired[key] = now
    return false
end
```

Apply per-event with whatever interval makes sense. Buying = 500ms. Drawing weapon = 200ms. Money transfer = 2000ms.

---

## 10. Locks (Race Defense)

Attacker fires `shop:buy` 10 times in parallel from a script. Each handler starts, each passes the "has money" check (because none have deducted yet), each deducts. Money goes negative or stays the same, you give 10 items.

Lock per-player while processing:

```lua
local locked = {}

RegisterNetEvent('shop:buy', function(...)
    local src = source
    if locked[src] then return end                              -- already processing for this player, bail
    locked[src] = true                                          -- mark as busy

    -- ... do all the work ...

    locked[src] = nil                                           -- release the lock
end)
```

Don't forget to release on every code path (errors, early returns). One leak = player permanently can't use the event.

Even better: combine with **atomic DB operations** (next).

---

## 11. Atomic Money / Inventory

The DB itself can guarantee atomicity. Use a **conditional UPDATE** so the deduction can only succeed if the money was there:

```lua
local affected = MySQL.update.await(
    'UPDATE accounts SET cash = cash - ? WHERE citizenid = ? AND cash >= ?',
    { price, cid, price }
)
-- ↑ MySQL serializes UPDATEs. Only ONE concurrent attempt passes "cash >= price".
-- ↑ Others get 0 affected rows.

if affected == 0 then return end                                -- didn't have money, bail
```

If `affected == 0`, don't add the item. Full deep-dive: [`04-database/02-queries-and-security.md`](../04-database/02-queries-and-security.md).

---

## Logging Suspicious Activity

When validation rejects something fishy, **log it**. Patterns reveal repeat offenders.

```lua
local function logSuspicious(src, event, reason)
    local name = GetPlayerName(src) or '?'
    local license = GetPlayerIdentifierByType(src, 'license') or '?'
    print(('[SUSPICIOUS] %s (%s) event=%s reason=%s'):format(name, license, event, reason))
end
```

For prod, write to a DB table or push to a Discord webhook (server-side only - never client-side).

---

## Real Exploits You'll See In The Wild

These keep showing up in leaked / open-source resources. If you see any of these patterns, fix them immediately:

- **`RemoveItem()` accidentally calls `AddItem()`** - infinite item glitch (yes, really, common copy-paste bug)
- **Job/gang boss check copied from another job** - anyone gets boss permissions on the wrong job
- **Hardcoded Discord webhooks in client files** - players spam the webhook, Discord bans it
- **Unvalidated XP / level / skill events** - client passes `level = 99`, server saves it
- **Money sent as a client argument** - `TriggerServerEvent('reward', 9999999)` works because the server reads `amount` from the client

All caused by skipping the checklist.

---

## Test Your Own Events Like An Attacker

After writing a handler, sit at F8 and try to break it:

```
TriggerServerEvent('my:event', nil, nil)
TriggerServerEvent('my:event', 999999, 'admin_item')
TriggerServerEvent('my:event', -1, -999)
TriggerServerEvent('my:event', { a = 1 })
TriggerServerEvent('my:event', string.rep('x', 100000))
TriggerServerEvent('my:event', 0/0)        -- NaN
```

If anything happens (money changes, items appear, errors flood console), you have a bug to fix.

---

## Tools

- **`fivem_lint_lua`** flags missing source caching and obvious validation gaps
- Search `TriggerServerEvent` in client code, `RegisterNetEvent` in server = full attack surface map
- The MCP tool `fivem_search_events` finds orphan registrations (registered but no handler)
- For prod: third-party anti-cheat resources catch some patterns automatically

---

## TL;DR

- Every `RegisterNetEvent` is a public API. Players can call it.
- 11-step checklist: source, types, ranges, whitelist, player, role, state, location, rate limit, lock, atomic.
- Identity comes from `source`, NEVER from args.
- Log suspicious activity.
- Test with malicious inputs from F8 before you ship.

---

## Sources

- [Working With Events (official)](https://docs.fivem.net/docs/scripting-manual/working-with-events/) - securing events
- [RegisterNetEvent](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/RegisterNetEvent/)
- [GetPlayerIdentifierByType](https://docs.fivem.net/natives/?_0xA61C8FCDFF1206F4) - fetching license/steam/discord
- [IsPlayerAceAllowed](https://docs.fivem.net/natives/?_0xDEDAE23D) - ACE permission check
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) - general principles

---

Next: [`04-callbacks.md`](04-callbacks.md)
