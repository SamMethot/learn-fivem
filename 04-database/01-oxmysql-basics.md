# 01. oxmysql Basics

Most modern servers use **oxmysql** for DB access. MySQL resource with async API. Fast, safe if used right.

## Setup

Installed. To use in your resource:

### fxmanifest.lua

```lua
server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
}

dependency 'oxmysql'
```

`@oxmysql/lib/MySQL.lua` = imports `MySQL` global.

## DB Name

Your DB name is set in `server.cfg` via the `mysql_connection_string` convar. Whatever is after `database=` is the name.

## The 5 API Methods

```lua
MySQL.query.await(sql, params)     -- multiple rows
MySQL.single.await(sql, params)    -- single row or nil
MySQL.scalar.await(sql, params)    -- single value (first col, first row)
MySQL.insert.await(sql, params)    -- INSERT, returns new id
MySQL.update.await(sql, params)    -- UPDATE, returns affected count
```

Non-await versions take a callback. Prefer `.await` inside `CreateThread` or event handlers.

## Query Multiple Rows

```lua
local rows = MySQL.query.await('SELECT * FROM players WHERE license = ?', {license})
for _, row in ipairs(rows) do
    print(row.citizenid, row.name)
end
```

## Query Single Row

```lua
local player = MySQL.single.await('SELECT * FROM players WHERE citizenid = ?', {cid})
if player then
    print(player.name)
end
```

Returns `nil` if no match.

## Scalar (One Value)

```lua
local count = MySQL.scalar.await('SELECT COUNT(*) FROM players')
local cash = MySQL.scalar.await('SELECT cash FROM accounts WHERE cid = ?', {cid})
```

## Insert

```lua
local id = MySQL.insert.await(
    'INSERT INTO shop_log (citizenid, item, price) VALUES (?, ?, ?)',
    {cid, 'bread', 10}
)
print('new id:', id)
```

Returns auto-increment ID.

## Update

```lua
local affected = MySQL.update.await(
    'UPDATE accounts SET cash = cash + ? WHERE cid = ?',
    {100, cid}
)
print('rows changed:', affected)    -- 0 if no match, 1+ success
```

## Delete

```lua
MySQL.update.await('DELETE FROM shop_log WHERE id = ?', {logId})
```

No special `.delete`, use `.update`.

## Parameterized Queries

**ALWAYS use `?` placeholders.** Never concat SQL strings.

```lua
-- BAD, VULNERABLE
MySQL.query.await("SELECT * FROM users WHERE name = '" .. userInput .. "'")

-- GOOD
MySQL.query.await('SELECT * FROM users WHERE name = ?', {userInput})
```

If `userInput = "'; DROP TABLE users; --"`, BAD deletes your table. GOOD treats it as string literal.

Full details: `02-queries-and-security.md`.

## Async With Callback

```lua
MySQL.query('SELECT * FROM players', {}, function(rows)
    for _, row in ipairs(rows) do
        print(row.name)
    end
end)
```

Non-blocking. Use inside functions that can't yield. Otherwise `.await` cleaner.

## Migrations

No auto-migration. Add tables manually via MySQL client (HeidiSQL, DBeaver, mysql CLI).

```sql
CREATE TABLE IF NOT EXISTS my_shop_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    citizenid VARCHAR(50) NOT NULL,
    item VARCHAR(50) NOT NULL,
    price INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cid (citizenid)
);
```

Run once. Some resources ship `.sql` file. Execute on install.

## JSON Columns

MySQL 5.7+ supports JSON. Qbox uses it heavily.

```lua
-- read
local row = MySQL.single.await('SELECT charinfo FROM players WHERE cid = ?', {cid})
local charinfo = json.decode(row.charinfo)
print(charinfo.firstname)

-- write
local data = json.encode({firstname='John', lastname='Doe'})
MySQL.update.await('UPDATE players SET charinfo = ? WHERE cid = ?', {data, cid})
```

Qbox helpers often decode for you: `player.PlayerData.charinfo.firstname`.

## Prepared Statements

For hot queries:

```lua
MySQL.prepare.await('UPDATE accounts SET cash = cash + ? WHERE cid = ?', {100, cid})
```

Less used. Same syntax as `.update` in practice.

## Error Handling

DB calls can fail. By default oxmysql prints to console.

```lua
local ok, rows = pcall(MySQL.query.await, 'SELECT broken', {})
if not ok then print('query failed') end
```

Usually let errors bubble. If a query fails, something bigger is wrong.

## Common Queries Cheat Sheet

### Player by citizenid
```lua
local p = MySQL.single.await('SELECT * FROM players WHERE citizenid = ?', {cid})
```

### All players for a job
```lua
local cops = MySQL.query.await([[
    SELECT citizenid, JSON_EXTRACT(charinfo, '$.firstname') as firstname
    FROM players
    WHERE JSON_EXTRACT(job, '$.name') = ?
]], {'police'})
```

### Paginated log
```lua
local logs = MySQL.query.await(
    'SELECT * FROM shop_log WHERE citizenid = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    {cid, 25, offset}
)
```

### Aggregate
```lua
local total = MySQL.scalar.await(
    'SELECT SUM(price) FROM shop_log WHERE citizenid = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)',
    {cid}
)
```

## Inspect DB During Dev

Use `db_inspect` MCP:

```
db_inspect action=tables
db_inspect action=schema table=players
db_inspect action=sample table=players
db_inspect action=query query='SELECT ...'
```

Read-only. Safe.

## TL;DR

- `@oxmysql/lib/MySQL.lua` in server_scripts
- 5 methods: query, single, scalar, insert, update (`.await` preferred)
- Always `?` placeholders
- JSON columns common in Qbox
- JSON columns common in Qbox / QBCore
- `db_inspect` for peeking

## Sources

- oxmysql docs: https://overextended.dev/oxmysql
- oxmysql GitHub: https://github.com/overextended/oxmysql
- MySQL placeholder syntax: https://dev.mysql.com/doc/refman/8.0/en/prepare.html

Next: `02-queries-and-security.md`
