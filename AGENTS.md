# Guidelines for AI Coding Agents (`AGENTS.md`)

This document defines the engineering standards, architectural principles, git contributor etiquette, testing requirements, and release protocols for any autonomous AI coding agent (e.g., Google Antigravity, OpenAI Codex, Claude Code, Cursor, Windsurf, GitHub Copilot Workspace) working within the `my-bahasa-gweh` repository.

Every AI agent operating on this codebase **must** read and adhere to these guidelines.

---

## 1. Mission & System Overview

`my-bahasa-gweh` is a customizable, collaborative technical-communication skill and CLI tool for AI coding agents. It gives agents a natural, personal, authentic communication voice across code reviews, PR comments, issue discussions, incident handoffs, and team chats without sounding like a robotic corporate assistant.

Key components of the repository:
- `bin/my-bahasa-gweh.js`: CLI router and core logic (`install`, `update`, `uninstall`, `export`, `doctor`, `profile`).
- `bin/wizard.js`: Interactive terminal setup wizard with mockable I/O streams.
- `bin/colors.js`: High-performance terminal color utility powered by `picocolors`.
- `skill/`: Canonical skill definition (`SKILL.md`, references, and persona presets).
- `test/`: Native test suite executed via Node.js test runner (`node --test`).
- `.github/workflows/`: Multi-OS test matrix CI and trusted npm publishing pipeline with SLSA provenance.

---

## 2. Git Identity & Community Contribution Best Practices

`my-bahasa-gweh` is an open-source community repository developed and used by developers and AI agents worldwide. Agents must adhere to clean contributor etiquette:

> [!IMPORTANT]
> **Respect Local Developer Identity:**
> - Agents must always respect the author and committer configured in the active developer's local git configuration:
>   ```bash
>   git config user.name
>   git config user.email
>   ```
> - **NEVER** silently overwrite, substitute, or hardcode alternate developer names or emails without explicit instruction.
> - **NEVER** inject arbitrary or unverified `Co-authored-by:` trailers with placeholder or bot emails that pollute GitHub's contributor graph or create phantom contributors on the repository UI. Only include co-authorship trailers if explicitly instructed by the user or when properly attributing actual collaborative partners.
> - Always verify git author identity before pushing:
>   ```bash
>   git log -1 --pretty=fuller
>   ```
> - Use standard Conventional Commits format (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).

---

## 3. 100% Full Global Philosophy (Zero Repo Pollution)

The core architecture of `my-bahasa-gweh` is **100% Full Global (Zero Repo Pollution)**:

1. **Zero Repo Pollution:**
   - Skills, personas, and communication rules must live at the system/user level (`~`), never scattered inside individual code repositories.
   - Do **NOT** create or commit `.cursorrules`, `.claude/CLAUDE.md`, or `.my-bahasa.md` into project workspaces.
   - All rule exports and persona profile configurations are strictly global.

2. **Global Integration Paths Reference:**
   | Tool / Agent | Target System Path | Integration Mechanism |
   | :--- | :--- | :--- |
   | **Google Antigravity** | `~/.gemini/config/skills/my-bahasa-gweh` | Symlink / Junction to source skill |
   | **Codex / OpenCode** | `~/.agents/skills/my-bahasa-gweh` | Canonical shared skill directory |
   | **Claude Code** | `~/.claude/CLAUDE.md` | Non-destructive rule block injection |
   | **Cursor** | `~/.cursorrules`<br/>`~/.cursor/rules/my-bahasa-gweh.mdc` | Non-destructive rule block injection |
   | **Windsurf** | `~/.codeium/windsurf/memories/global_rules.md`<br/>`~/.windsurfrules` | Non-destructive rule block injection |
   | **User Profiles** | `~/.config/my-bahasa-gweh/profile.md` | Respects `XDG_CONFIG_HOME` |

3. **CLI Behavior:**
   - The CLI command `my-bahasa-gweh export` writes only to global user system paths (`~`).
   - The CLI wizard saves only to the user's global config directory (`~/.config/my-bahasa-gweh/profile.md`).

---

## 4. Pragmatic & Lean Dependencies Philosophy

The repository embraces a **pragmatic and lean dependency philosophy**:

- **External Dependencies are Welcome:** Packages that bring tangible improvements to developer experience, cross-platform reliability, terminal ergonomics, or maintainability are permitted and encouraged.
- **Lean, Focused, and Auditable:** Prioritize lightweight, highly maintained packages with zero or minimal sub-dependencies (e.g. `picocolors` for robust, cross-platform ANSI styling that respects `NO_COLOR` and Windows console capabilities without the weight of complex terminal suites).
- **Standard Library First:** Continue leveraging Node.js built-ins (`node:fs/promises`, `node:path`, `node:os`, `node:child_process`, `node:readline`, `node:test`, `node:assert/strict`) for core domain logic, adopting external packages when they clearly outperform bespoke reinventions.
- **Keep Dependency Graph Clean:** Avoid bloated frameworks or packages with deeply nested transitive dependency trees.

---

## 5. Non-Destructive Injections

When injecting or exporting rules into editor files (such as `~/.claude/CLAUDE.md`, `~/.cursorrules`, or `~/.codeium/.../global_rules.md`), agents must always use delimited marker blocks:

```markdown
# >>> my-bahasa-gweh >>>
... generated rules ...
# <<< my-bahasa-gweh <<<
```

### Safety Rules:
- If markers already exist: replace **only** the content between the markers.
- If markers do not exist: append the marker block cleanly without modifying any existing user rules.
- Under no circumstances should user-defined rules outside the markers be overwritten or deleted.
- Reference implementation: [`injectRuleBlock`](file:///home/alfiang/Projects/my-bahasa-gweh/bin/my-bahasa-gweh.js).

---

## 6. Testing Rigor & Quality Standards

Every modification, bug fix, or new feature must maintain **100% automated test pass rate** with exhaustive edge-case coverage:

1. **Test Runner:**
   - Run tests using the native command:
     ```bash
     npm test
     ```
   - All tests live in `test/*.test.js` using `node:test` and `node:assert/strict`.

2. **Isolation & Mocking (Crucial):**
   - **Never touch real user home files in tests.**
   - Always create isolated temporary sandbox directories using `fs.mkdtemp` under `os.tmpdir()`.
   - Override `process.env.HOME`, `process.env.USERPROFILE`, and `process.env.XDG_CONFIG_HOME` within test contexts and restore them in `teardown()`.

3. **Required Edge-Case Scenarios to Cover:**
   - **Missing files/directories:** Graceful creation via `mkdir({ recursive: true })`.
   - **Corrupted files / dangling symlinks:** Recovery when `--force` is passed without throwing unhandled exceptions.
   - **Directory collisions:** Refusing overwrite without `--force`, but successfully replacing when `--force` is specified.
   - **Interactive Wizard:** Test with mock streams (`PassThrough`) covering:
     - Quickstart flow
     - Custom wizard flow
     - Enter key (defaults selection)
     - Cancellation (`q`)
     - Recovery from invalid numerical choices
   - **External tool states:** Test `doctor` with `gh` and `glab` CLI authenticated, unauthenticated, and missing entirely (must never crash).
   - **Cross-Platform:** Directory junctions on Windows (`junction`) vs directory symlinks on POSIX (`dir`).

4. **Multi-OS CI Matrix:**
   - All tests must pass on Linux (Ubuntu), Windows, and macOS across Node.js versions 18, 20, 22, and 24.

---

## 7. Release & CI/CD Lifecycle Protocol

Releases must follow an automated, verified, and gated process:

1. **Release Scripts:**
   Never manually edit `package.json` version and tag ad-hoc. Always use the pre-configured scripts:
   ```bash
   # For bug fixes or patch releases:
   npm run release:patch

   # For new backwards-compatible features:
   npm run release:minor

   # For breaking changes:
   npm run release:major
   ```
   These scripts update `package.json`, `package-lock.json`, generate git tags, and push upstream with `--follow-tags`.

2. **CI/CD Pipeline (`.github/workflows/publish.yml`):**
   - Triggered automatically on git tags matching `v*`.
   - Executes multi-OS matrix tests across all 12 runner combinations before publishing.
   - Publishes to npm using GitHub Actions OIDC Trusted Publishing with `--provenance`.
   - Automatically creates GitHub Releases with release notes.

3. **No Premature Local Installations:**
   - **DO NOT** run `npm install -g my-bahasa-gweh@latest` immediately after pushing a git release tag.
   - Wait for the GitHub Actions `Publish npm package` workflow to complete successfully.
   - Wait for npm registry CDN propagation (~15-30 seconds).
   - Verify registry version before upgrading local environment:
     ```bash
     npm view my-bahasa-gweh version
     ```

---

## 8. Pre-Completion Agent Checklist

Before completing any task, AI agents must run through this verification checklist:

- [ ] **Commit Authorization:** Do NOT run `git commit` or `git push` unless explicitly asked by the user.
- [ ] **Git Identity:** Author and committer reflect the user's active `git config` without phantom or bot co-author trailers.
- [ ] **Dependencies:** Dependencies are lean, purposeful, and recorded in `package.json` and `package-lock.json`.
- [ ] **Automated Tests:** `npm test` passes 100% without failures or unhandled warnings.
- [ ] **Diagnostics:** `npm run doctor` executes cleanly and outputs valid report.
- [ ] **Non-Destructive:** No user configurations or rules outside marker blocks were altered.
- [ ] **Git Working Tree:** Clean and accounted for (`git status` shows only intentional modifications).
