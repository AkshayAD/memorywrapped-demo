// Verification harness for the browser analyzer JS port.
// Runs against the synthetic chats in samples/synthetic_chats/.
// DELETE before deploying — this is dev-only.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseChat, analyze, buildManifest } from "./analyzer.js";
import { isSensitive, snippet } from "./redaction.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const FIXTURES = [
  "samples/synthetic_chats/aarav_meera_anniversary.txt",
  "samples/synthetic_chats/kabir_anaya_wedding.txt",
  "samples/synthetic_chats/riya_naina_friendship_birthday.txt",
];

let totalChecks = 0;
let passedChecks = 0;

function check(name, condition, detail = "") {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  [OK]   ${name}${detail ? " — " + detail : ""}`);
  } else {
    console.log(`  [FAIL] ${name}${detail ? " — " + detail : ""}`);
  }
}

console.log("=".repeat(64));
console.log("MEMORYWRAPPED ANALYZER VERIFICATION");
console.log("=".repeat(64));

// 1. Redaction unit tests
console.log("\n[1] REDACTION UNIT TESTS");
const redactionCases = [
  { input: "my otp is 1234", expectedSensitive: true, why: "OTP keyword" },
  { input: "call me at +91 9876543210", expectedSensitive: true, why: "Indian phone" },
  { input: "email me at foo@bar.com", expectedSensitive: true, why: "email" },
  { input: "https://evil.com/leak", expectedSensitive: true, why: "URL" },
  { input: "my bank account number is 12345678", expectedSensitive: true, why: "bank + long number" },
  { input: "love you so much", expectedSensitive: false, why: "innocent love note" },
  { input: "good morning ☀️", expectedSensitive: false, why: "greeting" },
  { input: "miss you", expectedSensitive: false, why: "short affection" },
];
for (const c of redactionCases) {
  const got = isSensitive(c.input);
  check(`  "${c.input.substring(0, 40)}" — ${c.why}`, got === c.expectedSensitive, `expected ${c.expectedSensitive}, got ${got}`);
}

// 2. Snippet redaction
console.log("\n[2] SNIPPET REDACTION");
const snippetTests = [
  { input: "my OTP is 4521 send asap", expectRedacted: true, why: "private word triggers full redaction" },
  { input: "call me at +91 9876543210 later", expectRedacted: true, why: "phone replaced" },
  { input: "we should book at https://example.com/dinner", expectRedacted: true, why: "URL replaced" },
  { input: "love you so much it hurts", expectRedacted: false, why: "clean" },
];
for (const t of snippetTests) {
  const result = snippet({ text: t.input });
  check(`  "${t.input.substring(0, 35)}"`, result.redacted === t.expectRedacted, `redacted=${result.redacted}, text="${result.text}"`);
}

// 3. Run against each synthetic chat
for (const fixture of FIXTURES) {
  const fpath = resolve(REPO_ROOT, fixture);
  let chatText;
  try {
    chatText = await readFile(fpath, "utf-8");
  } catch (e) {
    console.log(`\n[SKIP] ${fixture} — ${e.code}`);
    continue;
  }

  console.log(`\n[3] FIXTURE: ${fixture}`);
  console.log(`    File size: ${chatText.length} chars`);

  const messages = parseChat(chatText);
  check(`Parses at least 10 messages`, messages.length >= 10, `parsed ${messages.length}`);

  if (messages.length === 0) continue;

  const participants = [...new Set(messages.map(m => m.sender))];
  check(`Has at least 2 participants`, participants.length >= 2, `found: ${participants.join(", ")}`);

  const analysis = analyze(messages);
  check(`Date range valid`, !!analysis.dateRange.from && !!analysis.dateRange.to);
  check(`Extracts quotes`, analysis.quotes.length > 0, `${analysis.quotes.length} quotes`);
  check(`Extracts at least 1 milestone`, analysis.milestones.length >= 1, `${analysis.milestones.length} milestones`);
  check(`Extracts at least 1 motif`, analysis.motifs.length >= 1, `${analysis.motifs.length} motifs`);

  // Stats sanity
  check(`Total messages matches parse`, analysis.stats.totalMessages === messages.length);
  check(`Peak hour formatted`, /^\d{2}:00$/.test(analysis.stats.peakHour), analysis.stats.peakHour);
  check(`Longest streak >= 1`, analysis.stats.longestStreakDays >= 1, `${analysis.stats.longestStreakDays} days`);

  // Build manifest
  const approvals = {
    quotes: Object.fromEntries(analysis.quotes.map(q => [q.id, !q.sensitive])),
    milestones: Object.fromEntries(analysis.milestones.map(m => [m.id, !m.sensitive])),
    motifs: Object.fromEntries(analysis.motifs.map(m => [m.id, !m.sensitive])),
    emojis: Object.fromEntries(analysis.topEmojis.map(e => [e.emoji, true])),
  };
  const manifest = buildManifest(analysis, approvals, {
    title: participants.join(" & "), occasion: "anniversary",
    tone: "balanced", theme: "rose_gold", tier: "wrapped",
  });

  // Schema checks
  check(`Manifest schema == "memorywrapped-manifest@1"`, manifest.schema === "memorywrapped-manifest@1");
  check(`Manifest has approved moments`, manifest.moments.length > 0, `${manifest.moments.length} approved`);
  const tooLong = manifest.moments.filter(m => m.text.length > 200);
  check(`No moment exceeds 200 chars`, tooLong.length === 0, tooLong.length > 0 ? `${tooLong.length} too long` : "all OK");
  const manifestSize = JSON.stringify(manifest).length;
  check(`Manifest under 500KB`, manifestSize < 500 * 1024, `${manifestSize} bytes`);

  // Privacy guarantees (re-formulated for the curated flow):
  //   The customer EXPLICITLY wants their approved words in the manifest — overlap
  //   with raw chat is expected for those. The real privacy guarantees are:
  //     (1) Only approved items appear
  //     (2) Sensitive content auto-flagged is redacted
  //     (3) Manifest is dramatically smaller (curation actually filters)
  //     (4) Only known senders appear

  // (1) All moments in manifest must be approved (we strip approved:false)
  const unapproved = manifest.moments.filter(m => m.approved !== true);
  check(`All manifest moments have approved:true`, unapproved.length === 0, `${unapproved.length} unapproved leaked`);

  // (2) Sensitive content in any moment.text must be flagged redacted (or replaced with redaction marker)
  const missedSensitive = manifest.moments.filter(m =>
    isSensitive(m.text) && !m.redacted && !m.text.includes("Private detail redacted")
  );
  check(`Sensitive text properly redacted`, missedSensitive.length === 0,
    missedSensitive.length > 0 ? `${missedSensitive.length} unflagged` : "all flagged");

  // (3) Manifest is significantly smaller than raw chat — curation worked
  const sizeRatio = manifestSize / chatText.length;
  check(`Manifest < 30% of raw chat (curation worked)`, sizeRatio < 0.30, `${(sizeRatio * 100).toFixed(1)}% of raw`);

  // (4) Sender names in manifest must match original participants
  const manifestSenders = new Set();
  for (const m of manifest.moments) if (m.sender) manifestSenders.add(m.sender);
  for (const m of manifest.milestones) if (m.sender) manifestSenders.add(m.sender);
  const unknownSenders = [...manifestSenders].filter(s => !participants.includes(s));
  check(`Only known senders in manifest`, unknownSenders.length === 0,
    unknownSenders.length > 0 ? `unknown: ${unknownSenders.join(", ")}` : "clean");
}

console.log("\n" + "=".repeat(64));
console.log(`RESULTS: ${passedChecks}/${totalChecks} checks passed`);
console.log("=".repeat(64));
if (passedChecks !== totalChecks) {
  process.exit(1);
}
