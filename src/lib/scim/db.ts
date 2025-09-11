import { createClient } from '@supabase/supabase-js';
import fetch from 'cross-fetch';

/**
 * @file Exports the Supabase admin client for server-side operations.
 * This setup uses the service_role key, which is required for backend
 * services that need to bypass Row Level Security.
 * This key should be kept secret and only used on the server.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// IMPORTANT: Use the SERVICE_ROLE_KEY for server-side admin access
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL and service key are required.');
}

// Create a single, server-side admin client for the entire application
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        // This is a server-side client, so we don't need to persist sessions
        persistSession: false
    },
    // Workaround for a common issue in server-side environments where the
    // default fetch implementation can fail. `cross-fetch` provides a
    // consistent and reliable fetch implementation.
    global: {
        fetch,
    },
});

