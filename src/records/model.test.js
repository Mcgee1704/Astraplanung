import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allCuts,
  bill,
  canVerifyRoute,
  cardOf,
  cardSearch,
  cutPlan,
  editRoute,
  makeRecords,
  recordsOf,
  routesOf,
  summary,
  validCut,
} from './model.js';

const cabinet = {
  id: 'cab1',
  name: 'Vorratsschrank',
  kind: 'cabinet',
  length: 600,
  width: 400,
  height: 700,
  mass: 15,
  cost: 100,
  material: 'Birke',
};
const tank = {
  id: 'tank1',
  name: 'Frischwassertank',
  kind: 'fresh',
  capacity: 100,
  mass: 9,
  cost: 210,
  serviceWidth: 550,
  serviceHeight: 400,
};
const pump = {
  id: 'pump1',
  name: 'Wasserpumpe',
  kind: 'pump',
  mass: 1,
  cost: 45,
};
const bat = { id: 'bat1', name: 'Akku', kind: 'battery', mass: 6, cost: 120 };
const items = [cabinet, tank, pump, bat];

test('Korpusaußenmaße führen zu netto abgestimmten Fertigmaßen, kein negativer Zuschnitt', () => {
  const records = makeRecords(items),
    rows = cutPlan(cabinet, records).rows;
  assert.deepEqual(
    rows.map((row) => [
      row.name,
      row.qty,
      row.length,
      row.width,
      row.thickness,
    ]),
    [
      ['Seiten', 2, 700, 396, 15],
      ['Boden und Deckel', 2, 570, 396, 15],
      ['Rückwand', 1, 600, 700, 4],
    ],
  );
  assert.equal(summary(items, records).pieces, 5);
  const bad = cutPlan({ ...cabinet, length: 20 }, records);
  assert.equal(bad.rows.length, 0);
  assert.ok(bad.issue);
  assert.equal(validCut({ ...rows[0], qty: 1.5 }), false);
});

test('Ein bereits geplanter Schrank behält seine Werkstückmaße in jeder Einbaurichtung', () => {
  const r = makeRecords(),
    bare = { ...cabinet, length: 800, width: 400, height: 600 };
  const base = cutPlan(bare, r).rows;
  assert.deepEqual([base[2].length, base[2].width], [800, 600]);
  for (const rotation of [0, 90, 180, 270]) {
    const odd = rotation % 180 !== 0;
    assert.deepEqual(
      cutPlan(
        { ...bare, rotation, length: odd ? 400 : 800, width: odd ? 800 : 400 },
        r,
      ).rows,
      base,
    );
  }
});

test('Nur explizit überschriebene Maße bleiben bei einer Grundrissänderung fest', () => {
  const r = makeRecords(items);
  r.cuts.cab1 = {
    overrides: { horizontals: { width: 390 } },
    hidden: ['back'],
    extra: [
      {
        id: 'shelf',
        name: 'Fachboden',
        length: 500,
        width: 300,
        thickness: 12,
        qty: 1,
      },
    ],
  };
  const changed = { ...cabinet, length: 800, width: 450 },
    rows = cutPlan(changed, r).rows;
  assert.deepEqual(
    rows.map((row) => [row.id, row.length, row.width]),
    [
      ['sides', 700, 446],
      ['horizontals', 770, 390],
      ['shelf', 500, 300],
    ],
  );
  assert.deepEqual(allCuts([], r), []);
  r.cuts.cab1.method = 'bought';
  assert.deepEqual(cutPlan(changed, r).rows, []);
});

test('Wand und Dämmplatte werden in ihrer realen Flächenebene zugeschnitten', () => {
  const r = makeRecords();
  const wall = cutPlan(
    {
      id: 'wand',
      kind: 'wall',
      name: 'Trennwand',
      length: 45,
      width: 750,
      height: 1900,
    },
    r,
  ).rows[0];
  const layer = cutPlan(
    {
      id: 'daemm',
      kind: 'insulation',
      name: 'Dämmplatte',
      length: 1000,
      width: 25,
      height: 500,
    },
    r,
  ).rows[0];
  assert.deepEqual([wall.length, wall.width, wall.thickness], [1900, 750, 45]);
  assert.deepEqual(
    [layer.length, layer.width, layer.thickness],
    [1000, 500, 25],
  );
});

test('100/150-L-Variante übernimmt Nenninhalt, Wartungsöffnung, Kaufbeleg und veränderten Ansatz', () => {
  const r = makeRecords(items);
  r.cards.tank1 = { actualCost: 287, purchase: 'Gekauft' };
  r.purchases.push({
    id: 'screws',
    name: 'Schrauben',
    qty: 2,
    cost: 5,
    state: 'Gekauft',
    paid: 3,
  });
  r.purchases.push({
    id: 'plates',
    name: 'Platten',
    qty: 1,
    cost: 50,
    state: 'Geplant',
    paid: '',
    included: true,
  });
  const a = bill([tank], r),
    b = bill([{ ...tank, capacity: 150, cost: 305, serviceWidth: 700 }], r);
  assert.match(a[0].label, /100 l/);
  assert.match(b[0].label, /150 l/);
  assert.match(b[0].label, /700/);
  assert.equal(a[0].plannedSum, 210);
  assert.equal(b[0].plannedSum, 305);
  assert.equal(b[0].currentSum, 287);
  assert.equal(summary([{ ...tank, cost: 305 }], r).expected, 293);
  assert.equal(summary([{ ...tank, cost: 305 }], r).planned, 315);
  assert.equal(b[1].itemId, null);
  assert.equal(b[2].currentSum, 0);
});

test('Ein fehlender Einzelpreis bleibt offen, Nullpreise und enthaltene Zusatzpositionen sind bekannt', () => {
  const r = makeRecords(items);
  const noCost = { ...tank, cost: null };
  r.cards.tank1 = { actualCost: 70 };
  r.purchases.push({
    id: 'bolts',
    name: 'Schrauben',
    qty: 1,
    cost: '',
    paid: '',
  });
  r.purchases.push({ id: 'gift', name: 'Restholz', qty: 1, cost: 0, paid: '' });
  r.purchases.push({
    id: 'set',
    name: 'Platte',
    qty: 2,
    cost: null,
    included: true,
  });
  const rows = bill([noCost, cabinet], r),
    totals = summary([noCost, cabinet], r);
  assert.deepEqual(
    rows.map((row) => [row.plannedSum, row.currentSum]),
    [
      [null, 70],
      [100, 100],
      [null, null],
      [0, 0],
      [0, 0],
    ],
  );
  assert.deepEqual(
    [totals.planned, totals.openPlanned, totals.expected, totals.openExpected],
    [100, 2, 170, 1],
  );
});

test('Aktuelle Maße der verknüpften Serviceklappe haben Vorrang in der Werkstattmappe', () => {
  const r = makeRecords([]);
  const linked = {
    ...tank,
    serviceId: 'hatch-1',
    serviceWidth: 550,
    serviceHeight: 400,
  };
  const hatch = {
    id: 'hatch-1',
    kind: 'hatch',
    name: 'Serviceklappe',
    side: 'left',
    length: 810,
    width: 25,
    height: 470,
    cost: 80,
  };
  assert.match(bill([linked, hatch], r)[0].label, /810 × 470/);
  assert.match(bill([linked], r)[0].label, /Ausbauöffnung offen/);
});

test('Bordakte findet reale Ersatzteilkennung und Sicherung nach einem Austausch und erhält Nullwerte', () => {
  const r = makeRecords(items);
  assert.match(cardOf(pump, r).partNumber, /Beispiel/);
  r.cards.pump1 = {
    partNumber: 'XP-17-AB',
    fuse: 'F04 in Luke 2',
    place: 'Bettkasten',
    actualCost: 0,
  };
  assert.ok(cardSearch(pump, r).includes('xp-17-ab'));
  assert.ok(cardSearch(pump, r).includes('f04'));
  assert.equal(bill([pump], r)[0].currentSum, 0);
  assert.match(cardOf({ ...pump, id: 'new' }, r).valve, /Beispiel/);
  assert.deepEqual(
    recordsOf({ items }).steps.map((row) => row.id),
    makeRecords(items).steps.map((row) => row.id),
  );
});

test('Vorschlagswege folgen vorhandenen IDs, Entfall eines manuell referenzierten Bauteils bleibt erkennbar', () => {
  const r = makeRecords(items);
  const route = routesOf(items, r).find(
    (route) => route.medium === 'Frischwasser' && route.from === 'tank1',
  );
  assert.equal(route.to, 'pump1');
  r.routeEdits[route.id] = {
    route: 'unter Podest',
    protection: 'V1',
    verified: true,
  };
  assert.equal(
    routesOf(items, r).find((item) => item.id === route.id).protection,
    'V1',
  );
  r.extraRoutes.push({
    id: 'manual',
    medium: 'Strom',
    from: 'bat1',
    to: 'pump1',
  });
  const after = routesOf(
    items.filter((item) => item !== pump),
    r,
  );
  assert.ok(!after.some((item) => item.id === route.id));
  assert.ok(after.find((item) => item.id === 'manual').missing);
  const all = routesOf([...items, { ...tank, id: 'second' }], r);
  assert.ok(all.some((item) => item.from === 'second' && item.to === 'pump1'));
  assert.equal(new Set(all.map((item) => item.id)).size, all.length);
  r.hiddenRoutes.push(route.id);
  assert.ok(!routesOf(items, r).some((item) => item.id === route.id));
});

test('Prüfvermerk verlangt bekanntes Anschlusspaar und einen dokumentierten Weg', () => {
  let records = makeRecords(items);
  const route = routesOf(items, records).find((r) => r.from === 'tank1');
  assert.equal(canVerifyRoute(route, items), false);
  assert.equal(
    canVerifyRoute(
      { ...route, route: '   ', points: [{ x: '', y: ' ' }] },
      items,
    ),
    false,
  );
  const changed = { ...route, points: [{ x: 0, y: 0 }] };
  assert.ok(canVerifyRoute(changed, items));
  assert.equal(canVerifyRoute({ ...changed, to: 'removed' }, items), false);
  assert.equal(canVerifyRoute({ ...changed, to: changed.from }, items), false);
  records = editRoute(records, route, { points: changed.points }, items);
  records = editRoute(
    records,
    routesOf(items, records).find((r) => r.id === route.id),
    { verified: true },
    items,
  );
  assert.equal(records.routeEdits[route.id].verified, true);
  records = editRoute(records, changed, { route: 'Verlauf geändert' }, items);
  assert.equal(records.routeEdits[route.id].verified, false);
  records.extraRoutes.push({
    ...changed,
    id: 'manual',
    automatic: false,
    verified: true,
  });
  records = editRoute(
    records,
    records.extraRoutes[0],
    { protection: 'V1' },
    items,
  );
  assert.equal(records.extraRoutes[0].verified, false);
});
