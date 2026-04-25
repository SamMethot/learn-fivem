# FiveM School Index

Complete navigation. Pick your path based on where you're at.

## Recommended Reading Order

Total beginner to shipping resources:

1. `01-basics/01-what-is-fivem.md`
2. `01-basics/02-lua-crash-course.md`
3. `01-basics/03-client-vs-server.md`
4. `01-basics/04-resources-and-fxmanifest.md`
5. `02-events/01-local-events.md`
6. `02-events/02-net-events.md`
7. `02-events/03-event-security.md`
8. `02-events/04-callbacks.md`
9. `03-natives/01-what-are-natives.md`
10. `03-natives/02-common-natives.md`
11. `04-database/01-oxmysql-basics.md`
12. `04-database/02-queries-and-security.md`
13. `05-frameworks/01-qbox-basics.md`
14. `06-ox-libraries/01-ox-lib.md`
15. `06-ox-libraries/02-ox-target.md`
16. `06-ox-libraries/03-inventories.md`
17. `07-nui/01-nui-basics.md`
18. `07-nui/02-react-nui.md`
19. `08-security/01-security-checklist.md`
20. `09-performance/01-threads-and-waits.md`
21. `09-performance/02-optimization-patterns.md`
22. `10-first-projects/01-hello-resource.md`
23. `10-first-projects/02-shop.md`
24. `10-first-projects/03-nui-menu.md`

## Full Folder Tree

### 01-basics
Core concepts. What FiveM is, Lua syntax, client/server split, fxmanifest structure.

- `01-what-is-fivem.md`
- `02-lua-crash-course.md`
- `03-client-vs-server.md`
- `04-resources-and-fxmanifest.md`

### 02-events
The communication layer. Local events, net events, security, callbacks.

- `01-local-events.md`
- `02-net-events.md`
- `03-event-security.md`
- `04-callbacks.md`

### 03-natives
FiveM's game API. What natives are, which ones you'll use daily.

- `01-what-are-natives.md`
- `02-common-natives.md`

### 04-database
MySQL via oxmysql. Query patterns, parameterization, SQL injection prevention.

- `01-oxmysql-basics.md`
- `02-queries-and-security.md`

### 05-frameworks
Qbox basics. Jobs, gangs, player object, metadata.

- `01-qbox-basics.md`

### 06-ox-libraries
ox_lib, ox_target, inventory patterns. The stack you'll use every day.

- `01-ox-lib.md`
- `02-ox-target.md`
- `03-inventories.md`

### 07-nui
User interface via CEF. Basics then React NUI with Vite.

- `01-nui-basics.md`
- `02-react-nui.md`

### 08-security
Top exploit classes and the checklist to avoid them.

- `01-security-checklist.md`

### 09-performance
Threads, waits, distance checks, common pitfalls.

- `01-threads-and-waits.md`
- `02-optimization-patterns.md`

### 10-first-projects
Build something real. Hello world, shop, NUI menu.

- `01-hello-resource.md`
- `02-shop.md`
- `03-nui-menu.md`

## If You Already Know Some Stuff

- Know Lua, new to FiveM -> start at `01-basics/03-client-vs-server.md`
- Know FiveM basics, want security review -> go to `02-events/03-event-security.md` then `08-security/01-security-checklist.md`
- Building first NUI -> `07-nui/01-nui-basics.md`
- First resource ever -> `10-first-projects/01-hello-resource.md`

## External Docs

- FiveM official: https://docs.fivem.net/
- Natives reference: https://docs.fivem.net/natives/
- ox_lib: https://overextended.dev/ox_lib
- ox_inventory: https://overextended.dev/ox_inventory
- ox_target: https://overextended.dev/ox_target
- oxmysql: https://overextended.dev/oxmysql
- Qbox: https://docs.qbox.re/

## Contributing

Found an error, want to add a section, or improve examples? PRs welcome. Keep the tone direct, keep code examples runnable, don't pad with filler.
