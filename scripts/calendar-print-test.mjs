// Headless test of calendar-print.html's inline script: the program year it
// picks, what it leaves out, escaping, and how times, places and trips read.
import fs from 'fs';
import vm from 'vm';

const html = fs.readFileSync(new URL('../calendar-print.html', import.meta.url), 'utf8');
const m = html.match(/<script>\s*\/\/ Troop 3054 print calendar([\s\S]*?)<\/script>/);
if (!m) throw new Error('inline script not found');
const js = '// Troop 3054 print calendar' + m[1];

const fixture = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  // Last year's, and next year's: both left out of 2026-27
  'BEGIN:VEVENT', 'UID:0', 'DTSTART:20260614T181500', 'DTEND:20260614T194500',
  'SUMMARY:Old Meeting', 'CATEGORIES:MEETING', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:9', 'DTSTART:20270913T181500', 'DTEND:20270913T194500',
  'SUMMARY:Next Year Meeting', 'CATEGORIES:MEETING', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:1', 'DTSTART:20260914T181500', 'DTEND:20260914T194500',
  'SUMMARY:Troop Meeting', 'LOCATION:Jefferson Elementary School\\, 100 Princetown Rd\\, Schenectady\\, NY',
  'CATEGORIES:MEETING', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:2', 'DTSTART:20261002T170000', 'DTEND:20261004T120000',
  'SUMMARY:Harvest Fest <img src=x onerror=alert(1)>', 'LOCATION:Gelder Hall\\, Camp Wakpominee',
  'CATEGORIES:CAMPOUT', 'END:VEVENT',
  // Departure time, no return time: the app ends it at midnight after the last day
  'BEGIN:VEVENT', 'UID:3', 'DTSTART:20261009T170000', 'DTEND:20261012T000000',
  'SUMMARY:Cryptid Camporee', 'LOCATION:Camp Wakpominee', 'CATEGORIES:CAMPOUT', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:4', 'DTSTART:20261114T083000', 'DTEND:20261114T160000',
  'SUMMARY:Merit Badge Day', 'LOCATION:GE Vernova\\, 1 River Road\\, Schenectady\\, NY 12345',
  'CATEGORIES:OTHER', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:5', 'DTSTART;VALUE=DATE:20270315', 'DTEND;VALUE=DATE:20270316',
  'SUMMARY:Blue and Gold', 'CATEGORIES:OTHER', 'END:VEVENT',
  // A trip that crosses into the next month
  'BEGIN:VEVENT', 'UID:6', 'DTSTART:20270331T170000', 'DTEND:20270402T120000',
  'SUMMARY:Spring Trip', 'CATEGORIES:CAMPOUT', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:7', 'DTSTART:20261118T180000', 'DTEND:20261118T193000',
  'SUMMARY:Committee Meeting', 'CATEGORIES:COMMITTEE', 'END:VEVENT',
  'END:VCALENDAR', '',
].join('\r\n');

const els = {};
const mkEl = (id) => ({ id, innerHTML: '', textContent: '', addEventListener() {} });
const sandbox = {
  document: { getElementById: (id) => (els[id] ||= mkEl(id)), title: '' },
  location: { search: '' },
  URLSearchParams, console, Date, Number, String, parseInt, RegExp, Error, Math, Map,
  window: { print() {} },
  fetch: async () => ({ ok: true, text: async () => fixture }),
};
vm.createContext(sandbox);
vm.runInContext(js, sandbox);
vm.runInContext('globalThis.__api = { parseICS, render, programYear, timeText, placeText, whenHtml };', sandbox);
await new Promise((r) => setTimeout(r, 30));
const api = sandbox.__api;

const checks = [];
const ok = (name, cond, info = '') => checks.push([cond ? 'PASS' : 'FAIL', name, cond ? '' : info]);

ok('Oct 2026 prints 2026-27', api.programYear(new Date(2026, 9, 15), null) === 2026, '');
ok('Mar 2027 still prints 2026-27', api.programYear(new Date(2027, 2, 1), null) === 2026, '');
ok('from July it is next year', api.programYear(new Date(2027, 6, 1), null) === 2027, '');
ok('?year= picks a year', api.programYear(new Date(2026, 9, 15), '2027') === 2027, '');
ok('a junk ?year= is ignored', api.programYear(new Date(2026, 9, 15), 'abc') === 2026, '');

const evs = api.parseICS(fixture);
const out = api.render(evs, 2026, new Date(2026, 9, 15));
ok('last year left out', !out.includes('Old Meeting'), '');
ok('next year left out', !out.includes('Next Year Meeting'), '');
ok('months in order', out.indexOf('September 2026') < out.indexOf('October 2026') && out.indexOf('November 2026') < out.indexOf('March 2027'), '');
ok('empty months skipped', !out.includes('December 2026') && !out.includes('July 2027'), '');
ok('title escaped', out.includes('Harvest Fest &lt;img src=x onerror=alert(1)&gt;') && !out.includes('<img src=x'), '');
ok('type colors', out.includes('ev t-camping') && out.includes('ev t-committee') && out.includes('ev t-special'), '');
ok('routine meetings marked', /ev t-meeting routine/.test(out) && /ev t-committee routine/.test(out), '');
ok('special events are not routine', !/t-special routine/.test(out), '');
ok('heading names the year', els['year-label'].textContent === '2026–27 Calendar', els['year-label'].textContent);
ok('document title names the year', sandbox.document.title === 'Troop 3054 Calendar 2026–27', sandbox.document.title);

const by = (s) => evs.find((e) => e.summary.startsWith(s));
ok('PM range reads 6:15 to 7:45 PM', api.timeText(by('Troop Meeting')) === '6:15 to 7:45 PM', api.timeText(by('Troop Meeting')));
ok('AM to PM range', api.timeText(by('Merit Badge Day')) === '8:30 AM to 4:00 PM', api.timeText(by('Merit Badge Day')));
ok('trip names both days', api.timeText(by('Harvest Fest')) === 'Fri 5:00 PM to Sun 12:00 PM', api.timeText(by('Harvest Fest')));
ok('no return time: Leaves Fri', api.timeText(by('Cryptid')) === 'Leaves Fri 5:00 PM', api.timeText(by('Cryptid')));
ok('all-day event', api.timeText(by('Blue and Gold')) === 'All day', api.timeText(by('Blue and Gold')));
ok('Jefferson reads Jefferson', api.placeText(by('Troop Meeting').location) === 'Jefferson', '');
ok('short first part keeps the next', api.placeText(by('Harvest Fest').location) === 'Gelder Hall, Camp Wakpominee', api.placeText(by('Harvest Fest').location));
ok('long first part stands alone', api.placeText('Regional Food Bank, 965 Albany Shaker Rd, Latham, NY 12110') === 'Regional Food Bank', '');
ok('trip date column', api.whenHtml(by('Cryptid')) === '<b>9–11</b><i>Fri–Sun</i>', api.whenHtml(by('Cryptid')));
ok('trip across months', api.whenHtml(by('Spring Trip')) === '<b>31–Apr 2</b><i>Wed–Fri</i>', api.whenHtml(by('Spring Trip')));
ok('one day', api.whenHtml(by('Troop Meeting')) === '<b>14</b><i>Mon</i>', api.whenHtml(by('Troop Meeting')));
ok('an empty year says so', api.render(evs, 2030, new Date(2030, 9, 1)).includes('Nothing is on the 2030–31 calendar yet'), '');
ok('the page loads the feed on its own', els.year.innerHTML.includes('class="month'), els.year.innerHTML.slice(0, 120));

for (const [s, n, i] of checks) console.log(`  ${s}  ${n}${i ? '  -> ' + i : ''}`);
const fails = checks.filter((c) => c[0] === 'FAIL').length;
console.log(`RESULT: ${checks.length - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
