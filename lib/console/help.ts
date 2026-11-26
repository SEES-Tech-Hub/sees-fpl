// What each match console does, in the officials' words, with the real
// button names. Shown by components/console/console-help.tsx: the first-time
// card (`quick`) and the full guide behind the "?" button (`sections`).

export type ConsoleKind = "football" | "team" | "points" | "boards" | "sets" | "race";

export type HelpSection = { title: string; points: string[] };
export type ConsoleHelpContent = { title: string; quick: string[]; sections: HelpSection[] };

const HOLDING: HelpSection = {
  title: "Before you start",
  points: [
    "Tap “Take this match” so this phone records it. Only one phone can record a match at a time, the admin included.",
    "You can start from 2 hours before the scheduled time. If the match has moved, ask the admin to change its time first.",
    "Swapping phones? Tap “Hand over” once everything has sent, then take the match on the other phone.",
  ],
};

const SIGNAL: HelpSection = {
  title: "If the signal drops",
  points: [
    "Keep recording. Taps are saved on the phone and send by themselves when the signal is back.",
    "The bar at the top says how many are waiting. Don’t close the page or hand over until it says everything has sent.",
  ],
};

const MISTAKES: HelpSection = {
  title: "Fixing a mistake",
  points: [
    "Straight after a tap, an Undo bar shows for a few seconds. Tap it to take that last action back.",
    "Too late for Undo? Tell the admin. They can remove any event in Admin → Fixtures, and the score corrects itself.",
  ],
};

export const CONSOLE_HELP: Record<ConsoleKind, ConsoleHelpContent> = {
  football: {
    title: "Recording a football match",
    quick: [
      "Tap “Take this match”.",
      "Before kick-off, tap each team under “Lineup check” and tick who starts. Fantasy points use it.",
      "Tap “Kick off”, then tap it again to confirm. The match clock starts and everyone following gets an alert.",
      "Record goals, cards and subs as they happen, then “Half time”, “Second half” and “Full time”.",
    ],
    sections: [
      HOLDING,
      {
        title: "During the match",
        points: [
          "Goal: tap “Goal” for the team that scored, then pick the scorer and, if there was one, who assisted. Mark penalties and own goals there too.",
          "Cards: pick Yellow or Red and the player. A player already on a yellow who gets another: pick Yellow again and it’s recorded as a red.",
          "Subs: pick the player going off, then the player coming on.",
          "A missed penalty: pick the taker and, if they saved it, the goalkeeper.",
          "The big button at the bottom moves the match on: “Half time”, “Second half”, “Full time”. In a level knockout it offers extra time or penalties instead.",
        ],
      },
      { title: "At the end", points: ["After “Full time”, tap “Pick Man of the Match” and choose the player. To change it, undo it and pick again."] },
      MISTAKES,
      SIGNAL,
    ],
  },
  team: {
    title: "Recording the score",
    quick: [
      "Tap “Take this match”.",
      "Tap “Kick off” (basketball: “Tip-off”), then tap it again to confirm.",
      "Each time a team scores, tap that team’s button (basketball: +1, +2 or +3).",
      "Use the big button at the bottom for each break and for “Full time”.",
    ],
    sections: [
      HOLDING,
      {
        title: "During the match",
        points: [
          "Tap a team’s button once for every score. In basketball, pick +1, +2 or +3 for the basket.",
          "The big button at the bottom moves the match on: halves, or quarters in basketball, then “Full time”. A level knockout goes to extra time, overtime or penalties.",
        ],
      },
      MISTAKES,
      SIGNAL,
    ],
  },
  points: {
    title: "Recording the score",
    quick: [
      "Tap “Take this match”.",
      "Each tap on a side adds one point to it: one goal, one round, one kill, whatever the game counts. Tapping doesn’t end the match or make anyone win.",
      "Wrong side? Tap Undo on the bar that shows straight after.",
      "When the game is over, tap “End match”. The side with more points wins; if it’s level in a knockout, you pick the winner.",
    ],
    sections: [
      HOLDING,
      {
        title: "During the match",
        points: [
          "“+ Year 4” adds one point to Year 4. Tap again for every point after that. The score at the top updates straight away.",
          "Two-leg ties show the aggregate under the score. A first leg can end level; a level second leg needs a winner.",
        ],
      },
      {
        title: "At the end",
        points: [
          "Tap “End match”. Whoever has more points wins.",
          "Level in a knockout? It asks who won (on penalties, golden goal or however the game was settled).",
        ],
      },
      MISTAKES,
      SIGNAL,
    ],
  },
  boards: {
    title: "Recording a board game",
    quick: [
      "Tap “Take this match”.",
      "When a board finishes, tap who won it, or “Draw”. A win is a point; a draw is half a point each.",
      "Enter every board, then tap “End match”.",
    ],
    sections: [
      HOLDING,
      {
        title: "During the match",
        points: [
          "Each board has its own row. Tap the winner when that board finishes, or “Draw” for a draw.",
          "The score at the top is the board total: a win is 1, a draw is ½ each.",
        ],
      },
      {
        title: "At the end",
        points: ["Once every board is in, tap “End match”. If it’s level in a knockout, it asks who won the tie-break."],
      },
      MISTAKES,
      SIGNAL,
    ],
  },
  sets: {
    title: "Recording sets",
    quick: [
      "Tap “Take this match”.",
      "Tap a side every time they win a rally. The line under the buttons says what wins the set.",
      "When someone has won the set, an “End set” button appears. Tap it to start the next set.",
      "The match ends by itself when someone wins enough sets.",
    ],
    sections: [
      HOLDING,
      {
        title: "During the match",
        points: [
          "One tap is one point to that side. The set score shows at the top.",
          "The line under the buttons says the target, for example “Set 1 to 25, win by 2”.",
          "Once a side has won the set, tap “End set” to close it. The next set starts at 0–0.",
        ],
      },
      { title: "At the end", points: ["When a side wins enough sets the match ends by itself. A retirement or injury is ended by the admin."] },
      MISTAKES,
      SIGNAL,
    ],
  },
  race: {
    title: "Recording a race",
    quick: [
      "Tap “Take this match”.",
      "1. Entrants: add everyone in the race with their year and lane, then “Save entrants”.",
      "2. Results: after the race, enter each place and time, or DNF, DNS or DQ.",
      "“Save” keeps results private. “Publish” makes them public and final.",
    ],
    sections: [
      HOLDING,
      {
        title: "Entrants",
        points: [
          "Add everyone in the race: their year, their name (blank for a relay team) and their lane. Then tap “Save entrants”.",
          "Once results are in, the entrants are locked. Ask the admin to change them.",
        ],
      },
      {
        title: "Results",
        points: [
          "Enter each entrant’s place and time, or mark DNF (didn’t finish), DNS (didn’t start) or DQ (disqualified).",
          "“Save” keeps the results private, so you can check them. “Publish” makes the race public and final; every entrant needs a result first.",
          "A published race can only be changed by the admin.",
        ],
      },
    ],
  },
};
