import test from 'node:test';
import assert from 'node:assert/strict';

import * as geometry from './geometry.js';
import * as pdf from './pdf.js';
const shape = (points) => ({ id: 'kontur', name: 'Maßprobe', points });
const p = (x, y) => ({ x, y });
const close = (a, b, t = 1e-6) =>
  assert.ok(Math.abs(a - b) <= t, a + ' ≠ ' + b);
const doc = (bytes) => Buffer.from(bytes).toString('latin1');

test('Entwürfe behalten leere Felder und Papierwahl bis zur Druckreife', () => {
  const d = geometry.createStencil('Bordwand', 'teil-1');
  assert.equal(d.itemId, 'teil-1');
  assert.equal(d.name, 'Bordwand');
  d.points = [{ x: null, y: 15, via: { x: 10, y: null } }];
  d.paper = 'A3';
  d.orientation = 'landscape';
  assert.equal(geometry.validStencilDraft(d), true);
  assert.equal(geometry.planStencil(d).ok, false);
  assert.equal(
    geometry.validStencilDraft({ ...d, points: [{ x: '2', y: 0 }] }),
    false,
  );
  assert.equal(
    geometry.validStencilDraft({ ...d, points: [{ x: 0, y: Infinity }] }),
    false,
  );
  assert.equal(geometry.validStencilDraft({ ...d, paper: 'A0' }), false);
});
test('A4-Blätter überlappen in beiden Richtungen um genau 10 mm und decken jeden Rand ab', () => {
  const s = shape(
    geometry
      .rectanglePoints(450.75, 610.125)
      .map(({ x, y }) => p(x - 42.25, y - 105.75)),
  );
  const plan = geometry.planStencil(s);
  assert.equal(plan.ok, true, plan.errors.join(' '));
  const { tiles, columns, rows } = plan;
  assert.ok(rows >= 2 && columns >= 2);
  assert.equal(tiles.length, columns * rows);
  close(tiles[0].maxX - tiles[1].minX, 10);
  close(tiles[columns].maxY - tiles[0].minY, 10);
  assert.ok(
    tiles[0].minX < plan.bounds.minX && tiles[0].maxY > plan.bounds.maxY,
  );
  assert.ok(
    tiles.at(-1).maxX > plan.bounds.maxX &&
      tiles.at(-1).minY < plan.bounds.minY,
  );
  assert.equal(tiles[columns].row, 1);
  assert.equal(tiles[columns].column, 0);
  close(plan.bounds.width, 450.75);
  close(plan.bounds.height, 610.125);
  const one = geometry.planStencil(shape(geometry.rectanglePoints(100, 85)));
  assert.equal(one.tiles.length, 1);
  const rotated = geometry.planStencil({
    ...s,
    paper: 'A3',
    orientation: 'landscape',
  });
  assert.equal(rotated.paperWidth, 420);
  assert.equal(rotated.paperHeight, 297);
});
test('Großbogen berücksichtigt Scheitel außerhalb aller Messpunkte, auch auf der Schlusskante', () => {
  // 270°-Bogen von (100,0) via (0,100) nach (0,-100), mit schließender Sehne.
  const outline = shape([p(0, -100), { x: 100, y: 0, via: p(0, 100) }]);
  const plan = geometry.planStencil(outline);
  assert.equal(plan.ok, true, plan.errors.join(' '));
  const arc = plan.segments[1];
  assert.equal(arc.type, 'arc');
  close(arc.radius, 100);
  close(arc.sweep, 1.5 * Math.PI);
  close(plan.bounds.minX, -100);
  close(plan.bounds.maxX, 100);
  close(plan.bounds.height, 200);
  assert.ok(plan.columns > 1);
  assert.match(plan.path, /\bA\s*100/);
});
test('Zwei entgegengesetzte Halbkreise schließen einen Kreis, derselbe Halbkreis doppelt ist unzulässig', () => {
  const semicircles = shape([
    { x: 0, y: 0, via: p(50, 50) },
    { x: 100, y: 0, via: p(50, -50) },
  ]);
  const circle = geometry.planStencil(semicircles);
  assert.equal(circle.ok, true, circle.errors.join(' '));
  close(circle.bounds.minY, -50);
  close(circle.bounds.maxY, 50);
  const duplicate = geometry.planStencil(
    shape([semicircles.points[0], { x: 100, y: 0, via: p(50, 50) }]),
  );
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.length);
});
test('Kreuzungen, berührende Konturen, geradlinige Bogenmessung und zu viele Blätter verhindern den Druck', () => {
  for (const pts of [
    [p(0, 0), p(80, 80), p(0, 80), p(80, 0)],
    [p(0, 0), p(70, 0), p(20, 0), p(60, 60)],
    [{ x: 0, y: 0, via: p(50, 0) }, p(100, 0), p(0, 80)],
    [{ x: 0, y: 0, via: p(50, 50) }, p(100, 0), p(50, 75), p(50, -15)],
    [p(0, 0), p(0, 0), p(1, 1)],
  ]) {
    const invalid = geometry.planStencil(shape(pts));
    assert.equal(invalid.ok, false);
    assert.equal(invalid.tiles.length, 0);
  }
  const huge = geometry.planStencil(
    shape(geometry.rectanglePoints(100000, 100000)),
  );
  assert.equal(huge.ok, false);
  assert.match(huge.errors.join(' '), /[Bb]l[aä]tt/);
});
test('PDF verwendet echte Papiermaße, Vektorbögen und 100-mm-Strecken in beiden Achsen', () => {
  const s = shape([
    { x: 0, y: 0, via: p(70, 70) },
    p(140, 0),
    p(140, -20),
    p(0, -20),
  ]);
  const options = { paper: 'A3', orientation: 'landscape' };
  const output = pdf.stencilPdf(s, options);
  assert.ok(output instanceof Uint8Array);
  const data = doc(output);
  assert.match(data, /^%PDF-1\./);
  const media = data.match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
  close(+media[1], (420 * 72) / 25.4, 1e-5);
  close(+media[2], (297 * 72) / 25.4, 1e-5);
  const scale = data.match(/([\d.]+) 0 0 ([\d.]+) 0 0 cm/);
  close(+scale[1], 72 / 25.4, 1e-7);
  close(+scale[2], 72 / 25.4, 1e-7);
  const lines = [
    ...data.matchAll(/(-?[\d.]+) (-?[\d.]+) m\s+(-?[\d.]+) (-?[\d.]+) l/g),
  ].map((r) => [r[3] - r[1], r[4] - r[2]]);
  assert.ok(lines.some(([x, y]) => x === 100 && y === 0));
  assert.ok(lines.some(([x, y]) => y === 100 && x === 0));
  assert.match(data, / c\b/);
  assert.match(data, /\/Subtype \/Form/);
  assert.match(data, /startxref\s+(\d+)/);
  const ref = +data.match(/startxref\s+(\d+)/)[1];
  assert.equal(data.slice(ref, ref + 4), 'xref');
  assert.throws(() => pdf.stencilPdf(shape([p(0, 0)])));
});
test('Ein ganzer Vanboden von 6.000 × 2.200 mm bleibt bei 1:1 auch jenseits von 200 A4-Seiten druckbar', () => {
  const s = shape(geometry.rectanglePoints(6000, 2200)),
    plan = geometry.planStencil(s);
  assert.equal(plan.ok, true, plan.errors.join(' '));
  assert.ok(plan.tiles.length > 200);
  close(plan.bounds.width, 6000);
  close(plan.bounds.height, 2200);
  const data = doc(pdf.stencilPdf(s));
  assert.equal(
    (data.match(/\/Type \/Page\b/g) || []).length,
    plan.tiles.length,
  );
  assert.equal((data.match(/\/Subtype \/Form/g) || []).length, 1);
  assert.match(data, /6000 2200 l/);
});
test('Zusammengehörige Passkreuze der PDF-Seiten treffen dieselben globalen Messkoordinaten', () => {
  const s = shape(geometry.rectanglePoints(208, 290));
  const plan = geometry.planStencil(s);
  const pages = [
    ...doc(pdf.stencilPdf(s)).matchAll(/\bstream\n([\s\S]*?)\nendstream/g),
  ]
    .slice(1)
    .map((match) => match[1]);
  assert.equal(pages.length, 4);
  const marks = pages.map((body, index) => {
    const tile = plan.tiles[index];
    return [
      ...body.matchAll(/(-?[\d.]+) (-?[\d.]+) m (-?[\d.]+) (-?[\d.]+) l S/g),
    ]
      .filter((m) => Math.abs(m[3] - m[1] - 4.4) < 1e-5 && m[4] === m[2])
      .map((m) => [
        +m[1] + 2.2 + tile.minX - geometry.margins.left,
        +m[2] + tile.minY - geometry.margins.bottom,
      ]);
  });
  const shared = (a, b) =>
    marks[a].filter((p) =>
      marks[b].some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-5),
    );
  assert.equal(shared(0, 1).length, 2);
  assert.equal(shared(0, 2).length, 2);
  assert.match(pages[0], /Anlegen/);
  assert.match(pages[1], /Schnitt/);
});
test('Gemessener Zwischenpunkt ist auch zwischen den Hauptachsen ein exakter Anker der PDF-Kurve', () => {
  const stencil = shape([{ x: -10, y: 0, via: p(-6, 8) }, p(10, 0)]);
  const plan = geometry.planStencil(stencil),
    arc = plan.segments[0],
    via = arc.via;
  close(Math.hypot(via.x - arc.center.x, via.y - arc.center.y), 10);
  const form = doc(pdf.stencilPdf(stencil)).match(
    /\bstream\n([\s\S]*?)\nendstream/,
  )[1];
  const ends = [...form.matchAll(/(-?[\d.]+) (-?[\d.]+) c\b/g)].map((m) => [
    +m[1] + plan.bounds.minX,
    +m[2] + plan.bounds.minY,
  ]);
  assert.ok(ends.some(([x, y]) => Math.hypot(x - via.x, y - via.y) < 1e-7));
});
