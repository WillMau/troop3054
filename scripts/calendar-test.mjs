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
  'SUMMARY:Weekend Trip', 'CATEGORIES:CAMPOUT', 'X-RSVP:https://my.troop3054.org/#/event/2/rsvp', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:3',
  `DTSTART;VALUE=DATE:${ymd(addD(-1))}`, `DTEND;VALUE=DATE:${ymd(addD(2))}`,
  'SUMMARY:In-Progress Camp', 'CATEGORIES:CAMPOUT', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:4',
  `DTSTART;VALUE=DATE:${ymd(addD(-5))}`, `DTEND;VALUE=DATE:${ymd(addD(-3))}`,
  'SUMMARY:Finished Camp', 'CATEGORIES:CAMPOUT', 'X-RSVP:https://my.troop3054.org/#/event/4/rsvp', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:5',
  `DTSTART:${ymd(addD(2))}T190000`, `DTEND:${ymd(addD(2))}T203000`,
  'SUMMARY:Committee Meeting', 'CATEGORIES:COMMITTEE', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:6',
  `DTSTART;VALUE=DATE:${ymd(addD(0))}`, `DTEND;VALUE=DATE:${ymd(addD(1))}`,
  'SUMMARY:Today All Day', 'CATEGORIES:OTHER', 'END:VEVENT',
  // Flyer shared by the app (X-IMAGE), and one with a non-https value
  'BEGIN:VEVENT', 'UID:7',
  `DTSTART;VALUE=DATE:${ymd(addD(4))}`, `DTEND;VALUE=DATE:${ymd(addD(5))}`,
  'SUMMARY:Shared Flyer Event', 'CATEGORIES:CAMPOUT',
  'X-IMAGE:https://my.troop3054.org/api/flyer/92', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:8',
  `DTSTART;VALUE=DATE:${ymd(addD(6))}`, `DTEND;VALUE=DATE:${ymd(addD(7))}`,
  'SUMMARY:Bad Image Event', 'CATEGORIES:CAMPOUT',
  'X-IMAGE:javascript:alert(1)', 'X-RSVP:javascript:alert(1)', 'END:VEVENT',
  // A trip with a departure time but no return time yet: the app ends it at
  // midnight after the last day.
  'BEGIN:VEVENT', 'UID:9',
  `DTSTART:${ymd(addD(8))}T170000`, `DTEND:${ymd(addD(11))}T000000`,
  'SUMMARY:Departure Only Trip', 'CATEGORIES:CAMPOUT', 'END:VEVENT',
  'END:VCALENDAR', '',
].join('\r\n');

// Pack 3054's feed, as pack3054.org builds it: a den meeting with a start time
// and no end, and an all-day picnic.
const packFixture = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:Cub Scout Pack 3054',
  'BEGIN:VEVENT', 'UID:p1@pack3054', `DTSTART:${ymd(addD(2))}T181500`,
  'SUMMARY:Den Meeting (Lions & Tigers)', 'LOCATION:Jefferson Elementary cafeteria\\, 100 Princetown Rd',
  'DESCRIPTION:Lions and Tigers come with their adult partner.\\nPack 3054 calendar: https://pack3054.org/calendar.html', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:p2@pack3054', `DTSTART;VALUE=DATE:${ymd(addD(3))}`, `DTEND;VALUE=DATE:${ymd(addD(4))}`,
  'SUMMARY:Pack Picnic <b>', 'END:VEVENT',
  'END:VCALENDAR', '',
].join('\r\n');

// Minimal DOM stub: enough for the script to run and for us to read output.
const els = {};
const mkEl = (id) => ({
  id, innerHTML: '', textContent: '', style: {}, dataset: {}, alt: '', src: '', children: [], listeners: {},
  classList: { add() {}, remove() {} },
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
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
  fetch: async (url) => ({ ok: true, text: async () => (String(url).includes('pack3054.org') ? packFixture : fixture) }),
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

ok('9 events parsed', ev.length === 9, `got ${ev.length}`);
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
const open = ev.find((e) => e.summary === 'Departure Only Trip');
ok('departure-only trip: no made-up end time', /^\w{3} 5:00 PM – \w{3}$/.test(api.formatEventTime(open)), api.formatEventTime(open));
ok('departure-only trip ends on its last day', open.openEnd && open.end.toDateString() === addD(10).toDateString(), String(open.end));
ok('trip with a real return time keeps it', !trip.openEnd, '');
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
// Shared flyer (X-IMAGE) and small thumbnails in list rows
const shared = ev.find((e) => e.summary === 'Shared Flyer Event');
ok('X-IMAGE parsed', shared.image === 'https://my.troop3054.org/api/flyer/92', shared.image);
ok('non-https X-IMAGE rejected', ev.find((e) => e.summary === 'Bad Image Event').image === '', '');
// In the list a local thumbnail is tried first (cheap), then the shared
// flyer; the modal goes straight to the shared flyer at full size.
ok('list offers shared flyer after local thumb',
  /data-tries="images\/events\/shared-flyer-event-thumb\.webp\|https:\/\/my\.troop3054\.org\/api\/flyer\/92\|/.test(list), '');
ok('list starts with a local thumb', list.includes('src="images/events/shared-flyer-event-thumb.webp"'), '');
api.showEvent(shared);
ok('modal uses the shared flyer first', els['modal-flyer'].src === 'https://my.troop3054.org/api/flyer/92', els['modal-flyer'].src);
api.showEvent(meet);
const thumbRow = /data-tries="images\/events\/troop-meeting[^"]*-thumb\.webp\|/.test(list)
  || /src="images\/events\/[a-z0-9-]+-thumb\.webp"/.test(list);
ok('list rows request -thumb variants', thumbRow, '');
ok('modal uses full-size images', /images\/events\/[a-z0-9-]+\.webp$/.test(els['modal-flyer'].src) && !els['modal-flyer'].src.includes('-thumb'), els['modal-flyer'].src);

// RSVP: X-RSVP parsed (https only), tagged in the list, and a modal button for
// upcoming events that disappears once the event is over.
ok('X-RSVP parsed', trip.rsvp === 'https://my.troop3054.org/#/event/2/rsvp', trip.rsvp);
ok('non-https X-RSVP rejected', ev.find((e) => e.summary === 'Bad Image Event').rsvp === '', '');
ok('list tags RSVP events', /Weekend Trip<span class="rsvp-tag">RSVP<\/span>/.test(list), '');
ok('list does not tag others', !/Troop Meeting[^<]*<span class="rsvp-tag">/.test(list), '');
api.showEvent(trip);
ok('modal shows RSVP button', els['modal-rsvp-row'].style.display === 'flex' && els['modal-rsvp'].href === trip.rsvp,
  JSON.stringify([els['modal-rsvp-row'].style.display, els['modal-rsvp'].href]));
api.showEvent(ev.find((e) => e.summary === 'Finished Camp'));
ok('modal hides RSVP once event is over', els['modal-rsvp-row'].style.display === 'none', els['modal-rsvp-row'].style.display);
api.showEvent(meet);
ok('modal hides RSVP when event has none', els['modal-rsvp-row'].style.display === 'none', '');

// "Show Pack 3054 events": off by default, then mixes the pack's feed in.
ok('pack events off by default', !api.events.some((e) => e.unit === 'pack'), '');
const packSwitch = els['show-pack'];
packSwitch.checked = true;
await Promise.all(packSwitch.listeners.change.map((fn) => fn()));
const all = api.events;
const packs = all.filter((e) => e.unit === 'pack');
ok('switch adds the pack events', all.length === 11 && packs.length === 2, `got ${all.length} / ${packs.length}`);
ok('pack events get their own color', packs.every((e) => e.type === 'pack'), '');
ok('combined list is in date order and renumbered', all.every((e, i) => e.i === i && (i === 0 || all[i - 1].start <= e.start)), '');
const den = packs.find((e) => e.summary.startsWith('Den Meeting'));
ok('pack meeting shows just its start time', api.formatEventTime(den) === '6:15 PM', api.formatEventTime(den));
const list2 = els['upcoming-events'].innerHTML;
ok('list labels pack events', /Den Meeting \(Lions &amp; Tigers\)<span class="pack-tag">Pack 3054<\/span>/.test(list2), '');
ok('pack rows show a PACK badge, not a troop flyer', list2.includes('pack-thumb') && !/images\/events\/den-meeting/.test(list2), '');
ok('pack titles are escaped too', list2.includes('Pack Picnic &lt;b&gt;') && !list2.includes('Pack Picnic <b>'), '');
api.showEvent(den);
ok('modal says it is a pack event', els['modal-title'].textContent === 'Pack 3054: ' + den.summary, els['modal-title'].textContent);
packSwitch.checked = false;
await Promise.all(packSwitch.listeners.change.map((fn) => fn()));
ok('switch off takes them away again', api.events.length === 9, `got ${api.events.length}`);

for (const [s, n, i] of checks) console.log(`  ${s}  ${n}${i ? '  -> ' + i : ''}`);
const fails = checks.filter((c) => c[0] === 'FAIL').length;
console.log(`RESULT: ${checks.length - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
