import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import { compileProfile, generateSampleComment, runInteractiveWizard } from "../bin/wizard.js";
import { pathExists } from "../bin/my-bahasa-gweh.js";

function createMockInputStream(lines) {
  async function* generator() {
    for (const line of lines) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      yield line;
    }
  }
  return Readable.from(generator());
}

test("generateSampleComment generates tone-accurate drafts for all variations", () => {
  // 1. English with suggestions and minimal emoji
  const enComment = generateSampleComment({
    name: "Alex",
    language: "en",
    pronoun: "I",
    salutation: "Alex",
    emojiPolicy: "minimal",
    suggestions: true,
  });
  assert.match(enComment, /Thanks for putting this together/);
  assert.match(enComment, /```suggestion/);
  assert.match(enComment, /🎉/);

  // 2. English without suggestions and without emoji
  const enPlain = generateSampleComment({
    name: "Sam",
    language: "en",
    salutation: "none",
    emojiPolicy: "none",
    suggestions: false,
  });
  assert.match(enPlain, /Thanks for putting this together!/);
  assert.doesNotMatch(enPlain, /```suggestion/);
  assert.doesNotMatch(enPlain, /🎉/);

  // 3. Indonesian Formal with suggestions and no emoji
  const formalComment = generateSampleComment({
    name: "Budi",
    language: "id-formal",
    pronoun: "saya",
    salutation: "Bapak",
    emojiPolicy: "none",
    suggestions: true,
  });
  assert.match(formalComment, /Terima kasih atas implementasi perubahan ini/);
  assert.match(formalComment, /```suggestion/);
  assert.doesNotMatch(formalComment, /👍|🎉/);

  // 4. Indonesian Santai without suggestions
  const santaiComment = generateSampleComment({
    name: "Rizky",
    language: "id-santai",
    pronoun: "saya",
    salutation: "kak",
    emojiPolicy: "minimal",
    suggestions: false,
  });
  assert.match(santaiComment, /Makasih udah implementasi/);
  assert.doesNotMatch(santaiComment, /```suggestion/);
});

test("compileProfile outputs comprehensive LLM prompt instructions across languages", () => {
  // Santai ID
  const santaiMd = compileProfile({
    name: "Dina",
    role: "Frontend Engineer",
    language: "id-santai",
    pronoun: "aku",
    salutation: "kak",
    directness: "gentle",
    emojiPolicy: "minimal",
    suggestions: true,
    customPhrases: "udah, makasih ya, coba cek deh",
  });
  assert.match(santaiMd, /<!-- schema-version: 1 -->/);
  assert.match(santaiMd, /# Profil Komunikasi - Dina/);
  assert.match(santaiMd, /Frontend Engineer/);
  assert.match(santaiMd, /"aku"/);
  assert.match(santaiMd, /"kak"/);
  assert.match(santaiMd, /udah, makasih ya, coba cek deh/);
  assert.match(santaiMd, /```suggestion/);

  // Formal ID direct
  const formalMd = compileProfile({
    name: "Hendra",
    role: "System Architect",
    language: "id-formal",
    pronoun: "saya",
    salutation: "Bapak",
    directness: "direct",
    emojiPolicy: "none",
    suggestions: false,
  });
  assert.match(formalMd, /Bahasa Indonesia baku/);
  assert.match(formalMd, /Lugas dan tegas/);
  assert.match(formalMd, /Dilarang menggunakan emoji/);
  assert.match(formalMd, /Utamakan penjelasan konseptual/);

  // English direct with free emoji
  const enMd = compileProfile({
    name: "Sarah",
    role: "Fullstack Developer",
    language: "en",
    pronoun: "I",
    salutation: "none",
    directness: "direct",
    emojiPolicy: "free",
    suggestions: true,
  });
  assert.match(enMd, /Direct and concise/);
  assert.match(enMd, /Natural and friendly/);
  assert.match(enMd, /Direct \/ no salutation needed/);
});

test("runInteractiveWizard executes quickstart setup with mock stream", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "wizard-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "wizard-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  const simulatedInputs = ["2\n", "1\n", "Bima\n", "1\n", "kak\n", "1\n", "1\n"];
  const mockInput = createMockInputStream(simulatedInputs);

  let outputText = "";
  const mockOutput = new Writable({
    write(chunk, encoding, callback) {
      outputText += chunk.toString();
      callback();
    },
  });

  const result = await runInteractiveWizard({
    input: mockInput,
    output: mockOutput,
    homeDirectory,
    workspaceDir,
  });

  assert.ok(result);
  assert.equal(result.answers.name, "Bima");
  assert.equal(await pathExists(result.targetPath), true);
  assert.match(await readFile(result.targetPath, "utf8"), /# Profil Komunikasi - Bima/);
});

test("runInteractiveWizard handles user cancellation gracefully", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "wizard-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "wizard-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  // User selects Quickstart, inputs name, but cancels at preview confirmation (option 2)
  const simulatedInputs = ["2\n", "1\n", "CancelUser\n", "1\n", "kak\n", "2\n"];
  const mockInput = createMockInputStream(simulatedInputs);

  let outputText = "";
  const mockOutput = new Writable({
    write(chunk, encoding, callback) {
      outputText += chunk.toString();
      callback();
    },
  });

  const result = await runInteractiveWizard({
    input: mockInput,
    output: mockOutput,
    homeDirectory,
    workspaceDir,
  });

  assert.equal(result, null);
  assert.match(outputText, /Setup dibatalkan/);

  // Verify no file was created
  const targetFile = path.join(homeDirectory, ".config", "my-bahasa-gweh", "profile.md");
  assert.equal(await pathExists(targetFile), false);
});

test("runInteractiveWizard recovers from invalid input and accepts default enter keys", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "wizard-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "wizard-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  // Inputs:
  // 1. Invalid input "99", then invalid "abc", then default "\n" (chooses option 1: Full Custom)
  // 2. Default name "\n" (uses default "Reviewer")
  // 3. Default role "\n" (uses default "Software Engineer")
  // 4. Default language "\n" (uses default id-santai)
  // 5. Default pronoun "\n" (uses default saya)
  // 6. Default salutation "\n" (uses default kak)
  // 7. Default directness "\n" (uses default gentle)
  // 8. Default emoji "\n" (uses default minimal)
  // 9. Default suggestions "\n" (uses default true)
  // 10. Default custom phrases "\n" (empty)
  // 11. Confirm "\n" (default 1: Ya)
  // 12. Target location "\n" (default 1: global)
  const simulatedInputs = [
    "99\n",
    "abc\n",
    "\n",
    "\n",
    "\n",
    "\n",
    "\n",
    "\n",
    "\n",
    "\n",
    "\n",
    "\n",
    "\n",
    "\n",
  ];
  const mockInput = createMockInputStream(simulatedInputs);

  let outputText = "";
  const mockOutput = new Writable({
    write(chunk, encoding, callback) {
      outputText += chunk.toString();
      callback();
    },
  });

  const result = await runInteractiveWizard({
    input: mockInput,
    output: mockOutput,
    homeDirectory,
    workspaceDir,
  });

  assert.ok(result);
  assert.equal(result.answers.name, "Reviewer");
  assert.match(outputText, /Pilihan tidak valid/);
  assert.equal(await pathExists(result.targetPath), true);
});

test("runInteractiveWizard executes full custom English setup with local destination", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "wizard-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "wizard-work-"));
  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  // Simulated inputs for Full Custom English:
  // 1. Setup mode: 1 (Full Custom)
  // 2. Name: "Emma"
  // 3. Role: "DevOps Engineer"
  // 4. Language: 3 (English)
  // 5. Pronoun: "I"
  // 6. Salutation: 3 (none / direct)
  // 7. Directness: 2 (Direct)
  // 8. Emoji: 1 (Minimal)
  // 9. Suggestions: 1 (Yes)
  // 10. Custom phrases: "let me know"
  // 11. Confirm: 1 (Yes)
  // 12. Target location: 2 (Local .my-bahasa.md)
  const simulatedInputs = [
    "1\n",
    "Emma\n",
    "DevOps Engineer\n",
    "3\n",
    "I\n",
    "3\n",
    "2\n",
    "1\n",
    "1\n",
    "let me know\n",
    "1\n",
    "2\n",
  ];

  const mockInput = createMockInputStream(simulatedInputs);

  let outputText = "";
  const mockOutput = new Writable({
    write(chunk, encoding, callback) {
      outputText += chunk.toString();
      callback();
    },
  });

  const result = await runInteractiveWizard({
    input: mockInput,
    output: mockOutput,
    homeDirectory,
    workspaceDir,
  });

  assert.ok(result);
  const localTarget = path.join(workspaceDir, ".my-bahasa.md");
  assert.equal(result.targetPath, localTarget);
  assert.equal(await pathExists(localTarget), true);
  const content = await readFile(localTarget, "utf8");
  assert.match(content, /# Profil Komunikasi - Emma/);
  assert.match(content, /DevOps Engineer/);
  assert.match(content, /English/);
  assert.match(content, /Direct and concise/);
});
