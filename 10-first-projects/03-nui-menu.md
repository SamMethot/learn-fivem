# 03. Project: NUI Menu

Build an HTML-based menu. Not ox_lib context, real NUI. Purpose: learn the Lua <-> NUI round trip, focus handling, and visibility pattern.

Scope: `/garage` command opens a list of vehicles. Click one = spawn. Close button + ESC.

Vanilla HTML/JS (no React). Once you nail this, upgrade to React with `07-nui/02-react-nui.md`.

## Folder

```
resources\[test]\my_garage\
├── fxmanifest.lua
├── client\main.lua
├── server\main.lua
└── html\
    ├── index.html
    ├── app.js
    └── style.css
```

## fxmanifest.lua

```lua
fx_version 'cerulean'
game 'gta5'
lua54 'yes'

shared_script '@ox_lib/init.lua'

client_script 'client/main.lua'
server_script 'server/main.lua'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/app.js',
    'html/style.css',
}
```

## html/index.html

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="style.css" />
</head>
<body>
    <div id="root" class="hidden">
        <div class="panel">
            <header>
                <h1>My Garage</h1>
                <button id="close-btn" title="Close">X</button>
            </header>
            <ul id="vehicle-list"></ul>
        </div>
    </div>
    <script src="app.js"></script>
</body>
</html>
```

## html/style.css

```css
html, body {
    margin: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    background: transparent;
    font-family: 'Segoe UI', sans-serif;
}

#root {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
}

.hidden {
    visibility: hidden;
}

.panel {
    background: rgba(20, 20, 25, 0.95);
    color: white;
    min-width: 400px;
    max-width: 600px;
    border-radius: 10px;
    padding: 20px 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 10px;
}

header h1 { margin: 0; font-size: 20px; }

#close-btn {
    background: transparent;
    color: white;
    border: 1px solid rgba(255,255,255,0.2);
    padding: 4px 10px;
    cursor: pointer;
    border-radius: 4px;
}
#close-btn:hover { background: rgba(255,255,255,0.1); }

#vehicle-list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 400px;
    overflow-y: auto;
}

#vehicle-list li {
    padding: 12px 14px;
    margin: 6px 0;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: background 0.15s;
}

#vehicle-list li:hover { background: rgba(255,255,255,0.08); }

#vehicle-list .plate {
    font-family: monospace;
    font-size: 13px;
    color: #aaa;
}
```

## html/app.js

```javascript
const root = document.getElementById('root');
const listEl = document.getElementById('vehicle-list');
const closeBtn = document.getElementById('close-btn');

async function fetchNui(callback, data) {
    try {
        const res = await fetch(`https://${GetParentResourceName()}/${callback}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {}),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        console.error('fetchNui failed:', callback, err);
        return null;
    }
}

function render(vehicles) {
    listEl.innerHTML = '';
    for (const v of vehicles) {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${v.label}</span>
            <span class="plate">${v.plate || ''}</span>
        `;
        li.addEventListener('click', () => {
            fetchNui('spawn', { model: v.model });
        });
        listEl.appendChild(li);
    }
}

window.addEventListener('message', (e) => {
    const { action, payload } = e.data;
    if (action === 'open') {
        render(payload.vehicles || []);
        root.classList.remove('hidden');
    } else if (action === 'close') {
        root.classList.add('hidden');
    }
});

closeBtn.addEventListener('click', () => fetchNui('close'));

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fetchNui('close');
});
```

## client/main.lua

```lua
local isOpen = false
local spawnedVeh

local function closeUI()
    isOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

local function openUI()
    if isOpen then return end

    -- ask server for the garage
    local vehicles = lib.callback.await('my_garage:getVehicles', false)
    if not vehicles or #vehicles == 0 then
        lib.notify({
            id = 'garage_empty',        -- [optional] dedupe if player spams the command
            title = 'Garage',           -- [required*] need title OR description
            description = 'No vehicles stored',
            type = 'inform',            -- [optional] neutral blue style
            icon = 'warehouse',         -- [optional]
            iconColor = '#8ecae6',      -- [optional] soft blue
        })
        return
    end

    isOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'open', payload = { vehicles = vehicles } })
end

RegisterCommand('garage', function()
    openUI()
end, false)

RegisterNUICallback('close', function(_, cb)
    closeUI()
    cb('ok')
end)

RegisterNUICallback('spawn', function(data, cb)
    closeUI()

    if type(data.model) ~= 'string' then cb('err'); return end

    local model = joaat(data.model)
    RequestModel(model)
    local tries = 0
    while not HasModelLoaded(model) and tries < 100 do
        Wait(50)
        tries = tries + 1
    end
    if not HasModelLoaded(model) then
        lib.notify({
            id = 'garage_model_fail',       -- [optional]
            title = 'Garage',               -- [required*]
            description = 'Failed to load model',
            type = 'error',                 -- [optional]
            icon = 'triangle-exclamation',  -- [optional]
            iconColor = '#e63946',          -- [optional]
            iconAnimation = 'shake',        -- [optional] errors get visual weight
        })
        cb('err'); return
    end

    local ped = PlayerPedId()
    local pos = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)

    if spawnedVeh and DoesEntityExist(spawnedVeh) then
        DeleteEntity(spawnedVeh)
    end

    spawnedVeh = CreateVehicle(model, pos.x + 3.0, pos.y, pos.z, heading, true, false)
    SetModelAsNoLongerNeeded(model)

    TaskWarpPedIntoVehicle(ped, spawnedVeh, -1)
    lib.notify({
        id = 'garage_spawn',            -- [optional]
        title = 'Garage',               -- [required*]
        description = 'Spawned ' .. data.model,
        type = 'success',               -- [optional]
        icon = 'car',                   -- [optional]
        iconColor = '#2a9d8f',          -- [optional]
        duration = 3500,                -- [optional] slightly longer so they read the model name
    })

    cb('ok')
end)

-- CRITICAL cleanup
AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
    if spawnedVeh and DoesEntityExist(spawnedVeh) then
        DeleteEntity(spawnedVeh)
    end
end)
```

## server/main.lua

```lua
-- hardcoded garage for demo. In real life, query DB per player.
local GARAGE = {
    { model = 'adder',    label = 'Truffade Adder', plate = 'ADDER1' },
    { model = 'zentorno', label = 'Pegassi Zentorno', plate = 'ZENT42' },
    { model = 'sultan',   label = 'Karin Sultan',   plate = 'FAST99' },
}

lib.callback.register('my_garage:getVehicles', function(src)
    -- TODO: in real impl, query MySQL players_vehicles WHERE citizenid = ?
    return GARAGE
end)
```

Real garage would query:
```lua
local rows = MySQL.query.await(
    'SELECT plate, vehicle FROM player_vehicles WHERE citizenid = ?',
    {cid}
)
```

## Test

1. Restart server or `ensure my_garage`
2. In game: `/garage`
3. Menu pops up with 3 vehicles
4. Click one. UI closes, vehicle spawns, you're in it.
5. ESC closes without spawning.

## Verify Gold-Standard Checklist

- [x] `background: transparent` on body
- [x] `visibility: hidden` class, not `display: none`
- [x] `fetchNui` with try/catch
- [x] `SetNuiFocus` on open, always on close
- [x] ESC key closes
- [x] `onResourceStop` cleanup (focus + entity)
- [x] Server validates callback arg (type check)

## Upgrade Paths

1. **React + Vite**: follow `07-nui/02-react-nui.md`. Convert `app.js` to `App.tsx`.
2. **Real DB garage**: query player's vehicles table, return only theirs.
3. **Store/retrieve vehicle**: track state with metadata/DB, only allow spawn if "stored".
4. **Categories**: tabs for Cars / Bikes / Planes.
5. **Search**: filter input filtering the list.

## TL;DR

- 4 files: manifest + client + server + HTML/CSS/JS
- Client command -> callback fetches list -> SendNUIMessage shows it
- UI click -> fetchNui -> RegisterNUICallback -> spawn vehicle
- `visibility: hidden`, ESC to close, onResourceStop cleanup, try/catch fetchNui
- Server side = data source of truth

## Sources

- FiveM NUI dev guide: https://docs.fivem.net/docs/scripting-manual/nui-development/
- SendNUIMessage: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/SendNUIMessage/
- RegisterNUICallback: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/RegisterNUICallback/
- ox_lib callbacks (source): https://github.com/communityox/ox_lib/tree/master/imports/callback
- ox_lib notify: https://coxdocs.dev/ox_lib/Modules/Interface/Client/notify

Back to: `INDEX.md`
