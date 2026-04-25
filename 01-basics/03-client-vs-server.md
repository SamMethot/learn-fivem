# 03. Client vs Server

Most important concept in FiveM. Get this wrong = exploits, dupes, broken server.

## Two Places, Two Rules

**Client** = player's PC. Runs game. Renders graphics. Reads input. Spawns vehicles visually. Hostile = you do not trust it.

**Server** = your machine (or VPS). Runs 24/7. Owns state. DB lives here. Money lives here. Inventory lives here. Trusted = authoritative.

Client tells server "I want to buy bread". Server decides if allowed, takes money, gives item. Server sends back "here's your updated inventory". Client displays it.

Never other way. Client never decides money. Client never decides DB writes.

## File Split

In a resource:
```
my_resource/
  fxmanifest.lua
  client/
    main.lua      ← runs on player PC
  server/
    main.lua      ← runs on server
  shared/
    config.lua    ← runs on both
```

In `fxmanifest.lua`:
```lua
client_script 'client/main.lua'
server_script 'server/main.lua'
shared_script 'shared/config.lua'
```

## What Client Can Do

- Draw UI (NUI, markers, text)
- Read keyboard/mouse
- Spawn vehicles visually (but server decides if allowed)
- Play animations
- Call most GTA natives
- Send events to server

## What Server Can Do

- Read/write DB
- Manage player money and inventory
- Kick/ban players
- Call server-side natives (less than client, but critical ones)
- Validate everything from client
- Send events to client(s)

## What Shared Can Do

Usually config tables + helper functions safe for both. No network calls. No DB. No NUI.

```lua
-- shared/config.lua
Config = {}
Config.Shop = {
    coords = vector3(100, 200, 30),
    items = { 'bread', 'water' },
}
```

Loaded by both, so both sides read `Config.Shop`.

## Example: Buy Item

**Wrong** (client authority):
```lua
-- client
RegisterCommand('buy', function()
    AddMoney(-10)           -- client sets money. EXPLOITABLE.
    AddItem('bread', 1)
end)
```

Player edits their Lua. Spams with `-0`. Infinite bread.

**Right** (server authority):
```lua
-- client
RegisterCommand('buy', function()
    TriggerServerEvent('shop:buy', 'bread')
end)

-- server
RegisterNetEvent('shop:buy', function(itemId)
    local src = source
    if not src or src == 0 then return end
    if itemId ~= 'bread' then return end              -- whitelist

    local player = exports.qbx_core:GetPlayer(src)
    if not player then return end
    if player.PlayerData.money.cash < 10 then return end

    player.Functions.RemoveMoney('cash', 10, 'bread buy')
    exports.ox_inventory:AddItem(src, 'bread', 1)
end)
```

Server checks money. Server deducts. Server adds item. Client just asks.

## Event Triggers

| From | To | Function |
|------|------|----------|
| Client | Server | `TriggerServerEvent('name', ...)` |
| Server | Specific client | `TriggerClientEvent('name', targetId, ...)` |
| Server | All clients | `TriggerClientEvent('name', -1, ...)` |
| Client | Self (same side) | `TriggerEvent('name', ...)` |
| Server | Self (same side) | `TriggerEvent('name', ...)` |

`source` in server event handler = player who sent it. Save to `local src = source` first line.

## Natives Split

Natives = GTA V API. Some are client-only, some server-only, some shared.

- `GetEntityCoords` → both (server version reads synced data)
- `SetEntityCoords` → client only
- `DropPlayer` → server only
- `RegisterCommand` → both (server side restricts by ACE)

Docs tell you per-native: https://docs.fivem.net/natives/

## Don't Trust Client Input

Anything from `TriggerServerEvent` = attacker-controlled. Validate:

```lua
RegisterNetEvent('shop:buy', function(itemId, qty)
    local src = source

    -- type
    if type(itemId) ~= 'string' then return end
    if type(qty) ~= 'number' then return end

    -- range
    if qty < 1 or qty > 10 then return end

    -- whitelist
    if not Config.ValidItems[itemId] then return end

    -- ...now do work
end)
```

Covered deep in `02-events/03-event-security.md` and `08-security/`.

## The `source` Variable

Server net event has magic `source` = player's server ID (small number like 1-128). Save immediately:

```lua
RegisterNetEvent('my:event', function(data)
    local src = source      -- do this FIRST
    -- ... rest of code
    -- source may change if you do another event call, src won't
end)
```

## Client Can See Server Files?

**No**. But client CAN see all `client_script` + `shared_script`. Download the cache folder = all client Lua. Nothing on client is secret.

Server Lua stays on server. DB credentials on server. Discord webhooks on server.

**But**: if your server files leak (GitHub push, file share), server Lua leaks too. Don't hardcode webhooks or API keys there either. Use convars.

## Common Beginner Mistakes

1. "Just do money on client, easier" → dupe bug within a week
2. Trust `TriggerServerEvent` args → parameter injection
3. Do DB query on client → impossible, DB only on server
4. Forget `local src = source` → src changes mid-function, bugs
5. Use `TriggerEvent` when need cross-side → silently does nothing

## TL;DR

- Client = hostile, display layer only
- Server = trusted, owns state
- Money/inventory/DB = server only
- Every net event = validate args server side
- `local src = source` first line always

## Sources

- Scripting manual intro (client/server split): https://docs.fivem.net/docs/scripting-manual/introduction/
- Scripting runtimes: https://docs.fivem.net/docs/scripting-reference/runtimes/lua/
- OneSync: https://docs.fivem.net/docs/scripting-reference/onesync/

Next: `04-resources-and-fxmanifest.md`
