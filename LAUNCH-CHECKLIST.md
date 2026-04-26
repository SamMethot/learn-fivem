# GitHub Public Launch Checklist

Walk through these in the GitHub web UI before flipping the repo to public. Each item is a click in Settings or a quick decision. Total time: ~15 min.

Repo: <https://github.com/SamMethot/learn-fivem>

---

## 1. Visibility

- [ ] **Settings -> General -> Danger Zone -> Change repository visibility -> Public**
  - Confirm by typing the repo name.
  - One-way switch in practice (going private later breaks issue/PR links).

## 2. Repo Description + Topics

- [ ] **Top of repo page -> click the gear icon next to "About"**
  - **Description:** `Beginner-to-shipping FiveM coding course. Lua, NUI, security, performance. Every line annotated.`
  - **Website:** (optional) link to a future GitHub Pages or your Discord
  - **Topics:** add `fivem`, `lua`, `gta5`, `cfx`, `qbox`, `qbcore`, `ox-lib`, `tutorial`, `learning-resources`, `nui`, `react`, `roleplay`, `mysql`
  - Topics are huge for discovery, do not skip.
  - Check "Releases", "Packages", "Deployments" off if you do not use them (cleaner sidebar).

## 3. Features

**Settings -> General -> Features**

- [x] Issues - keep ON
- [ ] Discussions - **turn ON** (better for "how do I do X" questions than issues)
  - When you enable, GitHub asks if you want to seed default categories. Pick: Announcements, Q&A, Show and tell, Ideas.
- [ ] Wikis - turn OFF (you have markdown lessons in-repo, no need)
- [ ] Projects - off unless you plan to actively triage with a kanban board
- [ ] Sponsorships - off unless you set up GitHub Sponsors

## 4. Pull Requests

**Settings -> General -> Pull Requests**

- [x] **Allow squash merging** (default ON, leave on)
- [ ] **Allow merge commits** - turn OFF (keeps history linear and clean)
- [ ] **Allow rebase merging** - your call, OFF is fine
- [x] **Always suggest updating pull request branches** - ON
- [x] **Automatically delete head branches** - ON (auto-cleans merged branches)

## 5. Branch Protection

**Settings -> Branches -> Add classic branch protection rule (or "Add ruleset" if using rulesets)**

Branch name pattern: `main`

- [x] **Require a pull request before merging** - ON
  - **Required approvals:** 0 (you are solo for now; bump to 1 once others contribute regularly)
  - [x] **Dismiss stale pull request approvals when new commits are pushed**
- [x] **Require status checks to pass before merging** - ON
  - Pick: `Link Check`, `Markdown Lint` (these run from `.github/workflows/`, will appear after the first PR run)
  - [x] **Require branches to be up to date before merging**
- [x] **Require conversation resolution before merging**
- [ ] **Require signed commits** - optional, skip unless you already sign
- [x] **Do not allow bypassing the above settings**
- [ ] **Allow force pushes** - LEAVE OFF (force push to main = lost work)
- [ ] **Allow deletions** - LEAVE OFF

## 6. Default Branch

- [ ] **Settings -> Branches -> Default branch** - confirm `main` (already is)

## 7. Issue Templates

Already shipped in `.github/ISSUE_TEMPLATE/`. Confirm in GitHub UI:

- [ ] Go to **Issues -> New issue** and verify the three templates show up:
  - Bug / Broken Example
  - Lesson Improvement
  - Question
  - Plus the "General FiveM Question" + "FiveM Discord" + "communityox" + "Qbox" links from `config.yml`

## 8. Pull Request Template

Already shipped at `.github/PULL_REQUEST_TEMPLATE.md`. Test by opening a draft PR, confirm it auto-fills the body.

## 9. Security

- [ ] **Settings -> Security -> Code security**
  - **Private vulnerability reporting** - turn ON. Lets people report security issues privately (matches `SECURITY.md`).
  - **Dependabot alerts** - ON (catches vulns in any future package.json examples)
  - **Dependabot security updates** - ON
  - **Secret scanning** - ON (free for public repos)
  - **Push protection** - ON (blocks accidental secret commits)

## 10. License

- [x] Already detected automatically (GitHub will show "MIT License" badge on repo home from `LICENSE`)

## 11. CODEOWNERS (Optional)

If you want all PRs auto-assigned to you, create `.github/CODEOWNERS`:

```
* @SamMethot
```

Skip for now if you are solo. Useful when you have co-maintainers.

## 12. Social Preview Image

- [ ] **Settings -> General -> Social preview -> Upload an image**
  - 1280x640 recommended. Big repo title, your name or handle, GTA-style aesthetic.
  - Shows when the repo gets shared on Twitter / Discord. Worth 10 minutes of design.

## 13. README Badge Sanity (Optional)

Add a few badges to the top of `README.md` once public:

```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/SamMethot/learn-fivem?style=social)](../../stargazers)
[![Issues](https://img.shields.io/github/issues/SamMethot/learn-fivem)](../../issues)
```

Skip if you do not care.

## 14. Pin On Profile

- [ ] On your **GitHub profile -> Customize your pins -> add `learn-fivem`**. Free visibility.

## 15. Announce

Once public, post in:

- [ ] FiveM forum: <https://forum.cfx.re/c/development/scripts/9>
- [ ] Cfx.re Discord (`#showcase` or similar)
- [ ] Your own Discord / Twitter / personal channels
- [ ] r/FiveM on Reddit

A short post: "Built a beginner-friendly FiveM Lua course. Every line annotated. Free + MIT. PRs welcome."

---

## Post-Launch Hygiene

Things to watch for in the first weeks:

- **Issue triage:** respond within 48h (even just "thanks, will look")
- **PR reviews:** review within a week or assign someone
- **Link rot:** `Link Check` workflow runs Sundays - watch for failures
- **Outdated info:** FiveM moves fast. Schedule a quarterly pass to verify ox/Qbox API references
- **Star milestones:** consider thanking contributors at 10, 50, 100 stars

---

## File-by-file Quick Reference

What lives where:

| File | Purpose |
|------|---------|
| `README.md` | Front door. First impression. |
| `INDEX.md` | Full navigation map. |
| `LICENSE` | MIT |
| `CONTRIBUTING.md` | How to contribute |
| `CODE_OF_CONDUCT.md` | Behavior expectations |
| `SECURITY.md` | How to report security issues in lessons |
| `.gitignore` | OS / Node / FiveM noise |
| `.github/ISSUE_TEMPLATE/*.md` | Issue forms |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR form |
| `.github/workflows/link-check.yml` | Sunday link audit |
| `.github/workflows/markdown-lint.yml` | PR markdown lint |
| `.github/FUNDING.yml` | Sponsorship config (commented out) |

---

Done. Public, discoverable, contribution-ready.
