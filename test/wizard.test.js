import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import test from "node:test";

import { compileProfile, generateSampleComment, runInteractiveWizard } from "../bin/wizard.js";
import { pathExists } from "../bin/my-bahasa-gweh.js";

function createMockRl(inputs) {
  let idx = 0;
  return {
    question: async () => {
      const line = inputs[idx++] ?? "";
      return line.replace(/\n$/, "");
    },
    close: () => {},
    on: () => {},
  };
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

  // 5. Mentor tone
  const mentorComment = generateSampleComment({
    name: "Dewi",
    language: "id-santai",
    directness: "mentor",
  });
  assert.match(mentorComment, /catatan arsitektural/);

  // 6. Concise tone
  const conciseComment = generateSampleComment({
    name: "Fajar",
    language: "id-santai",
    directness: "concise",
  });
  assert.match(conciseComment, /Rapi! Minor edge case/);
});

test("compileProfile outputs comprehensive LLM prompt instructions across languages and custom settings", () => {
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

  // Custom persona with custom language, custom tone, custom instructions
  const customMd = compileProfile({
    name: "Kuncoro",
    role: "Principal SRE",
    language: "custom",
    customLanguage: "Bahasa Jawa campur Inggris teknis",
    pronoun: "kulo",
    salutation: "om",
    directness: "custom",
    customDirectness: "Humoris santai tapi teliti soal memory leak",
    emojiPolicy: "custom",
    customEmojiPolicy: "Hanya gunakan emoji ☕ dan 🚀",
    suggestions: "flexible",
    reviewFocus: "custom",
    customReviewFocus: "Ketahanan cluster Kubernetes dan toleransi kegagalan",
    customInstructions: "Jangan pernah deploy pas malam Jumat\nSelalu lampirkan hasil k6 load test",
  });
  assert.match(customMd, /Bahasa Jawa campur Inggris teknis/);
  assert.match(customMd, /"kulo"/);
  assert.match(customMd, /"om"/);
  assert.match(customMd, /Humoris santai tapi teliti soal memory leak/);
  assert.match(customMd, /Hanya gunakan emoji ☕ dan 🚀/);
  assert.match(customMd, /Ketahanan cluster Kubernetes/);
  assert.match(customMd, /Jangan pernah deploy pas malam Jumat/);
  assert.match(customMd, /Selalu lampirkan hasil k6 load test/);

  // Freeform description
  const freeformMd = compileProfile({
    name: "Bagas",
    role: "Backend Lead",
    freeformDescription: "Seorang hacker pragmatis yang suka kode bersih dan benci boilerplate.",
  });
  assert.match(freeformMd, /Gaya Komunikasi Bebas \(Freeform Persona\)/);
  assert.match(freeformMd, /Seorang hacker pragmatis/);
});

test("runInteractiveWizard executes quickstart setup with mock stream", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "wizard-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "wizard-work-"));

  // Inputs:
  // 1. Setup mode: 2 (Quickstart dari Archetype)
  // 2. Archetype choice: 1 (Default Kolaboratif)
  // 3. Name: "Bima"
  // 4. Pronoun choice: 1 (saya)
  // 5. Salutation choice: 1 (kak)
  // 6. Extra rules: "\n" (none)
  // 7. Preview confirmation: 1 (Save)
  // 8. Export global: 1 (Yes)
  const simulatedInputs = [
    "2\n",
    "1\n",
    "Bima\n",
    "1\n",
    "1\n",
    "\n",
    "1\n",
    "1\n",
  ];
  const mockRl = createMockRl(simulatedInputs);

  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  let outputText = "";
  const mockOutput = new Writable({
    write(chunk, encoding, callback) {
      outputText += chunk.toString();
      callback();
    },
  });

  const result = await runInteractiveWizard({
    rl: mockRl,
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

  // User selects Quickstart, inputs name, but cancels at preview confirmation (option 3: Cancel)
  const simulatedInputs = [
    "2\n",
    "1\n",
    "CancelUser\n",
    "1\n",
    "1\n",
    "\n",
    "3\n",
  ];
  const mockRl = createMockRl(simulatedInputs);

  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  let outputText = "";
  const mockOutput = new Writable({
    write(chunk, encoding, callback) {
      outputText += chunk.toString();
      callback();
    },
  });

  const result = await runInteractiveWizard({
    rl: mockRl,
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

  // Inputs:
  // 1. Invalid input "99", then invalid "abc", then default "\n" (chooses option 1: Full Custom)
  // 2. Default name "\n" (Reviewer)
  // 3. Default role "\n" (Software Engineer)
  // 4. Default language "\n" (id-santai)
  // 5. Default pronoun "\n" (saya)
  // 6. Default salutation "\n" (kak)
  // 7. Default directness "\n" (gentle)
  // 8. Default emoji "\n" (minimal)
  // 9. Default suggestions "\n" (true)
  // 10. Default review focus "\n" (balanced)
  // 11. Default custom phrases "\n" (empty)
  // 12. Default custom instructions "\n" (empty)
  // 13. Confirm "\n" (default 1: Save)
  // 14. Export global "\n" (default 1: Yes)
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
    "\n",
    "\n",
  ];
  const mockRl = createMockRl(simulatedInputs);

  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  let outputText = "";
  const mockOutput = new Writable({
    write(chunk, encoding, callback) {
      outputText += chunk.toString();
      callback();
    },
  });

  const result = await runInteractiveWizard({
    rl: mockRl,
    output: mockOutput,
    homeDirectory,
    workspaceDir,
  });

  assert.ok(result);
  assert.equal(result.answers.name, "Reviewer");
  assert.match(outputText, /Pilihan tidak valid/);
  assert.equal(await pathExists(result.targetPath), true);
});

test("runInteractiveWizard executes Full Custom with custom inputs and preview refinement loop", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "wizard-custom-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "wizard-custom-work-"));

  // Simulated inputs for Full Custom with Custom entries:
  // 1. Setup mode: 1 (Full Custom)
  // 2. Name: "Emma"
  // 3. Role: "DevOps Engineer"
  // 4. Language: 4 (Custom) -> "Bahasa Indonesia campur English"
  // 5. Pronoun: 4 (Custom) -> "kami"
  // 6. Salutation: 5 (Custom) -> "chief"
  // 7. Directness: 5 (Custom) -> "Sarkastik tapi solutif"
  // 8. Emoji: 4 (Custom) -> "Gunakan hanya 🚀"
  // 9. Suggestions: 2 (Flexible)
  // 10. Review focus: 4 (Custom) -> "Keamanan pipeline CI/CD"
  // 11. Custom phrases: "gaskeun"
  // 12. Initial custom instructions: "Wajib ada rollback plan"
  // 13. Preview confirmation: 2 (Add extra instruction before save)
  // 14. Extra instruction prompt: "Jangan deploy hari Jumat"
  // 15. Preview confirmation: 1 (Save)
  // 16. Export global: 2 (No)
  const simulatedInputs = [
    "1\n",
    "Emma\n",
    "DevOps Engineer\n",
    "4\n",
    "Bahasa Indonesia campur English\n",
    "4\n",
    "kami\n",
    "5\n",
    "chief\n",
    "5\n",
    "Sarkastik tapi solutif\n",
    "4\n",
    "Gunakan hanya 🚀\n",
    "2\n",
    "4\n",
    "Keamanan pipeline CI/CD\n",
    "gaskeun\n",
    "Wajib ada rollback plan\n",
    "2\n",
    "Jangan deploy hari Jumat\n",
    "1\n",
    "2\n",
  ];

  const mockRl = createMockRl(simulatedInputs);

  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  let outputText = "";
  const mockOutput = new Writable({
    write(chunk, encoding, callback) {
      outputText += chunk.toString();
      callback();
    },
  });

  const result = await runInteractiveWizard({
    rl: mockRl,
    output: mockOutput,
    homeDirectory,
    workspaceDir,
  });

  assert.ok(result);
  const targetFile = path.join(homeDirectory, ".config", "my-bahasa-gweh", "profile.md");
  assert.equal(result.targetPath, targetFile);
  assert.equal(await pathExists(targetFile), true);

  const content = await readFile(targetFile, "utf8");
  assert.match(content, /# Profil Komunikasi - Emma/);
  assert.match(content, /DevOps Engineer/);
  assert.match(content, /Bahasa Indonesia campur English/);
  assert.match(content, /"kami"/);
  assert.match(content, /"chief"/);
  assert.match(content, /Sarkastik tapi solutif/);
  assert.match(content, /Gunakan hanya 🚀/);
  assert.match(content, /Keamanan pipeline CI\/CD/);
  assert.match(content, /Jangan deploy hari Jumat/);
});

test("runInteractiveWizard executes Freeform Persona Builder mode cleanly", async (t) => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "wizard-freeform-home-"));
  const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "wizard-freeform-work-"));

  // Simulated inputs for Freeform Persona Builder:
  // 1. Setup mode: 3 (Freeform)
  // 2. Name: "Gading"
  // 3. Role: "Lead Architect"
  // 4. Freeform description: "Seorang engineer yang suka guyon receh tapi teliti soal query SQL."
  // 5. Salutation choice: 1 (kak)
  // 6. Pronoun choice: 1 (saya)
  // 7. Special rules: "Jangan pernah pakai singkatan 'tbh'"
  // 8. Preview confirmation: 1 (Save)
  // 9. Export global: 1 (Yes)
  const simulatedInputs = [
    "3\n",
    "Gading\n",
    "Lead Architect\n",
    "Seorang engineer yang suka guyon receh tapi teliti soal query SQL.\n",
    "1\n",
    "1\n",
    "Jangan pernah pakai singkatan 'tbh'\n",
    "1\n",
    "1\n",
  ];

  const mockRl = createMockRl(simulatedInputs);

  t.after(async () => {
    await rm(homeDirectory, { recursive: true, force: true });
    await rm(workspaceDir, { recursive: true, force: true });
  });

  let outputText = "";
  const mockOutput = new Writable({
    write(chunk, encoding, callback) {
      outputText += chunk.toString();
      callback();
    },
  });

  const result = await runInteractiveWizard({
    rl: mockRl,
    output: mockOutput,
    homeDirectory,
    workspaceDir,
  });

  assert.ok(result);
  const targetFile = path.join(homeDirectory, ".config", "my-bahasa-gweh", "profile.md");
  assert.equal(result.targetPath, targetFile);
  assert.equal(await pathExists(targetFile), true);

  const content = await readFile(targetFile, "utf8");
  assert.match(content, /# Profil Komunikasi - Gading/);
  assert.match(content, /Gaya Komunikasi Bebas \(Freeform Persona\)/);
  assert.match(content, /Seorang engineer yang suka guyon receh/);
  assert.match(content, /Jangan pernah pakai singkatan 'tbh'/);
});
