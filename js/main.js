(() => {
  const btn = document.getElementById('hamburgerBtn');
  const drawer = document.getElementById('navDrawer');
  if (!btn || !drawer) return;

  btn.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  drawer.querySelectorAll('span').forEach((link) => {
    link.addEventListener('click', () => {
      drawer.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
})();

ScheduleView.render();
MenuView.render();
