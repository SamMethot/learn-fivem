# 02. Net Events

Net events = cross-network. Client→server, server→client, server→all clients. This is how player actions reach your DB and how server state reaches player UI.

## The Four Patterns

### 1. Client fires, server handles

```lua
-- client
TriggerServerEvent('shop:buy', 'bread', 2)

-- server
RegisterNetEvent('shop:buy', function(item, qty)
    local src = source
    -- validate, process
end)
```

### 2. Server fires, one client handles

```lua
-- server
TriggerClientEvent('hud:showNotify', targetId, 'Money received')

-- client
RegisterNetEvent('hud:showNotify', function(msg)
    -- show it
end)
```

### 3. Server fires, all clients handle

```lua
-- server
TriggerClientEvent('server:announcement', -1, 'Restart in 5 min')

-- client (same as above, every player's client runs it)
RegisterNetEvent('server:announcement', function(msg)
    -- show it
end)
```

`-1` = broadcast. Every connected player.

### 4. Server fires, subset of clients

```lua
-- server
for _, pid in ipairs(GetPlayers()) do
    local player = exports.qbx_core:GetPlayer(tonumber(pid))
    if player and player.PlayerData.job.name == 'police' then
        TriggerClientEvent('police:alert', tonumber(pid), location)
    end
end
```

## RegisterNetEvent vs AddEventHandler

Net events need **both** registration AND handler:

```lua
-- option A (modern, one call)
RegisterNetEvent('shop:buy', function(item, qty)
    local src = source
    -- ...
end)

-- option B (old style, still valid)
RegisterNetEvent('shop:buy')
AddEventHandler('shop:buy', function(item, qty)
    local src = source
    -- ...
end)
```

Both work. Modern code uses option A.

**If you only `AddEventHandler` without `RegisterNetEvent`, clients cannot trigger it.** Server won't route network messages to unregistered events. This is a security feature.

## `source` Variable

Server net handler has magic global `source` = player that fired it. First line always:

```lua
RegisterNetEvent('shop:buy', function(item)
    local src = source      -- THIS FIRST
    -- rest of code uses src
end)
```

Why? If your handler does another event trigger or callback, `source` can get overwritten or nil-ed. `src` local is safe.

## Arguments

Can pass: numbers, strings, booleans, tables (serializable), nil. Total size limit ~100KB per event (FiveM limit).

```lua
TriggerServerEvent('inventory:bulkUpdate', {
    add = { bread = 5, water = 2 },
    remove = { bandage = 1 },
})
```

Tables work. Nested tables work. Mixed types work.

## Security Reminder

**Every `RegisterNetEvent` = attack surface**. A player can trigger ANY net event with ANY arguments. From their Lua console:

```
TriggerServerEvent('shop:buy', 'super_rare_item', 999999)
```

Your server-side handler must validate everything. Covered in `03-event-security.md`.

## Common Trigger Functions

```lua
-- client → server
TriggerServerEvent(eventName, ...)

-- server → one client
TriggerClientEvent(eventName, playerId, ...)

-- server → all clients
TriggerClientEvent(eventName, -1, ...)

-- same side only (local event)
TriggerEvent(eventName, ...)
```

**`TriggerEvent` does NOT cross network.** Common newbie mistake: call `TriggerEvent` on server and expect client to get it. Does nothing.

## Latent Events

For big data (>100KB or slow connection):

```lua
-- server
TriggerLatentClientEvent('bigData:sync', targetId, 50000, hugeTable)
-- 50000 = bytes/sec rate limit
```

Streams data over time instead of one packet. Use for initial state dumps, not per-frame updates.

## Event Chain Example

Player presses E near shop. Chain:

```
1. client: E detected, TriggerServerEvent('shop:tryBuy', 'bread')
2. server: RegisterNetEvent('shop:tryBuy', ...)
           validates, deducts money, adds item
           TriggerClientEvent('shop:bought', src, 'bread')
           TriggerClientEvent('hud:moneyUpdate', src, newAmount)
3. client: RegisterNetEvent('shop:bought', ...) -> lib.notify('got bread')
           RegisterNetEvent('hud:moneyUpdate', ...) -> update NUI
```

Each step is one-way. No return value. For return value = callback (file 04).

## Pass IDs Not Entities

Entity handles differ across client and server.

**Wrong**:
```lua
-- client
local veh = GetVehiclePedIsIn(PlayerPedId(), false)
TriggerServerEvent('impound', veh)   -- veh is a CLIENT handle. Useless on server.
```

**Right**:
```lua
-- client
local veh = GetVehiclePedIsIn(PlayerPedId(), false)
local netId = NetworkGetNetworkIdFromEntity(veh)
TriggerServerEvent('impound', netId)

-- server
RegisterNetEvent('impound', function(netId)
    local src = source
    local entity = NetworkGetEntityFromNetworkId(netId)
    -- now server has it
end)
```

NetworkID = stable across all machines. Use that.

## Don't Fire From Server To Self

```lua
-- BAD (server side)
TriggerClientEvent('something', 0, ...)   -- playerId 0 is nobody
TriggerServerEvent('my:event', ...)       -- does nothing server side
```

Server->server = use local event: `TriggerEvent('my:event', ...)`.

## Rate Consideration

Don't fire net events every frame. Network gets hammered.

**BAD**:
```lua
-- client
CreateThread(function()
    while true do
        Wait(0)
        TriggerServerEvent('pos:update', GetEntityCoords(PlayerPedId()))
    end
end)
```

FiveM already syncs positions. Don't re-invent.

Fire events on real state changes, not on a tick.

## Naming Convention

```
resource:side:action
```

Examples:
- `myarmory:server:requestGun`
- `myarmory:client:refreshUI`
- `shop:server:buy`

Makes grep-able. You know at a glance who fires and who handles.

## TL;DR

- `TriggerServerEvent` = client to server
- `TriggerClientEvent(name, id_or_-1, ...)` = server to client
- `RegisterNetEvent` on receiving side. Always.
- `local src = source` first line of server handler.
- Pass NetworkIDs not entity handles.
- Every net event is attack surface. Validate.

## Sources

- Triggering events: https://docs.fivem.net/docs/scripting-manual/working-with-events/triggering-events/
- RegisterNetEvent: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/RegisterNetEvent/
- TriggerServerEvent: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/TriggerServerEvent/
- TriggerClientEvent: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/TriggerClientEvent/

Next: `03-event-security.md`
