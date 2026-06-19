// Renders the SCHEDULE section (calendar + upcoming event list) from the
// "schedule" Google Sheet tab.
const ScheduleView = (() => {
  const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'];

  const TYPE_LABEL = {
    regular: '通常出店',
    event: 'イベント出店',
    closed: 'お休み',
    canceled: '中止',
  };

  // schedule_type: regular / event / closed. Legacy "away" rows are treated
  // as "event".
  function normalizeScheduleType(type) {
    const value = String(type || 'regular').trim();
    if (value === 'away' || value === 'event') return 'event';
    if (value === 'closed') return 'closed';
    return 'regular';
  }

  // status: open / canceled / hidden. Legacy "soldout" rows are treated like
  // canceled since the operation no longer distinguishes sold-out days.
  function normalizeStatus(status) {
    const value = String(status || 'open').trim();
    if (value === 'soldout') return 'canceled';
    return value;
  }

  // Display priority: hidden (excluded) > canceled > closed > event > regular.
  // Returns null for hidden rows, which callers must treat as "don't show".
  function getScheduleDisplayType(item) {
    const status = normalizeStatus(item.status);
    const type = normalizeScheduleType(item.schedule_type);

    if (status === 'hidden') return null;
    if (status === 'canceled') return 'canceled';
    if (type === 'closed') return 'closed';
    if (type === 'event') return 'event';
    return 'regular';
  }

  function shouldShowInUpcoming(item) {
    const displayType = getScheduleDisplayType(item);
    if (!displayType) return false;
    if (displayType === 'closed') return false;
    if (displayType === 'canceled') return false;
    return true;
  }

  let allEvents = [];
  let calendarYear;
  let calendarMonth; // 0-indexed

  function parseDate(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr).trim());
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatEventDate(date) {
    return `${date.getMonth() + 1}/${date.getDate()}（${WEEKDAY_JP[date.getDay()]}）`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- Upcoming list (next 3 visible entries from today onward, regardless
  // of how many days apart they are) ----

  function eventItemHtml(ev) {
    const type = getScheduleDisplayType(ev);
    return `
      <div class="event-item" data-day="${ev.dateObj.getTime()}">
        <div class="event-item__date-row">
          <span class="event-item__date">${formatEventDate(ev.dateObj)}</span>
          ${ev.start_time ? `<span class="event-item__time">${escapeHtml(ev.start_time)}${ev.end_time ? `–${escapeHtml(ev.end_time)}` : ''}</span>` : ''}
          ${type === 'event' ? '<span class="event-item__status event-item__status--event">イベント出店</span>' : ''}
        </div>
        ${ev.place ? `
        <div class="event-item__place">
          <img src="assets/images/leaf-icon05.png" alt="">
          <span>${escapeHtml(ev.place)}</span>
        </div>` : ''}
        ${ev.map_url ? `<a href="${escapeHtml(ev.map_url)}" target="_blank" rel="noopener" class="event-item__map">MAPを見る</a>` : ''}
      </div>
    `;
  }

  function renderEventList() {
    const list = document.querySelector('.event-list');
    if (!list) return;

    const today = startOfToday();
    const upcoming = allEvents
      .filter((ev) => ev.dateObj && ev.dateObj >= today && shouldShowInUpcoming(ev))
      .slice(0, 3);

    if (!upcoming.length) {
      list.innerHTML = '<p class="event-list__empty">現在、出店予定はありません。</p>';
      return;
    }
    list.innerHTML = upcoming.map(eventItemHtml).join('');
  }

  // ---- Calendar ----

  function dayCellHtml(day, ev) {
    const dowClass = (weekday) => (weekday === 0 ? ' sun' : weekday === 6 ? ' sat' : '');
    const weekday = new Date(calendarYear, calendarMonth, day).getDay();

    if (!ev) {
      return `<div class="calendar__day-cell"><span class="calendar__day-cell__num${dowClass(weekday)}">${day}</span></div>`;
    }

    const type = getScheduleDisplayType(ev);
    if (!type) {
      return `<div class="calendar__day-cell"><span class="calendar__day-cell__num${dowClass(weekday)}">${day}</span></div>`;
    }

    let inner = `<span class="calendar__day-cell__num">${day}</span>`;
    if (type === 'closed') {
      inner += '<span class="calendar__day-cell__watermark">休</span>';
    } else if (type === 'canceled') {
      inner += '<span class="calendar__day-cell__mark">中止</span>';
      if (ev.place) {
        inner += `<span class="calendar__day-cell__place">${escapeHtml(ev.place)}</span>`;
      }
    } else if (ev.place) {
      inner += `<span class="calendar__day-cell__place">${escapeHtml(ev.place)}</span>`;
    }

    return `<div class="calendar__day-cell calendar__day-cell--${type} calendar__day-cell--has-data" data-day="${day}">${inner}</div>`;
  }

  function renderCalendar() {
    const grid = document.querySelector('.calendar__days');
    const title = document.querySelector('.calendar__title');
    if (!grid || !title) return;

    title.textContent = `${calendarYear}年 ${calendarMonth + 1}月`;

    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const startWeekday = firstDay.getDay();

    const eventsByDay = {};
    allEvents.forEach((ev) => {
      if (!ev.dateObj) return;
      if (ev.dateObj.getFullYear() === calendarYear && ev.dateObj.getMonth() === calendarMonth) {
        if (getScheduleDisplayType(ev)) {
          eventsByDay[ev.dateObj.getDate()] = ev;
        }
      }
    });

    let html = '';
    for (let i = 0; i < startWeekday; i++) {
      html += '<div class="calendar__day-cell empty"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
      html += dayCellHtml(day, eventsByDay[day]);
    }
    grid.innerHTML = html;

    grid.querySelectorAll('.calendar__day-cell--has-data').forEach((cell) => {
      const day = Number(cell.dataset.day);
      cell.addEventListener('click', () => openScheduleModal(eventsByDay[day]));
    });
  }

  function setupCalendarNav() {
    const [prevBtn, nextBtn] = document.querySelectorAll('.calendar__nav');
    if (!prevBtn || !nextBtn) return;

    prevBtn.addEventListener('click', () => {
      calendarMonth -= 1;
      if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear -= 1;
      }
      renderCalendar();
    });
    nextBtn.addEventListener('click', () => {
      calendarMonth += 1;
      if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear += 1;
      }
      renderCalendar();
    });
  }

  // ---- Detail modal ----

  function modalContentHtml(ev) {
    const type = getScheduleDisplayType(ev);

    const rows = [];
    if (ev.place) rows.push(['出店場所', escapeHtml(ev.place)]);
    if (ev.address) rows.push(['住所', escapeHtml(ev.address)]);
    if (ev.start_time || ev.end_time) {
      rows.push(['時間', `${escapeHtml(ev.start_time || '')}${ev.end_time ? `–${escapeHtml(ev.end_time)}` : ''}`]);
    }

    return `
      <span class="schedule-modal__badge schedule-modal__badge--${type}">${TYPE_LABEL[type]}</span>
      <div class="schedule-modal__date">${formatEventDate(ev.dateObj)}</div>
      <div class="schedule-modal__rows">
        ${rows.map(([label, value]) => `
        <div class="schedule-modal__row">
          <span class="schedule-modal__row-label">${label}</span>
          <span class="schedule-modal__row-value">${value}</span>
        </div>`).join('')}
      </div>
      ${ev.note ? `<p class="schedule-modal__note">${escapeHtml(ev.note)}</p>` : ''}
      ${ev.map_url ? `<a href="${escapeHtml(ev.map_url)}" target="_blank" rel="noopener" class="schedule-modal__map-btn">Googleマップで見る</a>` : ''}
    `;
  }

  function openScheduleModal(ev) {
    const modal = document.getElementById('scheduleModal');
    if (!modal) return;
    modal.querySelector('.schedule-modal__body').innerHTML = modalContentHtml(ev);
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
  }

  function closeScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  function setupModal() {
    const modal = document.getElementById('scheduleModal');
    if (!modal) return;

    modal.querySelector('.schedule-modal__close').addEventListener('click', closeScheduleModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeScheduleModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeScheduleModal();
    });
  }

  async function render() {
    const today = startOfToday();
    calendarYear = today.getFullYear();
    calendarMonth = today.getMonth();

    try {
      const rows = await SHEETS.fetchSheet('schedule');
      allEvents = rows
        .map((row) => ({ ...row, dateObj: parseDate(row.date) }))
        .filter((row) => row.dateObj && getScheduleDisplayType(row) !== null)
        .sort((a, b) => a.dateObj - b.dateObj);
    } catch (err) {
      console.error('ScheduleView: failed to load schedule sheet', err);
      allEvents = [];
    }

    renderEventList();
    renderCalendar();
    setupCalendarNav();
    setupModal();
  }

  return { render };
})();
