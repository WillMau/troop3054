// Troop 3054 calendar as a PDF file, drawn in the browser from the year model
// in calendar-year.js, in the same layout as calendar-print.html: the patch,
// the troop's colors and fonts, and the year in two columns on letter pages.
// pdf-lib, its font kit and the fonts load only when someone asks for the PDF.
(function (root) {
  const LIBS = [
    ['PDFLib', 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'],
    ['fontkit', 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'],
  ];
  // Montserrat and Open Sans, under the SIL Open Font License (fonts/OFL.txt).
  const FILES = [
    'fonts/Montserrat-ExtraBold.ttf', 'fonts/Montserrat-SemiBold.ttf',
    'fonts/OpenSans-Regular.ttf', 'fonts/OpenSans-SemiBold.ttf',
    'images/troop-logo-512.png', 'images/qr-calendar.png',
  ];

  // The brand colors from style.css, as print inks.
  const HEX = {
    navy: '#003F87', red: '#CE1126', tan: '#AD9D7B', tanLine: '#D6CEBD', rowLine: '#EFEBE3',
    ink: '#232528', soft: '#5D5F63',
    meeting: '#003F87', camping: '#2E5D34', service: '#8C7A50', committee: '#6A4C93', special: '#CE1126',
  };
  const LEGEND = [['meeting', 'Meeting'], ['camping', 'Camping'], ['service', 'Service'], ['committee', 'Committee'], ['special', 'Special event']];

  // Letter, in points. Two columns, as on the print page.
  const W = 612, H = 792, L = 36, R = 36, TOP = 32, FOOT = 54;
  const GAP = 23, COL = (W - L - R - GAP) / 2;
  const DATE_W = 50.6, BAR = 2.25, TEXT_X = DATE_W + BAR + 5.25, TEXT_W = COL - TEXT_X;

  const loadScript = (name, src) => (root[name] ? Promise.resolve() : new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  }));
  const fetchBytes = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + ': HTTP ' + res.status);
    return res.arrayBuffer();
  };

  async function build(model) {
    for (const [name, src] of LIBS) await loadScript(name, src);
    const { PDFDocument, rgb } = root.PDFLib;
    const color = {};
    for (const [k, hex] of Object.entries(HEX)) {
      const n = parseInt(hex.slice(1), 16);
      color[k] = rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    }

    const doc = await PDFDocument.create();
    doc.registerFontkit(root.fontkit);
    const files = await Promise.all(FILES.map(fetchBytes));
    const [heavy, label, body, bold] = await Promise.all(files.slice(0, 4).map((b) => doc.embedFont(b, { subset: true })));
    const patch = await doc.embedPng(files[4]);
    const qr = await doc.embedPng(files[5]);
    doc.setTitle(`Troop 3054 Calendar ${model.label}`);
    doc.setAuthor('Troop 3054');
    doc.setSubject(`The ${model.label} program year: meetings, campouts, service and special events.`);
    doc.setCreator('troop3054.org');

    const width = (text, font, size, track = 0) => font.widthOfTextAtSize(text, size) + track * text.length;
    // Letter-spaced capitals, one character at a time (pdf-lib has no tracking).
    const tracked = (page, text, x, y, font, size, c, track) => {
      for (const ch of text) {
        page.drawText(ch, { x, y, size, font, color: c });
        x += font.widthOfTextAtSize(ch, size) + track;
      }
    };
    const wrap = (text, font, size, max) => {
      const lines = [];
      let line = '';
      for (const word of String(text).split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && width(next, font, size) > max) { lines.push(line); line = word; } else line = next;
      }
      if (line) lines.push(line);
      return lines.length ? lines : [''];
    };

    // Page 1 masthead: patch, name, year, meeting night, and the QR code.
    const first = doc.addPage([W, H]);
    const top = H - TOP;
    first.drawImage(patch, { x: L, y: top - 52, width: 50, height: 50 });
    const tx = L + 61;
    first.drawText('Troop 3054', { x: tx, y: top - 22, size: 25, font: heavy, color: color.navy });
    first.drawText(`${model.label} Calendar`, { x: tx, y: top - 40, size: 15, font: heavy, color: color.red });
    const lead = 'Troop meetings: ';
    const meets = wrap(lead + 'most Mondays, 6:15 to 7:45 PM, Jefferson Elementary School, 100 Princetown Rd, Schenectady', body, 9, 300);
    meets.forEach((line, i) => {
      const y = top - 54 - i * 11.5;
      if (i === 0 && line.startsWith(lead)) {
        first.drawText(lead, { x: tx, y, size: 9, font: bold, color: color.ink });
        first.drawText(line.slice(lead.length), { x: tx + width(lead, bold, 9), y, size: 9, font: body, color: color.soft });
      } else first.drawText(line, { x: tx, y, size: 9, font: body, color: color.soft });
    });
    const qrX = W - R - 52;
    first.drawImage(qr, { x: qrX, y: top - 54, width: 52, height: 52 });
    const right = (text, y, font, size, c) => first.drawText(text, { x: qrX - 8 - width(text, font, size), y, size, font, color: c });
    right('Always current online', top - 12, heavy, 8, color.navy);
    right('troop3054.org/calendar.html', top - 22.5, body, 7.5, color.soft);
    right('Scan to see it or add it', top - 32, body, 7.5, color.soft);
    right(`to your phone's calendar`, top - 41.5, body, 7.5, color.soft);
    const ruleY = top - 54 - meets.length * 11.5 - 2;
    first.drawRectangle({ x: L, y: ruleY, width: W - L - R, height: 2.25, color: color.navy });
    first.drawRectangle({ x: L, y: ruleY - 4.5, width: W - L - R, height: 2.25, color: color.tan });
    let lx = L;
    for (const [type, name] of LEGEND) {
      first.drawRectangle({ x: lx, y: ruleY - 20, width: 7, height: 7, color: color[type] });
      first.drawText(name, { x: lx + 10.5, y: ruleY - 19.5, size: 8.5, font: body, color: color.soft });
      lx += 10.5 + width(name, body, 8.5) + 13;
    }

    // The year, month by month: down the left column, then the right, then a new page.
    const pages = [first];
    let page = first;
    let col = 0;
    let colTop = ruleY - 34;
    let y = colTop;
    const colX = () => L + col * (COL + GAP);
    const nextColumn = () => {
      if (col === 0) { col = 1; y = colTop; return; }
      page = doc.addPage([W, H]);
      pages.push(page);
      col = 0;
      colTop = H - TOP;
      y = colTop;
    };
    const HEAD = 19, MONTH_GAP = 8;
    const sized = (row) => {
      const tFont = row.routine ? body : bold;
      const titleLines = wrap(row.title, tFont, 9.5, TEXT_W);
      const metaLines = row.meta ? wrap(row.meta, body, 8, TEXT_W) : [];
      const h = Math.max(24, 6 + titleLines.length * 12 + metaLines.length * 10.5 + 1);
      return { ...row, tFont, titleLines, metaLines, h };
    };

    if (!model.months.length) {
      page.drawText(`Nothing is on the ${model.label} calendar yet. Check troop3054.org/calendar.html.`,
        { x: L, y: y - 14, size: 11, font: body, color: color.soft });
    }
    for (const month of model.months) {
      const rows = month.rows.map(sized);
      const total = HEAD + rows.reduce((n, r) => n + r.h, 0);
      // A month stays in one column when it fits there, as on the print page.
      if (!month.long && total > y - FOOT && total <= colTop - FOOT) nextColumn();
      if (HEAD + rows[0].h > y - FOOT) nextColumn();
      let x = colX();
      tracked(page, month.name.toUpperCase(), x, y - 10, heavy, 11, color.navy, 0.88);
      page.drawLine({ start: { x, y: y - 15 }, end: { x: x + COL, y: y - 15 }, thickness: 0.75, color: color.tanLine });
      y -= HEAD;
      rows.forEach((r, i) => {
        if (r.h > y - FOOT) { nextColumn(); x = colX(); }
        const rowTop = y;
        page.drawText(r.big, { x, y: rowTop - 12.5, size: 11.5, font: heavy, color: color.ink });
        tracked(page, r.small.toUpperCase(), x, rowTop - 21, label, 6.5, color.soft, 0.4);
        const textH = r.titleLines.length * 12 + r.metaLines.length * 10.5;
        page.drawRectangle({ x: x + DATE_W, y: rowTop - 4 - textH, width: BAR, height: textH + 1, color: color[r.type] || color.special });
        let ty = rowTop - 11.5;
        for (const line of r.titleLines) {
          page.drawText(line, { x: x + TEXT_X, y: ty, size: 9.5, font: r.tFont, color: color.ink });
          ty -= 12;
        }
        ty += 1.5;
        for (const line of r.metaLines) {
          page.drawText(line, { x: x + TEXT_X, y: ty, size: 8, font: body, color: color.soft });
          ty -= 10.5;
        }
        y -= r.h;
        if (i < rows.length - 1) {
          page.drawLine({ start: { x, y: y + 0.5 }, end: { x: x + COL, y: y + 0.5 }, thickness: 0.75, color: color.rowLine });
        }
      });
      y -= MONTH_GAP;
    }

    // Every page: when it was made, and where the current version lives.
    pages.forEach((p, i) => {
      p.drawLine({ start: { x: L, y: 44 }, end: { x: W - R, y: 44 }, thickness: 0.75, color: color.tanLine });
      p.drawText(`Printed ${model.printed} from the live troop calendar.`, { x: L, y: 33, size: 7.5, font: body, color: color.soft });
      const note = `Dates can change. Check troop3054.org/calendar.html before you go.${pages.length > 1 ? `  ·  Page ${i + 1} of ${pages.length}` : ''}`;
      p.drawText(note, { x: W - R - width(note, body, 7.5), y: 33, size: 7.5, font: body, color: color.soft });
    });
    return doc.save();
  }

  // Build it and hand it to the browser as a download.
  async function download(model) {
    const bytes = await build(model);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Troop-3054-Calendar-${model.label.replace('–', '-')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  root.CalPdf = { build, download };
})(globalThis);
