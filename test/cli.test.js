import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

import {
  compareSemver,
  exportRules,
  generateInteractiveDraft,
  generatePreviewScenarios,
  injectRuleBlock,
  parseProfileConfig,
  pathExists,
  resolveInstallPaths,
  runCli,
  skillId,
  upgradeCli,
  usage,
} from "../bin/my-bahasa-gweh.js";

test("runCli displays help usage for --help, -h, help, and empty argv", async () => {
  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  for (const flag of [["--help"], ["-h"], ["help"], []]) {
    outputs.length = 0;
    await runCli(flag, capture);
    assert.match(outputs[0], /Usage:.*my-bahasa-gweh/);
    assert.match(outputs[0], /install/);
    assert.match(outputs[0], /update/);
    assert.match(outputs[0], /uninstall/);
    assert.match(outputs[0], /doctor/);
    assert.match(outputs[0], /wizard/);
    assert.match(outputs[0], /profile/);
  }
});

test("runCli outputs version for --version, -v, and version command", async () => {
  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  for (const flag of [["--version"], ["-v"], ["version"]]) {
    outputs.length = 0;
    await runCli(flag, capture);
    assert.match(outputs[0], /^my-bahasa-gweh v\d+\.\d+\.\d+/);
  }
});

test("runCli throws descriptive error for unknown command", async () => {
  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  await assert.rejects(
    () => runCli(["non-existent-cmd"], capture),
    /Unknown command 'non-existent-cmd'/,
  );
});

test("runCli throws descriptive error for unknown profile subaction", async () => {
  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  await assert.rejects(
    () => runCli(["profile", "invalid-subaction"], capture),
    /Unknown profile subaction 'invalid-subaction'/,
  );
});

test("runCli throws error when profile use is called without preset name", async () => {
  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  await assert.rejects(
    () => runCli(["profile", "use"], capture),
    /Usage: my-bahasa-gweh profile use <preset>/,
  );
});

test("runCli executes profile list, profile active, profile show, and doctor formatting cleanly", async () => {
  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  // Profile list
  await runCli(["profile", "list"], capture);
  assert.ok(outputs.some((line) => line.includes("Available Profile Presets:")));
  assert.ok(outputs.some((line) => line.includes("default")));

  // Profile active / current
  outputs.length = 0;
  await runCli(["profile", "active"], capture);
  assert.ok(outputs.some((line) => line.includes("Active Persona Profile:")));
  assert.ok(outputs.some((line) => line.includes("Name:")));
  assert.ok(outputs.some((line) => line.includes("Type:")));

  outputs.length = 0;
  await runCli(["profile", "current"], capture);
  assert.ok(outputs.some((line) => line.includes("Active Persona Profile:")));

  // Profile show
  outputs.length = 0;
  await runCli(["profile", "show"], capture);
  assert.ok(outputs.some((line) => line.includes("Active Profile")));

  // Doctor
  outputs.length = 0;
  await runCli(["doctor"], capture);
  assert.ok(outputs.some((line) => line.includes("Environment & Skill Health Report:")));
  assert.ok(outputs.some((line) => line.includes("Node.js:")));
  assert.ok(outputs.some((line) => line.includes("Skill:")));
  assert.ok(outputs.some((line) => line.includes("Antigravity:")));
});

test("runCli executes install, update, and uninstall commands with isolated home", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "cli-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "cli-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  const { skillPath, antigravityPath } = resolveInstallPaths(homeDirectory);

  // 1. Run install
  await runCli(["install"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Installed") && line.includes(skillId)));
  assert.equal(await pathExists(skillPath), true);
  assert.equal(await pathExists(antigravityPath), true);

  // 2. Run update
  outputs.length = 0;
  await runCli(["update"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Updated") && line.includes(skillId)));

  // 3. Run profile use
  outputs.length = 0;
  await runCli(["profile", "use", "formal-id"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Activated profile") && line.includes("formal-id")));

  // 4. Run uninstall
  outputs.length = 0;
  await runCli(["uninstall"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Removed skill from")));
  assert.equal(await pathExists(skillPath), false);
  assert.equal(await pathExists(antigravityPath), false);

  // 5. Run uninstall again (idempotent)
  outputs.length = 0;
  await runCli(["uninstall"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Skill was not installed")));
});

test("CLI binary executes directly as a child process", async () => {
  const cliPath = path.resolve("bin/my-bahasa-gweh.js");

  // 1. Success exit code (0) for --help
  const { stdout } = await execFileAsync(process.execPath, [cliPath, "--help"]);
  assert.match(stdout, /Usage:.*my-bahasa-gweh/);

  // 2. Non-zero exit code (1) and stderr output for unknown command
  await assert.rejects(
    async () => {
      await execFileAsync(process.execPath, [cliPath, "unknown-cmd"]);
    },
    (err) => {
      assert.equal(err.code, 1);
      assert.match(err.stderr, /Unknown command 'unknown-cmd'/);
      return true;
    },
  );
});

test("runCli export generates rules globally with zero repo pollution", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "export-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "export-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  // 1. Run export with --local flag (should warn and maintain zero repo pollution)
  await runCli(["export", "--local", "--all"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Exported AI communication rules")));
  assert.ok(outputs.some((line) => line.includes("Per-project local export is disabled")));
  // Ensure workspaceDir was NOT polluted
  assert.equal(await pathExists(path.join(workspaceDir, ".cursorrules")), false);
  assert.equal(await pathExists(path.join(workspaceDir, "CLAUDE.md")), false);
  assert.equal(await pathExists(path.join(workspaceDir, ".windsurfrules")), false);

  // 2. Run standard global export through CLI
  outputs.length = 0;
  await runCli(["export", "--global"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Exported AI communication rules")));
  assert.equal(await pathExists(path.join(homeDirectory, ".claude", "CLAUDE.md")), true);
  assert.equal(await pathExists(path.join(homeDirectory, ".cursorrules")), true);
  assert.equal(
    await pathExists(path.join(homeDirectory, ".cursor", "rules", "my-bahasa-gweh.mdc")),
    true,
  );
  assert.equal(
    await pathExists(
      path.join(homeDirectory, ".codeium", "windsurf", "memories", "global_rules.md"),
    ),
    true,
  );
  assert.equal(await pathExists(path.join(homeDirectory, ".windsurfrules")), true);
});

test("runCli profile migrate executes cleanly through CLI router", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "mig-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "mig-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  // Run profile migrate through CLI router
  await runCli(["profile", "migrate"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Migrated profile schema") || line.includes("already up to date")));
});

test("injectRuleBlock inserts markers and preserves surrounding user rules non-destructively", () => {
  const existingRules = "# Team Core Guidelines\n\n- Write unit tests\n- Clean architecture";
  const ruleBlock = "# AI Voice Persona\n- Tone: Santai";

  // 1. First injection appends with markers
  const injected = injectRuleBlock(existingRules, ruleBlock);
  assert.match(injected, /# Team Core Guidelines/);
  assert.match(injected, /<!-- my-bahasa-gweh:start -->/);
  assert.match(injected, /# AI Voice Persona/);
  assert.match(injected, /<!-- my-bahasa-gweh:end -->/);

  // 2. Second injection updates between markers without modifying surrounding text
  const updatedBlock = "# AI Voice Persona v2\n- Tone: Formal";
  const updatedInjected = injectRuleBlock(injected, updatedBlock);
  assert.match(updatedInjected, /# Team Core Guidelines/);
  assert.match(updatedInjected, /# AI Voice Persona v2/);
  assert.doesNotMatch(updatedInjected, /# AI Voice Persona\n/);
});

test("exportRules preserves existing user rules in global CLAUDE.md and .cursorrules", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "export-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "export-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  const { mkdir, writeFile, readFile } = await import("node:fs/promises");
  const claudeGlobalDir = path.join(homeDirectory, ".claude");
  await mkdir(claudeGlobalDir, { recursive: true });
  const claudePath = path.join(claudeGlobalDir, "CLAUDE.md");
  await writeFile(claudePath, "# Important Company Security Rules\n\n- No external network calls", "utf8");

  // Run global export specifically targeting claude
  await exportRules({ homeDirectory, targets: ["claude"] });

  const result = await readFile(claudePath, "utf8");
  assert.match(result, /# Important Company Security Rules/);
  assert.match(result, /<!-- my-bahasa-gweh:start -->/);
  assert.match(result, /AI Communication Persona Rules/);
  assert.match(result, /<!-- my-bahasa-gweh:end -->/);
});

test("compareSemver compares version numbers accurately", () => {
  assert.equal(compareSemver("0.3.1", "0.3.2"), -1);
  assert.equal(compareSemver("0.4.0", "0.3.1"), 1);
  assert.equal(compareSemver("0.3.1", "0.3.1"), 0);
  assert.equal(compareSemver("v1.0.0", "0.9.9"), 1);
  assert.equal(compareSemver("0.3.0", "v0.3.1"), -1);
});

test("parseProfileConfig, generatePreviewScenarios, and generateInteractiveDraft format drafts accurately", () => {
  const profileSample = `
# Profil Komunikasi - TestUser
## Bahasa dan Sapaan
- Bahasa Utama: Bahasa Indonesia santai dan kolaboratif.
- Kata Ganti: "saya"
- Sapaan: Gunakan sapaan "bro" untuk rekan kerja.
## Nada dan Gaya Bicara (Voice & Tone)
- Tingkat Ketegasan: Lugas dan tegas secara teknis.
- Kebijakan Emoji: Santai dan ekspresif bila membantu kehangatan suasana.
`;

  const config = parseProfileConfig(profileSample);
  assert.equal(config.salutation, "bro");
  assert.equal(config.pronoun, "saya");
  assert.equal(config.directness, "direct");
  assert.equal(config.emoji, "free");

  const scenarios = generatePreviewScenarios(config);
  assert.equal(scenarios.length, 4);
  assert.match(scenarios[0].text, /bro/);
  assert.match(scenarios[0].text, /```suggestion/);

  const draft = generateInteractiveDraft("race condition di caching", config);
  assert.match(draft.main, /race condition di caching/);
  assert.match(draft.alternative, /race condition di caching/);
});

test("runCli preview and upgrade commands execute cleanly", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "preview-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "preview-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  // Test preview
  await runCli(["preview"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Persona Preview & Simulator")));
  assert.ok(outputs.some((line) => line.includes("Skenario Code Review")));
  assert.ok(outputs.some((line) => line.includes("Skenario PR Approval")));

  // Test upgrade when already up to date
  outputs.length = 0;
  await runCli(["upgrade"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Memeriksa npm registry")));
});
