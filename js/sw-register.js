// Service worker registration for PWA offline support

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(err => {
    console.warn("Service Worker registration failed:", err);
  });
}
