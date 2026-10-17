import { describe, expect, it } from "vitest";
import { findFillers, scoreAnswer } from "./scoring";
import { nextQuestion, openingLine } from "./interviewer";
import { makeBlitzRows } from "../data/blitz";
import { FALLBACK_TARGETS } from "../data/targets";
import { stepPipeline } from "../views/Blitz";
import { rng } from "../data/blitz";

const anthropic = FALLBACK_TARGETS[0];

describe("spoken-answer scoring", () => {
  it("counts fillers without double counting or flagging 'I like'", () => {
    expect(findFillers("Um, you know, I like PyTorch and, like, basically it works")).toEqual(["you know", "um", "like", "basically"]);
  });
  it("rewards a structured, measured answer over a vague one", () => {
    const strong = scoreAnswer("First I measured the latency with a profiler. The root cause was a USB polling interval, so I tested a fix and cut it from 120 ms to 60 ms.", anthropic, 12);
    const weak = scoreAnswer("Um, so basically I kind of worked on, like, a robot thing and it was, you know, pretty cool I guess.", anthropic, 8);
    expect(strong.clarity).toBeGreaterThan(weak.clarity + 20);
    expect(strong.culturalFit).toBeGreaterThan(weak.culturalFit);
    expect(weak.fillerCount).toBeGreaterThanOrEqual(4);
    expect(strong.words).toBe(30);
    expect(strong.wpm).toBe(150);
  });
});

describe("local interviewer", () => {
  it("opens with a seed question and pushes for numbers on vague answers", () => {
    expect(openingLine(anthropic)).toContain(anthropic.questions[0]);
    const vague = "I worked on a teleop arm with a team and we made it faster over a few weeks of iteration on hardware.";
    const q = nextQuestion(anthropic, [
      { role: "interviewer", text: openingLine(anthropic), at: 0 },
      { role: "candidate", text: vague, at: 1, telemetry: scoreAnswer(vague, anthropic) },
    ]);
    expect(q.text).toMatch(/number|measure/i);
    expect(q.ended).toBe(false);
  });
});

describe("blitz pipeline", () => {
  it("never exceeds the lane limit and always finishes", () => {
    let rows = makeBlitzRows(100, 7);
    const r = rng(3);
    let ticks = 0;
    while (rows.some((x) => x.stage !== 5) && ticks < 2000) {
      rows = stepPipeline(rows, 24, r);
      expect(rows.filter((x) => x.stage > 0 && x.stage < 5).length).toBeLessThanOrEqual(24);
      ticks++;
    }
    expect(rows.every((x) => x.stage === 5 && x.gmailDraftId)).toBe(true);
    expect(ticks).toBeLessThan(200); // ≈ 28 s at 140 ms/tick worst case; typically ~10 s
  });
  it("generates deterministic rosters with 3 calendar slots each", () => {
    expect(makeBlitzRows(5, 1).map((x) => x.name)).toEqual(makeBlitzRows(5, 1).map((x) => x.name));
    expect(makeBlitzRows(20).every((x) => x.slots.length === 3 && x.after.reply > x.before.reply)).toBe(true);
  });
});
