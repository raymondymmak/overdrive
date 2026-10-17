import { useEffect, useRef, useState } from "react";
import { Calendar, CheckCircle2, Cpu, FileText, HardDrive, Loader2, Mail, Radar, Rocket, Sparkles } from "lucide-react";
import { Badge, Dot, MiniMarkdown, SectionHead, SourceBadge } from "../components/ui";
import { fetchStatus, fetchVault, launchRecon } from "../lib/api";
import type { Connections, DataSource, VaultData } from "../lib/types";

const RECON_STEPS = [
  "Superhuman Go: reading Personal_Context_Vault.md + Master_Resume from Drive",
  "Parsing goal into target classes: labs · seed startups · frontier AI · investors",
  "Scanning open tabs + Parallel Web Search for matching labs, startups and funds",
  "Pulling employee interviews, papers and articles for Cultural DNA extraction",
  "Scoring fit against your stack and stories",
  "Dossiers ready: 4 deep targets + 100 outreach candidates",
];

export function VaultView({ goal, setGoal, onReconDone, apiSource }: { goal: string; setGoal: (g: string) => void; onReconDone: () => void; apiSource: DataSource }) {
  const [vault, setVault] = useState<VaultData | null>(null);
  const [vaultSource, setVaultSource] = useState<DataSource>("fallback");
  const [conn, setConn] = useState<Connections | null>(null);
  const [connSource, setConnSource] = useState<DataSource>("fallback");
  const [step, setStep] = useState(-1);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    fetchVault().then((r) => {
      setVault(r.data);
      setVaultSource(r.source);
    });
    fetchStatus().then((r) => {
      setConn(r.data);
      setConnSource(r.source);
    });
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const running = step >= 0 && step < RECON_STEPS.length;

  async function recon() {
    if (!goal.trim() || running) return;
    setStep(0);
    launchRecon(goal); // fire-and-forget; the visual log runs either way
    RECON_STEPS.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setStep(i + 1), 650 * (i + 1)));
    });
    timers.current.push(window.setTimeout(onReconDone, 650 * RECON_STEPS.length + 700));
  }

  // Without GET /api/status we can't verify the Google connectors, so they show as "managed by Superhuman Go" (indigo), not green.
  const known = connSource === "live";
  const st = (v?: boolean) => (known ? (v ? "on" : "off") : "managed") as "on" | "off" | "managed";
  const rows = [
    { key: "mcp", label: "Superhuman Go MCP", detail: apiSource === "live" ? "localhost:8000 · connected" : "localhost:8000 · offline → local data", icon: Cpu, state: (apiSource === "live" ? "on" : "off") as "on" | "off" },
    { key: "drive", label: "Google Drive", detail: known ? "Master_Resume · Personal_Context_Vault" : "connector in Superhuman Go", icon: HardDrive, state: st(conn?.drive) },
    { key: "gmail", label: "Gmail", detail: known ? "draft staging enabled" : "connector in Superhuman Go", icon: Mail, state: st(conn?.gmail) },
    { key: "calendar", label: "Google Calendar", detail: known ? "free/busy for coffee chats" : "connector in Superhuman Go", icon: Calendar, state: st(conn?.calendar) },
  ];

  return (
    <div className="animate-fade-up">
      <SectionHead eyebrow="View 01 · Setup & Soul Sync" title="Personal Context Vault">
        <SourceBadge source={vaultSource} label="vault" />
      </SectionHead>

      {/* Career goal bar */}
      <form
        className="panel mb-6 flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          recon();
        }}
      >
        <div className="flex flex-1 items-center gap-3 rounded-lg border border-line bg-obsidian-900 px-3 focus-within:border-indigo/60">
          <Radar className="h-4 w-4 shrink-0 text-indigo-soft" aria-hidden />
          <label htmlFor="goal" className="sr-only">Career goal</label>
          <input
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Target: Summer Robotics & Embodied AI Research Labs + Seed AI Hardware Startups + Frontier AI Internships"
            className="h-11 w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
        <button type="submit" className="btn-primary h-11 px-5" disabled={!goal.trim() || running}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          {running ? "Recon running…" : "Launch Overdrive Recon"}
        </button>
      </form>

      {step >= 0 && (
        <div className="panel mb-6 p-4 font-mono text-xs" aria-live="polite">
          {RECON_STEPS.map((s, i) => (
            <div key={s} className={`flex items-center gap-2 py-1 transition-opacity ${i < step ? "text-ink" : i === step ? "text-indigo-soft" : "text-ink-faint opacity-50"}`}>
              {i < step ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald" /> : i === step ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-3.5 w-3.5" />}
              <span className="text-ink-faint">[{String(i + 1).padStart(2, "0")}]</span> {s}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <div className="panel p-4">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">Connections</div>
            <ul className="space-y-2">
              {rows.map(({ key, label, detail, icon: Icon, state }) => (
                <li key={key} className="flex items-center gap-3 rounded-lg border border-line bg-raised px-3 py-2.5">
                  <Icon className="h-4 w-4 text-ink-dim" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{label}</div>
                    <div className="truncate font-mono text-[11px] text-ink-faint">{detail}</div>
                  </div>
                  <Dot state={state} pulse />
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-4">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">Technical stack</div>
            <div className="flex flex-wrap gap-1.5">
              {(vault?.stack ?? []).map((s) => <Badge key={s} tone="indigo">{s}</Badge>)}
            </div>
            <div className="mt-5 mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">Master CV highlights</div>
            <ul className="space-y-2 text-sm text-ink-dim">
              {(vault?.highlights ?? []).map((h) => (
                <li key={h} className="flex gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald" aria-hidden />{h}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line bg-raised px-4 py-2.5">
            <div className="flex items-center gap-2 font-mono text-xs text-ink">
              <FileText className="h-3.5 w-3.5 text-indigo-soft" aria-hidden /> {vault?.fileName ?? "Personal_Context_Vault.md"}
            </div>
            <span className="font-mono text-[11px] text-ink-faint">
              synced {vault ? new Date(vault.syncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "…"} · Google Drive
            </span>
          </div>
          <div className="max-h-[560px] overflow-y-auto p-5">{vault ? <MiniMarkdown text={vault.markdown} /> : <Loader2 className="h-4 w-4 animate-spin text-ink-dim" />}</div>
        </div>
      </div>
    </div>
  );
}
