# 01. Local Events

## Plain English

Events = how code in one part of FiveM tells other code "this thing happened, react if you care".

**Local events stay on the same side.** A client local event can only be heard by other client code. A server local event can only be heard by other server code. They don't cross the network.

If you've used JavaScript's `addEventListener` / `dispatchEvent`, this is almost the same idea - just for Lua, with FiveM-specific built-ins.

---

## The Two Functions

```lua
-- ADD a handler that listens for an event by name
AddEventHandler('my:event', function(arg1, arg2)
    print('got event', arg1, arg2)
end)

-- TRIGGER the event somewhere else (same side)
TriggerEvent('my:event', 'hello', 42)
-- ↑ this calls every handler registered for 'my:event' with args 'hello' and 42
```

That's it. Fire and forget. No return value. Every registered handler runs in registration order.

---

## Why Use Local Events?

Three big reasons:

1. **Decoupling.** File A fires an event. Files B, C, D listen. A doesn't need to know who listens. New listener? Just add a handler - no changes to A.
2. **Built-in lifecycle hooks.** FiveM fires events when players join, spawn, die, leave, enter vehicles, etc. Listen for them instead of polling.
3. **Cross-resource communication on the same side** - Resource A's server code can fire an event that Resource B's server code listens for. No network.

---

## FiveM's Built-In Events (Use These)

FiveM fires lots of events automatically. You just add handlers.

### Server-side built-ins

```lua
-- fires when a player is connecting (BEFORE they're fully in)
AddEventHandler('playerJoining', function()
    local src = source                              -- who is joining (server ID)
    print('player joining:', GetPlayerName(src))
end)

-- fires when a player disconnects, with the reason
AddEventHandler('playerDropped', function(reason)
    local src = source                              -- who left
    print('player left:', GetPlayerName(src), 'reason:', reason)
end)

-- fires for every resource that starts. check if it's yours.
AddEventHandler('onResourceStart', function(name)
    if name == GetCurrentResourceName() then        -- only react to YOUR resource starting
        print('my resource started - do init here')
    end
end)

-- fires for every resource that stops. cleanup goes here.
AddEventHandler('onResourceStop', function(name)
    if name == GetCurrentResourceName() then
        print('my resource stopped - do cleanup here')
    end
end)
```

### Client-side built-ins

```lua
-- fires when YOUR client's resource finishes loading
AddEventHandler('onClientResourceStart', function(name)
    if name == GetCurrentResourceName() then
        print('client resource started')
    end
end)

-- fires every time the player respawns
AddEventHandler('playerSpawned', function()
    print('I just spawned')
end)

-- fires for every "game event" - vehicle entered, ped damaged, etc.
-- THIS IS GOLD. Replaces polling for many things.
AddEventHandler('gameEventTriggered', function(name, args)
    if name == 'CEventNetworkPlayerEnteredVehicle' then
        local player = args[1]                      -- whoever entered (player ID)
        local vehNet = args[2]                      -- network ID of the vehicle
        -- react: log it, send notification, etc.
    end
end)
```

[Full list of game events](https://docs.fivem.net/docs/game-references/game-events/) - bookmark it.

---

## Removing Handlers

You can stop listening:

```lua
-- save the function as a named local so you can reference it later
local function myHandler()
    print('hi')
end

AddEventHandler('my:event', myHandler)              -- start listening

-- ... time passes ...

RemoveEventHandler('my:event', myHandler)           -- stop listening
```

You CAN'T remove an anonymous function - you need a named reference. Use this when a handler should only be active for a limited time (during a minigame, a tutorial, etc.).

---

## Naming Convention

Use **colons to separate scopes**:

```
playerLoaded                      ← FiveM built-in (just a single word)
qb-inventory:server:addItem       ← resource:side:action - common pattern
myresource:client:refresh
myresource:shop:buy
```

Why prefix with the resource name? **You can grep across the whole server folder** to find every fire and every listen of a given event. Naming chaos = debugging hell.

This isn't enforced by FiveM - but every modern resource follows the convention.

---

## Event Arguments

You can pass: `number`, `string`, `boolean`, `table`, `nil`. **No functions, no userdata.**

```lua
-- pass a complex table
TriggerEvent('config:loaded', {
    shop = { items = {'bread', 'water'} },
    version = 2,
})

-- receive it
AddEventHandler('config:loaded', function(data)
    print(data.version)                     -- 2
    print(data.shop.items[1])               -- "bread"
end)
```

Tables get serialized via msgpack under the hood. Complex nested data works fine.

---

## Multiple Handlers For The Same Event

Every registered handler runs, in the order they were added:

```lua
AddEventHandler('player:dies', function() print('first listener') end)
AddEventHandler('player:dies', function() print('second listener') end)

TriggerEvent('player:dies')
-- output:
-- first listener
-- second listener
```

This is intentional - multiple subsystems can react to the same event independently.

---

## Local Events Cross Resource Boundaries (Same Side)

Within the same side, local events freely cross resources:

```lua
-- in resource A, server-side
TriggerEvent('shared:notify', 'hello from A')

-- in resource B, server-side (totally separate folder)
AddEventHandler('shared:notify', function(msg)
    print('B received:', msg)               -- prints "B received: hello from A"
end)
```

**But:** if A is on the client and B is on the server, this does NOT work - that's a different side, you need a **net event** instead. Covered in the next lesson.

---

## Local Events Aren't Always "Safe"

Players can't fire local events directly (only your own Lua can). But if you write a handler that does something destructive based on input, **other resources' bugs can still hurt you**:

```lua
-- BAD: any resource on the server that fires this can run any command
AddEventHandler('admin:runCommand', function(cmd)
    ExecuteCommand(cmd)
end)
```

If a teammate's bug or a compromised resource fires `admin:runCommand`, your server runs arbitrary commands. Don't expose dangerous actions through events without verifying who's calling.

Net events are the bigger threat (any player can fire those), but local events still need some thought.

---

## Local Events vs Other Communication Tools

| Need | Use |
|------|-----|
| Same resource, same side | Just call the function directly |
| Cross-resource, same side | Local event OR an export |
| Cross-side (client ↔ server) | **Net event** (next file) |
| Need a return value | **Callback** (file 04) or export |

---

## Common Patterns

### Init signal

```lua
-- in your loader file
CreateThread(function()
    -- do all your setup
    -- ...
    TriggerEvent('myresource:ready')        -- announce when done
end)

-- elsewhere in the same resource
AddEventHandler('myresource:ready', function()
    -- everything is initialized, safe to do my thing
end)
```

### Broadcast a state change

```lua
local cachedMoney = 0

-- a function that updates state AND notifies everyone
local function updateMoney(newAmount)
    cachedMoney = newAmount
    TriggerEvent('hud:moneyChanged', newAmount)     -- HUD listens, updates display
end
```

This is the observer pattern - emit a fact, anyone interested reacts.

---

## TL;DR

- `AddEventHandler('name', fn)` listens.
- `TriggerEvent('name', ...)` fires.
- Same side only - client→client OR server→server.
- Multiple handlers for the same event all run, in order.
- Args are anything serializable: numbers, strings, booleans, tables.
- FiveM ships tons of built-in events - `playerJoining`, `playerDropped`, `gameEventTriggered`, etc. Use them instead of polling.

---

## Sources

- [AddEventHandler](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/AddEventHandler/)
- [TriggerEvent](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/TriggerEvent/)
- [RemoveEventHandler](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/RemoveEventHandler/)
- [Working With Events (overview)](https://docs.fivem.net/docs/scripting-manual/working-with-events/)
- [Game Events list](https://docs.fivem.net/docs/game-references/game-events/) - every event the engine fires
- [Resource Lifecycle Events](https://docs.fivem.net/docs/scripting-reference/events/list/) - onResourceStart, etc.

---

Next: [`02-net-events.md`](02-net-events.md)
