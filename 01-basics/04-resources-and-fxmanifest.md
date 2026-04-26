# 04. Resources & fxmanifest

## Plain English

In FiveM, **a resource is a folder with `fxmanifest.lua` inside it**. The manifest tells the server what's in the folder and how to load it.

When the server boots, it scans the `resources/` directory, reads every `fxmanifest.lua`, and starts the resources listed in `server.cfg` with `ensure <name>`. Restart server, all resources reload.

You'll write a manifest for every resource you make. They all follow the same shape.

---

## Minimum Resource

The smallest possible resource is a folder with one file:

```
my_resource/
└── fxmanifest.lua
```

That's a valid resource. It just doesn't do anything yet.

---

## Typical Resource Structure

What you'll actually build:

```
my_resource/
├── fxmanifest.lua          ← required
├── shared/
│   └── config.lua          ← runs on both sides (config tables)
├── client/
│   ├── main.lua            ← player-side code
│   └── ui.lua              ← extra client file
├── server/
│   ├── main.lua            ← server-side code
│   └── database.lua        ← extra server file
├── web/                    ← NUI source (React/HTML/JS)
│   └── build/              ← compiled NUI output
│       ├── index.html
│       └── assets/
└── locales/
    └── en.lua              ← translation file
```

Don't memorize this - adapt it per project. Smaller resources don't need every folder.

---

## fxmanifest.lua - Line By Line

The basic shape, every line annotated:

```lua
-- which version of the manifest API to use. "cerulean" is current standard, always use it.
fx_version 'cerulean'

-- which game this resource is for. for FiveM, it's always 'gta5'. (RedM uses 'rdr3')
game 'gta5'

-- enable Lua 5.4. this gives you backtick-hashes, integer division, and other modern features.
-- ALWAYS turn this on for new resources.
lua54 'yes'

-- metadata (optional but good to fill in)
author 'Your Name'                          -- whoever wrote this
description 'My cool resource'              -- one-line description
version '1.0.0'                             -- semver, bump when you ship changes

-- which files run on the player's PC
client_script 'client/main.lua'

-- which files run on the server
server_script 'server/main.lua'

-- which files run on BOTH sides (config tables, helper functions)
shared_script 'shared/config.lua'
```

---

## Multiple Files

Use the plural forms with a list of paths:

```lua
-- client_scripts (plural) takes a table of file paths
client_scripts {
    'client/main.lua',
    'client/ui.lua',
    'client/events.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',     -- @ prefix = pull a file from another resource
    'server/main.lua',
    'server/database.lua',
}

shared_scripts {
    '@ox_lib/init.lua',           -- imports ox_lib's "lib" global into your resource
    'shared/config.lua',
    'locales/*.lua',              -- glob: matches every .lua file in locales/
}
```

**Load order = list order.** `shared_scripts` always load before `client_scripts` and `server_scripts`. So put config files in `shared` near the top.

---

## The `@` Prefix

`'@otherresource/path/to/file.lua'` means "load this file from another resource into your resource's runtime". Common cases:

```lua
-- pulls in oxmysql's MySQL global. Lets you call MySQL.query, MySQL.update, etc.
'@oxmysql/lib/MySQL.lua'

-- pulls in ox_lib's lib global. Lets you call lib.notify, lib.callback, etc.
'@ox_lib/init.lua'
```

If you forget these, you'll see `attempt to index a nil value (global 'MySQL')` errors.

---

## Dependencies

Tell the server "these resources must already be running before mine starts":

```lua
-- if any of these aren't running, my resource refuses to start
dependencies {
    'ox_lib',
    'ox_target',
    'oxmysql',
    'qbx_core',
}
```

Why bother? Without dependencies, your resource might start before `oxmysql` is ready, and your DB calls error. With them, the server fails fast with a clear message instead.

For a single dependency, the singular form works:

```lua
dependency 'oxmysql'
```

---

## NUI (HTML UI)

If your resource has an HTML user interface:

```lua
-- the entry point HTML file the client will load
ui_page 'web/build/index.html'

-- list every file the browser needs access to
files {
    'web/build/index.html',
    'web/build/assets/*.js',     -- glob: all JS in assets/
    'web/build/assets/*.css',    -- glob: all CSS in assets/
    'web/build/**/*',            -- "**" = recursive glob, every file in subdirs too
}
```

**Files NOT listed in `files {}` are unreachable from the browser.** Forget to add a CSS file → 404, no styles. Forget an image → broken image icon.

Full NUI guide: [`07-nui/01-nui-basics.md`](../07-nui/01-nui-basics.md).

---

## Data Files (Vehicles, Weapons, Peds)

For custom GTA assets like vehicles or weapons:

```lua
-- list the data files so they ship with the resource
files {
    'data/vehicles.meta',
    'data/carcols.meta',
    'stream/**/*',               -- everything in the stream/ folder
}

-- declare what each meta file is, so the game knows how to load it
data_file 'VEHICLE_METADATA_FILE' 'data/vehicles.meta'
data_file 'CARCOLS_FILE' 'data/carcols.meta'
```

Anything inside a `stream/` subfolder gets **auto-streamed** to clients - they download it when they join. That's how custom cars and clothing work.

---

## Provides

Tells the server "I am a substitute for resource X":

```lua
-- if another resource depends on "mysql-async", they can use mine instead
provide 'mysql-async'
```

You'll rarely write this - it's mostly for compat shims (Qbox provides `qb-core`, oxmysql provides `mysql-async`).

---

## Real Example - A Qbox Core Resource

This is roughly what `qbx_core/fxmanifest.lua` looks like:

```lua
fx_version 'cerulean'                       -- modern manifest
game 'gta5'                                 -- FiveM only
lua54 'yes'                                 -- enable Lua 5.4

author 'Qbox'
description 'Qbox Core Framework'
version '1.23.0'

shared_scripts {
    '@ox_lib/init.lua',                     -- ox_lib globals available everywhere
    'shared/main.lua',                      -- main shared file (shared/main.lua loads first)
    'config/*.lua',                         -- glob: every config file
}

client_scripts {
    'client/main.lua',                      -- entry point
    'client/*.lua',                         -- everything else in client/
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',               -- DB wrapper
    'server/main.lua',                      -- entry point
    'server/*.lua',                         -- everything else
}

dependencies {
    'ox_lib',                               -- must have ox_lib
    'oxmysql',                              -- must have oxmysql
}
```

---

## Starting Resources

In `server.cfg`, you tell the server which resources to load:

```cfg
# "ensure" = start the resource. if it's already running, restart it.
ensure ox_lib                # libraries first
ensure oxmysql
ensure qbx_core              # framework before anything that depends on it
ensure ox_target
ensure ox_inventory
ensure my_resource           # YOUR resource last
```

**Load order matters.** Dependencies before dependents. If `my_resource` says `dependency 'qbx_core'`, then `qbx_core` must be `ensure`d first.

---

## Resource Lifecycle

Resources fire built-in events when they start and stop. Listen for them to do init/cleanup:

```lua
-- fires once for every resource that starts. check if it's YOU.
AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end    -- ignore other resources
    print('my resource started')
    -- do init: load DB tables, register targets, spawn shop peds
end)

-- fires once for every resource that stops. check if it's YOU.
AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    print('my resource stopped')
    -- CLEANUP: delete spawned entities, remove blips, release NUI focus
end)
```

**Always cleanup on `onResourceStop`.** Otherwise: ghost peds, stuck NUI focus, players raging because they can't move.

---

## Folder Naming Conventions

```
resources/
├── [libs]/                    ← brackets in folder names = visual category, not loaded
│   ├── ox_lib/
│   └── ox_target/
├── [scripts]/
│   ├── [jobs]/
│   │   ├── my_police/
│   │   └── my_mechanic/
│   └── my_resource/
└── noload/                    ← convention: disabled resources, server doesn't ensure them
    └── old_script/
```

**`[brackets]` = category folders.** They're not loaded as resources themselves - they're just for grouping. The server scans recursively and finds resources by their `fxmanifest.lua`.

**`noload/`** is a convention. Whatever folder isn't `ensure`d in `server.cfg` is disabled. Calling it `noload` is a common pattern, but the name is arbitrary.

---

## Best Practices

1. **Resource names**: lowercase + underscores. `my_shop`, `player_armory`. **No spaces, no hyphens, no special chars** - exports break.
2. **Use `shared_script '@ox_lib/init.lua'`** to enable `lib.*` everywhere.
3. **Configs in `shared/` or `config/`**. Scripts in `client/` and `server/`.
4. **Always declare `dependencies {}`** - fail-fast over weird load-order bugs.
5. **`onResourceStop` cleanup** - NUI focus, blips, spawned entities, threads.
6. **Don't name your resource the same as an existing one** - load order chaos.
7. **Don't put `.lua` files in `files {}`** - they already load via `*_script`. Listing them in `files{}` makes them downloadable to clients (a security issue).

---

## Test A Resource

In the server console (or in-game F8 console if you have admin):

```bash
start my_resource             # start a resource
stop my_resource              # stop it
restart my_resource           # stop then start. use this every time you change Lua.
refresh                       # rescan resources/ for newly-added folders
```

In-game chat works too if you have ACE permission:

```
/start my_resource
/restart my_resource
```

---

## TL;DR

- A resource = folder with `fxmanifest.lua`.
- Declare scripts via `client_script`, `server_script`, `shared_script`.
- `@otherresource/path` = pull a file from another resource.
- `ui_page` + `files{}` = NUI assets.
- `dependencies {}` = hard requirements.
- Always cleanup in `onResourceStop`.

---

## Sources

- [Resource Manifest Reference](https://docs.fivem.net/docs/scripting-reference/resource-manifest/resource-manifest/) - every field documented
- [Introduction to Resources](https://docs.fivem.net/docs/scripting-manual/introduction/introduction-to-resources/) - concepts
- [Server commands](https://docs.fivem.net/docs/server-manual/server-commands/) - `ensure`, `start`, `restart`

---

Next folder: [`02-events/`](../02-events/) - start with [`01-local-events.md`](../02-events/01-local-events.md)
