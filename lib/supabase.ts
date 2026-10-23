import { createClient } from "@supabase/supabase-js";
import { lazyDelegate } from "./lazy-delegate";

export const supabase = lazyDelegate(() =>
  createClient(
    `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ),
);
