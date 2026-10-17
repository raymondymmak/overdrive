import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Code2, GraduationCap, Keyboard, Lightbulb, Loader2, Mic, MicOff, Play, RotateCcw,
  Send, Sparkles, Square, Trophy, User, Volume2, VolumeX, XCircle,
} from "lucide-react";
import { Badge, Meter, Ring, SectionHead, toneFor } from "../components/ui";
import { Waveform } from "../components/Waveform";
import { useMicAnalyser, useRecognition, useSynthesis } from "../lib/voice";
import { voiceInterview } from "../lib/api";
import { evaluate, mergeBackend, type Coaching } from "../lib/coach";
import { questionsFor, type Question } from "../data/questions";
import type { Target, Turn } from "../lib/types";

type Phase = "ready" | "asking" | "listening" | "thinking" | "review" | "over";
type Mode = "coach" | "interview";
type Focus = "mixed" | "personal" | "technical";
interface Attempt { id: number; qid: string; text: string; coaching: Coaching; followUp?: boolean }

const stripMarkup = (s: string) => s.replace(/\[\[(.+?)\]\]|\{\{(.+?)\}\}/g, "$1$2").replace(/~~.+?~~/g, "").replace(/\s+/g, " ").trim();
const TYPE_TONE = { personal: "emerald", behavioral: "amber", technical: "indigo" } as const;
const BRIDGES = ["Good. Next one.", "Okay, let's switch gears.", "Got it. Here's another.", "Alright."];

export function ArenaView({ targets, target, setTarget }: { targets: Target[]; target: Target; setTarget: (t: Target) => void }) {
  const [mode, setMode] = useState<Mode>("coach");
  const [focus, setFocus] = useState<Focus>("mixed");
  const [voiceOut, setVoiceOut] = useState(true);
  const [phase, setPhase] = useState<Phase>("ready");
  const [queue, setQueue] = useState<Question[]>([]);
  const [qi, setQi] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [current, setCurrent] = useState<Attempt | null>(null);
  const [showModel, setShowModel] = useState(false);
  const [typed, setTyped] = useState("");
  const [refining, setRefining] = useState(false);

  const rec = useRecognition();
  const tts = useSynthesis();
  const analyser = useMicAnalyser(rec.listening);
  const session = useRef(0);
  const nextId = useRef(1);
  const followedUp = useRef(new Set<string>());
  const feed = useRef<HTMLDivElement>(null);

  const q: Question | undefined = queue[qi];
  const tailoredResume = target.cv.map((c) => `- ${stripMarkup(c.tailored)}`).join("\n");
  const companyCulture = `${target.tagline}. ${target.dna.join(" ")} Interviewer persona: ${target.persona}`;
  const qAttempts = (id: string) => attempts.filter((a) => a.qid === id);

  useEffect(() => feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: "smooth" }), [turns, rec.interim]);
  useEffect(() => reset(), [target.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Review shortcuts: R retry · M model answer · N next (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select") || e.metaKey || e.ctrlKey) return;
      if (phase !== "review") return;
      if (e.key === "r") retry();
      if (e.key === "m") playModel();
      if (e.key === "n") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function reset() {
    session.current++;
    rec.cancel();
    tts.cancel();
    setPhase("ready");
    setQueue([]);
    setQi(0);
    setTurns([]);
    setAttempts([]);
    setCurrent(null);
    setShowModel(false);
    setTyped("");
    followedUp.current.clear();
  }

  /** Interviewer speaks `line`, then the mic opens. */
  async function say(line: string, sid: number, listenAfter = true) {
    if (sid !== session.current) return;
    setTurns((t) => [...t, { role: "interviewer", text: line, at: Date.now() }]);
    setPhase("asking");
    await tts.speak(line, voiceOut);
    if (sid !== session.current) return;
    if (!listenAfter) return;
    setPhase("listening");
    if (rec.supported) rec.start();
  }

  function begin() {
    const sid = ++session.current;
    const qs = questionsFor(target, focus);
    setQueue(qs);
    setQi(0);
    setAttempts([]);
    setTurns([]);
    setCurrent(null);
    followedUp.current.clear();
    const hello = mode === "coach" ? `I'm your ${target.name.split(" (")[0]} interview coach. Answer like it's the real thing; I'll give you feedback after each answer.` : `Thanks for making the time. I've read the resume you sent.`;
    say(`${hello} ${qs[0].prompt}`, sid);
  }

  function retry() {
    if (!q) return;
    setShowModel(false);
    setCurrent(null);
    say(`Take ${qAttempts(q.id).length + 1}. ${q.prompt}`, session.current);
  }

  function next() {
    setShowModel(false);
    setCurrent(null);
    if (qi + 1 >= queue.length) return finish();
    const i = qi + 1;
    setQi(i);
    say(`${BRIDGES[i % BRIDGES.length]} ${queue[i].prompt}`, session.current);
  }

  function playModel() {
    if (!q) return;
    setShowModel(true);
    tts.speak(`Here's one strong way to answer. ${q.model}`, voiceOut);
  }

  function finish() {
    rec.cancel();
    tts.cancel();
    setPhase("over");
    tts.speak("That's the session. Your scorecard is on the right, with what to fix next time.", voiceOut);
  }

  function bestByQuestion() {
    return queue
      .map((qq) => {
        const as = qAttempts(qq.id);
        if (!as.length) return null;
        const scores = as.map((a) => a.coaching.score);
        return { q: qq, first: scores[0], best: Math.max(...scores), tries: as.length, last: as[as.length - 1] };
      })
      .filter(Boolean) as { q: Question; first: number; best: number; tries: number; last: Attempt }[];
  }

  async function submit(text: string, durationSec?: number) {
    const answer = text.trim();
    if (!answer || !q || phase === "thinking") return;
    const sid = session.current;
    rec.cancel();
    setTyped("");

    // A follow-up answer is judged together with the original answer, so covering the missing point counts.
    const prev = attempts.filter((a) => a.qid === q.id).slice(-1)[0];
    const isFollow = mode === "interview" && followedUp.current.has(q.id) && prev && !prev.followUp;
    const judged = isFollow ? `${prev.text} ${answer}` : answer;
    const coaching = evaluate(judged, q, target, durationSec);
    const att: Attempt = { id: nextId.current++, qid: q.id, text: judged, coaching, followUp: isFollow || undefined };
    const history = turns.map((t) => ({ role: t.role === "interviewer" ? "assistant" : "user", content: t.text }));

    setTurns((t) => [...t, { role: "candidate", text: answer, at: Date.now(), telemetry: coaching.tel }]);
    setAttempts((a) => [...a, att]);

    // Ask the backend to refine in the background; the local result shows instantly.
    setRefining(true);
    voiceInterview(
      {
        targetId: target.id, companyCulture, tailoredResume, conversationHistory: history, userMessage: answer, mode,
        question: { id: q.id, type: q.type, prompt: q.prompt, code: q.code?.source, rubric: q.rubric.map((r) => ({ label: r.label, mustHave: r.mustHave })) },
      },
      9000,
    )
      .then((r) => {
        if (sid !== session.current) return;
        const merged = mergeBackend(coaching, { ...r.coaching, technicalScore: r.technicalScore, culturalFitScore: r.culturalFitScore, feedback: r.grammarlyClarityFeedback });
        setAttempts((a) => a.map((x) => (x.id === att.id ? { ...x, coaching: merged } : x)));
        setCurrent((c) => (c?.id === att.id ? { ...c, coaching: merged } : c));
      })
      .catch(() => {})
      .finally(() => setRefining(false));

    if (mode === "coach") {
      setCurrent(att);
      setPhase("review");
      await tts.speak(coaching.spoken, voiceOut);
      return;
    }

    // Interview mode: adaptive follow-up if a must-have point is missing (once per question), else move on.
    const missing = coaching.points.some((p) => p.mustHave && !p.hit);
    if (missing && !followedUp.current.has(q.id)) {
      followedUp.current.add(q.id);
      return say(q.followUp, sid);
    }
    if (qi + 1 >= queue.length) {
      await say("That's all the time we have. Thanks, this was useful.", sid, false);
      if (sid === session.current) finish();
      return;
    }
    const i = qi + 1;
    setQi(i);
    say(`${BRIDGES[i % BRIDGES.length]} ${queue[i].prompt}`, sid);
  }

  function doneSpeaking() {
    const { text, durationSec } = rec.stop();
    if (text) submit(text, durationSec);
  }

  const wave = phase === "asking" || tts.speaking ? "ai" : rec.listening ? "user" : "idle";
  const canAnswer = phase === "listening";
  const c = current?.coaching ?? null;
  const prevBest = current ? Math.max(-1, ...qAttempts(current.qid).filter((a) => a.id < current.id).map((a) => a.coaching.score)) : -1;

  return (
    <div className="animate-fade-up">
      <SectionHead eyebrow="View 04 · Live Voice Interview Coach" title="Adversarial Voice Sparring Arena">
        <label htmlFor="target" className="sr-only">Interviewer</label>
        <select id="target" value={targets.some((t) => t.id === target.id) ? target.id : "custom"} onChange={(e) => { const t = targets.find((x) => x.id === e.target.value); if (t) setTarget(t); }} className="h-10 max-w-[230px] rounded-lg border border-line bg-raised px-2 text-sm text-ink">
          {!targets.some((t) => t.id === target.id) && <option value="custom">{target.name}</option>}
          {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn-ghost h-10" onClick={() => { setVoiceOut((v) => !v); tts.cancel(); }} aria-pressed={voiceOut} title="Interviewer voice">
          {voiceOut ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </SectionHead>

      {phase === "ready" ? (
        <Setup target={target} mode={mode} setMode={setMode} focus={focus} setFocus={setFocus} onStart={begin} micOk={rec.supported} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          {/* ---------------- Stage ---------------- */}
          <section className="panel flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
              <User className="h-4 w-4 text-indigo-soft" aria-hidden />
              <div className="min-w-0 flex-1 truncate text-sm text-ink-dim">{target.persona}</div>
              <Badge tone={mode === "coach" ? "emerald" : "indigo"}>{mode === "coach" ? "coach mode" : "interview mode"}</Badge>
            </div>

            {q && phase !== "over" && (
              <div className="border-b border-line p-5">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="mute">Q{qi + 1}/{queue.length}</Badge>
                  <Badge tone={TYPE_TONE[q.type]}>{q.type}</Badge>
                  <Badge tone="mute">{q.topic}</Badge>
                  {qAttempts(q.id).length > 0 && <Badge tone="amber">attempt {qAttempts(q.id).length + (phase === "review" ? 0 : 1)}</Badge>}
                </div>
                <p className="text-lg font-medium leading-snug text-ink">{turns.filter((t) => t.role === "interviewer").slice(-1)[0]?.text.includes(q.followUp) ? q.followUp : q.prompt}</p>
                {q.code && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-line">
                    <div className="flex items-center gap-2 border-b border-line bg-raised px-3 py-1.5 font-mono text-[11px] text-ink-dim"><Code2 className="h-3.5 w-3.5" aria-hidden />{q.code.caption}</div>
                    <pre className="max-h-64 overflow-auto bg-obsidian-900 p-3 font-mono text-[12.5px] leading-relaxed text-ink"><code>{q.code.source}</code></pre>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-1 font-mono text-[10px] text-ink-faint">
                  <span className="uppercase tracking-wider">structure:</span>
                  {(c?.steps ?? evaluate("", q, target).steps).map((s) => (
                    <span key={s.label} title={s.hint} className={`rounded px-1.5 py-0.5 ${c ? (s.hit ? "bg-emerald/15 text-emerald-soft" : "bg-rose/10 text-rose") : "bg-raised text-ink-dim"}`}>{s.label}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="relative border-b border-line bg-obsidian-900 px-4 py-2">
              <Waveform mode={wave} analyser={analyser} height={84} />
              <div className="absolute left-4 top-2 font-mono text-[10px] uppercase tracking-wider">
                {wave === "ai" && <span className="text-indigo-soft">● {phase === "review" ? "coach speaking" : "interviewer speaking"}</span>}
                {phase === "listening" && (rec.listening ? <span className="text-emerald-soft">● listening, answer out loud</span> : <span className="text-ink-faint">your turn</span>)}
                {phase === "review" && wave !== "ai" && <span className="text-emerald-soft">● feedback ready</span>}
              </div>
            </div>

            {/* Transcript */}
            <div ref={feed} className="max-h-[260px] min-h-[140px] flex-1 space-y-2.5 overflow-y-auto p-4" aria-live="polite">
              {turns.map((t, i) => (
                <div key={i} className={`flex ${t.role === "candidate" ? "justify-end" : ""}`}>
                  <div className={`max-w-[88%] rounded-xl px-3.5 py-2 text-sm leading-relaxed ${t.role === "candidate" ? "bg-emerald/10 text-ink ring-1 ring-emerald/25" : "bg-raised text-ink-dim ring-1 ring-line"}`}>
                    <span className="mr-1.5 font-mono text-[10px] uppercase text-ink-faint">{t.role === "candidate" ? "you" : mode === "coach" ? "coach" : "interviewer"}</span>
                    {t.text}
                  </div>
                </div>
              ))}
              {rec.listening && rec.interim && (
                <div className="flex justify-end"><div className="max-w-[88%] rounded-xl bg-emerald/5 px-3.5 py-2 text-sm italic text-ink-dim ring-1 ring-emerald/20">{rec.interim}</div></div>
              )}
            </div>

            {/* Controls */}
            <div className="space-y-2 border-t border-line p-4">
              {rec.error && <div className="flex items-center gap-2 font-mono text-[11px] text-amber"><AlertTriangle className="h-3.5 w-3.5" />{rec.error}</div>}

              {phase === "review" && (
                <div className="grid grid-cols-3 gap-2">
                  <button className="btn-primary" onClick={retry}><RotateCcw className="h-4 w-4" aria-hidden /> Retry <kbd className="hidden font-mono text-[10px] opacity-60 sm:inline">R</kbd></button>
                  <button className="btn-ghost" onClick={playModel}><Lightbulb className="h-4 w-4" aria-hidden /> Model answer <kbd className="hidden font-mono text-[10px] opacity-60 sm:inline">M</kbd></button>
                  <button className="btn-ghost" onClick={next}>{qi + 1 >= queue.length ? "Finish" : "Next"} <ArrowRight className="h-4 w-4" aria-hidden /> <kbd className="hidden font-mono text-[10px] opacity-60 sm:inline">N</kbd></button>
                </div>
              )}

              {canAnswer && rec.supported && (
                <div className="flex gap-2">
                  {rec.listening ? (
                    <button className="btn-emerald flex-1" onClick={doneSpeaking}><Square className="h-4 w-4" aria-hidden /> Done answering</button>
                  ) : (
                    <button className="btn-ghost flex-1" onClick={() => rec.start()}><Mic className="h-4 w-4" aria-hidden /> Tap to talk</button>
                  )}
                  {rec.listening && <button className="btn-ghost" onClick={() => rec.cancel()} title="Stop mic"><MicOff className="h-4 w-4" /></button>}
                </div>
              )}

              {canAnswer && (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(typed); }}>
                  <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-obsidian-900 px-3 focus-within:border-indigo/60">
                    <Keyboard className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
                    <label htmlFor="typed" className="sr-only">Type your answer</label>
                    <input id="typed" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type your answer (mic/Wi-Fi fallback)…" className="h-10 w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none" />
                  </div>
                  <button type="submit" className="btn-primary" disabled={!typed.trim()}><Send className="h-4 w-4" aria-hidden /><span className="sr-only">Send</span></button>
                </form>
              )}

              {phase === "asking" && <div className="flex items-center gap-2 font-mono text-xs text-ink-faint"><Loader2 className="h-3.5 w-3.5 animate-spin" /> listen to the question… <button className="ml-auto underline" onClick={() => { tts.cancel(); }}>skip</button></div>}

              <div className="flex gap-2 pt-1">
                {phase !== "over" && attempts.length > 0 && <button className="btn-ghost flex-1 text-xs" onClick={finish}><Trophy className="h-3.5 w-3.5" aria-hidden /> End & see summary</button>}
                <button className="btn-ghost flex-1 text-xs" onClick={reset}><RotateCcw className="h-3.5 w-3.5" aria-hidden /> New session</button>
              </div>
            </div>
          </section>

          {/* ---------------- Coach panel ---------------- */}
          <aside className="space-y-4">
            {phase === "over" ? (
              <Summary rows={bestByQuestion()} onPractice={(qq) => { const i = queue.findIndex((x) => x.id === qq.id); setQi(i); setCurrent(null); setShowModel(false); say(`Let's work on this one. ${qq.prompt}`, session.current); }} />
            ) : mode === "coach" && c ? (
              <Feedback c={c} prevBest={prevBest} refining={refining} showModel={showModel} onModel={playModel} />
            ) : mode === "interview" && attempts.length ? (
              <div className="panel p-5">
                <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">Interview mode</div>
                <p className="text-sm text-ink-dim">Detailed feedback is held until the end, like a real interview. Live delivery:</p>
                <Delivery c={attempts[attempts.length - 1].coaching} />
              </div>
            ) : (
              <div className="panel p-5 text-sm text-ink-dim">
                <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim"><GraduationCap className="h-3.5 w-3.5" /> How you're scored</div>
                {q && (
                  <ul className="space-y-1.5">
                    {q.rubric.map((r) => (
                      <li key={r.id} className="flex gap-2"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${r.mustHave ? "bg-indigo" : "bg-ink-faint"}`} />{r.label}{r.mustHave && <span className="font-mono text-[10px] text-indigo-soft">must-have</span>}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-ink-faint">Plus structure ({q ? evaluate("", q, target).framework : "framework"}) and delivery: filler words, length, pace.</p>
              </div>
            )}
            <Progress queue={queue} attempts={attempts} qi={qi} />
          </aside>
        </div>
      )}
    </div>
  );
}

// ---------------- pieces ----------------

function Setup({ target, mode, setMode, focus, setFocus, onStart, micOk }: { target: Target; mode: Mode; setMode: (m: Mode) => void; focus: Focus; setFocus: (f: Focus) => void; onStart: () => void; micOk: boolean }) {
  const qs = questionsFor(target, focus);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
      <section className="panel p-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-indigo-soft">{target.name} · {target.tagline}</div>
        <h2 className="mt-1 text-xl font-semibold text-ink">Practice out loud. Get scored instantly. Retry until it lands.</h2>
        <p className="mt-2 text-sm text-ink-dim">The interviewer has read your tailored CV and plays the {target.name.split(" (")[0]} persona. You'll get personal questions (where you'll be in 10 years, why them, a real failure) and technical ones with code on screen.</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {([
            ["coach", "Coach mode", "Feedback after every answer: what you covered, what you missed, filler words, a model answer. Retry the same question."],
            ["interview", "Interview mode", "Realistic: adaptive follow-ups when you miss something, and feedback held until the end."],
          ] as const).map(([id, title, desc]) => (
            <button key={id} onClick={() => setMode(id)} aria-pressed={mode === id} className={`rounded-xl border p-4 text-left transition-colors ${mode === id ? "border-indigo/60 bg-indigo/[0.08]" : "border-line bg-raised hover:border-indigo/30"}`}>
              <div className="font-medium text-ink">{title}</div>
              <div className="mt-1 text-xs text-ink-dim">{desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Question mix">
          {(["mixed", "personal", "technical"] as const).map((f) => (
            <button key={f} role="radio" aria-checked={focus === f} onClick={() => setFocus(f)} className={`rounded-lg px-3 py-1.5 font-mono text-xs ${focus === f ? "bg-indigo/15 text-ink ring-1 ring-indigo/40" : "text-ink-dim hover:text-ink"}`}>{f}</button>
          ))}
        </div>

        <button className="btn-primary mt-6 h-11 w-full text-base" onClick={onStart}><Play className="h-4 w-4" aria-hidden /> Start {mode === "coach" ? "coaching" : "interview"}</button>
        {!micOk && <p className="mt-3 font-mono text-[11px] text-amber">Speech recognition isn&rsquo;t available in this browser; you can type answers (Chrome or Edge recommended for voice).</p>}
      </section>
      <aside className="panel p-5">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">This session · {qs.length} questions</div>
        <ol className="space-y-2.5">
          {qs.map((x, i) => (
            <li key={x.id} className="flex gap-3">
              <span className="font-mono text-xs text-ink-faint">{i + 1}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5"><Badge tone={TYPE_TONE[x.type]}>{x.type}</Badge>{x.code && <Badge tone="mute"><Code2 className="h-3 w-3" />code</Badge>}</div>
                <div className="mt-1 text-sm text-ink-dim">{x.prompt}</div>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

function Delivery({ c }: { c: Coaching }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
      {[
        { k: "fillers", v: String(c.tel.fillerCount), bad: c.tel.fillerCount >= 3 },
        { k: "words", v: String(c.tel.words), bad: !!c.lengthNote },
        { k: "wpm", v: c.tel.wpm ? String(c.tel.wpm) : "—", bad: !!c.tel.wpm && c.tel.wpm > 175 },
      ].map((s) => (
        <div key={s.k} className={`rounded-lg border py-2 ${s.bad ? "border-amber/40 bg-amber/[0.06]" : "border-line bg-raised"}`}>
          <div className="font-mono text-lg font-semibold text-ink">{s.v}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{s.k}</div>
        </div>
      ))}
    </div>
  );
}

function Feedback({ c, prevBest, refining, showModel, onModel }: { c: Coaching; prevBest: number; refining: boolean; showModel: boolean; onModel: () => void }) {
  const delta = prevBest >= 0 ? c.score - prevBest : null;
  return (
    <>
      <div className="panel animate-fade-up p-5">
        <div className="flex items-center gap-4">
          <Ring value={c.score} size={84} label="answer" />
          <div className="min-w-0 flex-1 space-y-2">
            <Meter value={c.content} tone="indigo" label="Content" />
            <Meter value={c.structure} tone="emerald" label="Structure" />
            <Meter value={c.delivery} tone="amber" label="Delivery" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {delta !== null && <Badge tone={delta > 0 ? "emerald" : delta < 0 ? "rose" : "mute"}>{delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {delta > 0 ? "+" : ""}{delta} vs last try</Badge>}
          <Badge tone={c.source === "backend" ? "emerald" : "mute"}>{c.source === "backend" ? <><Sparkles className="h-3 w-3" />AI-refined</> : "instant local coach"}</Badge>
          {refining && c.source === "local" && <span className="flex items-center gap-1 font-mono text-[10px] text-ink-faint"><Loader2 className="h-3 w-3 animate-spin" />refining…</span>}
        </div>
        <div className="mt-4 rounded-lg border border-indigo/40 bg-indigo/[0.07] p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-indigo-soft">Fix this first</div>
          <div className="text-sm text-ink">{c.topFix}</div>
        </div>
      </div>

      <div className="panel p-5">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">What a strong answer covers</div>
        <ul className="space-y-2">
          {c.points.map((p) => (
            <li key={p.id} className="flex gap-2 text-sm">
              {p.hit ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald" aria-label="covered" /> : <XCircle className={`mt-0.5 h-4 w-4 shrink-0 ${p.mustHave ? "text-rose" : "text-ink-faint"}`} aria-label="missing" />}
              <div className="min-w-0">
                <div className={p.hit ? "text-ink" : "text-ink-dim"}>{p.label}{p.mustHave && !p.hit && <span className="ml-1.5 font-mono text-[10px] text-rose">must-have</span>}</div>
                {p.hit ? p.evidence && <div className="truncate font-mono text-[11px] text-emerald-soft/80">“…{p.evidence}…”</div> : <div className="text-xs text-ink-faint">{p.tip}</div>}
              </div>
            </li>
          ))}
        </ul>
        <Delivery c={c} />
        {c.tel.fillers.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{[...new Set(c.tel.fillers)].map((f) => <Badge key={f} tone="amber">“{f}” ×{c.tel.fillers.filter((x) => x === f).length}</Badge>)}</div>}
        {c.strengths.length > 0 && <div className="mt-3 text-xs text-ink-dim"><span className="text-emerald-soft">Strengths:</span> {c.strengths.join(" · ")}</div>}
      </div>

      <div className="panel p-5">
        <button className="flex w-full items-center gap-2 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim hover:text-ink" onClick={onModel}>
          <Lightbulb className="h-3.5 w-3.5 text-amber" aria-hidden /> Model answer {showModel ? "" : "· tap to hear it"}
        </button>
        {showModel && <p className="mt-2 animate-fade-up text-sm leading-relaxed text-ink-dim">{c.betterAnswer}</p>}
      </div>
    </>
  );
}

function Progress({ queue, attempts, qi }: { queue: Question[]; attempts: Attempt[]; qi: number }) {
  if (!queue.length) return null;
  return (
    <div className="panel p-5">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">Progress · tries per question</div>
      <ul className="space-y-2.5">
        {queue.map((qq, i) => {
          const as = attempts.filter((a) => a.qid === qq.id);
          return (
            <li key={qq.id} className={`flex items-center gap-3 ${i === qi ? "" : "opacity-70"}`}>
              <span className={`w-5 font-mono text-xs ${i === qi ? "text-indigo-soft" : "text-ink-faint"}`}>{i + 1}</span>
              <span className="w-32 truncate text-xs text-ink-dim" title={qq.topic}>{qq.topic}</span>
              <div className="flex flex-1 items-end gap-1">
                {as.length ? as.map((a) => (
                  <div key={a.id} className="flex flex-col items-center">
                    <div className={`w-6 rounded-t ${{ emerald: "bg-emerald", indigo: "bg-indigo", amber: "bg-amber", rose: "bg-rose" }[toneFor(a.coaching.score)]}`} style={{ height: `${Math.max(4, a.coaching.score * 0.3)}px` }} title={`${a.coaching.score}`} />
                    <span className="font-mono text-[9px] text-ink-faint">{a.coaching.score}</span>
                  </div>
                )) : <span className="font-mono text-[10px] text-ink-faint">—</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Summary({ rows, onPractice }: { rows: { q: Question; first: number; best: number; tries: number; last: Attempt }[]; onPractice: (q: Question) => void }) {
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.best, 0) / rows.length) : 0;
  const weakest = [...rows].sort((a, b) => a.best - b.best)[0];
  return (
    <div className="panel animate-fade-up p-5">
      <div className="flex items-center gap-4">
        <Ring value={avg} size={84} label="session" />
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">Session summary</div>
          <div className="text-sm text-ink-dim">{rows.length} questions · {rows.reduce((s, r) => s + r.tries, 0)} answers · best-try average</div>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.q.id} className="rounded-lg border border-line bg-raised p-3">
            <div className="flex items-center gap-2">
              <Badge tone={TYPE_TONE[r.q.type]}>{r.q.type}</Badge>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.q.topic}</span>
              <span className="font-mono text-xs text-ink-dim">{r.first}{r.tries > 1 && <> → <span className="text-emerald-soft">{r.best}</span></>}</span>
            </div>
            <div className="mt-1 text-xs text-ink-faint">Next time: {r.last.coaching.topFix}</div>
          </li>
        ))}
      </ul>
      {weakest && <button className="btn-primary mt-4 w-full" onClick={() => onPractice(weakest.q)}><RotateCcw className="h-4 w-4" aria-hidden /> Drill my weakest: {weakest.q.topic}</button>}
    </div>
  );
}
