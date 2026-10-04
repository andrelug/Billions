import { App } from './ui/app.js';

window.addEventListener('load', () => {
  const app = new App();
  window.BILLIONS = app;
  app.boot().catch((e) => { console.error(e); document.getElementById('load-text').textContent = 'Failed to start: ' + e.message; });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
