# 01. oxmysql Basics

## Plain English

**oxmysql** is the standard MySQL wrapper for FiveM. It gives you an async API for running SQL queries from your server-side Lua. Fast, safe **if used correctly**, and used by virtually every modern resource.

If you've used `mysql2` in Node, `psycopg2` in Python, or `JDBC` in Java - same idea, smaller API surface.

---

## Setup

In your `fxmanifest.lua`:

```lua
server_scripts {
    '@oxmysql/lib/MySQL.lua',                      -- imports the MySQL global from oxmysql
    'server/main.lua',
}

dependency 'oxmysql'                               -- refuse to start unless oxmysql is running
```

After `'@oxmysql/lib/MySQL.lua'` is in your manifest, the `MySQL` global is available in all your server scripts.

---

## Database Name

Your DB name comes from `server.cfg`:

```cfg
set mysql_connection_string "mysql://user:pass@127.0.0.1:3306/hrrp_2?charset=utf8mb4"
#                                                          ^^^^^^^^
#                                                          this is your DB name ("hrrp_2" here)
```

oxmysql reads this convar on start and connects.

---

## The 5 API Methods

```lua
MySQL.query.await(sql, params)         -- returns multiple rows (array)
MySQL.single.await(sql, params)        -- returns ONE row (table) or nil
MySQL.scalar.await(sql, params)        -- returns ONE value (first column of first row)
MySQL.insert.await(sql, params)        -- returns the new auto-increment ID
MySQL.update.await(sql, params)        -- returns the number of affected rows
```

Each has a **non-`.await`** version that takes a callback function instead of returning the value. **Prefer `.await`** inside threads and event handlers - much cleaner.

---

## Query - Multiple Rows

```lua
-- get all players matching a license
local rows = MySQL.query.await(                                -- ".await" makes it block (within the coroutine)
    'SELECT * FROM players WHERE license = ?',                 -- ? is a placeholder for the value
    { license }                                                -- params, in order matching the ?s
)

for _, row in ipairs(rows) do                                  -- rows is an array of tables
    print(row.citizenid, row.name)                             -- access columns by name
end
```

If no rows match, `rows` is an empty table `{}` - not `nil`. So `#rows == 0` means "nothing found".

---

## Single - One Row

```lua
-- get one player by citizenid
local player = MySQL.single.await(
    'SELECT * FROM players WHERE citizenid = ?',
    { cid }
)

if player then                                                  -- nil if no match
    print(player.name)
end
```

`single` returns `nil` (not an empty table) when there's no match. Always check.

---

## Scalar - One Value

```lua
-- count players
local count = MySQL.scalar.await('SELECT COUNT(*) FROM players')

-- get one column from one row
local cash = MySQL.scalar.await(
    'SELECT cash FROM accounts WHERE cid = ?',
    { cid }
)
```

`scalar` returns the first column of the first row. Useful for counts, single-value lookups.

---

## Insert

```lua
-- insert a row, get back the auto-increment ID
local id = MySQL.insert.await(
    'INSERT INTO shop_log (citizenid, item, price) VALUES (?, ?, ?)',
    { cid, 'bread', 10 }                                       -- 3 params for 3 ?s, in order
)

print('new shop_log row id:', id)                              -- e.g., 142
```

---

## Update (and Delete)

```lua
-- UPDATE returns the number of rows changed
local affected = MySQL.update.await(
    'UPDATE accounts SET cash = cash + ? WHERE cid = ?',
    { 100, cid }
)

print('rows changed:', affected)                               -- 0 if no match, 1+ if it worked
```

DELETE uses the same method (oxmysql doesn't have a separate `.delete`):

```lua
MySQL.update.await('DELETE FROM shop_log WHERE id = ?', { logId })
```

---

## **Always Use `?` Placeholders**

This is the most important rule of database programming. **NEVER concatenate user input into a SQL string.**

```lua
-- BAD: VULNERABLE TO SQL INJECTION
MySQL.query.await("SELECT * FROM users WHERE name = '" .. userInput .. "'")

-- GOOD: parameterized, oxmysql escapes safely
MySQL.query.await('SELECT * FROM users WHERE name = ?', { userInput })
```

If `userInput = "'; DROP TABLE users; --"`, the bad version literally runs `DROP TABLE users`. The good version treats the whole string as a literal value. Full deep-dive: [`02-queries-and-security.md`](02-queries-and-security.md).

---

## Async With A Callback (Non-`.await`)

```lua
-- ↓ third arg is a callback function. doesn't block.
MySQL.query('SELECT * FROM players', {}, function(rows)
    for _, row in ipairs(rows) do
        print(row.name)
    end
end)
```

Use this in places where you can't yield (some `RegisterNUICallback` paths, for example). Otherwise `.await` is cleaner.

---

## Migrations / Creating Tables

oxmysql **does not auto-migrate**. You create tables manually using a MySQL client (HeidiSQL, DBeaver, mysql CLI):

```sql
CREATE TABLE IF NOT EXISTS my_shop_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    citizenid VARCHAR(50) NOT NULL,
    item VARCHAR(50) NOT NULL,
    price INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cid (citizenid)              -- index makes WHERE citizenid = ? fast
);
```

Convention: ship a `database/install.sql` file in your resource. Document it in your README. Run it once.

---

## JSON Columns

MySQL 5.7+ supports JSON storage. Qbox uses it for `charinfo`, `metadata`, `job`, `gang`, etc.

```lua
-- read a JSON column and parse it
local row = MySQL.single.await('SELECT charinfo FROM players WHERE cid = ?', { cid })
local charinfo = json.decode(row.charinfo)                     -- parse the JSON string into a Lua table
print(charinfo.firstname)

-- write a JSON column
local data = json.encode({ firstname = 'John', lastname = 'Doe' })
MySQL.update.await(
    'UPDATE players SET charinfo = ? WHERE cid = ?',
    { data, cid }
)
```

`json.encode` and `json.decode` are FiveM-provided globals. No `require` needed.

In Qbox, you usually access these through `player.PlayerData.charinfo.firstname` directly - the framework decodes for you.

---

## Prepared Statements

For hot, frequently-run queries:

```lua
MySQL.prepare.await(
    'UPDATE accounts SET cash = cash + ? WHERE cid = ?',
    { 100, cid }
)
```

In practice, `MySQL.update.await` is fine for most use. `prepare` matters for batched/repeated queries where the parse-once benefit adds up.

---

## Error Handling

By default, oxmysql prints SQL errors to your server console. If you want to handle them in code:

```lua
local ok, rows = pcall(MySQL.query.await, 'SELECT broken syntax', {})
if not ok then
    print('query failed:', rows)                               -- "rows" is the error message in the failure case
end
```

For most resources, just let errors bubble - if a query fails, you usually want loud noise, not silent skip.

---

## Common Query Recipes

### Player by citizenid

```lua
local p = MySQL.single.await(
    'SELECT * FROM players WHERE citizenid = ?',
    { cid }
)
```

### All players for a job (using JSON)

```lua
-- JSON_EXTRACT pulls a field from a JSON column
local cops = MySQL.query.await([[
    SELECT
        citizenid,
        JSON_EXTRACT(charinfo, '$.firstname') AS firstname
    FROM players
    WHERE JSON_EXTRACT(job, '$.name') = ?
]], { 'police' })
```

### Paginated log

```lua
local logs = MySQL.query.await([[
    SELECT * FROM shop_log
    WHERE citizenid = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
]], { cid, 25, offset })
```

### Aggregate (sum)

```lua
local totalSpent7d = MySQL.scalar.await([[
    SELECT SUM(price)
    FROM shop_log
    WHERE citizenid = ?
    AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
]], { cid })
```

---

## Inspecting The DB During Development

If you have the MCP tool available:

```
db_inspect action=tables
db_inspect action=schema table=players
db_inspect action=sample table=players
db_inspect action=query query='SELECT ...'
```

Read-only. Safe.

Otherwise, fire up HeidiSQL/DBeaver and connect to your dev DB. Critical to know what's actually in there before running an UPDATE.

---

## TL;DR

- `'@oxmysql/lib/MySQL.lua'` in `server_scripts`, plus `dependency 'oxmysql'`
- 5 methods: `query`, `single`, `scalar`, `insert`, `update`
- Use `.await` versions inside threads and event handlers
- **Always use `?` placeholders. Never concatenate user input.**
- JSON columns: `json.decode` / `json.encode`
- Migrations: ship a `.sql` file, run manually

---

## Sources

- [oxmysql docs (canonical)](https://coxdocs.dev/oxmysql)
- [oxmysql GitHub](https://github.com/communityox/oxmysql)
- [MySQL prepare/parameter syntax](https://dev.mysql.com/doc/refman/8.0/en/prepare.html)
- [HeidiSQL](https://www.heidisql.com/) - Windows MySQL client
- [DBeaver](https://dbeaver.io/) - cross-platform MySQL client

---

Next: [`02-queries-and-security.md`](02-queries-and-security.md)
