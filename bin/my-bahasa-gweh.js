#!/usr/bin/env node

import { execFile } from "node:child_process";
import { cp, lstat, mkdir, readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { c } from "./colors.js";
import { runInteractiveWizard } from "./wizard.js";

const execFileAsync = promisify(execFile);

export const skillId = "my-bahasa-gweh";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const bundledSkillPath = path.join(packageRoot, "skill");

export const CURRENT_PROFILE_SCHEMA = 1;

export function extractProfileSchema(markdownContent) {
  if (!markdownContent) return 0;
  const match = markdownContent.match(/<!--\s*schema-version:\s*(\d+)\s*-->/);
  return match ? parseInt(match[1], 10) : 0;
}

export function usage() {
  return `${c.bold("Usage:")} my-bahasa-gweh <command> [options]

${c.bold("Commands:")}
  install             Install the skill globally for Codex, OpenCode, and Antigravity
  update              Update the installed skill to the latest bundled version
  uninstall           Remove the installed skill and Antigravity symlink
  doctor, status      Check installation status and environment health
  wizard              Interactive wizard to configure your persona step-by-step
  export [options]    Export persona rules globally for Claude Code, Cursor, and Windsurf
  profile <subaction> Manage communication persona profiles
    list              List available profile presets
    use <preset>      Activate a preset as your personal profile
    init [-i]         Initialize a personal profile (use -i for interactive wizard)
    wizard            Run interactive persona setup wizard
    show              Show currently active profile and content
    migrate           Migrate/update active profile to latest schema version

${c.bold("Options:")}
  --global, -g        Export rules globally to user home directory (default)
  --local, -l         Export rules locally to current workspace directory
  --force, -f         Overwrite existing skill on install
  --interactive, -i   Launch interactive wizard for profile init
  --cursor            Export rules specifically for Cursor
  --claude            Export rules specifically for Claude Code
  --windsurf          Export rules specifically for Windsurf
  --help, -h          Show help message`;
}

export function getSymlinkType() {
  return os.platform() === "win32" ? "junction" : "dir";
}

export function getUserConfigDir(homeDirectory = os.homedir()) {
  const base =
    homeDirectory === os.homedir() && process.env.XDG_CONFIG_HOME
      ? process.env.XDG_CONFIG_HOME
      : path.join(homeDirectory, ".config");
  return path.join(base, skillId);
}

export function getUserProfilePath(homeDirectory = os.homedir()) {
  return path.join(getUserConfigDir(homeDirectory), "profile.md");
}

export function getProfilesDir() {
  return path.join(bundledSkillPath, "profiles");
}

export async function pathExists(targetPath) {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function listAvailablePresets(profilesDir = getProfilesDir()) {
  if (!(await pathExists(profilesDir))) return [];
  const entries = await readdir(profilesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name.replace(/\.md$/, ""))
    .sort();
}

export async function resolveActiveProfile({
  workspaceDir = process.cwd(),
  homeDirectory = os.homedir(),
} = {}) {
  // 1. Project level (.my-bahasa.md)
  const projectProfilePath = path.join(workspaceDir, ".my-bahasa.md");
  if (await pathExists(projectProfilePath)) {
    const content = await readFile(projectProfilePath, "utf8");
    const schemaVersion = extractProfileSchema(content);
    return {
      type: "project",
      name: ".my-bahasa.md",
      path: projectProfilePath,
      schemaVersion,
      isUpToDate: schemaVersion >= CURRENT_PROFILE_SCHEMA,
    };
  }

  // 2. User level config (~/.config/my-bahasa-gweh/profile.md)
  const userProfilePath = getUserProfilePath(homeDirectory);
  if (await pathExists(userProfilePath)) {
    const content = await readFile(userProfilePath, "utf8");
    const schemaVersion = extractProfileSchema(content);
    return {
      type: "user",
      name: "personal profile",
      path: userProfilePath,
      schemaVersion,
      isUpToDate: schemaVersion >= CURRENT_PROFILE_SCHEMA,
    };
  }

  // 3. Bundled preset (default.md)
  const defaultPreset = path.join(getProfilesDir(), "default.md");
  if (await pathExists(defaultPreset)) {
    const content = await readFile(defaultPreset, "utf8");
    const schemaVersion = extractProfileSchema(content);
    return {
      type: "preset",
      name: "default",
      path: defaultPreset,
      schemaVersion,
      isUpToDate: schemaVersion >= CURRENT_PROFILE_SCHEMA,
    };
  }

  // Fallback to legacy references/gading-profile.md if exists
  const legacyProfile = path.join(bundledSkillPath, "references", "gading-profile.md");
  if (await pathExists(legacyProfile)) {
    const content = await readFile(legacyProfile, "utf8");
    const schemaVersion = extractProfileSchema(content);
    return {
      type: "legacy",
      name: "gading",
      path: legacyProfile,
      schemaVersion,
      isUpToDate: schemaVersion >= CURRENT_PROFILE_SCHEMA,
    };
  }

  return {
    type: "none",
    name: "none",
    path: null,
    schemaVersion: 0,
    isUpToDate: false,
  };
}

export async function profileUse(
  presetName,
  { homeDirectory = os.homedir(), profilesDir = getProfilesDir() } = {},
) {
  const available = await listAvailablePresets(profilesDir);
  if (!available.includes(presetName)) {
    throw new Error(
      `Preset '${presetName}' not found. Available presets: ${available.join(", ")}`,
    );
  }

  const sourceFile = path.join(profilesDir, `${presetName}.md`);
  const targetDir = getUserConfigDir(homeDirectory);
  const targetFile = getUserProfilePath(homeDirectory);

  await mkdir(targetDir, { recursive: true });
  await cp(sourceFile, targetFile, { force: true });

  return { presetName, sourceFile, targetFile };
}

export async function profileInit({
  homeDirectory = os.homedir(),
  preset = "default",
  force = false,
  profilesDir = getProfilesDir(),
} = {}) {
  const targetFile = getUserProfilePath(homeDirectory);
  if ((await pathExists(targetFile)) && !force) {
    throw new Error(
      `Profile already exists at ${targetFile}. Use 'profile use <preset>' or edit the file directly.`,
    );
  }

  return profileUse(preset, { homeDirectory, profilesDir });
}

export async function profileShow({
  workspaceDir = process.cwd(),
  homeDirectory = os.homedir(),
} = {}) {
  const active = await resolveActiveProfile({ workspaceDir, homeDirectory });
  if (!active.path || !(await pathExists(active.path))) {
    return { active, content: "" };
  }
  const content = await readFile(active.path, "utf8");
  return { active, content };
}

export async function profileMigrate({
  workspaceDir = process.cwd(),
  homeDirectory = os.homedir(),
} = {}) {
  const active = await resolveActiveProfile({ workspaceDir, homeDirectory });
  if (!active.path || !(await pathExists(active.path))) {
    throw new Error("No active profile found to migrate. Run 'my-bahasa-gweh wizard' first.");
  }

  const rawContent = await readFile(active.path, "utf8");
  const currentSchema = extractProfileSchema(rawContent);

  if (currentSchema >= CURRENT_PROFILE_SCHEMA) {
    return {
      migrated: false,
      path: active.path,
      schemaVersion: currentSchema,
      message: "Profile is already up to date.",
    };
  }

  // Prepend or update schema version comment
  let newContent = "";
  if (/<!--\s*schema-version:\s*\d+\s*-->/.test(rawContent)) {
    newContent = rawContent.replace(
      /<!--\s*schema-version:\s*\d+\s*-->/,
      `<!-- schema-version: ${CURRENT_PROFILE_SCHEMA} -->`,
    );
  } else {
    newContent = `<!-- schema-version: ${CURRENT_PROFILE_SCHEMA} -->\n${rawContent.trim()}\n`;
  }

  await writeFile(active.path, newContent, "utf8");
  return {
    migrated: true,
    path: active.path,
    schemaVersion: CURRENT_PROFILE_SCHEMA,
    message: `Migrated profile schema from v${currentSchema} to v${CURRENT_PROFILE_SCHEMA}.`,
  };
}

export const EXPORT_MARKER_START = "<!-- my-bahasa-gweh:start -->";
export const EXPORT_MARKER_END = "<!-- my-bahasa-gweh:end -->";

export function injectRuleBlock(existingContent, ruleBlock) {
  const blockWithMarkers = `${EXPORT_MARKER_START}\n${ruleBlock.trim()}\n${EXPORT_MARKER_END}`;
  if (!existingContent || !existingContent.trim()) {
    return `${blockWithMarkers}\n`;
  }

  const markerRegex = new RegExp(
    `${EXPORT_MARKER_START}[\\s\\S]*?${EXPORT_MARKER_END}`,
    "g",
  );

  if (markerRegex.test(existingContent)) {
    return existingContent.replace(markerRegex, blockWithMarkers);
  }

  return `${existingContent.trim()}\n\n${blockWithMarkers}\n`;
}

export async function exportRules({
  workspaceDir = process.cwd(),
  homeDirectory = os.homedir(),
  targets = ["cursor", "claude", "windsurf"],
  isGlobal = true,
} = {}) {
  const { active, content } = await profileShow({ workspaceDir, homeDirectory });
  if (!content) {
    throw new Error("Cannot export rules: No active persona profile found.");
  }

  const scopeLabel = isGlobal ? "global user configuration" : "workspace project rules";
  const header = `# AI Communication Persona Rules\n\n> Auto-generated by my-bahasa-gweh (${scopeLabel}) from active profile [${active.type}: ${active.name}].\n\n`;
  const footer = `\n\n## Delivery and Safety Instructions\n- Always follow the voice, tone, salutation, and review habits specified in this profile.\n- Always present drafts for the user to review first.\n- Never post or submit comments/reviews automatically without explicit confirmation.\n`;
  const ruleDocument = `${header}${content.trim()}${footer}`;

  const exportedFiles = [];
  const shouldExportAll = targets.includes("all") || targets.length === 0;

  async function writeRuleFile(filePath) {
    await mkdir(path.dirname(filePath), { recursive: true });
    let existing = "";
    if (await pathExists(filePath)) {
      existing = await readFile(filePath, "utf8");
    }
    const merged = injectRuleBlock(existing, ruleDocument);
    await writeFile(filePath, merged, "utf8");
    exportedFiles.push(filePath);
  }

  if (isGlobal) {
    // 1. Claude Code Global (~/.claude/CLAUDE.md)
    if (shouldExportAll || targets.includes("claude")) {
      await writeRuleFile(path.join(homeDirectory, ".claude", "CLAUDE.md"));
    }

    // 2. Cursor Global (~/.cursorrules and ~/.cursor/rules/my-bahasa-gweh.mdc)
    if (shouldExportAll || targets.includes("cursor")) {
      await writeRuleFile(path.join(homeDirectory, ".cursorrules"));
      await writeRuleFile(path.join(homeDirectory, ".cursor", "rules", "my-bahasa-gweh.mdc"));
    }

    // 3. Windsurf Global (~/.codeium/windsurf/memories/global_rules.md and ~/.windsurfrules)
    if (shouldExportAll || targets.includes("windsurf")) {
      await writeRuleFile(
        path.join(homeDirectory, ".codeium", "windsurf", "memories", "global_rules.md"),
      );
      await writeRuleFile(path.join(homeDirectory, ".windsurfrules"));
    }
  } else {
    // Local workspace export
    if (shouldExportAll || targets.includes("cursor")) {
      await writeRuleFile(path.join(workspaceDir, ".cursorrules"));
    }

    if (shouldExportAll || targets.includes("claude")) {
      await writeRuleFile(path.join(workspaceDir, "CLAUDE.md"));
    }

    if (shouldExportAll || targets.includes("windsurf")) {
      await writeRuleFile(path.join(workspaceDir, ".windsurfrules"));
    }
  }

  return exportedFiles;
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

export async function isCorrectAntigravityLink(linkPath, skillPath) {
  try {
    const stats = await lstat(linkPath);
    if (!stats.isSymbolicLink()) return false;
    return (await realpath(linkPath)) === (await realpath(skillPath));
  } catch {
    return false;
  }
}

export async function install({ homeDirectory = os.homedir(), force = false } = {}) {
  if (!(await pathExists(bundledSkillPath))) {
    throw new Error(`Bundled skill is missing: ${bundledSkillPath}`);
  }

  const { skillPath, antigravityPath } = resolveInstallPaths(homeDirectory);

  if (await pathExists(skillPath)) {
    if (!force) {
      throw new Error(
        `Refusing to overwrite existing skill: ${skillPath}. Use --force or run update.`,
      );
    }
    await rm(skillPath, { recursive: true, force: true });
  }

  if (await pathExists(antigravityPath)) {
    if (force) {
      await rm(antigravityPath, { recursive: true, force: true });
    } else if (!(await isCorrectAntigravityLink(antigravityPath, skillPath))) {
      throw new Error(
        `Refusing to overwrite existing Antigravity skill path: ${antigravityPath}. Use --force or run update.`,
      );
    }
  }

  await mkdir(path.dirname(skillPath), { recursive: true });
  await cp(bundledSkillPath, skillPath, { recursive: true, force: false, errorOnExist: true });

  try {
    if (!(await pathExists(antigravityPath))) {
      await mkdir(path.dirname(antigravityPath), { recursive: true });
      await symlink(skillPath, antigravityPath, getSymlinkType());
    }
  } catch (error) {
    await rm(skillPath, { recursive: true, force: true });
    throw error;
  }

  return { skillPath, antigravityPath };
}

export async function update({ homeDirectory = os.homedir() } = {}) {
  return install({ homeDirectory, force: true });
}

export async function uninstall({ homeDirectory = os.homedir() } = {}) {
  const { skillPath, antigravityPath } = resolveInstallPaths(homeDirectory);

  let uninstalledSkill = false;
  let uninstalledAntigravity = false;

  if (await pathExists(skillPath)) {
    await rm(skillPath, { recursive: true, force: true });
    uninstalledSkill = true;
  }

  if (await pathExists(antigravityPath)) {
    await rm(antigravityPath, { recursive: true, force: true });
    uninstalledAntigravity = true;
  }

  return {
    skillPath,
    antigravityPath,
    uninstalledSkill,
    uninstalledAntigravity,
  };
}

export async function checkGhCli() {
  try {
    const { stdout } = await execFileAsync("gh", ["auth", "status"]);
    return { installed: true, authenticated: true, details: stdout.trim() };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { installed: false, authenticated: false, details: "gh command not found in PATH" };
    }
    return {
      installed: true,
      authenticated: false,
      details: error.stderr?.trim() || error.stdout?.trim() || error.message,
    };
  }
}

export async function checkGlabCli() {
  try {
    const { stdout, stderr } = await execFileAsync("glab", ["auth", "status"]);
    const details = stdout?.trim() || stderr?.trim() || "Authenticated";
    return { installed: true, authenticated: true, details };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { installed: false, authenticated: false, details: "glab command not found in PATH" };
    }
    return {
      installed: true,
      authenticated: false,
      details: error.stderr?.trim() || error.stdout?.trim() || error.message,
    };
  }
}

export async function doctor({
  homeDirectory = os.homedir(),
  workspaceDir = process.cwd(),
  checkGh = checkGhCli,
  checkGlab = checkGlabCli,
  nodeVersion = process.version,
} = {}) {
  const { skillPath, antigravityPath } = resolveInstallPaths(homeDirectory);
  const skillExists = await pathExists(skillPath);
  let skillValid = false;
  if (skillExists) {
    const skillMd = path.join(skillPath, "SKILL.md");
    const defaultProfile = path.join(skillPath, "profiles", "default.md");
    const legacyProfile = path.join(skillPath, "references", "gading-profile.md");
    skillValid =
      (await pathExists(skillMd)) &&
      ((await pathExists(defaultProfile)) || (await pathExists(legacyProfile)));
  }

  const antigravityExists = await pathExists(antigravityPath);
  const antigravityValidLink = antigravityExists
    ? await isCorrectAntigravityLink(antigravityPath, skillPath)
    : false;

  const ghStatus = await checkGh();
  const glabStatus = await checkGlab();
  const activeProfile = await resolveActiveProfile({ workspaceDir, homeDirectory });

  const majorNode = parseInt(nodeVersion.replace(/^v/, "").split(".")[0], 10);
  const nodeOk = majorNode >= 18;

  const claudeGlobalPath = path.join(homeDirectory, ".claude", "CLAUDE.md");
  const cursorGlobalRulesPath = path.join(homeDirectory, ".cursor", "rules", "my-bahasa-gweh.mdc");
  const cursorLegacyRulesPath = path.join(homeDirectory, ".cursorrules");
  const windsurfGlobalMemoriesPath = path.join(
    homeDirectory,
    ".codeium",
    "windsurf",
    "memories",
    "global_rules.md",
  );
  const windsurfLegacyRulesPath = path.join(homeDirectory, ".windsurfrules");

  const claudeGlobal = await pathExists(claudeGlobalPath);
  const cursorGlobal =
    (await pathExists(cursorGlobalRulesPath)) || (await pathExists(cursorLegacyRulesPath));
  const windsurfGlobal =
    (await pathExists(windsurfGlobalMemoriesPath)) || (await pathExists(windsurfLegacyRulesPath));

  const healthy = skillValid && antigravityValidLink && nodeOk;

  return {
    healthy,
    node: { version: nodeVersion, ok: nodeOk },
    skill: { path: skillPath, exists: skillExists, valid: skillValid },
    antigravity: {
      path: antigravityPath,
      exists: antigravityExists,
      validLink: antigravityValidLink,
    },
    profile: activeProfile,
    rules: {
      claude: { path: claudeGlobalPath, active: claudeGlobal },
      cursor: { path: cursorGlobalRulesPath, active: cursorGlobal },
      windsurf: { path: windsurfGlobalMemoriesPath, active: windsurfGlobal },
    },
    gh: ghStatus,
    glab: glabStatus,
  };
}

export async function runCli(
  argv = process.argv.slice(2),
  output = console.log,
  { homeDirectory = os.homedir(), workspaceDir = process.cwd() } = {},
) {
  const [command, ...args] = argv;
  const isForce = args.includes("--force") || args.includes("-f");

  if (!command || command === "--help" || command === "-h" || command === "help") {
    output(usage());
    return;
  }

  if (command === "install") {
    const { skillPath, antigravityPath } = await install({ homeDirectory, force: isForce });
    output(`${c.green("✔")} Installed ${c.bold(skillId)} at ${c.cyan(skillPath)}`);
    output(`${c.green("✔")} Linked Antigravity to ${c.cyan(antigravityPath)}`);
    return;
  }

  if (command === "update") {
    const { skillPath, antigravityPath } = await update({ homeDirectory });
    output(`${c.green("✔")} Updated ${c.bold(skillId)} at ${c.cyan(skillPath)}`);
    output(`${c.green("✔")} Linked Antigravity to ${c.cyan(antigravityPath)}`);
    return;
  }

  if (command === "uninstall") {
    const { skillPath, antigravityPath, uninstalledSkill, uninstalledAntigravity } =
      await uninstall({ homeDirectory });
    if (uninstalledSkill) {
      output(`${c.green("✔")} Removed skill from ${c.cyan(skillPath)}`);
    } else {
      output(`${c.dim("ℹ")} Skill was not installed at ${skillPath}`);
    }

    if (uninstalledAntigravity) {
      output(`${c.green("✔")} Removed Antigravity link at ${c.cyan(antigravityPath)}`);
    } else {
      output(`${c.dim("ℹ")} Antigravity link was not present at ${antigravityPath}`);
    }
    return;
  }

  if (command === "wizard") {
    await runInteractiveWizard({ homeDirectory, workspaceDir });
    return;
  }

  if (command === "export") {
    const isLocal = args.includes("--local") || args.includes("-l");
    const isGlobal = args.includes("--global") || args.includes("-g") || !isLocal;
    const targets = [];
    if (args.includes("--cursor")) targets.push("cursor");
    if (args.includes("--claude")) targets.push("claude");
    if (args.includes("--windsurf")) targets.push("windsurf");
    if (args.includes("--all") || targets.length === 0) targets.push("all");

    const exported = await exportRules({
      workspaceDir,
      homeDirectory,
      targets,
      isGlobal,
    });
    const scopeLabel = isGlobal ? "Global (~)" : "Local Project";
    output(`${c.green("✔")} Exported AI communication rules [${c.bold(scopeLabel)}]:`);
    for (const f of exported) {
      output(`  ${c.cyan("•")} ${f}`);
    }
    if (isGlobal) {
      output(
        c.dim(
          "\nRules apply across all projects globally. Use 'export --local' to export to current directory.",
        ),
      );
    }
    return;
  }

  if (command === "profile") {
    const subAction = args[0] || "list";
    const isInteractive =
      args.includes("--interactive") || args.includes("-i") || subAction === "wizard";

    if (subAction === "wizard" || (subAction === "init" && isInteractive)) {
      await runInteractiveWizard({ homeDirectory, workspaceDir });
      return;
    }

    if (subAction === "list") {
      const presets = await listAvailablePresets();
      const active = await resolveActiveProfile({ workspaceDir, homeDirectory });
      let activeContent = "";
      if (active.path && (await pathExists(active.path))) {
        activeContent = await readFile(active.path, "utf8");
      }

      output(c.bold("Available Profile Presets:"));
      for (const preset of presets) {
        let isCurrent = false;
        if (active.type === "preset") {
          isCurrent = active.name === preset;
        } else if (active.type === "user" && activeContent) {
          try {
            const presetContent = await readFile(
              path.join(getProfilesDir(), `${preset}.md`),
              "utf8",
            );
            isCurrent = activeContent.trim() === presetContent.trim();
          } catch {
            isCurrent = false;
          }
        }
        const bullet = isCurrent ? c.green("*") : " ";
        const label = isCurrent ? c.bold(c.green(`${preset} (active)`)) : preset;
        output(`  ${bullet} ${label}`);
      }
      output(`\n${c.bold("Active Profile:")} [${c.cyan(active.type)}] ${active.path || "none"}`);
      output(c.dim(`\nTo activate a preset, run: my-bahasa-gweh profile use <preset>`));
      return;
    }

    if (subAction === "use") {
      const presetName = args[1];
      if (!presetName) {
        throw new Error(`Usage: my-bahasa-gweh profile use <preset>`);
      }
      const { targetFile } = await profileUse(presetName, { homeDirectory });
      output(`${c.green("✔")} Activated profile '${c.bold(presetName)}' at ${c.cyan(targetFile)}`);
      return;
    }

    if (subAction === "init") {
      const preset = args[1] || "default";
      const { targetFile } = await profileInit({ homeDirectory, preset, force: isForce });
      output(`${c.green("✔")} Initialized profile at ${c.cyan(targetFile)} (from '${preset}')`);
      return;
    }

    if (subAction === "show") {
      const { active, content } = await profileShow({ workspaceDir, homeDirectory });
      output(`${c.bold(c.cyan(`--- Active Profile [${active.type}]: ${active.path} ---`))}\n`);
      output(content);
      return;
    }

    if (subAction === "migrate") {
      const result = await profileMigrate({ workspaceDir, homeDirectory });
      if (result.migrated) {
        output(`${c.green("✔")} ${result.message} (${c.cyan(result.path)})`);
      } else {
        output(`${c.dim("ℹ")} ${result.message}`);
      }
      return;
    }

    throw new Error(
      `Unknown profile subaction '${subAction}'. Allowed: list, use, init, show, wizard, migrate.`,
    );
  }

  if (command === "doctor" || command === "status") {
    const report = await doctor({ homeDirectory, workspaceDir });
    output(c.bold("Environment & Skill Health Report:"));
    output(
      `  Node.js:      ${report.node.version} ${report.node.ok ? c.green("✔") : c.red("✖ (Requires >= 18)")}`,
    );
    output(
      `  Skill:        ${report.skill.path} ${report.skill.valid ? c.green("✔ (Valid)") : report.skill.exists ? c.red("✖ (Incomplete files)") : c.red("✖ (Not installed)")}`,
    );
    output(
      `  Antigravity:  ${report.antigravity.path} ${report.antigravity.validLink ? c.green("✔ (Valid symlink)") : report.antigravity.exists ? c.red("✖ (Invalid link/path)") : c.red("✖ (Not linked)")}`,
    );
    output(
      `  Profile:      [${c.cyan(report.profile.type)}] ${report.profile.path} ${report.profile.path ? (report.profile.isUpToDate ? c.green("✔") : c.yellow(`⚠ (Schema v${report.profile.schemaVersion}, run 'profile migrate')`)) : c.yellow("⚠ (None found)")}`,
    );
    output(
      `  GitHub CLI:   ${report.gh.installed ? (report.gh.authenticated ? c.green("✔ (Authenticated)") : c.yellow("⚠ (Installed but unauthenticated)")) : c.dim("ℹ (Optional: not in PATH)")}`,
    );
    output(
      `  GitLab CLI:   ${report.glab.installed ? (report.glab.authenticated ? c.green("✔ (Authenticated)") : c.yellow("⚠ (Installed but unauthenticated)")) : c.dim("ℹ (Optional: not in PATH)")}`,
    );

    if (report.rules) {
      output(c.bold("\nGlobal AI Rule Integrations:"));
      output(
        `  Claude Code:  ${report.rules.claude.active ? c.green("✔ (~/.claude/CLAUDE.md)") : c.dim("ℹ Not exported (Run 'my-bahasa-gweh export --global')")}`,
      );
      output(
        `  Cursor:       ${report.rules.cursor.active ? c.green("✔ (~/.cursorrules / ~/.cursor/rules)") : c.dim("ℹ Not exported (Run 'my-bahasa-gweh export --global')")}`,
      );
      output(
        `  Windsurf:     ${report.rules.windsurf.active ? c.green("✔ (~/.codeium/.../global_rules.md)") : c.dim("ℹ Not exported (Run 'my-bahasa-gweh export --global')")}`,
      );
    }

    if (!report.healthy) {
      output(
        `\n${c.yellow("Suggestion:")} Run 'my-bahasa-gweh install' or 'my-bahasa-gweh update' to fix issues.`,
      );
    }
    return;
  }

  throw new Error(`Unknown command '${command}'.\n\n${usage()}`);
}

async function isCliEntrypoint() {
  if (!process.argv[1]) return false;
  try {
    return (await realpath(process.argv[1])) === (await realpath(fileURLToPath(import.meta.url)));
  } catch {
    return false;
  }
}

if (await isCliEntrypoint()) {
  runCli().catch((error) => {
    console.error(c.red(`Error: ${error.message}`));
    process.exitCode = 1;
  });
}
