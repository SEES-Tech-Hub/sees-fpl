// Owner: Samuel (PWA). Chrome fires `beforeinstallprompt` once per page load,
// often before React has hydrated, so InstallPrompt could miss it. This inline
// script runs while the HTML is parsed, before any Next.js code, and keeps the
// event on window for InstallPrompt to pick up. Render it once, at the top of
// <body> in the root layout.
export const EARLY_INSTALL_EVENT_KEY = "__seesInstallPrompt";

const script = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.${EARLY_INSTALL_EVENT_KEY}=e;});`;

export function EarlyInstallCapture() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
