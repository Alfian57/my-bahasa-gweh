---
name: my-bahasa-gweh
description: "Draft collaborative technical messages in your personal voice and, after explicit confirmation, post a selected GitHub message. Use only when explicitly invoked; do not use for formal project writing."
metadata:
  opencode/autoinvoke: "false"
---

# My Bahasa Gweh

Draft technical collaboration messages that the user can inspect first. After the user explicitly confirms a selected draft and its GitHub destination, this skill may post that one message with GitHub CLI. It represents the user in code reviews, tickets, chat discussions, design feedback, handoffs, incidents, and personal feedback; it does not write formal project artifacts. Other platforms remain draft-only unless an enabled integration has an explicitly confirmed posting workflow.

## Invocation and boundaries

- Use this skill only after the user explicitly invokes `my-bahasa-gweh`. If it was loaded implicitly, ask for an explicit invocation before reviewing.
- Use the context that the user provides: a PR, issue/ticket, chat thread, design proposal, handoff, incident, meeting topic, or a rough personal message. For a GitHub PR without an explicit target, identify the open PR for the active branch. If a required target or thread is unavailable, ask for its URL, number, or pasted context.
- Always show the draft before sending anything. Never send automatically or treat a request to draft, review, analyze, or revise as authorization to post. Do not submit a review, approve a PR, push, edit repository files or metadata, update the active profile, or otherwise change external state.
- Before drafting any comment, resolve and read the active profile (see Profile Resolution below) to calibrate tone, language, salutations, and habits.

## Profile resolution

The skill adapts its persona and voice dynamically by reading the first available communication profile in this order:
1. **User global profile:** Check `~/.config/my-bahasa-gweh/profile.md` (managed via `my-bahasa-gweh profile` and `my-bahasa-gweh wizard`).
2. **Bundled default profile:** Fallback to `profiles/default.md` (or `references/gading-profile.md` if specifically targeted) bundled with the skill.

## Gather context

1. Read the complete conversation or thread that is available in the current session. Use all supplied history to avoid repeating resolved points and to calibrate formality, language, salutation, and emoji use according to the active profile. Do not claim to have read context that was not provided or accessible through an enabled integration.
2. For a GitHub PR, issue, or ticket, confirm that GitHub CLI is installed and authenticated. If it is unavailable, unauthenticated, or its token is invalid, ask the user to install or log in with `gh`; do not attempt to bypass authentication. Use GitHub CLI in read-only mode while gathering context. A GitHub write command is allowed only by the delivery rules below.
3. For a repository-backed review, read applicable repository instructions and the code needed to understand the behavior. When a PR diff alone is insufficient, create an isolated temporary worktree under `/tmp` for the PR branch. Never switch, reset, or modify the user's active working tree; remove only the temporary worktree created by this review.
4. For GitLab, Bitbucket, Gerrit, Azure DevOps, Slack, Teams, Discord, or another platform, use the supplied context or an available platform integration. For chat, design, handoff, incident, meeting, or personal-message work, use the same rule. If the relevant thread is unavailable, ask the user to paste it rather than inventing details.
5. Run a focused test only when it materially validates a concern or a risky code change. Do not run tests that could affect production or external systems.

## Choose the response mode

- **Code review:** Review relevant dimensions without a fixed severity order. Draft a comment only when the finding directly affects the code: correctness, tests when needed, maintainability, formatting, naming, refactor scope, performance, security, or a pre-existing issue. Do not automatically skip formatting, naming, or out-of-scope refactor concerns merely because they appear subjective or are normally handled by tooling.
- **Issue or ticket review:** Clarify ambiguous behavior, identify risks, recommend a path, or confirm the implementation scope in the user's voice.
- **Technical discussion or design feedback:** Draft a collaborative response that states the technical view, explains its concrete consequence, and opens a productive next step.
- **Handoff, coordination, incident, or meeting preparation:** Draft a personal message that makes the current state, concern, owner, or requested next step clear without turning it into formal documentation.
- **Personal message review:** Rewrite the user's rough draft for clarity, warmth, or appropriate directness while retaining its intent and voice.

## Draft requirements

- When context is incomplete but a concern is plausible, still draft a recommendation. Use natural collaborative wording that leaves room for missing context, but do not add an assumptions disclaimer or private explanation.
- Put PR findings on the most relevant changed line. A finding outside a PR diff must be a PR-level draft that explicitly references `path:line`, because it cannot reliably be published as a native inline GitHub review comment. For issues, tickets, and threads, reply to the specific point or use a clear code reference when appropriate.
- Do not add severity labels, a private rationale, or an assumptions notice. Do not force a comment when there is no useful finding.
- Suggest concrete code changes with GitHub suggestion blocks (```suggestion) when the fix is clear, localized, and actionable (e.g. typos, naming, short refactoring, or bug fixes). For conceptual or design discussions, explain the rationale collaboratively without forcing a code replacement.
- Return a main draft for each useful message. Provide a genuinely different alternative draft when varying the tone, directness, or approach helps the user choose the right angle; for simple typos or straightforward minor comments, an alternative draft is optional to keep context concise.
- When a PR has no concern, include varied approval or appreciation drafts rather than reusing a fixed `LGTM` or `Approved` template.

## Delivery after confirmation

- Wait for a separate, explicit confirmation from the user before posting. It must clearly identify the displayed main draft or alternative and its target destination. If the text, selected version, or destination changes, show the updated draft and ask again.
- A confirmation authorizes exactly one message delivery action. For multiple messages, list every chosen draft and destination before asking for confirmation; never infer bulk permission from a general acknowledgement.
- After explicit confirmation, execute the posting action matching the platform:
  - **GitHub (`gh`):** Use `gh pr comment` or `gh api` to post the comment/reply. Never submit a review, request changes, or approve PRs without separate instructions.
  - **GitLab (`glab`):** Use `glab mr note` or `glab mr comment` when GitLab CLI is authenticated.
  - **Slack / Discord:** If an incoming webhook URL was explicitly supplied by the user, post using a `curl` JSON payload (`{"text": "..."}`). Never leak tokens or credentials.
  - Other platforms remain draft-only for manual copy-pasting unless a confirmed tool integration is available.
- Report whether the message was sent and where it was posted. If posting fails, state clearly that it was not sent; do not retry or alter destinations without explicit instructions.

## Output format

Write Markdown for the user to inspect. Use the section that matches the response mode:

```markdown
## Draft review

### Inline — `path/to/file.ext:42`
**Versi utama**
> Draft comment (boleh menyertakan ```suggestion jika relevan)

**Alternatif** *(opsional untuk temuan minor/typo)*
> Draft comment

### General thread or PR-level — `path/to/older-file.ext:18`
**Versi utama**
> Draft comment

**Alternatif**
> Draft comment
```

For a non-review response, replace the location heading with a clear context heading such as `### Technical discussion`, `### Handoff`, or `### Incident update`. Omit sections with no drafts. Keep the output limited to copy-ready drafts and their target locations; do not add private explanations. After drafts intended for GitHub, state that the selected version can be posted only after the user explicitly confirms it.
