'use strict';
window.addEventListener('load', () => {
  const canvas = document.getElementById('game');
  const game = new Game();
  const renderer = new Renderer(canvas, game);
  const ui = new UI(game, renderer);
  const input = new Input(canvas, game, renderer, ui);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.update(dt);
    renderer.draw();
    ui.tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.BILLIONS = { game, renderer, ui, input };
});
