import { margins, planStencil } from './geometry.js';

const PT_PER_MM = 72 / 25.4;
const decimal = (value) => String(Number(value.toFixed(9)));
const pair = (x, y) => decimal(x) + ' ' + decimal(y);
const germanNumber = (n) =>
  n.toLocaleString('de-DE', { maximumFractionDigits: 3, useGrouping: false });
const rowLabel = (n) => 'R' + String(n + 1).padStart(2, '0');
const columnLabel = (n) => 'S' + String(n + 1).padStart(2, '0');
const safeChar = new Map([
  ['€', 128],
  ['…', 133],
  ['–', 150],
  ['—', 151],
  ['„', 132],
  ['“', 147],
  ['”', 148],
  ['’', 146],
]);

// PDF base fonts use WinAnsi. The document title also keeps the full Unicode spelling in metadata.
function literal(value) {
  let result = '';
  for (const char of String(value)) {
    let code = safeChar.get(char) ?? char.codePointAt(0);
    if (code < 32 || code === 127) code = 32;
    if (code > 255) code = 63;
    if (code >= 127) result += '\\' + code.toString(8).padStart(3, '0');
    else if ('()\\'.includes(String.fromCharCode(code)))
      result += '\\' + String.fromCharCode(code);
    else result += String.fromCharCode(code);
  }
  return '(' + result + ')';
}
function utf16(value) {
  let hex = 'FEFF';
  for (let i = 0; i < value.length; i++)
    hex += value.charCodeAt(i).toString(16).padStart(4, '0');
  return '<' + hex + '>';
}
function text(value, x, y, size = 2.7, rotation = false, bold = false) {
  const matrix = rotation ? '0 1 -1 0 ' : '1 0 0 1 ';
  return (
    'BT /' +
    (bold ? 'FB' : 'F') +
    ' ' +
    decimal(size) +
    ' Tf ' +
    matrix +
    pair(x, y) +
    ' Tm ' +
    literal(value) +
    ' Tj ET'
  );
}
const line = (x1, y1, x2, y2) => pair(x1, y1) + ' m ' + pair(x2, y2) + ' l S';

function cubicArc(edge, local) {
  // A cubic has maximum radial error smaller than r*angle^6/50000 for this angular range.
  // Subdivide to a 0.002-mm target, independent of page size and template scale.
  const maxAngle = Math.min(
    Math.PI / 4,
    Math.pow((0.002 * 50000) / edge.radius, 1 / 6),
  );
  const n = Math.max(1, Math.ceil(Math.abs(edge.sweep) / maxAngle)),
    step = edge.sweep / n;
  const out = [];
  let start = edge.start;
  for (let i = 0; i < n; i++) {
    const a = edge.startAngle + i * step,
      b = edge.startAngle + (i + 1) * step;
    const distance = 2 * edge.radius * Math.sin(((i + 1) * step) / 2);
    const mid = edge.startAngle + ((i + 1) * step) / 2;
    const end =
      i === n - 1
        ? edge.end
        : {
            x: edge.start.x - distance * Math.sin(mid),
            y: edge.start.y + distance * Math.cos(mid),
          };
    const k = (4 / 3) * Math.tan(step / 4) * edge.radius;
    const c1 = { x: start.x - k * Math.sin(a), y: start.y + k * Math.cos(a) };
    const c2 = { x: end.x + k * Math.sin(b), y: end.y - k * Math.cos(b) };
    out.push(local(c1) + ' ' + local(c2) + ' ' + local(end) + ' c');
    start = end;
  }
  return out;
}

function contour(plan) {
  const b = plan.bounds;
  const local = (p) => pair(p.x - b.minX, p.y - b.minY);
  const out = ['0 G 0.34 w 1 J 1 j', local(plan.segments[0].start) + ' m'];
  for (const edge of plan.segments) {
    if (edge.type === 'line') out.push(local(edge.end) + ' l');
    else {
      // Retain all three physical measurements as exact anchors in the vector path.
      out.push(
        ...cubicArc({ ...edge, end: edge.via, sweep: edge.viaSweep }, local),
      );
      out.push(
        ...cubicArc(
          {
            ...edge,
            start: edge.via,
            startAngle: edge.startAngle + edge.viaSweep,
            sweep: edge.sweep - edge.viaSweep,
          },
          local,
        ),
      );
    }
  }
  out.push('h S');
  return out.join('\n');
}

function crosshair(x, y) {
  return [line(x - 2.2, y, x + 2.2, y), line(x, y - 2.2, x, y + 2.2)].join(
    '\n',
  );
}

function registration(plan, tile) {
  const out = [],
    x0 = margins.left,
    y0 = margins.bottom;
  const x1 = x0 + plan.tileWidth,
    y1 = y0 + plan.tileHeight;
  function vertical(isCut, seam) {
    const x = isCut ? x0 : x1 - plan.overlap,
      markX = x + plan.overlap / 2;
    out.push(
      'q 0.38 G 0.32 g 0.2 w ' + (isCut ? '[3 1]' : '[0.7 1.1]') + ' 0 d',
      line(x, y0 - 1.4, x, y1 + 1.4),
      '[] 0 d',
    );
    const label =
      rowLabel(tile.row) +
      ' ' +
      columnLabel(seam) +
      '/' +
      columnLabel(seam + 1);
    for (const [i, f] of [0.28, 0.72].entries()) {
      const y = y0 + plan.tileHeight * f;
      out.push(
        crosshair(markX, y),
        text(label + ' ' + (i + 1), markX + 2.5, y + 2.5, 1.9, true),
      );
    }
    out.push(
      text(
        isCut ? 'Schnitt' : 'Anlegen',
        x + 1.7,
        y0 + plan.tileHeight * 0.46,
        2.1,
        true,
      ),
      'Q',
    );
  }
  function horizontal(isCut, seam) {
    const y = isCut ? y1 : y0 + plan.overlap,
      markY = y - plan.overlap / 2;
    out.push(
      'q 0.38 G 0.32 g 0.2 w ' + (isCut ? '[3 1]' : '[0.7 1.1]') + ' 0 d',
      line(x0 - 1.4, y, x1 + 1.4, y),
      '[] 0 d',
    );
    const label =
      columnLabel(tile.column) +
      ' ' +
      rowLabel(seam) +
      '/' +
      rowLabel(seam + 1);
    for (const [i, f] of [0.28, 0.72].entries()) {
      const x = x0 + plan.tileWidth * f;
      out.push(
        crosshair(x, markY),
        text(label + ' ' + (i + 1), x + 2.8, markY + 1, 1.9),
      );
    }
    out.push(
      text(
        isCut ? 'Schnitt' : 'Anlegen',
        x0 + plan.tileWidth * 0.46,
        y + 0.75,
        2.1,
      ),
      'Q',
    );
  }
  if (tile.column > 0) vertical(true, tile.column - 1);
  if (tile.column < plan.columns - 1) vertical(false, tile.column);
  if (tile.row > 0) horizontal(true, tile.row - 1);
  if (tile.row < plan.rows - 1) horizontal(false, tile.row);
  return out.join('\n');
}

function controls() {
  const x = margins.left,
    y = 10;
  const vx = 12,
    vy = margins.bottom + 12;
  return [
    'q 0 G 0 g 0.28 w [] 0 d 0 J',
    line(x, y, x + 100, y),
    line(x, y - 1.6, x, y + 1.6),
    line(x + 100, y - 1.6, x + 100, y + 1.6),
    text('Kontrollmaß X · 100 mm', x + 33, y + 2.8, 2.7),
    line(vx, vy, vx, vy + 100),
    line(vx - 1.6, vy, vx + 1.6, vy),
    line(vx - 1.6, vy + 100, vx + 1.6, vy + 100),
    text('Kontrollmaß Y · 100 mm', vx - 2.3, vy + 30, 2.7, true),
    'Q',
  ].join('\n');
}
function pageStream(plan, tile, name) {
  const x = margins.left,
    y = margins.bottom,
    h = plan.paperHeight,
    w = plan.paperWidth,
    b = plan.bounds;
  const number = tile.row * plan.columns + tile.column + 1;
  const title = Array.from(name.trim() || 'Schablone');
  // Reserve the page-number column even for unusually wide capitals.
  let estimated = 0,
    titleLength = 0;
  for (const c of title) {
    const em = /[MW@%Œ]/.test(c)
      ? 1.0
      : /[ .,:;!|ijlI']/.test(c)
        ? 0.36
        : /[A-ZÄÖÜ0-9]/.test(c)
          ? 0.78
          : 0.65;
    if (estimated + em * 4.7 > w - 86) break;
    estimated += em * 4.7;
    titleLength++;
  }
  const show =
    titleLength < title.length
      ? title.slice(0, Math.max(1, titleLength - 1)).join('') + '…'
      : title.join('');
  const info =
    'Blatt ' +
    number +
    '/' +
    plan.tiles.length +
    ' · ' +
    rowLabel(tile.row) +
    ' ' +
    columnLabel(tile.column);
  const clip = pair(x, y) + ' ' + pair(plan.tileWidth, plan.tileHeight) + ' re';
  const out = [
    'q ' + decimal(PT_PER_MM) + ' 0 0 ' + decimal(PT_PER_MM) + ' 0 0 cm',
    '0 g',
    text(show, 12, h - 10, 4.7, false, true),
    text(info, w - 68, h - 10, 3.4, false, true),
    text(
      '1:1 · Tatsächliche Größe / 100 % · Beide Kontrollmaße nachmessen.',
      12,
      h - 16.5,
      2.8,
    ),
    text(
      'Lokaler Ausschnitt ab X ' +
        germanNumber(tile.minX) +
        ' / Y ' +
        germanNumber(tile.minY) +
        ' mm (unten links). X nach rechts, Y nach oben.',
      12,
      h - 22,
      2.55,
    ),
    'q 0.72 G 0.15 w [] 0 d ' + clip + ' S Q',
    'q ' +
      clip +
      ' W n 1 0 0 1 ' +
      pair(x + b.minX - tile.minX, y + b.minY - tile.minY) +
      ' cm /Kontur Do Q',
    registration(plan, tile),
    controls(),
    text(
      plan.tiles.length === 1
        ? 'Außenkontur auf Strichmitte übertragen.'
        : '10 mm Überlappung · von links nach rechts, reihenweise von oben.',
      12,
      4.6,
      2.35,
    ),
  ];
  if (plan.tiles.length > 1)
    out.push(
      text(
        'An Schnittlinie trimmen, an Anlegelinie kleben und gleiche Kreuze decken.',
        12,
        18.3,
        2.45,
      ),
    );
  out.push('Q');
  return out.join('\n');
}

function stream(body, metadata = '') {
  return (
    '<< /Length ' +
    body.length +
    ' ' +
    metadata +
    '>>\nstream\n' +
    body +
    '\nendstream'
  );
}

export function stencilPdf(stencil, options = {}) {
  const plan = planStencil(stencil, options);
  if (!plan.ok) throw new Error(plan.errors.join(' '));
  const b = plan.bounds,
    objects = ['', '']; // Catalog and page tree refer to objects allocated below.
  const add = (s) => objects.push(s);
  const regular = add(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  );
  const bold = add(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  );
  const form = add(
    stream(
      contour(plan),
      '/Type /XObject /Subtype /Form /FormType 1 /BBox [-1 -1 ' +
        pair(b.width + 1, b.height + 1) +
        '] /Resources << >> ',
    ),
  );
  const resources = add(
    '<< /Font << /F ' +
      regular +
      ' 0 R /FB ' +
      bold +
      ' 0 R >> /XObject << /Kontur ' +
      form +
      ' 0 R >> >>',
  );
  const info = add(
    '<< /Title ' + utf16(stencil.name) + ' /Creator (Astraplanung) >>',
  );
  const pageIds = [];
  const paper =
    '[0 0 ' +
    pair(plan.paperWidth * PT_PER_MM, plan.paperHeight * PT_PER_MM) +
    ']';
  for (const tile of plan.tiles) {
    const contents = add(stream(pageStream(plan, tile, stencil.name)));
    pageIds.push(
      add(
        '<< /Type /Page /Parent 2 0 R /MediaBox ' +
          paper +
          ' /Resources ' +
          resources +
          ' 0 R /Contents ' +
          contents +
          ' 0 R >>',
      ),
    );
  }
  objects[0] =
    '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>';
  objects[1] =
    '<< /Type /Pages /Count ' +
    pageIds.length +
    ' /Kids [' +
    pageIds.map((i) => i + ' 0 R').join(' ') +
    '] >>';
  const parts = ['%PDF-1.7\n'];
  let offset = parts[0].length;
  const refs = ['0000000000 65535 f '];
  for (let i = 0; i < objects.length; i++) {
    refs.push(String(offset).padStart(10, '0') + ' 00000 n ');
    const object = i + 1 + ' 0 obj\n' + objects[i] + '\nendobj\n';
    parts.push(object);
    offset += object.length;
  }
  parts.push(
    'xref\n0 ' +
      refs.length +
      '\n' +
      refs.join('\n') +
      '\ntrailer\n<< /Size ' +
      refs.length +
      ' /Root 1 0 R /Info ' +
      info +
      ' 0 R >>\nstartxref\n' +
      offset +
      '\n%%EOF\n',
  );
  return new TextEncoder().encode(parts.join(''));
}
