# 02. Project: Shop

Build a functioning shop. Applies: events, framework money, ox_inventory, ox_target, security, rate limiting.

Scope: one ped, target-based menu, 3 items, cash only.

## Folder

```
resources\[test]\simple_shop\
├── fxmanifest.lua
├── client\main.lua
└── server\main.lua
```

Add to server.cfg:
```
ensure simple_shop
```

## fxmanifest.lua

```lua
fx_version 'cerulean'
game 'gta5'
lua54 'yes'

shared_script '@ox_lib/init.lua'

client_script 'client/main.lua'
server_script 'server/main.lua'

dependency 'ox_target'
dependency 'ox_inventory'
dependency 'qbx_core'
```

## Shared Config (Server Side Only)

Inside server/main.lua, at the top:

```lua
local CONFIG = {
    LOCATION = vec3(25.7, -1347.3, 29.49),
    ITEMS = {
        bread  = { label = 'Bread',  price = 10 },
        water  = { label = 'Water',  price = 5 },
        burger = { label = 'Burger', price = 20 },
    },
}
```

Server-side only. Client must not know prices. It sends item ID, server looks up price.

## client/main.lua

```lua
local PED_MODEL = `mp_m_shopkeep_01`
local PED_COORDS = vec3(25.7, -1347.3, 28.49)
local PED_HEADING = 266.0
local SHOP_COORDS = vec3(25.7, -1347.3, 29.49)

local shopPed

local function spawnShopkeeper()
    RequestModel(PED_MODEL)
    while not HasModelLoaded(PED_MODEL) do Wait(10) end

    shopPed = CreatePed(4, PED_MODEL, PED_COORDS.x, PED_COORDS.y, PED_COORDS.z, PED_HEADING, false, true)
    FreezeEntityPosition(shopPed, true)
    SetEntityInvincible(shopPed, true)
    SetBlockingOfNonTemporaryEvents(shopPed, true)
    SetModelAsNoLongerNeeded(PED_MODEL)

    exports.ox_target:addLocalEntity(shopPed, {
        {
            name = 'simple_shop_open',
            icon = 'fa-solid fa-shop',
            label = 'Browse Shop',
            distance = 2.0,
            onSelect = function()
                openShopMenu()
            end,
        }
    })
end

function openShopMenu()
    -- ask server for shop data (prices come from server)
    local items = lib.callback.await('simple_shop:getItems', false)
    if not items then return end

    local options = {}
    for itemId, data in pairs(items) do
        options[#options+1] = {
            title = ('%s - $%d'):format(data.label, data.price),
            icon = 'fa-solid fa-cart-plus',
            onSelect = function()
                TriggerServerEvent('simple_shop:buy', itemId)
            end,
        }
    end

    lib.registerContext({
        id = 'simple_shop_menu',
        title = 'Shop',
        options = options,
    })
    lib.showContext('simple_shop_menu')
end

CreateThread(function()
    Wait(2000)    -- let game load
    spawnShopkeeper()
end)

AddEventHandler('onResourceStop', function(r)
    if r ~= GetCurrentResourceName() then return end
    if shopPed and DoesEntityExist(shopPed) then
        exports.ox_target:removeLocalEntity(shopPed, 'simple_shop_open')
        DeleteEntity(shopPed)
    end
end)
```

Notes:
- Spawns ped, pins target
- Callback fetches items (prices from server)
- Context menu per item
- Cleanup on resource stop (delete ped, remove target)

## server/main.lua

```lua
local CONFIG = {
    LOCATION = vec3(25.7, -1347.3, 29.49),
    ITEMS = {
        bread  = { label = 'Bread',  price = 10 },
        water  = { label = 'Water',  price = 5 },
        burger = { label = 'Burger', price = 20 },
    },
}

local cooldowns = {}
local busy = {}

-- send safe data to client (labels + prices for display)
lib.callback.register('simple_shop:getItems', function(src)
    local out = {}
    for id, data in pairs(CONFIG.ITEMS) do
        out[id] = { label = data.label, price = data.price }
    end
    return out
end)

RegisterNetEvent('simple_shop:buy', function(itemId)
    local src = source
    if not src or src <= 0 then return end

    -- rate limit
    local now = GetGameTimer()
    if cooldowns[src] and (now - cooldowns[src]) < 500 then return end
    cooldowns[src] = now

    -- lock
    if busy[src] then return end
    busy[src] = true

    local function unlock() busy[src] = nil end

    -- validate
    if type(itemId) ~= 'string' or #itemId > 32 then return unlock() end

    local item = CONFIG.ITEMS[itemId]
    if not item then return unlock() end

    local player = exports.qbx_core:GetPlayer(src)
    if not player then return unlock() end

    -- distance check
    local ped = GetPlayerPed(src)
    local pos = GetEntityCoords(ped)
    if #(pos - CONFIG.LOCATION) > 5.0 then return unlock() end

    -- can carry ?
    if not exports.ox_inventory:CanCarryItem(src, itemId, 1) then
        TriggerClientEvent('ox_lib:notify', src, {
            id = 'shop_full',           -- [optional] dedupe, click spam = one notif
            title = 'Shop',             -- [required*] need title OR description
            description = 'Inventory full',
            type = 'error',             -- [optional] red style
            icon = 'box',               -- [optional] visual clue
            iconColor = '#e63946',      -- [optional] red, overrides type default
            position = 'top-right',     -- [optional] default anyway, shown for clarity
        })
        return unlock()
    end

    -- atomic money (Qbox RemoveMoney returns false if short)
    if not player.Functions.RemoveMoney('cash', item.price, 'simple_shop:' .. itemId) then
        TriggerClientEvent('ox_lib:notify', src, {
            id = 'shop_broke',          -- [optional]
            title = 'Shop',             -- [required*]
            description = 'Not enough cash',
            type = 'error',             -- [optional]
            icon = 'dollar-sign',       -- [optional]
            iconColor = '#e63946',      -- [optional]
            position = 'top-right',     -- [optional]
        })
        return unlock()
    end

    -- add item
    exports.ox_inventory:AddItem(src, itemId, 1)

    -- log
    local cid = player.PlayerData.citizenid
    MySQL.insert('INSERT INTO money_log (citizenid, delta, reason) VALUES (?, ?, ?)',
        {cid, -item.price, 'simple_shop_' .. itemId})

    TriggerClientEvent('ox_lib:notify', src, {
        id = 'shop_buy',                -- [optional] unique per scenario
        title = 'Shop',                 -- [required*]
        description = ('Bought %s for $%d'):format(item.label, item.price),
        type = 'success',               -- [optional] green
        icon = 'cart-shopping',         -- [optional]
        iconColor = '#2a9d8f',          -- [optional] teal
        duration = 4000,                -- [optional] longer so player sees the price
        position = 'top-right',         -- [optional]
    })

    unlock()
end)

AddEventHandler('playerDropped', function()
    local src = source
    cooldowns[src] = nil
    busy[src] = nil
end)
```

## DB Setup (Once)

```sql
CREATE TABLE IF NOT EXISTS money_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    citizenid VARCHAR(50) NOT NULL,
    delta INT NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cid (citizenid)
);
```

Run in your MySQL client.

## Test Flow

1. Restart server (or `ensure simple_shop`)
2. Walk to `vec3(25.7, -1347.3, 29.49)` (Legion Square 24/7 shop)
3. Hold target key (LEFT ALT), see "Browse Shop"
4. Click. Menu shows 3 items.
5. Click bread. See "Bought Bread for $10" notification.
6. Inventory has bread. Cash is -$10.
7. Check DB: `SELECT * FROM money_log ORDER BY id DESC LIMIT 5`.

## Security Audit

Check against `08-security/01-security-checklist.md`:

- Validate types: YES (`type(itemId) == 'string'`)
- Whitelist: YES (config table lookup)
- Price from server: YES (config, not client arg)
- Atomic money: YES (`RemoveMoney` returns false on short)
- Distance check: YES (< 5.0m)
- Rate limit: YES (500ms cooldown)
- Lock: YES (busy table)
- Log money change: YES
- `onResourceStop` cleanup: YES

Passes.

## Stretch Goals

1. Add bank payment option (additional arg from menu)
2. Add quantity selector (ox_lib inputDialog)
3. Add police job discount
4. Multiple shops (array of locations)
5. Stock system (limited quantity per item per 10 min)

Each = a lesson.

## TL;DR

- Ped + ox_target for entry
- Client asks server for price data
- Server validates, atomic money, rate limit, lock, distance, log
- ox_inventory for item add
- Cleanup ped + target on stop

## Sources

- ox_inventory: https://overextended.dev/ox_inventory
- ox_target: https://coxdocs.dev/ox_target
- ox_lib notify: https://coxdocs.dev/ox_lib/Modules/Interface/Client/notify
- Qbox money functions: https://docs.qbox.re/
- oxmysql: https://overextended.dev/oxmysql

Next: `03-nui-menu.md`
