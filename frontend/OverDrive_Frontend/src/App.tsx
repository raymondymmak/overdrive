import { useCallback, useEffect, useState } from "react";
import { Brain, Database, Mic, Zap } from "lucide-react";
import { fetchTargets } from "./lib/api";
import type { BlitzRow, DataSource, Target } from "./lib/types";
import { FALLBACK_TARGETS } from "./data/targets";
import { makeBlitzRows } from "./data/blitz";
import { SourceBadge } from "./components/ui";
import { VaultView } from "./views/Vault";
import { DnaView } from "./views/Dna";
import { BlitzView } from "./views/Blitz";
import { ArenaView } from "./views/Arena";

type View = "vault" | "dna" | "blitz" | "arena";
const VIEWS: { id: View; label: string; short: string; icon: typeof Brain }[] = [
  { id: "vault", label: "Context Vault", short: "Vault", icon: Database },
  { id: "dna", label: "Cultural DNA & CV", short: "DNA", icon: Brain },
  { id: "blitz", label: "100x Blitz", short: "Blitz", icon: Zap },
  { id: "arena", label: "Voice Sparring", short: "Spar", icon: Mic },
];

/** A blitz row (a person) sparred with: borrow the closest dossier's culture, swap in the person's persona. */
export function targetForRow(row: BlitzRow, targets: Target[]): Target {
  const kind = row.kind === "PROFESSOR" ? "LAB" : row.kind === "VC" ? "VC" : "COMPANY";
  const base = targets.find((t) => t.kind === kind) ?? targets[0];
  return {
    ...base,
    id: `row-${row.id}`,
    name: row.org,
    role: base.role,
    persona: `${row.persona} — ${row.name}, ${row.title} at ${row.org}. Cares about: ${row.hook}.`,
    questions: [
      row.kind === "PROFESSOR"
        ? `You emailed me about my ${row.hook}. What specifically in it connects to work you've done?`
        : row.kind === "FOUNDER"
          ? `We're betting on ${row.hook.replace("thesis: ", "")}. Why should we bring you on this summer?`
          : `You pitched me on Area 94. Given our ${row.hook.replace("investment thesis: ", "focus on ")}, why is this a fit?`,
      ...base.questions.slice(1),
    ],
  };
}

export default function App() {
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem("od.view") as View) || "vault";
    } catch {
      return "vault";
    }
  });
  const [targets, setTargets] = useState<Target[]>(FALLBACK_TARGETS);
  const [blitz, setBlitz] = useState<BlitzRow[]>(() => makeBlitzRows(100));
  const [source, setSource] = useState<DataSource>("fallback");
  const [goal, setGoal] = useState("Target: Summer Robotics & Embodied AI Research Labs + Seed AI Hardware Startups + Frontier AI Internships");
  const [sparTarget, setSparTarget] = useState<Target>(FALLBACK_TARGETS[0]);

  const go = useCallback((v: View) => {
    setView(v);
    try {
      localStorage.setItem("od.view", v);
    } catch {
      /* private mode */
    }
    window.scrollTo({ top: 0 });
  }, []);

  const load = useCallback(async () => {
    const r = await fetchTargets();
    setTargets(r.data.targets);
    setSource(r.source);
    if (r.source === "live") setBlitz(r.data.blitz);
    // Refresh the sparring target's data in place; never swap it out (that would reset a live interview).
    // Targets built from blitz rows ("row-…") aren't in the dossier list, so they're kept as-is.
    setSparTarget((cur) => r.data.targets.find((t) => t.id === cur.id) ?? cur);
  }, []);

  // Poll the backend so dossiers Superhuman Go writes appear without a reload.
  useEffect(() => {
    load();
    const t = setInterval(load, 4_000);
    return () => clearInterval(t);
  }, [load]);

  // Keyboard: 1–4 switch views (handy on stage). Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < VIEWS.length) go(VIEWS[i].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const spar = (t: Target) => {
    setSparTarget(t);
    go("arena");
  };

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-line bg-obsidian/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo shadow-[0_0_24px_rgba(99,102,241,.45)]">
              <Zap className="h-4 w-4 text-white" aria-hidden />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-[0.2em] text-ink">OVERDRIVE</div>
              <div className="hidden font-mono text-[10px] text-ink-faint sm:block">career · research · outreach autopilot</div>
            </div>
          </div>
          <nav className="ml-auto flex items-center gap-1 overflow-x-auto" aria-label="Views">
            {VIEWS.map((v, i) => {
              const Icon = v.icon;
              const on = view === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => go(v.id)}
                  aria-current={on ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${on ? "bg-indigo/15 text-ink ring-1 ring-indigo/40" : "text-ink-dim hover:bg-raised hover:text-ink"}`}
                  title={`${v.label} (${i + 1})`}
                >
                  <Icon className={`h-4 w-4 ${on ? "text-indigo-soft" : ""}`} aria-hidden />
                  <span className="hidden md:inline">{v.label}</span>
                  <span className="md:hidden">{v.short}</span>
                </button>
              );
            })}
          </nav>
          <div className="hidden lg:block">
            <SourceBadge source={source} label="api" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {view === "vault" && <VaultView goal={goal} setGoal={setGoal} apiSource={source} onReconDone={() => { load(); go("dna"); }} />}
        {view === "dna" && <DnaView targets={targets} source={source} onSpar={spar} />}
        {view === "blitz" && <BlitzView rows={blitz} setRows={setBlitz} goal={goal} source={source} onSpar={(row) => spar(targetForRow(row, targets))} />}
        {view === "arena" && <ArenaView targets={targets} target={sparTarget} setTarget={setSparTarget} />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 font-mono text-[11px] text-ink-faint sm:px-6">
        Superhuman Go agents + Grammarly Reader Reactions → FastAPI/MCP :8000 → OVERDRIVE · press 1–4 to switch views
      </footer>
    </div>
  );
}
