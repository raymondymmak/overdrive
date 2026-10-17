// Shared shapes for the frontend <-> FastAPI contract (http://localhost:8000).
// Backend responses are normalized in lib/api.ts, so partial payloads still render.

export type TargetKind = "LAB" | "COMPANY" | "VC";

export interface CvDiff {
  section: string; // "Experience · Area 94"
  original: string; // master resume bullet, verbatim
  tailored: string; // tailored bullet; wrap injected keywords in [[double brackets]] and tone shifts in {{braces}}
  injected: string[]; // keywords added for this target
  rationale: string; // why this angle lands with this target's culture
}

export interface Target {
  id: string;
  name: string;
  kind: TargetKind;
  role: string; // role / program / fund focus
  tagline: string; // one-line cultural DNA, e.g. "Empirical AI safety"
  dna: string[]; // extracted cultural DNA & ethos
  secretFilters: { signal: string; detail: string }[]; // what they quietly screen for
  sources: { label: string; kind: "interview" | "article" | "paper" | "careers" | "talk" }[];
  stack: string[];
  fitScore: number; // 0-100
  persona: string; // interviewer persona for the sparring arena
  questions: string[]; // seed questions for that persona
  cultureKeywords: string[]; // words that signal cultural fit in spoken answers
  techKeywords: string[]; // words that signal technical depth
  cv: CvDiff[];
  driveDoc?: { name: string; url?: string; exportedAt: string };
}

export type BlitzStage = 0 | 1 | 2 | 3 | 4 | 5; // 0 queued … 5 staged
export const BLITZ_STAGES = [
  "Queued",
  "Scraping Paper/Bio",
  "Matching Drive Context",
  "Grammarly Reader Reactions Audit",
  "Injecting Calendar Slots",
  "Staged in Gmail Drafts",
] as const;

export interface BlitzRow {
  id: string;
  name: string;
  title: string;
  org: string;
  kind: "PROFESSOR" | "FOUNDER" | "VC";
  hook: string; // the specific paper / thesis / launch the email opens with
  persona: string; // reader persona used by the Reader Reactions audit
  stage: BlitzStage;
  before: { subject: string; body: string; reply: number; reaction: string };
  after: { subject: string; body: string; reply: number; reaction: string; fixes: string[] };
  slots: string[]; // ISO start times from Google Calendar free/busy
  gmailDraftId?: string;
}

export interface VaultData {
  fileName: string;
  syncedAt: string;
  markdown: string;
  stack: string[];
  highlights: string[];
}

export interface Connections {
  mcp: boolean;
  drive: boolean;
  gmail: boolean;
  calendar: boolean;
}

export interface Turn {
  role: "interviewer" | "candidate";
  text: string;
  at: number;
  telemetry?: AnswerTelemetry;
}

export interface AnswerTelemetry {
  clarity: number; // 0-100
  culturalFit: number; // 0-100
  technical: number; // 0-100
  fillerCount: number;
  fillers: string[];
  wpm: number | null;
  words: number;
  feedback: string;
  source: "backend" | "local";
}

export type DataSource = "live" | "fallback";
