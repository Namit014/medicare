import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

// Public client to run authenticated or anonymous operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Turn off session persistence inside server environments
  },
});

// Admin client using the Service Role Key to bypass RLS policies and handle user auto-confirms
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Utility to check if Supabase is properly configured
const isPlaceholder = (str: string) => str.includes("placeholder-") || str.startsWith("https://placeholder-");
export const isSupabaseConfigured = !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey);
export const isSupabaseAdminConfigured = isSupabaseConfigured && !isPlaceholder(supabaseServiceKey);
