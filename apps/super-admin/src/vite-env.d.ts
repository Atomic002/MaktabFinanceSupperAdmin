/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Maktab paneli manzili — texnik yordam sessiyasi shu yerga o'tkazadi. */
  readonly VITE_SCHOOL_PANEL_URL: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
