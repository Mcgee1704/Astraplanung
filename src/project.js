import { makeLayout, layoutVariants } from './layout/templates.js';
import { syncOpenings } from './layout/links.js';
import { makeSystems, makeTrip, seasons } from './systems/model.js';
import { makeRecords } from './records/model.js';
import {
  makeWheelWeighing,
  validWheelWeighing,
} from './vehicle/wheel-weighing.js';
import { validStencilDraft } from './stencils/geometry.js';

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
export const now = () => new Date().toISOString();
export const vehiclePresets = {
  van: {
    name: 'Kastenwagen 4×4',
    kind: 'Kastenwagen',
    length: 4200,
    width: 1900,
    height: 2100,
    wheelbase: 3665,
    frontAxleX: -1000,
    maxMass: 3500,
    baseMass: 2380,
    frontMax: 1850,
    rearMax: 2250,
  },
  compact: {
    name: 'Kompakter Kastenwagen',
    kind: 'Kastenwagen',
    length: 3100,
    width: 1780,
    height: 1880,
    wheelbase: 3450,
    frontAxleX: -960,
    maxMass: 3500,
    baseMass: 2130,
    frontMax: 1750,
    rearMax: 2000,
  },
  box: {
    name: 'Expeditionskoffer',
    kind: 'Kofferaufbau',
    length: 4400,
    width: 2280,
    height: 2000,
    wheelbase: 3900,
    frontAxleX: -1200,
    maxMass: 7490,
    baseMass: 4760,
    frontMax: 3350,
    rearMax: 5000,
  },
};
export function makeVehicle(preset = 'van') {
  return {
    ...(vehiclePresets[preset] || vehiclePresets.van),
    baseFront: null,
    baseRear: null,
    wheelWeighing: makeWheelWeighing(),
    weighRef: '',
    notes: '',
  };
}
export const stages = ['Vorplanung', 'Ausbauplanung', 'Im Bau', 'Im Einsatz'];
export function createProject({
  name = 'Atlas 01',
  variant = '1a',
  preset = 'van',
  id = uid(),
} = {}) {
  const variantInfo = layoutVariants.find((v) => v.id === variant);
  const vehicle = makeVehicle(preset === 'source' ? 'box' : preset);
  if (preset === 'source' && variantInfo?.reference) {
    [vehicle.length, vehicle.width, vehicle.height] = variantInfo.reference;
    Object.assign(vehicle, {
      name: 'Beispielfahrzeug · ' + variantInfo.name,
      kind: variantInfo.vehicleKind || 'Kofferaufbau',
      baseMass: null,
      maxMass: null,
      frontMax: null,
      rearMax: null,
      wheelbase: null,
      frontAxleX: null,
      measurementSource: variantInfo.source,
    });
  }
  const items = makeLayout(variant, vehicle);
  const createdAt = now();
  return {
    id,
    name,
    schema: 1,
    createdAt,
    updatedAt: createdAt,
    stage: 'Ausbauplanung',
    buildType: 'Fernreisemobil',
    layoutVariant: variant,
    vehicle,
    trip: { ...makeTrip(), season: 'Winter', ...seasons.Winter },
    items,
    systems: makeSystems(items),
    records: makeRecords(items),
  };
}
export function copyProject(project, name) {
  return {
    ...structuredClone(project),
    id: uid(),
    name: name || project.name + ' · Kopie',
    rev: 0,
    writer: '',
    createdAt: now(),
    updatedAt: now(),
  };
}
export function format(value, digits = 0) {
  if (value === Infinity) return '∞';
  if (value === null || value === undefined || !Number.isFinite(Number(value)))
    return '–';
  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: digits,
  }).format(value);
}
export function formatDate(date) {
  return Number.isNaN(Date.parse(date))
    ? ''
    : new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(date));
}
export function layoutName(project) {
  return (
    layoutVariants.find((v) => v.id === project.layoutVariant)?.name ||
    'Eigener Grundriss'
  );
}
export function downloadFile(filename, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
export function exportProject(project) {
  const { writer, rev, ...clean } = project;
  const safeName = (project.name || 'Fahrzeug')
    .replace(/[^\p{L}\p{N}_. -]/gu, '-')
    .slice(0, 85);
  downloadFile(
    safeName + '.astraplanung.json',
    JSON.stringify(
      { format: 'astraplanung', version: 1, project: clean },
      null,
      2,
    ),
    'application/json',
  );
}
const plain = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function validStructure(value, depth = 0) {
  if (depth > 18) return false;
  if (!value || typeof value !== 'object')
    return typeof value !== 'number' || Number.isFinite(value);
  return Object.entries(value).every(
    ([key, child]) =>
      !['__proto__', 'constructor', 'prototype'].includes(key) &&
      validStructure(child, depth + 1),
  );
}
function checkShape(value, sample, label) {
  if (!plain(value)) throw new Error(label + ' fehlt oder ist ungültig.');
  for (const [key, expected] of Object.entries(sample)) {
    const input = value[key];
    if (input === undefined) continue;
    if (
      Array.isArray(expected)
        ? !Array.isArray(input)
        : plain(expected)
          ? !plain(input)
          : input !== null &&
            expected !== null &&
            typeof expected !== typeof input
    ) {
      throw new Error(label + ' enthält ein ungültiges Feld (' + key + ').');
    }
  }
}
export function readProject(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error('Die Datei enthält kein lesbares JSON.');
  }
  if (
    doc?.format !== 'astraplanung' ||
    doc.version !== 1 ||
    !plain(doc.project)
  )
    throw new Error(
      'Bitte eine Astraplanung-Projektdatei der Version 1 wählen.',
    );
  const p = doc.project;
  if (
    !validStructure(p) ||
    typeof p.name !== 'string' ||
    !p.name.trim() ||
    !Array.isArray(p.items)
  )
    throw new Error('Name oder Bauteilliste ist ungültig.');
  checkShape(p.vehicle, makeVehicle(), 'Fahrzeug');
  checkShape(p.trip, makeTrip(), 'Reiseprofil');
  checkShape(p.systems, makeSystems(), 'Bordtechnik');
  checkShape(p.records, makeRecords(), 'Fahrzeugakte');
  if (
    p.vehicle.wheelWeighing !== undefined &&
    !validWheelWeighing(p.vehicle.wheelWeighing)
  )
    throw new Error('Die Radwägung enthält ungültige Messdaten.');
  const stencilIds = new Set();
  for (const stencil of p.records.stencils ?? []) {
    if (!validStencilDraft(stencil) || stencilIds.has(stencil.id))
      throw new Error(
        'Eine Schablone ist ungültig oder hat eine doppelte Kennung.',
      );
    stencilIds.add(stencil.id);
  }
  for (const key of ['length', 'width', 'height'])
    if (
      p.vehicle[key] != null &&
      (!Number.isFinite(p.vehicle[key]) || p.vehicle[key] < 0)
    )
      throw new Error('Ein Fahrzeugmaß ist ungültig.');
  for (const key of ['stage', 'buildType', 'layoutVariant'])
    if (p[key] !== undefined && typeof p[key] !== 'string')
      throw new Error('Eine Projektbezeichnung ist ungültig.');
  if (
    p.trip.stages !== undefined &&
    (!Array.isArray(p.trip.stages) ||
      p.trip.stages.some(
        (s) =>
          !plain(s) || typeof s.id !== 'string' || typeof s.name !== 'string',
      ))
  )
    throw new Error('Die Etappenliste ist ungültig.');
  if (
    p.systems.candidates?.some(
      (c) => !plain(c) || !plain(c.vehicle) || typeof c.id !== 'string',
    )
  )
    throw new Error('Ein Vergleichsfahrzeug ist ungültig.');
  if (
    p.systems.candidates?.some(
      (c) =>
        c.vehicle.wheelWeighing != null &&
        !validWheelWeighing(c.vehicle.wheelWeighing),
    )
  )
    throw new Error('Die Radwägung eines Vergleichsfahrzeugs ist ungültig.');
  for (const map of [p.records.cards, p.records.cuts, p.records.routeEdits])
    if (map && Object.values(map).some((v) => !plain(v)))
      throw new Error('Ein Werkstatteintrag ist ungültig.');
  const seen = new Set();
  for (const item of p.items) {
    if (
      !plain(item) ||
      typeof item.id !== 'string' ||
      !item.id ||
      seen.has(item.id) ||
      typeof item.kind !== 'string' ||
      typeof item.name !== 'string'
    )
      throw new Error(
        'Die Bauteilliste enthält einen ungültigen oder doppelten Eintrag.',
      );
    seen.add(item.id);
    for (const key of ['x', 'y', 'z', 'length', 'width', 'height'])
      if (
        !Number.isFinite(item[key]) ||
        (['length', 'width', 'height'].includes(key) && item[key] <= 0)
      )
        throw new Error('Ungültige Geometrie bei „' + item.name + '“.');
  }
  for (const rows of [
    p.systems.loads,
    p.systems.wiring,
    p.systems.candidates,
    p.records.steps,
    p.records.extraRoutes,
    p.records.purchases,
  ])
    if (Array.isArray(rows) && !rows.every(plain))
      throw new Error('Die Projektdatei enthält eine ungültige Liste.');
  const restored = {
    ...p,
    items: syncOpenings(p.items),
    vehicle: {
      ...makeVehicle(),
      length: null,
      width: null,
      height: null,
      ...p.vehicle,
    },
    systems: { ...makeSystems(), ...p.systems },
    trip: { ...makeTrip(), ...p.trip },
    records: { ...makeRecords(), ...p.records },
  };
  return copyProject(restored, p.name.trim());
}
