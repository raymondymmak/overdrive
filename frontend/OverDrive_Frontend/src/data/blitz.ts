import type { BlitzRow } from "../lib/types";

// Synthetic demo roster: invented people and organizations, so the stage demo never attributes made-up papers
// to real researchers. The live roster comes from Superhuman Go via GET /api/targets or POST /api/blitz.

/** Small deterministic PRNG (mulberry32), so the same seed gives the same roster on every reload. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Maya", "Arjun", "Lena", "Diego", "Priya", "Kenji", "Sofia", "Omar", "Hana", "Lucas", "Amara", "Wei", "Elena", "Tomás", "Noor", "Isaac", "Yuna", "Ravi", "Clara", "Mateo", "Ines", "Felix", "Zara", "Jonah", "Mei", "Aiden", "Leila", "Ruben", "Saanvi", "Theo"];
const LAST = ["Okafor", "Lindqvist", "Ramanathan", "Castillo", "Nakamura", "Haddad", "Brennan", "Kowalski", "Achebe", "Varga", "Moreau", "Tanaka", "Iyer", "Fischer", "Osei", "Duarte", "Kim", "Petrov", "Alvarez", "Chen", "Sato", "Mensah", "Novak", "Rossi", "Ward", "Bianchi", "Park", "Grant", "Abbasi", "Holm"];

const LABS = ["Northbridge Embodied AI Lab", "Cascade Legged Robotics Group", "Meridian Manipulation Lab", "Halcyon Human-Robot Interaction Lab", "Lumen Robot Learning Lab", "Ridgeway Soft Robotics Lab", "Tidewater Perception & Control Lab", "Arclight Autonomous Systems Lab"];
const LAB_TOPICS = ["sim-to-real transfer for dexterous hands", "latency-aware whole-body control", "tactile sensing for in-hand manipulation", "safe reinforcement learning on quadrupeds", "vision-language-action policies for household tasks", "compliant actuators for contact-rich tasks", "state estimation under sensor dropout", "learning from human video for manipulation"];

const STARTUPS = ["Kestrel Robotics", "Forge Dynamics", "Tessellate AI", "Brightloop Hardware", "Aperture Motion", "Quarry Labs", "Halyard Autonomy", "Ember Actuation", "Nimbus Embodied", "Ostrich Systems"];
const STARTUP_THESES = ["general-purpose warehouse manipulation", "low-cost humanoid hands", "on-device VLA models for mobile robots", "teleop data collection at scale", "robot foundation models for kitchens", "precision actuators that cost 10× less", "safety layers for learned controllers"];

const FUNDS = ["Granite Peak Ventures", "Lowtide Capital", "Second Order Partners", "Cinder Seed Fund", "Harbor Lane Ventures", "Northstar Pre-Seed", "Fieldwork Capital"];
const FUND_THESES = ["vertical AI with proprietary data loops", "physical AI and robotics infrastructure", "student founders building community-led networks", "developer tools for AI agents", "hard-tech at pre-seed"];

const PERSONAS = {
  PROFESSOR: ["Harried tenured professor", "Early-career PI building a lab", "Lab manager screening undergrads"],
  FOUNDER: ["Heads-down technical founder", "Second-time founder who hires fast", "Founder/CEO doing her own recruiting"],
  VC: ["Seed partner with 400 unread emails", "Scout who backs student founders", "Principal sourcing hard-tech deals"],
} as const;

const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];

/** Next `n` weekday coffee-chat slots (10:30, 14:00, 16:30 local) starting tomorrow, one per day. */
export function nextSlots(n = 3, from = new Date(), offset = 0) {
  const hours = [[10, 30], [14, 0], [16, 30]];
  const out: string[] = [];
  const d = new Date(from);
  d.setDate(d.getDate() + 1 + (offset % 2));
  while (out.length < n) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) {
      const [h, m] = hours[(out.length + offset) % hours.length];
      const s = new Date(d);
      s.setHours(h, m, 0, 0);
      out.push(s.toISOString());
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function makeBlitzRows(count: number, seed = 42): BlitzRow[] {
  const r = rng(seed);
  const rows: BlitzRow[] = [];
  for (let i = 0; i < count; i++) {
    const roll = r();
    const kind: BlitzRow["kind"] = roll < 0.45 ? "PROFESSOR" : roll < 0.78 ? "FOUNDER" : "VC";
    const first = pick(r, FIRST);
    const last = pick(r, LAST);
    const name = kind === "PROFESSOR" ? `Prof. ${first} ${last}` : `${first} ${last}`;
    const persona = pick(r, PERSONAS[kind]);
    const year = 2025 + Math.floor(r() * 2);

    let org: string, title: string, hook: string, ask: string, proof: string, subject: string;
    if (kind === "PROFESSOR") {
      org = pick(r, LABS);
      const topic = pick(r, LAB_TOPICS);
      title = pick(r, ["Associate Professor", "Assistant Professor", "Professor"]);
      hook = `${year} paper on ${topic}`;
      subject = `Your ${topic.split(" ").slice(0, 3).join(" ")} paper`;
      proof = "I built a MediaPipe → C++ teleop arm and cut its input-to-actuation latency in half by profiling the whole loop";
      ask = "Would you be open to a 20-minute chat about undergrad research in your lab this summer?";
    } else if (kind === "FOUNDER") {
      org = pick(r, STARTUPS);
      const thesis = pick(r, STARTUP_THESES);
      title = pick(r, ["Co-founder & CEO", "Co-founder & CTO", "Founder"]);
      hook = `thesis: ${thesis}`;
      subject = `${org.split(" ")[0]} + ${thesis.split(" ").slice(-2).join(" ")}`;
      proof = "I've shipped hardware-in-the-loop robotics projects in C++ and PyTorch, and I move fast";
      ask = "Could we grab 20 minutes to talk about a summer internship?";
    } else {
      org = pick(r, FUNDS);
      const thesis = pick(r, FUND_THESES);
      title = pick(r, ["Partner", "Principal", "Scout"]);
      hook = `investment thesis: ${thesis}`;
      subject = `Area 94: warm intros for Bay Area founders`;
      proof = "I run Area 94, a vetted community that gets Bay Area founders warm investor intros, and we track intro-to-meeting conversion weekly";
      ask = "Would you be up for a 20-minute coffee chat in the next two weeks?";
    }

    const firstName = name.replace(/^Prof\. /, "").split(" ")[0];
    const greet = kind === "PROFESSOR" ? `Dear Prof. ${last},` : `Hi ${firstName},`;
    const opener =
      kind === "PROFESSOR"
        ? `Your ${hook} reframed how I debug my own robot: I'd been blaming the policy when the real problem was the timing loop.`
        : kind === "FOUNDER"
          ? `${org}'s bet on ${hook.replace("thesis: ", "")} is exactly the problem I keep running into on real hardware.`
          : `Your ${hook.replace("investment thesis: ", "focus on ")} is why I'm writing to you rather than a generalist fund.`;

    const afterBody = `${greet}\n\n${opener} I'm a UC Berkeley Stats + CS freshman; ${proof}. ${ask} I've put a few times below that are open on my calendar.\n\nBest,\n— sent from OVERDRIVE`;
    const beforeBody = `${greet}\n\nI hope this email finds you well! My name is [Your Name] and I am a student at UC Berkeley who is extremely passionate about AI and robotics. I came across your work and found it very interesting. I would love to pick your brain and learn more about any opportunities you may have. Please let me know if you have any time to chat!\n\nThank you so much for your time and consideration!`;

    const beforeReply = Math.round(28 + r() * 22);
    const afterReply = Math.round(84 + r() * 13);
    rows.push({
      id: `b${seed}-${i}`,
      name,
      title,
      org,
      kind,
      hook,
      persona,
      stage: 0,
      before: {
        subject: "Opportunity inquiry",
        body: beforeBody,
        reply: beforeReply,
        reaction: `${persona}: "Generic. No sign they've read my work. Archive." Fluff detected in 4 of 5 sentences; ask is vague.`,
      },
      after: {
        subject,
        body: afterBody,
        reply: afterReply,
        reaction: `${persona}: ${afterReply}% reply probability. Concrete technical hook on line 1, one proof point, one small ask, zero fluff.`,
        fixes: [
          "Cut \"I hope this email finds you well\" and 3 other filler phrases",
          `Opened with their ${kind === "PROFESSOR" ? "paper" : kind === "FOUNDER" ? "company thesis" : "fund thesis"} instead of your name`,
          "Replaced \"passionate about AI\" with one measurable proof point",
          "Turned \"any opportunities\" into one specific 20-minute ask",
        ],
      },
      slots: nextSlots(3, new Date(), i),
    });
  }
  return rows;
}
