// Renders the SCHEDULE section (calendar + upcoming event list) from the
// "schedule" Google Sheet tab.
const ScheduleView = (() => {
  const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'];
  const STATUS_LABEL = { canceled: '中止', soldout: '完売' };

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

  function eventItemHtml(ev) {
    const statusLabel = STATUS_LABEL[ev.status];
    return `
      <div class="event-item${ev.status === 'canceled' ? ' event-item--canceled' : ''}">
        <div class="event-item__date-row">
          <span class="event-item__date">${formatEventDate(ev.dateObj)}</span>
          ${ev.start_time ? `<span class="event-item__time">${escapeHtml(ev.start_time)}${ev.end_time ? `–${escapeHtml(ev.end_time)}` : ''}</span>` : ''}
          ${statusLabel ? `<span class="event-item__status event-item__status--${ev.status}">${statusLabel}</span>` : ''}
        </div>
        ${ev.place ? `
        <div class="event-item__place">
          <img src="assets/images/leaf-icon05.png" alt="">
          <span>${escapeHtml(ev.place)}</span>
        </div>` : ''}
        ${ev.address ? `
        <div class="event-item__tag-row">
          <span class="event-item__tag">${escapeHtml(ev.address)}</span>
        </div>` : ''}
        ${ev.note ? `<div class="event-item__note">${escapeHtml(ev.note)}</div>` : ''}
        ${ev.map_url ? `<a href="${escapeHtml(ev.map_url)}" target="_blank" rel="noopener" class="event-item__map">MAPを見る</a>` : ''}
      </div>
    `;
  }

  function renderEventList() {
    const list = document.querySelector('.event-list');
    if (!list) return;

    const today = startOfToday();
    const upcoming = allEvents.filter((ev) => ev.dateObj && ev.dateObj >= today);

    if (!upcoming.length) {
      list.innerHTML = '<p class="event-list__empty">現在、出店予定はありません。</p>';
      return;
    }
    list.innerHTML = upcoming.map(eventItemHtml).join('');
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
        eventsByDay[ev.dateObj.getDate()] = ev.status;
      }
    });

    let html = '';
    for (let i = 0; i < startWeekday; i++) {
      html += '<div class="calendar__day empty"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const weekday = new Date(calendarYear, calendarMonth, day).getDay();
      const dowClass = weekday === 0 ? ' sun' : weekday === 6 ? ' sat' : '';
      const status = eventsByDay[day];
      if (status) {
        html += `<div class="calendar__day-event"><span class="calendar__day-event--${status}">${day}</span></div>`;
      } else {
        html += `<div class="calendar__day${dowClass}">${day}</div>`;
      }
    }
    grid.innerHTML = html;
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

  async function render() {
    try {
      const rows = await SHEETS.fetchSheet('schedule');
      allEvents = rows
        .filter((row) => row.status !== 'hidden')
        .map((row) => ({ ...row, dateObj: parseDate(row.date) }))
        .filter((row) => row.dateObj)
        .sort((a, b) => a.dateObj - b.dateObj);

      const today = startOfToday();
      calendarYear = today.getFullYear();
      calendarMonth = today.getMonth();

      renderEventList();
      renderCalendar();
      setupCalendarNav();
    } catch (err) {
      console.error('ScheduleView: failed to load schedule sheet', err);
    }
  }

  return { render };
})();
