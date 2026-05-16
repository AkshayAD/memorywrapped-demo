// =============================================================================
// SECTION 1: INLINED ANALYZER (redaction.js + analyzer.js, no import/export)
// =============================================================================

const PRIVATE_WORDS = new Set([
  "account","address","bank","card","credential","credentials","email","gmail",
  "login","mail","mobile","otp","pass","password","phone","pin","upi",
]);

const STOPWORDS = new Set([
  "a","about","after","all","am","an","and","are","as","at",
  "be","but","by",
  "can",
  "did","do",
  "for","from",
  "get","go","going","got",
  "had","has","have","he","her","here","him","his",
  "i","if","in","is","it","its",
  "just",
  "me","my",
  "no","not",
  "of","ok","omitted","on","or",
  "so",
  "that","the","then","there","this","to","too",
  "u",
  "was","we","what","when","where","will","with",
  "you","your",
  "com","edited","http","https","www",
  "aaj","ab","aur","hai","hain","ho","hu",
  "ka","ke","ki","ko","kya",
  "main","media","mera","message",
  "nahi","se",
]);

const HINGLISH_MARKERS = new Set([
  "aaj","abhi","acha","accha","aur",
  "bahut","bas","bata","batana","bhai","bhi",
  "chal","chalo",
  "de","diya",
  "gaya","ghar",
  "haan","hai","hain","ho","hu",
  "kal","kar","karo","kr","kya","kyu","kyun",
  "mat","mera",
  "nahi","nhi",
  "raha","rhe",
  "theek","tum",
  "yaar",
]);

function words(text) {
  const matches = text.toLowerCase().match(/[a-zA-Z][a-zA-Z']+/g);
  return matches || [];
}

function emojiChars(text) {
  const re = /[\u{1f300}-\u{1f6ff}\u{1f700}-\u{1f77f}\u{1f780}-\u{1f7ff}\u{1f800}-\u{1f8ff}\u{1f900}-\u{1f9ff}\u{1fa00}-\u{1faff}\u{2600}-\u{27bf}]/gu;
  return text.match(re) || [];
}

function snippet(message, limit) {
  limit = limit || 128;
  let text = message.text.replace(/\s+/g, " ").trim();
  text = text.replace("<Media omitted>", "A shared media memory");
  const lowered = new Set(words(text));
  for (const w of lowered) {
    if (PRIVATE_WORDS.has(w)) return { text: "Private detail redacted", redacted: true };
  }
  let redacted = false;
  const urlPattern = /https?:\/\/\S+|www\.\S+/g;
  if (urlPattern.test(text)) { text = text.replace(/https?:\/\/\S+|www\.\S+/g, "[link]"); redacted = true; }
  const emailPattern = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
  if (emailPattern.test(text)) { text = text.replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, "[email]"); redacted = true; }
  const phonePattern = /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;
  if (phonePattern.test(text)) { text = text.replace(/\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, "[phone]"); redacted = true; }
  const longNumPattern = /\b\d{4,}\b/g;
  if (longNumPattern.test(text)) { text = text.replace(/\b\d{4,}\b/g, "[number]"); redacted = true; }
  if (!text.trim()) return { text: "Tiny reaction", redacted };
  if (text.length <= limit) return { text, redacted };
  return { text: text.substring(0, limit - 1).trimEnd() + "...", redacted };
}

function isSensitive(text) {
  const tokens = new Set(words(text));
  for (const w of tokens) { if (PRIVATE_WORDS.has(w)) return true; }
  if (/https?:\/\/\S+|www\.\S+/.test(text)) return true;
  if (/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/.test(text)) return true;
  if (/\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/.test(text)) return true;
  if (/\b\d{4,}\b/.test(text)) return true;
  return false;
}

const ANALYZER_VERSION = "1.0.0";

const LINE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})[\s ]*([ap]m|AM|PM)\s+-\s+(.*)$/i;

const MILESTONE_PATTERNS = [
  { title: "First chat spark", patterns: [/\bhello\b/i, /\byo\b/i] },
  { title: "First food memory", patterns: [/\bnoodles?\b/i, /\bbiryani\b/i, /\bdinner\b/i, /\blunch\b/i] },
  { title: "First plan together", patterns: [/\bcome\b/i, /\bmeet\b/i, /\bplans?\b/i, /\bgo out\b/i] },
  { title: "First missing-you note", patterns: [/\bmiss(?:ing)?\b/i] },
  { title: "First love note", patterns: [/\bi love (?:you|u)\b/i, /\blove (?:you|u)\b/i, /\biloveyou\b/i] },
  { title: "Wedding language appears", patterns: [/\bshaadi\b/i, /\bwedding\b/i, /\bmarriage\b/i, /\bmarried\b/i] },
  { title: "Wife/husband era", patterns: [/\bwife\b/i, /\bhusband\b/i, /\bbiwi\b/i, /\bpati\b/i] },
];

const MOTIF_SPECS = [
  { label: "Good mornings", pattern: /\bgood morning\b/i },
  { label: "Good nights", pattern: /\bgood night\b/i },
  { label: "Love notes", pattern: /\bi love (?:you|u)\b|\blove (?:you|u)\b|\biloveyou\b/i },
  { label: "Missing each other", pattern: /\bmiss(?:ing)?\b/i },
  { label: "Sorry and repair", pattern: /\bsorry\b|\bforgive\b|\bmistake\b/i },
  { label: "Food thread", pattern: /\bfood\b|\bbiryani\b|\bnoodles?\b|\blunch\b|\bdinner\b|\bbreakfast\b/i },
  { label: "Plans and meeting", pattern: /\bmeet\b|\bcome\b|\bplans?\b|\bmovie\b|\bdrive\b|\bgo out\b/i },
];

const WEEKDAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function parseTimestamp(day, month, year, hour, minute, meridiem) {
  let y = parseInt(year, 10);
  if (y < 100) y += 2000;
  let h = parseInt(hour, 10) % 12;
  if (meridiem.toLowerCase() === "pm") h += 12;
  return new Date(y, parseInt(month, 10) - 1, parseInt(day, 10), h, parseInt(minute, 10));
}

function isoDate(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseChat(chatText) {
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

function analyze(messages) {
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

  // Extended fields
  const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const emojiBySenderMap = {};

  for (const m of messages) {
    const dt = m.timestamp;
    const sender = m.sender;
    const text = m.text;
    const textForWords = text.replace(/https?:\/\/\S+|www\.\S+/g, " ").replace("<Media omitted>", " ");
    const tokens = words(textForWords);
    const cleanTokens = tokens.filter(w => !STOPWORDS.has(w) && !PRIVATE_WORDS.has(w) && w.length > 2);

    totalWords += tokens.length;
    hourly.set(dt.getHours(), (hourly.get(dt.getHours()) || 0) + 1);
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

    // heatmap 7x24
    heatmap[wd][dt.getHours()]++;
    // emojis per sender
    if (!emojiBySenderMap[sender]) emojiBySenderMap[sender] = new Map();
    for (const e of emojiChars(text)) emojiBySenderMap[sender].set(e, (emojiBySenderMap[sender].get(e) || 0) + 1);
  }

  // Average words per sender
  for (const sender of participants) {
    const r = bySender[sender];
    if (r.messages > 0) r.avgWords = +(r.words / r.messages).toFixed(1);
  }

  // Top quotes
  const candidateMessages = messages.filter(m => !m.text.includes("<Media omitted>") && m.text.length > 20 && m.text.length < 180);
  const affectionWords = new Set(["love","miss","cute","baby","babe","jaan","sweet","hug","kiss","wife","husband"]);
  function scoreMessage(m) {
    const lower = m.text.toLowerCase();
    const tokens = words(lower);
    let score = Math.min(m.text.length / 50, 2);
    for (const t of tokens) if (affectionWords.has(t)) score += 1.5;
    if (emojiChars(m.text).length > 0) score += 0.5;
    return score;
  }
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

  // Milestones
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

  // Motifs
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
    else { if (currentStreak > bestStreak) bestStreak = currentStreak; currentStreak = 1; }
  }
  if (currentStreak > bestStreak) bestStreak = currentStreak;

  // --- Second pass for extended fields ---
  let prevM = null, qGapDays = 0, qGapDate = null;
  const convStart = {}, repSum = {}, repCnt = {};
  for (const m of messages) {
    if (prevM) {
      const ms = m.timestamp - prevM.timestamp, min = ms / 60000, d = ms / 86400000;
      if (d > qGapDays) { qGapDays = d; qGapDate = isoDate(prevM.timestamp); }
      if (min >= 60) convStart[m.sender] = (convStart[m.sender] || 0) + 1;
      if (m.sender !== prevM.sender && min < 1440) {
        repSum[m.sender] = (repSum[m.sender] || 0) + min;
        repCnt[m.sender] = (repCnt[m.sender] || 0) + 1;
      }
    }
    prevM = m;
  }
  const replyTimes = {};
  for (const s of participants) replyTimes[s] = repCnt[s] ? Math.round(repSum[s] / repCnt[s]) : null;

  // bigrams
  const phraseMap = new Map();
  for (const m of messages) {
    if (m.text.includes('<Media omitted>')) continue;
    const toks = words(m.text).filter(w => !STOPWORDS.has(w) && !PRIVATE_WORDS.has(w) && w.length > 2);
    for (let i = 0; i < toks.length - 1; i++) {
      const b = toks[i] + ' ' + toks[i + 1];
      phraseMap.set(b, (phraseMap.get(b) || 0) + 1);
    }
  }
  const topPhrases = [...phraseMap.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([phrase, count]) => ({ phrase, count }));
  const topWords = [...wordCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count }));

  // dayParts
  const dayParts = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const [h, c] of hourly.entries()) {
    if (h >= 6 && h < 12) dayParts.morning += c;
    else if (h >= 12 && h < 18) dayParts.afternoon += c;
    else if (h >= 18 && h < 22) dayParts.evening += c;
    else dayParts.night += c;
  }

  // yearChapters
  const yearChapters = [...yearly.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count }));

  // emojiBySender
  const emojiBySender = {};
  for (const s of participants) {
    emojiBySender[s] = [...(emojiBySenderMap[s] || new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([emoji, count]) => ({ emoji, count }));
  }

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
    dayParts,
    heatmap,
    yearChapters,
    replyTimes,
    conversationStarters: convStart,
    emojiBySender,
    quietGap: { days: Math.round(qGapDays), date: qGapDate },
    topPhrases,
    topWords,
  };
}

function runFullAnalyzer(text) {
  try {
    const msgs = parseChat(text);
    if (!msgs || msgs.length < 20) return null;
    return analyze(msgs);
  } catch (e) { console.warn('Analyzer error:', e); return null; }
}

// =============================================================================
// SECTION 2: STATE + CONSTANTS
// =============================================================================

let currentStep = 1, selectedPkg = 'wrapped', utrVal = '', emailVal = '';
let analysis = null, freeAnalysis = null;
let photoURL = null, photoCrop = { x: 50, y: 30 };
let generatedBlobs = [], freeBlobs = [];
let igOptIn = true;
let teaserBlobs = [];

const PKG_PRICES = { wrapped: 399, site: 1999 };
const PKG_LABELS = { wrapped: 'Wrapped — ₹399', site: 'Wrapped + Site — ₹1,999' };
const PKG_CARDS = { wrapped: 9, site: 9 };
const CARD_NAMES = ['Cover','First_Message','Numbers','Rituals','Language','Rhythm','Voices','Photo','Journey'];
const GAS = 'https://script.google.com/macros/s/AKfycbzgf441hfSv6XZr45Y25meqvCLrkrOkZBGJ79nLwRksV2dGnivYA0drMvKSvFHvOcV2/exec';

// =============================================================================
// SECTION 3: UTILS
// =============================================================================

const $ = id => document.getElementById(id);
const v = id => { const el = $(id); return el ? el.value.trim() : ''; };
function readText(f) { return new Promise((r, j) => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.onerror = j; rd.readAsText(f, 'utf-8'); }); }
function canvasBlob(c, t, q) { return new Promise(r => c.toBlob(r, t, q)); }
function fmtNum(n) { return (n && n > 0) ? n.toLocaleString('en-IN') : ''; }
function fmtK(n) { if (!n || n <= 0) return ''; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1000) return Math.round(n / 1000) + 'K'; return String(n); }
function fmtDate(iso) { try { if (!iso) return ''; const d = new Date(iso); return d.toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' }); } catch (e) { return iso || ''; } }
function fmtMon(iso) { try { if (!iso) return ''; const d = new Date(iso); return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); } catch (e) { return iso || ''; } }
function fmtHr(hh) { if (!hh) return ''; const h = parseInt(hh); if (h === 0) return '12 am'; if (h < 12) return h + ' am'; if (h === 12) return '12 pm'; return (h - 12) + ' pm'; }
function diffYM(a, b) {
  try {
    const d1 = new Date(a), d2 = new Date(b);
    const y = d2.getFullYear() - d1.getFullYear() - ((d2.getMonth() < d1.getMonth() || (d2.getMonth() === d1.getMonth() && d2.getDate() < d1.getDate())) ? 1 : 0);
    if (y >= 1) return y + ' Year' + (y > 1 ? 's' : '');
    const mo = (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth();
    return mo + ' Month' + (mo !== 1 ? 's' : '');
  } catch (e) { return ''; }
}
function fmtReplyTime(min) { if (!min || min > 1440) return null; if (min < 1) return 'instantly'; if (min < 60) return Math.round(min) + ' min'; return Math.round(min / 60) + ' hr'; }
function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// =============================================================================
// SECTION 4: VARIABLE BUILDER
// =============================================================================

function buildVars(src, form) {
  const n1 = form.n1 || 'Person 1', n2 = form.n2 || 'Person 2';
  const rel = form.rel || 'Together', loc = form.loc || '', dat = form.dat || '', nick = form.nick || n2;
  const dr = src.dateRange, st = src.stats;
  const occ = diffYM(dr.from, dr.to);
  const parts = src.participants || [];
  const p1name = parts[0] || n1, p2name = parts[1] || n2;

  const ps = st.perSender || {};
  const p1s = ps[p1name] || ps[parts[0]] || { messages: 0 };
  const p2s = ps[p2name] || ps[parts[1]] || { messages: 0 };
  const total = st.totalMessages || 1;
  const p1pct = Math.round((p1s.messages || 0) / total * 100);
  const p2pct = 100 - p1pct;

  const motifs = (src.motifs || []).filter(m => m.count > 0).slice(0, 5).map(m => ({ label: m.label, count: fmtNum(m.count) }));

  const ms0 = src.milestones && src.milestones[0];
  const firstDate = ms0 ? ms0.date : dr.from;
  const firstText = ms0 ? (ms0.sample || '') : '';

  const te = (src.topEmojis || [])[0] || { emoji: '❤️', count: 0 };

  const phrases = (src.topPhrases || []).slice(0, 5).map(p => esc(p.phrase) + ' ×' + p.count);

  const topWords = (src.topWords || []).slice(0, 5).map(w => w.word);

  const ebo = src.emojiBySender || {};
  const emo1 = (ebo[p1name] || ebo[parts[0]] || [])[0];
  const emo2 = (ebo[p2name] || ebo[parts[1]] || [])[0];

  const rt = src.replyTimes || {};
  const rep1 = fmtReplyTime(rt[p1name] || rt[parts[0]]);
  const rep2 = fmtReplyTime(rt[p2name] || rt[parts[1]]);

  const cs = src.conversationStarters || {};
  const cs1 = cs[p1name] || cs[parts[0]] || 0;
  const cs2 = cs[p2name] || cs[parts[1]] || 0;
  const csTotal = cs1 + cs2 || 1;
  const cs1pct = Math.round(cs1 / csTotal * 100);

  const qg = src.quietGap || {};
  const quietDays = qg.days >= 3 ? qg.days + ' days' : null;

  const yearChapters = (src.yearChapters || []).filter(y => y.count > 0);

  const pcap = (loc && dat) ? loc + ' · ' + dat : (loc || dat || fmtMon(dr.to));
  const relStart = rel.includes('→') ? rel.split('→')[0].trim() : rel;
  const relEnd = rel.includes('→') ? rel.split('→').pop().trim() : rel;

  const loveM = (src.motifs || []).find(m => m.label.toLowerCase().includes('love'));
  const gmM = (src.motifs || []).find(m => m.label.toLowerCase().includes('morning'));
  const loveCount = loveM && loveM.count > 0 ? fmtNum(loveM.count) : '';
  const gmCount = gmM && gmM.count > 0 ? fmtNum(gmM.count) : '';

  return {
    P1: n1, P2: n2, NAMES: n1 + ' & ' + n2,
    DR: fmtMon(dr.from) + ' → ' + fmtMon(dr.to),
    OCC: occ, REL: rel, RS: relStart, RE: relEnd,
    MC: fmtNum(st.totalMessages), WC: fmtK(st.totalWords),
    MED: fmtNum(st.mediaCount),
    TE: te.emoji, TEC: fmtNum(te.count),
    P1_NAME: n1, P2_NAME: n2,
    P1_PCT: p1pct, P2_PCT: p2pct,
    MOTIFS: motifs,
    HEATMAP: src.heatmap,
    DAY_PARTS: src.dayParts,
    YEAR_CHAPTERS: yearChapters,
    REPLY_P1: rep1, REPLY_P2: rep2,
    REP1_NAME: n1, REP2_NAME: n2,
    CS_P1_PCT: cs1pct, CS_P2_PCT: 100 - cs1pct,
    CS_P1_NAME: n1,
    QUIET_DAYS: quietDays,
    QUIET_DATE: fmtMon(qg.date),
    PHRASES: phrases,
    TOP_WORDS: topWords,
    EMO_P1: emo1 ? emo1.emoji : '', EMO_P2: emo2 ? emo2.emoji : '',
    EMO_P1_COUNT: emo1 ? fmtNum(emo1.count) : '', EMO_P2_COUNT: emo2 ? fmtNum(emo2.count) : '',
    FD: fmtDate(firstDate), FT: esc(firstText) || 'The first word.',
    PHOTO: photoURL || '', PHOTO_X: photoCrop.x, PHOTO_Y: photoCrop.y,
    PCAP: pcap, LOC: loc, PDATE: dat || fmtMon(dr.to),
    NICK: nick,
    PH: fmtHr(st.peakHour || '22:00'),
    PW: st.peakWeekday || '',
    STR: fmtNum(st.longestStreakDays),
    LOVE_COUNT: loveCount, GM_COUNT: gmCount,
    MEDIA_COUNT: fmtNum(st.mediaCount),
  };
}

// =============================================================================
// SECTION 5: SVG HELPERS
// =============================================================================

function svgHeatmap(heatmap) {
  if (!heatmap) return '';
  const flat = heatmap.flat();
  const maxVal = Math.max(...flat.filter(v => v > 0), 1);
  const cw = 36, ch = 28, g = 2;
  const W = 24 * (cw + g) - g, H = 7 * (ch + g) - g;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">`;
  for (let r = 0; r < 7; r++) for (let c = 0; c < 24; c++) {
    const vv = heatmap[r][c];
    const op = vv === 0 ? 0.06 : Math.max(0.12, Math.min(0.9, vv / maxVal * 0.9));
    s += `<rect x="${c * (cw + g)}" y="${r * (ch + g)}" width="${cw}" height="${ch}" rx="3" fill="#c9a96e" opacity="${op.toFixed(2)}"/>`;
  }
  return s + '</svg>';
}

function svgDayParts(dp) {
  if (!dp) return '';
  const tot = Math.max(Object.values(dp).reduce((a, b) => a + b, 0), 1);
  return [
    { label: 'Morning', key: 'morning', col: '#c9a96e' },
    { label: 'Afternoon', key: 'afternoon', col: 'rgba(240,236,228,.6)' },
    { label: 'Evening', key: 'evening', col: '#e8b4b8' },
    { label: 'Night', key: 'night', col: 'rgba(153,136,204,.75)' },
  ].map(({ label, key, col }) => {
    const p = Math.round(dp[key] / tot * 100) || 0;
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px"><div style="width:70px;font-size:13px;color:rgba(240,236,228,.5);font-family:Arial,sans-serif;font-style:italic">${label}</div><div style="flex:1;height:6px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden"><div style="width:${p}%;height:100%;background:${col};border-radius:3px"></div></div><div style="width:32px;text-align:right;font-size:12px;color:rgba(240,236,228,.38);font-family:Arial,sans-serif">${p}%</div></div>`;
  }).join('');
}

// =============================================================================
// SECTION 6: CARD STAGE FILLERS
// =============================================================================

const G = '<div class="glw"></div>';
const F = '<div class="bft">✧ MemoryWrapped · Your chats, as a keepsake</div>';
const WM = '<div class="bft" style="color:rgba(201,169,110,.55);letter-spacing:.25em">memorywrapped.in — free preview</div>';
const C = '<div class="cor ctl"></div><div class="cor ctr"></div><div class="cor cbl"></div><div class="cor cbr"></div>';

function fillCardStage(V) {
  // cs1 — Cover
  $('cs1').innerHTML = G + C + `
    <div class="s1-eb">✧ A love story in messages</div>
    <div class="s1-nm">${V.P1}<span class="s1-am">&amp;</span>${V.P2}</div>
    <div class="s1-rl"><div class="ln"></div><span style="color:#c9a96e;font-size:18px">✦</span><div class="ln"></div></div>
    <div class="s1-dt">${V.DR}</div>
    ${V.REL ? `<div class="s1-tg">${V.REL}</div>` : ''}
    <div class="s1-ct">${V.MC ? `<strong>${V.MC}</strong> messages and counting` : ''}</div>
    ${V.TE ? `<div class="s1-em">${V.TE}${V.TEC ? ' <span style="font-size:14px;opacity:.6">×' + V.TEC + '</span>' : ''}</div>` : ''}
  ` + F;

  // cs2 — First Message
  $('cs2').innerHTML = G + `
    <div class="eyb">How it started</div>
    <div class="s2-dt">${V.FD}${V.FD ? ' &nbsp;·&nbsp; Message #1' : ''}</div>
    <div class="s2-ml">First message ever sent</div>
    <div class="s2-bb"><div class="s2-bt">"${V.FT}"</div></div>
    <div class="s2-sb">That was all it took.</div>
    <div class="s2-ar">→</div>
  ` + F;

  // cs3 — Numbers
  const numCells = [
    V.WC ? `<div class="s3-cell"><div class="s3-val">${V.WC}</div><div class="s3-lbl">Words written</div></div>` : '',
    V.TE ? `<div class="s3-cell"><div class="s3-val">${V.TE}${V.TEC ? '<span style="font-size:14px;margin-left:4px;opacity:.65">×' + V.TEC + '</span>' : ''}</div><div class="s3-lbl">Most used emoji</div></div>` : '',
    V.MED ? `<div class="s3-cell"><div class="s3-val">${V.MED}</div><div class="s3-lbl">Photos &amp; videos</div></div>` : '',
    V.LOVE_COUNT ? `<div class="s3-cell"><div class="s3-val">${V.LOVE_COUNT}</div><div class="s3-lbl">Love notes</div></div>` : '',
  ].filter(Boolean).slice(0, 4).join('');
  $('cs3').innerHTML = G + `
    <div class="eyb">By the numbers</div>
    <div class="s3-hero">${V.MC}</div>
    <div class="s3-hl">messages sent</div>
    <div class="s3-grid">${numCells}</div>
    ${(V.P1_PCT > 0 && V.P1_PCT < 100) ? `<div class="s3-split">${V.P1}: ${V.P1_PCT}% &nbsp;·&nbsp; ${V.P2}: ${V.P2_PCT}%</div>` : ''}
  ` + F;

  // cs4 — Rituals
  let ritualRows = '';
  if (V.MOTIFS && V.MOTIFS.length > 0) {
    ritualRows = V.MOTIFS.map(m => `<div class="s4-rw"><div class="r-lb">${m.label}</div><div class="r-vl">${m.count}</div></div>`).join('');
  } else {
    if (V.GM_COUNT) ritualRows += `<div class="s4-rw"><div class="r-lb">Good mornings</div><div class="r-vl">${V.GM_COUNT}</div></div>`;
    if (V.LOVE_COUNT) ritualRows += `<div class="s4-rw"><div class="r-lb">Love notes</div><div class="r-vl">${V.LOVE_COUNT}</div></div>`;
  }
  $('cs4').innerHTML = G + `
    <div class="eyb">Rituals</div>
    <div class="s4-hd">Some things never missed.</div>
    <div class="s4-list">${ritualRows}</div>
    <div class="s4-ft">Every single time.</div>
  ` + F;

  // cs5 — Language
  const phraseList = V.PHRASES.length > 0
    ? V.PHRASES.slice(0, 4).map((p, i) => `<div class="s5-ph"><span class="s5-ph-rank">${i + 1}</span><span class="s5-ph-text">${p}</span></div>`).join('')
    : V.TOP_WORDS.slice(0, 5).map(w => `<div class="s5-ph"><span class="s5-ph-text">${w}</span></div>`).join('');
  const emoLine = (V.EMO_P1 && V.EMO_P2) ? `<div class="s5-emo">${V.P1_NAME}: ${V.EMO_P1}${V.EMO_P1_COUNT ? ' ×' + V.EMO_P1_COUNT : ''} &nbsp;·&nbsp; ${V.P2_NAME}: ${V.EMO_P2}${V.EMO_P2_COUNT ? ' ×' + V.EMO_P2_COUNT : ''}</div>` : '';
  $('cs5').innerHTML = G + `
    <div class="eyb">Language</div>
    <div class="s5-hd">The words you made yours.</div>
    <div class="s5-list">${phraseList}</div>
    ${emoLine}
  ` + F;

  // cs6 — Rhythm
  const hmSvg = svgHeatmap(V.HEATMAP);
  const dpBars = svgDayParts(V.DAY_PARTS);
  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<span>${d}</span>`).join('');
  const peakCallout = (V.PW && V.PH) ? `<div class="s6-pk">Most active: ${V.PW} at ${V.PH}</div>` : '';
  $('cs6').innerHTML = G + `
    <div class="eyb">Rhythm</div>
    <div class="s6-hd">Your chat has a heartbeat.</div>
    <div class="s6-hm">${hmSvg}</div>
    <div class="s6-dl">${dayLabels}</div>
    <div class="s6-dp">${dpBars}</div>
    ${peakCallout}
  ` + F;

  // cs7 — Voices
  const voiceRows = [];
  if (V.REPLY_P1) voiceRows.push(`<div class="s7-rw"><span class="s7-nm">${V.REP1_NAME}</span> replies in <span class="s7-vl">${V.REPLY_P1}</span> on average</div>`);
  if (V.REPLY_P2) voiceRows.push(`<div class="s7-rw"><span class="s7-nm">${V.REP2_NAME}</span> replies in <span class="s7-vl">${V.REPLY_P2}</span> on average</div>`);
  if (V.CS_P1_PCT > 0) voiceRows.push(`<div class="s7-rw"><span class="s7-nm">${V.CS_P1_NAME}</span> starts <span class="s7-vl">${V.CS_P1_PCT}%</span> of conversations</div>`);
  if (V.QUIET_DAYS) voiceRows.push(`<div class="s7-rw">Longest silence: <span class="s7-vl">${V.QUIET_DAYS}</span>${V.QUIET_DATE ? ' <span style="opacity:.5;font-size:13px">('+V.QUIET_DATE+')</span>' : ''}</div>`);
  let voiceContent = voiceRows.join('');
  if (!voiceContent && analysis && analysis.quotes && analysis.quotes.length > 0) {
    const q = analysis.quotes[0];
    voiceContent = `<div class="s7-qt">"${esc(q.text)}"<div class="s7-qt-by">— ${esc(q.sender)}</div></div>`;
  }
  $('cs7').innerHTML = G + `
    <div class="eyb">Voices</div>
    <div class="s7-hd">Who keeps the conversation going?</div>
    <div class="s7-list">${voiceContent}</div>
  ` + F;

  // cs8 — Photo
  if (V.PHOTO) {
    $('cs8').innerHTML = `
      <div class="s8-bg" style="background:#07070d;position:absolute;inset:0"></div>
      <img class="s8-img" src="${V.PHOTO}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${V.PHOTO_X}% ${V.PHOTO_Y}%">
      <div class="s8-ov" style="position:absolute;inset:0;background:linear-gradient(to top,rgba(7,7,13,.85) 0%,rgba(7,7,13,.3) 50%,rgba(7,7,13,.1) 100%)"></div>
      <div class="s8-bot">
        ${V.REL ? `<div class="s8-rel">${V.REL}</div>` : ''}
        <div class="s8-nm">${V.NAMES}</div>
        <div class="s8-cap">${V.PCAP}</div>
      </div>
    ` + F;
  } else {
    $('cs8').innerHTML = G + `
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,#1a0820,#07070d 40%,#0a1a15)"></div>
      <div class="s8-deco">✦</div>
      <div class="s8-bot">
        ${V.REL ? `<div class="s8-rel">${V.REL}</div>` : ''}
        <div class="s8-nm">${V.NAMES}</div>
        <div class="s8-cap">${V.PCAP}</div>
      </div>
    ` + F;
  }

  // cs9 — Journey
  const chapItems = V.YEAR_CHAPTERS.map((c, i) => `
    <div class="tl-it">
      <div class="tl-dc"><div class="tl-d${i === 0 ? ' f' : i === V.YEAR_CHAPTERS.length - 1 ? ' r' : ''}"></div>${i < V.YEAR_CHAPTERS.length - 1 ? '<div class="tl-ln"></div>' : ''}</div>
      <div><div class="tl-yr">${c.year}</div><div class="tl-cnt">${fmtNum(c.count)} messages</div></div>
    </div>
  `).join('');
  $('cs9').innerHTML = G + `
    <div class="eyb">Journey</div>
    <div class="s9-hd">Every chapter.</div>
    <div class="s9-tl">${chapItems}</div>
    <div class="s9-cl">${V.OCC ? V.OCC + '. ' : ''}${V.MC ? V.MC + ' messages. ' : ''}One story.</div>
    <div class="s9-ig">@getmemorywrapped</div>
  ` + F;
}

function fillFreeCardStage(V) {
  // fcs1 — Cover (same as cs1 design)
  $('fcs1').innerHTML = G + C + `
    <div class="s1-eb">✧ A love story in messages</div>
    <div class="s1-nm">${V.P1}<span class="s1-am">&amp;</span>${V.P2}</div>
    <div class="s1-rl"><div class="ln"></div><span style="color:#c9a96e;font-size:18px">✦</span><div class="ln"></div></div>
    <div class="s1-dt">${V.DR}</div>
    ${V.REL ? `<div class="s1-tg">${V.REL}</div>` : ''}
    <div class="s1-ct">${V.MC ? `<strong>${V.MC}</strong> messages and counting` : ''}</div>
    ${V.TE ? `<div class="s1-em">${V.TE}${V.TEC ? ' <span style="font-size:14px;opacity:.6">×' + V.TEC + '</span>' : ''}</div>` : ''}
  ` + WM;

  // fcs2 — Numbers (same as cs3 design)
  const fNumCells = [
    V.WC ? `<div class="s3-cell"><div class="s3-val">${V.WC}</div><div class="s3-lbl">Words written</div></div>` : '',
    V.TE ? `<div class="s3-cell"><div class="s3-val">${V.TE}${V.TEC ? '<span style="font-size:14px;margin-left:4px;opacity:.65">×' + V.TEC + '</span>' : ''}</div><div class="s3-lbl">Most used emoji</div></div>` : '',
    V.MED ? `<div class="s3-cell"><div class="s3-val">${V.MED}</div><div class="s3-lbl">Photos &amp; videos</div></div>` : '',
    V.LOVE_COUNT ? `<div class="s3-cell"><div class="s3-val">${V.LOVE_COUNT}</div><div class="s3-lbl">Love notes</div></div>` : '',
  ].filter(Boolean).slice(0, 4).join('');
  $('fcs2').innerHTML = G + `
    <div class="eyb">By the numbers</div>
    <div class="s3-hero">${V.MC}</div>
    <div class="s3-hl">messages sent</div>
    <div class="s3-grid">${fNumCells}</div>
    ${(V.P1_PCT > 0 && V.P1_PCT < 100) ? `<div class="s3-split">${V.P1}: ${V.P1_PCT}% &nbsp;·&nbsp; ${V.P2}: ${V.P2_PCT}%</div>` : ''}
  ` + WM;

  // fcs3 — Rituals (same as cs4 design)
  let fRitualRows = '';
  if (V.MOTIFS && V.MOTIFS.length > 0) {
    fRitualRows = V.MOTIFS.map(m => `<div class="s4-rw"><div class="r-lb">${m.label}</div><div class="r-vl">${m.count}</div></div>`).join('');
  } else {
    if (V.GM_COUNT) fRitualRows += `<div class="s4-rw"><div class="r-lb">Good mornings</div><div class="r-vl">${V.GM_COUNT}</div></div>`;
    if (V.LOVE_COUNT) fRitualRows += `<div class="s4-rw"><div class="r-lb">Love notes</div><div class="r-vl">${V.LOVE_COUNT}</div></div>`;
  }
  $('fcs3').innerHTML = G + `
    <div class="eyb">Rituals</div>
    <div class="s4-hd">Some things never missed.</div>
    <div class="s4-list">${fRitualRows}</div>
    <div class="s4-ft">Every single time.</div>
  ` + WM;

  // fcs4 — Language (same as cs5 design)
  const fPhraseList = V.PHRASES.length > 0
    ? V.PHRASES.slice(0, 4).map((p, i) => `<div class="s5-ph"><span class="s5-ph-rank">${i + 1}</span><span class="s5-ph-text">${p}</span></div>`).join('')
    : V.TOP_WORDS.slice(0, 5).map(w => `<div class="s5-ph"><span class="s5-ph-text">${w}</span></div>`).join('');
  const fEmoLine = (V.EMO_P1 && V.EMO_P2) ? `<div class="s5-emo">${V.P1_NAME}: ${V.EMO_P1}${V.EMO_P1_COUNT ? ' ×' + V.EMO_P1_COUNT : ''} &nbsp;·&nbsp; ${V.P2_NAME}: ${V.EMO_P2}${V.EMO_P2_COUNT ? ' ×' + V.EMO_P2_COUNT : ''}</div>` : '';
  $('fcs4').innerHTML = G + `
    <div class="eyb">Language</div>
    <div class="s5-hd">The words you made yours.</div>
    <div class="s5-list">${fPhraseList}</div>
    ${fEmoLine}
  ` + WM;

  // fcs5 — Rhythm (same as cs6 design, no photo)
  const fHmSvg = svgHeatmap(V.HEATMAP);
  const fDpBars = svgDayParts(V.DAY_PARTS);
  const fDayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<span>${d}</span>`).join('');
  const fPeakCallout = (V.PW && V.PH) ? `<div class="s6-pk">Most active: ${V.PW} at ${V.PH}</div>` : '';
  $('fcs5').innerHTML = G + `
    <div class="eyb">Rhythm</div>
    <div class="s6-hd">Your chat has a heartbeat.</div>
    <div class="s6-hm">${fHmSvg}</div>
    <div class="s6-dl">${fDayLabels}</div>
    <div class="s6-dp">${fDpBars}</div>
    ${fPeakCallout}
  ` + WM;
}

// =============================================================================
// SECTION 7: FLOW LOGIC
// =============================================================================

function openModal(pkg) {
  if (pkg) selectPkg(pkg);
  $('order-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  goToStep(1);
}
function closeModal() { $('order-modal').classList.remove('open'); document.body.style.overflow = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function goToStep(n) {
  currentStep = n;
  document.querySelectorAll('.modal-step').forEach((s, i) => s.classList.toggle('active', i + 1 === n));
  document.querySelectorAll('.ms-dot').forEach((d, i) => {
    d.classList.toggle('active', i + 1 === n);
    d.classList.toggle('done', i + 1 < n);
  });
  $('btn-back').style.visibility = n === 1 ? 'hidden' : 'visible';
  $('btn-next').style.display = n === 4 ? 'none' : '';
  validateCurrentStep();
  $('modal-scroll') && ($('modal-scroll').scrollTop = 0);
  if (n === 4) fillGenSummary();
}

async function nextStep() {
  if (currentStep === 2) {
    await generateTeaserCards();
    goToStep(3);
    renderQR();
  } else if (currentStep === 3) {
    goToStep(4);
  } else if (currentStep < 4) {
    goToStep(currentStep + 1);
  }
}
function prevStep() { if (currentStep > 1) goToStep(currentStep - 1); }

function validateCurrentStep() {
  const btn = $('btn-next');
  if (!btn) return;
  if (currentStep === 1) btn.disabled = !analysis;
  else if (currentStep === 2) btn.disabled = !(v('f-name1') && v('f-name2'));
  else if (currentStep === 3) btn.disabled = !(emailVal && /^\d{9,12}$/.test(utrVal));
  else btn.disabled = true;
}

function selectPkg(pkg) {
  selectedPkg = pkg;
  document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('sel'));
  const el = $('pkg-' + pkg);
  if (el) el.classList.add('sel');
  const p = $('pay-amt-disp');
  if (p) p.textContent = '₹' + PKG_PRICES[pkg].toLocaleString('en-IN');
  renderQR();
  const sn = $('site-note');
  if (sn) sn.style.display = pkg === 'site' ? 'block' : 'none';
}

function renderQR() {
  const el = $('qr-canvas');
  if (!el) return;
  el.innerHTML = '';
  if (typeof QRCode === 'undefined') { setTimeout(renderQR, 600); return; }
  const amt = PKG_PRICES[selectedPkg] || 399;
  new QRCode(el, { text: `upi://pay?pa=9962740490@upi&pn=MemoryWrapped&am=${amt}&cu=INR&tn=MemoryWrapped`, width: 150, height: 150, colorDark: '#1a1a2e', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
}

function onPayInput() {
  utrVal = v('utr-input');
  emailVal = v('email-input');
  const err = $('utr-error');
  if (utrVal && !/^\d{9,12}$/.test(utrVal)) {
    if (err) err.style.display = 'block';
  } else {
    if (err) err.style.display = 'none';
  }
  validateCurrentStep();
}

// Modal chat upload
const dz = $('drop-zone');
if (dz) {
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) handleChatFile(f); });
}
$('chat-file') && $('chat-file').addEventListener('change', e => handleChatFile(e.target.files[0]));

async function handleChatFile(file) {
  if (!file) return;
  const st = $('upload-status');
  if (st) st.innerHTML = '<span class="ing">Analysing…</span>';
  const text = await readText(file);
  const res = runFullAnalyzer(text);
  if (res && res.stats.totalMessages >= 20) {
    analysis = res;
    const msgs = res.stats.totalMessages.toLocaleString('en-IN');
    if (st) st.innerHTML = `<span class="ok">✓ ${msgs} messages parsed — ready</span>`;
    const cs = $('chat-stats');
    if (cs) {
      cs.classList.add('show');
      const cm = $('cs-msgs'), cw = $('cs-words'), cd = $('cs-days');
      if (cm) cm.textContent = msgs;
      if (cw) cw.textContent = (res.stats.totalWords / 1000).toFixed(0) + 'K';
      if (cd) cd.textContent = res.stats.totalDaysActive.toLocaleString('en-IN');
    }
  } else {
    if (st) st.innerHTML = '<span class="err">Could not parse. Make sure it\'s a WhatsApp .txt export (Without Media).</span>';
    analysis = null;
  }
  validateCurrentStep();
}

// Photo + Crop
$('photo-file') && $('photo-file').addEventListener('change', e => handlePhotoFile(e.target.files[0]));

function handlePhotoFile(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    photoURL = e.target.result;
    photoCrop = { x: 50, y: 30 };
    const ph = $('photo-placeholder'), cc = $('crop-container'), ci = $('crop-img');
    if (ph) ph.style.display = 'none';
    if (cc) cc.style.display = 'block';
    if (ci) { ci.src = photoURL; ci.style.objectPosition = `${photoCrop.x}% ${photoCrop.y}%`; }
    initCropUI();
  };
  r.readAsDataURL(file);
}

function initCropUI() {
  const img = $('crop-img');
  if (!img) return;
  let dragging = false, sx = 0, sy = 0, scx = 50, scy = 30;
  img.addEventListener('mousedown', e => { dragging = true; sx = e.clientX; sy = e.clientY; scx = photoCrop.x; scy = photoCrop.y; e.preventDefault(); });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = (e.clientX - sx) / img.offsetWidth * 100;
    const dy = (e.clientY - sy) / img.offsetHeight * 100;
    photoCrop.x = Math.max(0, Math.min(100, scx - dx));
    photoCrop.y = Math.max(0, Math.min(100, scy - dy));
    img.style.objectPosition = `${photoCrop.x}% ${photoCrop.y}%`;
  });
  document.addEventListener('mouseup', () => { dragging = false; });
  img.addEventListener('touchstart', e => { dragging = true; const t = e.touches[0]; sx = t.clientX; sy = t.clientY; scx = photoCrop.x; scy = photoCrop.y; }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!dragging) return;
    const t = e.touches[0], dx = (t.clientX - sx) / img.offsetWidth * 100, dy = (t.clientY - sy) / img.offsetHeight * 100;
    photoCrop.x = Math.max(0, Math.min(100, scx - dx));
    photoCrop.y = Math.max(0, Math.min(100, scy - dy));
    img.style.objectPosition = `${photoCrop.x}% ${photoCrop.y}%`;
  }, { passive: true });
  document.addEventListener('touchend', () => { dragging = false; });
}

$('photo-chg-btn') && $('photo-chg-btn').addEventListener('click', () => {
  photoURL = null; photoCrop = { x: 50, y: 30 };
  const ph = $('photo-placeholder'), cc = $('crop-container'), pf = $('photo-file');
  if (ph) ph.style.display = ''; if (cc) cc.style.display = 'none'; if (pf) pf.value = '';
});

// Instagram opt-in
const igCb = $('ig-optin');
if (igCb) { igCb.addEventListener('change', () => { igOptIn = igCb.checked; }); }

// Teaser generation
async function generateTeaserCards() {
  if (!analysis) return;
  const msg = $('teaser-gen-msg');
  const tr = $('teaser-row');
  if (msg) { msg.style.display = 'block'; msg.textContent = 'Generating your preview…'; }
  if (tr) tr.style.display = 'none';

  const form = { n1: v('f-name1') || 'You', n2: v('f-name2') || 'Them', rel: v('f-rel'), loc: v('f-loc'), dat: v('f-date'), nick: v('f-nick'), note: v('f-note') };
  const V = buildVars(analysis, form);
  fillCardStage(V);

  const stage = $('card-stage');
  const origStyle = stage.style.cssText;
  stage.style.cssText = 'position:fixed;left:0;top:-9999px;width:1080px;z-index:9999;pointer-events:none;';

  teaserBlobs = [];
  for (const idx of [1, 3]) {
    const el = $('cs' + idx);
    if (!el) continue;
    try {
      const canvas = await html2canvas(el, { width: 1080, height: 1350, scale: 0.5, backgroundColor: '#07070d', useCORS: true, allowTaint: true, logging: false });
      const blob = await canvasBlob(canvas, 'image/jpeg', 0.85);
      teaserBlobs.push(URL.createObjectURL(blob));
    } catch (e) { console.warn('Teaser card error:', e); }
  }
  stage.style.cssText = origStyle;

  if (tr && teaserBlobs.length > 0) {
    tr.style.display = 'grid';
    ['teaser-img-1', 'teaser-img-2'].forEach((id, i) => {
      const img = $(id);
      if (img && teaserBlobs[i]) img.src = teaserBlobs[i];
    });
  }
  if (msg) msg.style.display = 'none';
  selectPkg(selectedPkg);
}

// Gen summary
function fillGenSummary() {
  const n1 = v('f-name1') || 'Person 1', n2 = v('f-name2') || 'Person 2';
  const gn = $('gen-names'), gp = $('gen-pkg'), gc = $('gen-chat-info'), ge = $('gen-email');
  if (gn) gn.textContent = n1 + ' & ' + n2;
  if (gp) gp.textContent = PKG_LABELS[selectedPkg];
  if (gc && analysis) {
    const msgs = analysis.stats.totalMessages.toLocaleString('en-IN');
    const fr = analysis.dateRange.from ? analysis.dateRange.from.slice(0, 7) : '';
    const to = analysis.dateRange.to ? analysis.dateRange.to.slice(0, 7) : '';
    gc.textContent = `${msgs} messages · ${fr} → ${to}`;
  }
  if (ge) ge.textContent = emailVal || '';
}

// Card generation + download (paid)
async function startGeneration() {
  if (!analysis) return;
  $('btn-generate').disabled = true;
  const form = { n1: v('f-name1'), n2: v('f-name2'), rel: v('f-rel'), loc: v('f-loc'), dat: v('f-date'), nick: v('f-nick'), note: v('f-note') };
  const V = buildVars(analysis, form);
  fillCardStage(V);

  const stage = $('card-stage');
  stage.style.cssText = 'position:fixed;left:0;top:-9999px;width:1080px;z-index:9999;pointer-events:none;';

  const pa = $('progress-area'), pf = $('progress-fill'), pl = $('progress-lbl'), pg = $('preview-grid');
  if (pa) pa.style.display = 'block';
  if (pg) { pg.innerHTML = ''; pg.classList.remove('show'); }
  generatedBlobs = [];

  const n = PKG_CARDS[selectedPkg] || 9;
  for (let i = 1; i <= n; i++) {
    if (pl) pl.textContent = `Rendering card ${i} of ${n}…`;
    if (pf) pf.style.width = ((i - 1) / n * 85) + '%';
    const el = $('cs' + i);
    if (!el) continue;
    try {
      const canvas = await html2canvas(el, { width: 1080, height: 1350, scale: 1, backgroundColor: '#07070d', useCORS: true, allowTaint: true, logging: false });
      const blob = await canvasBlob(canvas, 'image/jpeg', 0.93);
      generatedBlobs.push({ name: String(i).padStart(2, '0') + '_' + CARD_NAMES[i - 1] + '.jpg', blob });
      const url = URL.createObjectURL(blob);
      const item = document.createElement('div'); item.className = 'prev-card';
      item.innerHTML = `<img src="${url}" loading="lazy"><div class="prev-card-lbl">${i}. ${CARD_NAMES[i - 1].replace(/_/g, ' ')}</div>`;
      if (pg) { pg.appendChild(item); pg.classList.add('show'); }
    } catch (e) { console.warn('Card ' + i + ' err:', e); }
  }
  stage.style.cssText = 'position:fixed;left:-1200px;top:0;width:1080px;z-index:9999;pointer-events:none;';
  if (pf) pf.style.width = '100%';
  if (pl) pl.textContent = '✓ All cards generated!';
  const dl = $('dl-wrap');
  if (dl) dl.classList.add('show');
  const dlb = $('btn-dl');
  if (dlb) dlb.onclick = downloadZip;
  const igs = $('ig-status');
  if (igs) igs.style.display = 'block';
}

async function downloadZip() {
  if (!generatedBlobs.length) return;
  const btn = $('btn-dl');
  if (btn) { btn.textContent = 'Packing ZIP…'; btn.disabled = true; }
  const n1 = v('f-name1') || 'MemoryWrapped', n2 = v('f-name2') || 'Cards';
  const zip = new JSZip();
  const folder = zip.folder(`MemoryWrapped_${n1}_${n2}`);
  generatedBlobs.forEach(({ name, blob }) => folder.file(name, blob));
  const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a'); a.href = url; a.download = `MemoryWrapped_${n1}_${n2}.zip`; a.click();
  URL.revokeObjectURL(url);
  if (btn) { btn.textContent = '✓ Downloaded!'; }
  logOrder();
}

function logOrder() {
  try {
    fetch(GAS, { method: 'POST', body: JSON.stringify({
      customer: { name1: v('f-name1'), name2: v('f-name2'), email: emailVal, package: selectedPkg, utr: utrVal },
      custom: { relationship: v('f-rel'), photoLocation: v('f-loc'), photoDate: v('f-date'), nickname: v('f-nick'), specialNote: v('f-note'), instagramOptIn: igOptIn },
      manifest: { dateRange: analysis?.dateRange, stats: analysis?.stats }
    }) }).catch(() => {});
  } catch (e) {}
}

// =============================================================================
// SECTION 8: FREE TIER FLOW
// =============================================================================

const fdz = $('free-drop-zone');
if (fdz) {
  fdz.addEventListener('dragover', e => { e.preventDefault(); fdz.classList.add('over'); });
  fdz.addEventListener('dragleave', () => fdz.classList.remove('over'));
  fdz.addEventListener('drop', e => { e.preventDefault(); fdz.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) handleFreeChatFile(f); });
}
const fci = $('free-chat-file');
if (fci) fci.addEventListener('change', e => handleFreeChatFile(e.target.files[0]));

async function handleFreeChatFile(file) {
  if (!file) return;
  const st = $('free-status');
  if (st) st.innerHTML = '<span class="ing">Analysing…</span>';
  const text = await readText(file);
  const res = runFullAnalyzer(text);
  if (res && res.stats.totalMessages >= 20) {
    freeAnalysis = res;
    const msgs = res.stats.totalMessages.toLocaleString('en-IN');
    if (st) st.innerHTML = `<span class="ok">✓ ${msgs} messages found</span>`;
    const fn = $('free-names');
    if (fn) fn.style.display = 'grid';
  } else {
    if (st) st.innerHTML = '<span class="err">Could not parse. Make sure it\'s a WhatsApp .txt export.</span>';
    freeAnalysis = null;
  }
  checkFreeReady();
}

function checkFreeReady() {
  const btn = $('free-gen-btn');
  if (btn) btn.disabled = !(freeAnalysis && v('free-name1') && v('free-name2'));
}

async function generateFreeCards() {
  if (!freeAnalysis) return;
  const btn = $('free-gen-btn');
  if (btn) btn.disabled = true;
  const prog = $('free-progress'), pp = $('free-prog-fill'), pl = $('free-prog-lbl');
  if (prog) prog.style.display = 'block';

  const form = { n1: v('free-name1'), n2: v('free-name2'), rel: '', loc: '', dat: '', nick: v('free-name2'), note: '' };
  const V = buildVars(freeAnalysis, form);
  fillFreeCardStage(V);

  const stage = $('card-stage');
  stage.style.cssText = 'position:fixed;left:0;top:-9999px;width:1080px;z-index:9999;pointer-events:none;';
  freeBlobs = [];

  for (let i = 1; i <= 5; i++) {
    if (pl) pl.textContent = `Generating card ${i} of 5…`;
    if (pp) pp.style.width = ((i - 1) / 5 * 85) + '%';
    const el = $('fcs' + i);
    if (!el) continue;
    try {
      const canvas = await html2canvas(el, { width: 1080, height: 1350, scale: 1, backgroundColor: '#07070d', useCORS: true, allowTaint: true, logging: false });
      const blob = await canvasBlob(canvas, 'image/jpeg', 0.9);
      freeBlobs.push({ name: String(i).padStart(2, '0') + '_card.jpg', blob });
    } catch (e) { console.warn('Free card ' + i + ' err:', e); }
  }

  stage.style.cssText = 'position:fixed;left:-1200px;top:0;width:1080px;z-index:9999;pointer-events:none;';
  if (pp) pp.style.width = '100%';
  if (pl) pl.textContent = '✓ Cards ready!';
  const da = $('free-dl-area');
  if (da) da.style.display = 'block';
}

async function downloadFreeZip() {
  if (!freeBlobs.length) return;
  const btn = $('free-dl-btn');
  if (btn) { btn.textContent = 'Packing…'; btn.disabled = true; }
  const n1 = v('free-name1') || 'MemoryWrapped', n2 = v('free-name2') || 'Free';
  const zip = new JSZip();
  const folder = zip.folder(`MemoryWrapped_Free_${n1}_${n2}`);
  freeBlobs.forEach(({ name, blob }) => folder.file(name, blob));
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a'); a.href = url; a.download = `MemoryWrapped_Free_${n1}_${n2}.zip`; a.click();
  URL.revokeObjectURL(url);
  if (btn) { btn.textContent = '✓ Downloaded!'; }
}

// =============================================================================
// SECTION 9: GSAP + PARTICLES + UI
// =============================================================================

window.addEventListener('load', () => {
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  gsap.from('.hero-h1', { y: 50, opacity: 0, duration: 1.3, ease: 'power4.out', delay: 0.1 });
  gsap.from('.hero .eyebrow', { y: 20, opacity: 0, duration: 0.9, ease: 'power3.out', delay: 0.05 });
  gsap.from('.hero-sub', { y: 30, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.35 });
  gsap.from('.hero-ctas', { y: 20, opacity: 0, duration: 0.9, ease: 'power3.out', delay: 0.55 });
  gsap.from('.hero-proof', { y: 15, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.7 });
  gsap.from('.hero-visual', { x: 50, opacity: 0, duration: 1.2, ease: 'power3.out', delay: 0.2 });

  document.querySelectorAll('.fade-up').forEach(el => {
    el.style.opacity = ''; el.style.transform = '';
    gsap.from(el, {
      y: 40, opacity: 0, duration: 0.85, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
    });
  });
});

function initParticles() {
  const c = $('hero-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  function resize() { c.width = c.offsetWidth; c.height = c.offsetHeight; }
  resize();
  window.addEventListener('resize', resize, { passive: true });
  const pts = Array.from({ length: 28 }, () => ({
    x: Math.random(), y: Math.random(),
    vx: (Math.random() - .5) * .00025, vy: (Math.random() - .5) * .00025,
    r: Math.random() * 1.5 + .3,
    col: Math.random() > .55 ? '201,169,110' : '232,180,184',
    a: Math.random() * .25 + .07
  }));
  (function frame() {
    requestAnimationFrame(frame);
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of pts) {
      p.x = (p.x + p.vx + 1) % 1; p.y = (p.y + p.vy + 1) % 1;
      ctx.beginPath(); ctx.arc(p.x * c.width, p.y * c.height, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.col},${p.a})`; ctx.fill();
    }
  })();
}
initParticles();

function toggleFaq(el) {
  const item = el.closest('.faq-item');
  const o = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
  if (!o) item.classList.add('open');
}

(function () {
  const track = $('gallery-track'), dotsEl = $('gallery-dots');
  if (!track || !dotsEl) return;
  const cards = track.querySelectorAll('.g-card');
  cards.forEach((_, i) => {
    const d = document.createElement('button');
    d.className = 'g-dot' + (i === 0 ? ' active' : '');
    d.onclick = () => cards[i].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    dotsEl.appendChild(d);
  });
  track.addEventListener('scroll', () => {
    const idx = Math.round(track.scrollLeft / (track.scrollWidth / cards.length));
    dotsEl.querySelectorAll('.g-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  }, { passive: true });
})();

(function () {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-up').forEach(el => io.observe(el));
})();
