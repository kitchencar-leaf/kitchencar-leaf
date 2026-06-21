// Renders the MENU section from the "menu" Google Sheet tab: tab filtering
// (おすすめ/季節限定/フード/ドリンク/その他), card grid, and the
// tap-to-enlarge modal.
const MenuView = (() => {
  const CATEGORY_FALLBACK = {
    food: 'food',
    drink: 'drink',
    other: 'other',
    main: 'food',
    side: 'food',
    limited: 'food',
    soup: 'food',
    sandwich: 'food',
  };

  const TABS = [
    { key: 'recommend', label: 'おすすめ', filter: (item) => item.recommend },
    { key: 'seasonal', label: '季節限定', filter: (item) => item.seasonal },
    { key: 'food', label: 'フード', filter: (item) => item.category === 'food' },
    { key: 'drink', label: 'ドリンク', filter: (item) => item.category === 'drink' },
    { key: 'other', label: 'その他', filter: (item) => item.category === 'other' },
  ];

  let allItems = [];
  let currentTab = TABS[0].key;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseBool(value) {
    return String(value || '').trim().toUpperCase() === 'TRUE';
  }

  function parseVisible(value) {
    const trimmed = String(value || '').trim();
    if (trimmed === '') return true; // legacy rows with no visible column
    return trimmed.toUpperCase() === 'TRUE';
  }

  function normalizeCategory(raw) {
    const value = String(raw || '').trim().toLowerCase();
    return CATEGORY_FALLBACK[value] || 'food';
  }

  function parseSortOrder(raw) {
    const n = Number(String(raw || '').trim());
    return Number.isFinite(n) && String(raw || '').trim() !== '' ? n : 9999;
  }

  function normalizeItem(row) {
    return {
      ...row,
      category: normalizeCategory(row.category),
      recommend: parseBool(row.recommend),
      seasonal: parseBool(row.seasonal),
      visible: parseVisible(row.visible),
      sortOrder: parseSortOrder(row.sort_order),
    };
  }

  function formatPrice(price) {
    const trimmed = String(price || '').trim();
    if (!trimmed) return null;
    const n = Number(trimmed.replace(/[^\d.]/g, ''));
    if (Number.isNaN(n)) return null;
    return `${n.toLocaleString('ja-JP')}円`;
  }

  function badgeImagesHtml(item) {
    return `
      ${item.recommend ? '<img src="assets/images/badge-recommend.png" class="menu-card__badge-img" alt="おすすめ">' : ''}
      ${item.seasonal ? '<img src="assets/images/badge-seasonal.png" class="menu-card__badge-img" alt="季節限定">' : ''}
    `;
  }

  function badgesHtml(item) {
    if (!item.recommend && !item.seasonal) return '';
    return `<div class="menu-card__badges">${badgeImagesHtml(item)}</div>`;
  }

  function cardHtml(item, index) {
    const hasImage = item.image && item.image.trim() !== '';
    const price = formatPrice(item.price);
    return `
      <div class="menu-card" data-index="${index}" tabindex="0" role="button" aria-label="${escapeHtml(item.name)}の詳細を見る">
        <div class="menu-card__image">
          ${badgesHtml(item)}
          ${hasImage
            ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy">`
            : `<div class="menu-card__noimage"><img src="assets/images/leaf-img11.png" alt=""></div>`}
        </div>
        <div class="menu-card__body">
          <div class="menu-card__name">${escapeHtml(item.name)}</div>
          ${item.desc ? `<p class="menu-card__desc">${escapeHtml(item.desc)}</p>` : ''}
          ${price ? `<div class="menu-card__price">${price}</div>` : ''}
        </div>
      </div>
    `;
  }

  function openModal(item) {
    const modal = document.getElementById('menuModal');
    const hasImage = item.image && item.image.trim() !== '';

    modal.querySelector('.menu-modal__image-inner').innerHTML = hasImage
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
      : `<div class="menu-card__noimage"><img src="assets/images/leaf-img11.png" alt=""></div>`;
    modal.querySelector('.menu-modal__badges').innerHTML = badgeImagesHtml(item);
    modal.querySelector('.menu-modal__category').textContent = '';
    modal.querySelector('.menu-modal__category').style.display = 'none';
    modal.querySelector('.menu-modal__name').textContent = item.name;
    modal.querySelector('.menu-modal__desc').textContent = item.desc || '';
    modal.querySelector('.menu-modal__desc').style.display = item.desc ? '' : 'none';
    const price = formatPrice(item.price);
    modal.querySelector('.menu-modal__price').textContent = price || '';
    modal.querySelector('.menu-modal__price').style.display = price ? '' : 'none';

    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    const modal = document.getElementById('menuModal');
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  function setupModalChrome() {
    const modal = document.getElementById('menuModal');
    if (!modal) return;

    modal.querySelector('.menu-modal__close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
  }

  function bindCardClicks(items) {
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

  function renderGrid() {
    const grid = document.querySelector('.menu-cards');
    if (!grid) return;

    const tab = TABS.find((t) => t.key === currentTab) || TABS[0];
    const filtered = allItems.filter(tab.filter);

    if (!filtered.length) {
      grid.innerHTML = '<p class="menu-cards__empty">現在表示できるメニューはありません。</p>';
      return;
    }

    grid.innerHTML = filtered.map((item, i) => cardHtml(item, i)).join('');
    bindCardClicks(filtered);
  }

  function setupTabs() {
    const tabsEl = document.getElementById('menuTabs');
    if (!tabsEl) return;

    tabsEl.querySelectorAll('.menu-tabs__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        currentTab = btn.dataset.tab;
        tabsEl.querySelectorAll('.menu-tabs__btn').forEach((b) => b.classList.toggle('is-active', b === btn));
        renderGrid();
      });
    });
  }

  async function render() {
    const grid = document.querySelector('.menu-cards');
    if (!grid) return;

    try {
      const rows = await SHEETS.fetchSheet('menu');
      allItems = rows
        .map(normalizeItem)
        .filter((item) => item.visible)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      renderGrid();
      setupTabs();
      setupModalChrome();
    } catch (err) {
      console.error('MenuView: failed to load menu sheet', err);
      grid.innerHTML = '<p class="menu-cards__empty">メニュー情報の読み込みに失敗しました。</p>';
    }
  }

  return { render };
})();
