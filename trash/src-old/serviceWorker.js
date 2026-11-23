// Registers public/sw.js (built game only): versioned map tiles and media come from the
// device's cache on repeat visits, and the page is always revalidated (never stale HTML
// pointing at the JavaScript of an older deploy). ?nosw unregisters it, for testing.
export function registerServiceWorker(base) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (new URLSearchParams(location.search).has('nosw')) {
    navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister())).catch(() => {});
    return;
  }
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((err) => console.info('Service worker not registered:', err.message));
}
