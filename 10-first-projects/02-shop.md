# 02. Project: Shop

## Goal

Build a **complete, secure shop**. Pulls together everything you've learned: events, framework money, ox_inventory, ox_target, security checklist, rate limiting.

Scope: one ped at Legion Square, target-based menu, 3 items, cash only.

If you only build one project from this course, **build this one** - it's a real microcosm of how 80% of FiveM resources work.

---

## Folder

```
resources/[test]/simple_shop/
├── fxmanifest.lua
├── client/main.lua
└── server/main.lua
```

In `server.cfg`:

```cfg
ensure simple_shop
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

dependency 'ox_target'                                          -- target system
dependency 'ox_inventory'                                       -- item add
dependency 'qbx_core'                                           -- player object + money
```

---

## Server-Side Config (Authoritative)

In `server/main.lua`, at the top:

```lua
-- ↓ this lives ONLY on the server. clients don't get to see prices.
local CONFIG = {
    LOCATION = vec3(25.7, -1347.3, 29.49),                      -- where the shop is
    ITEMS = {
        bread  = { label = 'Bread',  price = 10 },
        water  = { label = 'Water',  price = 5 },
        burger = { label = 'Burger', price = 20 },
    },
}
```

**Key idea:** the client sends an item ID (`'bread'`). The server looks up the price from this config. Client never sends prices.

---

## `client/main.lua`

```lua
-- ↓ shopkeeper ped definition
local PED_MODEL = `mp_m_shopkeep_01`                            -- backtick = compile-time hash
local PED_COORDS = vec3(25.7, -1347.3, 28.49)                   -- ground level (z slightly lower than menu zone)
local PED_HEADING = 266.0                                       -- direction the ped faces
local SHOP_COORDS = vec3(25.7, -1347.3, 29.49)                  -- the "shop center" used by server distance check

local shopPed                                                   -- handle to the spawned ped (track for cleanup)

-- ↓ spawn the shopkeeper at server start
local function spawnShopkeeper()
    RequestModel(PED_MODEL)                                     -- ask the engine to load the ped model
    while not HasModelLoaded(PED_MODEL) do Wait(10) end         -- wait until loaded

    -- ↓ create the ped
    -- args: pedType, model, x, y, z, heading, isNetwork, thisScriptCheck
    shopPed = CreatePed(4, PED_MODEL, PED_COORDS.x, PED_COORDS.y, PED_COORDS.z, PED_HEADING, false, true)
    FreezeEntityPosition(shopPed, true)                         -- ped doesn't drift
    SetEntityInvincible(shopPed, true)                          -- can't be killed
    SetBlockingOfNonTemporaryEvents(shopPed, true)              -- ped doesn't react to combat (won't run from gunshots)
    SetModelAsNoLongerNeeded(PED_MODEL)                         -- release the streaming slot

    -- ↓ attach an ox_target option to this exact ped
    exports.ox_target:addLocalEntity(shopPed, {
        {
            name = 'simple_shop_open',                          -- unique ID for cleanup later
            icon = 'fa-solid fa-shop',
            label = 'Browse Shop',
            distance = 2.0,                                     -- max range to interact
            onSelect = function()
                openShopMenu()                                  -- defined below
            end,
        },
    })
end

-- ↓ open the menu when the player picks "Browse Shop"
function openShopMenu()
    -- ask the server for the item list (server is the source of truth for prices)
    local items = lib.callback.await('simple_shop:getItems', false)
    if not items then return end                                -- callback failed, bail

    -- ↓ build the ox_lib context menu options dynamically from the server's data
    local options = {}
    for itemId, data in pairs(items) do
        options[#options + 1] = {
            title = ('%s - $%d'):format(data.label, data.price),
            icon = 'fa-solid fa-cart-plus',
            onSelect = function()
                TriggerServerEvent('simple_shop:buy', itemId)   -- server validates and processes
            end,
        }
    end

    -- ↓ register the menu and show it
    lib.registerContext({
        id = 'simple_shop_menu',
        title = 'Shop',
        options = options,
    })
    lib.showContext('simple_shop_menu')
end

-- ↓ spawn the ped on resource start (small delay so the game is ready)
CreateThread(function()
    Wait(2000)
    spawnShopkeeper()
end)

-- ↓ CLEANUP - delete the ped + remove the target on resource stop
AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    if shopPed and DoesEntityExist(shopPed) then
        exports.ox_target:removeLocalEntity(shopPed, 'simple_shop_open')
        DeleteEntity(shopPed)
    end
end)
```

**Notes on the client side:**
- We spawn the ped, set it invincible/frozen so it stays put
- ox_target attaches the menu trigger
- The menu fetches items from the server (no prices in client code)
- Cleanup deletes the ped and removes the target on resource restart

---

## `server/main.lua`

```lua
local CONFIG = {                                                -- already shown above
    LOCATION = vec3(25.7, -1347.3, 29.49),
    ITEMS = {
        bread  = { label = 'Bread',  price = 10 },
        water  = { label = 'Water',  price = 5 },
        burger = { label = 'Burger', price = 20 },
    },
}

local cooldowns = {}                                            -- per-player rate limit
local busy = {}                                                 -- per-player lock for critical sections

-- ↓ callback that gives the client a safe view of items (label + price for display)
lib.callback.register('simple_shop:getItems', function(src)
    local out = {}
    for id, data in pairs(CONFIG.ITEMS) do
        out[id] = { label = data.label, price = data.price }
    end
    return out
end)

-- ↓ buy event - runs the full security checklist
RegisterNetEvent('simple_shop:buy', function(itemId)
    local src = source                                          -- 1. cache source FIRST
    if not src or src <= 0 then return end                      -- valid src

    -- ↓ 2. RATE LIMIT
    local now = GetGameTimer()
    if cooldowns[src] and (now - cooldowns[src]) < 500 then return end
    cooldowns[src] = now

    -- ↓ 3. LOCK (prevents parallel-fire dupes)
    if busy[src] then return end
    busy[src] = true

    -- ↓ helper to release the lock on every code path
    local function unlock() busy[src] = nil end

    -- ↓ 4. VALIDATE TYPES + LENGTH
    if type(itemId) ~= 'string' or #itemId > 32 then return unlock() end

    -- ↓ 5. WHITELIST (server config has the truth)
    local item = CONFIG.ITEMS[itemId]
    if not item then return unlock() end

    -- ↓ 6. PLAYER LOADED
    local player = exports.qbx_core:GetPlayer(src)
    if not player then return unlock() end

    -- ↓ 7. DISTANCE CHECK (server reads synced position)
    local ped = GetPlayerPed(src)
    local pos = GetEntityCoords(ped)
    if #(pos - CONFIG.LOCATION) > 5.0 then return unlock() end

    -- ↓ 8. CAN CARRY? (avoid "took money but inventory was full" rage)
    if not exports.ox_inventory:CanCarryItem(src, itemId, 1) then
        TriggerClientEvent('ox_lib:notify', src, {
            id = 'shop_full',
            title = 'Shop',
            description = 'Inventory full',
            type = 'error',
            icon = 'box',
            iconColor = '#e63946',
        })
        return unlock()
    end

    -- ↓ 9. ATOMIC MONEY (Qbox RemoveMoney returns false if not enough - atomic internally)
    if not player.Functions.RemoveMoney('cash', item.price, 'simple_shop:' .. itemId) then
        TriggerClientEvent('ox_lib:notify', src, {
            id = 'shop_broke',
            title = 'Shop',
            description = 'Not enough cash',
            type = 'error',
            icon = 'dollar-sign',
            iconColor = '#e63946',
        })
        return unlock()
    end

    -- ↓ 10. ADD ITEM
    exports.ox_inventory:AddItem(src, itemId, 1)

    -- ↓ 11. LOG (every money change goes in the DB)
    local cid = player.PlayerData.citizenid
    MySQL.insert('INSERT INTO money_log (citizenid, delta, reason) VALUES (?, ?, ?)',
        { cid, -item.price, 'simple_shop_' .. itemId })

    -- ↓ 12. NOTIFY THE BUYER
    TriggerClientEvent('ox_lib:notify', src, {
        id = 'shop_buy',
        title = 'Shop',
        description = ('Bought %s for $%d'):format(item.label, item.price),
        type = 'success',
        icon = 'cart-shopping',
        iconColor = '#2a9d8f',
        duration = 4000,
    })

    unlock()
end)

-- ↓ cleanup per-player state on disconnect
AddEventHandler('playerDropped', function()
    local src = source
    cooldowns[src] = nil
    busy[src] = nil
end)
```

---

## DB Setup (Once)

In your MySQL client (HeidiSQL/DBeaver), run:

```sql
CREATE TABLE IF NOT EXISTS money_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    citizenid VARCHAR(50) NOT NULL,                             -- which character
    delta INT NOT NULL,                                          -- positive (gain) or negative (loss)
    reason VARCHAR(100),                                         -- 'simple_shop_bread', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,              -- when it happened
    INDEX idx_cid (citizenid)                                    -- speeds up "show this player's history"
);
```

---

## Test Flow

1. Restart the server (or `ensure simple_shop`)
2. Walk to `vec3(25.7, -1347.3, 29.49)` - Legion Square 24/7 shop area
3. Hold the target key (LEFT ALT by default) → see "Browse Shop" option
4. Click it → context menu shows 3 items
5. Click bread → "Bought Bread for $10" notification
6. Open inventory: bread is there. Cash is reduced by $10.
7. Check the DB: `SELECT * FROM money_log ORDER BY id DESC LIMIT 5`

---

## Security Audit (Self-Check)

Walk through [`08-security/01-security-checklist.md`](../08-security/01-security-checklist.md):

- [x] Validate types (`type(itemId) == 'string'`, length cap)
- [x] Whitelist (config table lookup)
- [x] Price from server config, not client args
- [x] Atomic money (`RemoveMoney` returns bool)
- [x] Distance check (5m radius)
- [x] Rate limit (500ms cooldown)
- [x] Lock (busy table)
- [x] Log money change (money_log insert)
- [x] `onResourceStop` cleanup (delete ped, remove target)

Passes the audit.

---

## Stretch Goals

If you want to keep building:

1. **Bank payment option** - add a menu choice for "pay with bank" using `RemoveMoney('bank', ...)`.
2. **Quantity selector** - use `lib.inputDialog` to ask how many.
3. **Police job discount** - server checks `player.PlayerData.job.name == 'police'` and applies 10% off.
4. **Multiple shop locations** - config array of vec3s, spawn a ped at each, distance check matches the closest.
5. **Stock system** - limited quantity per item per 10-minute window. Track in a Lua table or DB.

Each one is a small lesson in itself. Pick one and try.

---

## TL;DR

- Ped + ox_target = the entry point
- Client asks server for item data via callback (server is the price authority)
- Server validates: types, whitelist, distance, rate limit, lock, atomic money
- ox_inventory adds the item, MySQL logs it
- Cleanup ped + target on resource stop

This is the template for almost any "interaction → money → reward" feature.

---

## Sources

- [ox_inventory docs](https://coxdocs.dev/ox_inventory)
- [ox_target docs](https://coxdocs.dev/ox_target)
- [ox_lib notify](https://coxdocs.dev/ox_lib/Modules/Interface/Client/notify)
- [Qbox money functions](https://docs.qbox.re/)
- [oxmysql](https://coxdocs.dev/oxmysql)
- [CreatePed native](https://docs.fivem.net/natives/?_0xD49F9B0955C367DE)

---

Next: [`03-nui-menu.md`](03-nui-menu.md)
