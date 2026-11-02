import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  getSymlinkType,
  install,
  isCorrectAntigravityLink,
  pathExists,
  resolveInstallPaths,
  uninstall,
  update,
} from "../bin/my-bahasa-gweh.js";

test("installs one shared skill for all supported agents", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "install-test-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  const { skillPath, antigravityPath } = await install({ homeDirectory });

  assert.match(await readFile(path.join(skillPath, "SKILL.md"), "utf8"), /name: my-bahasa-gweh/);
  assert.equal(await pathExists(path.join(skillPath, "profiles", "default.md")), true);
  assert.equal(await pathExists(path.join(skillPath, "profiles", "gading.md")), true);
  assert.equal((await lstat(antigravityPath)).isSymbolicLink(), true);
  assert.equal(await realpath(antigravityPath), await realpath(skillPath));
});

test("does not overwrite an existing skill without force flag", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "install-test-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  await install({ homeDirectory });
  const { skillPath } = resolveInstallPaths(homeDirectory);

  await assert.rejects(
    () => install({ homeDirectory }),
    (err) => {
      assert.match(err.message, /Refusing to overwrite existing skill/);
      assert.ok(err.message.includes(skillPath));
      return true;
    },
  );
});

test("successfully overwrites existing skill when force is true", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "install-test-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  await install({ homeDirectory });
  const { skillPath } = resolveInstallPaths(homeDirectory);

  const markerFile = path.join(skillPath, "marker.txt");
  await writeFile(markerFile, "temporary marker");
  assert.equal(await pathExists(markerFile), true);

  await install({ homeDirectory, force: true });
  assert.equal(await pathExists(markerFile), false);
  assert.match(await readFile(path.join(skillPath, "SKILL.md"), "utf8"), /name: my-bahasa-gweh/);
});

test("update command refreshes existing installation", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "install-test-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  await install({ homeDirectory });
  const { skillPath, antigravityPath } = resolveInstallPaths(homeDirectory);

  const result = await update({ homeDirectory });
  assert.equal(result.skillPath, skillPath);
  assert.equal(result.antigravityPath, antigravityPath);
  assert.equal(await pathExists(skillPath), true);
  assert.equal(await pathExists(antigravityPath), true);
});

test("recovers cleanly from broken/dangling symlink when force is true", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "install-test-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  const { skillPath, antigravityPath } = resolveInstallPaths(homeDirectory);

  // Manually create a broken symlink at antigravityPath pointing to non-existent location
  await mkdir(path.dirname(antigravityPath), { recursive: true });
  const nonExistentTarget = path.join(homeDirectory, "does-not-exist");
  await symlink(nonExistentTarget, antigravityPath, getSymlinkType());

  assert.equal(await pathExists(antigravityPath), true);
  assert.equal(await isCorrectAntigravityLink(antigravityPath, skillPath), false);

  // Install with force should remove the broken link and establish the valid one
  await install({ homeDirectory, force: true });
  assert.equal(await isCorrectAntigravityLink(antigravityPath, skillPath), true);
});

test("refuses to overwrite directory collision at antigravityPath without force", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "install-test-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  const { skillPath, antigravityPath } = resolveInstallPaths(homeDirectory);

  // Create a regular directory (not a symlink) at antigravityPath
  await mkdir(antigravityPath, { recursive: true });
  await writeFile(path.join(antigravityPath, "dummy.txt"), "collision file");

  await assert.rejects(
    () => install({ homeDirectory, force: false }),
    /Refusing to overwrite existing Antigravity skill path/,
  );

  // Overwriting with force succeeds
  await install({ homeDirectory, force: true });
  assert.equal((await lstat(antigravityPath)).isSymbolicLink(), true);
  assert.equal(await isCorrectAntigravityLink(antigravityPath, skillPath), true);
});

test("uninstall removes skill directory and symlink cleanly and is idempotent", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "install-test-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  await install({ homeDirectory });
  const { skillPath, antigravityPath } = resolveInstallPaths(homeDirectory);

  assert.equal(await pathExists(skillPath), true);
  assert.equal(await pathExists(antigravityPath), true);

  const result = await uninstall({ homeDirectory });
  assert.equal(result.uninstalledSkill, true);
  assert.equal(result.uninstalledAntigravity, true);

  assert.equal(await pathExists(skillPath), false);
  assert.equal(await pathExists(antigravityPath), false);

  // Uninstall again on clean slate
  const secondResult = await uninstall({ homeDirectory });
  assert.equal(secondResult.uninstalledSkill, false);
  assert.equal(secondResult.uninstalledAntigravity, false);
});

test("uninstall handles partial states (only skillPath or only antigravityPath)", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "install-test-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  const { skillPath, antigravityPath } = resolveInstallPaths(homeDirectory);

  // Scenario 1: Only skillPath exists
  await mkdir(skillPath, { recursive: true });
  const res1 = await uninstall({ homeDirectory });
  assert.equal(res1.uninstalledSkill, true);
  assert.equal(res1.uninstalledAntigravity, false);

  // Scenario 2: Only antigravityPath exists
  await mkdir(antigravityPath, { recursive: true });
  const res2 = await uninstall({ homeDirectory });
  assert.equal(res2.uninstalledSkill, false);
  assert.equal(res2.uninstalledAntigravity, true);
});

test("isCorrectAntigravityLink returns false for non-symlink or mismatched target", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "link-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const normalDir = path.join(dir, "normal");
  const targetDir = path.join(dir, "target");
  const wrongTargetDir = path.join(dir, "wrong");
  await mkdir(normalDir);
  await mkdir(targetDir);
  await mkdir(wrongTargetDir);

  // Not a symlink
  assert.equal(await isCorrectAntigravityLink(normalDir, targetDir), false);

  // Symlink to wrong target
  const symlinkPath = path.join(dir, "symlink");
  await symlink(wrongTargetDir, symlinkPath, getSymlinkType());
  assert.equal(await isCorrectAntigravityLink(symlinkPath, targetDir), false);

  // Symlink to correct target
  await rm(symlinkPath);
  await symlink(targetDir, symlinkPath, getSymlinkType());
  assert.equal(await isCorrectAntigravityLink(symlinkPath, targetDir), true);
});

test("getSymlinkType returns junction on Windows and dir elsewhere", () => {
  const expected = os.platform() === "win32" ? "junction" : "dir";
  assert.equal(getSymlinkType(), expected);
});

test("rollback cleans up skillPath if symlink creation fails", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "install-rollback-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  const { skillPath, antigravityPath } = resolveInstallPaths(homeDirectory);

  // Make antigravityPath parent a file so mkdir/symlink will fail with ENOTDIR
  const antigravityParent = path.dirname(antigravityPath);
  await mkdir(path.dirname(antigravityParent), { recursive: true });
  await writeFile(antigravityParent, "blocking file");

  // Attempt install: should fail during symlink phase and roll back skillPath
  await assert.rejects(() => install({ homeDirectory }));

  // Verify skillPath was cleaned up and does not linger
  assert.equal(await pathExists(skillPath), false);
});
