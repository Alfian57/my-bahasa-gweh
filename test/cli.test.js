import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

import {
  exportRules,
  injectRuleBlock,
  pathExists,
  resolveInstallPaths,
  runCli,
  usage,
} from "../bin/my-bahasa-gweh.js";

test("runCli displays help usage for --help, -h, help, and empty argv", async () => {
  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  for (const flag of [["--help"], ["-h"], ["help"], []]) {
    outputs.length = 0;
    await runCli(flag, capture);
    assert.match(outputs[0], /Usage: my-bahasa-gweh/);
    assert.match(outputs[0], /install/);
    assert.match(outputs[0], /update/);
    assert.match(outputs[0], /uninstall/);
    assert.match(outputs[0], /doctor/);
    assert.match(outputs[0], /wizard/);
    assert.match(outputs[0], /profile/);
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

test("runCli executes profile list, profile show, and doctor formatting cleanly", async () => {
  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  // Profile list
  await runCli(["profile", "list"], capture);
  assert.ok(outputs.some((line) => line.includes("Available Profile Presets:")));
  assert.ok(outputs.some((line) => line.includes("default")));

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
  assert.ok(outputs.some((line) => line.includes("Installed my-bahasa-gweh")));
  assert.equal(await pathExists(skillPath), true);
  assert.equal(await pathExists(antigravityPath), true);

  // 2. Run update
  outputs.length = 0;
  await runCli(["update"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Updated my-bahasa-gweh")));

  // 3. Run profile use
  outputs.length = 0;
  await runCli(["profile", "use", "formal-id"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Activated profile 'formal-id'")));

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
  assert.match(stdout, /Usage: my-bahasa-gweh/);

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

test("runCli export generates rules locally and globally", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "export-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "export-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  const outputs = [];
  const capture = (msg) => outputs.push(msg);

  // 1. Run local export through CLI
  await runCli(["export", "--local", "--all"], capture, { homeDirectory, workspaceDir });
  assert.ok(outputs.some((line) => line.includes("Exported AI communication rules")));
  assert.equal(await pathExists(path.join(workspaceDir, ".cursorrules")), true);
  assert.equal(await pathExists(path.join(workspaceDir, "CLAUDE.md")), true);
  assert.equal(await pathExists(path.join(workspaceDir, ".windsurfrules")), true);

  // 2. Run global export through CLI
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

test("exportRules preserves existing project rules in CLAUDE.md and .cursorrules", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "export-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "export-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  const claudePath = path.join(workspaceDir, "CLAUDE.md");
  const { writeFile, readFile } = await import("node:fs/promises");
  await writeFile(claudePath, "# Important Company Security Rules\n\n- No external network calls", "utf8");

  // Run export specifically targeting claude in workspace
  await exportRules({ workspaceDir, homeDirectory, targets: ["claude"], isGlobal: false });

  const result = await readFile(claudePath, "utf8");
  assert.match(result, /# Important Company Security Rules/);
  assert.match(result, /<!-- my-bahasa-gweh:start -->/);
  assert.match(result, /AI Communication Persona Rules/);
  assert.match(result, /<!-- my-bahasa-gweh:end -->/);
});
