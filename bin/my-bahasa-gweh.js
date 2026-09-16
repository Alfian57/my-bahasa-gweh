#!/usr/bin/env node

import { cp, lstat, mkdir, realpath, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillId = "my-bahasa-gweh";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundledSkillPath = path.join(packageRoot, "skill");

function usage() {
  return `Usage: my-bahasa-gweh install

Install the ${skillId} skill for Codex, OpenCode, and Antigravity.
The command copies the bundled skill into ~/.agents/skills and links it from
Antigravity's global skills directory. It never overwrites an existing install.`;
}

async function pathExists(targetPath) {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export function resolveInstallPaths(homeDirectory = os.homedir()) {
  const skillPath = path.join(homeDirectory, ".agents", "skills", skillId);
  return {
    skillPath,
    antigravityPath: path.join(
      homeDirectory,
      ".gemini",
      "config",
      "skills",
      skillId,
    ),
  };
}

async function isCorrectAntigravityLink(linkPath, skillPath) {
  const stats = await lstat(linkPath);
  if (!stats.isSymbolicLink()) return false;

  return (await realpath(linkPath)) === (await realpath(skillPath));
}

export async function install({ homeDirectory = os.homedir() } = {}) {
  if (!(await pathExists(bundledSkillPath))) {
    throw new Error(`Bundled skill is missing: ${bundledSkillPath}`);
  }

  const { skillPath, antigravityPath } = resolveInstallPaths(homeDirectory);

  if (await pathExists(skillPath)) {
    throw new Error(
      `Refusing to overwrite existing skill: ${skillPath}. Remove or rename it before installing.`,
    );
  }

  if (await pathExists(antigravityPath)) {
    if (!(await isCorrectAntigravityLink(antigravityPath, skillPath))) {
      throw new Error(
        `Refusing to overwrite existing Antigravity skill path: ${antigravityPath}.`,
      );
    }
  }

  await mkdir(path.dirname(skillPath), { recursive: true });
  await cp(bundledSkillPath, skillPath, { recursive: true, force: false, errorOnExist: true });

  try {
    if (!(await pathExists(antigravityPath))) {
      await mkdir(path.dirname(antigravityPath), { recursive: true });
      await symlink(skillPath, antigravityPath, "dir");
    }
  } catch (error) {
    await rm(skillPath, { recursive: true, force: true });
    throw error;
  }

  return { skillPath, antigravityPath };
}

export async function runCli(argv = process.argv.slice(2), output = console.log) {
  const [command] = argv;

  if (command === "--help" || command === "-h" || command === "help") {
    output(usage());
    return;
  }

  if (command !== "install") {
    throw new Error(usage());
  }

  const { skillPath, antigravityPath } = await install();
  output(`Installed ${skillId} at ${skillPath}`);
  output(`Linked Antigravity to ${antigravityPath}`);
}

async function isCliEntrypoint() {
  if (!process.argv[1]) return false;
  return (await realpath(process.argv[1])) === (await realpath(fileURLToPath(import.meta.url)));
}

if (await isCliEntrypoint()) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
