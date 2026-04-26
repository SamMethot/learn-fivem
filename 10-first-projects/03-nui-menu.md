# 03. Project: NUI Menu

## Goal

Build an **HTML-based menu** (not an `ox_lib` context menu - actual NUI). Purpose: learn the Lua ↔ NUI round trip, focus handling, and the visibility pattern.

Scope: `/garage` opens a list of vehicles; clicking one spawns the car next to the player. Close button + ESC support.

This uses **vanilla HTML/JS** (no React) so the moving parts are obvious. Once you've got this working, upgrade to React with [`07-nui/02-react-nui.md`](../07-nui/02-react-nui.md).

---

## Folder

```
resources/[test]/my_garage/
├── fxmanifest.lua
├── client/main.lua
├── server/main.lua
└── html/
    ├── index.html
    ├── app.js
    └── style.css
```

---

## `fxmanifest.lua`

```lua
fx_version 'cerulean'
game 'gta5'
lua54 'yes'

shared_script '@ox_lib/init.lua'

client_script 'client/main.lua'
server_script 'server/main.lua'

ui_page 'html/index.html'                                       -- entry HTML

files {                                                          -- everything the browser is allowed to load
    'html/index.html',
    'html/app.js',
    'html/style.css',
}
```

---

## `html/index.html`

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="style.css" />
</head>
<body>
    <!-- root container starts hidden via the .hidden class -->
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

---

## `html/style.css`

```css
html, body {
    margin: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    background: transparent;            /* CRITICAL - without this, black screen over the game */
    font-family: 'Segoe UI', sans-serif;
}

#root {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);     /* semi-transparent overlay so the game dims behind the menu */
}

.hidden {
    visibility: hidden;                 /* NOT display:none - keep listeners alive */
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
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 4px 10px;
    cursor: pointer;
    border-radius: 4px;
}
#close-btn:hover { background: rgba(255, 255, 255, 0.1); }

#vehicle-list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 400px;
    overflow-y: auto;                   /* scroll if too many vehicles */
}

#vehicle-list li {
    padding: 12px 14px;
    margin: 6px 0;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: background 0.15s;
}

#vehicle-list li:hover { background: rgba(255, 255, 255, 0.08); }

#vehicle-list .plate {
    font-family: monospace;
    font-size: 13px;
    color: #aaa;
}
```

---

## `html/app.js`

```javascript
// grab DOM nodes once
const root = document.getElementById('root');
const listEl = document.getElementById('vehicle-list');
const closeBtn = document.getElementById('close-btn');

// helper: send a callback to Lua via fetch (with try/catch - CEF can hiccup)
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

// build the list of vehicles
function render(vehicles) {
    listEl.innerHTML = '';                                      // clear previous
    for (const v of vehicles) {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${v.label}</span>
            <span class="plate">${v.plate || ''}</span>
        `;
        // clicking a vehicle = ask Lua to spawn it
        li.addEventListener('click', () => {
            fetchNui('spawn', { model: v.model });
        });
        listEl.appendChild(li);
    }
}

// listen for messages from Lua
window.addEventListener('message', (e) => {
    const { action, payload } = e.data;
    if (action === 'open') {
        render(payload.vehicles || []);
        root.classList.remove('hidden');                        // show
    } else if (action === 'close') {
        root.classList.add('hidden');                           // hide
    }
});

// close button
closeBtn.addEventListener('click', () => fetchNui('close'));

// ESC closes
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fetchNui('close');
});
```

---

## `client/main.lua`

```lua
local isOpen = false                                            -- track UI state
local spawnedVeh                                                -- handle to last-spawned vehicle (for cleanup)

-- ↓ centralize close logic
local function closeUI()
    isOpen = false
    SetNuiFocus(false, false)                                   -- release focus to game
    SendNUIMessage({ action = 'close' })
end

-- ↓ centralize open logic
local function openUI()
    if isOpen then return end                                   -- already open

    -- ask the server for the player's vehicles
    local vehicles = lib.callback.await('my_garage:getVehicles', false)
    if not vehicles or #vehicles == 0 then
        lib.notify({
            id = 'garage_empty',
            title = 'Garage',
            description = 'No vehicles stored',
            type = 'inform',
            icon = 'warehouse',
            iconColor = '#8ecae6',
        })
        return
    end

    isOpen = true
    SetNuiFocus(true, true)                                     -- grab focus + cursor
    SendNUIMessage({ action = 'open', payload = { vehicles = vehicles } })
end

-- ↓ /garage opens the menu
RegisterCommand('garage', function()
    openUI()
end, false)

-- ↓ NUI sent "close" - release focus, hide UI
RegisterNUICallback('close', function(_, cb)
    closeUI()
    cb('ok')                                                    -- mandatory
end)

-- ↓ NUI sent "spawn" - spawn the chosen vehicle
RegisterNUICallback('spawn', function(data, cb)
    closeUI()                                                   -- close menu first

    -- validate the model arg
    if type(data.model) ~= 'string' then
        cb('err')
        return
    end

    -- ↓ load the model
    local model = joaat(data.model)                             -- compute hash from string at runtime
    RequestModel(model)

    -- ↓ wait for it to load (with a timeout to avoid infinite hang)
    local tries = 0
    while not HasModelLoaded(model) and tries < 100 do          -- max 5 seconds (100 × 50ms)
        Wait(50)
        tries = tries + 1
    end

    if not HasModelLoaded(model) then
        lib.notify({
            id = 'garage_model_fail',
            title = 'Garage',
            description = 'Failed to load model',
            type = 'error',
            icon = 'triangle-exclamation',
            iconColor = '#e63946',
            iconAnimation = 'shake',
        })
        cb('err')
        return
    end

    -- ↓ get the player's position to spawn next to them
    local ped = PlayerPedId()
    local pos = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)

    -- ↓ delete the previously-spawned vehicle if any (avoid stacking cars)
    if spawnedVeh and DoesEntityExist(spawnedVeh) then
        DeleteEntity(spawnedVeh)
    end

    -- ↓ spawn the vehicle 3 meters east of the player
    spawnedVeh = CreateVehicle(model, pos.x + 3.0, pos.y, pos.z, heading, true, false)
    SetModelAsNoLongerNeeded(model)                             -- release the streaming slot

    TaskWarpPedIntoVehicle(ped, spawnedVeh, -1)                 -- put the player in the driver seat

    lib.notify({
        id = 'garage_spawn',
        title = 'Garage',
        description = 'Spawned ' .. data.model,
        type = 'success',
        icon = 'car',
        iconColor = '#2a9d8f',
        duration = 3500,
    })

    cb('ok')
end)

-- ↓ CRITICAL: cleanup on resource stop (release focus + delete spawned vehicle)
AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
    if spawnedVeh and DoesEntityExist(spawnedVeh) then
        DeleteEntity(spawnedVeh)
    end
end)
```

---

## `server/main.lua`

```lua
-- ↓ hardcoded garage for the demo. In a real server, this would query the player's vehicles from MySQL.
local GARAGE = {
    { model = 'adder',    label = 'Truffade Adder',    plate = 'ADDER1' },
    { model = 'zentorno', label = 'Pegassi Zentorno',  plate = 'ZENT42' },
    { model = 'sultan',   label = 'Karin Sultan',      plate = 'FAST99' },
}

-- ↓ callback returns the list to the client
lib.callback.register('my_garage:getVehicles', function(src)
    -- TODO: in a real implementation, query the DB:
    -- local rows = MySQL.query.await('SELECT plate, vehicle FROM player_vehicles WHERE citizenid = ?', { cid })
    -- return rows
    return GARAGE
end)
```

In production, you'd query the player's actual vehicles:

```lua
local cid = exports.qbx_core:GetPlayer(src).PlayerData.citizenid
local rows = MySQL.query.await(
    'SELECT plate, vehicle FROM player_vehicles WHERE citizenid = ?',
    { cid }
)
return rows
```

---

## Test

1. Restart the server (or `ensure my_garage`)
2. In game: `/garage`
3. Menu pops up with 3 vehicles
4. Click one → UI closes, vehicle spawns next to you, you're in the driver seat
5. Press ESC mid-menu → UI closes without spawning

---

## Verify The "Gold Standard" Checklist

The 7 things every NUI resource should do (from [`07-nui/01-nui-basics.md`](../07-nui/01-nui-basics.md)):

- [x] `background: transparent` on body
- [x] `visibility: hidden` class, NOT `display: none` and NOT conditional render
- [x] `fetchNui` wrapped in try/catch
- [x] `SetNuiFocus(true, true)` on open, `(false, false)` on close
- [x] ESC key closes
- [x] `onResourceStop` cleanup (focus + spawned entities)
- [x] Server validates callback args (type check)

Passes.

---

## Upgrade Paths

Each is its own little project:

1. **React + Vite** - convert `app.js` to `App.tsx`. Follow [`07-nui/02-react-nui.md`](../07-nui/02-react-nui.md).
2. **Real DB-backed garage** - query `player_vehicles` for the logged-in player.
3. **Store/retrieve** - track if a vehicle is "stored" or "out". Only allow spawn if stored. On `/store`, mark it stored and delete the entity.
4. **Categories** - tabs for Cars / Bikes / Planes / Helis based on `GetVehicleClass`.
5. **Search** - input field that filters the list by label.

---

## TL;DR

- 4 files: manifest + client + server + HTML/CSS/JS
- Client command → callback fetches list → `SendNUIMessage` shows it
- UI click → `fetchNui` → `RegisterNUICallback` → spawn vehicle
- All 7 gold-standard practices: `visibility: hidden`, ESC, `onResourceStop` cleanup, try/catch, etc.
- Server is the source of truth for what vehicles exist

You've now built three resources that touch every major FiveM concept. Go build something real.

---

## Sources

- [FiveM NUI Development](https://docs.fivem.net/docs/scripting-manual/nui-development/)
- [SendNUIMessage](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/SendNUIMessage/)
- [RegisterNUICallback](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/RegisterNUICallback/)
- [ox_lib callbacks (source)](https://github.com/communityox/ox_lib/tree/master/imports/callback)
- [ox_lib notify](https://coxdocs.dev/ox_lib/Modules/Interface/Client/notify)
- [CreateVehicle native](https://docs.fivem.net/natives/?_0xAF35D0D2583051B0)
- [Vehicle Models reference](https://docs.fivem.net/docs/game-references/vehicle-models/)

---

**You're done with the course.** Back to [`INDEX.md`](../INDEX.md).

Build something. Break something. Read more code. The fastest way past the beginner phase is to ship a real resource - even a tiny one - and iterate it on a real server.
