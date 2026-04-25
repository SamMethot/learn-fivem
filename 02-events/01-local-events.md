# 01. Local Events

Events = how code inside FiveM talks to other code. Local events = same side only (client→client OR server→server). Not across network.

## Basic Use

```lua
-- anywhere
AddEventHandler('my:event', function(arg1, arg2)
    print('got event', arg1, arg2)
end)

-- elsewhere, same side
TriggerEvent('my:event', 'hello', 42)
```

Simple. Fire-and-forget. No return value. All handlers for that name run in order.

## Why Use Local Events

- Decouple code. File A fires, files B/C/D listen. A doesn't know who listens.
- Game lifecycle events (FiveM fires these automatically).
- Cross-resource same side communication without exports.

## FiveM Built-in Events

Server side:

```lua
AddEventHandler('playerJoining', function()
    local src = source
    print('joining:', GetPlayerName(src))
end)

AddEventHandler('playerDropped', function(reason)
    local src = source
    print('left:', GetPlayerName(src), reason)
end)

AddEventHandler('onResourceStart', function(name)
    if name == GetCurrentResourceName() then
        print('I started')
    end
end)

AddEventHandler('onResourceStop', function(name)
    if name == GetCurrentResourceName() then
        print('I stopped. Cleanup.')
    end
end)
```

Client side:

```lua
AddEventHandler('onClientResourceStart', function(name)
    if name == GetCurrentResourceName() then
        print('client started')
    end
end)

AddEventHandler('playerSpawned', function()
    print('I spawned')
end)

AddEventHandler('gameEventTriggered', function(name, args)
    if name == 'CEventNetworkPlayerEnteredVehicle' then
        -- args[1] = player, args[2] = vehicle netID
    end
end)
```

`gameEventTriggered` = gold mine. Replaces polling loops.

## Removing Handlers

```lua
local function myHandler() print('hi') end
AddEventHandler('my:event', myHandler)

-- later
RemoveEventHandler('my:event', myHandler)
```

Use when a handler should only react for a limited time.

## Naming Convention

Use `colons:like:this`:
```
playerLoaded
qb-inventory:server:addItem
myresource:client:refresh
myresource:shop:buy
```

Prefix with resource name. Colons separate scope. Not enforced but everyone does it.

## Event Arguments

Can pass anything serializable: numbers, strings, bools, tables, nil. No functions, no userdata.

```lua
TriggerEvent('config:loaded', {
    shop = { items = {'bread', 'water'} },
    version = 2,
})

AddEventHandler('config:loaded', function(data)
    print(data.version)
end)
```

## Multiple Handlers Same Event

Every handler runs. Order = order added.

```lua
AddEventHandler('player:dies', function() print('first') end)
AddEventHandler('player:dies', function() print('second') end)

TriggerEvent('player:dies')
-- prints: first, second
```

## Local vs Cross-Resource

Local events cross resource boundaries on same side:

```lua
-- resource A, server
TriggerEvent('shared:notify', 'hello')

-- resource B, server
AddEventHandler('shared:notify', function(msg)
    print('got:', msg)
end)
```

Works. Same side (both server), no network. Resource A fires, resource B handles.

But if A is client-side and B is server-side? **No**. Different sides = need net events (next file).

## Local Event Isn't Always Safe

Although local = no network, your own resource code can be misused if a handler doesn't validate:

```lua
-- BAD
AddEventHandler('admin:runCommand', function(cmd)
    ExecuteCommand(cmd)
end)
```

If any resource fires this, your server runs arbitrary commands. Don't expose destructive handlers as local events unless you verify caller.

But main rule: local events can't be fired by players (only your own Lua). So less risky than net events. Still, don't be lazy.

## When To Use Which

| Need | Use |
|------|-----|
| Same resource, same side | Direct function call or local event |
| Cross resource, same side | Local event OR exports |
| Cross side (client↔server) | Net event |
| Need return value | Callback (file 04) or export |

## Patterns

### Init signal
```lua
CreateThread(function()
    -- do setup
    TriggerEvent('myresource:ready')
end)

AddEventHandler('myresource:ready', function()
    -- other files react
end)
```

### Broadcast state change
```lua
local function updateMoney(newAmount)
    cachedMoney = newAmount
    TriggerEvent('hud:moneyChanged', newAmount)
end
```

## TL;DR

- `AddEventHandler` listens. `TriggerEvent` fires.
- Same side only.
- Multiple handlers stack, run in order.
- Args can be any serializable value.
- FiveM fires lots of built-in events. Use them.

## Sources

- AddEventHandler: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/AddEventHandler/
- TriggerEvent: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/TriggerEvent/
- Event system overview: https://docs.fivem.net/docs/scripting-manual/working-with-events/

Next: `02-net-events.md`
