# 04. Callbacks

## Plain English

A **net event** is one-way - fire and forget, no return value. A **callback** is a request/response pair: client asks the server something, server answers, client gets the answer back.

Use a callback when:
- The client needs **data back** from the server (player's bank balance, list of vehicles, shop inventory)
- The client needs a **yes/no decision** before doing UI work (am I allowed to open this menu?)

If you've used HTTP, callbacks are like a `GET` request. Net events are like a `fire-and-forget POST`.

---

## ox_lib Callbacks (Modern, Use This)

`ox_lib` ships a callback module. It's promise-based, clean, and what almost every modern server uses.

### Server side - register the callback

```lua
-- name the callback, provide a function that takes (source, ...args) and returns the response
lib.callback.register('shop:canBuy', function(source, itemId, qty)
    local src = source                                      -- still cache source first
    if type(itemId) ~= 'string' then return false end       -- validate args (same rules as net events)
    if type(qty) ~= 'number' or qty < 1 then return false end

    local item = Config.Items[itemId]                       -- whitelist lookup
    if not item then return false end

    local player = exports.qbx_core:GetPlayer(src)
    if not player then return false end

    if player.PlayerData.money.cash < item.price * qty then
        return false, 'no_cash'                             -- you can return MULTIPLE values
    end

    return true                                              -- this is what the client receives
end)
```

Whatever you `return` is what arrives on the client. Multiple returns work.

### Client side - `await` (blocking, looks sequential)

```lua
-- ↓ "false" as the second arg = use default 5-second timeout. or pass ms to override.
local canBuy, reason = lib.callback.await('shop:canBuy', false, 'bread', 1)
if not canBuy then
    lib.notify({ title = 'Shop', description = reason or 'denied', type = 'error' })
    return
end
-- proceed with the buy UI
```

`lib.callback.await` blocks the calling **coroutine** (Lua's lightweight thread). The rest of the script keeps running - only the calling thread waits.

### Client side - non-blocking with a callback function

```lua
-- if you can't yield (some places don't allow it), pass a function as the third arg
lib.callback('shop:canBuy', false, function(canBuy, reason)
    if canBuy then
        -- success path
    else
        -- failure path
    end
end, 'bread', 1)
```

Same thing, but doesn't block.

---

## Server Calls Client Callback (Less Common)

You can also go server → client → server, asking a specific client for data:

```lua
-- client side: register the callback
lib.callback.register('client:getLocation', function()
    local coords = GetEntityCoords(PlayerPedId())
    return { x = coords.x, y = coords.y, z = coords.z }
end)
```

```lua
-- server side: ask a specific player
local loc = lib.callback.await('client:getLocation', targetPlayerId)
print(loc.x, loc.y, loc.z)
```

**Rare in practice.** The server can usually read entity state directly via `GetEntityCoords(GetPlayerPed(src))` without asking the client.

---

## Why Callbacks Beat Round-Trip Events

Imagine you only had net events. You'd write:

```lua
-- client: fire a question
TriggerServerEvent('shop:checkCash', 10)

-- server: send back an answer
TriggerClientEvent('shop:cashResult', src, true)

-- client: receive the answer somewhere... but where?
RegisterNetEvent('shop:cashResult', function(result)
    -- which shop request was this for? which menu?
end)
```

Problems:
- Can't tie the response to the specific request
- No way to wait inline
- Painful for chained checks

Callbacks fix all that:

```lua
local result = lib.callback.await('shop:checkCash', false, 10)
if result then
    -- ...
end
```

Linear, readable, the response is right there.

---

## Security Still Applies

`lib.callback.register` is a **net event under the hood**. Validate every argument exactly like you would for a `RegisterNetEvent`:

```lua
lib.callback.register('shop:buy', function(source, itemId, qty)
    local src = source
    if type(itemId) ~= 'string' then return false end
    if type(qty) ~= 'number' or qty < 1 or qty > 100 then return false end
    if not Config.Items[itemId] then return false end
    -- ... rest of the security checklist (job, distance, rate limit, lock, atomic)
end)
```

Don't skip validation just because it's a callback. Same attack surface.

---

## Timeout

Callbacks can fail. If the server doesn't answer within the timeout (default 5 seconds), `await` returns `nil`:

```lua
-- ↓ explicit 5000ms timeout
local result = lib.callback.await('shop:buy', 5000, 'bread', 1)
if result == nil then
    -- timeout. server may be lagging, or it's an exploit attempt that triggered a server crash.
    return
end
```

Bump the timeout if your callback does heavy DB work. Default 5s is usually plenty.

---

## Don't Nest Callbacks Heavily

Bad - "callback hell":

```lua
lib.callback('a', false, function(ra)
    lib.callback('b', false, function(rb)
        lib.callback('c', false, function(rc)
            -- what is even happening here
        end)
    end)
end)
```

Use `await` inside a thread instead - looks sequential:

```lua
CreateThread(function()
    local ra = lib.callback.await('a', false)
    local rb = lib.callback.await('b', false)
    local rc = lib.callback.await('c', false)
    -- much easier to reason about
end)
```

---

## Returning Multiple Values

```lua
-- server
lib.callback.register('getPlayerInfo', function(source)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    return player.PlayerData.money.cash,
           player.PlayerData.job.name,
           player.PlayerData.citizenid
end)

-- client
local cash, job, cid = lib.callback.await('getPlayerInfo', false)
```

---

## Returning A Table (Most Common)

```lua
-- server
lib.callback.register('getShopData', function(source)
    return {
        items = Config.Items,
        stock = currentStock,
        playerCash = getPlayerCash(source),
    }
end)

-- client
local data = lib.callback.await('getShopData', false)
print(data.items, data.stock, data.playerCash)
```

Tables are usually easier to extend than multi-returns.

---

## Legacy QBCore / Qbox Callbacks

You'll see this in older code:

```lua
QBCore.Functions.CreateCallback('my:cb', function(source, cb, arg1)
    cb(result)                                          -- "cb" is a function you call with the result
end)

QBCore.Functions.TriggerCallback('my:cb', function(result)
    -- use result
end, arg1)
```

Still works in any server with a QB bridge. **For new code, prefer `lib.callback`.** Cleaner API, same outcome.

---

## When NOT To Use Callbacks

- **Client doesn't need a reply** → use a regular net event. Cheaper.
- **Server is broadcasting to many clients** → use `TriggerClientEvent` with `-1`. Callbacks are 1:1 only.
- **The data is static and the same for every player** → put it in a `shared_script` config or use exports.

---

## Pattern: Validation Before Heavy UI Work

```lua
-- client side, on menu open
local canAccess = lib.callback.await('shop:canAccess', false)
if not canAccess then
    lib.notify({ description = 'No access', type = 'error' })
    return
end
openExpensiveMenu()
```

Ask the server "am I allowed?" before doing the expensive UI work. Server gates, client reacts. Don't even bother loading the menu if access is denied.

---

## TL;DR

- Callback = request/response. Net event = fire-and-forget.
- `lib.callback.register(name, fn)` server side.
- `lib.callback.await(name, timeoutOrFalse, ...)` client side, blocking.
- Same validation rules as net events.
- Use `await` in a thread for readable sequential code.
- Use callbacks when you need data back; use net events when you don't.

---

## Sources

- [ox_lib Callback (server)](https://coxdocs.dev/ox_lib/Modules/Callback/Lua/Server) and [Callback (client)](https://coxdocs.dev/ox_lib/Modules/Callback/Lua/Client) - official reference
- [ox_lib Callback source](https://github.com/communityox/ox_lib/tree/master/imports/callback) - read the implementation
- [Working With Events](https://docs.fivem.net/docs/scripting-manual/working-with-events/) - events overview

---

Next folder: [`03-natives/`](../03-natives/) - start with [`01-what-are-natives.md`](../03-natives/01-what-are-natives.md)
