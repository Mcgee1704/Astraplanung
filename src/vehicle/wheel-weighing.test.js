import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, makeSystems, makeTrip } from '../systems/model.js';

import * as wheel from './wheel-weighing.js';

function example() {
  return {
    useBaseline: false,
    axles: [
      { id: 'front', name: 'Vorderachse', dual: false },
      { id: 'rear', name: 'Hinterachse', dual: false },
    ],
    travel: { values: {}, date: '', note: '' },
    baseline: { values: {}, date: '', note: '', included: [] },
  };
}
const four = {
  'front.left.single': 701.5,
  'front.right.single': 698.5,
  'rear.left.single': 550,
  'rear.right.single': 560,
};
function project(wheelWeighing) {
  return {
    items: [
      {
        id: 'box',
        kind: 'custom',
        name: 'Schrank',
        x: 0,
        y: 0,
        z: 0,
        length: 400,
        width: 200,
        height: 600,
        mass: 40,
        cost: 200,
      },
    ],
    vehicle: {
      length: 3000,
      width: 1700,
      height: 1900,
      wheelbase: 4000,
      frontAxleX: 0,
      baseMass: 2000,
      baseFront: 1100,
      baseRear: 900,
      frontMax: 1650,
      rearMax: 1800,
      maxMass: 3500,
      ...(wheelWeighing ? { wheelWeighing } : {}),
    },
    systems: makeSystems(),
    trip: {
      ...makeTrip(),
      people: 1,
      personKg: 80,
      occupantX: 1000,
      cargoKg: 0,
    },
  };
}
test('new measurement has two distinct empty series and four real wheel positions', () => {
  assert.equal(typeof wheel.makeWheelWeighing, 'function');
  const stored = wheel.makeWheelWeighing();
  assert.deepEqual(stored, example());
  const totals = wheel.wheelTotals(stored, 'travel');
  assert.equal(totals.required, 4);
  assert.equal(totals.measured, 0);
  assert.equal(totals.totalKg, null);
});
test('partial side sums preserve zero and leave incomplete axles and vehicle open', () => {
  const s = example();
  s.travel.values = { 'front.left.single': 0, 'rear.left.single': 560 };
  assert.equal(typeof wheel.wheelTotals, 'function');
  const measured = wheel.wheelTotals(s, 'travel');
  assert.equal(measured.leftKg, 560);
  assert.equal(measured.rightKg, null);
  assert.equal(measured.axles[0].leftKg, 0);
  assert.equal(measured.axles[0].totalKg, null);
  assert.equal(measured.totalKg, null);
  Object.assign(s.travel.values, four);
  assert.equal(wheel.wheelTotals(s, 'travel').totalKg, 2510);
  delete s.travel.values['front.right.single'];
  assert.equal(wheel.wheelTotals(s, 'travel').totalKg, null);
});
test('twins require actual inner and outer readings; a third axle participates in all totals', () => {
  assert.equal(typeof wheel.wheelTotals, 'function');
  const s = example();
  s.axles[1].dual = true;
  s.axles.push({ id: 'third', name: 'Nachlaufachse', dual: false });
  s.travel.values = {
    ...four,
    'rear.left.inner': 200,
    'rear.left.outer': 201,
    'rear.right.inner': 202,
    'third.left.single': 100,
    'third.right.single': 110,
  };
  let m = wheel.wheelTotals(s, 'travel');
  assert.equal(m.required, 8);
  assert.equal(m.measured, 7);
  assert.equal(m.totalKg, null);
  assert.equal(m.axles[1].leftKg, 401);
  s.travel.values['rear.right.outer'] = 203;
  m = wheel.wheelTotals(s, 'travel');
  assert.equal(m.totalKg, 2416);
  assert.equal(m.leftKg, 1202.5);
  assert.equal(m.rightKg, 1213.5);
});
test('German scale readings accept decimal comma, thousands and genuine zero, rejecting negatives or junk', () => {
  assert.equal(typeof wheel.parseWeighNumber, 'function');
  for (const [text, value] of [
    [' 651,5 ', 651.5],
    ['1.234,5', 1234.5],
    ['701.75', 701.75],
    ['701.750', 701.75],
    ['0.750', 0.75],
    ['0,750', 0.75],
    ['1.234', 1.234],
    ['1234', 1234],
    ['0', 0],
    ['', null],
  ]) {
    assert.deepEqual(wheel.parseWeighNumber(text), { valid: true, value });
  }
  for (const input of [
    '-1',
    '1e3',
    'neun',
    '2,2,6',
    'Infinity',
    '1.234.567',
    '1,234.5',
  ])
    assert.equal(wheel.parseWeighNumber(input).valid, false);
});
test('persisted kilogram values render as editable ungrouped decimals and round-trip exactly', () => {
  assert.equal(typeof wheel.wheelInputText, 'function');
  assert.equal(wheel.wheelInputText(1234), '1234');
  assert.equal(wheel.wheelInputText(701.75), '701,75');
  for (const n of [null, 0, 1.234, 1234, 1234.5, 701.75, 0.75, 0.0000001]) {
    assert.deepEqual(wheel.parseWeighNumber(wheel.wheelInputText(n)), {
      valid: true,
      value: n,
    });
  }
});
test('checked import shape accepts inactive readings, rejects unknown axle ids and invalid numeric leaves', () => {
  assert.equal(typeof wheel.validWheelWeighing, 'function');
  const s = example();
  s.travel.values = { ...four, 'rear.right.inner': 100 };
  assert.equal(wheel.validWheelWeighing(s), true);
  for (const change of [
    (v) => (v.travel.values['front.left.single'] = -1),
    (v) => (v.travel.values['other.left.single'] = 42),
    (v) => (v.axles[1].id = 'front'),
    (v) => (v.axles[0].dual = 'yes'),
    (v) => v.baseline.included.push({ id: 'x', name: 'Box', kg: '70', x: 100 }),
    (v) => (v.travel.date = '2025-02-31'),
  ]) {
    const bad = structuredClone(s);
    change(bad);
    assert.equal(wheel.validWheelWeighing(bad), false);
  }
});
test('travel readings never add to prognosis; an explicitly selected baseline replaces direct axle values', () => {
  const s = example(),
    p = project(s);
  s.travel.values = { ...four };
  const legacy = calculate(project());
  assert.equal(calculate(p).massKg, legacy.massKg);
  assert.equal(calculate(p).frontKg, legacy.frontKg);
  s.baseline.values = { ...four };
  assert.equal(calculate(p).massKg, legacy.massKg);
  s.useBaseline = true;
  assert.equal(calculate(p).baseKg, 2510);
  assert.equal(calculate(p).massKg, 2630);
  s.baseline.values['rear.right.single'] = null;
  assert.equal(calculate(p).massKg, null);
  assert.equal(calculate(p).rearKg, null);
  s.useBaseline = false;
  assert.equal(calculate(p).massKg, legacy.massKg);
});
test('equipment and occupants already on the baseline scale are subtracted at original mass and position', () => {
  const s = example(),
    p = project(s);
  s.useBaseline = true;
  s.baseline.values = { ...four };
  s.baseline.included = [
    { id: 'item:box', name: 'Schrank', kg: 40, x: 200 },
    { id: 'people', name: 'Personen', kg: 80, x: 1000 },
  ];
  let m = calculate(p);
  assert.equal(m.massKg, 2510);
  assert.equal(m.frontKg, 1400);
  assert.equal(m.rearKg, 1110);
  p.trip.personKg = 90;
  m = calculate(p);
  assert.equal(m.massKg, 2520);
  assert.equal(m.frontKg, 1407.5);
  assert.equal(m.rearKg, 1112.5);
  p.items = [];
  m = calculate(p);
  assert.equal(m.massKg, 2480);
});
test('extra measured axles yield a total and never split dynamic load through a two-axle estimate', () => {
  const s = example(),
    p = project(s);
  s.axles.push({ id: 'extra', name: 'Zusatzachse', dual: false });
  assert.equal(calculate(p).frontKg, null);
  assert.equal(calculate(p).massKg, 2120);
  s.useBaseline = true;
  s.baseline.values = {
    ...four,
    'extra.left.single': 350,
    'extra.right.single': 340,
  };
  const m = calculate(p);
  assert.equal(m.massKg, 3320);
  assert.equal(m.frontKg, null);
  assert.equal(m.rearKg, null);
});
