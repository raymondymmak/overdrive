import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, CheckCircle2, Copy, Loader2, Mail, Mic, Search, X, Zap } from "lucide-react";
import { Badge, Meter, Ring, SectionHead, SourceBadge, fmtSlot, toneFor } from "../components/ui";
import { triggerBlitz } from "../lib/api";
import { BLITZ_STAGES, type BlitzRow, type BlitzStage, type DataSource } from "../lib/types";

const KIND_LABEL = { PROFESSOR: "Professor", FOUNDER: "Founder", VC: "Investor" } as const;
const STAGE_TONE: Record<number, "mute" | "indigo" | "amber" | "emerald"> = { 0: "mute", 1: "indigo", 2: "indigo", 3: "amber", 4: "indigo", 5: "emerald" };

/**
 * Animate rows through the pipeline: up to `lanes` rows in flight at once (that's the "multitask" visual),
 * each stage taking a slightly random time. Pure function of the previous state, so it's easy to test.
 */
export function stepPipeline(rows: BlitzRow[], lanes: number, rand: () => number = Math.random): BlitzRow[] {
  let inFlight = rows.filter((r) => r.stage > 0 && r.stage < 5).length;
  return rows.map((r) => {
    if (r.stage === 5) return r;
    if (r.stage === 0) {
      if (inFlight < lanes && rand() < 0.5) {
        inFlight++;
        return { ...r, stage: 1 as BlitzStage };
      }
      return r;
    }
    if (rand() < 0.32) {
      const stage = (r.stage + 1) as BlitzStage;
      if (stage === 5) inFlight--;
      return { ...r, stage, gmailDraftId: stage === 5 ? `r-${r.id}` : r.gmailDraftId };
    }
    return r;
  });
}

export function BlitzView({ rows, setRows, goal, source, onSpar }: { rows: BlitzRow[]; setRows: (f: BlitzRow[] | ((r: BlitzRow[]) => BlitzRow[])) => void; goal: string; source: DataSource; onSpar: (r: BlitzRow) => void }) {
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [count, setCount] = useState(100);
  const [kind, setKind] = useState<"ALL" | BlitzRow["kind"]>("ALL");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [blitzSource, setBlitzSource] = useState<DataSource>(source);
  const [elapsed, setElapsed] = useState(0);
  const t0 = useRef(0);

  // Pipeline animation loop. The updater stays pure (StrictMode runs it twice with different random draws),
  // so completion is detected in a separate effect from the committed rows, not inside the updater.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRows((cur) => stepPipeline(cur, 24));
      setElapsed((performance.now() - t0.current) / 1000);
    }, 140);
    return () => clearInterval(id);
  }, [running, setRows]);

  useEffect(() => {
    if (running && rows.length && rows.every((r) => r.stage === 5)) setRunning(false);
  }, [rows, running]);

  async function launch() {
    setStarting(true);
    const r = await triggerBlitz(count, goal);
    setBlitzSource(r.source);
    setRows(r.data.map((x) => ({ ...x, stage: 0 as BlitzStage, gmailDraftId: undefined })));
    setOpenId(null);
    t0.current = performance.now();
    setElapsed(0);
    setStarting(false);
    setRunning(true);
  }

  const stats = useMemo(() => {
    const by = BLITZ_STAGES.map((_, i) => rows.filter((r) => r.stage === i).length);
    const staged = rows.filter((r) => r.stage === 5);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
    return {
      by,
      staged: staged.length,
      inFlight: rows.filter((r) => r.stage > 0 && r.stage < 5).length,
      before: avg(rows.map((r) => r.before.reply)),
      after: avg(staged.map((r) => r.after.reply)),
      slots: rows.filter((r) => r.stage >= 4).length * 3,
    };
  }, [rows]);

  const shown = rows.filter(
    (r) => (kind === "ALL" || r.kind === kind) && (!q || `${r.name} ${r.org} ${r.hook}`.toLowerCase().includes(q.toLowerCase())),
  );
  const open = rows.find((r) => r.id === openId) ?? null;
  const pct = rows.length ? Math.round((100 * stats.staged) / rows.length) : 0;
  const simulated = blitzSource !== "live";

  return (
    <div className="animate-fade-up">
      <SectionHead eyebrow="View 03 · Batch Outreach + Reader Reactions Gate" title="100x Multitask Blitz Matrix">
        <SourceBadge source={blitzSource} label="blitz" />
        <label className="sr-only" htmlFor="count">Rows</label>
        <select id="count" value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-10 rounded-lg border border-line bg-raised px-2 font-mono text-sm text-ink" disabled={running}>
          {[25, 50, 100, 150].map((n) => <option key={n} value={n}>{n} targets</option>)}
        </select>
        <button className="btn-primary h-10 px-4 shadow-[0_0_30px_-6px_rgba(99,102,241,.8)]" onClick={launch} disabled={running || starting}>
          {running || starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {starting ? "Spinning up agents…" : running ? `Blitzing · ${stats.inFlight} in flight` : "⚡ Trigger 100x Multitask Blitz"}
        </button>
      </SectionHead>

      {/* Telemetry strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { k: "Staged in Gmail", v: `${stats.staged}/${rows.length}`, tone: "text-emerald" },
          { k: "Agents in flight", v: String(stats.inFlight), tone: "text-indigo-soft" },
          { k: "Calendar slots injected", v: String(stats.slots), tone: "text-ink" },
          { k: "Reply prob · generic", v: `${stats.before}%`, tone: "text-rose" },
          { k: "Reply prob · after gate", v: stats.staged ? `${stats.after}%` : "—", tone: "text-emerald" },
        ].map((s) => (
          <div key={s.k} className="panel px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">{s.k}</div>
            <div className={`mt-0.5 font-mono text-xl font-semibold ${s.tone}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Stage funnel */}
      <div className="panel mb-4 p-4">
        <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-ink-dim">
          <span>PIPELINE · {pct}% complete{elapsed > 0 ? ` · ${elapsed.toFixed(1)}s` : ""}</span>
          {simulated && <span className="text-amber">demo data · simulated pipeline</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {BLITZ_STAGES.map((s, i) => (
            <div key={s} className={`rounded-lg border px-3 py-2 ${stats.by[i] && i > 0 && i < 5 ? "border-indigo/40 bg-indigo/[0.06]" : i === 5 && stats.by[i] ? "border-emerald/40 bg-emerald/[0.06]" : "border-line bg-raised"}`}>
              <div className="truncate font-mono text-[10px] uppercase tracking-wider text-ink-faint" title={s}>{String(i).padStart(2, "0")} {s}</div>
              <div className="font-mono text-lg font-semibold text-ink">{stats.by[i]}</div>
            </div>
          ))}
        </div>
        <div className="mt-3"><Meter value={pct} tone="emerald" /></div>
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-line bg-raised px-3 sm:max-w-xs">
          <Search className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
          <label htmlFor="q" className="sr-only">Search</label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, org, hook…" className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none" />
        </div>
        {(["ALL", "PROFESSOR", "FOUNDER", "VC"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-lg px-3 py-1.5 font-mono text-xs ${kind === k ? "bg-indigo/15 text-ink ring-1 ring-indigo/40" : "text-ink-dim hover:text-ink"}`}>
            {k === "ALL" ? `All ${rows.length}` : `${KIND_LABEL[k]}s ${rows.filter((r) => r.kind === k).length}`}
          </button>
        ))}
      </div>

      {/* Matrix */}
      <div className="panel overflow-hidden">
        <div className="max-h-[620px] overflow-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-raised font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              <tr>
                <th className="px-4 py-2.5 font-medium">Target</th>
                <th className="px-3 py-2.5 font-medium">Lab / firm</th>
                <th className="px-3 py-2.5 font-medium">Cultural hook</th>
                <th className="px-3 py-2.5 font-medium">Reader Reactions</th>
                <th className="px-3 py-2.5 font-medium">Slots</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => {
                const audited = r.stage >= 3;
                const score = r.stage >= 4 ? r.after.reply : r.before.reply;
                return (
                  <tr key={r.id} onClick={() => setOpenId(r.id)} className={`cursor-pointer transition-colors hover:bg-raised ${openId === r.id ? "bg-indigo/[0.07]" : ""} ${r.stage > 0 && r.stage < 5 ? "bg-indigo/[0.03]" : ""}`}>
                    <td className="px-4 py-2.5">
                      <button className="text-left font-medium text-ink hover:text-indigo-soft" onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }}>{r.name}</button>
                      <div className="font-mono text-[10px] text-ink-faint">{KIND_LABEL[r.kind]} · {r.title}</div>
                    </td>
                    <td className="px-3 py-2.5 text-ink-dim">{r.org}</td>
                    <td className="max-w-[260px] truncate px-3 py-2.5 text-ink-dim" title={r.hook}>{r.hook}</td>
                    <td className="px-3 py-2.5">
                      {audited ? <Badge tone={toneFor(score)}>{score}% reply</Badge> : <span className="font-mono text-[11px] text-ink-faint">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.stage >= 4 ? <Badge tone="indigo"><CalendarClock className="h-3 w-3" aria-hidden />{r.slots.length}</Badge> : <span className="font-mono text-[11px] text-ink-faint">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={STAGE_TONE[r.stage]}>
                        {r.stage === 5 ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : r.stage > 0 ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
                        {BLITZ_STAGES[r.stage]}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-dim">No rows match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {open && <Inspector row={open} simulated={simulated} onClose={() => setOpenId(null)} onSpar={() => onSpar(open)} />}
    </div>
  );
}

function Inspector({ row, simulated, onClose, onSpar }: { row: BlitzRow; simulated: boolean; onClose: () => void; onSpar: () => void }) {
  const [after, setAfter] = useState(true);
  const [copied, setCopied] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const v = after ? row.after : row.before;

  useEffect(() => {
    setAfter(true);
    panel.current?.focus();
  }, [row.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${v.subject}\n\n${v.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`Inspector: ${row.name}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={panel} tabIndex={-1} className="absolute right-0 top-0 flex h-full w-full max-w-xl animate-slide-in flex-col border-l border-line bg-panel shadow-2xl focus:outline-none">
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-indigo-soft">{KIND_LABEL[row.kind]} · {BLITZ_STAGES[row.stage]}</div>
            <div className="mt-0.5 text-lg font-semibold text-ink">{row.name}</div>
            <div className="text-sm text-ink-dim">{row.title} · {row.org}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-dim hover:bg-raised hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Reader Reactions scorecard */}
          <div className="rounded-xl border border-line bg-raised p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">Grammarly Reader Reactions</div>
              <div className="flex rounded-lg border border-line bg-obsidian-900 p-0.5 font-mono text-[11px]" role="tablist">
                <button role="tab" aria-selected={!after} onClick={() => setAfter(false)} className={`rounded-md px-2.5 py-1 ${!after ? "bg-rose/15 text-rose" : "text-ink-dim"}`}>Before · generic {row.before.reply}%</button>
                <button role="tab" aria-selected={after} onClick={() => setAfter(true)} className={`rounded-md px-2.5 py-1 ${after ? "bg-emerald/15 text-emerald-soft" : "text-ink-dim"}`}>After · {row.after.reply}%</button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Ring value={v.reply} size={72} label="reply %" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-ink">{row.persona} persona</div>
                <p className="mt-1 text-sm text-ink-dim">{v.reaction}</p>
              </div>
            </div>
            {after && (
              <ul className="mt-3 space-y-1">
                {row.after.fixes.map((f) => (
                  <li key={f} className="flex gap-2 text-xs text-ink-dim"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald" aria-hidden />{f}</li>
                ))}
              </ul>
            )}
            {simulated && <div className="mt-3 font-mono text-[10px] text-amber">Simulated score (demo data). Live scores come from the Reader Reactions agent in Superhuman Go.</div>}
          </div>

          {/* Email */}
          <div className={`rounded-xl border p-4 ${after ? "border-indigo/40 bg-indigo/[0.05]" : "border-rose/30 bg-rose/[0.04]"}`}>
            <div className="mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4 text-ink-dim" aria-hidden />
              <div className="min-w-0 flex-1 truncate text-sm"><span className="text-ink-faint">Subject:</span> <span className="font-medium text-ink">{v.subject}</span></div>
              <button onClick={copy} className="rounded-md p-1 text-ink-dim hover:text-ink" aria-label="Copy email">{copied ? <Check className="h-4 w-4 text-emerald" /> : <Copy className="h-4 w-4" />}</button>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-dim">{v.body}</div>
            {after && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {row.slots.map((s) => <Badge key={s} tone="indigo"><CalendarClock className="h-3 w-3" aria-hidden />{fmtSlot(s)}</Badge>)}
              </div>
            )}
          </div>

          {/* Calendar */}
          <div className="rounded-xl border border-line bg-raised p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim"><CalendarClock className="h-3.5 w-3.5" aria-hidden /> Google Calendar · free 20-min slots</div>
            <ul className="space-y-1.5">
              {row.slots.map((s) => (
                <li key={s} className="flex items-center justify-between rounded-lg border border-line bg-obsidian-900 px-3 py-2 text-sm">
                  <span className="text-ink">{fmtSlot(s)}</span>
                  <span className="font-mono text-[10px] text-emerald-soft">FREE</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex gap-2 border-t border-line p-4">
          <div className="flex flex-1 items-center gap-2 font-mono text-[11px] text-ink-faint">
            {row.stage === 5 ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald" aria-hidden /> Staged in Gmail Drafts</> : row.stage > 0 ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> {BLITZ_STAGES[row.stage]}…</> : "Queued"}
          </div>
          <button className="btn-emerald" onClick={onSpar}><Mic className="h-4 w-4" aria-hidden /> Spar Live</button>
        </div>
      </div>
    </div>
  );
}
