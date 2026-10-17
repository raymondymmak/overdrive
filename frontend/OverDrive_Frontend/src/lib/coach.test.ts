import { describe, expect, it } from "vitest";
import { evaluate, matchAny, mergeBackend } from "./coach";
import { questionsFor } from "../data/questions";
import { FALLBACK_TARGETS } from "../data/targets";

const anthropic = FALLBACK_TARGETS.find((t) => t.id === "anthropic")!;
const lab = FALLBACK_TARGETS.find((t) => t.kind === "LAB")!;
const vc = FALLBACK_TARGETS.find((t) => t.kind === "VC")!;
const q = (t: typeof anthropic, id: string) => questionsFor(t, "mixed").concat(questionsFor(t, "technical"), questionsFor(t, "personal")).find((x) => x.id === id)!;

describe("question bank", () => {
  it("mixes personal and technical, and adapts technical questions to the target", () => {
    const mixed = questionsFor(anthropic, "mixed");
    expect(mixed[0].id).toBe("ten-years");
    expect(mixed.some((x) => x.type === "technical" && x.code)).toBe(true);
    expect(questionsFor(lab, "technical")[0].id).toBe("control-loop");
    expect(questionsFor(vc, "technical")[0].id).toBe("metrics");
    for (const x of [...mixed, ...questionsFor(lab, "technical")]) expect(x.rubric.some((r) => r.mustHave)).toBe(true);
  });
});

describe("matching", () => {
  it("matches at word starts, numbers, and the org name", () => {
    expect(matchAny("We added regularization", ["regulariz"])).toContain("regularization");
    expect(matchAny("the generator", ["rat"])).toBeNull(); // not mid-word
    expect(matchAny("cut it to 60 ms", ["#num"])).toContain("60");
    expect(matchAny("no one cared", ["#num"])).toBeNull();
    expect(matchAny("that's why Anthropic is next", ["{org}"], "Anthropic")).toContain("anthropic");
  });
});

describe("db-batch coaching", () => {
  const question = q(anthropic, "db-batch");
  const weak = "Um, I would just, like, run it on the server and maybe make it faster.";
  const strong =
    "First I'd clarify whether this is a one-off backfill and if we can read from a replica. Then I would stream rows with a server-side cursor instead of fetchall, " +
    "paging with where id greater than the last id, five thousand at a time. I'd batch the updates with executemany and commit per chunk, and set a statement timeout so prod is protected. " +
    "Forty milliseconds times ten million is about four and a half days, so I'd split id ranges across parallel workers, but that adds load, so I'd throttle. " +
    "It only processes rows where score is null, so it can resume after a crash, and I'd dry run on a sample first and monitor database load.";

  it("flags the missing must-haves on a weak answer and gives a concrete first fix", () => {
    const c = evaluate(weak, question, anthropic, 6);
    expect(c.score).toBeLessThan(40);
    expect(c.points.find((p) => p.id === "memory")!.hit).toBe(false);
    expect(c.topFix).toMatch(/fetchall|stream|cursor/i);
    expect(c.spoken).toMatch(/Try it again\?$/);
    expect(c.lengthNote).toMatch(/Short/);
  });

  it("rewards a complete, structured answer and lets you see the improvement", () => {
    const w = evaluate(weak, question, anthropic, 6);
    const s = evaluate(strong, question, anthropic, 55);
    expect(s.score).toBeGreaterThanOrEqual(80);
    expect(s.score - w.score).toBeGreaterThan(40);
    expect(s.points.filter((p) => p.mustHave).every((p) => p.hit)).toBe(true);
    expect(s.steps.every((x) => x.hit)).toBe(true);
    expect(s.points.find((p) => p.id === "memory")!.evidence).toBeTruthy();
  });
});

describe("personal coaching", () => {
  it("scores a 10-year answer on direction, bridge to the org and proof", () => {
    const question = q(anthropic, "ten-years");
    const vague = "I see myself being successful and happy, maybe a manager somewhere.";
    const good = "In ten years I want to lead research on making AI systems reliable enough to trust outside the lab. I've already started: I built a teleop arm and cut its latency in half by measuring the whole loop. Anthropic is the right next step because your empirical safety work is the bar I want to be held to, and I still need to learn how to do this at scale.";
    const v = evaluate(vague, question, anthropic);
    const g = evaluate(good, question, anthropic);
    expect(v.points.find((p) => p.id === "bridge")!.hit).toBe(false);
    expect(g.points.every((p) => p.hit)).toBe(true);
    expect(g.score).toBeGreaterThan(v.score + 35);
  });
});

describe("backend merge", () => {
  it("keeps local rubric detail and blends in backend coaching", () => {
    const local = evaluate("I would stream rows with a cursor.", q(anthropic, "db-batch"), anthropic);
    const m = mergeBackend(local, { score: 90, improvements: ["Mention a read replica."], betterAnswer: "B", technicalScore: 77 });
    expect(m.points).toEqual(local.points);
    expect(m.topFix).toBe("Mention a read replica.");
    expect(m.score).toBe(Math.round(0.5 * 90 + 0.5 * local.score));
    expect(m.tel.technical).toBe(77);
    expect(m.source).toBe("backend");
  });
});
