import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { packageMetadata, root, runNpm, runNode } from "./lib.mjs";

const argument = process.argv[2];
if (!argument)
  throw new Error("Usage: npm run test:package -- path/to/package.tgz");
const tarball = path.resolve(argument);
const metadata = await packageMetadata();
const temporary = await mkdtemp(
  path.join(os.tmpdir(), "my-bahasa-gweh-package-"),
);
try {
  const installation = path.join(temporary, "installation");
  const environment = {
    ...process.env,
    HOME: temporary,
    USERPROFILE: temporary,
    XDG_CONFIG_HOME: path.join(temporary, "config"),
  };
  for (const key of Object.keys(environment)) {
    if (/^npm_config_allow_scripts/iu.test(key)) delete environment[key];
  }
  runNpm(
    [
      "install",
      "--prefix",
      installation,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      tarball,
    ],
    { cwd: temporary, env: environment },
  );
  const installed = path.join(installation, "node_modules", metadata.name);
  const installedMetadata = JSON.parse(
    await readFile(path.join(installed, "package.json"), "utf8"),
  );
  assert.equal(
    installedMetadata.bin["my-bahasa-gweh"],
    "bin/my-bahasa-gweh.js",
  );
  const binary = path.join(installed, installedMetadata.bin["my-bahasa-gweh"]);
  const version = runNode([binary, "--version"], {
    cwd: root,
    env: environment,
    stdio: "pipe",
  });
  assert.equal(version.trim(), `my-bahasa-gweh v${metadata.version}`);
  const help = runNode([binary, "--help"], {
    cwd: root,
    env: environment,
    stdio: "pipe",
  });
  assert.match(help, /Usage:.*my-bahasa-gweh/u);
  console.log(
    `Installed tarball passed: --version and --help (${metadata.version}).`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
