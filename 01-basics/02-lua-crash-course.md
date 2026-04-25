# 02. Lua Crash Course

Lua is small. 30 min = you know enough to read FiveM code. Here's what matters.

## Variables

```lua
local name = 'Alex'
local age = 25
local isAdmin = true
local nothing = nil
```

Always use `local`. Without `local` = global = bad. Globals leak across files, cause bugs, slow runtime.

## Types

- `string` → `'hi'` or `"hi"`
- `number` → `42`, `3.14` (no int/float split)
- `boolean` → `true`, `false`
- `nil` → nothing / missing
- `table` → everything else (arrays, dicts, objects)
- `function` → functions are values

Check type:
```lua
if type(x) == 'number' then ... end
```

## Strings

```lua
local a = 'hello'
local b = "world"
local c = a .. ' ' .. b           -- concatenation with ..
local d = ('hi %s, you are %d'):format(name, age)  -- sprintf style
local e = #a                      -- length = 5
```

Multi-line:
```lua
local long = [[
line one
line two
]]
```

## Numbers

```lua
local x = 5 + 3
local y = 10 / 3         -- 3.333
local z = 10 // 3        -- 3 (integer divide, Lua 5.3+)
local m = 10 % 3         -- 1 (modulo)
local p = 2 ^ 10         -- 1024 (power)
```

No `++` operator. Use `x = x + 1`.

## Tables

One data structure to rule them all. Array + dict in one.

```lua
-- array style (1-indexed!)
local items = { 'apple', 'banana', 'cherry' }
print(items[1])    -- apple  (NOT 0!)

-- dict style
local player = {
    name = 'Sam',
    cash = 500,
    job = 'police',
}
print(player.name)
print(player['name'])  -- same thing

-- nested
local config = {
    shop = {
        coords = vector3(100, 200, 30),
        items = { 'bread', 'water' },
    },
}
```

**Lua arrays start at 1**. Not 0. Burn it in.

## Loops

```lua
-- numeric
for i = 1, 10 do
    print(i)
end

-- step
for i = 10, 1, -1 do
    print(i)
end

-- array (ipairs, in order)
for i, item in ipairs(items) do
    print(i, item)
end

-- dict (pairs, any order)
for key, value in pairs(player) do
    print(key, value)
end

-- while
while condition do
    -- body
end

-- repeat
repeat
    -- body
until condition
```

`ipairs` stops at first nil. `pairs` iterates everything. Use `ipairs` for arrays, `pairs` for dicts.

## Conditionals

```lua
if x > 5 then
    print('big')
elseif x == 5 then
    print('five')
else
    print('small')
end
```

**Only `false` and `nil` are falsy**. Empty string, 0, empty table = all truthy. Important.

```lua
if 0 then print('yes') end    -- prints 'yes'!
if '' then print('yes') end   -- prints 'yes'!
```

Default value idiom:
```lua
local name = input or 'guest'
```

## Functions

```lua
local function add(a, b)
    return a + b
end

-- multiple returns
local function divmod(a, b)
    return a // b, a % b
end
local q, r = divmod(17, 5)

-- variadic
local function sum(...)
    local args = {...}
    local total = 0
    for _, v in ipairs(args) do
        total = total + v
    end
    return total
end
```

Functions = values. Pass around like any variable.

```lua
local function greet(name) return 'Hi ' .. name end
local fn = greet
print(fn('Sam'))
```

## Anonymous functions

```lua
CreateThread(function()
    while true do
        Wait(1000)
        print('tick')
    end
end)
```

Callbacks everywhere in FiveM. Get used to it.

## Scope

```lua
local x = 10        -- file scope
do
    local x = 20    -- block scope, shadows outer
    print(x)        -- 20
end
print(x)            -- 10
```

## Nil Checks

```lua
if player then
    -- player is not nil
end

if player and player.cash then
    -- both exist
end

-- safe nav equivalent
local cash = player and player.cash or 0
```

## Common Patterns

### Default parameter
```lua
local function notify(msg, color)
    color = color or 'white'
    -- ...
end
```

### Early return
```lua
local function process(data)
    if not data then return end
    if type(data) ~= 'table' then return end
    -- actual work
end
```

### Array append
```lua
local list = {}
table.insert(list, 'a')
list[#list + 1] = 'b'     -- equivalent, slightly faster
```

### Array remove
```lua
table.remove(list, 2)     -- remove index 2
```

## String Methods

```lua
local s = 'Hello World'
s:lower()               -- 'hello world'
s:upper()               -- 'HELLO WORLD'
s:sub(1, 5)             -- 'Hello'
s:find('World')         -- 7, 11
s:gsub('o', '0')        -- 'Hell0 W0rld', 2
s:len() or #s           -- 11
```

## What Lua Does NOT Have

- No classes (but you can fake them with tables)
- No null (use `nil`)
- No switch/case (use if/elseif chain)
- No `!=` (use `~=`)
- No `&&`/`||` (use `and`/`or`)
- No `++`/`--`
- No `+=`/`-=` (standard Lua. LuaJIT some mods add it, FiveM = no)

## `~=` Not `!=`

```lua
if x ~= 5 then ... end
```

## Comments

```lua
-- single line

--[[
multi
line
]]
```

## Requiring Files

FiveM doesn't use `require`. You list scripts in `fxmanifest.lua`. Covered in file 04.

## TL;DR

- `local` everything
- Arrays start at 1
- Only `false`/`nil` are falsy
- Tables are everything
- `..` for string concat
- `~=` for not equal
- `pairs` for dict, `ipairs` for array

## Sources

- Lua 5.4 manual: https://www.lua.org/manual/5.4/
- FiveM Lua runtime: https://docs.fivem.net/docs/scripting-manual/runtimes/lua/
- Programming in Lua (free online): https://www.lua.org/pil/contents.html

Next: `03-client-vs-server.md`
