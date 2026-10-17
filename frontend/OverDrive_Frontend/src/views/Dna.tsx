import { useState } from "react";
import { ArrowRight, BookOpen, Briefcase, CheckCircle2, ExternalLink, FileText, FlaskConical, Landmark, Mic, Newspaper, Presentation, ScanEye, Users } from "lucide-react";
import { Badge, Marked, Ring, SectionHead, SourceBadge } from "../components/ui";
import type { DataSource, Target } from "../lib/types";

const KIND_ICON = { LAB: FlaskConical, COMPANY: Briefcase, VC: Landmark } as const;
const SOURCE_ICON = { interview: Users, article: Newspaper, paper: BookOpen, careers: Briefcase, talk: Presentation } as const;

export function DnaView({ targets, source, onSpar }: { targets: Target[]; source: DataSource; onSpar: (t: Target) => void }) {
  const [sel, setSel] = useState(targets[0]?.id);
  const t = targets.find((x) => x.id === sel) ?? targets[0];
  if (!t) return null;
  const KindIcon = KIND_ICON[t.kind];

  return (
    <div className="animate-fade-up">
      <SectionHead eyebrow="View 02 · Deep Research & Resume Morphing" title="Cultural DNA & Chameleon CV Engine">
        <SourceBadge source={source} label="dossiers" />
      </SectionHead>

      {/* Target switcher */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Targets">
        {targets.map((x) => {
          const Icon = KIND_ICON[x.kind];
          const on = x.id === t.id;
          return (
            <button
              key={x.id}
              role="tab"
              aria-selected={on}
              onClick={() => setSel(x.id)}
              className={`panel group flex items-start gap-3 p-4 text-left transition-all ${on ? "border-indigo/60 bg-indigo/[0.07] shadow-[0_0_0_1px_rgba(99,102,241,.25),0_8px_30px_-12px_rgba(99,102,241,.5)]" : "hover:border-indigo/30"}`}
            >
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${on ? "bg-indigo text-white" : "bg-raised text-ink-dim"}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{x.name}</div>
                <div className="truncate font-mono text-[11px] text-indigo-soft">{x.tagline}</div>
              </div>
              <div className="font-mono text-sm font-semibold text-ink">{x.fitScore}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
        {/* Dossier */}
        <section className="panel p-5" aria-label={`${t.name} dossier`}>
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                <KindIcon className="h-3.5 w-3.5" aria-hidden /> {t.kind === "VC" ? "investor" : t.kind.toLowerCase()} · recon dossier
              </div>
              <h2 className="mt-1 text-xl font-semibold text-ink">{t.name}</h2>
              <div className="text-sm text-ink-dim">{t.role}</div>
            </div>
            <Ring value={t.fitScore} label="fit" />
          </div>

          <div className="mt-4 rounded-lg border border-indigo/30 bg-indigo/[0.06] px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-indigo-soft">Cultural DNA</div>
            <div className="mt-0.5 text-lg font-semibold text-ink">{t.tagline}</div>
          </div>

          <h3 className="mt-5 mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">Extracted ethos</h3>
          <ul className="space-y-2">
            {t.dna.map((d) => (
              <li key={d} className="flex gap-2 text-sm text-ink-dim">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-soft" aria-hidden />
                {d}
              </li>
            ))}
          </ul>

          <h3 className="mt-5 mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">
            <ScanEye className="h-3.5 w-3.5" aria-hidden /> What they secretly filter for
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {t.secretFilters.map((f) => (
              <div key={f.signal} className="rounded-lg border border-line bg-raised p-3">
                <div className="text-sm font-medium text-ink">{f.signal}</div>
                <div className="mt-0.5 text-xs text-ink-dim">{f.detail}</div>
              </div>
            ))}
          </div>

          <h3 className="mt-5 mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">Stack they use</h3>
          <div className="flex flex-wrap gap-1.5">{t.stack.map((s) => <Badge key={s} tone="indigo">{s}</Badge>)}</div>

          <h3 className="mt-5 mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">Sources mined</h3>
          <ul className="space-y-1.5">
            {t.sources.map((s) => {
              const Icon = SOURCE_ICON[s.kind] ?? Newspaper;
              return (
                <li key={s.label} className="flex items-center gap-2 text-xs text-ink-dim">
                  <Icon className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
                  {s.label}
                  <span className="ml-auto font-mono text-[10px] uppercase text-ink-faint">{s.kind}</span>
                </li>
              );
            })}
          </ul>

          <button className="btn-emerald mt-6 w-full" onClick={() => onSpar(t)}>
            <Mic className="h-4 w-4" aria-hidden /> Spar Live with {t.name.split(" (")[0]}
          </button>
        </section>

        {/* Chameleon CV diff */}
        <section className="panel overflow-hidden" aria-label="Chameleon CV diff">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-raised px-5 py-3">
            <FileText className="h-4 w-4 text-indigo-soft" aria-hidden />
            <div className="font-medium text-ink">Chameleon CV Diff</div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {t.driveDoc && (
                <Badge tone="emerald" className="max-w-[260px]">
                  <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">Exported to Google Drive · {t.driveDoc.name}</span>
                  {t.driveDoc.url && (
                    <a href={t.driveDoc.url} target="_blank" rel="noreferrer" aria-label="Open in Drive" className="hover:text-white">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-b border-line px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            <span><mark className="inj">keyword</mark> injected for stack</span>
            <span><mark className="tone">framing</mark> Grammarly tone shift</span>
            <span><mark className="rem">fluff</mark> removed</span>
          </div>

          <div className="divide-y divide-line">
            {t.cv.map((c, i) => (
              <div key={c.section} className="p-5 animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
                <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">{c.section}</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-line bg-obsidian-900 p-3">
                    <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">Master resume</div>
                    <p className="text-sm leading-relaxed text-ink-dim"><Marked text={c.original} /></p>
                  </div>
                  <div className="rounded-lg border border-indigo/40 bg-indigo/[0.06] p-3">
                    <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-indigo-soft">Tailored for {t.name.split(" (")[0]}</div>
                    <p className="text-sm leading-relaxed text-ink"><Marked text={c.tailored} /></p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {c.injected.map((k) => <Badge key={k} tone="indigo">+ {k}</Badge>)}
                  <span className="text-xs text-ink-dim">· {c.rationale}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
