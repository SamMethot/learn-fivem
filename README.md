# FiveM School

Beginner path to coding on FiveM. Read in order. Each folder = one topic.

## Prereqs

- PC with FiveM installed
- Code editor (VS Code recommended)
- Basic programming (variables, functions, loops). No Lua needed, you learn here.
- A local FiveM dev server to test on (txAdmin makes this easy)

## Path

```
01-basics       -> what is FiveM, Lua, client/server, resources
02-events       -> how scripts talk to each other
03-natives      -> GTA V API
04-database     -> MySQL with oxmysql
05-frameworks   -> Qbox / QBCore basics
06-ox-libraries -> ox_lib, ox_target, inventory
07-nui          -> UI (React 19)
08-security     -> don't get exploited
09-performance  -> don't freeze server
10-first-projects -> build 3 real things
```

## Rules

1. Client = hostile. Server = trusted. Always validate server side.
2. No secrets in client code. Players can read it.
3. Always `local src = source` first line of server net event.
4. Parameterized SQL. Always.
5. Read similar resource before writing new one.
6. Run `fivem_lint_lua` before commit.
7. Small commits. One feature at a time.

## How To Use

Read `01-basics` first. Don't skip. Then go through folders in order. Do projects in `10-first-projects` when you hit that folder. Each file ends with pointer to next.

Reference card in `INDEX.md` once you forget something later.

## Assumed Stack

Most examples target a modern FiveM roleplay stack. If your server differs, adapt, core concepts stay the same.

| Thing | What |
|-------|------|
| Framework | Qbox (`qbx_core`) or QBCore |
| Inventory | ox_inventory (alternatives: qb-inventory, tgiann-inventory) |
| Libs | ox_lib, ox_target, oxmysql |
| DB | MySQL |
| NUI | React 19 + Vite (or vanilla HTML) |
| Lua | 5.4 |
| OneSync | Infinity |

## Contributing

Spotted a mistake or have a better pattern? Open a PR. FiveM moves fast, docs rot. Community wins when the knowledge gets better.

Start: `01-basics/01-what-is-fivem.md`
