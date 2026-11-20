import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

function clearLegacyAuthCookies() {
  if (typeof document === "undefined") return;
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name) continue;
    if (name.startsWith("sb-") || name.includes("auth-token")) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  }
}

export function createClient() {
  if (!browserClient) {
    clearLegacyAuthCookies();
    browserClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window === "undefined" ? undefined : window.sessionStorage,
        },
      }
    );
  }
  return browserClient;
}
