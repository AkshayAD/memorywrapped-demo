/**
 * MemoryWrapped redaction module
 * Direct port of tools/analyze_chat.py's PRIVATE_WORDS set and snippet() function.
 * Runs entirely in the browser. Source of truth for sensitive-content detection.
 *
 * Last reviewed: 2026-05-11
 */

// Mirrors PRIVATE_WORDS (line 112-130 of tools/analyze_chat.py)
export const PRIVATE_WORDS = new Set([
  "account",
  "address",
  "bank",
  "card",
  "credential",
  "credentials",
  "email",
  "gmail",
  "login",
  "mail",
  "mobile",
  "otp",
  "pass",
  "password",
  "phone",
  "pin",
  "upi",
]);

// Mirrors STOPWORDS (line 22-110 of analyze_chat.py)
export const STOPWORDS = new Set([
  "a", "about", "after", "all", "am", "an", "and", "are", "as", "at",
  "be", "but", "by",
  "can",
  "did", "do",
  "for", "from",
  "get", "go", "going", "got",
  "had", "has", "have", "he", "her", "here", "him", "his",
  "i", "if", "in", "is", "it", "its",
  "just",
  "me", "my",
  "no", "not",
  "of", "ok", "omitted", "on", "or",
  "so",
  "that", "the", "then", "there", "this", "to", "too",
  "u",
  "was", "we", "what", "when", "where", "will", "with",
  "you", "your",
  "com", "edited", "http", "https", "www",
  "aaj", "ab", "aur", "hai", "hain", "ho", "hu",
  "ka", "ke", "ki", "ko", "kya",
  "main", "media", "mera", "message",
  "nahi", "se",
]);

// Mirrors HINGLISH_MARKERS (line 132-171)
export const HINGLISH_MARKERS = new Set([
  "aaj", "abhi", "acha", "accha", "aur",
  "bahut", "bas", "bata", "batana", "bhai", "bhi",
  "chal", "chalo",
  "de", "diya",
  "gaya", "ghar",
  "haan", "hai", "hain", "ho", "hu",
  "kal", "kar", "karo", "kr", "kya", "kyu", "kyun",
  "mat", "mera",
  "nahi", "nhi",
  "raha", "rhe",
  "theek", "tum",
  "yaar",
]);

/**
 * Extract lowercase word tokens. Mirrors words() function (line 274).
 */
export function words(text) {
  const matches = text.toLowerCase().match(/[a-zA-Z][a-zA-Z']+/g);
  return matches || [];
}

/**
 * Extract emoji characters. Mirrors emoji_chars() (line 278).
 */
export function emojiChars(text) {
  const re = /[\u{1f300}-\u{1f6ff}\u{1f700}-\u{1f77f}\u{1f780}-\u{1f7ff}\u{1f800}-\u{1f8ff}\u{1f900}-\u{1f9ff}\u{1fa00}-\u{1faff}\u{2600}-\u{27bf}]/gu;
  return text.match(re) || [];
}

/**
 * Produce a privacy-safe snippet from a message.
 * Direct port of snippet() function (line 285-299 of analyze_chat.py).
 *
 * Returns { text: string, redacted: boolean }
 *   - text: max 'limit' characters, with PII patterns replaced
 *   - redacted: true if PRIVATE_WORDS or PII pattern triggered redaction
 */
export function snippet(message, limit = 128) {
  let text = message.text.replace(/\s+/g, " ").trim();
  text = text.replace("<Media omitted>", "A shared media memory");

  const lowered = new Set(words(text));
  // Check intersection with PRIVATE_WORDS
  for (const w of lowered) {
    if (PRIVATE_WORDS.has(w)) {
      return { text: "Private detail redacted", redacted: true };
    }
  }

  let redacted = false;

  // URLs
  const urlPattern = /https?:\/\/\S+|www\.\S+/g;
  if (urlPattern.test(text)) {
    text = text.replace(urlPattern, "[link]");
    redacted = true;
  }

  // Emails
  const emailPattern = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
  if (emailPattern.test(text)) {
    text = text.replace(emailPattern, "[email]");
    redacted = true;
  }

  // Indian phone numbers (matches Python: \b(?:\+?91[\s-]?)?[6-9]\d{9}\b)
  const phonePattern = /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;
  if (phonePattern.test(text)) {
    text = text.replace(phonePattern, "[phone]");
    redacted = true;
  }

  // Long numeric strings (potential card numbers, OTPs, IDs)
  const longNumPattern = /\b\d{4,}\b/g;
  if (longNumPattern.test(text)) {
    text = text.replace(longNumPattern, "[number]");
    redacted = true;
  }

  if (!text.trim()) {
    return { text: "Tiny reaction", redacted };
  }
  if (text.length <= limit) {
    return { text, redacted };
  }
  return { text: text.substring(0, limit - 1).trimEnd() + "...", redacted };
}

/**
 * Check if a message contains anything sensitive that should be auto-flagged.
 * Used to pre-uncheck moments in the UI.
 */
export function isSensitive(text) {
  const lower = text.toLowerCase();
  // Private word match
  const tokens = new Set(words(text));
  for (const w of tokens) {
    if (PRIVATE_WORDS.has(w)) return true;
  }
  // PII pattern match
  if (/https?:\/\/\S+|www\.\S+/.test(text)) return true;
  if (/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/.test(text)) return true;
  if (/\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/.test(text)) return true;
  if (/\b\d{4,}\b/.test(text)) return true;
  return false;
}
