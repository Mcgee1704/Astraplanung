import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, readProject } from '../src/project.js';
import { changeLayout, openingFor, syncOpenings } from '../src/layout/links.js';
import { layoutVariants, makeLayout } from '../src/layout/templates.js';
import { calculate, loadWh } from '../src/systems/model.js';
import { newStage, simulateStages } from '../src/itinerary.js';

const archive = (p) =>
  JSON.stringify({ format: 'astraplanung', version: 1, project: p });
test('Alle 18 Tourengrundrisse lassen sich mit ihren Referenzmaßen öffnen, bearbeiten und übertragen', () => {
  const tours = layoutVariants.filter((v) => v.id.startsWith('tour-'));
  assert.equal(tours.length, 18);
  assert.equal(new Set(tours.map((v) => v.name)).size, tours.length);
  for (const variant of tours) {
    const p = createProject({ variant: variant.id, preset: 'source' }),
      restored = readProject(archive(p));
    assert.deepEqual(
      [p.vehicle.length, p.vehicle.width, p.vehicle.height],
      variant.reference,
    );
    assert.ok(p.items.length >= 8);
    assert.ok(p.items.every((i) => Number.isInteger(i.length) && i.length > 0));
    assert.ok(p.items.some((i) => i.kind === 'bed'));
    assert.ok(p.items.some((i) => i.kind === 'kitchen'));
    assert.equal(p.vehicle.baseMass, null);
    assert.notEqual(restored.id, p.id);
    assert.deepEqual(restored.items, p.items);
  }
});
test('Ein offenes Fahrzeugaufmaß lässt sich verlustfrei sichern und wieder öffnen', () => {
  const p = createProject();
  p.vehicle.length = null;
  p.vehicle.baseRear = null;
  const restored = readProject(archive(p));
  assert.equal(restored.vehicle.length, null);
  assert.equal(restored.vehicle.baseRear, null);
  p.vehicle.length = -1;
  assert.throws(() => readProject(archive(p)), /Fahrzeugmaß/);
});
test('Gerätezuordnung bei Wechsel und Rückkehr hält die Pumpenlast und ursprüngliche Änderungen', () => {
  const p = createProject();
  const original = p.systems.loads.find((l) => l.id === 'pump');
  original.hours = 0.33;
  const other = changeLayout(p, '2a', makeLayout('2a', p.vehicle));
  const load = other.systems.loads.find((l) => l.id === 'pump');
  assert.notEqual(load.itemId, original.itemId);
  assert.equal(load.itemId, other.items.find((i) => i.kind === 'pump').id);
  assert.equal(
    loadWh(load, other.systems, other.items),
    loadWh(original, p.systems, p.items),
  );
  const back = changeLayout(other, '1a', other.layoutDrafts['1a']);
  assert.equal(
    back.systems.loads.find((l) => l.id === 'pump').itemId,
    original.itemId,
  );
});
test('Zwei Tanks lesen dieselbe reale Wandöffnung, auch nach Änderung und Entfernen', () => {
  const p = createProject();
  const hatch = p.items.find((i) => i.kind === 'hatch');
  hatch.length = 710;
  hatch.height = 330;
  const tanks = p.items.filter((i) => ['fresh', 'grey'].includes(i.kind));
  for (const tank of tanks) tank.serviceId = hatch.id;
  const all = syncOpenings(p.items);
  for (const t of all.filter((i) => tanks.some((j) => i.id === j.id))) {
    assert.deepEqual(openingFor(t, all), { width: 710, height: 330 });
    assert.equal(t.serviceWidth, 710);
  }
  assert.equal(
    openingFor(
      tanks[0],
      p.items.filter((i) => i.id !== hatch.id),
    ).width,
    null,
  );
});
test('Etappen übertragen Vorräte, Nachversorgung stellt nur die gewählten Vorräte wieder her', () => {
  const p = createProject();
  p.trip.waterPerPerson = 10;
  p.trip.greyFraction = 0;
  p.trip.outsideC = 25;
  p.trip.solarHours = 12;
  const a = { ...newStage(p.trip, 0), days: 3 },
    b = { ...newStage(p.trip, 1), days: 3 };
  let result = simulateStages(p, [a, b]);
  assert.equal(result[0].status, 'erreicht');
  assert.equal(result[0].end.fresh, 40);
  assert.equal(result[1].status, 'engpass');
  assert.equal(result[1].covered, 2);
  result = simulateStages(p, [a, { ...b, fresh: true }]);
  assert.equal(result[1].status, 'erreicht');
  assert.equal(result[1].end.fresh, 40);
});
test('Die Etappenplanung übernimmt den Warmwasser-Leistungsengpass der Bordtechnik', () => {
  const p = createProject();
  p.systems.hotWaterSource = 'electric';
  p.systems.boilerItemId = 'missing';
  p.systems.hotWaterL = 6;
  const result = calculate(p);
  assert.equal(result.waterHeatShortfall, true);
  const [leg] = simulateStages(p, [{ ...newStage(p.trip, 0), days: 1 }]);
  assert.equal(leg.status, 'engpass');
  assert.ok(leg.limiting.includes('warmWater'));
  assert.equal(leg.covered, 0);
});
