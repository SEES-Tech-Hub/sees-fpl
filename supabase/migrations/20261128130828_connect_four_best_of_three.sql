-- =============================================================================
-- Connect Four: best of three
-- Owner: Bolu
--
-- Connect Four matches are best of three games, but the event was set up with
-- 2 boards (20261125080040_festival_schedule.sql), so officials couldn't
-- record a deciding third game: the console showed two boards, and
-- record_match_event refuses a board above events.boards.
--
-- This gives Connect Four 3 boards. Nothing else changes:
--   * A board is still 2 points to the winner or 1 each for a draw, and the
--     table still ranks by board points (games won), then match points.
--   * The console ends a match once the boards left can't change the result,
--     so a 2–0 doesn't need Board 3 (lib/live/boards.ts). For the other board
--     games (1 or 2 boards) that is still "every board is in".
--   * Results already recorded on Boards 1 and 2 stay as they are.
--
-- Apply after the app change is deployed: before it, a 3-board match only
-- unlocks End match once all three boards are in.
--
-- Matches by slug, so it does nothing where the event doesn't exist.
-- Safe to run twice.
-- =============================================================================

update public.events
set boards = 3
where slug = 'board-games-connect-four'
  and boards is distinct from 3;

-- =============================================================================
-- Verify (for Tayo, after applying)
-- =============================================================================
-- select slug, boards from public.events where slug like 'board-games-%' order by slug;
--   -- board-games-connect-four 3; chess-men 2; draughts, ludo, scrabble 2
