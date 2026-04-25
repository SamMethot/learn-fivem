# 01. What Is FiveM

## Short Version

FiveM = mod for GTA V that lets people run custom multiplayer servers. You keep base game, FiveM replaces GTA Online with your own stuff. Custom scripts, maps, vehicles, jobs, mechanics.

## Why FiveM Exists

GTA Online = Rockstar's thing. Closed. You can't add cops that actually arrest, can't add real jobs, can't roleplay. FiveM fixes that.

FiveM splits game into:
- **Base game** (GTA V on your disk). Graphics, physics, map.
- **Server layer** (FiveM runtime). Runs your custom scripts.

Server tells game what to do. Game renders it. Player sees it.

## Architecture

```
┌──────────┐      ┌──────────────┐
│  Player  │ ───► │ FiveM client │ ──► GTA V game
│  PC      │      │ + your .lua  │
└──────────┘      └──────────────┘
                         │
                         │ network
                         ▼
                  ┌──────────────┐
                  │ FiveM server │
                  │ + your .lua  │
                  │ + MySQL      │
                  └──────────────┘
```

Server runs 24/7. Clients join/leave. Each script has pieces on both sides.

## What You Actually Code

Three places:

1. **Client Lua**. Runs on player PC. Draws UI, reads input, calls game natives to spawn cars, plays sounds.
2. **Server Lua**. Runs on server. Authoritative. Owns money, inventory, DB. Validates everything client sends.
3. **NUI (HTML/JS/React)**. Player-facing UI rendered by embedded Chromium. Like a browser inside the game.

## Why Lua

FiveM picked Lua. Fast, simple, embeddable. You don't pick, you use it. Later folders teach it.

Server can also run JS/TS and C#. FiveM Lua = 99% of community code. Start there.

## Resources

Everything = a resource. Resource = folder with `fxmanifest.lua` + scripts. Server loads resources from `resources/` folder when `ensure resource_name` in `server.cfg`.

Examples:
- `qbx_core` = framework resource
- `ox_lib` = shared library resource
- `my_shop` = your custom shop resource
- `ox_inventory` = inventory resource

Folder covered later: `01-basics/04-resources-and-fxmanifest.md`.

## TL;DR

- FiveM = custom multiplayer GTA V
- You write Lua on client + server
- UI = HTML/React (NUI)
- Everything = a resource

## Sources

- FiveM docs (intro): https://docs.fivem.net/docs/
- Intro to resources: https://docs.fivem.net/docs/scripting-manual/introduction/introduction-to-resources/
- Scripting manual intro: https://docs.fivem.net/docs/scripting-manual/introduction/

Next: `02-lua-crash-course.md`
