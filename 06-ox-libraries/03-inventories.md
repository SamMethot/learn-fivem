# 03. Inventories

Your framework doesn't handle items. Inventory resource does. Most common choice: **ox_inventory**. Community standard, actively maintained, open source.

Alternatives you'll see:
- `qb-inventory` (default with QBCore)
- `tgiann-inventory` (paid, premium features)
- `qs-inventory` (paid)

API shape differs between them. This page focuses on **ox_inventory**. If your server runs something else, check that resource's docs, concepts are similar.

## Install

Grab from https://github.com/overextended/ox_inventory. Follow their install guide. Depends on `ox_lib` and `oxmysql`. Works with Qbox, QBCore, ESX, standalone.

## Items Database

Items defined in `data/items.lua`:

```lua
['bread'] = {
    label = 'Bread',
    weight = 100,
    stack = true,
    close = true,
    description = 'A loaf of bread'
},
['lockpick'] = {
    label = 'Lockpick',
    weight = 150,
    stack = false,
    close = true,
    client = {
        event = 'myresource:useLockpick',
        anim = { dict = 'mini@repair', clip = 'fixing_a_ped' }
    }
},
```

Key fields:
- `label`: display name
- `weight`: grams, shows in inventory
- `stack`: can items merge into one slot
- `client.event`: event triggered when player "uses" the item

## Add Item (Server)

```lua
exports.ox_inventory:AddItem(source, 'bread', 1)
```

Returns `success, response`. Check both:

```lua
local success, response = exports.ox_inventory:AddItem(source, 'bread', 1)
if not success then
    TriggerClientEvent('ox_lib:notify', source, { type = 'error', description = 'Inventory full' })
    return
end
```

## Remove Item (Server)

```lua
local removed = exports.ox_inventory:RemoveItem(source, 'bread', 1)
```

Returns `true` if removed. Always check before giving reward:

```lua
if exports.ox_inventory:RemoveItem(source, 'lockpick', 1) then
    -- do lockpick logic
else
    -- player lied about having one
end
```

## Check If Can Carry

Prevents "you lost your item because inventory was full" rage:

```lua
local canCarry = exports.ox_inventory:CanCarryItem(source, 'gun', 1)
if not canCarry then
    notify('Can't carry that')
    return
end
```

## Get Item Count

```lua
local count = exports.ox_inventory:GetItemCount(source, 'bread')
if count >= 5 then ... end
```

## Usable Items (Server-Side Handler)

When an item has `client.event`, the CLIENT event fires when player uses it. But use the server-side handler instead for security:

```lua
-- server
exports.ox_inventory:registerHook('usedItem', function(payload)
    if payload.name == 'bread' then
        local player = exports.qbx_core:GetPlayer(payload.source)
        player.Functions.SetMetaData('hunger', 100)
    end
end)
```

Or use `exports.ox_inventory:CreateCallback` / hooks API. Check their docs.

## Shops

ox_inventory has built-in shops. Define in `data/shops.lua`:

```lua
General = {
    name = 'General Store',
    groups = nil,
    inventory = {
        { name = 'bread', price = 5 },
        { name = 'water', price = 3 },
    },
    locations = {
        vec3(25.7, -1347.3, 29.5),
    },
    targets = {
        { loc = vec3(25.7, -1347.3, 29.5), length = 0.6, width = 0.4, heading = 0 }
    }
}
```

Server handles money deduction, item add, stock. You write zero Lua. Just config.

## Stashes (Personal Storage)

```lua
-- client or server
exports.ox_inventory:openInventory('stash', {
    id = 'player_' .. playerId,
    owner = playerId,        -- optional, restricts to this player
})
```

Stash content persists to DB automatically.

## Common Mistakes

1. **Forgetting to check `CanCarryItem`** = player pays, gets no item.
2. **Trusting client events for "use item"** = exploits. Server hooks only.
3. **Adding items before deducting money** = duplication on error. Always deduct first, add second, rollback on failure.

## Migrating From qb-inventory

Similar API but with brackets:

```lua
-- qb-inventory
exports['qb-inventory']:AddItem(src, 'bread', 1)

-- ox_inventory
exports.ox_inventory:AddItem(src, 'bread', 1)
```

Also qb-inventory uses `Player.Functions.AddItem` via framework. ox_inventory skips the framework, talks directly to inventory resource.

## TL;DR

- ox_inventory = community standard
- Server-side adds/removes only
- Always `CanCarryItem` before adding
- Always check `RemoveItem` return before rewarding
- Built-in shops and stashes = saves you a lot of code
- Docs: https://overextended.dev/ox_inventory

Next: `07-nui/01-nui-basics.md`

## Sources

- ox_inventory docs: https://overextended.dev/ox_inventory
- ox_inventory GitHub: https://github.com/overextended/ox_inventory
- qb-inventory (alt): https://github.com/qbcore-framework/qb-inventory
