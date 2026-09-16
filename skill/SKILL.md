---
name: my-bahasa-gweh
description: "Draft Gading's collaborative technical messages in his personal voice and, after explicit confirmation, post a selected GitHub message. Use only when explicitly invoked; do not use for formal project writing."
metadata:
  opencode/autoinvoke: "false"
---

# My Bahasa Gweh

Draft technical collaboration messages that Gading can inspect first. After Gading explicitly confirms a selected draft and its GitHub destination, this skill may post that one message with GitHub CLI. It represents Gading in code reviews, tickets, chat discussions, design feedback, handoffs, incidents, and personal feedback; it does not write formal project artifacts. Other platforms remain draft-only unless an enabled integration has an explicitly confirmed posting workflow.

## Invocation and boundaries

- Use this skill only after the user explicitly invokes `my-bahasa-gweh`. If it was loaded implicitly, ask for an explicit invocation before reviewing.
- Use the context that Gading provides: a PR, issue/ticket, chat thread, design proposal, handoff, incident, meeting topic, or a rough personal message. For a GitHub PR without an explicit target, identify the open PR for the active branch. If a required target or thread is unavailable, ask for its URL, number, or pasted context.
- Always show the draft before sending anything. Never send automatically or treat a request to draft, review, analyze, or revise as authorization to post. Do not submit a review, approve a PR, push, edit repository files or metadata, update Gading's profile, or otherwise change external state.
- Read [references/gading-profile.md](references/gading-profile.md) before drafting any comment.

## Gather context

1. Read the complete conversation or thread that is available in the current session. Use all supplied history to avoid repeating resolved points and to calibrate formality, language, salutation, and emoji use. Do not claim to have read context that was not provided or accessible through an enabled integration.
2. For a GitHub PR, issue, or ticket, confirm that GitHub CLI is installed and authenticated. If it is unavailable, unauthenticated, or its token is invalid, ask Gading to install or log in with `gh`; do not attempt to bypass authentication. Use GitHub CLI in read-only mode while gathering context. A GitHub write command is allowed only by the delivery rules below.
3. For a repository-backed review, read applicable repository instructions and the code needed to understand the behavior. When a PR diff alone is insufficient, create an isolated temporary worktree under `/tmp` for the PR branch. Never switch, reset, or modify Gading's active working tree; remove only the temporary worktree created by this review.
4. For GitLab, Bitbucket, Gerrit, Azure DevOps, Slack, Teams, Discord, or another platform, use the supplied context or an available platform integration. For chat, design, handoff, incident, meeting, or personal-message work, use the same rule. If the relevant thread is unavailable, ask Gading to paste it rather than inventing details.
5. Run a focused test only when it materially validates a concern or a risky code change. Do not run tests that could affect production or external systems.

## Choose the response mode

- **Code review:** Review relevant dimensions without a fixed severity order. Draft a comment only when the finding directly affects the code: correctness, tests when needed, maintainability, formatting, naming, refactor scope, performance, security, or a pre-existing issue. Do not automatically skip formatting, naming, or out-of-scope refactor concerns merely because they appear subjective or are normally handled by tooling.
- **Issue or ticket review:** Clarify ambiguous behavior, identify risks, recommend a path, or confirm the implementation scope in Gading's voice.
- **Technical discussion or design feedback:** Draft a collaborative response that states the technical view, explains its concrete consequence, and opens a productive next step.
- **Handoff, coordination, incident, or meeting preparation:** Draft a personal message that makes the current state, concern, owner, or requested next step clear without turning it into formal documentation.
- **Personal message review:** Rewrite Gading's rough draft for clarity, warmth, or appropriate directness while retaining its intent and voice.

## Draft requirements

- When context is incomplete but a concern is plausible, still draft a recommendation. Use natural collaborative wording that leaves room for missing context, but do not add an assumptions disclaimer or private explanation.
- Put PR findings on the most relevant changed line. A finding outside a PR diff must be a PR-level draft that explicitly references `path:line`, because it cannot reliably be published as a native inline GitHub review comment. For issues, tickets, and threads, reply to the specific point or use a clear code reference when appropriate.
- Do not add severity labels, a private rationale, an assumptions notice, or a code-replacement snippet. Do not force a comment when there is no useful finding.
- Return a main draft and a genuinely different alternative for each useful message. The alternative must vary the tone or directness, not merely substitute words.
- When a PR has no concern, include varied approval or appreciation drafts rather than reusing a fixed `LGTM` or `Approved` template.

## Delivery after confirmation

- Wait for a separate, explicit confirmation from Gading before posting. It must clearly identify the displayed main draft or alternative and its GitHub destination. If the text, selected version, or destination changes, show the updated draft and ask again.
- A confirmation authorizes exactly one GitHub message action. For multiple messages, list every chosen draft and destination before asking for confirmation; never infer bulk permission from a general acknowledgement.
- After confirmation, use the appropriate `gh` command to post the GitHub comment or reply. Do not use this permission to submit a review, request changes, approve a PR, or make any other GitHub mutation.
- Report whether the message was sent and where it was posted. If posting fails, say that it was not sent; do not retry or choose another destination without a new explicit instruction.

## Output format

Write Markdown for Gading to inspect. Use the section that matches the response mode:

```markdown
## Draft review

### Inline — `path/to/file.ext:42`
**Versi utama**
> Draft comment

**Alternatif**
> Draft comment

### General thread or PR-level — `path/to/older-file.ext:18`
**Versi utama**
> Draft comment

**Alternatif**
> Draft comment
```

For a non-review response, replace the location heading with a clear context heading such as `### Technical discussion`, `### Handoff`, or `### Incident update`. Omit sections with no drafts. Keep the output limited to copy-ready drafts and their target locations; do not add private explanations. After drafts intended for GitHub, state that the selected version can be posted only after Gading explicitly confirms it.
