import { createBrowserClient } from '@supabase/ssr';

// Browser (client component) Supabase client. Uses @supabase/ssr so the session
// is persisted in cookies rather than localStorage — this is what allows the
// middleware and Server Components to read the session on the server side.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
