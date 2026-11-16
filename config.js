/* ============================================================
   FABLENOOK CONFIG  —  the ONLY file you need to edit.

   1. Supabase dashboard → your project → Settings → API Keys
   2. Paste the Project URL and the PUBLISHABLE key below
      (starts with "sb_publishable_..."). On older projects this
      is the "anon" key (a long "eyJ..." string) — that works too.

   This key is designed to be public, so committing it is fine.
   NEVER paste the secret / service_role key here.
   ============================================================ */
window.FABLE_CONFIG = {
  SUPABASE_URL: "https://nueinadvkjsefsrvwlsz.supabase.co", // e.g. "https://abcdefgh.supabase.co"
  SUPABASE_KEY: "sb_publishable_YrrGBM3FGw4x0roEBtreew_jPjrKAeP", // e.g. "sb_publishable_xxx"  (or legacy anon key)

  ROOM: "fablenook-main",     // everyone using the same ROOM sees each other
  BREAK_MINUTES: 5,           // shared break after each Study Circle round
  DAY_TZ_OFFSET_HOURS: 7,     // when "today" resets for circle totals (7 = midnight in Bangkok)
};
