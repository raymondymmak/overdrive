# OVERDRIVE · Command Center (Builder B)

Dark-mode React + Vite + Tailwind + Lucide front end for the Superhuman Go / Grammarly hackathon build. It talks to the FastAPI + MCP server on `:8000`, and **every call falls back to rich local data**, so the demo runs even with no backend and no Wi-Fi.

## Run it (2 minutes)
```bash
npm install
npm run dev            # → http://localhost:5173  (Vite proxies /api/* → http://localhost:8000, so no CORS setup)
```
Backend on another laptop? `VITE_BACKEND=http://192.168.1.20:8000 npm run dev`
Production-style: `npm run build && npm run preview` (port 4173, same proxy).
Tests: `npm test` (scorer, coach rubric, pipeline).

**Use Chrome or Edge on stage** (Web Speech API). Allow the mic the first time. Keys **1–4** switch views.

## The 4 views
| Key | View | What to show |
|---|---|---|
| 1 | **Personal Context Vault** | Connection status (MCP / Drive / Gmail / Calendar), the synced `Personal_Context_Vault.md`, the stack and CV highlights. Type a goal, then **Launch Overdrive Recon**; it auto-jumps to view 2. |
| 2 | **Cultural DNA & Chameleon CV** | 4 dossiers (Anthropic, Apple HW/Design, Berkeley Hybrid Robotics, Sequoia/YC seed). Each has its ethos, what they secretly filter for, stack and sources, plus a side-by-side CV diff with injected keywords, tone shifts and removed fluff highlighted, and an "Exported to Google Drive" badge. |
| 3 | **100x Multitask Blitz** | **⚡ Trigger** → 100 rows flow through *Scraping → Drive context → Reader Reactions → Calendar slots → Staged in Gmail*, with 24 agents in flight at once (~10 s). Click any row for the slide-over: the email, a Before (generic) / After Reader Reactions toggle, the persona verdict, and calendar slots. |
| 4 | **Voice Interview Coach** | **Spar Live** from any card or row. See *Voice coach* below. |

## Voice coach (view 4)
The interviewer plays the target's persona, has read your tailored CV, and asks **personal** questions (*Where do you see yourself in 10 years, and how does X fit?*, *Why us?*, *A real failure*) and **technical** ones with **code on screen** (*Here's a script that scores 10M rows in Postgres; how do you run it in production?*, *This 1 kHz control loop jitters; find and fix it*, *98% train vs 71% val*, and for investors, *the one metric that proves it's working*). The questions adapt to the target: labs and hardware get the control loop, VCs get metrics.

- **Coach mode** (default): answer out loud, and in under a second you get a score with Content / Structure / Delivery, a **"Fix this first"** callout, a rubric checklist (✓ with the words that earned it, ✗ with what to add), framework steps (STAR, Vision→Bridge→Proof, Clarify→Approach→Trade-offs→Verify), filler words, length and pace. The coach **says** the top fix aloud. Then **R** retry (shows ▲ +delta vs your last try), **M** hear a model answer, **N** next.
- **Interview mode:** realistic. If you miss a must-have point it asks a **follow-up** ("How does Anthropic *specifically* fit in?"), and your follow-up is judged together with the original answer. Feedback is held until the end.
- **Summary:** first-try → best-try per question, what to fix next time, and **Drill my weakest**.
- **Your stories** live in `STORY` at the top of `src/data/questions.ts`, and model answers are built from them. Edit them once before the demo.
- Scoring is instant and local (rubric keywords, structure cues, the filler/WPM scorer). If the backend returns `coaching`, the panel upgrades to **AI-refined** a moment later.

Fallback mode is labeled honestly: the API badge says **local fallback**, and Reader Reactions scores in the inspector say **simulated (demo data)** until the backend sends real ones. The 100 blitz people are invented on purpose, so the demo never attributes fake papers to real researchers.

## Backend contract (send this to Builder A)
All JSON. Only the first three are required; the rest light up extra status if present. Any missing field is filled from local data.

```text
GET  /api/targets
  → { "targets": [Target, ...], "blitz": [BlitzRow, ...] }     (a bare [Target] array also works)
  Target = { id, name, kind: "LAB"|"COMPANY"|"VC", role, tagline, dna: [str], secretFilters: [{signal, detail}],
             sources: [{label, kind: "interview"|"article"|"paper"|"careers"|"talk"}], stack: [str], fitScore: 0-100,
             persona, questions: [str], cultureKeywords: [str], techKeywords: [str],
             cv: [{section, original, tailored, injected: [str], rationale}],      # tailored: [[keyword]] {{tone shift}}; original: ~~removed~~
             driveDoc?: {name, url?, exportedAt} }

POST /api/blitz   { count, goal }
  → { "rows": [BlitzRow, ...] }
  BlitzRow = { id, name, title, org, kind: "PROFESSOR"|"FOUNDER"|"VC", hook, persona,
               before: {subject, body, reply, reaction},
               after:  {subject, body, reply, reaction, fixes: [str]},
               slots: [ISO datetime, ...] }

POST /api/voice-interview
  { targetId, companyCulture, tailoredResume, conversationHistory: [{role: "assistant"|"user", content}], userMessage,
    mode: "coach"|"interview",
    question: { id, type: "personal"|"behavioral"|"technical", prompt, code?, rubric: [{label, mustHave?}] } }
  → { replyText, technicalScore: 0-100, culturalFitScore: 0-100, grammarlyClarityFeedback,
      coaching?: { score: 0-100, strengths: [str], improvements: [str], betterAnswer: str } }   # optional, upgrades the panel
  (9 s timeout, called in the background; the instant local feedback never waits for it)
  Prompt tip for Gemini: "Grade userMessage as an answer to question.prompt against question.rubric. Return the 1-3 most
  important improvements as imperative sentences, and a betterAnswer under 120 words using only facts from tailoredResume."

optional:
GET  /api/vault   → { fileName, syncedAt, markdown, stack: [str], highlights: [str] }
GET  /api/status  → { drive: bool, gmail: bool, calendar: bool }
POST /api/recon   { goal } → { ok: true }
```
The UI polls `/api/targets` every 15 s, so dossiers that Superhuman Go writes appear without a reload.

## Before the demo
- Put your real resume lines in `src/data/vault.ts`, and the matching original bullets in `src/data/targets.ts` (`cv[].original`).
- Test the mic in the venue. If speech recognition errors out (it needs Google's speech service in Chrome), just type: scoring and the interviewer work the same way.
- Record a backup run of view 3 → 4 before 8:15.

## Files
`src/App.tsx` shell + nav · `src/views/*` the four views · `src/lib/api.ts` backend client + fallbacks · `src/lib/voice.ts` speech in/out + mic analyser · `src/lib/scoring.ts` clarity/filler/fit scorer · `src/lib/interviewer.ts` offline interviewer · `src/data/*` demo data.
