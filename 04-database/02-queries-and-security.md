# 02. Queries & Security

## Plain English

Two big database threats kill servers:

1. **SQL injection** - attacker controls part of a query, can read/destroy your DB
2. **Race conditions** - two requests arrive at the same time, both pass the "do you have money?" check, both deduct, both give items → dupe

This file covers both, plus the tools to defend.

---

## SQL Injection

### The Attack

Attacker controls a string that you concatenate into a SQL query. They write SQL.

```lua
-- ↓ UNSAFE: client controls "name", we glue it into the query
local name = data.name
MySQL.query.await(
    "SELECT * FROM players WHERE name = '" .. name .. "'"
)
```

Client sends:
```
'; DROP TABLE players; --
```

Your final query becomes:
```sql
SELECT * FROM players WHERE name = ''; DROP TABLE players; --'
```

Two statements. The second one drops your table. Server is wrecked.

### The Fix

```lua
-- ↓ SAFE: parameterized. The driver escapes the value.
MySQL.query.await(
    'SELECT * FROM players WHERE name = ?',
    { name }
)
```

oxmysql escapes the value before sending. The attacker's input becomes a literal string - `'; DROP TABLE players; --` is just searched for as a name. No SQL gets run.

### The Rule

**Never `..` concatenate ANY value into SQL. Always `?` + params.**

No exceptions. Not for "just an integer". Not for "I already validated it". Always. Every time. Forever.

### Dynamic Column Names

Sometimes you need a column name to be dynamic. **MySQL can't parameterize column names** (only values). For this rare case, use a strict whitelist:

```lua
-- ↓ define which columns are allowed
local ALLOWED_COLS = { name = true, cash = true, job = true }

local col = data.col
if not ALLOWED_COLS[col] then return end                        -- bail if not whitelisted

-- ↓ now safe to format the column name in (because it's whitelisted)
MySQL.query.await(
    ('SELECT %s FROM players WHERE cid = ?'):format(col),       -- col is from the whitelist
    { cid }                                                      -- the value still uses ?
)
```

Whitelist the column. Parameterize the value. Two-step.

---

## Race Conditions

### The Scenario

Player has $100. They fire `buy_gun` twice **at the exact same time** (network spike, scripted spam, etc). Each gun costs $80.

```lua
-- ↓ NAIVE handler - vulnerable
RegisterNetEvent('buy_gun', function()
    local src = source
    local cid = getCid(src)

    -- step 1: read cash
    local cash = MySQL.scalar.await(
        'SELECT cash FROM accounts WHERE cid = ?', { cid }
    )
    if cash < 80 then return end                                -- both events read $100, both pass!

    -- step 2: deduct
    MySQL.update.await(
        'UPDATE accounts SET cash = cash - 80 WHERE cid = ?', { cid }
    )                                                            -- both events deduct, account = -$60

    -- step 3: give item
    exports.ox_inventory:AddItem(src, 'gun', 1)                 -- both events give a gun. PLAYER GOT 2 FOR $100.
end)
```

Both handlers run between each other's steps. Both see fresh data. Both succeed.

### Fix 1 - Atomic Conditional UPDATE

The cleanest fix. Let MySQL guarantee atomicity:

```lua
-- ↓ "AND cash >= 80" makes the deduction conditional on having enough money
local affected = MySQL.update.await(
    'UPDATE accounts SET cash = cash - 80 WHERE cid = ? AND cash >= 80',
    { cid }
)

if affected == 0 then return end                                -- update touched zero rows = didn't have money

-- now safe to give the item
exports.ox_inventory:AddItem(src, 'gun', 1)
```

MySQL serializes UPDATEs internally. Even if two arrive at the same time, only ONE will see `cash >= 80` and succeed. The other gets `affected = 0` and bails before giving the item.

**No dupe.**

### Fix 2 - Per-Player Lock In Lua

Belt-and-suspenders alternative or addition:

```lua
local locks = {}                                                -- table: src → "are we processing for this player?"

RegisterNetEvent('buy_gun', function()
    local src = source
    if locks[src] then return end                               -- already processing for this src, bail
    locks[src] = true                                           -- mark busy

    local cash = MySQL.scalar.await(
        'SELECT cash FROM accounts WHERE cid = ?', { cid }
    )
    if cash < 80 then
        locks[src] = nil                                        -- release lock on early return
        return
    end

    MySQL.update.await(
        'UPDATE accounts SET cash = cash - 80 WHERE cid = ?', { cid }
    )
    exports.ox_inventory:AddItem(src, 'gun', 1)

    locks[src] = nil                                            -- release after success
end)

-- ↓ release on disconnect to avoid leaking
AddEventHandler('playerDropped', function()
    locks[source] = nil
end)
```

The lock prevents two parallel handlers from both passing the cash check. **Use both fixes together** for defense-in-depth.

### Fix 3 - Framework Money Functions

Frameworks like Qbox provide atomic money functions:

```lua
local player = exports.qbx_core:GetPlayer(src)

-- ↓ returns false if the player didn't have enough. atomic internally.
if not player.Functions.RemoveMoney('cash', 80, 'buy_gun') then
    return                                                       -- not enough money, didn't deduct
end

exports.ox_inventory:AddItem(src, 'gun', 1)
```

`RemoveMoney` does the conditional deduct internally. Use when available.

For multi-step transactions (transfer money + log), still combine with locks.

---

## Transactions (Multi-Query Atomicity)

For operations that need multiple queries to all succeed or all fail (money transfer between players, multi-table writes):

```lua
MySQL.transaction.await({
    -- subtract from sender
    {
        query = 'UPDATE accounts SET cash = cash - ? WHERE cid = ?',
        values = { 100, fromCid }
    },
    -- add to receiver
    {
        query = 'UPDATE accounts SET cash = cash + ? WHERE cid = ?',
        values = { 100, toCid }
    },
    -- log it
    {
        query = 'INSERT INTO transfers (from_cid, to_cid, amount) VALUES (?, ?, ?)',
        values = { fromCid, toCid, 100 }
    },
})
```

MySQL runs all three in a transaction. If any fails, all are rolled back. No half-committed state.

---

## Safe Input Patterns (Reusable)

### Numbers

```lua
if type(amount) ~= 'number' then return end                     -- must be a number
if amount ~= amount then return end                             -- NaN check (only NaN ≠ itself)
if amount <= 0 or amount > 1000000 then return end              -- range
if amount % 1 ~= 0 then return end                              -- integer (no fractional money)
```

### Strings

```lua
if type(name) ~= 'string' then return end                       -- must be a string
if #name < 1 or #name > 50 then return end                      -- length cap
if not name:match('^[%w_%-]+$') then return end                 -- only alphanumeric, underscore, hyphen
```

### Enum / Whitelist

```lua
local ALLOWED_ITEMS = { bread = true, water = true, burger = true }
if not ALLOWED_ITEMS[itemId] then return end                    -- not on the list, bail
```

---

## Indexes (Make Queries Fast)

If a query is slow, you probably need an index.

```sql
-- single-column index
CREATE INDEX idx_citizenid ON shop_log(citizenid);

-- multi-column index (for queries that filter on both)
CREATE INDEX idx_cid_created ON shop_log(citizenid, created_at);
```

**Rule:** any column you frequently `WHERE` on or `ORDER BY` = should be indexed.

Check if MySQL is using your index:

```sql
EXPLAIN SELECT * FROM shop_log WHERE citizenid = 'ABC';
```

In the output:
- `type: ref` or `eq_ref` → using index, fast ✅
- `type: ALL` → full table scan, slow ❌ (add an index)

---

## Don't Query In Hot Loops

```lua
-- ↓ BAD: 1 query per second, every second, forever
CreateThread(function()
    while true do
        Wait(1000)
        local count = MySQL.scalar.await('SELECT COUNT(*) FROM players')
    end
end)
```

The DB is the slowest thing in your stack. Cache the value, update on relevant events:

```lua
local playerCount = 0

AddEventHandler('playerJoining', function() playerCount = playerCount + 1 end)
AddEventHandler('playerDropped', function() playerCount = playerCount - 1 end)
```

---

## Test Changes Before Deploy

1. Run new queries on a **dev DB** first
2. Verify the result with `db_inspect` or your MySQL client
3. **Before any UPDATE/DELETE on prod**, take a backup: `mysqldump -u user -p hrrp_2 > backup.sql`
4. **Never `DROP TABLE` on prod** unless you're 100% sure and the backup is fresh

---

## Logging - Always Log Money/Inventory Changes

```sql
CREATE TABLE money_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    citizenid VARCHAR(50) NOT NULL,
    type VARCHAR(20),                                            -- 'cash', 'bank', etc.
    delta INT,                                                   -- positive (gain) or negative (loss)
    reason VARCHAR(100),                                         -- 'buy_gun', 'salary_police', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cid_created (citizenid, created_at)
);
```

```lua
-- ↓ insert one row per money change. Use the non-blocking version (don't .await) if you don't need the ID.
MySQL.insert(
    'INSERT INTO money_log (citizenid, type, delta, reason) VALUES (?, ?, ?, ?)',
    { cid, 'cash', -80, 'buy_gun' }
)
```

When a dupe happens (and it will), the log tells you who, when, and how. Without logs, you're guessing.

---

## TL;DR

- **SQL injection** → always `?` placeholders, never `..` concatenation
- **Race conditions** → atomic conditional `UPDATE ... WHERE col >= ?`, plus per-player Lua locks
- **Multi-query atomicity** → `MySQL.transaction.await({...})`
- **Validate types** before queries - type, range, NaN, integer-check
- **Index hot WHERE columns**
- **Don't query in tight loops** - cache, update on events
- **Log every money/inventory change**

---

## Sources

- [oxmysql docs](https://coxdocs.dev/oxmysql)
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [MySQL Indexing Guide](https://dev.mysql.com/doc/refman/8.0/en/mysql-indexes.html)
- [MySQL Transactions](https://dev.mysql.com/doc/refman/8.0/en/commit.html)
- [EXPLAIN docs](https://dev.mysql.com/doc/refman/8.0/en/explain.html)

---

Next folder: [`05-frameworks/`](../05-frameworks/) - start with [`01-qbox-basics.md`](../05-frameworks/01-qbox-basics.md)
