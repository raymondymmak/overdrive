// Local spoken-answer telemetry: clarity, filler words, cultural fit, technical depth.
// Used when POST /api/voice-interview is unavailable, and to add filler/WPM detail when it is. Pure and unit tested.
import type { AnswerTelemetry, Target } from "./types";

// Multi-word fillers first so "you know" isn't also counted as "know".
const FILLERS = ["you know", "i mean", "sort of", "kind of", "um", "uh", "erm", "like", "basically", "actually", "literally", "honestly", "so yeah", "right"];
const HEDGES = ["i think maybe", "i guess", "probably", "not sure", "kind of", "sort of"];
const STRUCTURE = ["first", "second", "then", "because", "so that", "which meant", "the result", "as a result", "for example", "specifically", "measured"];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9%&+#.\s-]/g, " ").replace(/\s+/g, " ").trim()} `;

function count(text: string, phrase: string) {
  const t = norm(text);
  const p = ` ${phrase} `;
  let n = 0;
  for (let i = t.indexOf(p); i !== -1; i = t.indexOf(p, i + p.length - 1)) n++;
  return n;
}

export function findFillers(text: string) {
  let t = norm(text);
  const found: string[] = [];
  for (const f of FILLERS) {
    const p = ` ${f} `;
    let i = t.indexOf(p);
    while (i !== -1) {
      // "like" used as a verb ("I like", "would like") isn't filler.
      const before = t.slice(Math.max(0, i - 7), i);
      if (!(f === "like" && /\b(i|would|you|we|they|really|don't)$/.test(before.trim()))) found.push(f);
      t = t.slice(0, i) + " ".repeat(p.length - 1) + t.slice(i + p.length - 1); // blank it out to avoid double counting
      i = t.indexOf(p, i);
    }
  }
  return found;
}

const hits = (text: string, words: string[]) => {
  const t = text.toLowerCase();
  return [...new Set(words.filter((w) => t.includes(w.toLowerCase())))];
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function scoreAnswer(text: string, target: Pick<Target, "cultureKeywords" | "techKeywords">, durationSec?: number): AnswerTelemetry {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const fillers = findFillers(text);
  const fillerRate = words ? fillers.length / words : 0;
  const hedges = HEDGES.reduce((n, h) => n + count(text, h), 0);
  const structure = STRUCTURE.reduce((n, s) => n + count(text, s), 0);
  const hasNumber = /\d/.test(text);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim()).length || 1;
  const avgSentence = words / sentences;

  const culture = hits(text, target.cultureKeywords);
  const tech = hits(text, target.techKeywords);

  let clarity = 88 - fillerRate * 260 - hedges * 6 + Math.min(structure, 4) * 3 + (hasNumber ? 4 : 0);
  if (avgSentence > 32) clarity -= 8; // run-on answer
  if (words < 15) clarity -= 25; // too thin to judge
  const culturalFit = 35 + culture.length * 13 + (hasNumber ? 5 : 0) - hedges * 4;
  const technical = 30 + tech.length * 12 + (hasNumber ? 10 : 0) + Math.min(structure, 3) * 3;

  const wpm = durationSec && durationSec > 2 ? Math.round((words / durationSec) * 60) : null;

  const notes: string[] = [];
  if (fillers.length) notes.push(`${fillers.length} filler word${fillers.length > 1 ? "s" : ""} (${[...new Set(fillers)].slice(0, 3).map((f) => `"${f}"`).join(", ")})`);
  if (hedges) notes.push("hedging softens your point; commit to the claim");
  if (!hasNumber) notes.push("add one number: a metric, a rate, a count");
  if (avgSentence > 32) notes.push("break the long sentences up");
  if (wpm && wpm > 175) notes.push(`fast (${wpm} wpm); slow down`);
  if (culture.length) notes.push(`culture signals landed: ${culture.slice(0, 3).join(", ")}`);
  else notes.push("no culture signals yet; tie it to what they value");
  if (words < 15) notes.push("too short to show depth");

  return {
    clarity: clamp(clarity),
    culturalFit: clamp(culturalFit),
    technical: clamp(technical),
    fillerCount: fillers.length,
    fillers,
    wpm,
    words,
    feedback: notes.join(" · "),
    source: "local",
  };
}
