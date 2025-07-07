import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  `https://${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_ID}.supabase.co`,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
