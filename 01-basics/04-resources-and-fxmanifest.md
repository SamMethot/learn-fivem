# 04. Resources & fxmanifest

Everything in FiveM = a resource. A resource = a folder with `fxmanifest.lua`.

## Structure

Minimum resource:
```
my_resource/
  fxmanifest.lua
```

Typical resource:
```
my_resource/
  fxmanifest.lua
  shared/
    config.lua
  client/
    main.lua
    ui.lua
  server/
    main.lua
    database.lua
  web/
    build/
      index.html
      assets/
  locales/
    en.lua
```

## fxmanifest.lua Basics

```lua
fx_version 'cerulean'      -- fxmanifest API version. Always 'cerulean' now.
game 'gta5'                -- which game. gta5 for us.
lua54 'yes'                -- enable Lua 5.4. Do this, more features.

author 'You'
description 'My cool resource'
version '1.0.0'

client_script 'client/main.lua'
server_script 'server/main.lua'
shared_script 'shared/config.lua'
```

## Multiple Files

```lua
client_scripts {
    'client/main.lua',
    'client/ui.lua',
    'client/events.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',     -- @ prefix = file from another resource
    'server/main.lua',
    'server/database.lua',
}

shared_scripts {
    '@ox_lib/init.lua',           -- pull in ox_lib
    'shared/config.lua',
    'locales/*.lua',              -- glob: all .lua in folder
}
```

Load order = list order. `shared` loads before `client`/`server`. Put configs early.

## Dependencies

```lua
dependencies {
    'ox_lib',
    'ox_target',
    'oxmysql',
    'qbx_core',
}
```

Server refuses to start your resource if a dependency is missing. Prevents weird errors.

## NUI Page

```lua
ui_page 'web/build/index.html'

files {
    'web/build/index.html',
    'web/build/assets/*.js',
    'web/build/assets/*.css',
    'web/build/**/*',            -- ** = recursive glob
}
```

`files` = stuff served to client browser. Without listing, NUI can't fetch it.

## Data Files (GTA Meta)

For vehicles, weapons, ped models:
```lua
files {
    'data/vehicles.meta',
    'data/carcols.meta',
    'stream/**/*',
}

data_file 'VEHICLE_METADATA_FILE' 'data/vehicles.meta'
data_file 'CARCOLS_FILE' 'data/carcols.meta'
```

`stream/` folder = auto-streamed to clients. Models, textures, audio.

## Provides / Exports

```lua
provide 'mysql-async'       -- tell server you provide this virtual resource
```

Means: other scripts that depend on `mysql-async` will accept your resource instead.

Exports covered later.

## Real Example (Qbox Resource)

```lua
fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'Qbox'
description 'Qbox Core'
version '1.23.0'

shared_scripts {
    '@ox_lib/init.lua',
    'shared/main.lua',
    'config/*.lua',
}

client_scripts {
    'client/main.lua',
    'client/*.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
    'server/*.lua',
}

dependencies {
    'ox_lib',
    'oxmysql',
}
```

## Starting Resources

In `server.cfg`:
```
ensure ox_lib
ensure oxmysql
ensure qbx_core
ensure my_resource
```

`ensure` = start, restart if already running. Load order matters. Dependencies first.

## Resource Lifecycle

Events fire when resources start/stop:

```lua
AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    print('my resource started')
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    print('my resource stopped')
    -- cleanup: remove blips, close NUI, clear tables
end)
```

Always cleanup on stop. NUI focus stuck = user can't close it = rage.

## Folder Naming

```
resources/
  [libs]/            <- brackets = category, not loaded
    ox_lib/
    ox_target/
  [scripts]/
    [jobs]/
      my_police/
      my_mechanic/
    my_resource/
  noload/            <- disabled resources, ignored
    old_script/
```

Category folders `[name]` = visual grouping only. Server scans recursively. `noload` = just a convention (you can call the folder anything the server doesn't `ensure`).

## Best Practices

1. Resource name = lowercase + underscores: `my_shop`, `player_armory`
2. Use `shared_script '@ox_lib/init.lua'` to enable ox_lib everywhere
3. Put configs in `shared/` or `config/`, scripts in `client/` and `server/`
4. List `dependencies` = fail fast, clear error
5. On `onResourceStop`, cleanup NUI focus, blips, spawned entities
6. Don't name your resource same as an existing one
7. Don't put Lua files in `files{}` (they already load via `*_script`)

## Test A Resource

```
# in FiveM server console (F8 in-game also if admin)
start my_resource
stop my_resource
restart my_resource
refresh            # rescan resources/ folder for new ones
```

In game console:
```
/start my_resource
```
(if you have permission)

## TL;DR

- Resource = folder + fxmanifest.lua
- Declare scripts: `client_script`, `server_script`, `shared_script`
- `@other_resource/path` = borrow file from another resource
- `ui_page` + `files` = NUI
- `dependencies` = hard requirement
- Cleanup on `onResourceStop`

## Sources

- Resource manifest reference: https://docs.fivem.net/docs/scripting-reference/resource-manifest/resource-manifest/
- Intro to resources: https://docs.fivem.net/docs/scripting-manual/introduction/introduction-to-resources/

Next folder: `02-events/`
