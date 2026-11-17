import assert from 'node:assert/strict';
import test from 'node:test';
import { createProject, readProject } from '../src/project.js';
import { recordsOf } from '../src/records/model.js';

const transfer = (project) =>
  readProject(JSON.stringify({ format: 'astraplanung', version: 1, project }));

test('Ein älterer Ausbau behält die Achswägung und erhält leere Messbereiche', () => {
  const p = createProject();
  delete p.vehicle.wheelWeighing;
  delete p.records.stencils;
  p.vehicle.baseFront = 1250.5;
  p.vehicle.baseRear = 1312;
  const copy = transfer(p);
  assert.equal(copy.vehicle.baseFront, 1250.5);
  assert.equal(copy.vehicle.baseRear, 1312);
  assert.deepEqual(copy.records.stencils, []);
  assert.deepEqual(copy.vehicle.wheelWeighing.travel.values, {});
  assert.equal(copy.vehicle.wheelWeighing.useBaseline, false);
});

test('Werkstatt und Projektübertragung bewahren auch ein unvollständiges Konturaufmaß', () => {
  const p = createProject();
  const stencil = {
    id: 'nische',
    name: 'Nische am Boden',
    itemId: p.items[0].id,
    paper: 'A3',
    orientation: 'landscape',
    points: [
      { x: -10.5, y: 0 },
      { x: 320, y: 0, via: { x: 328, y: null } },
      { x: 320, y: null },
    ],
  };
  p.records.stencils = [stencil];
  assert.deepEqual(recordsOf(p).stencils, [stencil]);
  const copy = transfer(p);
  assert.deepEqual(copy.records.stencils, [stencil]);
  copy.records.stencils[0].points[0].x = 44;
  assert.equal(stencil.points[0].x, -10.5);
});

test('Der Import weist doppelte Schablonen und ungültige Messpunkte zurück', () => {
  const p = createProject();
  const stencil = { id: 'eins', name: 'Heck', points: [] };
  p.records.stencils = [stencil, stencil];
  assert.throws(() => transfer(p), /Schablon/);
  p.records.stencils = [{ ...stencil, points: [{ x: 'falsch', y: 0 }] }];
  assert.throws(() => transfer(p), /Schablon/);
});

test('Auch nach freier Umbenennung ist die gemessene Zuschnittposition im Projekt erkennbar', () => {
  const project = createProject();
  const stencil = {
    id: 'schablone-heck',
    name: 'Passprobe am Heck',
    itemId: project.items[0].id,
    cutRef: { rowId: 'back', label: 'Rückwand' },
    points: [],
  };
  project.records.stencils = [stencil];
  assert.deepEqual(transfer(project).records.stencils[0], stencil);
  for (const cutRef of [
    null,
    { rowId: '', label: 'Rückwand' },
    { rowId: 'back', label: 3 },
  ]) {
    project.records.stencils = [{ ...stencil, cutRef }];
    assert.throws(() => transfer(project), /Schablon/);
  }
  project.records.stencils = [{ ...stencil, itemId: '' }];
  assert.throws(() => transfer(project), /Schablon/);
});

test('Radlasten bleiben beim Übertragen erhalten, ungültige Einzelwägungen werden abgewiesen', () => {
  const p = createProject();
  assert.ok(p.vehicle.wheelWeighing);
  const weights = p.vehicle.wheelWeighing.travel.values;
  weights['front.left.single'] = 701.5;
  weights['front.right.single'] = 0;
  assert.deepEqual(transfer(p).vehicle.wheelWeighing, p.vehicle.wheelWeighing);
  weights['front.left.single'] = -12;
  assert.throws(() => transfer(p), /Radwägung|Radlast/);
});
