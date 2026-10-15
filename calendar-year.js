// Troop 3054's program year (September to August) as months and rows, ready
// to lay out. The print page (calendar-print.html) turns it into HTML and the
// PDF download (calendar-pdf.js) draws it, so both say the same thing.
// Events come from either page's feed parser: { summary, location, start,
// end, allDay, openEnd, type }.
(function (root) {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  // 6:15 PM, or 6:15 for the first half of a range that stays PM.
  const clock = (d, withHalf = true) => {
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, '0');
    return withHalf ? `${h}:${m} ${d.getHours() < 12 ? 'AM' : 'PM'}` : `${h}:${m}`;
  };
  const multiDay = (ev) => Boolean(ev.end) && startOfDay(ev.end) > startOfDay(ev.start);

  // "6:15 to 7:45 PM" | "8:30 AM to 4:00 PM" | "Fri 5:00 PM to Sun 12:00 PM" |
  // "Leaves Fri 5:00 PM" (no return time yet) | "All day"
  function timeText(ev) {
    if (ev.allDay) return multiDay(ev) ? '' : 'All day';
    if (!ev.end) return clock(ev.start);
    if (!multiDay(ev)) {
      const sameHalf = (ev.start.getHours() < 12) === (ev.end.getHours() < 12);
      return `${clock(ev.start, !sameHalf)} to ${clock(ev.end)}`;
    }
    if (ev.openEnd) return `Leaves ${WD[ev.start.getDay()]} ${clock(ev.start)}`;
    return `${WD[ev.start.getDay()]} ${clock(ev.start)} to ${WD[ev.end.getDay()]} ${clock(ev.end)}`;
  }

  // Jefferson is in the masthead, so it gets its short name. Elsewhere, the
  // first part of the address, plus the next part when the first is short.
  function placeText(loc) {
    if (!loc) return '';
    if (/^Jefferson Elementary/i.test(loc)) return 'Jefferson';
    const parts = loc.split(',').map((s) => s.trim()).filter(Boolean);
    return parts[0].length < 12 && parts[1] ? `${parts[0]}, ${parts[1]}` : parts[0];
  }

  // The date column: "14" over "Mon"; a trip shows "9–11" over "Fri–Sun".
  function whenParts(ev) {
    if (!multiDay(ev)) return { big: String(ev.start.getDate()), small: WD[ev.start.getDay()] };
    const sameMonth = ev.end.getMonth() === ev.start.getMonth();
    const big = sameMonth
      ? `${ev.start.getDate()}–${ev.end.getDate()}`
      : `${ev.start.getDate()}–${MON[ev.end.getMonth()]} ${ev.end.getDate()}`;
    return { big, small: `${WD[ev.start.getDay()]}–${WD[ev.end.getDay()]}` };
  }

  // Regular meetings read lighter, so the outings and special days stand out.
  const ROUTINE = /^(troop meeting|plc meeting|committee meeting)$/i;

  // The program year runs September to August; from July on, it's next year's.
  function programYear(now, asked) {
    const n = Number(asked);
    if (asked != null && asked !== '' && Number.isInteger(n) && n > 2000 && n < 2100) return n;
    return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  }

  function yearModel(events, year, now) {
    const from = new Date(year, 8, 1);
    const to = new Date(year + 1, 8, 1);
    const byMonth = new Map();
    for (const e of events.filter((x) => x.start >= from && x.start < to).sort((a, b) => a.start - b.start)) {
      const key = e.start.getFullYear() * 12 + e.start.getMonth();
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(e);
    }
    const months = [...byMonth].map(([key, list]) => ({
      name: `${MONTHS[key % 12]} ${Math.floor(key / 12)}`,
      long: list.length > 9,
      rows: list.map((e) => ({
        ...whenParts(e),
        title: e.summary,
        meta: [timeText(e), placeText(e.location)].filter(Boolean).join(' · '),
        type: e.type,
        routine: ROUTINE.test(e.summary.trim()),
      })),
    }));
    return {
      year,
      label: `${year}–${String(year + 1).slice(2)}`,
      printed: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      months,
    };
  }

  root.CalYear = { programYear, yearModel, timeText, placeText, whenParts };
})(globalThis);
