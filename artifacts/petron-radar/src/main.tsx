import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register(`${base}/sw.js`, { scope: `${base}/` })
        .catch(() => {});
    });
  } else {
    // In development the SW must NOT run: Vite serves modules at stable paths
    // and a cache-first SW would serve stale code. Tear down any SW left over
    // from a previous load and purge its caches so the dev preview is always fresh.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }
}

createRoot(document.getElementById("root")!).render(<App />);
