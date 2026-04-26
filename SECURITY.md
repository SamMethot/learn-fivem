# Security Policy

## What This Repo Is

This repo is an educational resource. It contains **example FiveM Lua code** for teaching purposes. Most of it is annotated, simplified, and intended to be copied into beginners' projects.

## What "Security Issue" Means Here

If you find an example in a lesson that:

- Teaches a pattern that creates an **actual exploit** on a real server (e.g., a "buy item" example missing critical validation)
- Hardcodes a **secret** (webhook, key, password) - even a fake one - in a way that misleads readers
- **Misrepresents safe practice** in a way that could trick someone into shipping vulnerable code

…that's a security issue. Please report it privately so it can be fixed before more people copy the bad pattern.

## What's NOT A Security Issue Here

- A general bug in an example (open a normal issue)
- A typo, broken link, outdated API reference (open a normal issue or just PR the fix)
- A vulnerability in `ox_lib`, `oxmysql`, or any third-party resource - report those to the maintainers of those projects, not here

## How To Report

**Don't open a public issue for a security report.**

Instead:

1. **Email the maintainer** - see the email in the GitHub profile of the repo owner.
2. Or use [GitHub Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) if enabled on this repo.

Include:

- Which lesson file is affected (e.g., `04-database/02-queries-and-security.md`)
- The specific code block or example
- Why it's an issue (what the exploit looks like)
- A suggested fix (if you have one)

## Response Timeline

- **Acknowledgement:** within 7 days
- **Fix or response plan:** within 14 days
- **Public disclosure:** after a fix lands, with credit to the reporter (unless they prefer anonymity)

## Scope

This policy covers the contents of this repository (`learn-fivem`). It does NOT cover:

- Servers running code copied from this repo (those are their own responsibility)
- Third-party resources (`ox_lib`, `qbx_core`, etc.)
- The FiveM platform itself (report to [Cfx.re](https://forum.cfx.re/))

## Thanks

Catching bad patterns before they propagate makes every server safer. Appreciated.
