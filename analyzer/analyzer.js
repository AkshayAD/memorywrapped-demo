/**
 * MemoryWrapped browser analyzer
 * Port of tools/analyze_chat.py — runs entirely in browser.
 *
 * No network calls. No external dependencies.
 * Verify with DevTools Network tab.
 */

import { PRIVATE_WORDS, STOPWORDS, HINGLISH_MARKERS, words, emojiChars, snippet, isSensitive } from "./redaction.js";

const ANALYZER_VERSION = "1.0.0";

// Mirrors LINE_RE (line 17-20 of analyze_chat.py)
// Matches: 15/01/2020, 9:42 pm - Aarav: hey
const LINE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})[\s  ]*([ap]m|AM|PM)\s+-\s+(.*)$/i;

// Mirrors MILESTONE_PATTERNS (line 231-239)
const MILESTONE_PATTERNS = [
  { title: "First chat spark", patterns: [/\bhello\b/i, /\byo\b/i] },
  { title: "First food memory", patterns: [/\bnoodles?\b/i, /\bbiryani\b/i, /\bdinner\b/i, /\blunch\b/i] },
  { title: "First plan together", patterns: [/\bcome\b/i, /\bmeet\b/i, /\bplans?\b/i, /\bgo out\b/i] },
  { title: "First missing-you note", patterns: [/\bmiss(?:ing)?\b/i] },
  { title: "First love note", patterns: [/\bi love (?:you|u)\b/i, /\blove (?:you|u)\b/i, /\biloveyou\b/i] },
  { title: "Wedding language appears", patterns: [/\bshaadi\b/i, /\bwedding\b/i, /\bmarriage\b/i, /\bmarried\b/i] },
  { title: "Wife/husband era", patterns: [/\bwife\b/i, /\bhusband\b/i, /\bbiwi\b/i, /\bpati\b/i] },
];

// Mirrors motif_specs (line 609-617)
const MOTIF_SPECS = [
  { label: "Good mornings", pattern: /\bgood morning\b/i },
  { label: "Good nights", pattern: /\bgood night\b/i },
  { label: "Love notes", pattern: /\bi love (?:you|u)\b|\blove (?:you|u)\b|\biloveyou\b/i },
  { label: "Missing each other", pattern: /\bmiss(?:ing)?\b/i },
  { label: "Sorry and repair", pattern: /\bsorry\b|\bforgive\b|\bmistake\b/i },
  { label: "Food thread", pattern: /\bfood\b|\bbiryani\b|\bnoodles?\b|\blunch\b|\bdinner\b|\bbreakfast\b/i },
  { label: "Plans and meeting", pattern: /\bmeet\b|\bcome\b|\bplans?\b|\bmovie\b|\bdrive\b|\bgo out\b/i },
];

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseTimestamp(day, month, year, hour, minute, meridiem) {
  let y = parseInt(year, 10);
  if (y < 100) y += 2000;
  let h = parseInt(hour, 10) % 12;
  if (meridiem.toLowerCase() === "pm") h += 12;
  return new Date(y, parseInt(month, 10) - 1, parseInt(day, 10), h, parseInt(minute, 10));
}

function dayLabel(dt) {
  const day = String(dt.getDate()).padStart(2, "0");
  const month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dt.getMonth()];
  return `${day} ${month} ${dt.getFullYear()}`;
}

function isoDate(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse WhatsApp chat text into structured messages.
 * Port of parse_chat() (line 252-271 of analyze_chat.py).
 */
export function parseChat(chatText) {
  const messages = [];
  let current = null;
  const lines = chatText.split(/\r?\n/);

  for (const raw of lines) {
    const match = LINE_RE.exec(raw);
    if (match) {
      if (current) messages.push(current);
      const dt = parseTimestamp(match[1], match[2], match[3], match[4], match[5], match[6]);
      const body = match[7];
      const colonIdx = body.indexOf(": ");
      if (colonIdx > -1) {
        const sender = body.substring(0, colonIdx).trim();
        const text = body.substring(colonIdx + 2).trim();
        current = { timestamp: dt, sender, text };
      } else {
        current = null;
      }
    } else if (current) {
      current.text = (current.text + "\n" + raw.trim()).trim();
    }
  }
  if (current) messages.push(current);
  return messages;
}

/**
 * Run full analysis. Port of analyze() (line 332-714).
 * Returns a draft object the UI uses to render reviewable moments.
 */
export function analyze(messages) {
  if (!messages || messages.length === 0) {
    throw new Error("No messages parsed. Is this a WhatsApp .txt export?");
  }

  const participants = [...new Set(messages.map(m => m.sender))].sort();
  const start = messages[0].timestamp;
  const end = messages[messages.length - 1].timestamp;
  const activeDates = new Set(messages.map(m => isoDate(m.timestamp)));
  const daysSpan = Math.max(Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1, 1);

  const bySender = {};
  for (const sender of participants) {
    bySender[sender] = { messages: 0, words: 0, media: 0, questions: 0, avgWords: 0 };
  }

  const hourly = new Map();
  const weekday = new Map();
  const monthly = new Map();
  const yearly = new Map();
  const emojiCounter = new Map();
  const wordCounter = new Map();
  let totalWords = 0;
  let mediaCount = 0;

  for (const m of messages) {
    const dt = m.timestamp;
    const sender = m.sender;
    const text = m.text;
    const lower = text.toLowerCase();
    const textForWords = text.replace(/https?:\/\/\S+|www\.\S+/g, " ").replace("<Media omitted>", " ");
    const tokens = words(textForWords);
    const cleanTokens = tokens.filter(w => !STOPWORDS.has(w) && !PRIVATE_WORDS.has(w) && w.length > 2);

    totalWords += tokens.length;
    hourly.set(dt.getHours(), (hourly.get(dt.getHours()) || 0) + 1);
    // JavaScript weekday: 0=Sun. We want 0=Mon. Convert.
    const wd = (dt.getDay() + 6) % 7;
    weekday.set(wd, (weekday.get(wd) || 0) + 1);
    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    monthly.set(ym, (monthly.get(ym) || 0) + 1);
    yearly.set(dt.getFullYear(), (yearly.get(dt.getFullYear()) || 0) + 1);

    for (const t of cleanTokens) wordCounter.set(t, (wordCounter.get(t) || 0) + 1);
    for (const e of emojiChars(text)) emojiCounter.set(e, (emojiCounter.get(e) || 0) + 1);

    bySender[sender].messages += 1;
    bySender[sender].words += tokens.length;
    bySender[sender].questions += (text.match(/\?/g) || []).length;
    if (text.includes("<Media omitted>")) {
      mediaCount += 1;
      bySender[sender].media += 1;
    }
  }

  // Average words per sender
  for (const sender of participants) {
    const r = bySender[sender];
    if (r.messages > 0) r.avgWords = +(r.words / r.messages).toFixed(1);
  }

  // Top quotes — pick longest non-media messages per sender, plus high-emotion lines
  const candidateMessages = messages.filter(m => !m.text.includes("<Media omitted>") && m.text.length > 20 && m.text.length < 180);

  // Score each candidate: prefer affection words, length, has-emoji
  const affectionWords = new Set(["love","miss","cute","baby","babe","jaan","sweet","hug","kiss","wife","husband"]);
  function scoreMessage(m) {
    const lower = m.text.toLowerCase();
    const tokens = words(lower);
    let score = Math.min(m.text.length / 50, 2);
    for (const t of tokens) if (affectionWords.has(t)) score += 1.5;
    if (emojiChars(m.text).length > 0) score += 0.5;
    return score;
  }

  // Pick top 40 highest scoring messages, deduplicated by very-similar content
  const scored = candidateMessages.map(m => ({ msg: m, score: scoreMessage(m) }));
  scored.sort((a, b) => b.score - a.score);
  const topQuotes = [];
  const seenPrefixes = new Set();
  for (const { msg } of scored) {
    const prefix = msg.text.substring(0, 20).toLowerCase();
    if (seenPrefixes.has(prefix)) continue;
    seenPrefixes.add(prefix);
    const safe = snippet(msg, 160);
    topQuotes.push({
      id: `m${topQuotes.length + 1}`,
      kind: "quote",
      sender: msg.sender,
      date: isoDate(msg.timestamp),
      text: safe.text,
      redacted: safe.redacted,
      sensitive: isSensitive(msg.text),
    });
    if (topQuotes.length >= 40) break;
  }

  // Milestones — first match per pattern
  const milestones = [];
  const seenTitles = new Set();
  for (const m of messages) {
    const lower = m.text.toLowerCase();
    for (const spec of MILESTONE_PATTERNS) {
      if (seenTitles.has(spec.title)) continue;
      for (const pattern of spec.patterns) {
        if (pattern.test(lower)) {
          const safe = snippet(m, 120);
          milestones.push({
            id: `ms${milestones.length + 1}`,
            kind: "milestone",
            title: spec.title,
            date: isoDate(m.timestamp),
            sender: m.sender,
            sample: safe.text,
            redacted: safe.redacted,
            sensitive: isSensitive(m.text),
          });
          seenTitles.add(spec.title);
          break;
        }
      }
    }
  }

  // Motifs — recurring themes
  const motifs = [];
  for (const spec of MOTIF_SPECS) {
    const matches = messages.filter(m => spec.pattern.test(m.text));
    if (matches.length > 0) {
      const first = matches[0];
      const safe = snippet(first, 120);
      motifs.push({
        id: `mo${motifs.length + 1}`,
        kind: "motif",
        label: spec.label,
        count: matches.length,
        firstDate: isoDate(first.timestamp),
        firstSender: first.sender,
        sample: safe.text,
        redacted: safe.redacted,
        sensitive: isSensitive(first.text),
      });
    }
  }

  // Top emojis
  const topEmojis = [...emojiCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([emoji, count]) => ({ emoji, count }));

  // Peak hour & weekday
  let peakHour = 0, peakHourCount = 0;
  for (const [h, c] of hourly.entries()) if (c > peakHourCount) { peakHour = h; peakHourCount = c; }
  let peakWeekdayIdx = 0, peakWeekdayCount = 0;
  for (const [w, c] of weekday.entries()) if (c > peakWeekdayCount) { peakWeekdayIdx = w; peakWeekdayCount = c; }

  // Longest active streak
  const sortedDates = [...activeDates].sort();
  let bestStreak = 1, currentStreak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diff === 1) currentStreak++;
    else {
      if (currentStreak > bestStreak) bestStreak = currentStreak;
      currentStreak = 1;
    }
  }
  if (currentStreak > bestStreak) bestStreak = currentStreak;

  return {
    analyzerVersion: ANALYZER_VERSION,
    participants,
    dateRange: { from: isoDate(start), to: isoDate(end) },
    stats: {
      totalMessages: messages.length,
      totalDaysActive: activeDates.size,
      daysSpan,
      longestStreakDays: bestStreak,
      peakHour: `${String(peakHour).padStart(2, "0")}:00`,
      peakWeekday: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][peakWeekdayIdx],
      mediaCount,
      totalWords,
      perSender: bySender,
    },
    quotes: topQuotes,
    milestones,
    motifs,
    topEmojis,
  };
}

/**
 * Build the final downloadable manifest from the analysis + user approvals.
 */
export function buildManifest(analysis, approvals, userInputs) {
  const now = new Date();
  const moments = analysis.quotes
    .filter(q => approvals.quotes[q.id])
    .map(q => ({
      id: q.id,
      kind: "quote",
      approved: true,
      redacted: q.redacted,
      text: q.text,
      sender: q.sender,
      date: q.date,
    }));

  const milestones = analysis.milestones
    .filter(m => approvals.milestones[m.id])
    .map(m => ({
      id: m.id,
      approved: true,
      title: m.title,
      date: m.date,
      sender: m.sender,
      sample: m.sample,
      redacted: m.redacted,
    }));

  const motifs = analysis.motifs
    .filter(m => approvals.motifs[m.id])
    .map(m => ({
      id: m.id,
      approved: true,
      label: m.label,
      count: m.count,
      firstDate: m.firstDate,
      sample: m.sample,
    }));

  const topEmojis = analysis.topEmojis
    .filter(e => approvals.emojis[e.emoji])
    .map(e => ({ emoji: e.emoji, count: e.count, approved: true }));

  return {
    schema: "memorywrapped-manifest@1",
    generatedAt: now.toISOString(),
    client: {
      analyzerVersion: ANALYZER_VERSION,
      userAgent: userInputs.includeUserAgent ? navigator.userAgent : undefined,
    },
    title: userInputs.title || analysis.participants.join(" & "),
    subtitle: userInputs.subtitle || "",
    occasion: userInputs.occasion || "other",
    tone: userInputs.tone || "balanced",
    theme: userInputs.theme || "rose_gold",
    tier: userInputs.tier || "wrapped",
    participants: analysis.participants,
    dateRange: analysis.dateRange,
    stats: analysis.stats,
    moments,
    milestones,
    motifs,
    topEmojis,
    userNotes: userInputs.notes || "",
  };
}
