import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The UI calls relative /api/* paths. In dev and preview, Vite proxies them to the FastAPI backend,
// so there are no CORS headaches on stage. Point at another machine with:  VITE_BACKEND=http://192.168.1.20:8000 npm run dev
const backend = (globalThis as any).process?.env?.VITE_BACKEND ?? "http://127.0.0.1:8000";
const proxy = { "/api": { target: backend, changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
