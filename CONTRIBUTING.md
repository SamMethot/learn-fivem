# Contributing

Thanks for wanting to improve this. Goal: teach FiveM coding to total beginners. Every change should serve that.

## What's Welcome

- Fixing errors (code that doesn't run, wrong API, outdated info)
- Adding missing topics (check `INDEX.md` first)
- Better examples (shorter, clearer, more runnable)
- Typos, broken links, formatting
- New sections on topics not covered yet (open an issue first)

## What's Not Welcome

- Rewriting sections for style alone
- Adding your personal server's code as the "right way"
- Promoting paid resources (mentions as alternatives are fine, ads are not)
- Padding. If it doesn't teach, cut it.

## Tone Rules

This repo has a specific voice. Match it:

- Direct. No filler. No "in this section we will explore..."
- Fragments OK. Drop articles where natural.
- Code examples over prose explanations
- Keep `TL;DR` sections at bottom of each doc
- Keep `Next: path/to/next.md` pointer at end

## Code Examples

- Must actually run. Test before PR.
- Server-side security always shown (never trust client)
- Target community-standard stack: Qbox, ox_lib, ox_inventory, ox_target, oxmysql
- If showing framework-specific code, note the alternative (QBCore, ESX)

## File Conventions

- Markdown, `.md` extension
- Filenames: `NN-topic-name.md` where NN is order within folder
- Folders: `NN-category/`
- Update `INDEX.md` when adding new files

## PR Process

1. Fork
2. Branch: `fix/typo-in-events` or `add/section-on-statebags`
3. Make changes. Keep PRs focused. One topic per PR.
4. Update `INDEX.md` if you added files
5. Open PR. Describe what and why.

## Issues

Open an issue before big changes. Saves everyone time if the direction's wrong.

Bug in a code example? Just PR the fix.

## License

By contributing, you agree your contributions are licensed under MIT (see `LICENSE`).
