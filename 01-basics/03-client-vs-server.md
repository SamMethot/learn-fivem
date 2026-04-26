# 03. Client vs Server

## Plain English

This is **the most important concept in FiveM**. Get it wrong, your server gets exploited within a week. Get it right, you'll write secure resources by default.

There are two places your code runs:

- **Client** = on the player's PC. Hostile. They can read it, edit it, inject stuff into it.
- **Server** = on your server machine. Trusted. Players can't see or modify it.

**Client tells the server what it WANTS to happen. Server decides if it's allowed and makes it happen.**

That's the whole game.

---

## Two Places, Two Rules

| | Client | Server |
|---|--------|--------|
| Where it runs | Player's PC | Your server machine |
| Trust level | **Hostile** - never trust it | **Trusted** - source of truth |
| Has database access? | No | Yes |
| Has player money? | No (a copy for display only) | Yes (the real number) |
| Can spawn cars? | Yes (visually) | Yes (and tells clients to render them) |
| Reads keyboard? | Yes | No |
| Draws UI? | Yes | No |
| Validates events? | No | **Yes - always** |

Real example: a player wants to buy bread.

1. Client sends event "I want to buy bread"
2. Server checks: are they near the shop? Do they have $10? Do they have inventory space?
3. If yes, server takes $10, gives 1 bread, saves to DB, sends "you bought bread" back to client
4. Client displays the notification

**The client never decides money or items. Ever.**

---

## File Split In A Resource

A typical resource organizes its code by side:

```
my_resource/
├── fxmanifest.lua      ← required, declares the resource
├── client/
│   └── main.lua        ← runs on the player PC
├── server/
│   └── main.lua        ← runs on the server
└── shared/
    └── config.lua      ← runs on BOTH sides
```

In `fxmanifest.lua`, you tell FiveM which file goes where:

```lua
-- this file runs on the player's PC
client_script 'client/main.lua'

-- this file runs on the server
server_script 'server/main.lua'

-- this file runs on BOTH sides - useful for config tables
shared_script 'shared/config.lua'
```

---

## What Client Code Can Do

- Draw UI (NUI, on-screen text, blips, markers)
- Read keyboard and mouse input
- Spawn vehicles, peds, objects (visually)
- Play animations, sounds, particle effects
- Call most GTA V natives
- **Send events to the server** asking it to do something
- Receive events from the server telling it what to display

What client code **cannot** do:
- Read the database directly (no DB access on client)
- Modify other players' state authoritatively
- Be trusted with anything that matters

---

## What Server Code Can Do

- Read and write the database
- Manage every player's money, inventory, job
- Kick or ban players (`DropPlayer`)
- Validate every event from clients
- Send events to one client, several clients, or all clients
- Call server-side natives (a smaller set than client, but the critical ones)

What server code **cannot** do:
- Read the player's keyboard
- Draw on the player's screen directly (it sends events to clients to do that)
- Spawn entities locally - it asks a client to spawn them

---

## What Shared Code Can Do

Just config tables and helper functions safe for both sides. **No network calls, no DB access, no NUI.**

```lua
-- shared/config.lua
-- this loads on BOTH client and server, so both sides can read Config.Shop
Config = {}                              -- create a global table
Config.Shop = {
    coords = vector3(100, 200, 30),      -- shop location
    items = { 'bread', 'water' },        -- list of allowed items
}
```

Then in `client/main.lua` and `server/main.lua`, you can both do `print(Config.Shop.coords)`.

**Wait, didn't lesson 02 say "always local"?** Good eye. `Config = {}` is technically a global - and the "always local" rule from the previous lesson still applies for **regular variables**. The exception here is FiveM-specific: each resource runs in its own isolated Lua state, so a "global" inside `my_resource` is **only** visible to that resource - it does NOT leak to other resources on the server. That's why the community convention of a shared `Config` table is safe in practice.

If you'd rather keep things strict and avoid globals entirely, you can use module-style imports instead:

```lua
-- shared/config.lua
return {
    Shop = {
        coords = vector3(100, 200, 30),
        items = { 'bread', 'water' },
    },
}

-- client/main.lua or server/main.lua
local Config = require 'shared.config'    -- or lib.require('shared.config')
print(Config.Shop.coords)
```

Both styles work. The global `Config` pattern is the dominant convention, but `require` is fully supported.

**Beware:** putting prices in shared config means clients can read them. That's usually fine for display - but use server-side config for **authoritative** prices, formulas, and discount logic.

---

## Example: Buying An Item (Wrong vs Right)

### Wrong - client authority (EXPLOITABLE)

```lua
-- client/main.lua
RegisterCommand('buy', function()       -- registers the /buy command
    AddMoney(-10)                       -- client subtracts $10 - but the player can edit this line out!
    AddItem('bread', 1)                 -- client adds 1 bread - exploit: spam this command
end)
```

A player edits their client Lua. Comments out the `AddMoney(-10)` line. Now they get bread for free. Forever.

### Right - server authority (SAFE)

```lua
-- client/main.lua
RegisterCommand('buy', function()                       -- registers /buy
    TriggerServerEvent('shop:buy', 'bread')             -- ASK the server to do the buy. that's all.
end)
```

```lua
-- server/main.lua
RegisterNetEvent('shop:buy', function(itemId)           -- listen for the buy event
    local src = source                                  -- ALWAYS the first line: cache the player who triggered this
    if not src or src == 0 then return end              -- safety: no valid player, bail

    if itemId ~= 'bread' then return end                -- whitelist: only "bread" is allowed via this event

    local player = exports.qbx_core:GetPlayer(src)      -- get the Qbox player object for this src
    if not player then return end                       -- player not loaded yet - bail
    if player.PlayerData.money.cash < 10 then return end -- can they afford it? if not, bail

    player.Functions.RemoveMoney('cash', 10, 'bread buy') -- atomically take $10 (logged with reason)
    exports.ox_inventory:AddItem(src, 'bread', 1)       -- give them 1 bread via the inventory resource
end)
```

The client just sends a request. The server checks **everything** and decides.

---

## Event Triggers At A Glance

| From | To | Function |
|------|----|----------|
| Client | Server | `TriggerServerEvent('name', ...)` |
| Server | One specific client | `TriggerClientEvent('name', targetId, ...)` |
| Server | All connected clients | `TriggerClientEvent('name', -1, ...)` |
| Client → itself | Same side only | `TriggerEvent('name', ...)` |
| Server → itself | Same side only | `TriggerEvent('name', ...)` |

**`TriggerEvent` does NOT cross sides.** If you call it on the server, only server-side handlers get it. Confusing newbies for years - burn it in.

Full deep-dive in [`02-events/`](../02-events/).

---

## Natives Are Split Too

GTA V's API is huge. Some natives only work on the client, some only on the server, some on both. The official native database tells you per-native:

| Native | Side | What it does |
|--------|------|--------------|
| `GetEntityCoords` | Both | Read the position of an entity |
| `SetEntityCoords` | Client only | Move an entity (the owning client does it) |
| `DropPlayer` | Server only | Kick a player |
| `RegisterCommand` | Both | Register a `/command` handler |

If you call a server-only native from the client, it errors or no-ops. Always check the docs.

→ [Native Reference](https://docs.fivem.net/natives/)

---

## Don't Trust Client Input

Anything that arrives on the server through `RegisterNetEvent` - args, IDs, amounts, item names - is attacker-controlled. **Validate everything.**

```lua
RegisterNetEvent('shop:buy', function(itemId, qty)
    local src = source                                       -- cache the source FIRST
    if not src or src == 0 then return end                   -- valid source check

    if type(itemId) ~= 'string' then return end              -- must be a string
    if type(qty) ~= 'number' then return end                 -- must be a number
    if qty < 1 or qty > 10 then return end                   -- must be in range
    if not Config.ValidItems[itemId] then return end         -- must be on whitelist

    -- only NOW do the actual work
end)
```

Full security checklist: [`02-events/03-event-security.md`](../02-events/03-event-security.md) and [`08-security/01-security-checklist.md`](../08-security/01-security-checklist.md).

---

## The `source` Variable

When a client triggers a net event, the server's handler has access to a magic global called `source`. It's the **server ID** of the player who fired the event (a small number like `1`, `42`, `127`).

**Always cache it on the first line:**

```lua
RegisterNetEvent('my:event', function(data)
    local src = source            -- ← cache it FIRST, before anything else
    -- ... rest of code uses src, never raw "source"
end)
```

Why? Because `source` can change if your handler does another event call or yields. `src` is a local - it never changes. Use `src`. Always.

---

## Can The Client See Server Files?

**No** - server-only files (`server_script`, files NOT in the `files {}` list) stay on the server. Client never downloads them.

**But** the client DOES download:
- All `client_script` files
- All `shared_script` files
- All files listed in `files {}` (NUI assets)

Players can find those in the FiveM cache folder on their PC. Treat anything client-side as **publicly readable**. Don't put webhooks, API keys, or admin secrets there.

If your **server code** leaks (someone publishes the repo, a cloud bucket goes public), server secrets leak too. Use `convars` for anything sensitive - they live in `server.cfg` and aren't bundled with code:

```lua
-- in server.cfg:
-- set my_webhook "https://discord.com/api/webhooks/..."

-- in server-side Lua:
local webhook = GetConvar('my_webhook', '')   -- second arg = default if convar missing
```

---

## Common Beginner Mistakes

1. **"Just do money on the client, it's easier"** - first dupe bug within a week. Money lives server-side.
2. **Trusting `TriggerServerEvent` args without validation** - parameter injection, free items, instant level 99.
3. **Trying to query MySQL from the client** - impossible, the DB only exists server-side.
4. **Forgetting `local src = source`** - `source` mutates mid-function, weird bugs that are hours to track.
5. **Using `TriggerEvent` when you needed `TriggerServerEvent` or `TriggerClientEvent`** - silently does nothing, you wonder why.

---

## TL;DR

- **Client = hostile, display layer only.**
- **Server = trusted, owns all critical state.**
- Money, inventory, jobs, DB → server-side ALWAYS.
- Every net event needs server-side validation.
- `local src = source` first line of every server net event.
- Don't trust args - type-check, range-check, whitelist-check.

---

## Sources

- [Scripting Manual Introduction](https://docs.fivem.net/docs/scripting-manual/introduction/) - official client/server explainer
- [Lua Runtime Reference](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/) - what each side can call
- [OneSync](https://docs.fivem.net/docs/scripting-reference/onesync/) - networked entity model
- [GetConvar](https://docs.fivem.net/natives/?_0x6B0DE401) - reading server config

---

Next: [`04-resources-and-fxmanifest.md`](04-resources-and-fxmanifest.md)
