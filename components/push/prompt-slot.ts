// The install card and the match alerts card both pop up from the bottom of
// the screen. Only one of them shows per visit, so nobody gets two at once:
// whichever comes first takes the slot for this tab.

const KEY = "sees:prompt-shown";

export function promptSlotTaken() {
  try {
    return sessionStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function takePromptSlot(which: "install" | "alerts") {
  try {
    if (sessionStorage.getItem(KEY) !== null) return false;
    sessionStorage.setItem(KEY, which);
  } catch {
    // Storage refused (private browsing): let it show.
  }
  return true;
}
