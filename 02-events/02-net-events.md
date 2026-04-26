# 02. Net Events

## Plain English

A **net event** is an event that crosses the network. Client → server, server → client, or server → many clients.

This is how a player's "buy bread" click reaches your database, and how the server's "you got bread" notification reaches the player's screen.

**Every net event is an attack surface.** Players can fire any registered net event with any arguments. The next lesson is entirely about defending against that - for now, just learn how to fire and listen.

---

## The Four Patterns

### 1. Client fires, server handles

```lua
-- client/main.lua
-- ↓ tells the server "I want to buy bread, qty 2"
TriggerServerEvent('shop:buy', 'bread', 2)
```

```lua
-- server/main.lua
-- ↓ register the handler so the server actually receives the event
RegisterNetEvent('shop:buy', function(item, qty)
    local src = source                  -- always cache source FIRST
    -- validate inputs, do the buy, etc.
end)
```

### 2. Server fires, one specific client handles

```lua
-- server/main.lua
-- ↓ send to ONE player only, identified by their server ID
TriggerClientEvent('hud:showNotify', targetId, 'Money received')
```

```lua
-- client/main.lua
-- ↓ register on the receiving side
RegisterNetEvent('hud:showNotify', function(msg)
    -- show the message in HUD
end)
```

### 3. Server fires, all clients handle

```lua
-- server/main.lua
-- ↓ "-1" as the target ID means "broadcast to every connected client"
TriggerClientEvent('server:announcement', -1, 'Restart in 5 minutes')
```

```lua
-- client/main.lua
-- ↓ same handler, every player's client runs this when the broadcast fires
RegisterNetEvent('server:announcement', function(msg)
    -- show announcement
end)
```

### 4. Server fires, only a subset of clients handle

Loop, filter, send to each:

```lua
-- server/main.lua
-- get every connected player's server ID, send only to cops
for _, pid in ipairs(GetPlayers()) do                   -- GetPlayers() returns string IDs
    local id = tonumber(pid)                            -- convert string to number
    local player = exports.qbx_core:GetPlayer(id)       -- get the Qbox player
    if player and player.PlayerData.job.name == 'police' then
        TriggerClientEvent('police:alert', id, location)  -- send to this cop only
    end
end
```

---

## `RegisterNetEvent` vs `AddEventHandler`

For net events, the receiving side needs **both** the registration AND the handler. There are two equivalent ways to write it:

```lua
-- option A (modern, one call): registers and adds the handler in one step
RegisterNetEvent('shop:buy', function(item, qty)
    local src = source
    -- ...
end)

-- option B (old style, still valid): two calls
RegisterNetEvent('shop:buy')                            -- 1) register the name as net-allowed
AddEventHandler('shop:buy', function(item, qty)         -- 2) add the handler
    local src = source
    -- ...
end)
```

Both work. Modern code uses option A.

**Crucial security detail:** if you only call `AddEventHandler('shop:buy', ...)` **without** `RegisterNetEvent`, clients can NOT trigger this event remotely. The server refuses to route network messages to unregistered events. This is a **feature**, not a bug - it's how you make events server-internal-only.

So the rule: only call `RegisterNetEvent` for events that **actually need to be triggered from the other side**. Server-internal logic = local event, no `RegisterNetEvent`.

---

## The `source` Variable

When a server net event handler runs, `source` is a magic global = the server ID of the player who fired it. **Always cache it on the first line:**

```lua
RegisterNetEvent('shop:buy', function(item)
    local src = source                  -- ← FIRST LINE, ALWAYS
    -- ↑ "source" can change if your handler does another event call or yields.
    -- "src" is a local - it never changes. Use src for the rest of the function.
end)
```

If you forget this and call another event mid-function, `source` may be `nil` or some other player's ID. Bugs that take hours to find. Just always cache.

---

## What You Can Pass As Arguments

Net events can carry: `numbers`, `strings`, `booleans`, `tables` (nested OK), `nil`. **No functions, no userdata.**

There's a **rough size limit ~100KB per event payload** (FiveM's network buffer).

```lua
-- complex nested table - works fine
TriggerServerEvent('inventory:bulkUpdate', {
    add = { bread = 5, water = 2 },
    remove = { bandage = 1 },
    note = 'shopping trip',
})
```

If you need to send something bigger (huge data dump, initial world state), use **latent events** (covered below).

---

## Security - A Reminder, Then The Deep Dive

**Every `RegisterNetEvent` is a public API.** Players can open their console and do:

```lua
-- a player from their F8 console
TriggerServerEvent('shop:buy', 'super_rare_item', 999999)
```

If your handler doesn't validate `item` (whitelist) and `qty` (range check), they get 999,999 free items.

Validation rules - types, ranges, whitelists, distance checks, locks, atomic DB ops - all live in the next file: [`03-event-security.md`](03-event-security.md). Read it. Twice.

---

## Common Trigger Functions Cheat Sheet

```lua
-- client → server (from client side)
TriggerServerEvent(eventName, ...)

-- server → one client (from server side)
TriggerClientEvent(eventName, playerId, ...)

-- server → all clients (-1 means everyone)
TriggerClientEvent(eventName, -1, ...)

-- same-side only (NOT networked)
TriggerEvent(eventName, ...)
```

**`TriggerEvent` does NOT cross the network.** Most common newbie mistake: call `TriggerEvent` on the server, expect the client to receive it. Does nothing - the client is on a different side. Use `TriggerClientEvent` from the server.

---

## Latent Events (For Big Data)

If you need to send a payload bigger than ~100KB, or your client is on a slow connection, use **latent events** - they spread the data over multiple packets:

```lua
-- server side: stream a huge table to one player at 50 KB/sec
TriggerLatentClientEvent('bigData:sync', targetId, 50000, hugeTable)
-- ↑ 50000 = bytes-per-second rate limit
```

Use case: initial state dump on player join. **Don't use latent for per-frame updates** - they're for one-shot big sends.

There's a server equivalent: `TriggerLatentServerEvent`.

---

## Event Chain Example

Player presses E near a shop ped. Full chain:

```
1. CLIENT: keypress detected
   → TriggerServerEvent('shop:tryBuy', 'bread')

2. SERVER: RegisterNetEvent('shop:tryBuy', ...) runs
   → validate (next lesson)
   → deduct money, add item
   → TriggerClientEvent('shop:bought', src, 'bread')   (notify the buyer)
   → TriggerClientEvent('hud:moneyUpdate', src, newAmount)

3. CLIENT: handlers fire
   → RegisterNetEvent('shop:bought', ...) → lib.notify('got bread')
   → RegisterNetEvent('hud:moneyUpdate', ...) → update NUI
```

Three events, three round-trips of code. Each step is **one-way, no return value**. If you need a return value, use a **callback** (lesson 04).

---

## Pass NetworkIDs, Not Entity Handles

This trips people up. Entity handles (the numbers `CreateVehicle` returns) are **per-machine**. The server has its own number, each client has its own. They're not the same number.

So if you do:

```lua
-- WRONG
-- client side
local veh = GetVehiclePedIsIn(PlayerPedId(), false)        -- this is a CLIENT handle (e.g., 256)
TriggerServerEvent('impound', veh)                         -- server gets "256" - useless!
```

The server's "256" is some completely different entity (or nothing).

The **NetworkID** is stable across all machines. Use it instead:

```lua
-- RIGHT
-- client side
local veh = GetVehiclePedIsIn(PlayerPedId(), false)        -- client handle
local netId = NetworkGetNetworkIdFromEntity(veh)           -- convert to network ID (stable)
TriggerServerEvent('impound', netId)                       -- send the network ID

-- server side
RegisterNetEvent('impound', function(netId)
    local src = source
    local entity = NetworkGetEntityFromNetworkId(netId)    -- convert back to a server-local handle
    -- now server has a usable handle for that entity
end)
```

NetworkID = the same number on every machine. Always use it for cross-side entity references.

---

## Don't Fire Server-To-Self Or Client-To-Self As Net Events

```lua
-- BAD on server side
TriggerClientEvent('something', 0, ...)       -- player ID 0 = nobody, does nothing
TriggerServerEvent('my:event', ...)           -- this errors on the server side, no point

-- RIGHT: same-side communication = local event
TriggerEvent('my:event', ...)
```

If you're on the server and want server code to react, use `TriggerEvent` (local). Don't try to round-trip through the network for no reason.

---

## Performance - Don't Spam Net Events

Don't fire a net event every frame. The network gets hammered. The server tick budget gets eaten.

**BAD:**
```lua
-- client side
CreateThread(function()
    while true do
        Wait(0)                                                 -- every frame, ~60 fps
        TriggerServerEvent('pos:update', GetEntityCoords(PlayerPedId()))
    end
end)
```

That's 60 server-bound packets per second per player. With 64 players, 3,840 packets per second just for "where am I" - and FiveM **already syncs positions** via OneSync. You're reinventing the wheel poorly.

**Rule: fire net events on real state changes, not on a timer.**

If you genuinely need periodic, fire every 500ms+ at minimum, and consider [state bags](https://docs.fivem.net/docs/scripting-manual/networking/state-bags/) for continuous data.

---

## Naming Convention

```
resource:side:action
```

Examples:
- `myarmory:server:requestGun`
- `myarmory:client:refreshUI`
- `shop:server:buy`

This makes events **grep-able**. Search the whole server folder for `myarmory:server:requestGun` → you find every fire and every listener.

---

## TL;DR

- `TriggerServerEvent(name, ...)` - client → server
- `TriggerClientEvent(name, playerId_or_-1, ...)` - server → client(s)
- `RegisterNetEvent(name, fn)` on the receiving side - always
- `local src = source` is the first line of every server handler
- Pass NetworkIDs, not entity handles, across the network
- Every net event is attack surface - validate everything (next lesson)
- Don't spam - fire on state change, not on a timer

---

## Sources

- [Triggering Events (overview)](https://docs.fivem.net/docs/scripting-manual/working-with-events/triggering-events/)
- [RegisterNetEvent](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/RegisterNetEvent/)
- [TriggerServerEvent](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/TriggerServerEvent/)
- [TriggerClientEvent](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/TriggerClientEvent/)
- [TriggerLatentClientEvent](https://docs.fivem.net/docs/scripting-manual/working-with-events/triggering-events/#triggering-client-events)
- [State Bags](https://docs.fivem.net/docs/scripting-manual/networking/state-bags/) - alternative for continuous sync

---

Next: [`03-event-security.md`](03-event-security.md)
