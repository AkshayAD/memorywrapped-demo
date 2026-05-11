# MemoryWrapped Manifest Schema (v1)

The browser analyzer outputs a JSON file conforming to this schema. This file is the **only** data that travels from the customer to MemoryWrapped. The customer's raw chat stays on their device.

## File naming

`MW_manifest_<participants_slug>_<YYYYMMDD-HHmmss>.json`

Example: `MW_manifest_aarav_meera_20260511-204500.json`

## Top-level structure

```jsonc
{
  "schema": "memorywrapped-manifest@1",
  "generatedAt": "2026-05-11T20:45:00.000Z",
  "client": {
    "analyzerVersion": "1.0.0",
    "userAgent": "<browser UA, optional, customer-removable>"
  },

  "title": "Aarav & Meera",
  "subtitle": "Six years, told in messages.",
  "occasion": "anniversary",
  "tone": "balanced",
  "theme": "rose_gold",
  "tier": "wrapped",

  "participants": ["Aarav", "Meera"],
  "dateRange": { "from": "2020-01-15", "to": "2026-04-30" },

  "stats": {
    "totalMessages": 12847,
    "totalDaysActive": 1923,
    "longestStreakDays": 187,
    "peakHour": "21:00",
    "peakWeekday": "Friday",
    "perSender": {
      "Aarav": { "messages": 6321, "avgWords": 7.2 },
      "Meera": { "messages": 6526, "avgWords": 6.9 }
    }
  },

  "moments": [
    {
      "id": "m1",
      "kind": "quote",
      "approved": true,
      "redacted": false,
      "text": "Reached home, slept thinking of you.",
      "sender": "Meera",
      "date": "2022-03-14",
      "context": "missing-you note"
    }
  ],

  "milestones": [
    {
      "id": "ms1",
      "approved": true,
      "title": "First love note",
      "date": "2020-05-02",
      "sender": "Aarav",
      "sample": "love you"
    }
  ],

  "motifs": [
    {
      "id": "mo1",
      "approved": true,
      "label": "Good mornings",
      "count": 1247,
      "firstDate": "2020-02-01",
      "sample": "good morning"
    }
  ],

  "topEmojis": [
    { "emoji": "❤️", "count": 412, "approved": true }
  ],

  "userNotes": "Theme should lean rose+gold. Avoid the fight in March 2024."
}
```

## Field rules

- **`schema`** — Must be exactly `"memorywrapped-manifest@1"`.
- **`approved: false`** items are included for transparency but MUST be ignored by the design pipeline.
- **`redacted: true`** indicates auto-flagged sensitive content; `text` shows only the safe version.
- **Raw chat content is NEVER included.** Only customer-approved excerpts, max 180 chars each.

## Validation rules (server-side, on receipt)

1. Reject if `schema` ≠ `"memorywrapped-manifest@1"`.
2. Reject if any `moments[].text` exceeds 200 characters.
3. Reject if total file size > 500 KB.
4. Warn if any `moments[].text` matches redaction regex but `redacted: false`.
5. Strip all `approved: false` items immediately.

## Version history

- **v1 (2026-05-11)** — Initial schema. Ports output structure of `tools/analyze_chat.py` minus raw chat.
