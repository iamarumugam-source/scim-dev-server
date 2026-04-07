import { createClient } from "@supabase/supabase-js";
import fetch from "cross-fetch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.DB_PROVIDER !== "postgres" && (!supabaseUrl || !supabaseServiceKey)) {
  throw new Error("Supabase URL and service key are required.");
}

export const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { fetch },
    })
  : (null as any);
