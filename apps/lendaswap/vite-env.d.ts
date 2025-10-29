/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEMPOOL_REST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
