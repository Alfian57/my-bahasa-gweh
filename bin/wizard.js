import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as readline from "node:readline/promises";
import { c } from "./colors.js";
import {
  exportRules,
  getProfilesDir,
  getUserProfilePath,
  listAvailablePresets,
  pathExists,
} from "./my-bahasa-gweh.js";

export function generateSampleComment(answers) {
  const {
    name = "Reviewer",
    language = "id-santai",
    customLanguage = "",
    pronoun = "saya",
    salutation = "kak",
    directness = "gentle",
    customDirectness = "",
    emojiPolicy = "minimal",
    customEmojiPolicy = "",
    suggestions = true,
    freeformDescription = "",
  } = answers;

  if (language === "en") {
    const greeting =
      salutation && salutation !== "none"
        ? `Thanks for putting this together, ${salutation}!`
        : "Thanks for putting this together!";
    const emoji = emojiPolicy === "none" ? "" : " 🎉";
    const codeBlock =
      suggestions === true || suggestions === "flexible"
        ? `\n\`\`\`suggestion\nconst timeout = options.timeout ?? 5000;\n\`\`\`\n`
        : "";
    const body =
      directness === "direct"
        ? "Overall the flow is clean. An edge case exists when options are undefined and needs handling:"
        : "The flow looks clean. I noticed an edge case when options are undefined. What do you think about setting a default fallback?";
    return `${greeting}${emoji}\n\n${body}${codeBlock}This will ensure network calls don't hang unexpectedly.`;
  }

  if (language === "id-formal") {
    const sapaan = salutation && salutation !== "none" ? `${salutation}, ` : "";
    const emoji = emojiPolicy === "free" ? " 👍" : "";
    const codeBlock =
      suggestions === true || suggestions === "flexible"
        ? `\n\`\`\`suggestion\nconst timeout = options.timeout ?? 5000;\n\`\`\`\n`
        : "";
    return `Terima kasih atas implementasi perubahan ini. ${sapaan}mohon mempertimbangkan penambahan nilai default timeout untuk mengantisipasi kondisi ketika opsi tidak terdefinisi:${codeBlock}Langkah ini bertujuan untuk mencegah request tertahan tanpa batas waktu saat network mengalami degradasi.${emoji}`;
  }

  // id-santai, custom, or freeform
  const sapaan = salutation && salutation !== "none" ? ` ${salutation}` : "";
  const emoji = emojiPolicy === "none" ? "" : emojiPolicy === "free" ? " 🎉" : " 👍";
  const codeBlock =
    suggestions === true || suggestions === "flexible"
      ? `\n\`\`\`suggestion\nconst timeout = options.timeout ?? 5000;\n\`\`\`\n`
      : "";

  let body = "";
  if (directness === "direct") {
    body =
      "Secara keseluruhan implementasi sesuai. Ada edge case ketika options bernilai undefined yang perlu ditangani:";
  } else if (directness === "mentor") {
    body =
      "Struktur kodenya rapi dan mudah dipahami. Sedikit catatan arsitektural: jika opsi bernilai undefined, request berisiko menggantung tanpa batas waktu. Sebaiknya kita definisikan default fallback:";
  } else if (directness === "concise") {
    body = "Rapi! Minor edge case fallback:";
  } else if (directness === "custom" && customDirectness) {
    body = `Kodenya rapi. Menyesuaikan preferensi (${customDirectness}): perhatikan fallback saat options undefined:`;
  } else {
    body =
      "Secara keseluruhan kodenya rapi. Sepertinya ada kemungkinan edge case kalau nilainya undefined. Bagaimana kalau kita tambahkan default fallback:";
  }

  const ending =
    directness === "concise"
      ? ""
      : "\nBiar aman pas network lagi lambat atau ada payload yang kosong.";
  return `Makasih udah implementasi flow ini${sapaan}!${emoji}\n\n${body}${codeBlock}${ending}`.trim();
}

export function compileProfile(answers) {
  const {
    name = "Reviewer",
    role = "Software Engineer",
    mode = "custom",
    language = "id-santai",
    customLanguage = "",
    pronoun = "saya",
    salutation = "kak",
    directness = "gentle",
    customDirectness = "",
    emojiPolicy = "minimal",
    customEmojiPolicy = "",
    suggestions = true,
    reviewFocus = "balanced",
    customReviewFocus = "",
    customPhrases = "",
    customInstructions = "",
    freeformDescription = "",
  } = answers;

  const sanitizedPhrases = customPhrases ? customPhrases.replace(/[\r\n\t]+/g, " ").trim() : "";

  const lines = [];
  lines.push(`<!-- schema-version: 1 -->`);
  lines.push(`# Profil Komunikasi - ${name}\n`);

  lines.push(`## Identitas Pengguna`);
  lines.push(`- Nama / Panggilan: ${name}`);
  lines.push(`- Peran Utama: ${role}\n`);

  if (freeformDescription && freeformDescription.trim()) {
    lines.push(`## Gaya Komunikasi Bebas (Freeform Persona)`);
    lines.push(`${freeformDescription.trim()}\n`);
  }

  lines.push(`## Bahasa dan Sapaan`);
  if (language === "custom" && customLanguage) {
    lines.push(`- Bahasa Utama: ${customLanguage}`);
    lines.push(`- Kata Ganti: Gunakan "${pronoun}" bila membutuhkan kata ganti orang pertama.`);
    lines.push(
      `- Sapaan: ${salutation === "none" ? "Tanpa sapaan formal, langsung ke pokok bahasan." : `Gunakan sapaan "${salutation}".`}`,
    );
  } else if (language === "en") {
    lines.push(`- Bahasa Utama: English (Professional, collaborative, and constructive).`);
    lines.push(`- Kata Ganti: "${pronoun}" for personal thoughts, "we" for team decisions.`);
    lines.push(
      `- Sapaan: ${salutation === "none" ? "Direct / no salutation needed." : `Use "${salutation}" when natural.`}`,
    );
  } else if (language === "id-formal") {
    lines.push(
      `- Bahasa Utama: Bahasa Indonesia baku, tertib, dan profesional. Istilah teknis tetap dalam bahasa aslinya atau code font.`,
    );
    lines.push(
      `- Kata Ganti: "${pronoun}". Hindari penggunaan kata ganti informal seperti "aku" atau "gue".`,
    );
    lines.push(
      `- Sapaan: ${salutation === "none" ? "Langsung pada inti permasalahan tanpa sapaan." : `Gunakan sapaan "${salutation}".`}`,
    );
    lines.push(
      `- Ejaan: Gunakan tata bahasa dan ejaan baku (misal: "sudah", "terima kasih", "bagaimana", bukan "udah", "makasih", "gimana").`,
    );
  } else {
    lines.push(
      `- Bahasa Utama: Bahasa Indonesia santai dan kolaboratif. Pertahankan istilah teknis dalam bahasa aslinya (English), misal: \`response\`, \`fallback\`, \`helper\`, \`flow\`.`,
    );
    lines.push(
      `- Bila penerima atau thread percakapan dominan dalam Bahasa Inggris, balas sepenuhnya dalam Bahasa Inggris.`,
    );
    lines.push(`- Kata Ganti: Gunakan "${pronoun}" bila membutuhkan kata ganti orang pertama.`);
    lines.push(
      `- Sapaan: ${salutation === "none" ? "Tanpa sapaan, langsung mengalir natural." : `Gunakan sapaan "${salutation}" untuk rekan kerja.`}`,
    );
    lines.push(`- Ejaan: Santai, hangat, dan mudah dipahami; tidak perlu kaku atau terlalu formal.`);
  }
  lines.push("");

  lines.push(`## Nada dan Gaya Bicara (Voice & Tone)`);
  if (language === "en") {
    lines.push(`- Tone: Clear, warm, respectful, and focused on technical impact.`);
    if (directness === "direct") {
      lines.push(
        `- Directness: Direct and concise. Point out risks and rationale clearly without unnecessary hedging.`,
      );
    } else if (directness === "mentor") {
      lines.push(
        `- Directness: Mentoring and educational. Explain architectural trade-offs and rationale constructively.`,
      );
    } else if (directness === "concise") {
      lines.push(
        `- Directness: Concise and solution-oriented. Prioritize bullet points and concrete diffs over prose.`,
      );
    } else if (directness === "custom" && customDirectness) {
      lines.push(`- Custom Voice & Directness: ${customDirectness}`);
    } else {
      lines.push(
        `- Directness: Collaborative and inviting. Frame suggestions as questions or open discussions ("What do you think about...", "Could we...").`,
      );
    }

    if (emojiPolicy === "none") {
      lines.push(`- Emoji: Do not use emojis in technical communications.`);
    } else if (emojiPolicy === "free") {
      lines.push(`- Emoji: Natural and friendly where appropriate.`);
    } else if (emojiPolicy === "custom" && customEmojiPolicy) {
      lines.push(`- Emoji: ${customEmojiPolicy}`);
    } else {
      lines.push(
        `- Emoji: At most one emoji per message for genuine appreciation; avoid if conversation is already crowded.`,
      );
    }
  } else {
    lines.push(`- Nada: Santai, ramah, dan solutif. Sampaikan dampak teknis secara konkret.`);
    if (directness === "direct") {
      lines.push(
        `- Tingkat Ketegasan: Lugas dan tegas secara teknis. Jelaskan risiko dan alasan perbaikan tanpa berputar-putar.`,
      );
    } else if (directness === "mentor") {
      lines.push(
        `- Tingkat Ketegasan: Edukatif dan mengayomi. Jelaskan alasan teknis, konteks arsitektural, dan dampak jangka panjang secara konstruktif.`,
      );
    } else if (directness === "concise") {
      lines.push(
        `- Tingkat Ketegasan: Sangat ringkas dan hemat kata. Gunakan poin-poin terstruktur dan fokus langsung pada solusi kode.`,
      );
    } else if (directness === "custom" && customDirectness) {
      lines.push(`- Gaya Nada Khusus: ${customDirectness}`);
    } else {
      lines.push(
        `- Tingkat Ketegasan: Lembut dan kolaboratif. Buka ruang diskusi untuk konteks yang belum terlihat ("Bagaimana kalau...", "Sepertinya...", "Mungkin kita bisa...").`,
      );
    }

    if (sanitizedPhrases) {
      lines.push(`- Kosakata khas yang disukai: ${sanitizedPhrases}`);
    } else if (language !== "id-formal") {
      lines.push(
        `- Kosakata khas yang natural: "makasih", "udah", "buat", "sepertinya", "bagaimana kalau", "ya".`,
      );
    }

    if (emojiPolicy === "none") {
      lines.push(`- Kebijakan Emoji: Dilarang menggunakan emoji.`);
    } else if (emojiPolicy === "free") {
      lines.push(`- Kebijakan Emoji: Santai dan ekspresif bila membantu kehangatan suasana.`);
    } else if (emojiPolicy === "custom" && customEmojiPolicy) {
      lines.push(`- Kebijakan Emoji: ${customEmojiPolicy}`);
    } else {
      lines.push(
        `- Kebijakan Emoji: Maksimal 1 emoji per pesan hanya bila menambah apresiasi atau kehangatan; jangan gunakan jika thread sudah ramai emoji.`,
      );
    }
  }
  lines.push("");

  lines.push(`## Kebiasaan Code Review`);
  lines.push(
    `- Berikan apresiasi spesifik terhadap pekerjaan yang diselesaikan dengan baik sebelum membahas concern.`,
  );
  lines.push(
    `- Fokus pada dampak langsung kode: kebenaran logika (*correctness*), maintainability, performa, dan readability.`,
  );

  if (suggestions === true) {
    lines.push(
      `- Gunakan GitHub code suggestion block (\`\`\`suggestion) untuk perbaikan kode yang spesifik dan terisolasi (typo, naming, refactoring kecil) agar author dapat langsung melakukan 1-click commit.`,
    );
  } else if (suggestions === "flexible") {
    lines.push(
      `- Gunakan GitHub code suggestion block (\`\`\`suggestion) secara fleksibel untuk typo dan perbaikan kecil; utamakan narasi untuk keputusan arsitektur.`,
    );
  } else {
    lines.push(
      `- Utamakan penjelasan konseptual dan alasan arsitektural daripada memaksakan snippet kode pengganti.`,
    );
  }

  if (reviewFocus === "architecture") {
    lines.push(
      `- Fokus Prioritas: Keandalan arsitektur, skalabilitas sistem, failure modes, dan antisipasi edge cases.`,
    );
  } else if (reviewFocus === "cleancode") {
    lines.push(
      `- Fokus Prioritas: Keterbacaan kode (clean code), penamaan deskriptif, dan konsistensi pola.`,
    );
  } else if (reviewFocus === "custom" && customReviewFocus) {
    lines.push(`- Fokus Prioritas Khusus: ${customReviewFocus}`);
  }

  lines.push(
    `- Jangan gunakan label keparahan kaku seperti [BLOCKING] atau [NIT]. Sampaikan urgensi melalui kalimat yang sopan dan jelas.`,
  );
  lines.push(
    `- Gunakan komentar inline untuk kode pada diff; gunakan komentar level PR dengan referensi file:baris untuk kode di luar diff.`,
  );
  lines.push("");

  if (customInstructions && customInstructions.trim()) {
    lines.push(`## Aturan dan Kebiasaan Khusus Tambahan`);
    const instructions = customInstructions
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const inst of instructions) {
      lines.push(inst.startsWith("- ") ? inst : `- ${inst}`);
    }
    lines.push("");
  }

  lines.push(`## Privasi dan Keamanan`);
  lines.push(
    `- Jangan pernah menyertakan rahasia, token, credential, data pribadi (PII), atau informasi internal sensitif ke dalam draf.`,
  );
  lines.push(
    `- Selalu tampilkan draf kepada pengguna terlebih dahulu untuk diverifikasi sebelum melakukan posting apa pun.`,
  );

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
    output.write(
      `${c.red("✖ Pilihan tidak valid.")} Masukkan angka antara 1 dan ${choices.length}.\n`,
    );
  }
}

async function askChoiceWithCustom(
  rl,
  output,
  question,
  standardChoices,
  customLabel = "Custom / Tulis sendiri...",
  customPrompt = "Masukkan pilihan kustom Anda",
  defaultIndex = 0,
) {
  const choices = [
    ...standardChoices,
    { label: customLabel, value: "__custom__" },
  ];
  const selected = await askChoice(rl, output, question, choices, defaultIndex);
  if (selected === "__custom__") {
    const customValue = await askText(rl, customPrompt, "");
    return { isCustom: true, value: "custom", customText: customValue };
  }
  return { isCustom: false, value: selected, customText: "" };
}

export async function runInteractiveWizard({
  input = process.stdin,
  output = process.stdout,
  homeDirectory = os.homedir(),
  workspaceDir = process.cwd(),
  rl = null,
} = {}) {
  rl = rl || readline.createInterface({ input, output });

  let interrupted = false;
  const sigintHandler = () => {
    interrupted = true;
    output.write(`\n\n${c.yellow("❌ Setup dibatalkan (interrupted).")}\n`);
    if (typeof rl.close === "function") {
      rl.close();
    }
  };
  if (typeof rl.on === "function") {
    rl.on("SIGINT", sigintHandler);
  }

  try {
    output.write(
      `\n${c.bold(c.cyan("======================================================="))}\n`,
    );
    output.write(
      `   🧙 ${c.bold(c.magenta("Selamat Datang di Persona Wizard"))} ${c.cyan("`my-bahasa-gweh`")}\n`,
    );
    output.write(
      `${c.bold(c.cyan("======================================================="))}\n`,
    );
    output.write("Wizard ini akan memandu Anda membuat persona komunikasi\n");
    output.write("yang fleksibel, autentik, dan sesuai dengan gaya Anda sehari-hari.\n");

    const setupMode = await askChoice(
      rl,
      output,
      "Pilih metode setup persona:",
      [
        {
          label: "Full Custom (Kustomisasi lengkap langkah demi langkah dengan opsi bebas)",
          value: "custom",
        },
        {
          label: "Quickstart dari Archetype (Pilih persona dasar yang siap pakai)",
          value: "quick",
        },
        {
          label: "Freeform Persona Builder (Deskripsikan gaya/persona unik Anda dengan bebas)",
          value: "freeform",
        },
      ],
      0,
    );

    let answers = {};

    if (setupMode === "freeform") {
      output.write("\n--- Freeform Persona Builder ---");
      output.write(
        c.dim(
          "\nAnda dapat mendeskripsikan persona apa pun secara bebas tanpa terikat pola pilihan sistem.\n",
        ),
      );

      const name = await askText(rl, "Siapa nama panggilan Anda?", "Reviewer");
      const role = await askText(rl, "Apa peran atau fokus Anda?", "Software Engineer");
      const freeformDescription = await askText(
        rl,
        "Deskripsikan gaya komunikasi Anda secara bebas (misal: 'Senior backend Go dev, santai dan suka humor bapak-bapak, to the point soal memory leak tapi ramah')",
        "Santai, ramah, kolaboratif, dan solutif dalam memberikan saran teknis.",
      );

      const salutationChoice = await askChoiceWithCustom(
        rl,
        output,
        "Sapaan rekan kerja yang disukai:",
        [
          { label: 'Gunakan "kak" (fleksibel dan netral)', value: "kak" },
          { label: 'Gunakan "bang/bro"', value: "bang" },
          { label: 'Gunakan "mas/mbak"', value: "mas/mbak" },
          { label: "Langsung sebut nama / tanpa sapaan formal", value: "none" },
        ],
        "Custom (masukkan sapaan favorit sendiri)",
        "Sapaan yang ingin digunakan",
        0,
      );
      const salutation = salutationChoice.isCustom
        ? salutationChoice.customText
        : salutationChoice.value;

      const pronounChoice = await askChoiceWithCustom(
        rl,
        output,
        "Kata ganti orang pertama yang disukai:",
        [
          { label: "saya (sopan & profesional)", value: "saya" },
          { label: "aku (hangat & akrab)", value: "aku" },
          { label: "gw / gue (kasual peer-to-peer)", value: "gw" },
          { label: "I (English)", value: "I" },
        ],
        "Custom (masukkan kata ganti sendiri, misal: 'kami', 'ane')",
        "Kata ganti yang ingin digunakan",
        0,
      );
      const pronoun = pronounChoice.isCustom ? pronounChoice.customText : pronounChoice.value;

      const customInstructions = await askText(
        rl,
        "Instruksi atau pantangan khusus lainnya (opsional, misal: 'Jangan pakai singkatan', 'Utamakan test')",
        "",
      );

      answers = {
        name,
        role,
        mode: "freeform",
        language: "id-santai",
        pronoun,
        salutation,
        directness: "gentle",
        emojiPolicy: "minimal",
        suggestions: true,
        freeformDescription,
        customInstructions,
      };
    } else if (setupMode === "quick") {
      const archetypes = [
        {
          label: "Default Kolaboratif (Santai, hangat, apresiatif, fokus dampak teknis)",
          value: "default",
          role: "Software Engineer",
          language: "id-santai",
          directness: "gentle",
          emojiPolicy: "minimal",
        },
        {
          label: "Tech Lead / Architect (Pragmatis, fokus keandalan sistem & edge cases)",
          value: "architect",
          role: "Tech Lead / System Architect",
          language: "id-santai",
          directness: "direct",
          emojiPolicy: "minimal",
          reviewFocus: "architecture",
        },
        {
          label: "Friendly Mentor (Edukatif, membimbing, menjelaskan alasan arsitektural)",
          value: "mentor",
          role: "Senior Engineer / Mentor",
          language: "id-santai",
          directness: "mentor",
          emojiPolicy: "free",
        },
        {
          label: "Enterprise Formal (Bahasa Indonesia baku, tertib, tanpa emoji)",
          value: "formal",
          role: "Enterprise Engineer",
          language: "id-formal",
          directness: "direct",
          emojiPolicy: "none",
        },
        {
          label: "Tech English (Professional, constructive, clear and concise)",
          value: "tech-en",
          role: "Software Engineer",
          language: "en",
          directness: "direct",
          emojiPolicy: "minimal",
        },
      ];

      const archetypeChoice = await askChoice(
        rl,
        output,
        "Pilih archetype persona dasar yang paling mendekati gaya Anda:",
        archetypes.map((a) => ({ label: a.label, value: a.value })),
        0,
      );

      const selectedArchetype =
        archetypes.find((a) => a.value === archetypeChoice) || archetypes[0];

      const name = await askText(rl, "Nama panggilan Anda", "Reviewer");

      const pronounChoice = await askChoiceWithCustom(
        rl,
        output,
        "Kata ganti orang pertama yang disukai:",
        [
          { label: "saya (aman dan sopan)", value: "saya" },
          { label: "aku (akrab dan hangat)", value: "aku" },
          { label: "gw / gue (kasual peer-to-peer)", value: "gw" },
          { label: "I (English)", value: "I" },
        ],
        "Custom (tulis sendiri)",
        "Kata ganti yang diinginkan",
        0,
      );
      const pronoun = pronounChoice.isCustom ? pronounChoice.customText : pronounChoice.value;

      const salutationChoice = await askChoiceWithCustom(
        rl,
        output,
        "Sapaan rekan kerja yang disukai:",
        [
          { label: 'Gunakan "kak" (fleksibel dan netral)', value: "kak" },
          { label: 'Gunakan "mas/mbak"', value: "mas/mbak" },
          { label: 'Gunakan "bang/bro"', value: "bang" },
          { label: "Langsung sebut nama / tanpa sapaan formal", value: "none" },
        ],
        "Custom (tulis sendiri)",
        "Sapaan favorit Anda",
        0,
      );
      const salutation = salutationChoice.isCustom
        ? salutationChoice.customText
        : salutationChoice.value;

      const customInstructions = await askText(
        rl,
        "Aturan atau kebiasaan khusus tambahan (opsional)",
        "",
      );

      answers = {
        name,
        role: selectedArchetype.role,
        mode: "quick",
        language: selectedArchetype.language,
        pronoun,
        salutation,
        directness: selectedArchetype.directness,
        emojiPolicy: selectedArchetype.emojiPolicy,
        suggestions: true,
        reviewFocus: selectedArchetype.reviewFocus || "balanced",
        customInstructions,
      };
    } else {
      // Full Custom
      output.write("\n--- 1. Identitas & Peran ---");
      const name = await askText(rl, "Siapa nama panggilan Anda?", "Reviewer");
      const role = await askText(rl, "Apa peran atau fokus Anda?", "Software Engineer");

      output.write("\n--- 2. Bahasa & Sapaan ---");
      const langChoice = await askChoiceWithCustom(
        rl,
        output,
        "Gaya bahasa utama yang ingin digunakan:",
        [
          { label: "Bahasa Indonesia santai & kolaboratif (rekomendasi)", value: "id-santai" },
          { label: "Bahasa Indonesia formal & tertib (enterprise / korporat)", value: "id-formal" },
          { label: "English (Professional & constructive)", value: "en" },
        ],
        "Custom (masukkan preferensi bahasa sendiri)",
        "Jelaskan preferensi bahasa Anda (misal: Campuran Indo-Inggris, bahasa daerah, dll.)",
        0,
      );
      const language = langChoice.value;
      const customLanguage = langChoice.customText;

      const pronounChoice =
        language === "en"
          ? { isCustom: false, value: await askText(rl, "First-person pronoun", "I"), customText: "" }
          : await askChoiceWithCustom(
              rl,
              output,
              "Kata ganti orang pertama yang ingin digunakan:",
              [
                { label: "saya (sopan & profesional)", value: "saya" },
                { label: "aku (hangat & akrab)", value: "aku" },
                { label: "gw / gue (kasual santai)", value: "gw" },
              ],
              "Custom (masukkan kata ganti sendiri, misal: 'kami', 'ane')",
              "Kata ganti orang pertama yang diinginkan",
              0,
            );
      const pronoun = pronounChoice.isCustom ? pronounChoice.customText : pronounChoice.value;

      const salutationChoice = await askChoiceWithCustom(
        rl,
        output,
        "Cara menyapa rekan kerja:",
        [
          { label: 'Gunakan "kak" (fleksibel dan netral)', value: "kak" },
          { label: 'Gunakan "mas/mbak" bila preferensi jelas, selain itu "kak"', value: "mas/mbak" },
          { label: 'Gunakan "bang/bro"', value: "bang" },
          { label: "Langsung sebut nama / tanpa sapaan formal", value: "none" },
        ],
        "Custom (masukkan sapaan favorit Anda)",
        "Sapaan yang ingin digunakan",
        0,
      );
      const salutation = salutationChoice.isCustom
        ? salutationChoice.customText
        : salutationChoice.value;

      output.write("\n--- 3. Nada Bicara (Tone & Directness) ---");
      const directnessChoice = await askChoiceWithCustom(
        rl,
        output,
        "Pendekatan saat memberikan review atau saran perbaikan:",
        [
          {
            label: 'Lembut & kolaboratif ("Bagaimana kalau...", "Sepertinya...", ruang diskusi terbuka)',
            value: "gentle",
          },
          {
            label: 'Lugas & to-the-point ("Perlu disesuaikan karena...", fokus pada dampak teknis)',
            value: "direct",
          },
          {
            label: "Edukatif & membimbing (Mentor, menjelaskan alasan arsitektural dan konteks mendalam)",
            value: "mentor",
          },
          {
            label: "Ringkas & hemat kata (Bullet points, minimal narasi, fokus code diff)",
            value: "concise",
          },
        ],
        "Custom (deskripsikan gaya nada bicara sendiri)",
        "Deskripsikan gaya nada bicara Anda",
        0,
      );
      const directness = directnessChoice.value;
      const customDirectness = directnessChoice.customText;

      const emojiChoice = await askChoiceWithCustom(
        rl,
        output,
        "Kebijakan penggunaan emoji:",
        [
          { label: "Maksimal 1 emoji untuk apresiasi tulus (rekomendasi)", value: "minimal" },
          { label: "Santai & ekspresif (bebas bila menambah kehangatan)", value: "free" },
          { label: "Tanpa emoji sama sekali (zero emoji)", value: "none" },
        ],
        "Custom (tulis kebijakan emoji Anda sendiri)",
        "Kebijakan emoji yang diinginkan",
        0,
      );
      const emojiPolicy = emojiChoice.value;
      const customEmojiPolicy = emojiChoice.customText;

      output.write("\n--- 4. Kebiasaan Code Review & Aturan Khusus ---");
      const suggestions = await askChoice(
        rl,
        output,
        "Preferensi penggunaan blok GitHub Code Suggestion (```suggestion):",
        [
          {
            label: "Ya, gunakan suggestion untuk perbaikan konkret (typo, naming, bug fix)",
            value: true,
          },
          {
            label: "Fleksibel (hanya untuk typo & bug kecil, utamakan penjelasan untuk arsitektur)",
            value: "flexible",
          },
          { label: "Tidak, utamakan penjelasan narasi konseptual", value: false },
        ],
        0,
      );

      const reviewFocusChoice = await askChoiceWithCustom(
        rl,
        output,
        "Fokus utama yang paling Anda prioritaskan saat code review:",
        [
          {
            label: "Seimbang (Kebenaran logika, maintainability, performa, dan readability)",
            value: "balanced",
          },
          {
            label: "Arsitektur & Edge Cases (Ketahanan sistem, skalabilitas, error handling)",
            value: "architecture",
          },
          {
            label: "Clean Code & Readability (Keterbacaan, penamaan deskriptif, pola konsisten)",
            value: "cleancode",
          },
        ],
        "Custom (masukkan fokus review utama sendiri)",
        "Fokus review utama Anda",
        0,
      );
      const reviewFocus = reviewFocusChoice.value;
      const customReviewFocus = reviewFocusChoice.customText;

      const customPhrases = await askText(
        rl,
        "Kosakata transisi khas Anda (opsional, contoh: 'udah, makasih, coba cek')",
        "",
      );

      const customInstructions = await askText(
        rl,
        "Aturan, pedoman tim, atau kebiasaan khusus lainnya (opsional)",
        "",
      );

      answers = {
        name,
        role,
        mode: "custom",
        language,
        customLanguage,
        pronoun,
        salutation,
        directness,
        customDirectness,
        emojiPolicy,
        customEmojiPolicy,
        suggestions,
        reviewFocus,
        customReviewFocus,
        customPhrases,
        customInstructions,
      };
    }

    // Live preview & refinement loop
    let isConfirmed = false;
    while (!isConfirmed) {
      output.write("\n=======================================================\n");
      output.write("   🔍 Live Preview Komentar Review yang Dihasilkan\n");
      output.write("=======================================================\n\n");
      output.write(generateSampleComment(answers));
      output.write("\n\n-------------------------------------------------------\n");

      const previewChoice = await askChoice(
        rl,
        output,
        "Apakah contoh gaya komunikasi di atas sudah sesuai?",
        [
          { label: "Ya, simpan profil ini ke Global", value: "save" },
          {
            label: "Tambah / modifikasi instruksi khusus sebelum simpan",
            value: "add_rules",
          },
          { label: "Batal / Keluar tanpa menyimpan", value: "cancel" },
        ],
        0,
      );

      if (previewChoice === "cancel") {
        output.write(`\n${c.yellow("❌ Setup dibatalkan.")} Tidak ada file yang diubah.\n`);
        return null;
      }

      if (previewChoice === "add_rules") {
        const extra = await askText(
          rl,
          "Masukkan instruksi atau aturan khusus tambahan",
          answers.customInstructions || "",
        );
        answers.customInstructions = extra;
        continue;
      }

      isConfirmed = true;
    }

    // Always save globally to user profile directory (100% Full Global Philosophy)
    const compiledMarkdown = compileProfile(answers);
    const targetPath = getUserProfilePath(homeDirectory);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, compiledMarkdown, "utf8");

    output.write(`\n${c.green("✔")} Profil berhasil disimpan di: ${c.bold(c.cyan(targetPath))}\n`);
    output.write(
      c.dim("Aturan persona ini berlaku secara global (Zero Repo Pollution).\n\n"),
    );

    const shouldExportGlobal = await askChoice(
      rl,
      output,
      "Terapkan aturan persona ini secara Global ke Claude Code, Cursor, dan Windsurf sekarang?",
      [
        {
          label: "Ya, ekspor ke semua editor AI secara Global (Rekomendasi - Full Global)",
          value: true,
        },
        { label: "Nanti saja (lewati)", value: false },
      ],
      0,
    );

    let exportedGlobalFiles = [];
    if (shouldExportGlobal) {
      exportedGlobalFiles = await exportRules({
        homeDirectory,
        targets: ["all"],
      });
      output.write(`\n${c.green("✔")} Berhasil mengaktifkan aturan persona secara Global:\n`);
      for (const f of exportedGlobalFiles) {
        output.write(`  ${c.cyan("•")} ${f}\n`);
      }
      output.write(
        c.dim("Aturan persona Anda sekarang aktif di seluruh editor AI pada komputer Anda!\n\n"),
      );
    }

    return { targetPath, answers, content: compiledMarkdown, exportedGlobalFiles };
  } finally {
    if (typeof rl?.close === "function") {
      rl.close();
    }
  }
}
