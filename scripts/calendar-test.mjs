// Headless test of calendar.html's inline script: splice check + parser/render
// behaviour against a hostile fixture (folded lines, escapes, XSS title,
// timed multi-day, in-progress and finished all-day events).
import fs from 'fs';
import vm from 'vm';

const html = fs.readFileSync(new URL('../calendar.html', import.meta.url), 'utf8');
const m = html.match(/<script>\s*\/\/ Calendar state([\s\S]*?)<\/script>/);
if (!m) throw new Error('inline script not found');
const js = '// Calendar state' + m[1];

const today = new Date();
const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const addD = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };

// Fixture: X-LINKS folded across 3 physical lines; escaped chars; XSS title.
const fixture = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:1',
  `DTSTART:${ymd(addD(1))}T181500`, `DTEND:${ymd(addD(1))}T194500`,
  "SUMMARY:Troop Meeting <img src=x onerror=alert(1)> O'Brien\\, Jr.",
  'LOCATION:Jefferson Elementary\\; 100 Princetown Rd\\, Schenectady',
  'DESCRIPTION:Line one\\nLine two',
  'CATEGORIES:MEETING',
  'X-LINKS:Leader Guide|https://scoutingevent.com/Download/364180682/OR/2026_Harve',
  ' st_Festival_Leader_Guide_.pdf|Bad|javascript:alert(1)|Event Guide & Registr',
  ' ation|https://scoutingevent.com/364-CryptidCamporee',
  'END:VEVENT',
  'BEGIN:VEVENT', 'UID:2',
  `DTSTART:${ymd(addD(3))}T170000`, `DTEND:${ymd(addD(5))}T120000`,
  'SUMMARY:Weekend Trip', 'CATEGORIES:CAMPOUT', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:3',
  `DTSTART;VALUE=DATE:${ymd(addD(-1))}`, `DTEND;VALUE=DATE:${ymd(addD(2))}`,
  'SUMMARY:In-Progress Camp', 'CATEGORIES:CAMPOUT', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:4',
  `DTSTART;VALUE=DATE:${ymd(addD(-5))}`, `DTEND;VALUE=DATE:${ymd(addD(-3))}`,
  'SUMMARY:Finished Camp', 'CATEGORIES:CAMPOUT', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:5',
  `DTSTART:${ymd(addD(2))}T190000`, `DTEND:${ymd(addD(2))}T203000`,
  'SUMMARY:Committee Meeting', 'CATEGORIES:COMMITTEE', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:6',
  `DTSTART;VALUE=DATE:${ymd(addD(0))}`, `DTEND;VALUE=DATE:${ymd(addD(1))}`,
  'SUMMARY:Today All Day', 'CATEGORIES:OTHER', 'END:VEVENT',
  'END:VCALENDAR', '',
].join('\r\n');

// Minimal DOM stub: enough for the script to run and for us to read output.
const els = {};
const mkEl = (id) => ({
  id, innerHTML: '', textContent: '', style: {}, dataset: {}, alt: '', src: '', children: [],
  classList: { add() {}, remove() {} },
  addEventListener() {},
  insertAdjacentHTML(_, s) { this.innerHTML += s; },
  appendChild(c) { this.children.push(c); },
  querySelector() { return { focus() {} }; },
  focus() {},
});
const doc = {
  getElementById: (id) => (els[id] ||= mkEl(id)),
  querySelectorAll: () => [mkEl('b0'), mkEl('b1')],
  addEventListener() {},
  createElement: (t) => ({ tag: t, set href(v) { this._href = v; }, get href() { return this._href; } }),
  activeElement: null,
};
const sandbox = {
  document: doc, console, Date, Intl, Number, String, parseInt, RegExp, Error, Math,
  window: { matchMedia: () => ({ matches: false }) },
  fetch: async () => ({ ok: true, text: async () => fixture }),
  setTimeout,
};
vm.createContext(sandbox);
vm.runInContext(js, sandbox);
// Top-level let/const live in the context's script scope, not on the global
// object — a second script in the same context can still reach them.
vm.runInContext(`globalThis.__api = {
  get events() { return events; }, changeMonth, formatEventTime, showEvent,
  get currentDate() { return currentDate; }, set currentDate(v) { currentDate = v; },
};`, sandbox);
await new Promise((r) => setTimeout(r, 30));

const api = sandbox.__api;
const ev = api.events;
const list = els['upcoming-events'].innerHTML;
const grid = els['cal-grid'].innerHTML;
const checks = [];
const ok = (name, cond, info = '') => checks.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : info]);

ok('6 events parsed', ev.length === 6, `got ${ev.length}`);
const meet = ev.find((e) => e.summary.startsWith('Troop Meeting'));
ok('unfolded X-LINKS reassembled', meet.links.includes('2026_Harvest_Festival_Leader_Guide_.pdf|Bad'), meet.links);
ok('\\, and \\; unescaped', meet.location === 'Jefferson Elementary; 100 Princetown Rd, Schenectady' && meet.summary.endsWith("O'Brien, Jr."), meet.location);
ok('\\n unescaped in description', meet.description === 'Line one\nLine two', JSON.stringify(meet.description));
ok('XSS title escaped in list', list.includes('&lt;img src=x onerror=alert(1)&gt;') && !list.includes('<img src=x'), '');
ok('XSS title escaped in grid', !grid.includes('<img src=x'), '');
ok('no inline onclick JSON anywhere', !list.includes('onclick=\'showEvent') && !grid.includes('onclick=\'showEvent'), '');
ok('rows/chips are buttons with data-i', list.includes('<button type="button" class="upcoming-item" data-i="'), '');
ok('CATEGORIES drive type (committee)', ev.find((e) => e.summary === 'Committee Meeting').type === 'committee', '');
ok('CAMPOUT -> camping', ev.find((e) => e.summary === 'Weekend Trip').type === 'camping', '');
ok('list keeps today all-day event', list.includes('Today All Day'), '');
ok('list keeps in-progress camp', list.includes('In-Progress Camp'), '');
ok('list drops finished camp', !list.includes('Finished Camp'), '');
const trip = ev.find((e) => e.summary === 'Weekend Trip');
const tt = api.formatEventTime(trip);
ok('timed multi-day names both days', /^\w{3} 5:00 PM – \w{3} 12:00 PM$/.test(tt), tt);
ok('same-day time range', api.formatEventTime(meet) === '6:15 PM – 7:45 PM', api.formatEventTime(meet));
ok('chip shows start time', /class="t">6:15<\/span> Troop Meeting/.test(grid), 'no 6:15 chip in current month grid');
// Month navigation from the 31st must not skip a month
api.currentDate = new Date(2026, 0, 31);
api.changeMonth(1);
ok('Jan 31 + 1 month = Feb', api.currentDate.getMonth() === 1, String(api.currentDate));
// showEvent builds only http(s) links
api.showEvent(meet);
const hrefs = els['modal-links'].children.map((a) => a.href);
ok('javascript: link dropped, 2 https links kept', hrefs.length === 2 && hrefs.every((h) => h.startsWith('https://')), JSON.stringify(hrefs));
ok('modal uses textContent for title', els['modal-title'].textContent === meet.summary, '');
ok('flyer alt set', els['modal-flyer'].alt.endsWith(' flyer'), '');

for (const [s, n, i] of checks) console.log(`  ${s}  ${n}${i ? '  -> ' + i : ''}`);
const fails = checks.filter((c) => c[0] === 'FAIL').length;
console.log(`RESULT: ${checks.length - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
