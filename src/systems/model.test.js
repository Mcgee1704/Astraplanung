import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculate,
  compareTanks,
  loadWh,
  makeSystems,
  makeTrip,
  tankSpace,
  vehicleEnvelope,
  withTankVariant,
} from './model.js';
import { makeItem, makeLayout } from '../layout/templates.js';
import {
  canVerifyRoute,
  editRoute,
  makeRecords,
  routesOf,
} from '../records/model.js';

const vehicle = {
  name: 'Testkabine',
  length: 4100,
  width: 2060,
  height: 1910,
  wheelbase: 4000,
  frontAxleX: -900,
  baseMass: 2600,
  baseFront: null,
  baseRear: null,
  maxMass: 3500,
  frontMax: 1800,
  rearMax: 2150,
};
function project(variant = '1a') {
  const items = makeLayout(variant, vehicle);
  return {
    vehicle: { ...vehicle },
    items,
    trip: makeTrip(),
    systems: {
      ...makeSystems(items),
      externalInverterRef: 'INV-1 / geprüfter Testbestand',
    },
    records: makeRecords(),
  };
}
function close(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 1e-6,
    'Expected ' + actual + ' ≈ ' + expected,
  );
}

test('default two tank choices share weather and all other project inputs', () => {
  const p = project();
  const before = structuredClone(p);
  const [small, large] = compareTanks(p);
  assert.deepEqual(p, before);
  assert.equal(small.capacity, 100);
  assert.equal(large.capacity, 150);
  assert.equal(small.trip.outsideC, large.trip.outsideC);
  assert.equal(small.trip.driveHours + large.trip.shoreHours, 0);
  assert.ok(large.result.massKg > small.result.massKg + 50);
  close(
    large.result.freshDays - small.result.freshDays,
    50 / (p.trip.people * p.trip.waterPerPerson),
  );
  assert.equal(small.space.path.aligned, true);
  assert.deepEqual(small.space.path.obstacles, []);
  assert.equal(large.space.path.aligned, false);
  assert.equal(large.result.frontKg, null);
  assert.equal(small.result.autonomyDays, large.result.autonomyDays);
});

test('reservoir liquid is counted once with asymmetric grey/fresh start levels', () => {
  const p = project('empty');
  p.items = [
    makeItem('fresh', { capacity: 100, fill: 0.6, mass: 9 }),
    makeItem('grey', { capacity: 75, fill: 0.2, mass: 7 }),
  ];
  let m = calculate(p);
  assert.equal(m.fluidKg, 75);
  assert.equal(m.greyAvailableL, 60);
  close(m.freshDays, 2.5);
  close(m.greyDays, 60 / 18);
  p.items[0].fill = null;
  m = calculate(p);
  assert.equal(m.freshAvailableL, null);
  assert.equal(m.massKg, null);
  assert.equal(m.freshDays, null);
});

test('empty axes remain unknown; measured inputs conserve static weight and allow front unloading', () => {
  const p = project('empty');
  const aggregate = makeItem('custom', {
    x: 3850,
    y: 20,
    length: 200,
    width: 100,
    height: 200,
    mass: 100,
    cost: 15,
  });
  p.items = [aggregate];
  p.trip = { ...p.trip, people: 0, cargoKg: 0 };
  assert.equal(calculate(p).massKg, 2700);
  assert.equal(calculate(p).rearKg, null);
  p.vehicle.baseFront = 1300;
  assert.equal(calculate(p).frontKg, null);
  p.vehicle.baseRear = 1200;
  const m = calculate(p);
  const rearAdded = (100 * (3850 + 100 - -900)) / 4000;
  close(m.rearKg, 1200 + rearAdded);
  close(m.frontKg, 1300 + 100 - rearAdded);
  close(m.frontKg + m.rearKg, m.massKg);
  assert.ok(m.frontKg < 1300);
  assert.equal(m.baseKg, 2500);
  aggregate.mass = null;
  assert.equal(calculate(p).massKg, null);
  assert.equal(calculate(p).frontKg, null);
});

test('400 Wp, 400 Wh daily net harvest and 1200 Wh daily use give three days with 2400 usable Wh', () => {
  const p = project('empty');
  p.items = [
    makeItem('solar', { watts: 400 }),
    makeItem('battery', { voltage: 12, ah: 250 }),
  ];
  Object.assign(p.trip, {
    solarHours: 1,
    driveHours: 0,
    shoreHours: 0,
    outsideC: 20,
  });
  Object.assign(p.systems, {
    pvEfficiency: 1,
    heater: 'none',
    heatHours: 0,
    hotWaterL: 0,
    startCharge: 1,
    reserveCharge: 0.2,
    loads: [
      { id: 'test', name: 'Last', watts: 100, hours: 12, qty: 1, bus: 'DC' },
    ],
  });
  const m = calculate(p);
  close(m.usableWh, 2400);
  close(m.solarWh, 400);
  close(m.consumptionWh, 1200);
  close(m.electricDays, 3);
  p.trip.solarHours = 4;
  assert.equal(calculate(p).electricDays, Infinity);
  p.items[1].ah = null;
  assert.equal(calculate(p).electricDays, null);
  p.trip.solarHours = 25;
  assert.equal(calculate(p).solarWh, null);
});

test('deleted linked loads and heater feed back into energy predictions', () => {
  const p = project();
  const pump = p.items.find((it) => it.kind === 'pump');
  const pumpLoad = p.systems.loads.find((row) => row.id === 'pump');
  assert.equal(pumpLoad.itemId, pump.id);
  assert.equal(loadWh(pumpLoad, p.systems, p.items), 12);
  const m = calculate(p);
  assert.ok(m.fanWh > 0);
  p.items = p.items.filter((it) => it.id !== pump.id && it.kind !== 'heater');
  const missing = calculate(p);
  assert.equal(loadWh(pumpLoad, p.systems, p.items), 0);
  assert.equal(missing.heaterMissing, true);
  assert.equal(missing.heatShortfall, true);
  assert.equal(missing.autonomyDays, 0);
  assert.equal(missing.limiter, 'Heizleistung');
});

test('separate masses and tank accessibility are independent of costing and roof height', () => {
  const p = project();
  assert.deepEqual(vehicleEnvelope(p, p.vehicle), []);
  p.records.purchases = [
    { id: 'sealant', qty: 2, cost: 11.5, name: 'Dichtstoff' },
    { id: 'included', qty: 1, cost: 50, included: true },
  ];
  const result = calculate(p);
  assert.equal(result.costEur, result.componentCostEur + 23);
  const tank = p.items.find((it) => it.kind === 'fresh');
  assert.ok(tankSpace(p, tank).path);
  const noHatch = { ...p, items: p.items.filter((it) => it.kind !== 'hatch') };
  assert.equal(tankSpace(noHatch, tank).path, null);
  assert.equal(tankSpace(noHatch, tank).opening.openingKnown, true);
  assert.ok(
    vehicleEnvelope(p, { ...p.vehicle, length: 1500 }).includes('Solarmodul'),
  );
});

test('same electrical route object drives template and archive edits', () => {
  const p = project(),
    battery = p.items.find((it) => it.kind === 'battery');
  const draft = routesOf(p.items, p.records).find(
    (row) => row.from === '@starter' && row.to === battery.id,
  );
  assert.ok(draft);
  p.records.routeEdits[draft.id] = {
    protection: 'F-03',
    route: 'Schweller links',
    verified: true,
  };
  const archived = routesOf(p.items, p.records).find(
    (row) => row.id === draft.id,
  );
  assert.equal(archived.protection, 'F-03');
  assert.equal(archived.verified, true);
  assert.equal(archived.route, 'Schweller links');
});

test('mutually exclusive charging hours and incomplete component ratings remain open', () => {
  const p = project();
  Object.assign(p.trip, { driveHours: 20, shoreHours: 6 });
  const r = calculate(p);
  assert.equal(r.generationWh, null);
  assert.equal(r.electricDays, null);
  p.trip.driveHours = 1;
  assert.equal(calculate(p).scheduleOverlap, false);
  p.items.find((i) => i.kind === 'solar').watts = null;
  assert.equal(calculate(p).solarWh, null);
  p.systems.solarEnabled = false;
  assert.equal(calculate(p).solarWh, 0);
});

test('100 L winter example reports both tied bottlenecks, 150 L only grey water', () => {
  const [small, large] = compareTanks(project());
  assert.equal(small.result.limiter, 'Frisch- und Grauwasser');
  assert.equal(large.result.limiter, 'Grauwasserkapazität');
});

test('electrical boiler uses the selected physical boiler and AC efficiency', () => {
  const p = project();
  p.systems.hotWaterSource = 'electric';
  p.systems.boilerBus = 'AC';
  p.systems.boilerEfficiency = 0.8;
  p.systems.inverterEfficiency = 0.9;
  assert.equal(calculate(p).waterHeatShortfall, true);
  p.items.push(makeItem('boiler'));
  const r = calculate(p);
  assert.equal(r.boilerMissing, false);
  assert.equal(r.waterHeatShortfall, false);
  close(r.boilerWh, (1.163 * 3 * 2 * 35) / 0.8 / 0.9);
  close(r.consumptionWh, r.loadsWh + r.fanWh + r.boilerWh);
  p.systems.boilerItemId = 'obsolete';
  assert.equal(calculate(p).boilerMissing, true);
});

test('checked installed tank mass reaches both axles and survives as history when replaced', () => {
  const p = project();
  Object.assign(p.vehicle, { baseFront: 1400, baseRear: 1200 });
  const tank = p.items.find((it) => it.kind === 'fresh');
  const initial = calculate(p);
  p.records.cards[tank.id] = {
    actualMass: '19.8',
    actualLength: '651',
    status: 'Geplant',
    actualCost: 225,
  };
  close(calculate(p).massKg, initial.massKg);
  p.records.cards[tank.id].status = 'Eingebaut';
  const installed = calculate(p);
  close(installed.massKg - initial.massKg, 19.8 - tank.mass);
  close(
    installed.rearKg - initial.rearKg,
    ((19.8 - tank.mass) * (tank.x + tank.length / 2 - p.vehicle.frontAxleX)) /
      p.vehicle.wheelbase,
  );
  close(installed.frontKg + installed.rearKg, installed.massKg);
  close(installed.plannedDryMassKg, initial.dryMassKg);
  assert.equal(installed.measuredCount, 1);
  const [small, large] = compareTanks(p);
  assert.equal(
    small.result.massDetails.find((it) => it.id === tank.id).used,
    19.8,
  );
  assert.equal(
    large.result.massDetails.find((it) => it.id === tank.id).used,
    13.5,
  );
  const same = withTankVariant(p, small.tank);
  assert.equal(same.records.cards[tank.id].actualMass, '19.8');
  const adopted = withTankVariant(p, large.tank);
  assert.equal(adopted.records.cards[tank.id].status, 'Geplant');
  assert.equal(adopted.records.cards[tank.id].actualMass, '');
  assert.match(adopted.records.cards[tank.id].history[0].work, /19,8 kg/);
  close(calculate(adopted).massKg, large.result.massKg);
  assert.equal(p.records.cards[tank.id].actualMass, '19.8');
});

test('electrical route verification is shared and every route/spec/endpoint edit invalidates it', () => {
  const p = project();
  const generated = routesOf(p.items, p.records).find(
    (row) => row.medium === 'Strom',
  );
  p.records.extraRoutes.push({ ...generated, id: 'custom', automatic: false });
  for (const id of [generated.id, 'custom']) {
    const route = () => routesOf(p.items, p.records).find((it) => it.id === id);
    const change = (patch) => {
      p.records = editRoute(p.records, route(), patch, p.items);
    };
    assert.equal(canVerifyRoute(route(), p.items), false);
    change({ verified: true });
    assert.equal(route().verified, false);
    change({ route: 'Vom Verteiler links bis zum Verbraucher' });
    change({ verified: true });
    assert.equal(route().verified, true);
    change({ protection: 'F-02' });
    assert.equal(route().verified, false);
    change({ verified: true });
    change({ from: route().to });
    assert.equal(route().verified, false);
    assert.equal(canVerifyRoute(route(), p.items), false);
    change({ verified: true });
    assert.equal(route().verified, false);
  }
});

test('unpriced extra procurement remains open throughout travel budget', () => {
  const p = project();
  p.records.purchases.push({
    id: 'open',
    name: 'Dämmstoff',
    qty: 2,
    cost: null,
  });
  assert.equal(calculate(p).costEur, null);
  assert.equal(calculate(p).budgetLeft, null);
  p.records.purchases[0].included = true;
  assert.ok(calculate(p).costEur > 0);
});

test('AC energy and autonomy need an installed or documented inverter even with daily shore charging', () => {
  const p = project();
  p.items = p.items.filter((it) => it.kind !== 'inverter');
  p.systems.externalInverterRef = '  ';
  p.trip.shoreHours = 12;
  const missing = calculate(p);
  assert.equal(missing.acPathMissing, true);
  assert.equal(missing.inverterAvailable, false);
  assert.equal(missing.balanceWh, null);
  assert.equal(missing.electricDays, null);
  assert.equal(missing.autonomyDays, null);
  p.systems.externalInverterRef = 'Bestandsgerät, Stromfach Heck rechts';
  assert.equal(calculate(p).acPathMissing, false);
  assert.notEqual(calculate(p).autonomyDays, null);
  p.systems.externalInverterRef = '';
  p.items.push(makeItem('inverter'));
  assert.equal(calculate(p).inverterSource, 'Wechselrichter');
  p.items = p.items.filter((it) => it.kind !== 'inverter');
  p.systems.loads = p.systems.loads.filter((l) => l.bus !== 'AC');
  assert.equal(calculate(p).acPathMissing, false);
  p.systems.hotWaterSource = 'electric';
  p.systems.boilerBus = 'AC';
  p.items.push(makeItem('boiler'));
  assert.equal(calculate(p).acPathMissing, true);
  p.systems.boilerBus = 'DC';
  assert.equal(calculate(p).acPathMissing, false);
});

test('winter comparison quantifies changes of gross occupied space separately from nominal capacity', () => {
  const p = project();
  const [small, large] = compareTanks(p);
  close(small.space.opening.grossVolume, 117);
  close(large.space.opening.grossVolume, 175.5);
  close(
    large.space.opening.grossVolume - small.space.opening.grossVolume,
    58.5,
  );
  assert.equal(large.capacity - small.capacity, 50);
});
