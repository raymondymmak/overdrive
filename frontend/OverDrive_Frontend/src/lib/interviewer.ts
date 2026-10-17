// Local fallback interviewer: plays the target's persona from its seed questions and reacts to the last answer.
// The real interviewer is the backend (POST /api/voice-interview); this keeps the demo alive offline.
import type { AnswerTelemetry, Target, Turn } from "./types";

export function openingLine(t: Target) {
  const who = t.kind === "VC" ? "I've got about twenty minutes" : "Thanks for making the time";
  return `${who}. I've read the resume you sent us. ${t.questions[0]}`;
}

function followUp(t: Target, answer: string, tel: AnswerTelemetry) {
  const lower = answer.toLowerCase();
  if (tel.words < 15) return "Can you go deeper on that? Walk me through specifically what you did.";
  if (!/\d/.test(answer) && t.kind !== "VC") return "What did you actually measure there? Give me a number.";
  if (t.kind === "VC" && !/\d/.test(answer)) return "What's the number that proves it? Members, retention, anything.";
  if (/\bwe\b/.test(lower) && !/\bi\b/.test(lower)) return "You said 'we' a lot. What was your part, personally?";
  if (tel.culturalFit < 50) {
    const v = t.cultureKeywords[0];
    return `Okay. How does that connect to how we work here? We care a lot about being ${v === "measure" ? "measured and evidence-driven" : `${v}-driven`}.`;
  }
  return null;
}

/** Next interviewer line, given the transcript so far (the last turn is the candidate's answer). */
export function nextQuestion(t: Target, transcript: Turn[]): { text: string; ended: boolean } {
  const asked = transcript.filter((x) => x.role === "interviewer").length;
  const last = transcript[transcript.length - 1];
  // Only one follow-up per seed question: if the previous interviewer line wasn't a seed question, move on.
  const prevQ = [...transcript].reverse().find((x) => x.role === "interviewer");
  const prevWasSeed = !prevQ || t.questions.some((q) => prevQ.text.endsWith(q));

  if (asked >= 6) {
    return { text: "That's all the time we have. Thanks, this was useful. You'll see my notes on the right.", ended: true };
  }
  if (last?.role === "candidate" && last.telemetry && prevWasSeed) {
    const f = followUp(t, last.text, last.telemetry);
    if (f) return { text: f, ended: false };
  }
  const usedSeeds = transcript.filter((x) => x.role === "interviewer" && t.questions.some((q) => x.text.endsWith(q))).length;
  const q = t.questions[usedSeeds] ?? t.questions[usedSeeds % t.questions.length];
  const bridge = ["Good.", "Got it.", "Okay, makes sense.", "Interesting."][asked % 4];
  return { text: `${bridge} ${q}`, ended: false };
}
