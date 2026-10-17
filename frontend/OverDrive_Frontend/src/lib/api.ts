// Backend client for the FastAPI + MCP server. Every call has a short timeout and a rich local fallback,
// so the demo keeps working if the backend isn't up yet (or venue Wi-Fi dies).
import type { BlitzRow, Connections, DataSource, Target, VaultData } from "./types";
import { FALLBACK_TARGETS } from "../data/targets";
import { FALLBACK_VAULT } from "../data/vault";
import { makeBlitzRows } from "../data/blitz";

// "" = same origin, so calls go through the Vite /api proxy (no CORS). Set VITE_API_BASE=http://localhost:8000 to call directly.
export const API_BASE = (import.meta.env?.VITE_API_BASE ?? "").replace(/\/$/, "");

async function call<T>(path: string, init?: RequestInit, timeoutMs = 3500): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: ctl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) throw new Error(`${path} → not JSON (is the backend running?)`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/** Run `live`; on any failure return `fallback` and say so. */
async function withFallback<T>(live: () => Promise<T>, fallback: () => T, label: string): Promise<{ data: T; source: DataSource; error?: string }> {
  try {
    return { data: await live(), source: "live" };
  } catch (e) {
    const error = (e as Error).name === "AbortError" ? `${label}: timed out` : `${label}: ${(e as Error).message}`;
    console.info(`[overdrive] using local fallback — ${error}`);
    return { data: fallback(), source: "fallback", error };
  }
}

// ---------- normalizers: accept partial backend payloads, fill gaps from the fallback ----------

const arr = <T,>(v: unknown, d: T[] = []): T[] => (Array.isArray(v) ? (v as T[]) : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

function normalizeTarget(raw: Record<string, any>, i: number): Target {
  const fb = FALLBACK_TARGETS.find((t) => t.id === raw.id || t.name === raw.name || t.name === raw.targetName) ?? FALLBACK_TARGETS[i % FALLBACK_TARGETS.length];
  const kind = ["LAB", "COMPANY", "VC"].includes(raw.kind) ? raw.kind : fb.kind;
  const rawDna = Array.isArray(raw.dna)
    ? raw.dna
    : Array.isArray(raw.culturalDna)
      ? raw.culturalDna
      : Array.isArray(raw.culturalDna?.values)
        ? raw.culturalDna.values
        : fb.dna;

  const rawFilters = arr<any>(raw.secretFilters ?? raw.secretHiringFilters, fb.secretFilters);
  const secretFilters = rawFilters.map((f: any, idx: number) =>
    typeof f === "string"
      ? { signal: `Filter ${idx + 1}`, detail: f }
      : { signal: str(f?.signal, "Hiring Signal"), detail: str(f?.detail, "") },
  );

  const rawCv = arr<any>(raw.cv ?? raw.cvDiffs ?? raw.chameleonCvDiffs, fb.cv);
  const cv = rawCv.map((c: any, idx: number) => {
    const fbCv = fb.cv[idx % fb.cv.length];
    return {
      section: str(c?.section ?? c?.project, fbCv?.section ?? "Project"),
      original: str(c?.original, fbCv?.original ?? ""),
      tailored: str(c?.tailored ?? c?.morphed, fbCv?.tailored ?? ""),
      injected: arr<string>(c?.injected, fbCv?.injected ?? []),
      rationale: str(c?.rationale, fbCv?.rationale ?? ""),
    };
  });

  return {
    id: str(raw.id, `t-${i}`),
    name: str(raw.name ?? raw.targetName, fb.name),
    kind,
    role: str(raw.role, fb.role),
    tagline: str(raw.tagline ?? raw.cultureArchetype ?? raw.culturalDna?.archetype, fb.tagline),
    dna: rawDna,
    secretFilters,
    sources: arr(raw.sources, fb.sources),
    stack: arr<string>(raw.stack ?? raw.techStack ?? raw.culturalDna?.keywords, fb.stack),
    fitScore: num(raw.fitScore ?? raw.matchScore, fb.fitScore),
    persona: str(raw.persona, fb.persona),
    questions: arr<string>(raw.questions, fb.questions),
    cultureKeywords: arr<string>(raw.cultureKeywords, fb.cultureKeywords),
    techKeywords: arr<string>(raw.techKeywords, fb.techKeywords),
    cv,
    driveDoc: raw.driveDoc ?? fb.driveDoc,
  };
}

function normalizeBlitzRow(r: Record<string, any>, i: number): BlitzRow {
  const base = makeBlitzRows(1, i + 1)[0];
  const kind = ["PROFESSOR", "FOUNDER", "VC"].includes(r?.kind) ? r.kind : base.kind;
  const afterReply = num(r?.after?.reply ?? r?.readerReactionScore, base.after.reply);
  const beforeReply = num(r?.before?.reply, base.before.reply);
  return {
    ...base,
    ...r,
    id: str(r?.id, base.id),
    name: str(r?.name ?? r?.contactName, base.name),
    title: str(r?.title ?? r?.role, base.title),
    org: str(r?.org ?? r?.organization ?? r?.company, base.org),
    kind,
    hook: str(r?.hook ?? r?.tailoredHook, base.hook),
    persona: str(r?.persona ?? r?.toneBadge, base.persona),
    stage: ([0, 1, 2, 3, 4, 5].includes(r?.stage) ? r.stage : 5) as BlitzRow["stage"],
    before: {
      subject: str(r?.before?.subject, base.before.subject),
      body: str(r?.before?.body, base.before.body),
      reply: beforeReply,
      reaction: str(r?.before?.reaction, base.before.reaction),
    },
    after: {
      subject: str(r?.after?.subject, base.after.subject),
      body: str(r?.after?.body, base.after.body),
      reply: afterReply,
      reaction: str(r?.after?.reaction, base.after.reaction),
      fixes: arr<string>(r?.after?.fixes, base.after.fixes),
    },
    slots: arr<string>(r?.slots, base.slots),
  };
}

// ---------- endpoints ----------

export interface TargetsPayload {
  targets: Target[];
  blitz: BlitzRow[];
}

/** GET /api/targets → { targets: [...], blitz?: [...] } (a bare array of targets is accepted too). */
export function fetchTargets() {
  return withFallback<TargetsPayload>(
    async () => {
      const raw = await call<any>("/api/targets");
      const list = Array.isArray(raw) ? raw : arr(raw.targets);
      if (!list.length) throw new Error("/api/targets returned no targets");
      const rawBlitz = arr<any>(Array.isArray(raw) ? [] : raw.blitz ?? raw.blitzRows);
      const blitz = rawBlitz.length ? rawBlitz.map(normalizeBlitzRow) : makeBlitzRows(100);
      return { targets: list.map(normalizeTarget), blitz };
    },
    () => ({ targets: FALLBACK_TARGETS, blitz: makeBlitzRows(100) }),
    "GET /api/targets",
  );
}

/** POST /api/blitz { count, goal } → { rows: [...] } | [...]. Rows animate through the pipeline either way. */
export function triggerBlitz(count: number, goal: string) {
  return withFallback<BlitzRow[]>(
    async () => {
      const raw = await call<any>("/api/blitz", { method: "POST", body: JSON.stringify({ count, goal, careerGoal: goal }) }, 8000);
      const rows = Array.isArray(raw) ? raw : arr<any>(raw.rows ?? raw.blitz ?? raw.blitzRows);
      if (!rows.length) throw new Error("/api/blitz returned no rows");
      return rows.map((r, i) => ({ ...normalizeBlitzRow(r, i), stage: 0 as const }));
    },
    () => makeBlitzRows(count, Date.now() % 997),
    "POST /api/blitz",
  );
}

export interface BackendCoaching {
  score?: number; // 0-100
  strengths?: string[];
  improvements?: string[];
  betterAnswer?: string;
}

export interface VoiceReply {
  replyText: string;
  technicalScore: number;
  culturalFitScore: number;
  grammarlyClarityFeedback: string;
  coaching?: BackendCoaching;
}

/**
 * POST /api/voice-interview — contract from the team brief, plus optional coach fields.
 * mode "coach": send the current question + rubric; the backend may return `coaching` (score, strengths,
 * improvements, betterAnswer). mode "interview": replyText is the interviewer's next line. Caller supplies the fallback.
 */
export async function voiceInterview(body: {
  targetId: string;
  companyCulture: string;
  tailoredResume: string;
  conversationHistory: { role: string; content: string }[];
  userMessage: string;
  mode?: "coach" | "interview";
  question?: { id: string; type: string; prompt: string; code?: string; rubric: { label: string; mustHave?: boolean }[] };
}, timeoutMs = 12_000): Promise<VoiceReply> {
  const r = await call<Partial<VoiceReply>>("/api/voice-interview", { method: "POST", body: JSON.stringify(body) }, timeoutMs);
  if (!r.replyText && !r.coaching) throw new Error("voice-interview returned no replyText");
  const c = r.coaching && typeof r.coaching === "object" ? r.coaching : undefined;
  return {
    replyText: str(r.replyText),
    technicalScore: num(r.technicalScore, NaN),
    culturalFitScore: num(r.culturalFitScore, NaN),
    grammarlyClarityFeedback: str(r.grammarlyClarityFeedback),
    coaching: c && {
      score: num(c.score, NaN),
      strengths: arr<string>(c.strengths).filter((s) => typeof s === "string"),
      improvements: arr<string>(c.improvements).filter((s) => typeof s === "string"),
      betterAnswer: str(c.betterAnswer),
    },
  };
}

/** Optional: GET /api/vault → VaultData. Falls back to the bundled Personal_Context_Vault.md. */
export function fetchVault() {
  return withFallback<VaultData>(
    async () => {
      const r = await call<Partial<VaultData>>("/api/vault");
      if (!r.markdown) throw new Error("vault has no markdown");
      return { ...FALLBACK_VAULT, ...r } as VaultData;
    },
    () => FALLBACK_VAULT,
    "GET /api/vault",
  );
}

/** Optional: GET /api/status → { mcp, drive, gmail, calendar } booleans. */
export function fetchStatus() {
  return withFallback<Connections>(
    async () => {
      const r = await call<Partial<Connections>>("/api/status", undefined, 2500);
      return { mcp: true, drive: !!r.drive, gmail: !!r.gmail, calendar: !!r.calendar };
    },
    () => ({ mcp: false, drive: false, gmail: false, calendar: false }),
    "GET /api/status",
  );
}

/** Optional: POST /api/recon { goal } → kicks off Superhuman Go reconnaissance. */
export function launchRecon(goal: string) {
  return withFallback<{ ok: boolean }>(
    async () => call<{ ok: boolean }>("/api/recon", { method: "POST", body: JSON.stringify({ goal }) }, 6000),
    () => ({ ok: true }),
    "POST /api/recon",
  );
}
