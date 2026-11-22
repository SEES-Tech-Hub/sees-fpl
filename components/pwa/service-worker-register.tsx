"use client";

import { useEffect } from "react";

// Owner: Samuel (PWA). Registers public/sw.js, which caches only the app shell.
// Production builds only: in `pnpm dev` a service worker would serve stale
// bundles and break hot reload. To test it, run `pnpm build && pnpm start`.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((error) => console.error("Service worker registration failed", error));
    };

    // Wait until the page has loaded so the worker doesn't compete with it.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
