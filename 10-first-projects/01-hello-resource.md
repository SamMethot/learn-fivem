# 01. Project: Hello Resource

## Goal

Build your first real resource. **`/hello` command** that sends a notification using the player's character name. Touches: fxmanifest, client, server, events, ox_lib notifications, and Qbox player data.

Time: ~30 minutes. Build it from zero.

---

## Setup

Create the folder:

```
resources/[test]/hello_world/
├── fxmanifest.lua
├── client.lua
└── server.lua
```

Use `[test]/` as a category so it doesn't conflict with anything else. Note `[test]` is just a folder grouping - not a resource itself.

In `server.cfg`:

```cfg
ensure hello_world
```

Or, if you have many test resources:

```cfg
ensure [test]
```

(That ensures every resource inside `[test]/`.)

---

## `fxmanifest.lua`

```lua
fx_version 'cerulean'                                           -- modern manifest API
game 'gta5'                                                     -- FiveM target
lua54 'yes'                                                     -- Lua 5.4 features

author 'You'                                                    -- metadata, optional
description 'Hello world resource'
version '1.0.0'

-- ↓ pull in ox_lib's "lib" global on both sides
shared_script '@ox_lib/init.lua'

client_script 'client.lua'
server_script 'server.lua'
```

---

## `client.lua`

```lua
-- ↓ register the /hello chat command (false at end = not restricted, anyone can use)
RegisterCommand('hello', function()
    TriggerServerEvent('hello:say')                             -- ask the server to do the work
end, false)

-- ↓ when the server replies, show a notification
RegisterNetEvent('hello:notify', function(msg)
    lib.notify({
        id = 'hello_greeting',                                  -- [optional] dedupe key, prevents spam stacking
        title = 'Hello World',                                  -- [required*] *need title OR description
        description = msg,                                      -- [required*]
        type = 'success',                                       -- [optional] inform/success/error/warning
        position = 'top-right',                                 -- [optional] default 'top-right'
        duration = 4000,                                        -- [optional] default 3000ms
        icon = 'hand-wave',                                     -- [optional] FontAwesome 6 icon name
        iconColor = '#ffb703',                                  -- [optional] color override
    })
end)
```

### Notify Field Reference

Quick recap of `lib.notify` options:

**Required (need at least one):**
- `title` - header text
- `description` - body text (supports markdown)

**Optional:**
- `id` - dedupe key. Same id within active duration replaces the existing notif instead of stacking. **Always set this** in production.
- `duration` - milliseconds. default `3000`.
- `showDuration` - show countdown bar. default `true`.
- `position` - `top` / `top-right` / `top-left` / `bottom` / `bottom-right` / `bottom-left` / `center-right` / `center-left`. default `top-right`.
- `type` - `inform` / `error` / `success` / `warning`. default `inform`.
- `icon` - FontAwesome 6 icon name (no `fa-` prefix needed).
- `iconColor` - any CSS color. default matches `type`.
- `iconAnimation` - `spin` / `spinPulse` / `spinReverse` / `pulse` / `beat` / `fade` / `beatFade` / `bounce` / `shake`.
- `alignIcon` - `top` or `center`. default `center`.
- `style` - React CSS object for full custom styling.
- `sound` - `{ bank?, set, name }` plays an in-game audio cue.

### Bare-minimum call

```lua
lib.notify({ description = 'Saved' })
-- defaults: type=inform, position=top-right, duration=3000
```

### Production-shape call (90% of the time)

```lua
lib.notify({
    id = 'unique_key',                                          -- always - prevents spam
    title = 'Shop',                                             -- gives context
    description = 'Bought bread',
    type = 'success',                                           -- pick one
    icon = 'check',                                             -- visual clarity
})
```

---

## `server.lua`

```lua
-- ↓ listen for the /hello command's server event
RegisterNetEvent('hello:say', function()
    local src = source                                          -- ALWAYS first line - cache the player who fired
    local player = exports.qbx_core:GetPlayer(src)              -- get Qbox player object

    -- ↓ "or 'Stranger'" gives a fallback if the framework isn't loaded for this player yet
    local name = player and player.PlayerData.charinfo.firstname or 'Stranger'

    TriggerClientEvent('hello:notify', src, 'Hello ' .. name .. '!')  -- send back to that player only

    -- ↓ log to the server console for debugging
    print(('[hello] Player %d (%s) said hi'):format(src, name))
end)
```

---

## Test It

1. Restart the server (or `ensure hello_world` in console)
2. In game: type `/hello` in chat
3. See an ox_lib notification top-right with your character's first name
4. Server console prints the log line

Done. You wrote a working FiveM resource.

---

## What You Just Did (In Plain English)

- Created a valid FiveM resource manifest
- Pulled in ox_lib for notifications
- Registered a client chat command
- Sent a server event from the client
- Looked up the player's character name on the server
- Sent a client event back with the message
- Showed a styled notification

That's roughly **80% of what every interactive resource does**. Variations are just bigger menus, more events, more data.

---

## Add A Cooldown (Security Baby Step)

Players can spam `/hello` and flood your console. Add a server-side rate limit:

```lua
local cooldowns = {}                                            -- src → last fire timestamp

RegisterNetEvent('hello:say', function()
    local src = source
    local now = GetGameTimer()                                  -- ms since server start

    -- ↓ if they fired within the last 2 seconds, reject
    if cooldowns[src] and (now - cooldowns[src]) < 2000 then
        TriggerClientEvent('hello:notify', src, 'Slow down')
        return
    end
    cooldowns[src] = now                                        -- update timestamp

    local player = exports.qbx_core:GetPlayer(src)
    local name = player and player.PlayerData.charinfo.firstname or 'Stranger'
    TriggerClientEvent('hello:notify', src, 'Hello ' .. name .. '!')
end)

-- ↓ memory leak protection: drop the entry when they leave
AddEventHandler('playerDropped', function()
    cooldowns[source] = nil
end)
```

Same pattern works for shops, drug deals, anything that shouldn't be spammed.

---

## Add Arguments (Validation Practice)

Let `/hello world` send "hi to world", `/hello sam` send "hi to sam":

```lua
-- client.lua
RegisterCommand('hello', function(source, args)                 -- args is an array of strings after the command
    local target = args[1] or 'world'                           -- first arg, or 'world' as default
    TriggerServerEvent('hello:say', target)
end, false)

-- server.lua
RegisterNetEvent('hello:say', function(target)
    local src = source

    -- ↓ ALWAYS validate every net event arg
    if type(target) ~= 'string' then return end                 -- type check
    if #target > 32 then return end                             -- length cap (no 10MB strings)

    local player = exports.qbx_core:GetPlayer(src)
    local name = player and player.PlayerData.charinfo.firstname or 'Stranger'
    TriggerClientEvent('hello:notify', src, ('%s says hi to %s'):format(name, target))
end)
```

`type` + length cap on every string arg from the client. Habit-forming.

---

## Add Admin-Only Variant

```lua
-- server.lua
-- ↓ "true" at the end = restricted, requires ACE permission to run
RegisterCommand('helloall', function(src)
    if src == 0 then
        -- src == 0 means the server console itself (not a player). Allow.
    elseif not IsPlayerAceAllowed(src, 'command.helloall') then
        return                                                  -- not allowed, bail
    end

    -- broadcast to everyone
    for _, pid in ipairs(GetPlayers()) do
        TriggerClientEvent('hello:notify', tonumber(pid), 'Hello from admin!')
    end
end, true)                                                      -- true = restricted to ACE
```

In `permissions.cfg`:

```cfg
add_ace group.admin command.helloall allow
```

Now any admin (anyone with `group.admin`) can run `/helloall`. Other players get nothing - the command silently rejects their attempt.

---

## Iterate

```
restart hello_world
```

Run after every Lua change. **No hot reload for Lua in FiveM.**

---

## Check `resmon`

```
resmon
```

`hello_world` should show **~0.00 ms**. There are no loops - everything is event-driven.

---

## Commit Your Work

```bash
cd resources/[test]/hello_world
git add .
git commit -m "Add hello_world test resource"
```

If your server uses one big monorepo, adapt the path. Either way: small, focused commits.

---

## What's Next

- [`02-shop.md`](02-shop.md) - full shop with money, inventory, security
- [`03-nui-menu.md`](03-nui-menu.md) - HTML UI menu opened from a command

---

## TL;DR

- fxmanifest declares resource files
- Client → `TriggerServerEvent`, server → `TriggerClientEvent`
- Always validate net event args
- `lib.notify` for notifications, `Qbox` for player data
- `restart resource_name` after every Lua change
- Add cooldowns and ACE permissions where needed

---

## Sources

- [ox_lib notify reference](https://coxdocs.dev/ox_lib/Modules/Interface/Client/notify)
- [RegisterCommand](https://docs.fivem.net/natives/?_0x5FA79B0F)
- [RegisterNetEvent](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/RegisterNetEvent/)
- [Qbox player data](https://docs.qbox.re/)
- [ACE permissions](https://docs.fivem.net/docs/server-manual/setting-up-a-server/#permissions)
- [FontAwesome 6 icons](https://fontawesome.com/icons)

---

Next: [`02-shop.md`](02-shop.md)
