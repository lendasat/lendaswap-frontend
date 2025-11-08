/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG_MODE?: string;
  readonly VITE_LENDASWAP_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
