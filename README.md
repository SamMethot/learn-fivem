# FiveM School

> Beginner-to-shipping FiveM coding course. Built by a working FiveM dev. No fluff, no padding, every Lua line explained.

If you've ever opened a FiveM resource on GitHub and felt lost - this fixes that.

Prefer reading it as a Website? Explore the full course website here: https://sammethot.github.io/learn-fivem

---

## Who This Is For

You'll get the most out of this if you:

- Have done **a little code before** (any language: JS, Python, C#, doesn't matter). You know what a variable, a function, and a loop are.
- Want to write **server-side scripts**, UI menus, jobs, or full game systems for a FiveM server.
- Don't know Lua. **You learn it here.**
- Don't know FiveM internals. **Same.**

Total beginners (never coded at all) - start with [freeCodeCamp's JavaScript course](https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures-v8/) first. Come back when you're comfortable with `if`, `for`, and functions.

---

## What You'll Be Able To Build

By the end:

- Custom commands and chat events
- Job systems with permissions
- Shops with money + inventory + database logging
- HTML/React UIs that talk to the game
- Resources that don't tank your server's framerate
- Code that doesn't get exploited the day you ship it

---

## Prerequisites

| Thing | Why |
|-------|-----|
| **PC with FiveM installed** | You can't test without playing |
| **Code editor** ([VS Code](https://code.visualstudio.com/) recommended) | Syntax highlighting, file explorer, terminal |
| **Local FiveM dev server** ([txAdmin](https://txadm.in/) is the easiest) | You need a server to load your code into |
| **Basic Git** ([GitHub Desktop](https://desktop.github.com/) if you hate the command line) | To version-control your work |
| **A MySQL client** ([HeidiSQL](https://www.heidisql.com/) on Windows, [DBeaver](https://dbeaver.io/) cross-platform) | To poke at the database |

VS Code extensions worth installing day one:
- [sumneko.lua](https://marketplace.visualstudio.com/items?itemName=sumneko.lua) - Lua language server (autocomplete, errors)
- [overextended.cfxlua-vscode](https://marketplace.visualstudio.com/items?itemName=overextended.cfxlua-vscode) - FiveM native autocomplete

---

## How To Read This Course

**Read in order.** Each folder builds on the last. Skipping = confusion later.

```
01-basics       → what FiveM is, Lua, client/server, resources
02-events       → how scripts talk to each other
03-natives      → the GTA V API
04-database     → MySQL with oxmysql
05-frameworks   → Qbox / QBCore / ESX basics
06-ox-libraries → ox_lib, ox_target, ox_inventory
07-nui          → UI (HTML/CSS/JS, then React)
08-security     → don't get exploited
09-performance  → don't freeze the server
10-first-projects → build 3 real things end-to-end
```

Each lesson ends with **`Next: <file>`** so you always know where to go.

If you feel lost, jump to [`INDEX.md`](INDEX.md) for the full map and shortcut paths.

---

## How Each Lesson Is Structured

Every lesson follows the same shape so you know what to expect:

1. **Plain-English summary** at the top - what is this, why do you care
2. **Code examples with every line annotated** - no "magic" lines
3. **Common mistakes** - the bugs that bite beginners
4. **Optimization & security callouts** where they matter
5. **TL;DR** - the takeaway in 5 bullets
6. **Sources** - links to the official docs so you can dig deeper

Code blocks look like this:

```lua
-- declare a local variable. "local" = scoped to this file/block, NOT shared globally
local playerName = 'Sam'

-- print it to the server console (F8 in-game, or your terminal)
print(playerName)
```

Every non-trivial line gets a comment. **You shouldn't have to guess what any line does.**

---

## Core Rules (Memorize These)

These come back in every lesson. Burn them in now:

1. **Client = hostile. Server = trusted.** Always validate on the server. Never trust what the client sends.
2. **No secrets in client code.** Players can read your client `.lua` files. Webhooks, API keys, prices - server only.
3. **`local src = source` is the first line of every server net event.** [Why](02-events/03-event-security.md).
4. **Always parameterize SQL.** `?` placeholders, never string concatenation. [Why](04-database/02-queries-and-security.md).
5. **Read a similar resource before writing a new one.** Patterns in the wild beat patterns from your head.
6. **Small commits.** One feature at a time. Easier to revert when something breaks.

---

## Assumed Stack

Most examples target the modern FiveM roleplay stack. If your server differs, adapt - the core concepts stay identical.

| Thing | What we use | Common alternative |
|-------|-------------|--------------------|
| Framework | [Qbox (`qbx_core`)](https://docs.qbox.re/) | [QBCore](https://docs.qbcore.org/), [ESX](https://documentation.esx-framework.org/) |
| Inventory | [ox_inventory](https://coxdocs.dev/ox_inventory) | qb-inventory, tgiann-inventory |
| Targeting | [ox_target](https://coxdocs.dev/ox_target) | qb-target |
| Library | [ox_lib](https://coxdocs.dev/ox_lib) | (no real alternative) |
| Database | [oxmysql](https://coxdocs.dev/oxmysql) | mysql-async (legacy) |
| Lua runtime | **Lua 5.4** | Lua 5.3 |
| Sync | OneSync Infinity | OneSync Legacy |
| NUI framework | React 19 + Vite | Svelte 5, vanilla HTML/JS |

If you're not sure what stack your server uses, check `server.cfg` for the `ensure` lines.

---

## How To Test Your Code

Every lesson assumes you have a dev server running. The fastest way to set one up:

1. Install [txAdmin](https://txadm.in/) (it's the recommended FiveM server manager)
2. Use the "QBox + ox_lib + ox_inventory" recipe (built-in)
3. Start your server, connect from FiveM, and you're in

Workflow:

```
# edit your code
# save the file
# in-game F8 console:
restart my_resource
# test the change in-game
```

There's no hot reload for Lua. **Restart on every change.**

---

## Glossary (Lookup As You Read)

You'll see these words constantly:

| Word | Meaning |
|------|---------|
| **Resource** | A folder with `fxmanifest.lua` + scripts. The unit of code in FiveM. |
| **Native** | A function exposed by the GTA V game engine. `GetEntityCoords`, etc. |
| **Event** | A named message that scripts fire and listen for. |
| **Net event** | Event that crosses client↔server. Treat as attack surface. |
| **NUI** | New UI. The HTML/JS overlay rendered on top of the game. |
| **CEF** | Chromium Embedded Framework. The browser FiveM uses to render NUI. |
| **Source / `src`** | The server ID of the player who triggered an event. |
| **citizenid** | Stable per-character ID issued by Qbox/QBCore. |
| **license** | Stable per-player ID. Survives character deletion. |
| **Export** | A function one resource exposes for others to call. |
| **Convar** | A server config variable, like `mysql_connection_string`. |
| **State bag** | A networked key-value store on an entity or player. |

---

## Contributing

This repo is **MIT licensed** ([LICENSE](LICENSE)) and PR-friendly. If you spot a mistake, an outdated API, or know a better way - open a PR.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the rules. Short version: keep the tone direct, keep examples runnable, no padding.

Bugs / questions / feature requests: [open an issue](https://github.com/SamMethot/learn-fivem/issues/new/choose).

---

## Start Here

[**`01-basics/01-what-is-fivem.md`**](01-basics/01-what-is-fivem.md)

Don't skip. The earliest lessons are the ones every later lesson assumes.

---

## License

MIT - do whatever you want, just don't sue me. See [LICENSE](LICENSE).
