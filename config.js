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

  /* "Report an issue" form (Guide → Report an issue).
     1. Go to https://web3forms.com and create a free access key using the inbox that should
        RECEIVE the reports (hello@yasmine.page). Web3Forms emails the key to that address.
     2. Paste the key below. Like the Supabase publishable key, it is safe to commit.
     Until a key is pasted, the form falls back to opening the visitor's email app instead. */
  WEB3FORMS_KEY: "1e34691f-b013-4482-ab16-7fa11d7531d1",
  REPORT_EMAIL: "hello@yasmine.page",   // used for the mailto: fallback

  /* Optional: real recordings instead of the synthesised ambience. Every sound is synthesised by
     default, so leave this empty if you like. To use a CC0 recording, put the file in the audio/
     folder and add a line here. Each one replaces just that sound; anything not listed stays
     synthesised. Loops work best (a few seconds to a minute, seamless, mp3 or ogg).
       realm beds:  skyfield, lagoon, hollyhollow, pavilion, petalwood
       positional:  waterfall, fire, shore, bubbles, chimes, wings
     Example:
       AUDIO_FILES: { waterfall: "audio/waterfall.mp3", fire: "audio/fire.mp3" }, */
  AUDIO_FILES: {},
};
