# 02. Queries & Security

Two topics fused: SAFE queries + avoiding race conditions in money/inventory.

## SQL Injection

Attacker controls a string input. You concat into SQL. They write SQL.

### The Attack

```lua
-- unsafe
local name = data.name   -- from client
MySQL.query.await("SELECT * FROM players WHERE name = '" .. name .. "'")
```

Client sends: `' OR 1=1; DROP TABLE players; --`

Query becomes:
```sql
SELECT * FROM players WHERE name = '' OR 1=1; DROP TABLE players; --'
```

Your table is gone.

### The Fix

```lua
MySQL.query.await('SELECT * FROM players WHERE name = ?', {name})
```

oxmysql escapes. Attacker string = literal. No SQL executed.

### Rule

**Never `..` user input into SQL. Always `?` + params.**

No exceptions. Not for "just an id number". Not for "already validated". Always params.

### Dynamic Column Names

If you truly need dynamic column names (rare), whitelist:

```lua
local ALLOWED_COLS = { name = true, cash = true, job = true }

local col = data.col
if not ALLOWED_COLS[col] then return end

MySQL.query.await(('SELECT %s FROM players WHERE cid = ?'):format(col), {cid})
```

Format column from whitelist, then `?` for value. MySQL can't parameterize column names.

## Race Conditions

Concurrency hell. Two handlers fire for same player at once.

### Scenario

Player has $100. Fires `buy_gun` (costs $80) twice at exact same time.

```lua
RegisterNetEvent('buy_gun', function()
    local src = source
    local cash = MySQL.scalar.await('SELECT cash FROM accounts WHERE cid = ?', {cid})
    if cash < 80 then return end       -- both pass, both see $100

    MySQL.update.await('UPDATE accounts SET cash = cash - 80 WHERE cid = ?', {cid})  -- both deduct

    exports.ox_inventory:AddItem(src, 'gun', 1)   -- both give gun
end)
```

Result: -$60, 2 guns for $100. Dupe.

### Fix 1: Atomic Conditional UPDATE

```lua
local affected = MySQL.update.await(
    'UPDATE accounts SET cash = cash - 80 WHERE cid = ? AND cash >= 80',
    {cid}
)
if affected == 0 then return end    -- didn't have money
```

MySQL serializes the update. Only ONE passes `cash >= 80`. Other returns 0 affected.

### Fix 2: Per-Player Lock

```lua
local locks = {}

RegisterNetEvent('buy_gun', function()
    local src = source
    if locks[src] then return end
    locks[src] = true

    local cash = MySQL.scalar.await('SELECT cash FROM accounts WHERE cid = ?', {cid})
    if cash < 80 then
        locks[src] = nil
        return
    end

    MySQL.update.await('UPDATE accounts SET cash = cash - 80 WHERE cid = ?', {cid})
    exports.ox_inventory:AddItem(src, 'gun', 1)

    locks[src] = nil
end)
```

Lock first. Second fires while processing = immediate return.

Combine both for belt-and-suspenders.

### Fix 3: Framework Helpers

Qbox:
```lua
local player = exports.qbx_core:GetPlayer(src)
local ok = player.Functions.RemoveMoney('cash', 80, 'buy_gun')
if not ok then return end    -- framework did atomic check
exports.ox_inventory:AddItem(src, 'gun', 1)
```

`RemoveMoney` returns false if not enough. Atomic internally. Use when available.

Still use locks if add-item step isn't idempotent.

## Transactions

Multi-query atomic operations:

```lua
MySQL.transaction.await({
    {query = 'UPDATE accounts SET cash = cash - ? WHERE cid = ?', values = {100, fromCid}},
    {query = 'UPDATE accounts SET cash = cash + ? WHERE cid = ?', values = {100, toCid}},
    {query = 'INSERT INTO transfers (from_cid, to_cid, amount) VALUES (?, ?, ?)', values = {fromCid, toCid, 100}},
})
```

All succeed or all fail. Use for money transfers, multi-step consistency.

## Safe Input Patterns

### Numbers

```lua
if type(amount) ~= 'number' then return end
if amount ~= amount then return end     -- NaN
if amount <= 0 or amount > 1000000 then return end
if amount % 1 ~= 0 then return end      -- must be int for money
```

### Strings

```lua
if type(name) ~= 'string' then return end
if #name < 1 or #name > 50 then return end
if not name:match('^[%w_%-]+$') then return end   -- alphanumeric + _ -
```

### Enum / Whitelist

```lua
local ALLOWED_ITEMS = { bread = true, water = true, burger = true }
if not ALLOWED_ITEMS[itemId] then return end
```

## Indexes

Slow query = add index.

```sql
CREATE INDEX idx_citizenid ON shop_log(citizenid);
CREATE INDEX idx_cid_created ON shop_log(citizenid, created_at);
```

Rule: column you `WHERE` on often = index it.

Check with `EXPLAIN`:
```sql
EXPLAIN SELECT * FROM shop_log WHERE citizenid = 'ABC';
```

`type: ref` or `eq_ref` = good. `type: ALL` = full scan = bad.

## Don't Query In Hot Loops

```lua
-- BAD
CreateThread(function()
    while true do
        Wait(1000)
        local count = MySQL.scalar.await('SELECT COUNT(*) FROM players')
    end
end)
```

Cache, update on events.

## Test Changes

Before deploying query changes:

1. Run locally on a dev DB first
2. Verify with `db_inspect`
3. Modifying existing tables = backup first (`mysqldump`)

Never `DROP TABLE` on prod.

## Logging

Every money/inventory change = log it.

```sql
CREATE TABLE money_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    citizenid VARCHAR(50) NOT NULL,
    type VARCHAR(20),
    delta INT,
    reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cid_created (citizenid, created_at)
);
```

```lua
MySQL.insert('INSERT INTO money_log (citizenid, type, delta, reason) VALUES (?, ?, ?, ?)',
    {cid, 'cash', -80, 'buy_gun'})
```

When dupes happen, log tells you who/when/how.

## TL;DR

- SQL injection: always `?`, never `..`
- Races: atomic conditional UPDATE, per-player locks, or framework money fns
- Transactions for multi-query atomicity
- Validate types before queries
- Index hot WHERE columns
- Don't query DB in tight loop
- Log money/inventory changes

## Sources

- oxmysql docs: https://overextended.dev/oxmysql
- OWASP SQL injection prevention: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- MySQL indexing guide: https://dev.mysql.com/doc/refman/8.0/en/mysql-indexes.html

Next folder: `05-frameworks/`
