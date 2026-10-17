// Browser voice I/O: Web Speech API recognition + synthesis, and a mic analyser for the waveform.
import { useCallback, useEffect, useRef, useState } from "react";

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function makeRecognition(): Rec | null {
  const w = window as any;
  const R = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!R) return null;
  const r: Rec = new R();
  r.lang = "en-US";
  r.continuous = true;
  r.interimResults = true;
  return r;
}

/** Live speech-to-text. `start()` begins listening; `stop()` resolves with the final transcript. */
export function useRecognition() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);
  const finalText = useRef("");
  const startedAt = useRef(0);
  const wantOn = useRef(false);
  const interimRef = useRef(""); // latest interim text, read by stop()

  useEffect(() => {
    interimRef.current = interim;
  }, [interim]);

  useEffect(() => {
    setSupported(!!((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition));
    return () => {
      wantOn.current = false;
      rec.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    const r = makeRecognition();
    if (!r) return false;
    rec.current?.abort();
    rec.current = r;
    finalText.current = "";
    startedAt.current = performance.now();
    wantOn.current = true;
    setInterim("");
    setError(null);
    r.onresult = (e: any) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText.current += `${e.results[i][0].transcript} `;
        else live += e.results[i][0].transcript;
      }
      setInterim(`${finalText.current}${live}`.trim());
    };
    r.onerror = (e: any) => {
      if (e.error === "not-allowed") setError("Microphone blocked. Allow mic access or use the text box.");
      else if (e.error === "network") setError("Speech service unreachable (venue Wi-Fi?). Use the text box.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError(`Mic error: ${e.error}`);
    };
    // Chrome ends recognition after silence; restart while the user is still meant to be talking.
    r.onend = () => {
      if (wantOn.current && rec.current === r) {
        try {
          r.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setListening(false);
    };
    try {
      r.start();
      setListening(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback((): { text: string; durationSec: number } => {
    wantOn.current = false;
    const text = (finalText.current || interimRef.current).trim();
    rec.current?.stop();
    setListening(false);
    return { text, durationSec: (performance.now() - startedAt.current) / 1000 };
  }, []);

  const cancel = useCallback(() => {
    wantOn.current = false;
    rec.current?.abort();
    setListening(false);
    setInterim("");
  }, []);

  return { supported, listening, interim, error, start, stop, cancel };
}

/** Text-to-speech, chunked by sentence (Chrome cuts off long utterances). Resolves when speaking finishes. */
export function useSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const keep = useRef<SpeechSynthesisUtterance[]>([]); // Chrome GC bug: keep refs or onend never fires
  const cancelled = useRef(false);

  const pickVoice = () => {
    const vs = window.speechSynthesis?.getVoices() ?? [];
    return (
      vs.find((v) => /en-US/i.test(v.lang) && /Google US English|Samantha|Natural|Aria|Jenny/i.test(v.name)) ??
      vs.find((v) => /en-(US|GB)/i.test(v.lang)) ??
      vs[0]
    );
  };

  useEffect(() => {
    window.speechSynthesis?.getVoices(); // voices load async in Chrome
    return () => window.speechSynthesis?.cancel();
  }, []);

  const speak = useCallback(async (text: string, enabled = true) => {
    cancelled.current = false;
    setSpeaking(true);
    try {
      if (!enabled || !("speechSynthesis" in window)) {
        // No TTS: still animate the waveform for a reading-time-sized beat.
        await new Promise((r) => setTimeout(r, Math.min(4000, 600 + text.length * 25)));
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      const chunks = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
      for (const chunk of chunks) {
        if (cancelled.current) break;
        await new Promise<void>((resolve) => {
          const u = new SpeechSynthesisUtterance(chunk.trim());
          const v = pickVoice();
          if (v) u.voice = v;
          u.rate = 1.04;
          u.pitch = 1;
          keep.current.push(u);
          const safety = setTimeout(resolve, 1500 + chunk.length * 90); // never hang the interview
          u.onend = u.onerror = () => {
            clearTimeout(safety);
            resolve();
          };
          synth.speak(u);
        });
      }
    } finally {
      keep.current = [];
      setSpeaking(false);
    }
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { speaking, speak, cancel };
}

/** Microphone level analyser for the waveform (optional; recognition works without it). */
export function useMicAnalyser(active: boolean) {
  const analyser = useRef<AnalyserNode | null>(null);
  useEffect(() => {
    if (!active || !navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        ctx = new AudioContext();
        const a = ctx.createAnalyser();
        a.fftSize = 1024;
        ctx.createMediaStreamSource(s).connect(a);
        analyser.current = a;
      })
      .catch(() => {
        /* no mic permission: waveform falls back to a synthetic idle line */
      });
    return () => {
      stopped = true;
      analyser.current = null;
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
  }, [active]);
  return analyser;
}
