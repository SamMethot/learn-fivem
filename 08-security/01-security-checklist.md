# 01. Security Checklist

## Plain English

FiveM servers run untrusted clients. Every player is a potential attacker. Every `RegisterNetEvent` is a public API that any player can call from their console.

**This file is the audit checklist.** Run through it for every resource you write before you ship. Skip a step → potential exploit. Mass-produce-able exploits get you raided, dupes ruin your economy, leaked webhooks get you banned from Discord.

Don't skip steps.

---

## Rule Zero

> **Never trust the client for anything that matters.**

"Matters" = money, items, kill scoring, position used for damage calcs, job status, admin permissions, anti-cheat triggers.

Trust the client for: display, UX state, non-critical UI inputs.

---

## The 10 Commandments

### 1. Validate Every Argument On Every Net Event

```lua
RegisterNetEvent('shop:buy', function(itemId, qty)
    local src = source
    if not src or src <= 0 then return end                      -- valid source

    if type(itemId) ~= 'string' then return end                 -- type
    if #itemId > 32 then return end                             -- length cap
    if type(qty) ~= 'number' then return end
    if qty ~= qty then return end                               -- NaN
    if qty <= 0 or qty > 99 then return end                     -- range
    if qty % 1 ~= 0 then return end                             -- integer

    -- only after all checks pass do you reach the actual logic
end)
```

Type, NaN, range, length, integer-check. Every arg. Every event.

### 2. Whitelist, Don't Blacklist

```lua
-- ↓ only these item IDs are valid; anything else, bail
local VALID_ITEMS = { bread = 10, water = 5, burger = 20 }

local price = VALID_ITEMS[itemId]
if not price then return end
```

**Never** trust the client to pass a price. Client passes `itemId` (just a string). Server looks up the price from its own config.

### 3. Server Is Source Of Truth For Money

```lua
-- BAD - client decides what to charge
local price = clientSentPrice

-- GOOD - server config decides
local price = CONFIG.PRICES[itemId]
```

Same for: discounts, multipliers, tax rates, anything that affects the math.

### 4. Atomic Money Operations

```lua
-- BAD: read-then-write race
local cash = player.PlayerData.money.cash
if cash < price then return end
player.Functions.RemoveMoney('cash', price, 'buy')              -- two parallel events both pass the check, both deduct

-- GOOD: framework's RemoveMoney is atomic - returns false if insufficient
if not player.Functions.RemoveMoney('cash', price, 'buy') then
    return                                                       -- didn't have enough money
end
```

Or use a conditional MySQL UPDATE - covered in [`04-database/02-queries-and-security.md`](../04-database/02-queries-and-security.md).

### 5. Job / Role Checks On Every Privileged Event

```lua
RegisterNetEvent('police:openArmory', function()
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    if not player then return end
    if player.PlayerData.job.name ~= 'police' then return end       -- must be a cop
    if player.PlayerData.job.grade.level < 2 then return end        -- must be grade 2+
end)
```

**Client-side checks are UX. Server-side checks are security.** Always both.

### 6. Distance Checks On Location-Sensitive Events

```lua
local CONFIG_COORDS = vec3(25.0, -1347.0, 29.5)

local ped = GetPlayerPed(src)
local pos = GetEntityCoords(ped)                                -- server reads synced position
if #(pos - CONFIG_COORDS) > 3.0 then return end                 -- more than 3m from shop, bail
```

Server reads player position from the synced entity state - not from a client-supplied arg. Stops "use shop from across the map" exploits.

### 7. Rate Limiting

```lua
local cooldowns = {}

RegisterNetEvent('shop:buy', function()
    local src = source
    local now = GetGameTimer()                                  -- ms since server start

    if cooldowns[src] and (now - cooldowns[src]) < 500 then return end
    cooldowns[src] = now

    -- process
end)

-- ↓ release on disconnect to avoid memory leak
AddEventHandler('playerDropped', function()
    cooldowns[source] = nil
end)
```

Spam-firing an event = race condition opportunity + server lag. Always throttle hot events.

### 8. Locks For Critical Sections

```lua
local busy = {}

RegisterNetEvent('shop:buy', function()
    local src = source
    if busy[src] then return end                                -- already processing this player's buy
    busy[src] = true

    -- ... money + inventory operations ...

    busy[src] = nil                                             -- release the lock
end)
```

Combine with atomic DB ops for defense-in-depth.

### 9. No SQL Injection

Always parameterized queries:

```lua
MySQL.query.await('SELECT * FROM players WHERE name = ?', { name })
```

Never `..` user input into SQL. See [`04-database/02-queries-and-security.md`](../04-database/02-queries-and-security.md) for full coverage.

### 10. Logs For Money / Items

Every money change, every item add/remove:

```lua
MySQL.insert(
    'INSERT INTO money_log (citizenid, delta, reason) VALUES (?, ?, ?)',
    { cid, -price, 'shop_buy_' .. itemId }
)
```

When (not if) an exploit happens, the log tells you who and how. Without logs, you're guessing.

---

## Client Event Exposure

Every `RegisterNetEvent` is a public API. **Name doesn't matter** - `secret:event` is no more secret than `public:event`. Players can fire:

```lua
TriggerServerEvent('secret:event', anyArgs)
```

Treat every registered net event as if a malicious player was about to call it with the worst-possible args.

---

## Don't Leak Admin Events

```lua
-- BAD - any player can trigger this and give themselves money
RegisterNetEvent('admin:giveMoney', function(target, amount)
    local player = exports.qbx_core:GetPlayer(target)
    player.Functions.AddMoney('cash', amount)
end)

-- GOOD - gate it with ACE
RegisterNetEvent('admin:giveMoney', function(target, amount)
    local src = source
    if not IsPlayerAceAllowed(src, 'admin.money') then
        DropPlayer(src, 'Exploit attempt')                      -- kick the attacker
        return
    end
    -- now safe to proceed
end)
```

**Better:** don't expose admin actions as net events at all. Use server commands + ACE permissions:

```lua
RegisterCommand('givemoney', function(source, args)
    if source ~= 0 and not IsPlayerAceAllowed(source, 'admin.money') then return end
    -- ... do the action
end, true)                                                       -- true = restricted to ACE
```

Then players can't fire it from a console - only the server (`source == 0`) or ACE-allowed admins can run the command.

---

## Callback Security

`lib.callback.register` is a net event under the hood. Same rules apply:

```lua
lib.callback.register('shop:price', function(src, itemId)
    if type(itemId) ~= 'string' then return nil end
    return CONFIG.PRICES[itemId]                                -- whitelist via config table lookup
end)
```

---

## Don't Send Secrets To The Client

Anything in `client_script` or `files{}` is **publicly readable**. Never include:

- Discord webhook URLs
- DB credentials
- Admin passwords
- Third-party API keys
- Anti-cheat detection logic that could be reverse-engineered

Anything sensitive → server-only files, loaded via convars (next section).

---

## Webhook Hygiene

Discord webhooks in client (or even readable shared) files = exploitable. Attacker spams the webhook with garbage → Discord bans the webhook. Your moderation logging dies.

Store in a convar:

```cfg
# server.cfg
set my_webhook "https://discord.com/api/webhooks/12345/abcdef"
```

Read on the server:

```lua
local webhook = GetConvar('my_webhook', '')                     -- 2nd arg = default if convar missing
```

Convars are server-only. **Never bundled with client downloads.**

---

## Entity Ownership

The client that "owns" an entity can modify its state. If you spawn something server-side and want server-controlled state, use:

```lua
-- ↓ server-side spawn - server-owned entity, harder to modify client-side
local veh = CreateVehicleServerSetter(modelHash, 'automobile', x, y, z, heading)
```

Qbox / newer wrappers expose helpers that handle this for you - check your framework docs.

---

## Kick On Confirmed Exploits

Don't silently `return` on obvious malicious input. Kick:

```lua
if bogusArg or impossibleState then
    DropPlayer(src, 'Exploit attempt: ' .. eventName)           -- shows in player's disconnect screen
    return
end
```

Plus log it. Repeat offenders need bans, not patience.

---

## Anti-Cheat Note

Many servers run third-party anti-cheats (txAdmin tools, paid solutions, community resources like FiveSafe). **Don't rely on them as sole defense.** Server-side validation comes first; anti-cheat is a second layer that catches the things validation can't (memory edits, injected DLLs).

---

## Pre-Ship Audit Checklist

Before shipping a resource, walk through this list:

- [ ] Every `RegisterNetEvent` validates types AND ranges
- [ ] Every `RegisterNetEvent` checks permission (job/ACE) where needed
- [ ] Money values come from server config, never from client args
- [ ] All money ops use atomic framework functions or conditional UPDATEs
- [ ] All SQL queries use `?` parameters
- [ ] Distance checks on location-sensitive events
- [ ] Rate limit on hot events
- [ ] Locks on critical sections
- [ ] No webhooks in client/shared files
- [ ] No secrets in client/shared files
- [ ] Logs in DB for money/inventory changes
- [ ] `onResourceStop` cleanup (NUI focus, threads, entities, blips)
- [ ] Tested with malicious inputs from F8 console

---

## Red Flags When Reading Existing Code

If you see any of these in a public/leaked resource, **don't use it without fixing**:

- `RegisterNetEvent` body without ANY validation = guaranteed exploit
- Client passing `price`, `amount`, `total` as event args = guaranteed exploit
- Job check happens client-side only = guaranteed exploit
- `TriggerClientEvent('addItem', ...)` with no server-side accounting = guaranteed exploit
- `MySQL.query("... " .. clientInput .. " ...")` = SQL injection
- Hardcoded webhook URL anywhere = will get spammed and banned
- `RemoveItem` body that calls `AddItem` = infinite item glitch (yes, real)

---

## TL;DR

Client = hostile. Validate every arg, whitelist every value, check every permission server-side, atomic money ops, rate limit, log critical actions, no secrets in client files.

If a resource skips ANY of these, it's exploitable.

---

## Sources

- [FiveM Event Security Manual](https://docs.fivem.net/docs/scripting-manual/working-with-events/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - universal app sec principles
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [FiveM ACE Permissions](https://docs.fivem.net/docs/server-manual/setting-up-a-server/#permissions)
- [GetConvar](https://docs.fivem.net/natives/?_0x6B0DE401)
- [DropPlayer](https://docs.fivem.net/natives/?_0x4D2A28D7) - kick natively

---

Next folder: [`09-performance/`](../09-performance/) - start with [`01-threads-and-waits.md`](../09-performance/01-threads-and-waits.md)
