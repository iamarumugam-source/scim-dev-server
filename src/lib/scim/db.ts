import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fetch from "cross-fetch";

// Lazily-initialised Supabase client.
//
// Importing this module never throws — the error is deferred to the first
// actual DB call.  This means:
//
//   • docker build (postgres mode): both supabase/ and postgres/ service files
//     are statically imported by the shims, so db.ts is always in the bundle.
//     Because no Supabase call is ever made in postgres mode, the error never
//     fires and the build succeeds without Supabase env vars.
//
//   • Vercel (supabase mode): the first supabase.from(...) call triggers
//     getClient(), which throws immediately with a clear message if the env
//     vars are missing.

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required " +
      "when DB_PROVIDER is not 'postgres'."
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch },
  });

  return _client;
}

// Proxy that forwards every property access to the lazily-created client.
export const supabase = new Proxy({} as unknown as SupabaseClient, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getClient(), prop);
  },
});
