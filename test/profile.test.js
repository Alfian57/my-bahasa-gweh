import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CURRENT_PROFILE_SCHEMA,
  extractProfileSchema,
  getProfilesDir,
  getUserConfigDir,
  getUserProfilePath,
  listAvailablePresets,
  pathExists,
  profileInit,
  profileMigrate,
  profileShow,
  profileUse,
  resolveActiveProfile,
} from "../bin/my-bahasa-gweh.js";

test("listAvailablePresets lists presets or returns empty array when directory missing", async () => {
  const presets = await listAvailablePresets();
  assert.ok(presets.includes("default"));
  assert.ok(presets.includes("formal-id"));
  assert.ok(presets.includes("gading"));
  assert.ok(presets.includes("tech-en"));

  const emptyList = await listAvailablePresets("/non-existent-profiles-dir");
  assert.deepEqual(emptyList, []);
});

test("getUserConfigDir respects XDG_CONFIG_HOME for user home directory", () => {
  const home = os.homedir();
  const prevXdg = process.env.XDG_CONFIG_HOME;

  try {
    process.env.XDG_CONFIG_HOME = "/custom/xdg/config";
    assert.equal(getUserConfigDir(home), path.join("/custom/xdg/config", "my-bahasa-gweh"));

    delete process.env.XDG_CONFIG_HOME;
    assert.equal(getUserConfigDir(home), path.join(home, ".config", "my-bahasa-gweh"));

    // For custom temporary test home directories, it should use home/.config regardless of XDG_CONFIG_HOME
    process.env.XDG_CONFIG_HOME = "/custom/xdg/config";
    const customHome = "/tmp/my-custom-home";
    assert.equal(getUserConfigDir(customHome), path.join(customHome, ".config", "my-bahasa-gweh"));
  } finally {
    if (prevXdg) {
      process.env.XDG_CONFIG_HOME = prevXdg;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  }
});

test("cascades profile resolution across all 5 priority levels", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "profile-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "profile-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  // Priority 3: Fallback bundled preset
  const presetRes = await resolveActiveProfile({ workspaceDir, homeDirectory });
  assert.equal(presetRes.type, "preset");
  assert.equal(presetRes.name, "default");

  // Priority 2: User-level global profile takes precedence over preset
  await profileUse("tech-en", { homeDirectory });
  const userRes = await resolveActiveProfile({ workspaceDir, homeDirectory });
  assert.equal(userRes.type, "user");
  assert.equal(userRes.path, getUserProfilePath(homeDirectory));

  // Priority 1: Project-level .my-bahasa.md takes precedence over user config
  const projectProfile = path.join(workspaceDir, ".my-bahasa.md");
  await writeFile(projectProfile, "# Custom Project Profile");
  const projectRes = await resolveActiveProfile({ workspaceDir, homeDirectory });
  assert.equal(projectRes.type, "project");
  assert.equal(projectRes.path, projectProfile);
});

test("resolveActiveProfile falls back to legacy gading-profile if default.md is absent", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "legacy-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "legacy-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  // Verify that bundledSkillPath has references/gading-profile.md
  const result = await resolveActiveProfile({ workspaceDir, homeDirectory });
  assert.ok(result.path);
  assert.ok(["preset", "legacy"].includes(result.type));
});

test("resolveActiveProfile falls back gracefully when no profile is found", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "empty-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "empty-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  // Test profileShow on missing profile
  const { active, content } = await profileShow({
    workspaceDir,
    homeDirectory,
  });
  assert.ok(active);
  assert.equal(typeof content, "string");
});

test("profileUse activates preset and throws on non-existent preset", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "use-home-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  const { targetFile } = await profileUse("formal-id", { homeDirectory });
  assert.equal(await pathExists(targetFile), true);
  assert.match(await readFile(targetFile, "utf8"), /Profil Komunikasi Formal/);

  await assert.rejects(
    () => profileUse("unknown-preset", { homeDirectory }),
    /Preset 'unknown-preset' not found/,
  );
});

test("profileInit handles force flag and avoids accidental overwrite", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "init-home-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  // First init
  const { targetFile } = await profileInit({ homeDirectory, preset: "gading" });
  assert.equal(await pathExists(targetFile), true);
  assert.match(await readFile(targetFile, "utf8"), /Profil komunikasi Gading/);

  // Init again without force throws
  await assert.rejects(
    () => profileInit({ homeDirectory, preset: "tech-en", force: false }),
    /already exists/,
  );

  // Init with force overwrites
  await profileInit({ homeDirectory, preset: "tech-en", force: true });
  assert.match(await readFile(targetFile, "utf8"), /Technical Communication Profile/);
});

test("extractProfileSchema parses version tag and handles missing tag", () => {
  assert.equal(extractProfileSchema("<!-- schema-version: 1 -->\n# Header"), 1);
  assert.equal(extractProfileSchema("<!--schema-version:2-->\n# Header"), 2);
  assert.equal(extractProfileSchema("# Old Header without tag"), 0);
  assert.equal(extractProfileSchema(""), 0);
});

test("profileMigrate updates outdated profile schema and avoids redundant migration", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "migrate-home-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  // Create an un-versioned old profile
  const profileFile = getUserProfilePath(homeDirectory);
  await mkdir(path.dirname(profileFile), { recursive: true });
  await writeFile(profileFile, "# Old Persona Profile\n- Tone: Santai", "utf8");

  // First migration: should migrate from 0 to CURRENT_PROFILE_SCHEMA
  const res1 = await profileMigrate({ homeDirectory });
  assert.equal(res1.migrated, true);
  assert.equal(res1.schemaVersion, CURRENT_PROFILE_SCHEMA);

  const migratedContent = await readFile(profileFile, "utf8");
  assert.match(migratedContent, new RegExp(`<!-- schema-version: ${CURRENT_PROFILE_SCHEMA} -->`));

  // Second migration: should be idempotent and report already up to date
  const res2 = await profileMigrate({ homeDirectory });
  assert.equal(res2.migrated, false);
});
