# My Bahasa Gweh

`my-bahasa-gweh` is a customizable, explicit-only skill and rules generator for coding agents (**Google Antigravity, OpenAI Codex, OpenCode, Cursor, Anthropic Claude Code, Windsurf**) for drafting collaborative technical messages in your personal voice: code reviews, issues, technical threads, design feedback, handoffs, incident updates, meeting preparation, and message rewrites. It accepts GitHub, GitLab, Bitbucket, Gerrit, Azure DevOps, Slack, Teams, Discord, and manually supplied context. It always presents a draft first. With separate, explicit confirmation for the exact draft and target, it can post comments/replies through `gh` (GitHub), `glab` (GitLab), or webhook payloads; it never posts automatically, submits a review, or approves a PR.

The versioned skill source lives in `skill/`. The npm installer places it in the agent-specific discovery locations on the user's machine.

## Install with npm

After the package is published to npm:

```sh
npm install -g my-bahasa-gweh
my-bahasa-gweh install
```

Before publication, install it from a local checkout or its GitHub URL, then run the same `my-bahasa-gweh install` command.

The explicit installer copies the bundled skill to `~/.agents/skills/my-bahasa-gweh` for Codex and OpenCode, then creates an Antigravity symlink at `~/.gemini/config/skills/my-bahasa-gweh` (using a junction on Windows). It refuses to overwrite existing installs unless `--force` is provided.

It deliberately does not use an npm lifecycle hook, so installing the package never changes your agent configuration until you run `my-bahasa-gweh install` yourself.

## CLI Commands

```sh
# Install skill
my-bahasa-gweh install

# Overwrite an existing installation
my-bahasa-gweh install --force

# Update installed skill to the latest bundled version
my-bahasa-gweh update

# Remove installed skill and Antigravity symlink
my-bahasa-gweh uninstall

# Diagnose environment and installation health (checks Node, Skill, Symlink, gh, and glab)
my-bahasa-gweh doctor

# Configure personal persona with step-by-step interactive wizard
my-bahasa-gweh wizard

# Export active persona rules to Cursor (.cursorrules), Claude Code (CLAUDE.md), and Windsurf (.windsurfrules)
my-bahasa-gweh export --all
my-bahasa-gweh export --cursor
my-bahasa-gweh export --claude
my-bahasa-gweh export --windsurf
```

## Personas & Profiles

`my-bahasa-gweh` supports dynamic personas so anyone in the community can customize their own tone and style:

```sh
# 🧙 Interactive Persona Setup Wizard (Quickstart or Full Custom with Live Preview)
my-bahasa-gweh wizard
# or: my-bahasa-gweh profile wizard / my-bahasa-gweh profile init -i

# List available built-in presets
my-bahasa-gweh profile list

# Activate a preset as your personal profile
my-bahasa-gweh profile use default      # Friendly collaborative Indonesian
my-bahasa-gweh profile use gading       # Gading's authentic persona
my-bahasa-gweh profile use formal-id    # Formal Indonesian for corporate
my-bahasa-gweh profile use tech-en      # English for global open source

# Initialize a custom personal profile
my-bahasa-gweh profile init

# View currently active profile and content
my-bahasa-gweh profile show

# Migrate/update active profile to latest schema version
my-bahasa-gweh profile migrate
```

### Cascading Profile Resolution

When drafting messages, the agent dynamically resolves which profile to follow:
1. **Project-level profile:** `.my-bahasa.md` in the current workspace or repository root (great for team/repo guidelines).
2. **User global profile:** `~/.config/my-bahasa-gweh/profile.md` (managed with `my-bahasa-gweh profile use <preset>`).
3. **Bundled default profile:** `profiles/default.md` (bundled with the skill as fallback).

## Multi-Platform Delivery & Integration

- **GitHub:** Post comments and review discussions via `gh pr comment` or `gh api` after explicit user confirmation.
- **GitLab:** Post merge request notes via `glab mr note` after explicit user confirmation.
- **Slack / Discord:** Post to channel/thread via webhook payload (`curl`) when incoming webhook URL is supplied in session.
- **Cursor, Claude Code, Windsurf:** Run `my-bahasa-gweh export --all` to inject persona rules directly into your current project.
- **GitHub Code Suggestions:** Concrete code fixes (such as typos, naming, or small refactors) can include native GitHub ``````suggestion``` blocks in drafts for one-click commits.
- **Concise Reviews:** An alternative draft is optional for minor fixes, saving context on larger reviews while keeping multi-perspective options for nuanced topics.

## Release Workflow

Releases are published automatically via GitHub Actions with OIDC Trusted Publishing and cryptographic SLSA provenance:

```sh
# 1. Run tests locally
npm test

# 2. Trigger automated version bump and release (patch, minor, or major):
npm run release:patch
# or: npm run release:minor
# or: npm run release:major
```

This automatically:
1. Bumps `package.json` and `package-lock.json`.
2. Creates an annotated Git tag `v<version>`.
3. Pushes the commit and tag to GitHub.
4. Triggers `.github/workflows/publish.yml`, which:
   - Validates all 12 test matrix combinations (Ubuntu, Windows, macOS across Node 18, 20, 22, 24).
   - Publishes the package to npm with `--provenance` via OIDC.
   - Automatically generates the GitHub Release with detailed changelog notes.

## Development

```sh
npm test
npm pack --dry-run
```
