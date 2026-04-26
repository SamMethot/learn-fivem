# 01. NUI Basics

## Plain English

**NUI** = "New UI". It's the HTML/JavaScript layer that gets rendered on top of GTA V via an embedded browser called CEF (Chromium Embedded Framework). Phones, menus, HUDs, shops, crafting screens - all NUI.

Think of NUI as **a small browser tab pinned over the game window**. Your client-side Lua talks to it by sending messages. The browser sends messages back via `fetch` (HTTP-style requests).

---

## Architecture

```
GTA V Screen
  └── Client Lua (your script)
         ├── SendNUIMessage(data)       ──► sends data to the browser
         └── SetNuiFocus(true, true)    ──► gives the cursor to the UI
  └── NUI Frame (HTML/JS in CEF)
         ├── window.addEventListener('message', fn)   ──► receives from Lua
         └── fetch('https://res-name/cb', ...)        ──► calls back to Lua
```

Two-way:
- **Lua → JS:** `SendNUIMessage(table)` on Lua side; `window.addEventListener('message', ...)` on JS side
- **JS → Lua:** `fetch('https://my_resource/callbackName')` on JS side; `RegisterNUICallback('callbackName', ...)` on Lua side

The client can also forward to the server via `TriggerServerEvent` - the server NEVER talks to NUI directly.

---

## Minimum Resource

```
my_ui/
├── fxmanifest.lua
├── client.lua
└── html/
    ├── index.html
    ├── script.js
    └── style.css
```

### `fxmanifest.lua`

```lua
fx_version 'cerulean'
game 'gta5'
lua54 'yes'

client_script 'client.lua'

ui_page 'html/index.html'                                       -- entry point HTML

files {                                                          -- everything the browser needs to fetch
    'html/index.html',
    'html/script.js',
    'html/style.css',
}
```

`ui_page` declares the main HTML file. `files{}` lists everything the browser is allowed to load. **Forget a file in `files{}` → 404 in the browser.**

### `html/index.html`

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

### `html/style.css`

```css
html, body {
    margin: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    background: transparent;    /* CRITICAL - without this, you get a black screen over the game */
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
    visibility: hidden;         /* NOT display:none - see "Golden Rules" below */
}
```

**`background: transparent` on body is mandatory.** Skip it → black screen forever.

**Use `visibility: hidden`** when the UI should be hidden, not `display: none` and not conditional rendering. Reason explained below.

### `html/script.js`

```javascript
// grab the app element on load
const app = document.getElementById('app');

// listen for messages from Lua
window.addEventListener('message', (event) => {
    const data = event.data;
    if (data.action === 'open') {
        app.classList.remove('hidden');
    } else if (data.action === 'close') {
        app.classList.add('hidden');
    }
});

// when the close button is clicked, send a callback to Lua
document.getElementById('close').addEventListener('click', () => {
    fetch(`https://${GetParentResourceName()}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
});
```

`GetParentResourceName()` is a global FiveM provides to the browser - returns your resource's name (e.g., `'my_ui'`). Use it in fetch URLs so the right resource handles the callback.

### `client.lua`

```lua
local isOpen = false                                            -- track UI state

RegisterCommand('myui', function()                              -- /myui opens the menu
    if isOpen then return end                                   -- already open, ignore
    isOpen = true
    SetNuiFocus(true, true)                                     -- (focusGrabbed, cursorVisible) - both true for clickable menus
    SendNUIMessage({ action = 'open' })                         -- tell the browser to show
end)

-- ↓ register what happens when the browser fetches /close
RegisterNUICallback('close', function(data, cb)
    isOpen = false
    SetNuiFocus(false, false)                                   -- give control back to the game
    SendNUIMessage({ action = 'close' })
    cb('ok')                                                    -- ALWAYS call cb() - the fetch hangs otherwise
end)

-- ↓ CRITICAL: cleanup on resource stop
AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)                                   -- release focus or player gets stuck
end)
```

`cb('ok')` is mandatory in every `RegisterNUICallback`. The browser's `fetch` is waiting for a response - if you skip `cb`, the request hangs forever.

---

## The Golden Rules

### 1. `visibility: hidden`, NOT conditional rendering

If you write your UI in React and do `{visible && <Menu />}`:

- When `visible = false`, the `<Menu />` component is **unmounted** - its `useEffect`s are gone, its message listeners are gone.
- Lua sends `SendNUIMessage({ action: 'open' })`.
- The handler that would set `visible = true` doesn't exist (it was inside the unmounted component).
- **Nothing happens. UI never shows.**

Instead:
- Always render the component.
- Hide with CSS: `visibility: hidden`.
- React listeners stay alive even when invisible.

```jsx
// BAD
{visible && <Menu />}

// GOOD
<Menu style={{ visibility: visible ? 'visible' : 'hidden' }} />
```

### 2. Always cleanup on `onResourceStop`

```lua
AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
end)
```

If you restart the resource while the UI is open, focus stays grabbed. **Player can't move until they manually `restart` the resource again from F8.** Pure rage. Always cleanup.

### 3. Wrap `fetchNui` in try/catch

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

CEF can hiccup. A thrown error in your fetch handler can kill the whole UI if uncaught.

### 4. Support ESC to close

```javascript
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        fetchNui('close');
    }
});
```

Players expect ESC to close menus. Don't make them hunt for the X button.

### 5. Disable game controls when UI is focused

When NUI grabs focus, some GTA controls still fire (movement, weapon attacks). Disable them while open:

```lua
CreateThread(function()
    while isOpen do
        DisableControlAction(0, 30, true)                       -- 30 = move L/R (A/D)
        DisableControlAction(0, 31, true)                       -- 31 = move F/B (W/S)
        DisableControlAction(0, 24, true)                       -- 24 = attack
        Wait(0)
    end
end)
```

---

## Sending Data Lua → UI

```lua
SendNUIMessage({
    action = 'open',
    payload = {
        name = 'Shop',
        items = {
            { id = 'bread', price = 10 },
            { id = 'water', price = 5 },
        },
    },
})
```

```javascript
window.addEventListener('message', (e) => {
    if (e.data.action === 'open') {
        renderShop(e.data.payload);
    }
});
```

The Lua table is serialized to JSON and arrives on the JS side as a regular object.

---

## Sending Data UI → Lua (Callbacks)

JS:
```javascript
await fetch(`https://${GetParentResourceName()}/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId: 'bread' }),
});
```

Lua:
```lua
RegisterNUICallback('buy', function(data, cb)
    -- data.itemId is 'bread'
    TriggerServerEvent('shop:buy', data.itemId)                 -- forward to server
    cb('ok')                                                    -- MANDATORY
end)
```

The Lua callback receives `data` as a table (parsed from the JSON body). `cb` is a function - call it with whatever response you want the JS side to receive.

---

## `SetNuiFocus` Flags

```lua
SetNuiFocus(hasFocus, hasCursor)
```

| Combo | Effect |
|-------|--------|
| `(true, true)` | UI captures input, cursor visible. Menus, shops. |
| `(true, false)` | UI captures input, no cursor. Rare. |
| `(false, false)` | Game has focus. Always use this on close. |

---

## Debugging NUI

- **In-game:** F8 console → `nui_devtools` (requires dev mode convar)
- **Remote:** open `chrome://inspect` in any Chromium browser while the game is running, you can see and inspect every NUI frame
- **`console.log`** works inside the dev tools

Enable dev tools in `server.cfg`:

```cfg
set nui_devtools_enabled 1
```

---

## Common Bugs

### Black screen when UI loads
`background: transparent` is missing on `body`. Check CSS.

### UI doesn't show data
Conditional render pattern (`{visible && <Menu />}`) - listeners unmount. Switch to `visibility: hidden`.

### Can't close UI / player can't move
`SetNuiFocus(false, false)` not called. Or you restarted the resource while UI was open without `onResourceStop` cleanup. F8 escape: type `restart your_resource` again.

### Clicks pass through to game
`SetNuiFocus(true, true)` not called. UI is shown but not focused.

### Cursor visible but clicks don't register
The UI element has `pointer-events: none` somewhere up the tree, OR the page isn't focused. Check CSS and call `SetNuiFocus(true, true)`.

---

## TL;DR

- `ui_page` + `files{}` in fxmanifest
- `SendNUIMessage` → JS, `RegisterNUICallback` → Lua
- `SetNuiFocus(true, true)` to open, `(false, false)` to close
- `visibility: hidden`, NOT `display: none` or conditional render
- ALWAYS `cb('ok')` in NUI callbacks, ALWAYS `onResourceStop` cleanup
- `background: transparent` on body or you get a black screen

---

## Sources

- [FiveM NUI Development Guide](https://docs.fivem.net/docs/scripting-manual/nui-development/)
- [SetNuiFocus](https://docs.fivem.net/natives/?_0x5B98AE30) - native reference
- [SendNUIMessage](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/SendNUIMessage/)
- [RegisterNUICallback](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/RegisterNUICallback/)
- [GetParentResourceName](https://docs.fivem.net/docs/scripting-reference/runtimes/javascript/functions/GetParentResourceName/) - JS-side global

---

Next: [`02-react-nui.md`](02-react-nui.md)
