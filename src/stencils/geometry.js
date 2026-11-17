const TAU = 2 * Math.PI;
const EPS = 1e-6; // Comparison in mm, independent of the position of the local origin.
const MAX_PAGES = 1200;
const MAX_POINTS = 512;
const PAPERS = { A4: [210, 297], A3: [297, 420] };
const isPaper = (value) =>
  typeof value === 'string' && Object.hasOwn(PAPERS, value);
export const margins = { left: 23, right: 13, top: 30, bottom: 24 };
const overlap = 10;
const padding = 3;

const isRecord = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const coordinate = (n) => n === null || Number.isFinite(n);
const draftPoint = (p) => isRecord(p) && coordinate(p.x) && coordinate(p.y);
const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dot = (a, b) => a.x * b.x + a.y * b.y;
const norm = (a) => Math.hypot(a.x, a.y);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const same = (a, b) => distance(a, b) <= EPS;
const point = (a, d, t) => ({ x: a.x + d.x * t, y: a.y + d.y * t });
const ccw = (a, b) => (((b - a) % TAU) + TAU) % TAU;
const angle = (c, p) => Math.atan2(p.y - c.y, p.x - c.x);
const onCircle = (arc, t) => ({
  x: arc.center.x + arc.radius * Math.cos(t),
  y: arc.center.y + arc.radius * Math.sin(t),
});

export function createStencil(name = 'Neue Schablone', itemId = '') {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    'schablone-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2);
  return { id, name, ...(itemId ? { itemId } : {}), points: [] };
}

export function rectanglePoints(widthMm, heightMm) {
  return [
    { x: 0, y: 0 },
    { x: widthMm, y: 0 },
    { x: widthMm, y: heightMm },
    { x: 0, y: heightMm },
  ];
}

export function validStencilDraft(value) {
  const nonemptyText = (text) => typeof text === 'string' && !!text.trim();
  return (
    isRecord(value) &&
    nonemptyText(value.id) &&
    typeof value.name === 'string' &&
    (value.itemId === undefined || typeof value.itemId === 'string') &&
    (value.cutRef === undefined ||
      (nonemptyText(value.itemId) &&
        isRecord(value.cutRef) &&
        nonemptyText(value.cutRef.rowId) &&
        nonemptyText(value.cutRef.label))) &&
    (value.paper === undefined || isPaper(value.paper)) &&
    (value.orientation === undefined ||
      ['portrait', 'landscape'].includes(value.orientation)) &&
    Array.isArray(value.points) &&
    value.points.every(
      (p) => draftPoint(p) && (p.via === undefined || draftPoint(p.via)),
    )
  );
}

function makeEdge(start, end, index) {
  if (same(start, end))
    throw new Error(
      'Kante ' + index + ' hat identische Anfangs- und Endpunkte.',
    );
  if (!start.via) return { type: 'line', start, end };
  const via = start.via,
    u = sub(via, start),
    v = sub(end, start);
  const turn = cross(u, v);
  if (
    same(via, start) ||
    same(via, end) ||
    Math.abs(turn) <= EPS * Math.max(norm(u), norm(v))
  ) {
    throw new Error(
      'Bogen an Kante ' +
        index +
        ' braucht einen Zwischenpunkt abseits der geraden Verbindung.',
    );
  }
  const uu = dot(u, u),
    vv = dot(v, v);
  const relative = {
    x: (uu * v.y - vv * u.y) / (2 * turn),
    y: (u.x * vv - v.x * uu) / (2 * turn),
  };
  const center = { x: start.x + relative.x, y: start.y + relative.y };
  const radius = norm(relative);
  const startAngle = angle(center, start),
    endAngle = angle(center, end);
  const sweep =
    turn > 0 ? ccw(startAngle, endAngle) : -ccw(endAngle, startAngle);
  const viaAngle = angle(center, via);
  const viaSweep =
    turn > 0 ? ccw(startAngle, viaAngle) : -ccw(viaAngle, startAngle);
  if (!finitePoint(center) || !Number.isFinite(radius) || !sweep)
    throw new Error(
      'Die Bogenmaße an Kante ' +
        index +
        ' liegen außerhalb der berechenbaren Genauigkeit.',
    );
  return {
    type: 'arc',
    start,
    end,
    via,
    center,
    radius,
    startAngle,
    sweep,
    viaSweep,
  };
}

function includesAngle(arc, a, strict = false) {
  const tol = Math.max(1e-13, EPS / arc.radius);
  const delta = arc.sweep > 0 ? ccw(arc.startAngle, a) : ccw(a, arc.startAngle);
  if (!strict && (delta <= tol || TAU - delta <= tol)) return true;
  return strict
    ? delta > tol && delta < Math.abs(arc.sweep) - tol
    : delta <= Math.abs(arc.sweep) + tol;
}

function boundPoints(points) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
function extent(seg) {
  const points = [seg.start, seg.end];
  if (seg.type === 'arc') {
    points.push(seg.via);
    for (const a of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI])
      if (includesAngle(seg, a)) points.push(onCircle(seg, a));
  }
  return boundPoints(points);
}

function lineLine(a, b) {
  const r = sub(a.end, a.start),
    s = sub(b.end, b.start),
    off = sub(b.start, a.start);
  const det = cross(r, s),
    la = norm(r),
    lb = norm(s);
  if (Math.abs(det) <= 1e-14 * la * lb) {
    if (Math.abs(cross(off, r)) / la > EPS) return [];
    const t = dot(off, r) / dot(r, r),
      end = dot(sub(b.end, a.start), r) / dot(r, r);
    const lo = Math.max(0, Math.min(t, end)),
      hi = Math.min(1, Math.max(t, end));
    if (hi < lo - EPS / la) return [];
    if ((hi - lo) * la > EPS) return null; // Coincident portions, rather than a single vertex.
    return [point(a.start, r, (lo + hi) / 2)];
  }
  const t = cross(off, s) / det,
    u = cross(off, r) / det;
  if (t < -EPS / la || t > 1 + EPS / la || u < -EPS / lb || u > 1 + EPS / lb)
    return [];
  return [point(a.start, r, t)];
}

function lineArc(line, arc) {
  const delta = sub(line.end, line.start),
    length = norm(delta);
  const dir = { x: delta.x / length, y: delta.y / length },
    offset = sub(arc.center, line.start);
  const projected = dot(offset, dir),
    height = Math.abs(cross(dir, offset));
  if (height > arc.radius + EPS) return [];
  const reach = Math.sqrt(
    Math.max(0, (arc.radius - height) * (arc.radius + height)),
  );
  const params =
    reach <= EPS ? [projected] : [projected - reach, projected + reach];
  return params
    .filter((t) => t >= -EPS && t <= length + EPS)
    .map((t) => point(line.start, dir, t))
    .filter((p) => includesAngle(arc, angle(arc.center, p)));
}

function arcArc(a, b) {
  const delta = sub(b.center, a.center),
    d = norm(delta);
  if (d <= EPS && Math.abs(a.radius - b.radius) <= EPS) {
    // Check the open interior of both angular intervals before allowing a shared endpoint.
    for (const [first, other] of [
      [a, b],
      [b, a],
    ]) {
      const samples = [
        first.start,
        first.end,
        onCircle(first, first.startAngle + first.sweep / 2),
      ];
      if (
        samples.some((p) => includesAngle(other, angle(other.center, p), true))
      )
        return null;
    }
    return [a.start, a.end].filter((p) => includesAngle(b, angle(b.center, p)));
  }
  if (
    d <= EPS ||
    d > a.radius + b.radius + EPS ||
    d < Math.abs(a.radius - b.radius) - EPS
  )
    return [];
  const along =
    ((a.radius - b.radius) * (a.radius + b.radius) + d * d) / (2 * d);
  const perpendicular = Math.sqrt(
    Math.max(0, (a.radius - along) * (a.radius + along)),
  );
  const dir = { x: delta.x / d, y: delta.y / d },
    base = point(a.center, dir, along),
    normal = { x: -dir.y, y: dir.x };
  const hits =
    perpendicular <= EPS
      ? [base]
      : [
          point(base, normal, perpendicular),
          point(base, normal, -perpendicular),
        ];
  return hits.filter(
    (p) =>
      includesAngle(a, angle(a.center, p)) &&
      includesAngle(b, angle(b.center, p)),
  );
}

function intersections(a, b) {
  if (a.type === 'line')
    return b.type === 'line' ? lineLine(a, b) : lineArc(a, b);
  return b.type === 'line' ? lineArc(b, a) : arcArc(a, b);
}

function checkLoop(edges, boxes) {
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i],
        b = edges[j],
        u = boxes[i],
        v = boxes[j];
      if (
        u.maxX < v.minX - EPS ||
        u.minX > v.maxX + EPS ||
        u.maxY < v.minY - EPS ||
        u.minY > v.maxY + EPS
      )
        continue;
      const allowed = [];
      if (j === i + 1) allowed.push(a.end);
      if (i === 0 && j === edges.length - 1) allowed.push(a.start);
      const hits = intersections(a, b);
      if (
        hits === null ||
        hits.some((p) => !allowed.some((endpoint) => same(p, endpoint)))
      ) {
        throw new Error(
          'Kanten ' +
            (i + 1) +
            ' und ' +
            (j + 1) +
            ' schneiden, berühren oder überlagern sich. Die Außenkontur muss einfach geschlossen sein.',
        );
      }
    }
  const origin = edges[0].start;
  let twiceArea = 0;
  for (const e of edges) {
    twiceArea += cross(sub(e.start, origin), sub(e.end, origin));
    if (e.type === 'arc') {
      const s = e.sweep;
      const deficit =
        Math.abs(s) < 1e-3 ? s ** 3 / 6 - s ** 5 / 120 : s - Math.sin(s);
      twiceArea += e.radius * e.radius * deficit;
    }
  }
  if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) <= EPS * EPS)
    throw new Error('Die Messpunkte umschließen keine druckbare Fläche.');
}

function svgPath(edges) {
  const coord = (p) => p.x + ' ' + p.y;
  return [
    'M ' + coord(edges[0].start),
    ...edges.map((e) =>
      e.type === 'line'
        ? 'L ' + coord(e.end)
        : 'A ' +
          e.radius +
          ' ' +
          e.radius +
          ' 0 ' +
          (Math.abs(e.sweep) > Math.PI ? 1 : 0) +
          ' ' +
          (e.sweep > 0 ? 1 : 0) +
          ' ' +
          coord(e.end),
    ),
    'Z',
  ].join(' ');
}

export function planStencil(stencil, options = {}) {
  const requested = options?.paper ?? stencil?.paper ?? 'A4';
  const orientation =
    options?.orientation ?? stencil?.orientation ?? 'portrait';
  const dims = isPaper(requested) ? PAPERS[requested] : PAPERS.A4;
  const [paperWidth, paperHeight] =
    orientation === 'landscape' ? [dims[1], dims[0]] : dims;
  const tileWidth = paperWidth - margins.left - margins.right;
  const tileHeight = paperHeight - margins.top - margins.bottom;
  const plan = {
    ok: false,
    errors: [],
    bounds: null,
    segments: [],
    path: '',
    tiles: [],
    columns: 0,
    rows: 0,
    paperWidth,
    paperHeight,
    tileWidth,
    tileHeight,
    overlap,
  };
  try {
    if (!validStencilDraft(stencil))
      throw new Error(
        'Die Schablone enthält ungültige Mess- oder Einstellungsdaten.',
      );
    if (!isPaper(requested) || !['portrait', 'landscape'].includes(orientation))
      throw new Error(
        'Als Papierformat A4 oder A3 und Hoch- oder Querformat wählen.',
      );
    const points = stencil.points.slice();
    if (points.length > MAX_POINTS + 1)
      throw new Error(
        'Der Druck unterstützt höchstens ' +
          MAX_POINTS +
          ' Umfangspunkte. Teile die Kontur bei Bedarf auf.',
      );
    if (points.some((p) => !finitePoint(p) || (p.via && !finitePoint(p.via))))
      throw new Error(
        'Für jeden Umfangs- und Bogenzwischenpunkt X und Y in mm eintragen.',
      );
    if (
      points.length > 2 &&
      !points.at(-1).via &&
      same(points[0], points.at(-1))
    )
      points.pop();
    if (points.length > MAX_POINTS)
      throw new Error(
        'Der Druck unterstützt höchstens ' + MAX_POINTS + ' Umfangspunkte.',
      );
    if (
      points.length < 2 ||
      (points.length === 2 && !points.some((p) => p.via))
    )
      throw new Error(
        'Für die geschlossene Kontur mindestens drei Punkte oder zwei Punkte mit einem Kreisbogen eintragen.',
      );
    const edges = points.map((p, i) =>
      makeEdge(p, points[(i + 1) % points.length], i + 1),
    );
    const boxes = edges.map(extent);
    checkLoop(edges, boxes);
    const b = boundPoints(
      boxes.flatMap((u) => [
        { x: u.minX, y: u.minY },
        { x: u.maxX, y: u.maxY },
      ]),
    );
    if (
      ![b.width, b.height, b.minX, b.minY, b.maxX, b.maxY].every(
        Number.isFinite,
      )
    )
      throw new Error(
        'Die Koordinaten überschreiten den berechenbaren Bereich.',
      );
    plan.bounds = b;
    plan.segments = edges;
    plan.path = svgPath(edges);
    const count = (span, size) =>
      1 +
      Math.max(
        0,
        Math.ceil((span + 2 * padding - size - EPS) / (size - overlap)),
      );
    plan.columns = count(b.width, tileWidth);
    plan.rows = count(b.height, tileHeight);
    const pageCount = plan.columns * plan.rows;
    if (!Number.isSafeInteger(pageCount) || pageCount > MAX_PAGES) {
      const need = Number.isSafeInteger(pageCount)
        ? 'Für diese Kontur wären ' +
          pageCount.toLocaleString('de-DE') +
          ' Blätter nötig. '
        : 'Die Kontur überschreitet den druckbaren Papierumfang. ';
      throw new Error(
        need +
          'Je Druck sind höchstens ' +
          MAX_PAGES +
          ' Blätter möglich. Maße und Einheit prüfen oder die Kontur aufteilen.',
      );
    }
    for (let row = 0; row < plan.rows; row++)
      for (let column = 0; column < plan.columns; column++) {
        const minX = b.minX - padding + column * (tileWidth - overlap);
        const maxY = b.maxY + padding - row * (tileHeight - overlap);
        plan.tiles.push({
          row,
          column,
          minX,
          maxX: minX + tileWidth,
          minY: maxY - tileHeight,
          maxY,
        });
      }
    plan.ok = true;
  } catch (error) {
    plan.errors.push(error.message);
  }
  return plan;
}
