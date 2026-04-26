# 02. React NUI

## Plain English

For real production NUI (phones, dashboards, multi-page menus), you don't write raw HTML/JS - you write **React** (or Svelte) and bundle it with **Vite**. You get components, state, hot reload during development, and a real ecosystem of UI libraries.

This lesson is React 19 + Vite + TypeScript. If you don't know React, the [official tutorial](https://react.dev/learn) is enough - come back here once you've got the basics.

---

## Why React + Vite

- **Components** - reuse UI pieces
- **State** clean (`useState`, context)
- **Vite hot reload** - iterate UI in a regular browser, no FiveM restart
- **TypeScript** - fewer bugs, better autocomplete
- **Ecosystem** - Tailwind, shadcn/ui, framer-motion all work

---

## Project Structure

A typical NUI resource:

```
my_resource/
├── fxmanifest.lua
├── client/main.lua
├── server/main.lua
└── web/                    # React app (Vite project, npm install here)
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    ├── src/
    │   ├── main.tsx        # entry point
    │   ├── App.tsx         # root component
    │   ├── providers/
    │   │   ├── VisibilityProvider.tsx
    │   │   └── ErrorBoundary.tsx
    │   ├── utils/
    │   │   └── fetchNui.ts # JS → Lua helper
    │   └── components/
    └── dist/               # build output, this is what fxmanifest points to
```

---

## `package.json`

```json
{
  "name": "my_resource_ui",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

Install: `cd web && npm install`.

---

## `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',                                                    // CRITICAL: relative paths so FiveM loads assets correctly
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,                                        // don't inline assets - keep them as separate files
    rollupOptions: {
      output: {
        // predictable filenames so fxmanifest globs match
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
```

`base: './'` is non-negotiable. Without it, your built HTML uses absolute paths like `/assets/index.js` which CEF can't resolve.

---

## `fxmanifest.lua`

```lua
fx_version 'cerulean'
game 'gta5'
lua54 'yes'

client_script 'client/main.lua'
server_script 'server/main.lua'

ui_page 'web/dist/index.html'                                   -- entry point inside the build folder

files {
    'web/dist/index.html',
    'web/dist/assets/*',                                         -- glob all built assets
}
```

---

## Build & Test Cycle

```bash
cd web
npm install         # one time
npm run build       # produces web/dist/
```

Then in the FiveM server console: `restart my_resource`. Connect, test.

For UI iteration without restarting FiveM, use Vite's dev server in parallel:
```bash
npm run dev
# opens http://localhost:5173 - iterate the UI in your browser with mocks
```

---

## `src/main.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ↓ React 19's createRoot. The "!" tells TS we're sure #root exists.
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
```

Make sure `index.html` has `<div id="root"></div>` in the body.

---

## `src/App.tsx`

```tsx
import { useEffect, useState } from 'react';
import { ErrorBoundary } from './providers/ErrorBoundary';
import { fetchNui } from './utils/fetchNui';

export default function App() {
    // ↓ visibility state (NEVER use this for conditional render - use it in style)
    const [visible, setVisible] = useState(false);
    const [items, setItems] = useState<Array<{id: string, price: number}>>([]);

    // ↓ listen for messages from Lua
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            const { action, payload } = e.data;
            if (action === 'open') {
                setItems(payload.items);
                setVisible(true);
            } else if (action === 'close') {
                setVisible(false);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    // ↓ ESC to close
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && visible) {
                fetchNui('close');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [visible]);

    return (
        <ErrorBoundary>
            <div
                className="app"
                // ↓ CRITICAL: use visibility, NOT conditional render
                style={{ visibility: visible ? 'visible' : 'hidden' }}
            >
                <h1>Shop</h1>
                <ul>
                    {items.map(item => (
                        <li key={item.id}>
                            {item.id} - ${item.price}
                            <button onClick={() => fetchNui('buy', { itemId: item.id })}>
                                Buy
                            </button>
                        </li>
                    ))}
                </ul>
                <button onClick={() => fetchNui('close')}>Close</button>
            </div>
        </ErrorBoundary>
    );
}
```

The `style={{ visibility: ... }}` line is non-negotiable. Conditional render `{visible && <Component />}` unmounts the message listener - Lua sends events into the void.

---

## `src/providers/ErrorBoundary.tsx`

```tsx
import { Component, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(err: Error) {
        console.error('NUI error:', err);                       // logs to CEF dev tools
    }

    render() {
        if (this.state.hasError) {
            return <div style={{color:'red'}}>UI crashed. F8: restart resource.</div>;
        }
        return this.props.children;
    }
}
```

**Mandatory.** A render error in one component shouldn't blank the entire UI. Wrap your root.

---

## `src/utils/fetchNui.ts`

```typescript
declare const GetParentResourceName: () => string;

// ↓ generic, typed wrapper around fetch with proper error handling
export async function fetchNui<T = unknown>(
    callback: string,
    data?: unknown
): Promise<T | null> {
    try {
        // ↓ fall back to a hardcoded name if running in a regular browser (Vite dev mode)
        const resourceName = (typeof GetParentResourceName !== 'undefined')
            ? GetParentResourceName()
            : 'my_resource';

        const res = await fetch(`https://${resourceName}/${callback}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data ?? {}),
        });

        if (!res.ok) return null;
        return await res.json() as T;
    } catch (err) {
        console.error('fetchNui failed:', callback, err);
        return null;
    }
}
```

The fallback resource name lets you run `npm run dev` and click around without `GetParentResourceName` blowing up.

---

## Dev With Mocks

In Vite dev mode, no Lua is around to send `SendNUIMessage`. Mock it:

```typescript
// in main.tsx or a dev-only file
if (import.meta.env.DEV) {
    setTimeout(() => {
        // simulate Lua sending an "open" message
        window.postMessage({
            action: 'open',
            payload: { items: [{ id: 'bread', price: 10 }] },
        });
    }, 500);
}
```

Now `npm run dev` shows your UI populated with fake data. Iterate fast.

---

## The Client Lua (Gold Standard)

```lua
local isOpen = false                                            -- track UI state

-- ↓ centralize "open" so you don't repeat the SendNUIMessage code
local function openUI(items)
    if isOpen then return end                                   -- already open
    isOpen = true
    SetNuiFocus(true, true)                                     -- grab focus + cursor
    SendNUIMessage({ action = 'open', payload = { items = items } })
end

-- ↓ centralize "close"
local function closeUI()
    isOpen = false
    SetNuiFocus(false, false)                                   -- release focus
    SendNUIMessage({ action = 'close' })
end

-- ↓ /shop opens with hardcoded items
RegisterCommand('shop', function()
    openUI({ { id = 'bread', price = 10 }, { id = 'water', price = 5 } })
end)

-- ↓ NUI sends "close" when user clicks X or hits ESC
RegisterNUICallback('close', function(_, cb)
    closeUI()
    cb('ok')
end)

-- ↓ NUI sends "buy" when user clicks an item
RegisterNUICallback('buy', function(data, cb)
    TriggerServerEvent('shop:buy', data.itemId)                 -- forward to server (server validates!)
    cb('ok')
end)

-- ↓ MANDATORY cleanup
AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)                                   -- release focus or player gets stuck
end)
```

---

## Build Flow

**Dev cycle:**
1. `npm run dev` - Vite dev server, iterate the UI in a browser
2. Use `import.meta.env.DEV` mocks to fake Lua messages
3. When ready: `npm run build`
4. In FiveM: `restart my_resource`

**Production:**
- Always commit `web/dist/` so other devs (and the server) don't need Node installed. Or document the build step in your README.

---

## Tailwind / UI Libs

Most modern NUIs use [Tailwind](https://tailwindcss.com/) for styling. Install:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Add the directives to your CSS:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Use Tailwind v3.4.x** - v4 uses OKLCH colors that CEF doesn't render correctly. v3 is the safe stop point.

---

## Performance In NUI

NUI is GPU/CPU work. For HUDs that show every frame:

- **Don't re-render every frame.** Update on event only.
- **Throttle Lua → NUI messages.** Send updates every 200ms max for HUDs.
- **Cleanup listeners on unmount.** Standard React hygiene.
- **Don't run animations / timers when the UI is hidden.** Gate with `if (!visible) return` inside `useEffect`.
- **Don't ship MB of unused JS.** Tree-shake. Inspect bundle size with `npm run build` (Vite reports it).

---

## Common Patterns Worth Stealing

When reading other public NUI resources, look for:

- A **`VisibilityProvider`** that exposes visible state via context, with `visibility: hidden` styling at the root
- A dedicated **`fetchNui.ts`** util (try/catch, typed responses)
- An **`ErrorBoundary`** wrapping the root component
- **`onResourceStop` cleanup** in client Lua

If a public resource is missing any of these - don't copy that part.

---

## TL;DR

- React 19 + Vite + TypeScript for production NUI
- `base: './'` in vite config (mandatory)
- `ui_page` points to `web/dist/index.html`
- ALWAYS: `visibility: hidden` (not conditional render), `ErrorBoundary`, try/catch `fetchNui`, `onResourceStop` cleanup
- Dev mocks via `import.meta.env.DEV` for localhost iteration
- `npm run build` before testing in-game

---

## Sources

- [FiveM NUI Development Guide](https://docs.fivem.net/docs/scripting-manual/nui-development/)
- [React docs](https://react.dev/) - official
- [React 19 release notes](https://react.dev/blog/2024/12/05/react-19) - what's new
- [Vite docs](https://vitejs.dev/)
- [TypeScript docs](https://www.typescriptlang.org/docs/)
- [Tailwind CSS docs](https://tailwindcss.com/docs)

---

Next folder: [`08-security/`](../08-security/) - start with [`01-security-checklist.md`](../08-security/01-security-checklist.md)
