import type { VaultData } from "../lib/types";

// Demo copy of Personal_Context_Vault.md. The live version comes from Google Drive via GET /api/vault.
// ✏️ Replace the bullets below with your real resume lines before the demo.
export const FALLBACK_VAULT: VaultData = {
  fileName: "Personal_Context_Vault.md",
  syncedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  stack: ["Python", "C++", "PyTorch", "MediaPipe", "SOLIDWORKS", "CAD", "Robotics", "ROS", "OpenCV", "Statistics"],
  highlights: [
    "UC Berkeley · Statistics (math cluster) + CS minor",
    "Founder, Area 94 — private community connecting Bay Area founders & investors",
    "Built a real-time hand-tracking robot-arm teleop with MediaPipe + C++",
    "Designed a 3-DOF gripper in SOLIDWORKS, printed and iterated 6 revisions",
  ],
  markdown: `# Personal Context Vault
_Synced from Google Drive by Superhuman Go · the agent reads this before every dossier, CV and email._

## Who I am
- Freshman at **UC Berkeley**, Statistics (mathematics cluster) + CS minor. From Hong Kong.
- Founder of **Area 94**, a private community connecting Bay Area founders and investors.
- I lean toward the **mathematical side of ML** (probability, optimization) more than pure engineering.

## Master CV highlights
- Built a real-time hand-tracking teleoperation system for a 5-DOF robot arm using **MediaPipe** (Python) and a **C++** control loop.
- Designed a 3-DOF compliant gripper in **SOLIDWORKS**; 6 print–test revisions to fix slip on smooth objects.
- Trained a small **PyTorch** policy in simulation to stabilize a balancing robot; documented sim-to-real gaps.
- Grew Area 94 from zero to a vetted founder/investor community; ran the events and the intake process.

## Technical stack
Python · C++ · PyTorch · MediaPipe · OpenCV · ROS · SOLIDWORKS · CAD · Robotics · Statistics / probability

## Onboarding answers (deep context)
**What problem do you want to spend your 20s on?**
Making embodied AI reliable enough to leave the lab — robots that work on the 1,000th try, not just the demo.

**A moment you're proud of that isn't on your resume?**
Debugging the teleop arm at 2am: the lag wasn't the model, it was a USB polling interval. Measured it, fixed it, latency dropped by half.

**How do you want to come across in emails?**
Direct and specific. No "I hope this finds you well." Lead with their work, one proof point, one small ask.

**Hard constraints**
Summer 2027 availability; Bay Area preferred; open to remote research.

## Targets this season
Robotics & embodied-AI research labs · seed-stage AI hardware startups · frontier-AI internships · seed funding for Area 94
`,
};
