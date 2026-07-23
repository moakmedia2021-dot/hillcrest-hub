// ─────────────────────────────────────────────
// Profanity filter. Oriented at a cooperative church team, not adversaries.
// Catches curse words + common leetspeak / alternative spellings, while
// avoiding false positives on legitimate words (assembly, damnation, class…).
// The database has a matching server-side guard (defense in depth).
// ─────────────────────────────────────────────

// Longer, unambiguous roots — matched at a word boundary, suffixes allowed
// (fuck→fucking, bitch→bitches). Kept ≥4 chars to avoid false positives.
const ROOTS = [
  "fuck",
  "fuk",
  "motherf",
  "bullshit",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "whore",
  "slut",
  "douche",
  "faggot",
  "nigger",
  "nigga",
  "pussy",
  "dickhead",
  "jackass",
  "cocksuck",
  "goddamn",
  "dumbass",
  "dipshit",
];

// Short / ambiguous words — matched only as a whole word (so "ass" flags "ass"
// but never "assist" or "assembly").
const EXACT = new Set([
  "ass",
  "dick",
  "cock",
  "damn",
  "piss",
  "pissed",
  "fag",
  "prick",
  "wanker",
  "bollocks",
  "twat",
  "crap",
  "hell",
]);

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  $: "s",
  "@": "a",
  "!": "i",
  "|": "i",
};

function normalize(text: string): string {
  let s = text.toLowerCase();
  s = s.replace(/[013457 89$@!|]/g, (c) => (c === " " ? " " : LEET[c] ?? c));
  s = s.replace(/[^a-z ]/g, ""); // drop remaining punctuation
  s = s.replace(/(.)\1{2,}/g, "$1"); // collapse 3+ repeats (fuuuck -> fuck)
  return s.replace(/\s+/g, " ").trim();
}

const rootRe = new RegExp(`\\b(${ROOTS.join("|")})[a-z]*\\b`);

export function containsProfanity(text: string): boolean {
  const norm = normalize(text);
  if (!norm) return false;
  if (rootRe.test(norm)) return true;
  return norm.split(" ").some((tok) => EXACT.has(tok));
}
