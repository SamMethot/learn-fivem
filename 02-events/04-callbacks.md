# 04. Callbacks

Net events = fire and forget, no return value. Callbacks = request + response. Client asks, server answers.

Use callback when client needs data back, or needs a yes/no decision.

## ox_lib Callbacks

`ox_lib` is the modern, promise-based callback library. Clean API, used across most servers.

### Server side: register

```lua
lib.callback.register('shop:canBuy', function(source, itemId, qty)
    local src = source     -- still applies
    if type(itemId) ~= 'string' then return false end
    if type(qty) ~= 'number' or qty < 1 then return false end

    local item = Config.Items[itemId]
    if not item then return false end

    local player = exports.qbx_core:GetPlayer(src)
    if not player then return false end

    if player.PlayerData.money.cash < item.price * qty then
        return false, 'no_cash'
    end

    return true
end)
```

Return value = what client gets back.

### Client side: await

```lua
local canBuy, reason = lib.callback.await('shop:canBuy', false, 'bread', 1)
if not canBuy then
    lib.notify({ title = 'Shop', description = reason or 'denied', type = 'error' })
    return
end
-- proceed
```

`lib.callback.await` blocks the calling coroutine until server answers. Timeout default 5s.

Second arg = timeout (`false` = default, or pass ms).

### Client side: async with callback fn

```lua
lib.callback('shop:canBuy', false, function(canBuy, reason)
    if canBuy then
        -- success
    end
end, 'bread', 1)
```

Same thing but doesn't block. Use inside UI handlers.

## Server Calls Client Callback

Less common but exists:

```lua
-- client
lib.callback.register('client:getLocation', function()
    local coords = GetEntityCoords(PlayerPedId())
    return { x = coords.x, y = coords.y, z = coords.z }
end)

-- server
local loc = lib.callback.await('client:getLocation', targetPlayerId)
print(loc.x, loc.y, loc.z)
```

Rare. Usually server can derive from `GetEntityCoords(GetPlayerPed(src))` without asking.

## Why Callbacks Over Events

Event pattern (bad for this case):
```lua
-- client asks
TriggerServerEvent('shop:checkCash', 10)

-- server replies
TriggerClientEvent('shop:cashResult', src, true)

-- client handles
RegisterNetEvent('shop:cashResult', function(result)
    -- use result...but which shop? Which request?
end)
```

Problems:
- Can't tie response to specific request
- Ugly when you need value inline
- Hard to cascade multiple checks

Callback:
```lua
local result = lib.callback.await('shop:checkCash', false, 10)
if result then ... end
```

Clean. Linear. Readable.

## Security Still Applies

Callback arg validation = same as net events:

```lua
lib.callback.register('shop:buy', function(source, itemId, qty)
    local src = source
    if type(itemId) ~= 'string' then return false end
    if type(qty) ~= 'number' or qty < 1 or qty > 100 then return false end
    if not Config.Items[itemId] then return false end
    -- ...rest of checklist
end)
```

`lib.callback.register` = net event under hood. Attackable.

## Timeout

If server doesn't answer in 5s, `lib.callback.await` returns nil:

```lua
local result = lib.callback.await('shop:buy', 5000, 'bread', 1)
if result == nil then
    -- timeout. Network? Server lag? Exploit?
    return
end
```

Default 5000ms usually fine. If your callback does slow DB work, bump it.

## Don't Nest Callbacks Heavily

```lua
-- yuck
lib.callback('a', false, function(ra)
    lib.callback('b', false, function(rb)
        lib.callback('c', false, function(rc)
            -- callback hell
        end)
    end)
end)
```

Use `.await` instead, looks sequential:

```lua
CreateThread(function()
    local ra = lib.callback.await('a', false)
    local rb = lib.callback.await('b', false)
    local rc = lib.callback.await('c', false)
end)
```

## Return Multiple Values

```lua
lib.callback.register('getPlayerInfo', function(source)
    local src = source
    local player = exports.qbx_core:GetPlayer(src)
    return player.PlayerData.money.cash,
           player.PlayerData.job.name,
           player.PlayerData.citizenid
end)

local cash, job, cid = lib.callback.await('getPlayerInfo', false)
```

## Return Tables

Most common:

```lua
lib.callback.register('getShopData', function(source)
    return {
        items = Config.Items,
        stock = currentStock,
        playerCash = getPlayerCash(source),
    }
end)

local data = lib.callback.await('getShopData', false)
print(data.items, data.stock, data.playerCash)
```

## QBCore / Qbox Callbacks (Legacy)

Old QB style:
```lua
QBCore.Functions.CreateCallback('my:cb', function(source, cb, arg1)
    cb(result)
end)

QBCore.Functions.TriggerCallback('my:cb', function(result)
    -- use result
end, arg1)
```

Still works if your server has a QB bridge. But **prefer ox_lib `lib.callback`** for new code. Cleaner, same result.

## When NOT To Use Callbacks

- Client doesn't need reply = use regular net event. Cheaper.
- Server notifies multiple clients = use broadcast event. Callbacks are 1:1.
- Data is static = just pass it via config (`shared_script`) or export.

## Pattern: Validation Before Heavy Action

```lua
-- client, on menu open
local canAccess = lib.callback.await('shop:canAccess', false)
if not canAccess then
    lib.notify({ description = 'No access', type = 'error' })
    return
end
openMenu()
```

Ask server "am I allowed?" before doing UI work. Server gates, client reacts.

## TL;DR

- Callback = request/response. Net event = fire and forget.
- `lib.callback.register(name, fn)` server side.
- `lib.callback.await(name, timeout, ...)` client side.
- Same validation rules as net events.
- Prefer callbacks over event round-trips when you need a return.
- Use `.await` for readable sequential code.

## Sources

- ox_lib callbacks (source): https://github.com/communityox/ox_lib/tree/master/imports/callback
- TriggerEvent vs TriggerServerEvent vs callbacks: https://docs.fivem.net/docs/scripting-manual/working-with-events/

Next folder: `03-natives/`
