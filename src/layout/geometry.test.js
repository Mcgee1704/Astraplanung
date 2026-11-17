import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutVariants, makeItem, makeLayout } from './templates.js';
import {
  intersects,
  layoutFindings,
  extractionPath,
  tankFacts,
  fitsInside,
  availableParents,
  transformContents,
} from './geometry.js';

const vehicle = { length: 4200, width: 1900, height: 2100 };
for (const id of ['1a', '2a', '10']) {
  test(
    'Muster ' + id + ' mit Hüllkörpern, Pflichttechnik und freien Öffnungen',
    () => {
      const items = makeLayout(id, vehicle);
      assert.equal(items.length, new Set(items.map((i) => i.id)).size);
      for (const kind of [
        'bed',
        'fresh',
        'grey',
        'pump',
        'heater',
        'battery',
        'solar',
      ])
        assert.ok(
          items.some((i) => i.kind === kind),
          kind,
        );
      assert.deepEqual(layoutFindings({ vehicle, items }), []);
    },
  );
}
test('Bett oberhalb eines Tanks kollidiert nur bei echtem Höhenüberlapp', () => {
  const bed = makeItem('bed', { x: 0, y: 0, z: 360 });
  const tank = makeItem('fresh', { x: 0, y: 0, z: 0, height: 360 });
  assert.equal(intersects(bed, tank), false);
  assert.equal(intersects({ ...bed, z: 359 }, tank), true);
});
test('Tankänderung unterscheidet Nennvolumen, Klappenmaß und echten Ausbauweg', () => {
  const items = makeLayout('1a', vehicle);
  const tank = items.find((i) => i.kind === 'fresh');
  assert.equal(tankFacts(tank).grossVolume, 117);
  assert.equal(extractionPath(tank, items).aligned, true);
  assert.deepEqual(extractionPath(tank, items).obstacles, []);
  assert.ok(
    layoutFindings({
      vehicle,
      items: items.map((i) => (i === tank ? { ...tank, capacity: 150 } : i)),
    }).some((f) => f.type === 'Volumen'),
  );
  const obstacle = makeItem('wall', {
    x: tank.x + 100,
    y: 10,
    z: 0,
    length: 20,
    width: 100,
    height: 300,
  });
  assert.deepEqual(
    extractionPath(tank, [...items, obstacle]).obstacles.map((o) => o.id),
    [obstacle.id],
  );
  assert.equal(extractionPath({ ...tank, z: 200 }, items).aligned, false);
});
test('Fahrzeug verkleinern erhält die Originalbauteile und macht Überstände sichtbar', () => {
  const items = makeLayout('1a', vehicle);
  assert.ok(
    layoutFindings({ vehicle: { ...vehicle, width: 1550 }, items }).some(
      (f) => f.type === 'Grenze',
    ),
  );
  assert.deepEqual(makeLayout('empty', vehicle), []);
});
test('Verknüpfte Einbauten bewegen sich mit und sind nur innerhalb ihres Hohlraums zulässig', () => {
  const box = makeItem('bath', { x: 15, y: 8, z: 0 }),
    wc = makeItem('toilet', { x: 30, y: 70, parentId: box.id });
  assert.equal(fitsInside(wc, box), true);
  assert.deepEqual(layoutFindings({ vehicle, items: [box, wc] }), []);
  assert.deepEqual(availableParents(box, [box, wc]), []);
  const rotated = {
    ...box,
    x: 100,
    y: 80,
    length: box.width,
    width: box.length,
    rotation: 90,
  };
  const [newBox, newWc] = transformContents(box, rotated, [rotated, wc]);
  assert.ok(fitsInside(newWc, newBox));
  assert.equal(newWc.width, wc.length);
  assert.ok(
    layoutFindings({
      vehicle,
      items: [box, { ...wc, x: box.length - 15 }],
    }).some((f) => f.type === 'Einbau'),
  );
});
test('18 Reiselayouts bilden unterscheidbare Räume auf Referenzmaß und in zwei Standardfahrzeugen ab', () => {
  const variants = layoutVariants.filter((v) => v.id.startsWith('tour-'));
  assert.equal(variants.length, 18);
  assert.equal(new Set(variants.map((v) => v.name)).size, 18);
  const configurations = new Set();
  for (const variant of variants) {
    assert.ok(['Kastenwagen', 'Kofferaufbau'].includes(variant.vehicleKind));
    const [length, width, height] = variant.reference;
    const rooms = [
      { length, width, height },
      vehicle,
      { length: 3100, width: 1780, height: 1880 },
    ];
    for (const room of rooms) {
      const items = makeLayout(variant.id, room);
      assert.equal(new Set(items.map((i) => i.id)).size, items.length);
      for (const kind of [
        'bed',
        'kitchen',
        'door',
        'fresh',
        'grey',
        'battery',
        'solar',
        'pump',
      ]) {
        assert.ok(
          items.some((i) => i.kind === kind),
          variant.id + ' ' + kind,
        );
      }
      assert.deepEqual(
        layoutFindings({ vehicle: room, items }),
        [],
        variant.id + ' ' + room.length,
      );
      if (room === vehicle) {
        configurations.add(
          JSON.stringify(
            items.map(({ kind, x, y, z, length, width, height }) => [
              kind,
              x,
              y,
              z,
              length,
              width,
              height,
            ]),
          ),
        );
      }
    }
  }
  assert.equal(configurations.size, 18);
});
test('Reiselayouts mit Längskoje bewahren die Schlaflänge auf kürzerer Ladefläche', () => {
  const id = 'tour-waldsolo';
  const first = makeLayout(id, { length: 3300, width: 1790, height: 1900 });
  const other = makeLayout(id, { length: 3100, width: 1790, height: 1900 });
  const a = first.find((i) => i.kind === 'bed'),
    b = other.find((i) => i.kind === 'bed');
  assert.equal(a.length, 1870);
  assert.equal(b.length, a.length);
  assert.notEqual(a.x, b.x);
  b.name = 'Mein Bett';
  assert.notEqual(a.name, b.name);
  assert.deepEqual(makeLayout('fremder-gespeicherter-entwurf', vehicle), []);
});
