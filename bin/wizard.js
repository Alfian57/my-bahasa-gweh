import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as readline from "node:readline/promises";
import { c } from "./colors.js";
import {
  getProfilesDir,
  getUserProfilePath,
  listAvailablePresets,
  pathExists,
} from "./my-bahasa-gweh.js";

export function generateSampleComment(answers) {
  const { name = "Reviewer", language = "id-santai", pronoun = "saya", salutation = "kak", emojiPolicy = "minimal", suggestions = true } = answers;

  if (language === "en") {
    const greeting = salutation && salutation !== "none" ? `Thanks for putting this together, ${salutation}!` : "Thanks for putting this together!";
    const emoji = emojiPolicy !== "none" ? " 🎉" : "";
    const codeBlock = suggestions
      ? `\n\`\`\`suggestion\nconst timeout = options.timeout ?? 5000;\n\`\`\`\n`
      : "";
    return `${greeting}${emoji}\n\nThe flow looks clean. I noticed an edge case when options are undefined. What do you think about setting a default fallback?${codeBlock}This will ensure network calls don't hang unexpectedly.`;
  }

  if (language === "id-formal") {
    const sapaan = salutation && salutation !== "none" ? `${salutation}, ` : "";
    const codeBlock = suggestions
      ? `\n\`\`\`suggestion\nconst timeout = options.timeout ?? 5000;\n\`\`\`\n`
      : "";
    return `Terima kasih atas implementasi perubahan ini. ${sapaan}mohon mempertimbangkan penambahan nilai default timeout untuk mengantisipasi kondisi ketika opsi tidak terdefinisi:${codeBlock}Langkah ini bertujuan untuk mencegah request tertahan tanpa batas waktu saat network mengalami degradasi.`;
  }

  // id-santai or semi-formal
  const sapaan = salutation && salutation !== "none" ? ` ${salutation}` : "";
  const emoji = emojiPolicy !== "none" ? " 👍" : "";
  const codeBlock = suggestions
    ? `\n\`\`\`suggestion\nconst timeout = options.timeout ?? 5000;\n\`\`\`\n`
    : "";

  return `Makasih udah implementasi flow ini${sapaan}!${emoji}\n\nSecara keseluruhan kodenya rapi. Sepertinya ada kemungkinan edge case kalau nilainya undefined. Bagaimana kalau kita tambahkan default fallback:${codeBlock}Biar aman pas network lagi lambat atau ada payload yang kosong.`;
}

export function compileProfile(answers) {
  const {
    name = "Reviewer",
    role = "Software Engineer",
    language = "id-santai",
    pronoun = "saya",
    salutation = "kak",
    directness = "gentle",
    emojiPolicy = "minimal",
    suggestions = true,
    customPhrases = "",
  } = answers;

  const sanitizedPhrases = customPhrases ? customPhrases.replace(/[\r\n\t]+/g, " ").trim() : "";

  const lines = [];
  lines.push(`<!-- schema-version: 1 -->`);
  lines.push(`# Profil Komunikasi - ${name}\n`);

  lines.push(`## Identitas Pengguna`);
  lines.push(`- Nama / Panggilan: ${name}`);
  lines.push(`- Peran Utama: ${role}\n`);

  lines.push(`## Bahasa dan Sapaan`);
  if (language === "en") {
    lines.push(`- Bahasa Utama: English (Professional, collaborative, and constructive).`);
    lines.push(`- Kata Ganti: "${pronoun}" for personal thoughts, "we" for team decisions.`);
    lines.push(`- Sapaan: ${salutation === "none" ? "Direct / no salutation needed." : `Use "${salutation}" when natural.`}`);
  } else if (language === "id-formal") {
    lines.push(`- Bahasa Utama: Bahasa Indonesia baku, tertib, dan profesional. Istilah teknis tetap dalam bahasa aslinya atau code font.`);
    lines.push(`- Kata Ganti: "${pronoun}". Hindari penggunaan kata ganti informal seperti "aku" atau "gue".`);
    lines.push(`- Sapaan: ${salutation === "none" ? "Langsung pada inti permasalahan tanpa sapaan." : `Gunakan sapaan "${salutation}".`}`);
    lines.push(`- Ejaan: Gunakan tata bahasa dan ejaan baku (misal: "sudah", "terima kasih", "bagaimana", bukan "udah", "makasih", "gimana").`);
  } else {
    lines.push(`- Bahasa Utama: Bahasa Indonesia santai dan kolaboratif. Pertahankan istilah teknis dalam bahasa aslinya (English), misal: \`response\`, \`fallback\`, \`helper\`, \`flow\`.`);
    lines.push(`- Bila penerima atau thread percakapan dominan dalam Bahasa Inggris, balas sepenuhnya dalam Bahasa Inggris.`);
    lines.push(`- Kata Ganti: Gunakan "${pronoun}" bila membutuhkan kata ganti orang pertama.`);
    lines.push(`- Sapaan: ${salutation === "none" ? "Tanpa sapaan, langsung mengalir natural." : `Gunakan sapaan "${salutation}" untuk rekan kerja.`}`);
    lines.push(`- Ejaan: Santai, hangat, dan mudah dipahami; tidak perlu kaku atau terlalu formal.`);
  }
  lines.push("");

  lines.push(`## Nada dan Gaya Bicara (Voice & Tone)`);
  if (language === "en") {
    lines.push(`- Tone: Clear, warm, respectful, and focused on technical impact.`);
    lines.push(
      directness === "direct"
        ? `- Directness: Direct and concise. Point out risks and rationale clearly without unnecessary hedging.`
        : `- Directness: Collaborative and inviting. Frame suggestions as questions or open discussions ("What do you think about...", "Could we...").`,
    );
    lines.push(
      emojiPolicy === "none"
        ? `- Emoji: Do not use emojis in technical communications.`
        : emojiPolicy === "free"
          ? `- Emoji: Natural and friendly where appropriate.`
          : `- Emoji: At most one emoji per message for genuine appreciation; avoid if conversation is already crowded.`,
    );
  } else {
    lines.push(`- Nada: Santai, ramah, dan solutif. Sampaikan dampak teknis secara konkret.`);
    lines.push(
      directness === "direct"
        ? `- Tingkat Ketegasan: Lugas dan tegas secara teknis. Jelaskan risiko dan alasan perbaikan tanpa berputar-putar.`
        : `- Tingkat Ketegasan: Lembut dan kolaboratif. Buka ruang diskusi untuk konteks yang belum terlihat ("Bagaimana kalau...", "Sepertinya...", "Mungkin kita bisa...").`,
    );
    if (sanitizedPhrases) {
      lines.push(`- Kosakata khas yang disukai: ${sanitizedPhrases}`);
    } else if (language !== "id-formal") {
      lines.push(`- Kosakata khas yang natural: "makasih", "udah", "buat", "sepertinya", "bagaimana kalau", "ya".`);
    }
    lines.push(
      emojiPolicy === "none"
        ? `- Kebijakan Emoji: Dilarang menggunakan emoji.`
        : emojiPolicy === "free"
          ? `- Kebijakan Emoji: Santai dan ekspresif bila membantu kehangatan suasana.`
          : `- Kebijakan Emoji: Maksimal 1 emoji per pesan hanya bila menambah apresiasi atau kehangatan; jangan gunakan jika thread sudah ramai emoji.`,
    );
  }
  lines.push("");

  lines.push(`## Kebiasaan Code Review`);
  lines.push(`- Berikan apresiasi spesifik terhadap pekerjaan yang diselesaikan dengan baik sebelum membahas concern.`);
  lines.push(`- Fokus pada dampak langsung kode: kebenaran logika (*correctness*), maintainability, performa, dan readability.`);
  if (suggestions) {
    lines.push(
      `- Gunakan GitHub code suggestion block (\`\`\`suggestion) untuk perbaikan kode yang spesifik dan terisolasi (typo, naming, refactoring kecil) agar author dapat langsung melakukan 1-click commit.`,
    );
  } else {
    lines.push(
      `- Utamakan penjelasan konseptual dan alasan arsitektural daripada memaksakan snippet kode pengganti.`,
    );
  }
  lines.push(`- Jangan gunakan label keparahan kaku seperti [BLOCKING] atau [NIT]. Sampaikan urgensi melalui kalimat yang sopan dan jelas.`);
  lines.push(`- Gunakan komentar inline untuk kode pada diff; gunakan komentar level PR dengan referensi file:baris untuk kode di luar diff.`);
  lines.push("");

  lines.push(`## Privasi dan Keamanan`);
  lines.push(`- Jangan pernah menyertakan rahasia, token, credential, data pribadi (PII), atau informasi internal sensitif ke dalam draf.`);
  lines.push(`- Selalu tampilkan draf kepada pengguna terlebih dahulu untuk diverifikasi sebelum melakukan posting apa pun.`);

  return lines.join("\n");
}

async function askText(rl, question, defaultValue = "") {
  const prompt = defaultValue
    ? `${c.yellow("?")} ${question} ${c.dim(`[${defaultValue}]`)}: `
    : `${c.yellow("?")} ${question}: `;
  const answer = (await rl.question(prompt)).trim();
  return answer || defaultValue;
}

async function askChoice(rl, output, question, choices, defaultIndex = 0) {
  output.write(`\n${c.bold(question)}\n`);
  choices.forEach((choice, idx) => {
    const isDefault = idx === defaultIndex;
    const num = c.cyan(`[${idx + 1}]`);
    const def = isDefault ? c.dim(" (default)") : "";
    output.write(`  ${num} ${choice.label}${def}\n`);
  });

  while (true) {
    const prompt = `${c.yellow("?")} Pilih [1-${choices.length}] (default: ${defaultIndex + 1}): `;
    const raw = (await rl.question(prompt)).trim();
    if (!raw) return choices[defaultIndex].value;

    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 1 && num <= choices.length) {
      return choices[num - 1].value;
    }
    output.write(`${c.red("✖ Pilihan tidak valid.")} Masukkan angka antara 1 dan ${choices.length}.\n`);
  }
}

export async function runInteractiveWizard({
  input = process.stdin,
  output = process.stdout,
  homeDirectory = os.homedir(),
  workspaceDir = process.cwd(),
} = {}) {
  const rl = readline.createInterface({ input, output });

  let interrupted = false;
  const sigintHandler = () => {
    interrupted = true;
    output.write(`\n\n${c.yellow("❌ Setup dibatalkan (interrupted).")}\n`);
    rl.close();
  };
  rl.on("SIGINT", sigintHandler);

  try {
    output.write(`\n${c.bold(c.cyan("======================================================="))}\n`);
    output.write(`   🧙 ${c.bold(c.magenta("Selamat Datang di Persona Wizard"))} ${c.cyan("`my-bahasa-gweh`")}\n`);
    output.write(`${c.bold(c.cyan("======================================================="))}\n`);
    output.write("Wizard ini akan memandu Anda membuat persona komunikasi\n");
    output.write("yang akurat dan sesuai dengan gaya Anda sehari-hari.\n");

    const setupMode = await askChoice(
      rl,
      output,
      "Pilih metode setup persona:",
      [
        { label: "Full Custom (Kustomisasi lengkap langkah demi langkah)", value: "custom" },
        { label: "Quickstart (Pilih preset terdekat lalu sesuaikan nama & sapaan)", value: "quick" },
      ],
      0,
    );

    let answers = {};

    if (setupMode === "quick") {
      const presets = await listAvailablePresets();
      const presetChoice = await askChoice(
        rl,
        output,
        "Pilih preset dasar yang paling mendekati gaya Anda:",
        presets.map((p) => ({ label: p, value: p })),
        0,
      );

      const name = await askText(rl, "Nama panggilan Anda", "Reviewer");
      const pronoun = await askChoice(
        rl,
        output,
        "Kata ganti orang pertama yang disukai:",
        [
          { label: 'saya (aman dan sopan)', value: "saya" },
          { label: 'aku (akrab dan hangat)', value: "aku" },
          { label: 'gw / gue (kasual peer-to-peer)', value: "gw" },
          { label: 'I (English)', value: "I" },
        ],
        0,
      );

      const salutation = await askText(rl, "Sapaan favorit untuk rekan kerja (misal: kak, mas, bro, atau 'none')", "kak");

      answers = {
        name,
        role: "Software Engineer",
        language: presetChoice === "tech-en" ? "en" : presetChoice === "formal-id" ? "id-formal" : "id-santai",
        pronoun,
        salutation: salutation.toLowerCase() === "none" ? "none" : salutation,
        directness: presetChoice === "formal-id" ? "direct" : "gentle",
        emojiPolicy: presetChoice === "formal-id" ? "none" : "minimal",
        suggestions: true,
      };
    } else {
      // Full Custom
      output.write("\n--- 1. Identitas & Peran ---");
      const name = await askText(rl, "Siapa nama panggilan Anda?", "Reviewer");
      const role = await askText(rl, "Apa peran atau fokus Anda?", "Software Engineer");

      output.write("\n--- 2. Bahasa & Sapaan ---");
      const language = await askChoice(
        rl,
        output,
        "Gaya bahasa utama yang ingin digunakan:",
        [
          { label: "Bahasa Indonesia santai & kolaboratif (rekomendasi)", value: "id-santai" },
          { label: "Bahasa Indonesia formal & tertib (enterprise / korporat)", value: "id-formal" },
          { label: "English (Professional & constructive)", value: "en" },
        ],
        0,
      );

      const pronoun =
        language === "en"
          ? await askText(rl, "First-person pronoun", "I")
          : await askChoice(
              rl,
              output,
              "Kata ganti orang pertama yang ingin digunakan:",
              [
                { label: 'saya (sopan & profesional)', value: "saya" },
                { label: 'aku (hangat & akrab)', value: "aku" },
                { label: 'gw / gue (kasual santai)', value: "gw" },
              ],
              0,
            );

      const salutation = await askChoice(
        rl,
        output,
        "Cara menyapa rekan kerja:",
        [
          { label: 'Gunakan "kak" (fleksibel dan netral)', value: "kak" },
          { label: 'Gunakan "mas/mbak" bila preferensi jelas, selain itu "kak"', value: "mas/mbak" },
          { label: 'Langsung sebut nama / tanpa sapaan formal', value: "none" },
        ],
        0,
      );

      output.write("\n--- 3. Nada Bicara (Tone & Directness) ---");
      const directness = await askChoice(
        rl,
        output,
        "Pendekatan saat memberikan kritik atau saran perbaikan:",
        [
          { label: 'Lembut & kolaboratif ("Bagaimana kalau...", "Sepertinya...", ruang diskusi terbuka)', value: "gentle" },
          { label: 'Lugas & tegas ("Perlu disesuaikan karena...", to the point pada dampak teknis)', value: "direct" },
        ],
        0,
      );

      const emojiPolicy = await askChoice(
        rl,
        output,
        "Kebijakan penggunaan emoji:",
        [
          { label: "Maksimal 1 emoji untuk apresiasi tulus (rekomendasi)", value: "minimal" },
          { label: "Santai & ekspresif (bebas bila menambah kehangatan)", value: "free" },
          { label: "Tanpa emoji sama sekali (zero emoji)", value: "none" },
        ],
        0,
      );

      output.write("\n--- 4. Kebiasaan Code Review ---");
      const suggestions = await askChoice(
        rl,
        output,
        "Apakah ingin menyertakan blok GitHub Code Suggestion (```suggestion)?",
        [
          { label: "Ya, gunakan suggestion untuk perbaikan konkret (typo, naming, bug fix)", value: true },
          { label: "Tidak, utamakan penjelasan narasi konseptual", value: false },
        ],
        0,
      );

      const customPhrases = await askText(
        rl,
        "Kosakata transisi khas Anda (opsional, contoh: 'udah, makasih, coba cek')",
        "",
      );

      answers = {
        name,
        role,
        language,
        pronoun,
        salutation,
        directness,
        emojiPolicy,
        suggestions,
        customPhrases,
      };
    }

    // Live preview
    output.write("\n=======================================================\n");
    output.write("   🔍 Live Preview Komentar Review yang Dihasilkan\n");
    output.write("=======================================================\n\n");
    output.write(generateSampleComment(answers));
    output.write("\n\n-------------------------------------------------------\n");

    const isConfirmed = await askChoice(
      rl,
      output,
      "Apakah contoh gaya komunikasi di atas sudah sesuai?",
      [
        { label: "Ya, simpan profil ini", value: true },
        { label: "Batal / Keluar tanpa menyimpan", value: false },
      ],
      0,
    );

    if (!isConfirmed) {
      output.write(`\n${c.yellow("❌ Setup dibatalkan.")} Tidak ada file yang diubah.\n`);
      return null;
    }

    // Target location
    const targetChoice = await askChoice(
      rl,
      output,
      "Pilih lokasi penyimpanan profil:",
      [
        {
          label: `Global (~/.config/my-bahasa-gweh/profile.md) - Berlaku untuk semua proyek`,
          value: "global",
        },
        {
          label: `Lokal Proyek (.my-bahasa.md) - Hanya berlaku untuk repositori saat ini`,
          value: "local",
        },
      ],
      0,
    );

    const compiledMarkdown = compileProfile(answers);
    let targetPath = "";

    if (targetChoice === "local") {
      targetPath = path.join(workspaceDir, ".my-bahasa.md");
      await writeFile(targetPath, compiledMarkdown, "utf8");
    } else {
      targetPath = getUserProfilePath(homeDirectory);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, compiledMarkdown, "utf8");
    }

    output.write(`\n${c.green("✔")} Profil berhasil disimpan di: ${c.bold(c.cyan(targetPath))}\n`);
    output.write(c.dim("Sekarang agen AI Anda akan menggunakan persona baru ini secara otomatis!\n\n"));

    return { targetPath, answers, content: compiledMarkdown };
  } finally {
    rl.close();
  }
}
