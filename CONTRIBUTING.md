# Contributing

Thanks for wanting to make this better. The goal of this repo is to teach FiveM coding to total beginners. **Every change should serve that goal.**

---

## What's Welcome

- **Fixing errors** - code that doesn't run, broken API references, outdated info
- **Adding missing topics** - check [`INDEX.md`](INDEX.md) first to avoid duplicates
- **Better examples** - shorter, clearer, more runnable
- **Typos, broken links, formatting**
- **New sections on uncovered topics** - open an issue first to discuss scope
- **Translations** - bilingual lessons welcome (open an issue to coordinate)

---

## What's Not Welcome

- **Style-only rewrites** - if the existing version teaches the concept, don't rewrite it just to change wording
- **Promoting paid resources as "the right way"** - mentions of paid alternatives are fine, ads are not
- **Personal-server idioms presented as universal** - keep it framework-agnostic where possible, or note when it's Qbox/QBCore-specific
- **Padding** - if it doesn't help a beginner understand something, cut it
- **Excessive emoji or marketing speak** - direct, technical, friendly

---

## Tone Rules

This repo has a specific voice. Match it:

- **Direct.** No filler. No "in this section we will explore..."
- **Fragments OK** - drop articles where it reads natural
- **Code examples over prose explanations** when both work
- **Plain-English summary** at the top of every lesson (so beginners know what they're about to read)
- **Every Lua line annotated** in major code blocks (this is the whole point)
- **TL;DR section** at the bottom of every lesson
- **`Next:` pointer** at the end so readers know where to go

If you write a 4-paragraph explanation when 3 bullet points would do, it'll get edited down.

---

## Code Examples

- **Must actually run.** Test on a dev server before opening the PR.
- **Server-side security always shown** - never publish a "trust the client" pattern
- **Target the standard stack** - Qbox, ox_lib, ox_inventory, ox_target, oxmysql
- **Mention alternatives** when relevant (ESX, qb-inventory) but don't bloat the lesson with every framework's syntax
- **Annotate every non-trivial line** with what it does
- **Working doc links** - verify before submitting; we don't ship broken URLs

---

## File Conventions

- Markdown only (`.md`)
- Filenames: `NN-topic-name.md` where `NN` is the order within the folder (`01-`, `02-`, ...)
- Folders: `NN-category/`
- All lowercase, hyphens for spaces, no underscores in filenames
- Update [`INDEX.md`](INDEX.md) when adding new files

---

## PR Process

1. **Fork** the repo
2. **Branch** with a clear name: `fix/typo-in-events`, `add/state-bags-section`, `chore/update-ox-lib-links`
3. **Make focused changes** - one topic per PR. Don't bundle a typo fix with a new lesson.
4. **Update `INDEX.md`** if you added or renamed files
5. **Test code examples** - paste them into a real resource, restart, verify they work
6. **Open the PR** with a clear description of what changed and why
7. **Be patient** - review may take a few days

---

## Issues Before Big Changes

If you're planning more than a typo fix, **open an issue first**. Saves everyone time if the proposed change isn't a fit.

For obvious bug fixes (broken example, dead link, typo), just PR - no issue needed.

---

## Reporting Security Issues

If you find a bug in an example that would create a real exploit on a server using this code, **don't open a public issue**. See [SECURITY.md](SECURITY.md) for how to report it privately.

---

## Code Of Conduct

Be helpful. Be patient. Don't be a jerk to beginners.

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Reports go to the email listed there.

---

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE) - same as the rest of the repo. You retain copyright to your contributions; you grant the project the right to redistribute them under MIT.
