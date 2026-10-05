import { App } from './ui/app.js';

// After a deploy the browser can mix fresh modules with old ones from its
// HTTP cache, and start-up fails with errors such as "x is not a function".
// Fetch every script, style and data file again past the cache and reload,
// at most once a minute so a real bug cannot cause a reload loop.
async function refreshAndReload() {
  try {
    const key = 'billions-refresh', last = +(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 60000) return false;
    sessionStorage.setItem(key, String(Date.now()));
  } catch (e) { return false; }
  const urls = new Set(performance.getEntriesByType('resource').map((r) => r.name)
    .filter((u) => u.startsWith(location.origin) && /\.(m?js|css|json)(\?|$)/.test(u)));
  for (const s of document.scripts) if (s.src) urls.add(s.src);
  await Promise.all([...urls].map((u) => fetch(u, { cache: 'reload' }).catch(() => null)));
  location.reload();
  return true;
}

window.addEventListener('load', () => {
  const app = new App();
  window.BILLIONS = app;
  app.boot().catch(async (e) => {
    console.error(e);
    if (await refreshAndReload()) return;
    document.getElementById('load-text').textContent = 'Failed to start: ' + e.message + '. Reload the page to get the latest version.';
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
