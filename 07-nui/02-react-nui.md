# 02. React NUI

Production NUI = React + Vite + TypeScript. Vanilla HTML only good for tiny UIs.

## Why React + Vite

- Component reuse
- State management clean
- Hot reload during dev (Vite)
- TypeScript = fewer bugs
- Ecosystem of UI libraries (Tailwind, shadcn, etc)

## Setup (Scaffold)

Typical structure:

```
my_resource/
├── fxmanifest.lua
├── client/main.lua
├── server/main.lua
└── web/                     # React app
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── providers/
    │   │   ├── VisibilityProvider.tsx
    │   │   └── ErrorBoundary.tsx
    │   ├── utils/
    │   │   └── fetchNui.ts
    │   └── components/
    └── dist/                # build output, shipped with resource
```

### package.json

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

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
```

`base: './'` = relative paths so FiveM loads assets.

### fxmanifest.lua

```lua
fx_version 'cerulean'
game 'gta5'
lua54 'yes'

client_script 'client/main.lua'
server_script 'server/main.lua'

ui_page 'web/dist/index.html'

files {
    'web/dist/index.html',
    'web/dist/assets/*',
}
```

Build happens in `web/`, output lands in `web/dist/`. Manifest points there.

### Build

```
cd web
npm install
npm run build
```

Then restart resource in game. `npm run dev` gives Vite dev server but you still play-test via build.

## src/main.tsx

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## src/App.tsx

```tsx
import { useEffect, useState } from 'react';
import { ErrorBoundary } from './providers/ErrorBoundary';
import { fetchNui } from './utils/fetchNui';

export default function App() {
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<Array<{id: string, price: number}>>([]);

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

Critical: `style={{ visibility: ... }}`. NOT `{visible && ...}`.

## src/providers/ErrorBoundary.tsx

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
    console.error('NUI error:', err);
  }

  render() {
    if (this.state.hasError) {
      return <div style={{color:'red'}}>UI crashed. F8: restart resource.</div>;
    }
    return this.props.children;
  }
}
```

Mandatory. One render error shouldn't kill the whole UI.

## src/utils/fetchNui.ts

```typescript
declare const GetParentResourceName: () => string;

export async function fetchNui<T = unknown>(
  callback: string,
  data?: unknown
): Promise<T | null> {
  try {
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

Try/catch = non-negotiable. Network in CEF can hiccup.

## Dev With Mocks

In browser (not game) `GetParentResourceName` doesn't exist. Fallback lets you run `npm run dev` + open localhost to iterate on UI without restarting resource.

Mock incoming messages:

```typescript
if (import.meta.env.DEV) {
  setTimeout(() => {
    window.postMessage({ action: 'open', payload: { items: [{id:'bread', price:10}] } });
  }, 500);
}
```

Makes dev fast.

## Client Lua (Gold Standard)

```lua
local isOpen = false
local ESC = 322

local function openUI(items)
    if isOpen then return end
    isOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'open', payload = { items = items } })
end

local function closeUI()
    isOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

RegisterCommand('shop', function()
    openUI({ { id='bread', price=10 }, { id='water', price=5 } })
end)

RegisterNUICallback('close', function(data, cb)
    closeUI()
    cb('ok')
end)

RegisterNUICallback('buy', function(data, cb)
    TriggerServerEvent('shop:buy', data.itemId)
    cb('ok')
end)

-- CRITICAL: cleanup on restart
AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
end)
```

## Build Flow

Dev:
1. `npm run dev` in `web/` = Vite at localhost
2. Iterate UI with mocks
3. When ready, `npm run build`
4. In game: `restart my_resource`

Prod:
- Always commit `web/dist/` so other devs don't need Node. Or document the build step.

## Tailwind / UI Libs

Most modern NUIs use Tailwind. Install:

```
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Tailwind config + imports in CSS file. Works out of the box with Vite.

## Performance

NUI adds GPU/CPU cost. For HUDs that show every frame:

- Don't re-render every frame. Update on event only.
- Throttle updates from Lua (send every 200ms max)
- Remove listeners on unmount
- Don't run background animations when UI hidden

## Common Patterns In The Wild

Good reference points when reading existing open-source NUIs:
- Resources that wrap everything in a `VisibilityProvider` context (state + `visibility:hidden` styling at the root)
- Resources with a dedicated `fetchNui.ts` util (try/catch, typed response)
- Resources with `onResourceStop` handler in client Lua clearing NUI focus

When reading someone else's code, verify the three: `visibility:hidden`, `ErrorBoundary`, `onResourceStop` cleanup. If any missing, don't copy that part.

## TL;DR

- React 19 + Vite + TS
- `base: './'` in vite config
- `ui_page` points to `web/dist/index.html`
- Always `visibility: hidden`, always ErrorBoundary, always try/catch fetchNui, always `onResourceStop` cleanup
- Dev mocks for localhost iteration
- `npm run build` before game test

## Sources

- FiveM NUI dev guide: https://docs.fivem.net/docs/scripting-manual/nui-development/
- React docs: https://react.dev/
- Vite docs: https://vitejs.dev/
- TypeScript: https://www.typescriptlang.org/docs/
- Tailwind CSS: https://tailwindcss.com/docs

Next folder: `08-security/`
