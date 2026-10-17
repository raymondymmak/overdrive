/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the FastAPI backend. Leave unset to use the Vite /api proxy (recommended). */
  readonly VITE_API_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
