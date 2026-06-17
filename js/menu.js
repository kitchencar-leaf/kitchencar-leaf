// Renders the MENU section from the "menu" Google Sheet tab and wires up
// the tap-to-enlarge modal.
const MenuView = (() => {
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPrice(price) {
    const n = Number(String(price).replace(/[^\d.]/g, ''));
    if (!price || Number.isNaN(n)) return '¥—';
    return `¥${n.toLocaleString('ja-JP')}`;
  }

  function cardHtml(item, index) {
    const hasImage = item.image && item.image.trim() !== '';
    const isRecommended = String(item.recommend).trim().toUpperCase() === 'TRUE';
    return `
      <div class="menu-card" data-index="${index}" tabindex="0" role="button" aria-label="${escapeHtml(item.name)}の詳細を見る">
        ${isRecommended ? '<div class="menu-card__badge">おすすめ</div>' : ''}
        <div class="menu-card__image">
          ${hasImage
            ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy">`
            : `<div class="menu-card__noimage">No Image</div>`}
        </div>
        <div class="menu-card__body">
          ${item.category ? `<div class="menu-card__category">${escapeHtml(item.category)}</div>` : ''}
          <div class="menu-card__name">${escapeHtml(item.name)}</div>
          <div class="menu-card__price">${formatPrice(item.price)}</div>
        </div>
      </div>
    `;
  }

  function openModal(item) {
    const modal = document.getElementById('menuModal');
    const hasImage = item.image && item.image.trim() !== '';

    modal.querySelector('.menu-modal__image').innerHTML = hasImage
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
      : `<div class="menu-card__noimage">No Image</div>`;
    modal.querySelector('.menu-modal__category').textContent = item.category || '';
    modal.querySelector('.menu-modal__category').style.display = item.category ? '' : 'none';
    modal.querySelector('.menu-modal__name').textContent = item.name;
    modal.querySelector('.menu-modal__desc').textContent = item.desc || '';
    modal.querySelector('.menu-modal__desc').style.display = item.desc ? '' : 'none';
    modal.querySelector('.menu-modal__price').textContent = formatPrice(item.price);

    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    const modal = document.getElementById('menuModal');
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  function setupModal(items) {
    const modal = document.getElementById('menuModal');
    if (!modal) return;

    modal.querySelector('.menu-modal__close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });

    document.querySelectorAll('.menu-card').forEach((card) => {
      const index = Number(card.dataset.index);
      const open = () => openModal(items[index]);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  async function render() {
    const grid = document.querySelector('.menu-cards');
    if (!grid) return;

    try {
      const items = await SHEETS.fetchSheet('menu');
      if (!items.length) {
        grid.innerHTML = '<p class="menu-cards__empty">現在、メニュー情報がありません。</p>';
        return;
      }

      grid.innerHTML = items.map(cardHtml).join('');
      setupModal(items);
    } catch (err) {
      console.error('MenuView: failed to load menu sheet', err);
      grid.innerHTML = '<p class="menu-cards__empty">メニュー情報の読み込みに失敗しました。</p>';
    }
  }

  return { render };
})();
