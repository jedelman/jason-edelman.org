// Trailers: a game card's picture opens its trailer in a modal player, a native <dialog> (Escape, the × or the
// backdrop closes it, and the video stops). Without JavaScript, or a browser without <dialog>, the picture's link
// opens the video file itself.
(() => {
  const dlg = document.getElementById('trailer');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const video = dlg.querySelector('video');
  const title = dlg.querySelector('#trailer-title');
  const play = dlg.querySelector('.trailer-play');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.trailer-link');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab: the file
    e.preventDefault();
    title.textContent = `${a.dataset.title} · trailer`;
    play.href = a.dataset.play;
    video.poster = a.dataset.poster || '';
    video.src = a.dataset.trailer;
    dlg.showModal();
    if (!still.matches) video.play().catch(() => {}); // the controls are there if it won't start
  });

  dlg.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src'); // stop downloading
    video.load();
  });
  dlg.querySelector('.trailer-close').addEventListener('click', () => dlg.close());
  // a click on the backdrop lands on the dialog itself (its contents are in .trailer-inner)
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
})();
