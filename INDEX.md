# FiveM School - Full Index

Master navigation. Three reading paths below depending on where you're starting from.

---

## Path 1 - Total Beginner (Recommended)

Read in order. ~2-4 hours of reading + as long as you want for the projects.

1. [`01-basics/01-what-is-fivem.md`](01-basics/01-what-is-fivem.md) - what FiveM actually is
2. [`01-basics/02-lua-crash-course.md`](01-basics/02-lua-crash-course.md) - Lua syntax in 30 min
3. [`01-basics/03-client-vs-server.md`](01-basics/03-client-vs-server.md) - the most important concept
4. [`01-basics/04-resources-and-fxmanifest.md`](01-basics/04-resources-and-fxmanifest.md) - anatomy of a resource
5. [`02-events/01-local-events.md`](02-events/01-local-events.md) - how scripts talk
6. [`02-events/02-net-events.md`](02-events/02-net-events.md) - across the network
7. [`02-events/03-event-security.md`](02-events/03-event-security.md) - **read twice**
8. [`02-events/04-callbacks.md`](02-events/04-callbacks.md) - request/response pattern
9. [`03-natives/01-what-are-natives.md`](03-natives/01-what-are-natives.md) - the GTA V API
10. [`03-natives/02-common-natives.md`](03-natives/02-common-natives.md) - cheat sheet
11. [`04-database/01-oxmysql-basics.md`](04-database/01-oxmysql-basics.md) - talk to MySQL
12. [`04-database/02-queries-and-security.md`](04-database/02-queries-and-security.md) - don't get SQL-injected
13. [`05-frameworks/01-qbox-basics.md`](05-frameworks/01-qbox-basics.md) - player object, jobs, money
14. [`05-frameworks/02-esx-basics.md`](05-frameworks/02-esx-basics.md) - xPlayer, money accounts, jobs
15. [`05-frameworks/03-qbcore-basics.md`](05-frameworks/03-qbcore-basics.md) - core object, PlayerData, jobs, money
16. [`06-ox-libraries/01-ox-lib.md`](06-ox-libraries/01-ox-lib.md) - the swiss-army library
17. [`06-ox-libraries/02-ox-target.md`](06-ox-libraries/02-ox-target.md) - third-eye targeting
18. [`06-ox-libraries/03-inventories.md`](06-ox-libraries/03-inventories.md) - items
19. [`07-nui/01-nui-basics.md`](07-nui/01-nui-basics.md) - HTML UI inside the game
20. [`07-nui/02-react-nui.md`](07-nui/02-react-nui.md) - production NUI with React
21. [`08-security/01-security-checklist.md`](08-security/01-security-checklist.md) - the audit list
22. [`09-performance/01-threads-and-waits.md`](09-performance/01-threads-and-waits.md) - don't tank FPS
23. [`09-performance/02-optimization-patterns.md`](09-performance/02-optimization-patterns.md) - make it fast
24. [`10-first-projects/01-hello-resource.md`](10-first-projects/01-hello-resource.md) - your first resource
25. [`10-first-projects/02-shop.md`](10-first-projects/02-shop.md) - full shop with security
26. [`10-first-projects/03-nui-menu.md`](10-first-projects/03-nui-menu.md) - HTML menu

---

## Path 2 - "I Know Some Stuff Already"

Skip ahead based on what you already know:

| You already know | Start here |
|------------------|------------|
| Lua syntax, new to FiveM | [`01-basics/03-client-vs-server.md`](01-basics/03-client-vs-server.md) |
| FiveM basics, want a security review | [`02-events/03-event-security.md`](02-events/03-event-security.md) → [`08-security/`](08-security/) |
| Building your first NUI | [`07-nui/01-nui-basics.md`](07-nui/01-nui-basics.md) |
| Want to ship a real resource fast | [`10-first-projects/01-hello-resource.md`](10-first-projects/01-hello-resource.md) |
| Server is laggy, need to optimize | [`09-performance/01-threads-and-waits.md`](09-performance/01-threads-and-waits.md) |

---

## Path 3 - Reference (Skim When Stuck)

Use as a glossary of patterns. Pick the lesson that covers the thing you're searching for:

| Searching for | File |
|---------------|------|
| `RegisterNetEvent` is doing something weird | [`02-events/02-net-events.md`](02-events/02-net-events.md) |
| Player can dupe items | [`02-events/03-event-security.md`](02-events/03-event-security.md), [`04-database/02-queries-and-security.md`](04-database/02-queries-and-security.md) |
| `lib.callback.await` returns nil | [`02-events/04-callbacks.md`](02-events/04-callbacks.md) |
| Vehicle won't spawn | [`03-natives/01-what-are-natives.md`](03-natives/01-what-are-natives.md) (Request/Has/Use pattern) |
| Need a confirm dialog | [`06-ox-libraries/01-ox-lib.md`](06-ox-libraries/01-ox-lib.md) |
| Click ATM to open menu | [`06-ox-libraries/02-ox-target.md`](06-ox-libraries/02-ox-target.md) |
| Player can't carry item | [`06-ox-libraries/03-inventories.md`](06-ox-libraries/03-inventories.md) |
| NUI focus stuck | [`07-nui/01-nui-basics.md`](07-nui/01-nui-basics.md) (`onResourceStop` cleanup) |
| Resource is at 0.5+ ms in resmon | [`09-performance/01-threads-and-waits.md`](09-performance/01-threads-and-waits.md) |

---

## Folder Tree

### [01-basics](01-basics/)
Core concepts. What FiveM is, Lua syntax, client/server split, fxmanifest structure.

- [`01-what-is-fivem.md`](01-basics/01-what-is-fivem.md)
- [`02-lua-crash-course.md`](01-basics/02-lua-crash-course.md)
- [`03-client-vs-server.md`](01-basics/03-client-vs-server.md)
- [`04-resources-and-fxmanifest.md`](01-basics/04-resources-and-fxmanifest.md)

### [02-events](02-events/)
The communication layer. Local events, net events, security, callbacks.

- [`01-local-events.md`](02-events/01-local-events.md)
- [`02-net-events.md`](02-events/02-net-events.md)
- [`03-event-security.md`](02-events/03-event-security.md)
- [`04-callbacks.md`](02-events/04-callbacks.md)

### [03-natives](03-natives/)
The GTA V game API exposed to your scripts.

- [`01-what-are-natives.md`](03-natives/01-what-are-natives.md)
- [`02-common-natives.md`](03-natives/02-common-natives.md)

### [04-database](04-database/)
MySQL via oxmysql. Query patterns, parameterization, race-condition prevention.

- [`01-oxmysql-basics.md`](04-database/01-oxmysql-basics.md)
- [`02-queries-and-security.md`](04-database/02-queries-and-security.md)

### [05-frameworks](05-frameworks/)
Qbox + ESX + QBCore: player object, jobs, money/accounts, metadata.

- [`01-qbox-basics.md`](05-frameworks/01-qbox-basics.md)
- [`02-esx-basics.md`](05-frameworks/02-esx-basics.md)
- [`03-qbcore-basics.md`](05-frameworks/03-qbcore-basics.md)

### [06-ox-libraries](06-ox-libraries/)
The libraries 90% of modern resources use.

- [`01-ox-lib.md`](06-ox-libraries/01-ox-lib.md)
- [`02-ox-target.md`](06-ox-libraries/02-ox-target.md)
- [`03-inventories.md`](06-ox-libraries/03-inventories.md)

### [07-nui](07-nui/)
HTML UI rendered inside the game via Chromium.

- [`01-nui-basics.md`](07-nui/01-nui-basics.md)
- [`02-react-nui.md`](07-nui/02-react-nui.md)

### [08-security](08-security/)
The audit checklist. Read before shipping anything.

- [`01-security-checklist.md`](08-security/01-security-checklist.md)

### [09-performance](09-performance/)
Threads, waits, optimization patterns, profiling.

- [`01-threads-and-waits.md`](09-performance/01-threads-and-waits.md)
- [`02-optimization-patterns.md`](09-performance/02-optimization-patterns.md)

### [10-first-projects](10-first-projects/)
Build something real. Three end-to-end projects.

- [`01-hello-resource.md`](10-first-projects/01-hello-resource.md)
- [`02-shop.md`](10-first-projects/02-shop.md)
- [`03-nui-menu.md`](10-first-projects/03-nui-menu.md)

---

## External Documentation Links

Bookmark these. Open them as you read the lessons.

### Official FiveM
- [FiveM Docs (root)](https://docs.fivem.net/) - everything
- [Scripting Manual](https://docs.fivem.net/docs/scripting-manual/) - concepts
- [Native Reference](https://docs.fivem.net/natives/) - searchable native database
- [Lua Runtime](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/) - Lua-specific functions
- [NUI Development](https://docs.fivem.net/docs/scripting-manual/nui-development/) - UI guide
- [Game References](https://docs.fivem.net/docs/game-references/) - controls, blips, pedmodels, etc.

### Communityox / ox libraries (canonical)
- [coxdocs.dev (root)](https://coxdocs.dev/) - all ox docs
- [ox_lib](https://coxdocs.dev/ox_lib) - utility library
- [ox_target](https://coxdocs.dev/ox_target) - third-eye targeting
- [ox_inventory](https://coxdocs.dev/ox_inventory) - items
- [oxmysql](https://coxdocs.dev/oxmysql) - MySQL wrapper
- [communityox GitHub](https://github.com/communityox) - source code

### Qbox
- [Qbox Docs](https://docs.qbox.re/)
- [qbx_core (GitHub)](https://github.com/Qbox-project/qbx_core) - the framework source

### QBCore (legacy, similar API)
- [QBCore Docs](https://docs.qbcore.org/)

### Lua language itself
- [Lua 5.4 Reference Manual](https://www.lua.org/manual/5.4/)
- [Programming in Lua (free online)](https://www.lua.org/pil/contents.html) - the textbook

### Tools
- [txAdmin](https://txadm.in/) - server manager
- [HeidiSQL](https://www.heidisql.com/) - Windows MySQL client
- [DBeaver](https://dbeaver.io/) - cross-platform MySQL client
- [VS Code](https://code.visualstudio.com/) - editor
- [FontAwesome 6 icons](https://fontawesome.com/icons) - icon set ox_lib uses

---

## Contributing

Found an error, want to add a section, or improve examples? PRs welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

Keep tone direct. Keep code examples runnable. Don't pad with filler. Beginners don't need lectures, they need answers.
