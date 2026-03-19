/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_POSTHOG_KEY: string;
  readonly VITE_PUBLIC_POSTHOG_HOST: string;
  readonly VITE_BACKEND_API_URL: string;
  readonly VITE_CONSTRUCTION_MODE: string;
  // Add other environment variables if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}