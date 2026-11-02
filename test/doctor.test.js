import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkGhCli, checkGlabCli, doctor, install, resolveInstallPaths } from "../bin/my-bahasa-gweh.js";

test("doctor reports completely healthy when all components and gh are ready", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "doc-home-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  await install({ homeDirectory });

  const mockGhSuccess = async () => ({
    installed: true,
    authenticated: true,
    details: "Logged in to github.com as testuser",
  });

  const report = await doctor({ homeDirectory, checkGh: mockGhSuccess });

  assert.equal(report.healthy, true);
  assert.equal(report.node.ok, true);
  assert.equal(report.skill.exists, true);
  assert.equal(report.skill.valid, true);
  assert.equal(report.antigravity.exists, true);
  assert.equal(report.antigravity.validLink, true);
  assert.equal(report.gh.installed, true);
  assert.equal(report.gh.authenticated, true);
  assert.ok(report.profile.path);
});

test("doctor reports missing GitHub CLI gracefully without crash", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "doc-home-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  await install({ homeDirectory });

  const mockGhMissing = async () => ({
    installed: false,
    authenticated: false,
    details: "gh command not found in PATH",
  });

  const report = await doctor({ homeDirectory, checkGh: mockGhMissing });

  // Doctor is still considered healthy if skill and link are fine (gh is optional for drafting)
  assert.equal(report.healthy, true);
  assert.equal(report.gh.installed, false);
  assert.equal(report.gh.authenticated, false);
  assert.match(report.gh.details, /not found in PATH/);
});

test("doctor reports unauthenticated GitHub CLI state", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "doc-home-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  await install({ homeDirectory });

  const mockGhUnauth = async () => ({
    installed: true,
    authenticated: false,
    details: "You are not logged into any GitHub hosts. Run gh auth login.",
  });

  const report = await doctor({ homeDirectory, checkGh: mockGhUnauth });

  assert.equal(report.gh.installed, true);
  assert.equal(report.gh.authenticated, false);
  assert.match(report.gh.details, /not logged into/);
});

test("doctor detects incomplete or corrupted skill files", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "doc-home-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  const { skillPath, antigravityPath } = resolveInstallPaths(homeDirectory);

  // Create skillPath with only an empty file (missing SKILL.md and profiles)
  await mkdir(skillPath, { recursive: true });
  await writeFile(path.join(skillPath, "random.txt"), "hello");

  const report = await doctor({ homeDirectory });

  assert.equal(report.healthy, false);
  assert.equal(report.skill.exists, true);
  assert.equal(report.skill.valid, false);
  assert.equal(report.antigravity.exists, false);
});

test("doctor detects invalid/broken antigravity link", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "doc-home-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  await install({ homeDirectory });
  const { antigravityPath } = resolveInstallPaths(homeDirectory);

  // Replace symlink with a regular empty directory
  await rm(antigravityPath, { recursive: true, force: true });
  await mkdir(antigravityPath, { recursive: true });

  const report = await doctor({ homeDirectory });

  assert.equal(report.healthy, false);
  assert.equal(report.antigravity.exists, true);
  assert.equal(report.antigravity.validLink, false);
});

test("doctor reports unhealthy when Node version is lower than 18", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "doc-home-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  await install({ homeDirectory });

  const report = await doctor({
    homeDirectory,
    nodeVersion: "v16.14.0",
    checkGh: async () => ({ installed: true, authenticated: true, details: "OK" }),
  });

  assert.equal(report.healthy, false);
  assert.equal(report.node.ok, false);
  assert.equal(report.node.version, "v16.14.0");
});

test("checkGhCli returns valid structure in real environment", async () => {
  const result = await checkGhCli();
  assert.equal(typeof result.installed, "boolean");
  assert.equal(typeof result.authenticated, "boolean");
  assert.equal(typeof result.details, "string");
});

test("checkGlabCli returns valid structure in real environment", async () => {
  const result = await checkGlabCli();
  assert.equal(typeof result.installed, "boolean");
  assert.equal(typeof result.authenticated, "boolean");
  assert.equal(typeof result.details, "string");
});
