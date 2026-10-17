// Instant answer coaching: rubric coverage + framework structure + spoken delivery. Pure, runs in <5 ms, unit tested.
// The backend (POST /api/voice-interview with mode "coach") can refine it; see mergeBackend().
import { FRAMEWORKS, type FrameworkId, type Question } from "../data/questions";
import { scoreAnswer } from "./scoring";
import type { AnswerTelemetry, Target } from "./types";

export interface PointResult {
  id: string;
  label: string;
  hit: boolean;
  evidence?: string; // words from the answer that earned it
  tip: string;
  mustHave: boolean;
}

export interface Coaching {
  score: number; // overall 0-100
  content: number; // rubric coverage
  structure: number; // framework steps hit
  delivery: number; // clarity, fillers, length
  points: PointResult[];
  steps: { label: string; hint: string; hit: boolean }[];
  framework: string;
  strengths: string[];
  fixes: string[];
  topFix: string;
  spoken: string; // what the coach says out loud (≤ 2 sentences)
  lengthNote: string | null;
  tel: AnswerTelemetry;
  betterAnswer: string;
  source: "local" | "backend";
}

// Any digit counts ("60", "2×", "98%"), plus spoken number words. "one" is left out on purpose: "one thing", "no one".
const NUMBER_WORDS = /\d|(?:^|\s)(?:two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|million|half|double|twice|percent)(?=\s|$)/;

const norm = (s: string) => ` ${s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9%'+#./\s-]/g, " ").replace(/\s+/g, " ").trim()} `;

/** Find the first keyword that appears at a word start. Returns a short evidence snippet. */
export function matchAny(text: string, keywords: string[], org = ""): string | null {
  const t = norm(text);
  for (const raw of keywords) {
    if (raw === "#num") {
      const m = t.match(NUMBER_WORDS);
      if (m) return snippet(t, m.index ?? 0);
      continue;
    }
    const kws = raw === "{org}" ? org.toLowerCase().split(/\s+/).filter((w) => w.length > 3) : [raw.toLowerCase().trim()];
    for (const kw of kws) {
      if (!kw) continue;
      const i = t.indexOf(` ${kw}`);
      if (i !== -1) return snippet(t, i + 1);
    }
  }
  return null;
}

function snippet(t: string, i: number) {
  const words = t.trim().split(" ");
  let pos = 0;
  let wi = 0;
  for (; wi < words.length; wi++) {
    if (pos + words[wi].length >= i) break;
    pos += words[wi].length + 1;
  }
  return words.slice(Math.max(0, wi - 2), wi + 5).join(" ");
}

const STEP_CUES: Record<FrameworkId, string[][]> = {
  STAR: [
    ["when", "during", "last year", "last summer", "we were", "the project", "at my", "on my", "i was working"],
    ["needed to", "had to", "goal", "my job", "responsible", "task", "supposed to", "wanted to"],
    [" i built", " i wrote", " i decided", " i measured", " i changed", " i tested", " i debugged", " i designed", " i ran", " i fixed", " i started", " i rewrote", " i redesigned", " i stopped"],
    ["#num", "result", "so the", "which meant", "ended up", "cut", "improved", "reduced", "grew", "held", "learned"],
  ],
  VISION: [
    ["in ten years", "10 years", "ten years", "i want", "i see myself", "i'd like", "i would like", "my goal", "i hope", "i plan"],
    ["{org}", "here", "this role", "this lab", "this team", "that's why", "because you", "your"],
    ["already", "so far", "built", "started", "founded", "right now", "currently", "last year"],
  ],
  WHY: [
    ["{org}", "your", "paper", "product", "thesis", "mission", "research", "portfolio"],
    [" i built", " i made", " i designed", " i ran", " i measured", "project", "#num"],
    ["i can", "i'd bring", "i would bring", "contribute", "help", "add", "first month", "day one", "own"],
  ],
  TECH: [
    ["first i'd", "first i would", "clarify", "depends", "assume", "assuming", "how many", "requirement", "constraint", "is this", "before i"],
    ["i would", "i'd", "step", "then", "approach", "plan", "start by", "one,", "two,"],
    ["trade", " but ", "cost", "downside", "instead", "versus", " vs", "alternatively", "risk", "the catch"],
    ["test", "measure", "monitor", "benchmark", "verify", "staging", "check", "dry run", "sample", "validate"],
  ],
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function evaluate(answer: string, q: Question, target: Target, durationSec?: number): Coaching {
  const name = target.name.split(" (")[0];
  const tel = scoreAnswer(answer, target, durationSec);

  // 1. Rubric coverage
  const points: PointResult[] = q.rubric.map((p) => {
    const ev = matchAny(answer, p.any, name);
    return { id: p.id, label: p.label, hit: !!ev, evidence: ev ?? undefined, tip: p.tip, mustHave: !!p.mustHave };
  });
  const weightOf = (id: string) => {
    const p = q.rubric.find((r) => r.id === id)!;
    return p.weight ?? (p.mustHave ? 2 : 1);
  };
  const total = points.reduce((s, p) => s + weightOf(p.id), 0);
  const got = points.filter((p) => p.hit).reduce((s, p) => s + weightOf(p.id), 0);
  const content = total ? (100 * got) / total : 0;

  // 2. Structure
  const fw = FRAMEWORKS[q.framework];
  const steps = fw.steps.map((s, i) => ({ ...s, hit: !!matchAny(answer, STEP_CUES[q.framework][i], name) }));
  const structure = (100 * steps.filter((s) => s.hit).length) / steps.length;

  // 3. Delivery: clarity from the spoken scorer, adjusted for length
  const [lo, hi] = q.idealWords;
  let lengthNote: string | null = null;
  let lengthPenalty = 0;
  if (tel.words < lo) {
    lengthNote = `Short: ${tel.words} words. Aim for ${lo}–${hi} (about ${Math.round(lo / 2.5)}–${Math.round(hi / 2.5)} seconds).`;
    lengthPenalty = Math.min(30, ((lo - tel.words) / lo) * 40);
  } else if (tel.words > hi) {
    lengthNote = `Long: ${tel.words} words. Land it in under ${hi}; stop after the result.`;
    lengthPenalty = Math.min(20, ((tel.words - hi) / hi) * 30);
  }
  // scoring.ts already docks very short answers (-25); length is handled here instead, so don't penalize twice.
  const delivery = clamp(tel.clarity + (tel.words < 15 ? 25 : 0) - lengthPenalty);

  const score = clamp(0.55 * content + 0.2 * structure + 0.25 * delivery);

  // 4. Feedback, most important first
  const missingMust = points.filter((p) => !p.hit && p.mustHave);
  const missingOther = points.filter((p) => !p.hit && !p.mustHave);
  const fixes = [
    ...missingMust.map((p) => p.tip),
    ...(tel.fillerCount >= 3 ? [`${tel.fillerCount} filler words (${[...new Set(tel.fillers)].slice(0, 3).map((f) => `“${f}”`).join(", ")}). Pause silently instead.`] : []),
    ...(lengthNote ? [lengthNote] : []),
    ...missingOther.map((p) => p.tip),
    ...steps.filter((s) => !s.hit).slice(0, 1).map((s) => `Structure: add the “${s.label}” step (${s.hint.toLowerCase()}).`),
  ];
  const strengths = [
    ...points.filter((p) => p.hit && p.mustHave).map((p) => p.label),
    ...points.filter((p) => p.hit && !p.mustHave).map((p) => p.label),
    ...(tel.fillerCount === 0 && tel.words >= 20 ? ["Zero filler words"] : []),
    ...(steps.every((s) => s.hit) ? [`Clean ${fw.name} structure`] : []),
  ].slice(0, 4);

  const topFix = fixes[0] ?? "Strong answer. Tighten the delivery and say it with more conviction.";
  const praise = strengths[0] ? `Good: ${lowerFirst(strengths[0])}.` : "Okay, you've got a start.";
  const spoken = score >= 85 ? `${praise} That's a strong answer. Want the next question?` : `${praise} ${firstSentence(topFix)} Try it again?`;

  return {
    score,
    content: clamp(content),
    structure: clamp(structure),
    delivery,
    points,
    steps,
    framework: fw.name,
    strengths,
    fixes,
    topFix,
    spoken,
    lengthNote,
    tel,
    betterAnswer: q.model,
    source: "local",
  };
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
// For speech: drop parentheticals (they hold "e.g." and code-ish detail that reads badly aloud), then take the first sentence.
const firstSentence = (s: string) => {
  const plain = s.replace(/\s*\([^)]*\)/g, "").replace(/\s+([.,])/g, "$1");
  const sentences = plain.match(/.+?[.!?](?=\s|$)/g) ?? [plain];
  // A short first sentence usually names the problem; keep going until the advice itself is included.
  let out = "";
  for (const x of sentences) {
    out += `${x} `;
    if (out.split(/\s+/).length >= 12) break;
  }
  return out.trim();
};

/** Fold the backend's coaching (if any) into the instant local result without losing the local rubric detail. */
export function mergeBackend(local: Coaching, b: { score?: number; strengths?: string[]; improvements?: string[]; betterAnswer?: string; technicalScore?: number; culturalFitScore?: number; feedback?: string }): Coaching {
  const fixes = [...(b.improvements ?? []), ...local.fixes].filter((x, i, a) => x && a.indexOf(x) === i);
  const strengths = [...(b.strengths ?? []), ...local.strengths].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 5);
  const score = Number.isFinite(b.score) ? clamp(0.5 * (b.score as number) + 0.5 * local.score) : local.score;
  return {
    ...local,
    score,
    fixes,
    strengths,
    topFix: fixes[0] ?? local.topFix,
    betterAnswer: b.betterAnswer || local.betterAnswer,
    tel: {
      ...local.tel,
      technical: Number.isFinite(b.technicalScore) ? Math.round(b.technicalScore as number) : local.tel.technical,
      culturalFit: Number.isFinite(b.culturalFitScore) ? Math.round(b.culturalFitScore as number) : local.tel.culturalFit,
      feedback: b.feedback || local.tel.feedback,
      source: "backend",
    },
    source: "backend",
  };
}
