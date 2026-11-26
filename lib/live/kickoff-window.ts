// A match can get its first event (kick-off, first point, first move) from 2
// hours before its scheduled start, so a look around the console days early
// can't start it. The database enforces the same window
// (supabase/migrations/…_console_guards.sql); walkovers are exempt. If a match
// really starts earlier, the admin changes its time in Admin → Fixtures first.
export const KICKOFF_OPENS_BEFORE_MS = 2 * 60 * 60 * 1000;
