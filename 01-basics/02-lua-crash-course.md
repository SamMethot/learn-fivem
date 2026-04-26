# 02. Lua Crash Course

## Plain English

Lua is a small, fast scripting language. You can learn enough to read FiveM code in 30 minutes. This page is the cheat sheet - read it once, come back when you forget syntax.

If you've used JavaScript or Python, **most things will feel familiar**. The big traps for newcomers:
- **Arrays start at `1`, not `0`**
- **`~=` means "not equal"** (not `!=`)
- **`and` / `or` instead of `&&` / `||`**
- **Only `false` and `nil` are falsy** - `0`, `""`, and empty tables are all truthy

Burn those four in.

---

## Variables

```lua
-- "local" means this variable only exists inside this file or block
-- always use "local" - without it, you create a global, which leaks across all your code
local name = 'Alex'           -- a string
local age = 25                -- a number
local isAdmin = true          -- a boolean
local nothing = nil           -- nil = "no value", same as null/None in other languages
```

**Why `local` matters:** if you forget it, the variable becomes a global. Globals leak between resources and cause weird bugs that take hours to find. Always `local`. Always.

---

## Types

Lua has 6 types you'll actually use:

| Type | Example | Notes |
|------|---------|-------|
| `string` | `'hi'` or `"hi"` | Single or double quotes both work |
| `number` | `42`, `3.14` | No separate int/float - all numbers |
| `boolean` | `true`, `false` | |
| `nil` | `nil` | "no value" |
| `table` | `{1, 2, 3}` or `{name = 'Sam'}` | Lua's everything-data-structure |
| `function` | `function() end` | Functions are values too |

Check the type of something:

```lua
-- type() returns a string naming the type
if type(x) == 'number' then
    print('x is a number')
end
```

---

## Strings

```lua
local a = 'hello'                      -- single quotes
local b = "world"                      -- double quotes work the same
local c = a .. ' ' .. b                -- ".." joins strings together. result: "hello world"
local d = ('hi %s, age %d'):format(name, age)  -- printf-style formatting
local e = #a                           -- "#" gives length. e = 5
```

Multi-line strings use double square brackets:

```lua
local poem = [[
roses are red
violets are blue
]]
-- the leading/trailing newlines ARE part of the string
```

Common string operations (called as methods using `:`):

```lua
local s = 'Hello World'
s:lower()          -- "hello world"
s:upper()          -- "HELLO WORLD"
s:sub(1, 5)        -- "Hello" - substring from char 1 to 5 (1-indexed!)
s:find('World')    -- 7, 11 - start and end indexes of the match
s:gsub('o', '0')   -- "Hell0 W0rld", 2 - global substitute, returns new string + count
#s                 -- 11 - length
```

---

## Numbers

```lua
local x = 5 + 3        -- 8
local y = 10 / 3       -- 3.333... (regular division, always float-like)
local z = 10 // 3      -- 3 (integer division, drops the decimal)
local m = 10 % 3       -- 1 (modulo / remainder)
local p = 2 ^ 10       -- 1024 (power)
```

**Lua does NOT have `++` or `+=`.** You write it out:

```lua
x = x + 1              -- not "x++"
count = count + 5      -- not "count += 5"
```

---

## Tables - The One Data Structure

Tables are arrays + dictionaries + objects all in one. **Everything in Lua you'd build with a class, you build with a table.**

### Array style

```lua
-- a list of strings, accessed by integer index starting at 1
local items = { 'apple', 'banana', 'cherry' }

print(items[1])    -- "apple"   ← FIRST element is index 1, NOT 0
print(items[3])    -- "cherry"
print(#items)      -- 3 (length)
```

### Dictionary style

```lua
-- key-value pairs (like a JS object or Python dict)
local player = {
    name = 'Sam',          -- string key
    cash = 500,            -- number value
    job = 'police',        -- another string
}

print(player.name)         -- "Sam"  (dot notation, common case)
print(player['name'])      -- "Sam"  (bracket notation, identical result)
```

### Nested tables

```lua
-- tables inside tables are how you build any complex data
local config = {
    shop = {
        coords = vector3(100, 200, 30),    -- vector3 is a built-in FiveM type
        items = { 'bread', 'water' },
    },
}

print(config.shop.coords)          -- the vector3
print(config.shop.items[1])        -- "bread"
```

**Lua arrays start at 1.** Repeat: `1`. If you write `items[0]`, you get `nil`. Burn it in.

---

## Loops

```lua
-- numeric for loop: i goes from 1 to 10 inclusive
for i = 1, 10 do
    print(i)        -- prints 1, 2, 3, ..., 10
end

-- with a step (third number)
for i = 10, 1, -1 do
    print(i)        -- prints 10, 9, 8, ..., 1
end

-- iterate an array with ipairs (i = index, item = value)
local items = { 'apple', 'banana', 'cherry' }
for i, item in ipairs(items) do
    print(i, item)  -- prints "1 apple", "2 banana", "3 cherry"
end

-- iterate a dictionary with pairs (key, value)
local player = { name = 'Sam', cash = 500 }
for key, value in pairs(player) do
    print(key, value)   -- prints in any order - pairs doesn't guarantee order
end

-- while loop: runs as long as the condition is true
while condition do
    -- do stuff
end

-- repeat loop: runs the body, THEN checks the condition
repeat
    -- do stuff
until done
```

**`ipairs` vs `pairs`:**
- `ipairs(t)` - only walks integer keys 1, 2, 3..., stops at the first `nil`. Use for arrays.
- `pairs(t)` - walks every key, in undefined order. Use for dictionaries.

---

## Conditionals

```lua
-- standard if/elseif/else
if x > 5 then
    print('big')
elseif x == 5 then
    print('exactly five')
else
    print('small')
end
```

**Critical Lua quirk:** only `false` and `nil` are falsy. Everything else - including `0` and `""` - is truthy.

```lua
if 0 then print('yes') end       -- this prints 'yes'!
if '' then print('yes') end      -- this prints 'yes'!
if false then print('yes') end   -- doesn't print
if nil then print('yes') end     -- doesn't print
```

In JavaScript, `if (0)` is false. In Lua, `if 0 then` is true. Don't get burned.

### The `or` default-value trick

You'll see this everywhere:

```lua
-- if "input" is nil, fall back to "guest"
local name = input or 'guest'
```

Equivalent to JS `input ?? 'guest'` or Python `input or 'guest'`.

Reason it works: `or` returns the first truthy value, or the last value if all are falsy.

---

## Functions

```lua
-- basic function declaration (note: "local" again)
local function add(a, b)
    return a + b           -- "return" sends a value back
end

print(add(2, 3))          -- 5

-- functions can return MULTIPLE values
local function divmod(a, b)
    return a // b, a % b   -- two return values
end

local quotient, remainder = divmod(17, 5)
print(quotient, remainder) -- 3, 2

-- variadic functions take any number of args via "..."
local function sum(...)
    local args = {...}     -- pack varargs into a table
    local total = 0
    for _, v in ipairs(args) do
        total = total + v
    end
    return total
end

print(sum(1, 2, 3, 4))    -- 10
```

### Functions are values

```lua
-- you can store a function in a variable and pass it around
local function greet(name)
    return 'Hi ' .. name
end

local fn = greet           -- fn now points to the same function
print(fn('Sam'))           -- "Hi Sam"
```

### Anonymous functions

These show up constantly in FiveM (event handlers, callbacks, threads):

```lua
-- declare and use a function inline
CreateThread(function()
    while true do
        Wait(1000)         -- pause for 1 second
        print('tick')
    end
end)
```

The whole `function() ... end` is an unnamed function passed straight to `CreateThread`.

---

## Scope

```lua
local x = 10           -- x exists in this whole file (file-level local)

do                     -- "do ... end" creates a new block
    local x = 20       -- this x is a DIFFERENT variable, just shadowing the outer one
    print(x)           -- 20
end

print(x)               -- 10 (back to the outer one)
```

Every block (`function`, `if`, `for`, `do`) has its own scope. Variables declared `local` inside a block disappear when the block ends.

---

## Nil Checks

```lua
-- in Lua, you can do this without comparison:
if player then
    -- player is not nil and not false
end

-- check multiple things
if player and player.cash then
    -- both are truthy
end

-- safe-navigation alternative (no real "?." in Lua)
local cash = player and player.cash or 0
-- ↑ if player is nil, "player and player.cash" short-circuits to nil
-- ↑ then "or 0" gives you 0 as fallback
```

---

## Common Patterns You'll See Everywhere

### Default parameter

```lua
local function notify(msg, color)
    color = color or 'white'    -- if color was nil, use 'white'
    -- ...
end
```

### Early return guard

```lua
local function process(data)
    if not data then return end                      -- nil/false guard
    if type(data) ~= 'table' then return end         -- wrong type guard
    -- only reach here if everything is OK
end
```

You'll write `if not X then return end` a thousand times in FiveM code. Get used to the shape.

### Append to array

```lua
local list = {}
table.insert(list, 'a')      -- standard library way
list[#list + 1] = 'b'        -- shorter and slightly faster: "set the next index to b"
```

### Remove from array

```lua
table.remove(list, 2)        -- remove the value at index 2, shift everything down
```

---

## What Lua Does NOT Have

| Missing | What to use instead |
|---------|---------------------|
| Classes | Tables + functions (you "fake" classes) |
| `null` | `nil` |
| `switch` / `case` | `if`/`elseif` chain or a lookup table |
| `!=` | `~=` |
| `&&` / `\|\|` | `and` / `or` |
| `++` / `--` | `x = x + 1` |
| `+=` / `-=` | `x = x + 1` (some Lua mods add it, FiveM does NOT) |
| `null-coalescing ??` | `or` (with the falsy-rules caveat) |

---

## Comments

```lua
-- single line comment

--[[
multi
line
comment
]]
```

---

## Requiring Files

Other languages auto-import via `import` or `require`. In FiveM, **file loading is primarily done by `fxmanifest.lua`** - you list `client_scripts`, `server_scripts`, `shared_scripts` and the resource loads them all when it starts. So you usually don't need to `require` your own files the way you would in plain Lua.

That said, Lua's `require` **is** available in the FiveM Lua runtime, and ox_lib also ships `lib.require` for clean module-style imports. If you prefer that style:

```lua
-- shared/config.lua
return {
    foo = 'bar',
}

-- main.lua
local config = require 'shared.config'    -- or: lib.require('shared.config')
print(config.foo)                         -- "bar"
```

Both patterns work. The `fxmanifest` + shared globals approach is the dominant community convention you'll see in 95% of resources, but module-style `require` is fully supported and keeps the global namespace clean. Pick whichever you like.

Covered in lesson [`04-resources-and-fxmanifest.md`](04-resources-and-fxmanifest.md).

---

## TL;DR

- Always `local` - never leave variables unscoped
- Arrays start at **1**, not 0
- Only `false` and `nil` are falsy - `0` and `""` are truthy
- Tables are everything (arrays, dicts, objects)
- `..` joins strings, `~=` is "not equal"
- `pairs` for dicts, `ipairs` for arrays
- `or` for default values

---

## Sources

- [Lua 5.4 Reference Manual](https://www.lua.org/manual/5.4/) - the official spec
- [Programming in Lua (free book)](https://www.lua.org/pil/contents.html) - the textbook, written by Lua's creator
- [FiveM Lua Runtime](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/) - Lua-specific FiveM functions
- [Learn X in Y Minutes - Lua](https://learnxinyminutes.com/docs/lua/) - fast cheat-sheet style intro

---

Next: [`03-client-vs-server.md`](03-client-vs-server.md)
