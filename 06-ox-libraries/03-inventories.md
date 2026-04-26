# 03. Inventories

## Plain English

Your **framework** (Qbox/QBCore/ESX) doesn't handle items by itself. A separate **inventory resource** does. The most common (and what this lesson focuses on) is **ox_inventory** - open source, actively maintained, community standard.

Other inventories you'll see in the wild:

| Inventory | Notes |
|-----------|-------|
| **ox_inventory** | Open source, modern, recommended |
| **qb-inventory** | Default that ships with QBCore |
| **tgiann-inventory** | Paid, premium features (used by HRRP and similar prod servers) |
| **qs-inventory** | Paid |

The API differs between them. **This lesson assumes ox_inventory.** If your server runs something else, the concepts are the same - check that resource's docs for the export names.

---

## Install

Get [ox_inventory from GitHub](https://github.com/communityox/ox_inventory). Follow the README install steps. Depends on `ox_lib` and `oxmysql`. Works with Qbox, QBCore, ESX, or standalone.

---

## Items Database

Items are defined in `data/items.lua` (inside ox_inventory):

```lua
['bread'] = {                                                    -- the item ID, used in Lua / DB
    label = 'Bread',                                             -- display name shown to players
    weight = 100,                                                -- grams (affects inventory weight)
    stack = true,                                                -- can multiple combine into one slot?
    close = true,                                                -- close inventory UI when using this item?
    description = 'A loaf of bread',                             -- tooltip
},
['lockpick'] = {
    label = 'Lockpick',
    weight = 150,
    stack = false,                                               -- each one takes its own slot
    close = true,
    client = {                                                   -- client-side use behavior
        event = 'myresource:useLockpick',                        -- local event fired when player uses item
        anim = {                                                 -- animation while "using"
            dict = 'mini@repair',
            clip = 'fixing_a_ped',
        },
    },
},
```

Key fields:
- `label` - display name
- `weight` - grams, affects total inventory weight
- `stack` - items merge into one slot if true
- `close` - closes inventory UI on use (most consumables: true)
- `client.event` - local event fired when the player uses the item

Add your custom items here, then restart `ox_inventory`.

---

## Add Item (Server Only)

```lua
-- ↓ give 1 bread to a player
exports.ox_inventory:AddItem(source, 'bread', 1)

-- ↓ ALWAYS check the return values
local success, response = exports.ox_inventory:AddItem(source, 'bread', 1)
if not success then
    -- inventory full, item doesn't exist, or other failure
    TriggerClientEvent('ox_lib:notify', source, {
        type = 'error',
        description = 'Inventory full',
    })
    return
end
```

`AddItem` returns `(success, response)`. The response often has details about why something failed.

---

## Remove Item (Server Only)

```lua
-- ↓ returns true if successfully removed, false if player didn't have it
local removed = exports.ox_inventory:RemoveItem(source, 'bread', 1)

if not removed then
    -- player didn't have the item - they may be lying
    return
end
```

**Always check `RemoveItem`'s return before giving any reward.** The pattern:

```lua
-- ↓ "consume the lockpick, then unlock"
if exports.ox_inventory:RemoveItem(source, 'lockpick', 1) then
    -- they had a lockpick, do the lockpick logic
else
    -- they didn't, abort. don't unlock anything.
end
```

---

## Check Carry Capacity

Before giving an item, check if the player has space. Avoids the "you bought a gun but lost it because inventory was full" rage.

```lua
local canCarry = exports.ox_inventory:CanCarryItem(source, 'gun', 1)

if not canCarry then
    notify(source, 'You can't carry that')
    return
end
```

Apply this in shops BEFORE deducting money.

---

## Get Item Count

```lua
local count = exports.ox_inventory:GetItemCount(source, 'bread')
if count >= 5 then
    -- they have 5 or more bread
end
```

Useful for "do you have at least N of X?" gates.

---

## Usable Items - Server-Side Hook (Recommended)

When an item has `client.event` defined, the CLIENT event fires when the player uses it. **For security-sensitive items, use the server-side hook instead** - clients can fake the use event:

```lua
-- ↓ server side: register a hook for "item used"
exports.ox_inventory:registerHook('usedItem', function(payload)
    if payload.name == 'bread' then
        local player = exports.qbx_core:GetPlayer(payload.source)
        player.Functions.SetMetaData('hunger', 100)              -- restore hunger server-side
    end
end)
```

The server-side hook fires AFTER the inventory has actually consumed the item. Trustworthy.

For purely cosmetic stuff (animations, UI), the client event is fine.

---

## Shops - Built-In

ox_inventory ships its own shop system. Define shops in `data/shops.lua`:

```lua
General = {
    name = 'General Store',
    groups = nil,                                                -- nil = anyone, or set { police = 0, ... } for restricted
    inventory = {
        { name = 'bread', price = 5 },
        { name = 'water', price = 3 },
    },
    locations = {                                                -- where this shop type spawns
        vec3(25.7, -1347.3, 29.5),
    },
    targets = {                                                  -- ox_target zones (auto-attached)
        { loc = vec3(25.7, -1347.3, 29.5), length = 0.6, width = 0.4, heading = 0 },
    },
},
```

ox_inventory handles money deduction, item add, and stock atomically. **You write zero Lua - just config.** Highly recommended for static shops.

---

## Stashes (Player Storage)

Personal containers, group containers, evidence lockers - all "stashes":

```lua
-- ↓ open a stash from client or server
exports.ox_inventory:openInventory('stash', {
    id = 'player_' .. playerId,                                  -- unique stash ID
    owner = playerId,                                            -- optional: lock to this player
})
```

Stash contents persist to the DB automatically. Restart server, the items are still there.

---

## Common Mistakes

### 1. Forgetting `CanCarryItem` before deducting money

```lua
-- BAD: take money, then realize they can't carry, refund... ugly
player.Functions.RemoveMoney('cash', 10, 'shop_buy')
exports.ox_inventory:AddItem(src, 'bread', 1)                    -- might fail if full

-- GOOD: check first
if not exports.ox_inventory:CanCarryItem(src, 'bread', 1) then
    notify('inventory full')
    return
end
player.Functions.RemoveMoney('cash', 10, 'shop_buy')
exports.ox_inventory:AddItem(src, 'bread', 1)
```

### 2. Trusting client "use item" events for sensitive logic

If `client.event` triggers something important (gives money, spawns a vehicle), use the server-side `registerHook('usedItem', ...)` instead. Clients can fake the local event.

### 3. Adding items before deducting money

```lua
-- BAD: if player crashes mid-buy, they keep the item without paying
exports.ox_inventory:AddItem(src, 'bread', 1)
player.Functions.RemoveMoney('cash', 10, 'shop_buy')

-- GOOD: deduct first, add second. on failure, rollback.
if not player.Functions.RemoveMoney('cash', 10, 'shop_buy') then return end
exports.ox_inventory:AddItem(src, 'bread', 1)
```

---

## Migrating From qb-inventory

API shape is similar but the export names differ:

```lua
-- qb-inventory (note the brackets - hyphenated name)
exports['qb-inventory']:AddItem(src, 'bread', 1)

-- ox_inventory (underscore name, no brackets)
exports.ox_inventory:AddItem(src, 'bread', 1)
```

qb-inventory often integrates through `Player.Functions.AddItem` via the framework. ox_inventory talks directly to the inventory resource without going through Qbox/QBCore - slightly more direct.

---

## TL;DR

- ox_inventory is the community standard. Open source.
- Server adds/removes items only. Always.
- Always `CanCarryItem` before adding. Always check `RemoveItem`'s return before rewarding.
- Use server-side hook `registerHook('usedItem', ...)` for sensitive item-use logic.
- Built-in shops + stashes save you a lot of code - just write the config.

---

## Sources

- [ox_inventory docs](https://coxdocs.dev/ox_inventory)
- [ox_inventory GitHub](https://github.com/communityox/ox_inventory)
- [qb-inventory (alternative)](https://github.com/qbcore-framework/qb-inventory)
- [tgiann-inventory](https://docs.tgiann.com/) - paid alt (FYI)

---

Next folder: [`07-nui/`](../07-nui/) - start with [`01-nui-basics.md`](../07-nui/01-nui-basics.md)
