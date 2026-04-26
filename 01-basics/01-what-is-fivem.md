# 01. What Is FiveM

## Plain English

FiveM is a **modification for GTA V** that lets people run their own multiplayer servers with custom rules, scripts, vehicles, jobs, and maps. You keep the base game (graphics, physics, the city of Los Santos), but instead of connecting to Rockstar's GTA Online servers, you connect to a community-run server.

If you've heard of "GTA RP", "NoPixel", or seen Twitch streamers playing as cops/criminals on a custom server - that's FiveM.

---

## Why FiveM Exists

GTA Online is closed. You can't:
- Add cops that actually arrest players
- Add real jobs (mechanic, pizza delivery, paramedic)
- Change the economy
- Run roleplay rules

FiveM solves that by splitting the game into two layers:

- **The base game** (GTA V on your hard drive) - graphics, physics, the city itself, the gameplay engine.
- **The server layer** (the FiveM runtime) - runs custom Lua/JS/C# scripts that tell the game what to do.

The server says "spawn this car here, give this player money, open this menu." The game renders it. The player sees it.

---

## Architecture

A simplified diagram of what's actually happening:

```
┌──────────────┐      ┌────────────────────┐
│   Player PC  │ ───► │  FiveM CLIENT      │ ──► GTA V game engine
│              │      │  + your client.lua │     (renders graphics)
└──────────────┘      └────────────────────┘
                              │
                              │ network (TCP/UDP)
                              ▼
                       ┌────────────────────┐
                       │  FiveM SERVER      │
                       │  + your server.lua │
                       │  + MySQL database  │
                       └────────────────────┘
```

The server runs 24/7. Clients connect when players join, disconnect when they leave. **Most of your scripts have a piece on each side** - client-side for what the player sees and does, server-side for the trusted source-of-truth (money, items, etc.).

---

## What You Actually Code

Three places code lives:

### 1. Client Lua
Runs on the **player's PC**. Has access to the GTA V game engine through "natives" (more on those later).

What it does:
- Draws UI on screen
- Reads keyboard/mouse input
- Spawns vehicles visually
- Plays sounds and animations
- **Sends events to the server** when something needs to be saved or validated

### 2. Server Lua
Runs on the **server machine**. Owns all the trusted state (money, inventory, jobs, who is in what gang).

What it does:
- Reads/writes the database
- Validates what clients send
- Decides if a player can do something
- **Sends events to one or more clients** to tell them what to display

### 3. NUI (HTML / JS / React)
Runs on the **player's PC inside an embedded Chromium browser**. This is your fancy menus, phones, HUDs, shops.

NUI talks to client Lua via messages. Client Lua talks to server Lua via events. That's the chain.

---

## Why Lua?

FiveM picked Lua as the main language because it's:
- **Small** - you can learn enough to read code in 30 minutes
- **Fast** - embedded into the game engine, low overhead
- **Easy to embed** - Rockstar already used it for some things, so the integration is smooth

You don't get a choice - if you want to write FiveM scripts, you write Lua. The server can also run JavaScript/TypeScript and C#, but **99% of community code is Lua**, so start there.

---

## What's a "Resource"?

**Everything in FiveM is a resource.**

A resource = a folder containing a file called `fxmanifest.lua` plus your scripts.

Example folder layout:

```
resources/
└── my_shop/
    ├── fxmanifest.lua         ← required, declares what this resource is
    ├── client/
    │   └── main.lua           ← runs on the player's PC
    ├── server/
    │   └── main.lua           ← runs on the server
    └── shared/
        └── config.lua         ← runs on both sides
```

The server loads a resource when it sees `ensure my_shop` in `server.cfg`. Stop the server, no resource. Start the server, all `ensure`d resources boot up.

Real-world resources you'll see:
- `qbx_core` - the Qbox framework itself
- `ox_lib` - the utility library every other resource uses
- `ox_inventory` - handles items and storage
- `my_custom_shop` - something you'd build

We dig into `fxmanifest.lua` in detail in lesson [`04-resources-and-fxmanifest.md`](04-resources-and-fxmanifest.md).

---

## TL;DR

- FiveM = mod for GTA V that runs custom multiplayer servers.
- You write **client Lua** (player PC), **server Lua** (server), and **NUI** (HTML/React for menus).
- All code lives inside **resources** - folders with an `fxmanifest.lua`.
- Server is the trusted source of truth. Client is the display layer.

---

## Sources

- [FiveM Docs (intro)](https://docs.fivem.net/docs/) - start page
- [Introduction to Resources](https://docs.fivem.net/docs/scripting-manual/introduction/introduction-to-resources/) - official explanation
- [Scripting Manual Introduction](https://docs.fivem.net/docs/scripting-manual/introduction/) - broader concepts
- [Cfx.re Forum](https://forum.cfx.re/) - community Q&A

---

Next: [`02-lua-crash-course.md`](02-lua-crash-course.md)
