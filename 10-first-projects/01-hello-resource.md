# 01. Project: Hello Resource

First real resource. Goal: make `/hello` command that notifies the player server-side via ox_lib. Touches manifest, client, server, events, and notifications.

Time: 30 minutes. Build it from zero.

## Setup

```
resources/[test]/hello_world/
├── fxmanifest.lua
├── client.lua
└── server.lua
```

Create the folder. Don't use existing resources to avoid conflicts.

Add to `server.cfg`:
```
ensure hello_world
```
or 
```
ensure [test]
```

## fxmanifest.lua

```lua
fx_version 'cerulean' -- Best version
game 'gta5' -- The game itself
lua54 'yes' -- Best runtime version

author 'You'
description 'Hello world resource'
version '1.0.0'

shared_script '@ox_lib/init.lua'

client_script 'client.lua'
server_script 'server.lua'
```

## client.lua

```lua
-- Register chat command, fires server event
RegisterCommand('hello', function()
    TriggerServerEvent('hello:say') -- send to server, no data
end, false) -- false = not restricted, any player can use

-- Listen for server's reply
RegisterNetEvent('hello:notify', function(msg)
    lib.notify({
        id = 'hello_greeting',      -- [optional] dedupe key, prevents spam stacking
        title = 'Hello World',      -- [required*] header text (*need this OR description)
        description = msg,          -- [required*] body, supports markdown (*need this OR title)
        type = 'success',           -- [optional] default 'inform' (inform/error/success/warning)
        position = 'top-right',     -- [optional] default 'top-right'
        duration = 4000,            -- [optional] default 3000ms
        icon = 'hand-wave',         -- [optional] FontAwesome 6 name, no fa- prefix
        iconColor = '#ffb703',      -- [optional] default matches `type` color
    })
end)
```

### Notify Options

`lib.notify` takes an options table. Full list with necessity flags (from ox_lib docs):

**Required (pick at least one):**
- `title` - header text
- `description` - body, supports markdown

**Optional:**
- `id` - unique key, prevents duplicate spam on screen. Skip = every call shows a new notif
- `duration` - ms, default `3000`
- `showDuration` - show countdown bar, default `true`
- `position` - `top` / `top-right` / `top-left` / `bottom` / `bottom-right` / `bottom-left` / `center-right` / `center-left`, default `top-right`
- `type` - `inform` / `error` / `success` / `warning`, default `inform`
- `icon` - FontAwesome 6 icon name (no `fa-` prefix). Skip = default icon for the `type`
- `iconColor` - any valid CSS color. Skip = color matches `type`
- `iconAnimation` - `spin` / `spinPulse` / `spinReverse` / `pulse` / `beat` / `fade` / `beatFade` / `bounce` / `shake`
- `alignIcon` - `top` or `center`, default `center`
- `style` - React CSS object for custom styling
- `sound` - `{ bank?, set, name }` to play a game audio cue

### Bare Minimum

Smallest valid call:

```lua
lib.notify({ description = 'Saved' }) -- defaults: type=inform, position=top-right, duration=3000
```

### Common Production Shape

What you'll actually use 90% of the time:

```lua
lib.notify({
    id = 'unique_key',      -- always add, prevents spam
    title = 'Shop',         -- context header
    description = 'Bought bread',
    type = 'success',       -- pick one
    icon = 'check',         -- visual clarity
})
```

`id` looks optional but in practice it's the difference between one notif and twenty when an event fires in a loop.

## server.lua

```lua
RegisterNetEvent('hello:say', function()
    local src = source -- ALWAYS cache source, it drifts in async code
    local player = exports.qbx_core:GetPlayer(src) -- get player object
    local name = player and player.PlayerData.charinfo.firstname or 'Stranger' -- fallback if no framework data

    TriggerClientEvent('hello:notify', src, 'Hello ' .. name .. '!') -- send back to that player only
    print(('[hello] Player %d (%s) said hi'):format(src, name)) -- server log
end)
```

## Test

1. Start server (or `ensure hello_world` if already running)
2. In game: `/hello`
3. See ox_lib notification top-right with your character's first name
4. Server console prints the log line

## What You Just Did

- Created a valid FiveM resource manifest
- Wired a shared ox_lib dependency
- Registered a client command
- Fired server via `TriggerServerEvent`
- Fetched the player object via Qbox
- Fired client back via `TriggerClientEvent`
- Showed ox_lib notification
- Logged server-side

That's 80% of what every resource does.

## Add: Cooldown (Security Baby Step)

Players can spam `/hello` and flood console. Add server rate limit:

```lua
local cooldowns = {}

RegisterNetEvent('hello:say', function()
    local src = source
    local now = GetGameTimer()

    if cooldowns[src] and (now - cooldowns[src]) < 2000 then
        TriggerClientEvent('hello:notify', src, 'Slow down')
        return
    end
    cooldowns[src] = now

    local player = exports.qbx_core:GetPlayer(src)
    local name = player and player.PlayerData.charinfo.firstname or 'Stranger'
    TriggerClientEvent('hello:notify', src, 'Hello ' .. name .. '!')
end)

AddEventHandler('playerDropped', function()
    cooldowns[source] = nil
end)
```

2 second cooldown per player. Clear on disconnect to avoid memory leak.

## Add: Arguments

```lua
-- client.lua
RegisterCommand('hello', function(source, args)
    local target = args[1] or 'world'
    TriggerServerEvent('hello:say', target)
end, false)

-- server.lua
RegisterNetEvent('hello:say', function(target)
    local src = source
    if type(target) ~= 'string' then return end
    if #target > 32 then return end

    local player = exports.qbx_core:GetPlayer(src)
    local name = player and player.PlayerData.charinfo.firstname or 'Stranger'
    TriggerClientEvent('hello:notify', src, ('%s says hi to %s'):format(name, target))
end)
```

Validate every arg. `type` check + length cap. Every net event.

## Add: Admin-Only Command

```lua
-- server.lua
RegisterCommand('helloall', function(src)
    if src == 0 then
        -- console, allow
    elseif not IsPlayerAceAllowed(src, 'command.helloall') then
        return
    end

    for _, pid in ipairs(GetPlayers()) do
        TriggerClientEvent('hello:notify', tonumber(pid), 'Hello from admin!')
    end
end, true)
```

```
# in permissions.cfg
add_ace group.admin command.helloall allow
```

Any admin can `/helloall`. Others get nothing.

## Iterate

```
restart hello_world
```

Every code change. No hot reload for Lua on FiveM.

## Check resmon

```
resmon
```

`hello_world` should show ~0.00 ms. It's event-driven, no loops.

## Commit

```
git add resources/[test]/hello_world
git commit -m "Add hello_world test resource"
```

Adapt path to wherever test resources live on your server.

## What's Next

- Shop resource (`02-shop.md`): money, items, job check
- NUI menu (`03-nui-menu.md`): HTML UI opened via command

Those tie everything together.

## TL;DR

- Manifest declares client/server/ui
- Client fires server, server fires client, both via events
- Every net event: validate args, rate limit
- Use ox_lib notify, Qbox for player data
- `restart hello_world` to reload

## Sources

- ox_lib notify: https://coxdocs.dev/ox_lib/Modules/Interface/Client/notify
- RegisterCommand (Lua runtime): https://docs.fivem.net/docs/scripting-reference/runtimes/lua/
- RegisterNetEvent: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/RegisterNetEvent/
- Qbox player data: https://docs.qbox.re/
- FontAwesome 6 icons: https://fontawesome.com/icons

Next: `02-shop.md`
