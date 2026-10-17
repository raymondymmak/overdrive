import type { Target } from "../lib/types";

// Question bank for the voice coach. Every question carries a rubric (what a strong answer covers),
// a framework (how to structure it), a follow-up for when a must-have point is missing, and a model answer.
// Rubric keywords are matched at word starts, so "regulariz" matches "regularize" and "regularization".
// Special tokens: "#num" = the answer contains a number; "{org}" = the target's name.

export type QType = "personal" | "behavioral" | "technical";
export type FrameworkId = "STAR" | "VISION" | "WHY" | "TECH";

export interface RubricPoint {
  id: string;
  label: string;
  any: string[];
  tip: string; // what to add if it's missing
  mustHave?: boolean;
  weight?: number; // default 1; mustHave defaults to 2
}

export interface Question {
  id: string;
  type: QType;
  topic: string;
  prompt: string; // what the interviewer says
  code?: { lang: string; caption: string; source: string };
  framework: FrameworkId;
  idealWords: [number, number]; // a strong spoken answer is usually 45–120 seconds
  rubric: RubricPoint[];
  followUp: string; // asked (interview mode) when a must-have point is missing
  model: string; // a strong answer, spoken-friendly
}

export const FRAMEWORKS: Record<FrameworkId, { name: string; steps: { label: string; hint: string }[] }> = {
  STAR: {
    name: "STAR",
    steps: [
      { label: "Situation", hint: "One sentence of context" },
      { label: "Task", hint: "What you had to achieve" },
      { label: "Action", hint: "What YOU did, with “I”" },
      { label: "Result", hint: "A number, then the lesson" },
    ],
  },
  VISION: {
    name: "Vision → Bridge → Proof",
    steps: [
      { label: "Direction", hint: "Where you're heading, concretely" },
      { label: "Bridge", hint: "Why this place is the next step" },
      { label: "Proof", hint: "What you've already done toward it" },
    ],
  },
  WHY: {
    name: "Them → You → Contribution",
    steps: [
      { label: "Specific to them", hint: "Name their work, not their brand" },
      { label: "Your evidence", hint: "One thing you built that matches" },
      { label: "Contribution", hint: "What you'd add in the first months" },
    ],
  },
  TECH: {
    name: "Clarify → Approach → Trade-offs → Verify",
    steps: [
      { label: "Clarify", hint: "Ask or state assumptions first" },
      { label: "Approach", hint: "Step-by-step plan" },
      { label: "Trade-offs", hint: "What it costs, what you'd pick instead" },
      { label: "Verify", hint: "How you'd test and monitor it" },
    ],
  },
};

// ✏️ Your real stories. Model answers are built from these, so edit them once here before the demo.
export const STORY = {
  school: "a Statistics and CS student at UC Berkeley",
  project: "a hand-tracking teleoperation arm with MediaPipe and a C++ control loop",
  win: "traced a 2× latency regression to a USB polling interval and cut end-to-end latency in half",
  failure: "my first gripper design slipped on smooth objects; I'd tested it only on the easy cases",
  failureFix: "I wrote a 20-object test set before touching CAD again, and the sixth revision held 18 of 20",
  community: "Area 94, a community connecting Bay Area founders and investors",
  communityMetric: "intro-to-meeting conversion, which we track weekly",
};

const org = (t: Target) => t.name.split(" (")[0];

// ---------------- personal / behavioral ----------------

const tenYears = (t: Target): Question => ({
  id: "ten-years",
  type: "personal",
  topic: "10-year vision",
  prompt: `Let's start big picture. Where do you see yourself in ten years, and how does ${org(t)} fit into that?`,
  framework: "VISION",
  idealWords: [70, 190],
  rubric: [
    { id: "direction", label: "A concrete direction, not a title", any: ["build", "lead", "research", "found", "start", "run", "ship", "make", "work on", "solve", "robot", "embodied", "safety", "product", "lab", "company"], tip: "Name the problem you want to own (e.g. “reliable robots outside the lab”), not just a job title.", mustHave: true },
    { id: "bridge", label: `Connects to ${org(t)} specifically`, any: ["{org}", "here", "your team", "this team", "this lab", "this role", "you're", "your work", "your"], tip: `Say why ${org(t)} is the next step on that path. Mention something specific they do.`, mustHave: true },
    { id: "proof", label: "Evidence you're already on the way", any: ["already", "so far", "built", "started", "founded", "right now", "currently", "last year", "this year", "project", "#num"], tip: "Add one thing you've already done that points in that direction, ideally with a number." },
    { id: "humble", label: "Open to learning", any: ["learn", "grow", "mentor", "not sure", "open to", "figure out", "humble", "better at"], tip: "One line on what you still need to learn makes the vision believable.", weight: 0.5 },
  ],
  followUp: `You talked about the future, but how does ${org(t)} specifically fit in? What would you get here that you couldn't get anywhere else?`,
  model: `In ten years I want to be leading work on making ${t.kind === "VC" ? "a company that matters in its category" : "AI systems reliable enough to trust outside the lab"}. I'm already pointed that way: I built ${STORY.project} and ${STORY.win}. ${org(t)} is the right next step because ${t.tagline.toLowerCase()} is exactly the bar I want to be held to, and I'd learn faster here than anywhere else. What I still need is depth at scale, and that's what I'd come here to get.`,
});

const whyUs = (t: Target): Question => ({
  id: "why-us",
  type: "personal",
  topic: `Why ${org(t)}`,
  prompt: t.kind === "VC" ? `Why are you pitching us, rather than any other seed fund?` : `Why ${org(t)}? And be specific; I've heard "I love the mission" a hundred times.`,
  framework: "WHY",
  idealWords: [60, 170],
  rubric: [
    { id: "specific", label: "Something specific about them", any: ["{org}", "paper", "your work", "product", "thesis", "portfolio", "blog", "talk", "launch", "research", "approach", "the way you"], tip: "Name one concrete piece of their work: a paper, product decision, investment or talk.", mustHave: true },
    { id: "evidence", label: "Your matching evidence", any: [" i built", "i built", "i made", "i designed", "i ran", "i measured", "my project", "project", "#num"], tip: "Tie it to one thing you built or did that matches it.", mustHave: true },
    { id: "contribute", label: "What you'd contribute", any: ["i can", "i'd bring", "i would bring", "contribute", "help", "add", "first month", "day one", "take on", "own"], tip: "Finish with what you'd add in your first months." },
    { id: "culture", label: "Speaks their language", any: t.cultureKeywords.slice(0, 8), tip: `Use one of their values naturally: ${t.cultureKeywords.slice(0, 3).join(", ")}.`, weight: 0.5 },
  ],
  followUp: `Okay, but name one specific thing ${org(t)} has done recently that made you want this. Not the mission statement.`,
  model: `Two reasons. First, ${t.dna[0]?.replace(/\.$/, "").toLowerCase() ?? `how ${org(t)} works`}, and I've seen it in the details of how you publish and build. Second, it matches how I work: on ${STORY.project}, I ${STORY.win}, and I care more about knowing why something works than that it works. In the first months I'd want to own something small end to end and measure it properly.`,
});

const failure = (t: Target): Question => ({
  id: "failure",
  type: "behavioral",
  topic: "A real failure",
  prompt: "Tell me about a time something you built failed. What happened, and what did you change afterwards?",
  framework: "STAR",
  idealWords: [80, 200],
  rubric: [
    { id: "real", label: "A real failure you owned", any: ["failed", "broke", "didn't work", "did not work", "wrong", "mistake", "slipped", "crashed", "missed", "my fault", "i assumed"], tip: "Pick a real failure and own it. “I worked too hard” doesn't count.", mustHave: true },
    { id: "action", label: "What YOU did (“I”, not “we”)", any: [" i built", " i wrote", " i tested", " i measured", " i changed", " i rewrote", " i decided", " i debugged", " i fixed", " i redesigned", " i ran", " i went"], tip: "Say “I” and describe your specific actions.", mustHave: true },
    { id: "result", label: "A measurable result", any: ["#num", "half", "double", "percent", "faster", "reduced", "improved", "held"], tip: "Close with a number: what improved, and by how much." },
    { id: "lesson", label: "The lesson you kept", any: ["learned", "now i", "since then", "ever since", "lesson", "i always", "changed how", "takeaway"], tip: "End with what you do differently now. That's what they're really asking." },
  ],
  followUp: "What specifically do you do differently now because of that?",
  model: `On my robot gripper, ${STORY.failure}. That was my mistake: I'd been optimizing for the demo. I stopped, ${STORY.failureFix}. The lesson I kept is to write the test set before the design, and I've done that on every project since. ${t.kind === "LAB" || t.id.includes("anthropic") ? "It's the same instinct as writing the eval before training the model." : ""}`.trim(),
});

// ---------------- technical ----------------

const dbBatch = (_t: Target): Question => ({
  id: "db-batch",
  type: "technical",
  topic: "Running code against a production database",
  prompt: `Take a look at the code on screen. It scores every record in our Postgres database and works fine on a laptop. How would you run it against production, with ten million rows?`,
  code: {
    lang: "python",
    caption: "score_all.py",
    source: `import psycopg
from model import score

conn = psycopg.connect(PROD_DATABASE_URL)
rows = conn.execute("SELECT * FROM transcripts").fetchall()

for row in rows:
    s = score(row["text"])          # ~40 ms each
    conn.execute(
        "UPDATE transcripts SET score = %s WHERE id = %s",
        (s, row["id"]),
    )
    conn.commit()`,
  },
  framework: "TECH",
  idealWords: [90, 230],
  rubric: [
    { id: "memory", label: "Don't load 10M rows into memory", any: ["fetchall", "memory", "stream", "server-side cursor", "named cursor", "cursor", "chunk", "batch", "pagination", "paginate", "limit", "keyset", "iterate", "yield", "fetchmany"], tip: "fetchall() pulls 10M rows into RAM. Stream with a server-side cursor or page in chunks (keyset: WHERE id > last_id LIMIT 5000).", mustHave: true },
    { id: "protect", label: "Protect production", any: ["replica", "read replica", "staging", "off-peak", "off peak", "rate limit", "throttle", "load", "lock", "timeout", "statement_timeout", "copy of", "snapshot"], tip: "Read from a replica or snapshot, throttle writes, and set statement timeouts so the job can't take prod down.", mustHave: true },
    { id: "writes", label: "Batch the writes", any: ["batch update", "bulk", "executemany", "copy", "commit every", "one transaction", "fewer commits", "temp table", "update from", "batched"], tip: "Committing 10M single-row UPDATEs is slow and churns WAL. Batch them (executemany / UPDATE … FROM a temp table) and commit per chunk." },
    { id: "resume", label: "Restartable / idempotent", any: ["idempoten", "checkpoint", "resume", "retry", "restart", "crash", "where score is null", "where id >", "progress", "pick up"], tip: "Make it resumable: process WHERE score IS NULL or checkpoint the last id, so a crash at row 6M doesn't start over." },
    { id: "parallel", label: "Throughput (40 ms × 10M ≈ 4.6 days)", any: ["parallel", "workers", "multiprocess", "queue", "async", "concurren", "gpu", "batch inference", "days", "throughput", "#num"], tip: "Do the math: 40 ms × 10M is about 4.6 days on one worker. Batch inference or N parallel workers over id ranges." },
    { id: "verify", label: "Verify before and during", any: ["test", "sample", "subset", "dry run", "monitor", "log", "metric", "explain", "index", "spot check", "validate"], tip: "Dry-run on a 10k sample, check EXPLAIN and the index on id, and monitor progress, errors and DB load while it runs." },
  ],
  followUp: "Say this job crashes at row six million. What happens, and how would you design it so that's not a problem?",
  model: `First I'd clarify: is this a one-off backfill, and can we read from a replica? Then three changes. One, never fetchall ten million rows: stream with a server-side cursor, or page by primary key, WHERE id greater than the last id, five thousand at a time. Two, protect prod: read from a replica, batch the updates per chunk with executemany or an UPDATE FROM a temp table, commit per chunk, and set a statement timeout. Three, throughput: forty milliseconds times ten million is about four and a half days, so I'd batch the model calls and split id ranges across workers. I'd make it resumable by only processing rows where score is null, dry-run it on a ten-thousand-row sample first, and watch error rate and database load while it runs.`,
});

const controlLoop = (_t: Target): Question => ({
  id: "control-loop",
  type: "technical",
  topic: "Debugging a real-time control loop",
  prompt: `Here's a control loop on screen. It runs at one kilohertz and logs every sample to SQLite. On the real robot, the arm jitters. How do you find the cause, and how do you fix it?`,
  code: {
    lang: "python",
    caption: "control_loop.py",
    source: `db = sqlite3.connect("run.db")

while True:
    t0 = time.perf_counter()
    q = read_encoders()
    u = controller.step(q, target)
    send_torques(u)
    db.execute("INSERT INTO log VALUES (?,?,?)", (t0, q, u))
    db.commit()                      # every sample
    sleep_until(t0 + 0.001)          # 1 kHz`,
  },
  framework: "TECH",
  idealWords: [80, 220],
  rubric: [
    { id: "measure", label: "Measure before guessing", any: ["measure", "profile", "profil", "timestamp", "jitter", "histogram", "trace", "log the loop", "loop time", "period", "perf_counter", "oscilloscope", "#num"], tip: "Start by measuring loop period and its jitter (timestamps, histogram) before changing anything.", mustHave: true },
    { id: "cause", label: "Spot the blocking I/O", any: ["sqlite", "commit", "disk", "i/o", " io ", "blocking", "fsync", "write", "logging", "database"], tip: "db.commit() every sample forces a disk sync inside a 1 ms loop: that's your jitter.", mustHave: true },
    { id: "decouple", label: "Get I/O out of the loop", any: ["queue", "ring buffer", "buffer", "separate thread", "another thread", "background", "async", "batch", "in memory", "later", "process"], tip: "Push samples into a ring buffer/queue and write them from a background thread in batches." },
    { id: "rt", label: "Real-time hygiene", any: ["real-time", "realtime", "priority", "deadline", "garbage", " gc", "allocation", "python", "c++", "rt kernel", "preempt"], tip: "Bonus: mention GC/allocations, thread priority, or moving the inner loop to C++." },
    { id: "verify", label: "Verify the fix", any: ["before and after", "measure again", "re-measure", "benchmark", "test", "compare", "histogram"], tip: "Close the loop: re-measure jitter after the fix and show the before/after." },
  ],
  followUp: "Suppose removing the logging fixes it, but we still need every sample saved. How do you keep the data without hurting the loop?",
  model: `I'd measure first: timestamp every iteration and plot the loop-period histogram to see how bad the jitter is and whether it's periodic. Looking at the code, the likely cause is db.commit on every sample. That's a disk sync inside a one-millisecond budget. The fix is to keep I/O out of the control path: push samples into a ring buffer, and have a background thread write them to SQLite in batches every hundred milliseconds. I'd also watch for garbage-collection pauses, and if we still miss deadlines, move the inner loop to C++. Then I'd re-measure and show the before-and-after histogram. It's the same thing I did when I ${STORY.win}.`,
});

const overfit = (_t: Target): Question => ({
  id: "overfit",
  type: "technical",
  topic: "Train/validation gap",
  prompt: `Your model hits ninety-eight percent on training and seventy-one percent on validation. Walk me through exactly what you'd do.`,
  framework: "TECH",
  idealWords: [70, 200],
  rubric: [
    { id: "diagnose", label: "Name it: overfitting / variance", any: ["overfit", "variance", "memoriz", "generaliz", "gap"], tip: "Name it: a 27-point gap is high variance, i.e. overfitting.", mustHave: true },
    { id: "data", label: "Check the data first", any: ["leak", "split", "distribution", "shift", "duplicate", "label", "noise", "mismatch", "different"], tip: "Before touching the model, check the split: leakage, duplicates, and train/val distribution shift.", mustHave: true },
    { id: "fix", label: "Concrete fixes", any: ["regulariz", "dropout", "weight decay", "augment", "early stop", "smaller model", "simpler", "more data", "l2", "fewer parameters"], tip: "Offer fixes in order: more or augmented data, regularization (weight decay, dropout), early stopping, a smaller model." },
    { id: "eval", label: "Evaluate properly", any: ["cross-valid", "cross valid", "held-out", "held out", "test set", "seed", "ablation", "baseline", "learning curve", "one change at a time"], tip: "Change one thing at a time against a baseline, and use learning curves or cross-validation to confirm." },
  ],
  followUp: "Before you touch the model at all, what would you check about the data?",
  model: `A twenty-seven point gap says high variance, so overfitting, but I wouldn't touch the model yet. First I'd check the data: is there leakage or duplicates across the split, and do train and validation come from the same distribution? If the split is clean, I'd plot learning curves, then try fixes one at a time against a baseline: more or augmented data, weight decay and dropout, early stopping on validation loss, and a smaller model if needed. I'd keep a held-out test set untouched until the end so I'm not overfitting to validation too.`,
});

const metrics = (_t: Target): Question => ({
  id: "metrics",
  type: "technical",
  topic: "Traction & metrics",
  prompt: `Give me the one number that proves Area 94 is working. How do you measure it, and what's it going to be in six months?`,
  framework: "TECH",
  idealWords: [60, 170],
  rubric: [
    { id: "metric", label: "One clear metric", any: ["retention", "conversion", "weekly", "monthly", "active", "intro", "meeting", "repeat", "nps", "referral", "revenue", "members"], tip: "Pick ONE metric (e.g. intro-to-meeting conversion) and lead with it.", mustHave: true },
    { id: "number", label: "An actual number", any: ["#num"], tip: "Say the number out loud, even if it's small. Investors discount vagueness more than smallness.", mustHave: true },
    { id: "method", label: "How it's measured", any: ["track", "measure", "spreadsheet", "survey", "cohort", "data", "every week", "dashboard", "we count", "log"], tip: "Explain how you measure it so it's credible." },
    { id: "honest", label: "Honest about limits", any: ["early", "small", "noise", "not yet", "sample", "honest", "only", "so far"], tip: "Acknowledge the sample size; it builds trust." },
    { id: "plan", label: "Where it goes next", any: ["six months", "6 months", "next", "goal", "target", "by", "plan", "double", "grow"], tip: "End with the six-month target and what gets you there." },
  ],
  followUp: "What's the actual number today, even if it's small?",
  model: `The number I watch is ${STORY.communityMetric}. It's honest about whether the community creates real value, not just signups. It's still a small sample, so I look at it alongside repeat participation. In six months I want it higher on a bigger base, and the plan is to tighten intake so every intro has a clear reason to happen.`,
});

/** Questions for a target. focus: mixed alternates personal and technical. */
export function questionsFor(t: Target, focus: "mixed" | "personal" | "technical"): Question[] {
  const hardware = t.kind === "LAB" || /apple|robot|hardware|hybrid/i.test(`${t.id} ${t.name}`);
  const personal = [tenYears(t), whyUs(t), failure(t)];
  const technical =
    t.kind === "VC" ? [metrics(t), dbBatch(t)] : hardware ? [controlLoop(t), overfit(t), dbBatch(t)] : [dbBatch(t), overfit(t), controlLoop(t)];
  if (focus === "personal") return personal;
  if (focus === "technical") return technical;
  const out: Question[] = [];
  for (let i = 0; i < Math.max(personal.length, technical.length); i++) {
    if (personal[i]) out.push(personal[i]);
    if (technical[i]) out.push(technical[i]);
  }
  return out.slice(0, 5);
}
