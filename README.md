# My Bahasa Gweh

`my-bahasa-gweh` is Gading's personal, explicit-only skill for drafting collaborative technical messages in his voice: code reviews, issues, technical threads, design feedback, handoffs, incident updates, meeting preparation, and personal-message rewrites. It accepts GitHub, GitLab, Bitbucket, Gerrit, Azure DevOps, Slack, Teams, Discord, and manually supplied context. It produces drafts only; it never posts a message, submits a review, or approves a PR.

The versioned skill source lives in `skill/`. The npm installer places it in the agent-specific discovery locations on the user's machine.

## Install with npm

After the package is published to npm:

```sh
npm install -g my-bahasa-gweh
my-bahasa-gweh install
```

Before publication, install it from a local checkout or its GitHub URL, then run the same `my-bahasa-gweh install` command.

The explicit installer copies the bundled skill to `~/.agents/skills/my-bahasa-gweh` for Codex and OpenCode, then creates an Antigravity symlink at `~/.gemini/config/skills/my-bahasa-gweh`. It refuses to overwrite existing installs.

It deliberately does not use an npm lifecycle hook, so installing the package never changes your agent configuration until you run `my-bahasa-gweh install` yourself.

## Use

Invoke the skill explicitly as `$my-bahasa-gweh`, then provide a PR URL or number if the active branch does not identify one; for other platforms, provide the relevant thread or make its integration available. The local profile installed with the skill is at `references/gading-profile.md`; update it only when you intentionally want to change the voice.

## Development

```sh
npm test
npm pack --dry-run
```
