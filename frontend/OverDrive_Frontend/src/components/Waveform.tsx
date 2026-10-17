import { useEffect, useRef, type RefObject } from "react";

/**
 * Audio waveform. mode="user" draws the real mic signal (if an analyser is available),
 * mode="ai" draws a synthetic voice-like wave while the interviewer speaks, "idle" is a calm baseline.
 */
export function Waveform({ mode, analyser, height = 120 }: { mode: "idle" | "ai" | "user"; analyser?: RefObject<AnalyserNode | null>; height?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    let energy = 0; // smoothed loudness 0..1
    const buf = new Uint8Array(1024);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = c.clientWidth * dpr;
      c.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);

    const draw = () => {
      const w = c.clientWidth;
      const h = height;
      const mid = h / 2;
      const m = modeRef.current;
      t += 1;
      ctx.clearRect(0, 0, w, h);

      // live mic samples when listening
      const a = analyser?.current;
      let samples: number[] | null = null;
      if (m === "user" && a) {
        a.getByteTimeDomainData(buf);
        samples = Array.from(buf.slice(0, a.fftSize), (v) => (v - 128) / 128);
        const rms = Math.sqrt(samples.reduce((s, v) => s + v * v, 0) / samples.length);
        energy += (Math.min(1, rms * 6) - energy) * 0.35;
      } else {
        const target = m === "ai" ? 0.55 + 0.35 * Math.abs(Math.sin(t / 9)) * Math.abs(Math.sin(t / 23)) : m === "user" ? 0.25 : 0.04;
        energy += (target - energy) * 0.12;
      }

      const color = m === "user" ? "16,185,129" : "99,102,241";
      const layers = [
        { amp: 1, alpha: 0.95, width: 2, freq: 1 },
        { amp: 0.6, alpha: 0.4, width: 1.5, freq: 1.7 },
        { amp: 0.35, alpha: 0.22, width: 1, freq: 2.6 },
      ];
      for (const L of layers) {
        ctx.beginPath();
        ctx.lineWidth = L.width;
        ctx.strokeStyle = `rgba(${color},${L.alpha})`;
        for (let x = 0; x <= w; x += 2) {
          const edge = Math.sin((Math.PI * x) / w); // taper at the ends
          let y: number;
          if (samples) {
            const s = samples[Math.floor((x / w) * (samples.length - 1))] ?? 0;
            y = mid + s * mid * 0.9 * L.amp * edge;
          } else {
            const wave = Math.sin(x / (14 / L.freq) + t / 6) * 0.6 + Math.sin(x / (31 / L.freq) - t / 9) * 0.4;
            y = mid + wave * energy * mid * 0.85 * L.amp * edge;
          }
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [analyser, height]);

  return <canvas ref={canvas} style={{ width: "100%", height }} aria-hidden className="block" />;
}
