# 01. NUI Basics

**NUI** = New UI. In-game browser overlay. HTML/CSS/JS (or React) rendered on top of GTA V via CEF (Chromium Embedded Framework). Used for menus, HUDs, phones, shops.

## Architecture

```
GTA V Screen
  └── Lua Client (your script)
         └── SendNUIMessage(data)       -> passes data to browser
         └── SetNuiFocus(true, true)    -> gives mouse to UI
  └── NUI Frame (HTML/JS in CEF)
         └── fetchNui('callback', data) -> calls back to Lua
         └── window.addEventListener('message', fn) -> receives from Lua
```

Client Lua pushes messages to UI. UI sends callbacks to Lua. Lua can trigger server if needed.

## Minimal Resource

```
my_ui/
├── fxmanifest.lua
├── client.lua
└── html/
    ├── index.html
    ├── script.js
    └── style.css
```

### fxmanifest.lua

```lua
fx_version 'cerulean'
game 'gta5'
lua54 'yes'

client_script 'client.lua'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/script.js',
    'html/style.css',
}
```

`ui_page` = main HTML file. `files` = assets the browser needs.

### html/index.html

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app" class="hidden">
        <h1>My UI</h1>
        <button id="close">Close</button>
    </div>
    <script src="script.js"></script>
</body>
</html>
```

### html/style.css

```css
html, body {
    margin: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    background: transparent;    /* critical */
}

#app {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px;
    border-radius: 8px;
}

.hidden {
    visibility: hidden;         /* NOT display:none */
}
```

**`background: transparent` on body**. Otherwise black screen forever.

**`visibility: hidden`** when closed, NOT `display:none`. Not conditional removal. Why: see below.

### html/script.js

```javascript
const app = document.getElementById('app');

window.addEventListener('message', (event) => {
    const data = event.data;
    if (data.action === 'open') {
        app.classList.remove('hidden');
    } else if (data.action === 'close') {
        app.classList.add('hidden');
    }
});

document.getElementById('close').addEventListener('click', () => {
    fetch(`https://${GetParentResourceName()}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
});
```

`GetParentResourceName()` = global FiveM provides = your resource name. Callbacks go to `https://<resource>/<callbackName>`.

### client.lua

```lua
local isOpen = false

RegisterCommand('myui', function()
    if isOpen then return end
    isOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'open' })
end)

RegisterNUICallback('close', function(data, cb)
    isOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
    cb('ok')
end)

-- CRITICAL cleanup
AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
end)
```

## Golden Rules

### 1. `visibility: hidden`, NOT conditional render

Conditional `{visible && <MyThing/>}` in React = when hidden, listeners unmount. Lua sends data, UI isn't listening yet, data lost.

Solution: UI always mounted. Hide with CSS only.

```jsx
// BAD
{visible && <Menu />}

// GOOD
<Menu style={{visibility: visible ? 'visible' : 'hidden'}} />
```

### 2. Always `onResourceStop` cleanup

```lua
AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
end)
```

If you restart resource while UI open without this, focus stuck. Player can't move until F8 `restart <resource>` again.

### 3. `fetchNui` with try/catch

```javascript
async function fetchNui(callback, data) {
    try {
        const res = await fetch(`https://${GetParentResourceName()}/${callback}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {}),
        });
        return await res.json();
    } catch (err) {
        console.error('fetchNui error:', err);
        return null;
    }
}
```

Error boundary around root React component too.

### 4. Escape key support

```javascript
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        fetchNui('close');
    }
});
```

Users expect ESC to close.

### 5. Disable FiveM keys when focused

When NUI has focus, some GTA controls still fire. In Lua, if you want to disable movement while UI open:

```lua
CreateThread(function()
    while isOpen do
        DisableControlAction(0, 30, true)    -- A/D move
        DisableControlAction(0, 31, true)    -- W/S move
        DisableControlAction(0, 24, true)    -- attack
        Wait(0)
    end
end)
```

## Sending Data Lua -> UI

```lua
SendNUIMessage({
    action = 'open',
    payload = {
        name = 'Shop',
        items = {
            { id = 'bread', price = 10 },
            { id = 'water', price = 5 },
        }
    }
})
```

```javascript
window.addEventListener('message', (e) => {
    if (e.data.action === 'open') {
        renderShop(e.data.payload);
    }
});
```

## UI -> Lua Callback

```javascript
await fetch(`https://${GetParentResourceName()}/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId: 'bread' }),
});
```

```lua
RegisterNUICallback('buy', function(data, cb)
    TriggerServerEvent('shop:buy', data.itemId)
    cb('ok')
end)
```

`cb` must be called. Otherwise fetch hangs on UI side.

## SetNuiFocus Flags

```lua
SetNuiFocus(hasFocus, hasCursor)
```

- `(true, true)` = cursor visible, can click. Use for menus.
- `(true, false)` = focus but no cursor. Rare.
- `(false, false)` = back to game. Use on close.

## Debug UI

- F8 console: `nui_devtools` (must be in dev convar mode)
- Chrome DevTools URL: `chrome://inspect` with CEF discoverable
- `console.log` works in devtools

Convar to enable:
```
set nui_devtools_enabled 1
```

## Common Bugs

### Black screen when UI loads
Body not `background: transparent`. Fix CSS.

### Can't close UI
`SetNuiFocus(false, false)` not called. Or resource restarted with focus. F8: `nui_focus false false`.

### UI doesn't show data
Conditional render pattern. Switch to `visibility: hidden`.

### Clicks pass through to game
`SetNuiFocus(true, true)` missing.

### Focus stuck after resource restart
`onResourceStop` cleanup missing.

## TL;DR

- fxmanifest: `ui_page`, `files`
- `SendNUIMessage` Lua -> UI
- `fetch` + `RegisterNUICallback` UI -> Lua
- `SetNuiFocus(true, true)` on open, `(false, false)` on close
- `visibility: hidden` NOT conditional render
- `onResourceStop` cleanup always
- `background: transparent` on body

## Sources

- FiveM NUI dev guide: https://docs.fivem.net/docs/scripting-manual/nui-development/
- SetNuiFocus: https://docs.fivem.net/natives/?_0x5B98AE30
- SendNUIMessage: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/SendNUIMessage/
- RegisterNUICallback: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/RegisterNUICallback/

Next: `02-react-nui.md`
