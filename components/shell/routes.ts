// Owner: Fortune (design kit). Where the site header and bottom tab bar show.
//
// - The console, admin, sign-in and offline pages have their own full-screen
//   layouts (offline: there is nowhere to go without a connection).
// - Fantasy has its own header and section tabs, so the site header steps
//   aside there (the bottom tab bar still links back to the rest of the app).
// - The fantasy squad, lineup and transfer screens have their own bars fixed
//   to the bottom (budget and Save), so the tab bar steps aside there too.

const NO_SHELL = ["/console", "/admin", "/login", "/offline"];
const OWN_HEADER = ["/fantasy"];
const OWN_BOTTOM_BAR = ["/fantasy/squad", "/fantasy/team", "/fantasy/transfers"];

const within = (pathname: string, sections: string[]) =>
  sections.some((s) => pathname === s || pathname.startsWith(`${s}/`));

export function showsHeader(pathname: string) {
  return !within(pathname, NO_SHELL) && !within(pathname, OWN_HEADER);
}

export function showsTabBar(pathname: string) {
  return !within(pathname, NO_SHELL) && !within(pathname, OWN_BOTTOM_BAR);
}
