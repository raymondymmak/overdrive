import type { ReactNode } from "react";
import type { DataSource } from "../lib/types";

export function Badge({ tone = "mute", children, className = "" }: { tone?: "indigo" | "emerald" | "amber" | "rose" | "mute"; children: ReactNode; className?: string }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

/** Status dot: on = emerald, off = amber, "managed" = indigo (status owned by Superhuman Go, not verified here). */
export function Dot({ on, pulse, state }: { on?: boolean; pulse?: boolean; state?: "on" | "off" | "managed" }) {
  const s = state ?? (on ? "on" : "off");
  const bg = s === "on" ? "bg-emerald" : s === "managed" ? "bg-indigo" : "bg-amber";
  return (
    <span className="relative inline-flex h-2 w-2" aria-label={s === "on" ? "connected" : s === "managed" ? "managed by Superhuman Go" : "offline"} role="img">
      {s === "on" && pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-60" />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${bg}`} />
    </span>
  );
}

/** "LIVE :8000" vs "LOCAL FALLBACK" telemetry badge. */
export function SourceBadge({ source, label }: { source: DataSource | "backend" | "local"; label?: string }) {
  const live = source === "live" || source === "backend";
  return (
    <Badge tone={live ? "emerald" : "amber"} className="uppercase tracking-wider">
      <Dot on={live} pulse={live} />
      {label ? `${label} · ` : ""}
      {live ? "live :8000" : "local fallback"}
    </Badge>
  );
}

export function Meter({ value, tone = "indigo", label }: { value: number; tone?: "indigo" | "emerald" | "amber" | "rose"; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const bg = { indigo: "bg-indigo", emerald: "bg-emerald", amber: "bg-amber", rose: "bg-rose" }[tone];
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between font-mono text-[11px] text-ink-dim">
          <span className="uppercase tracking-wider">{label}</span>
          <span className="text-ink">{v}</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-obsidian-600" role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${bg} transition-[width] duration-500`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export const toneFor = (score: number) => (score >= 80 ? "emerald" : score >= 60 ? "indigo" : score >= 45 ? "amber" : "rose") as "emerald" | "indigo" | "amber" | "rose";

/** Circular score gauge. */
export function Ring({ value, size = 64, label }: { value: number; size?: number; label?: string }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const stroke = { emerald: "#10B981", indigo: "#6366F1", amber: "#F5B544", rose: "#F0648C" }[toneFor(v)];
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? "score"} ${Math.round(v)}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#222737" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-ink font-mono" fontSize={size / 4} fontWeight={600}>
          {Math.round(v)}
        </text>
      </svg>
      {label && <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-dim">{label}</span>}
    </div>
  );
}

export function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-indigo-soft">{eyebrow}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Render CV markup: [[injected keyword]], {{tone shift}}, ~~removed~~. Text-only (no HTML injection). */
export function Marked({ text }: { text: string }) {
  const parts = text.split(/(\[\[.+?\]\]|\{\{.+?\}\}|~~.+?~~)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("[[")) return <mark key={i} className="inj" title="Keyword injected for this target">{p.slice(2, -2)}</mark>;
        if (p.startsWith("{{")) return <mark key={i} className="tone" title="Tone / framing shift">{p.slice(2, -2)}</mark>;
        if (p.startsWith("~~")) return <mark key={i} className="rem" title="Removed">{p.slice(2, -2)}</mark>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

/** Minimal, safe markdown for the vault: headings, bullets, bold, italics. Built as React nodes (no innerHTML). */
export function MiniMarkdown({ text }: { text: string }) {
  const inline = (s: string, k: string) =>
    s.split(/(\*\*.+?\*\*|_.+?_)/g).filter(Boolean).map((p, i) =>
      p.startsWith("**") ? <strong key={`${k}${i}`} className="font-semibold text-ink">{p.slice(2, -2)}</strong> : p.startsWith("_") && p.endsWith("_") ? <em key={`${k}${i}`} className="text-ink-dim">{p.slice(1, -1)}</em> : <span key={`${k}${i}`}>{p}</span>,
    );
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = (k: number) => {
    if (list.length) out.push(<ul key={`ul${k}`} className="my-2 list-disc space-y-1.5 pl-5 marker:text-indigo-soft">{list}</ul>);
    list = [];
  };
  text.split("\n").forEach((line, i) => {
    if (/^\s*-\s+/.test(line)) return void list.push(<li key={i} className="pl-1">{inline(line.replace(/^\s*-\s+/, ""), `l${i}`)}</li>);
    flush(i);
    if (line.startsWith("# ")) out.push(<h2 key={i} className="mb-1 text-lg font-semibold text-ink">{line.slice(2)}</h2>);
    else if (line.startsWith("## ")) out.push(<h3 key={i} className="mt-5 mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-indigo-soft">{line.slice(3)}</h3>);
    else if (line.trim()) out.push(<p key={i} className="my-1.5">{inline(line, `p${i}`)}</p>);
  });
  flush(-1);
  return <div className="text-sm leading-relaxed text-ink-dim">{out}</div>;
}

export const fmtSlot = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
