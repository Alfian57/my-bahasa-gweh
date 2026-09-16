import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { install, resolveInstallPaths } from "../bin/my-bahasa-gweh.js";

test("installs one shared skill for all supported agents", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "my-bahasa-gweh-test-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  const { skillPath, antigravityPath } = await install({ homeDirectory });

  assert.match(await readFile(path.join(skillPath, "SKILL.md"), "utf8"), /name: my-bahasa-gweh/);
  assert.match(
    await readFile(path.join(skillPath, "references", "gading-profile.md"), "utf8"),
    /Profil komunikasi Gading/,
  );
  assert.equal((await lstat(antigravityPath)).isSymbolicLink(), true);
  assert.equal(await realpath(antigravityPath), await realpath(skillPath));
});

test("does not overwrite an existing skill", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "my-bahasa-gweh-test-"));
  t.after(() => rm(homeDirectory, { recursive: true, force: true }));

  await install({ homeDirectory });
  const { skillPath } = resolveInstallPaths(homeDirectory);

  await assert.rejects(() => install({ homeDirectory }), new RegExp(skillPath));
});
