import { makeWheelWeighing, wheelTotals } from '../vehicle/wheel-weighing.js';
import { bill, cardOf, recordsOf } from '../records/model.js';
import {
  extractionPath,
  intersects,
  isOpening,
  isRoof,
  layoutFindings,
  tankFacts,
} from '../layout/geometry.js';

/** All distances in mm along the vehicle from its front interior wall.
 * Inputs are editable planning assumptions, never equipment specifications.
 * Mass of a component is its dry, installed mass. Tank liquid is added here.
 */
export function makeTrip() {
  return {
    people: 2,
    days: 5,
    season: 'Übergangszeit',
    region: '',
    route: '',
    budget: 25000,
    personKg: 75,
    cargoKg: 80,
    occupantX: -350,
    cargoX: 2200,
    waterPerPerson: 12,
    greyFraction: 0.75,
    solarHours: 2.5,
    outsideC: 5,
    driveHours: 0,
    shoreHours: 0,
    notes: '',
  };
}

export function makeSystems(items = []) {
  return {
    topology: '24/12',
    startCharge: 1,
    reserveCharge: 0.2,
    pvEfficiency: 0.75,
    inverterEfficiency: 0.9,
    externalInverterRef: '',
    alternatorW: 300,
    shoreW: 250,
    solarEnabled: true,
    alternatorEnabled: true,
    shoreEnabled: true,
    loads: [
      {
        id: 'refrigeration',
        name: 'Kühlbox',
        watts: 45,
        hours: 8,
        qty: 1,
        bus: 'DC',
        itemId: items.find((it) => it.kind === 'fridge')?.id || '',
      },
      {
        id: 'lights',
        name: 'Innenbeleuchtung',
        watts: 12,
        hours: 4,
        qty: 1,
        bus: 'DC',
      },
      {
        id: 'pump',
        name: 'Wasserpumpe',
        watts: 60,
        hours: 0.2,
        qty: 1,
        bus: 'DC',
        itemId: items.find((it) => it.kind === 'pump')?.id || '',
      },
      {
        id: 'computer',
        name: 'Notebook',
        watts: 60,
        hours: 2,
        qty: 1,
        bus: 'AC',
      },
    ],
    heaterItemId: 'auto',
    heater: 'diesel',
    heaterPowerW: 2000,
    heaterEfficiency: 0.83,
    heaterFanW: 12,
    heatHours: 12,
    insideC: 18,
    uValue: 1.4,
    airChanges: 0.75,
    hotWaterL: 3,
    waterDeltaK: 35,
    heaterBus: 'DC',
    hotWaterSource: 'heater',
    boilerItemId: 'auto',
    boilerEfficiency: 0.9,
    boilerPowerW: 500,
    boilerBus: 'AC',
    fuelAmount: 12,
    fuelKwh: 9.8,
    fuelKg: 0.84,
    extraFuel: false,
    fuelX: 1500,
    winterOutsideC: -5,
    winterSolarHours: 1.25,
    candidates: [],
    waterNotes: '',
    thermalNotes: '',
  };
}

export const seasons = {
  Sommer: { outsideC: 22, solarHours: 4.5 },
  Übergangszeit: { outsideC: 5, solarHours: 2.5 },
  Winter: { outsideC: -5, solarHours: 1.25 },
};

export const topologies = {
  '12/12': { label: '12 V / 12 V', starter: 12, house: 12 },
  '24/12': { label: '24 V / 12 V', starter: 24, house: 12 },
  '24/24': { label: '24 V / 24 V', starter: 24, house: 24 },
};

export function systemData(project) {
  const defaults = makeSystems(project.items || []);
  const data = { ...defaults, ...project.systems };
  for (const key of ['loads', 'candidates']) {
    if (!Array.isArray(data[key])) data[key] = defaults[key];
    else
      data[key] = data[key].filter(
        (row) =>
          row &&
          typeof row === 'object' &&
          (key !== 'candidates' ||
            (row.vehicle && typeof row.vehicle === 'object')),
      );
  }
  return data;
}

export function tripData(project) {
  return { ...makeTrip(), ...project.trip };
}

const nonnegative = (value) => inRange(value, 0);
const fraction = (value) => inRange(value, 0, 1);
function number(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
function inRange(value, min, max = Infinity) {
  const result = number(value);
  return result !== null && result >= min && result <= max ? result : null;
}
function quantity(value) {
  const result = nonnegative(value);
  return Number.isInteger(result) ? result : null;
}
function positive(value) {
  const result = nonnegative(value);
  return result !== null && result > 0 ? result : null;
}
function total(values) {
  return values.some((v) => v === null)
    ? null
    : values.reduce((a, b) => a + b, 0);
}
function product(...values) {
  return values.includes(null) ? null : values.reduce((a, b) => a * b, 1);
}
function diff(a, b) {
  return a === null || b === null ? null : a - b;
}
function daysFor(amount, perDay) {
  if (perDay === null) return null;
  if (perDay <= 0) return Infinity;
  return amount === null ? null : Math.max(0, amount) / perDay;
}
function limitDays(entries) {
  const known = entries.filter(([, value]) => value !== null);
  const first = [...known].sort((a, b) => a[1] - b[1])[0];
  if (!first || (known.length < entries.length && first[1] !== 0)) {
    return { days: null, name: 'Daten offen', upper: first?.[1] ?? null };
  }
  const tied = known
    .filter(([, day]) => Math.abs(day - first[1]) <= 1e-9)
    .map(([name]) => name);
  let label =
    first[1] === Infinity ? 'Tagesbilanz ausgeglichen' : tied.join(' / ');
  if (
    tied.length === 2 &&
    tied.includes('Frischwasser') &&
    tied.includes('Grauwasserkapazität')
  )
    label = 'Frisch- und Grauwasser';
  return { days: first[1], name: label, upper: first[1] };
}

export function tankFill(item) {
  return fraction(
    item.fill === undefined ? (item.kind === 'fresh' ? 1 : 0) : item.fill,
  );
}
function tankVolume(item) {
  return product(nonnegative(item.capacity), tankFill(item));
}

function waterBalance(items, t) {
  const tanks = items.filter((it) => it.kind === 'fresh' || it.kind === 'grey');
  const group = (kind) => tanks.filter((it) => it.kind === kind);
  const cap = (kind) =>
    total(group(kind).map((it) => nonnegative(it.capacity)));
  const fill = (kind) => total(group(kind).map(tankVolume));
  const freshL = cap('fresh'),
    greyL = cap('grey');
  const freshAvailableL = fill('fresh'),
    greyFilledL = fill('grey');
  const greyAvailableL = diff(greyL, greyFilledL);
  const waterDailyL = product(
    quantity(t.people),
    nonnegative(t.waterPerPerson),
  );
  const greyDailyL = product(waterDailyL, fraction(t.greyFraction));
  const freshDays = daysFor(freshAvailableL, waterDailyL),
    greyDays = daysFor(greyAvailableL, greyDailyL);
  return {
    freshL,
    greyL,
    freshAvailableL,
    greyFilledL,
    greyAvailableL,
    waterDailyL,
    greyDailyL,
    freshDays,
    greyDays,
    waterDays: limitDays([
      ['Frischwasser', freshDays],
      ['Abwasser', greyDays],
    ]).days,
  };
}

function electricInput(energyWh, bus, inverterEfficiency) {
  if (bus !== 'AC' || energyWh === 0) return energyWh;
  const efficiency = fraction(inverterEfficiency);
  return energyWh !== null && efficiency > 0 ? energyWh / efficiency : null;
}
function heatBalance(v, t, s, boilerMissing) {
  const dims = [v.length, v.width, v.height].map(positive);
  const [l, w, h] = dims.map((x) => (x === null ? null : x / 1000));
  const volume = product(l, w, h);
  const area = volume === null ? null : 2 * (l * w + l * h + w * h);
  const delta = diff(number(s.insideC), number(t.outsideC));
  const deltaT = delta === null ? null : Math.max(0, delta);
  const transmission = product(area, nonnegative(s.uValue));
  const ventilation = product(0.34, volume, nonnegative(s.airChanges));
  const heatLoadW =
    deltaT === 0 ? 0 : product(total([transmission, ventilation]), deltaT);
  const hours = inRange(s.heatHours, 0, 24);
  const spaceWh = hours === 0 ? 0 : product(heatLoadW, hours);
  const hotWaterWh = product(
    quantity(t.people),
    nonnegative(s.hotWaterL),
    nonnegative(s.waterDeltaK),
    1.163,
  );
  const heatDemandWh = total([spaceWh, hotWaterWh]);
  const separate = s.hotWaterSource === 'electric';
  const heaterDemandWh = separate ? spaceWh : heatDemandWh;
  const eff = fraction(s.heaterEfficiency);
  const heatInputWh =
    heaterDemandWh === 0
      ? 0
      : heaterDemandWh !== null && eff > 0
        ? heaterDemandWh / eff
        : null;
  const boilerEff = fraction(s.boilerEfficiency);
  const boilerInputWh =
    !separate || boilerMissing || hotWaterWh === 0
      ? 0
      : hotWaterWh !== null && boilerEff > 0
        ? hotWaterWh / boilerEff
        : null;
  const boilerWh = electricInput(
    boilerInputWh,
    s.boilerBus,
    s.inverterEfficiency,
  );
  const boilerOutput = boilerMissing ? 0 : nonnegative(s.boilerPowerW);
  const waterHeatShortfall =
    !separate || hotWaterWh === 0
      ? false
      : boilerOutput === null || hotWaterWh === null
        ? null
        : hotWaterWh > boilerOutput * 24;
  const fuelHeater = ['diesel', 'gas'].includes(s.heater);
  const energyPerUnit = positive(s.fuelKwh);
  const fuelDaily = fuelHeater
    ? heatInputWh !== null && energyPerUnit !== null
      ? heatInputWh / (energyPerUnit * 1000)
      : null
    : 0;
  const fuelDays = daysFor(nonnegative(s.fuelAmount), fuelDaily);
  const heaterPower = nonnegative(s.heaterPowerW);
  const availableHeatW = s.heater === 'none' ? 0 : heaterPower;
  const enabled = s.heater !== 'none';
  const operatingHours =
    enabled && heaterDemandWh !== null && availableHeatW > 0
      ? Math.min(24, heaterDemandWh / availableHeatW)
      : heaterDemandWh === 0
        ? 0
        : null;
  const fanWh = fuelHeater
    ? product(nonnegative(s.heaterFanW), operatingHours)
    : 0;
  // Compare both peak space demand and total usable output during a day.
  const heatShortfall =
    hours === null ||
    (hours > 0 && heatLoadW === null) ||
    heaterDemandWh === null ||
    availableHeatW === null
      ? null
      : (hours > 0 && heatLoadW > availableHeatW) ||
        heaterDemandWh > availableHeatW * 24;
  return {
    area,
    volume,
    heatLoadW,
    spaceWh,
    hotWaterWh,
    heatDemandWh,
    fuelDaily,
    fuelDays,
    heatShortfall,
    fuelUnit: s.heater === 'gas' ? 'kg' : 'l',
    boilerWh,
    waterHeatShortfall,
    electricHeatWh:
      s.heater === 'electric'
        ? electricInput(heatInputWh, s.heaterBus, s.inverterEfficiency)
        : 0,
    fanWh,
  };
}

export function loadWh(load, s, items) {
  if (
    load.enabled === false ||
    (load.itemId && !items.some((i) => i.id === load.itemId))
  )
    return 0;
  const energy = product(
    nonnegative(load.watts),
    inRange(load.hours, 0, 24),
    quantity(load.qty === undefined ? 1 : load.qty),
  );
  return electricInput(energy, load.bus, s.inverterEfficiency);
}

function electricalBalance(items, t, s, heat) {
  const batteries = items.filter((it) => it.kind === 'battery');
  const panels = items.filter((it) => it.kind === 'solar');
  const batteryWh = total(
    batteries.map((it) => product(positive(it.voltage), nonnegative(it.ah))),
  );
  const difference = diff(fraction(s.startCharge), fraction(s.reserveCharge));
  const usableWh = product(
    batteryWh,
    difference === null ? null : Math.max(0, difference),
  );
  const solarWp = total(panels.map((it) => nonnegative(it.watts)));
  const solarWh =
    s.solarEnabled && solarWp !== 0
      ? product(solarWp, inRange(t.solarHours, 0, 24), fraction(s.pvEfficiency))
      : 0;
  const alternatorWh =
    s.alternatorEnabled && t.driveHours !== 0
      ? product(nonnegative(s.alternatorW), inRange(t.driveHours, 0, 24))
      : 0;
  const shoreWh =
    s.shoreEnabled && t.shoreHours !== 0
      ? product(nonnegative(s.shoreW), inRange(t.shoreHours, 0, 24))
      : 0;
  const scheduleOverlap =
    s.alternatorEnabled &&
    s.shoreEnabled &&
    Number(t.driveHours) + Number(t.shoreHours) > 24;
  const generationWh = scheduleOverlap
    ? null
    : total([solarWh, alternatorWh, shoreWh]);
  const loadsWh = total(s.loads.map((load) => loadWh(load, s, items)));
  const consumptionWh = total([
    loadsWh,
    heat.electricHeatWh,
    heat.boilerWh,
    heat.fanWh,
  ]);
  const inverter = items.find((it) => it.kind === 'inverter');
  const reference =
    typeof s.externalInverterRef === 'string'
      ? s.externalInverterRef.trim()
      : '';
  const inverterSource = inverter?.name || reference;
  const inverterAvailable = Boolean(inverter || reference);
  const acLoad = s.loads.some(
    (load) => load.bus === 'AC' && loadWh(load, s, items) !== 0,
  );
  const acHeat =
    s.heater === 'electric' &&
    s.heaterBus === 'AC' &&
    heat.electricHeatWh !== 0;
  const acBoiler =
    s.hotWaterSource === 'electric' &&
    s.boilerBus === 'AC' &&
    heat.boilerWh !== 0;
  const acPathMissing = !inverterAvailable && (acLoad || acHeat || acBoiler);
  const balanceWh = acPathMissing ? null : diff(generationWh, consumptionWh);
  let electricDays = balanceWh === null ? null : daysFor(usableWh, -balanceWh);
  if (consumptionWh > 0 && usableWh === null) electricDays = null;
  if (consumptionWh > 0 && (batteryWh === 0 || usableWh === 0))
    electricDays = 0;
  if (acPathMissing) electricDays = null;
  return {
    inverterAvailable,
    inverterSource,
    acPathMissing,
    solarWp,
    batteryWh,
    usableWh,
    solarWh,
    alternatorWh,
    shoreWh,
    scheduleOverlap,
    generationWh,
    loadsWh,
    consumptionWh,
    balanceWh,
    electricDays,
  };
}

function weightBalance(v, items, t, s, records) {
  const massDetails = items.map((it) => {
    const card = cardOf(it, records);
    const planned = nonnegative(it.mass),
      actual = nonnegative(card.actualMass);
    const measured =
      ['Eingebaut', 'Geprüft'].includes(card.status) && actual !== null;
    return {
      id: it.id,
      name: it.name,
      planned,
      actual,
      measured,
      used: measured ? actual : planned,
    };
  });
  const dryMassKg = total(massDetails.map((entry) => entry.used));
  const plannedDryMassKg = total(massDetails.map((entry) => entry.planned));
  const measuredCount = massDetails.filter((entry) => entry.measured).length;
  const costEur = total(items.map((it) => nonnegative(it.cost)));
  const fluidKg = total(
    items.filter((it) => ['fresh', 'grey'].includes(it.kind)).map(tankVolume),
  );
  const peopleKg = product(quantity(t.people), nonnegative(t.personKg)),
    cargoKg = nonnegative(t.cargoKg);
  const fuelKg =
    s.extraFuel && ['gas', 'diesel'].includes(s.heater)
      ? product(nonnegative(s.fuelAmount), nonnegative(s.fuelKg))
      : 0;
  const weighing = v.wheelWeighing || makeWheelWeighing();
  const multiAxle = weighing.axles.length > 2;
  const wheelBaseline = weighing.useBaseline;
  const wheelBase = wheelBaseline ? wheelTotals(weighing, 'baseline') : null;
  const included = wheelBaseline ? weighing.baseline.included : [];
  const includedKg = total(included.map((entry) => nonnegative(entry.kg)));
  const extraKg = diff(
    total([dryMassKg, fluidKg, peopleKg, cargoKg, fuelKg]),
    includedKg,
  );
  const baseFront = wheelBaseline
    ? wheelBase.axles[0].totalKg
    : positive(v.baseFront);
  const baseRear = wheelBaseline
    ? wheelBase.axles[1].totalKg
    : positive(v.baseRear);
  const hasAxleWeights = !multiAxle && baseFront !== null && baseRear !== null;
  const baseKg = wheelBaseline
    ? wheelBase.totalKg
    : hasAxleWeights
      ? baseFront + baseRear
      : positive(v.baseMass);
  const massKg = total([baseKg, extraKg]);
  const max = positive(v.maxMass);
  const payloadKg = diff(max, massKg);
  const wheelbase = positive(v.wheelbase),
    axle = number(v.frontAxleX);
  const entries = items.map((it, i) => {
    const start = number(it.x),
      len = positive(it.length);
    const dry = massDetails[i].used;
    const kg = ['fresh', 'grey'].includes(it.kind)
      ? total([dry, tankVolume(it)])
      : dry;
    return {
      id: 'item:' + it.id,
      name: it.name,
      kg,
      x: start === null || len === null ? null : start + len / 2,
    };
  });
  entries.push(
    { id: 'people', name: 'Reisende', kg: peopleKg, x: number(t.occupantX) },
    {
      id: 'cargo',
      name: 'Gepäck und Vorräte',
      kg: cargoKg,
      x: number(t.cargoX),
    },
    {
      id: 'fuel',
      name: 'Separater Heizbrennstoff',
      kg: fuelKg,
      x: number(s.fuelX),
    },
  );
  const weighingPositions = entries;
  const loadChanges = [
    ...entries,
    ...included.map((entry) => ({
      kg: entry.kg == null ? null : -entry.kg,
      x: entry.x,
    })),
  ];
  const rearExtra =
    wheelbase !== null && axle !== null
      ? total(
          loadChanges.map((e) =>
            e.kg === 0
              ? 0
              : e.kg === null || e.x === null
                ? null
                : (e.kg * (e.x - axle)) / wheelbase,
          ),
        )
      : null;
  const rearKg = hasAxleWeights ? total([baseRear, rearExtra]) : null;
  const frontKg = hasAxleWeights
    ? total([baseFront, diff(extraKg, rearExtra)])
    : null;
  const frontReserveKg = diff(positive(v.frontMax), frontKg),
    rearReserveKg = diff(positive(v.rearMax), rearKg);
  return {
    dryMassKg,
    plannedDryMassKg,
    measuredCount,
    massDetails,
    fluidKg,
    peopleKg,
    cargoKg,
    fuelKg,
    extraKg,
    baseKg,
    massKg,
    costEur,
    payloadKg,
    hasAxleWeights,
    multiAxle,
    wheelBaseline,
    includedKg,
    weighingPositions,
    frontKg,
    rearKg,
    frontReserveKg,
    rearReserveKg,
    baseDiscrepancy:
      hasAxleWeights && includedKg !== null && positive(v.baseMass) !== null
        ? baseKg - includedKg - Number(v.baseMass)
        : null,
  };
}

export function calculate(project) {
  const items = project.items || [],
    v = project.vehicle || {},
    t = tripData(project),
    s = systemData(project);
  const heaterItem =
    !s.heaterItemId || s.heaterItemId === 'auto'
      ? items.find((it) => it.kind === 'heater')
      : items.find((it) => it.id === s.heaterItemId);
  const heaterMissing = s.heater !== 'none' && !heaterItem;
  const boilerItem =
    !s.boilerItemId || s.boilerItemId === 'auto'
      ? items.find((it) => it.kind === 'boiler')
      : items.find((it) => it.id === s.boilerItemId);
  const boilerMissing = s.hotWaterSource === 'electric' && !boilerItem;
  const water = waterBalance(items, t),
    heat = heatBalance(
      v,
      t,
      heaterMissing ? { ...s, heater: 'none' } : s,
      boilerMissing,
    );
  const electric = electricalBalance(items, t, s, heat);
  const records = recordsOf(project);
  const weight = weightBalance(v, items, t, s, records);
  const extras = total(bill([], records).map((item) => item.plannedSum));
  weight.componentCostEur = weight.costEur;
  weight.costEur = total([weight.componentCostEur, extras]);
  const limits = [
    ['Frischwasser', water.freshDays],
    ['Grauwasserkapazität', water.greyDays],
    ['Batterieladung', electric.electricDays],
    ['Heizbrennstoff', heat.fuelDays],
    [
      'Heizleistung',
      heat.heatShortfall === null ? null : heat.heatShortfall ? 0 : Infinity,
    ],
    [
      'Warmwasserbereitung',
      heat.waterHeatShortfall === null
        ? null
        : heat.waterHeatShortfall
          ? 0
          : Infinity,
    ],
  ];
  const autonomy = limitDays(limits);
  return {
    ...weight,
    ...water,
    ...heat,
    ...electric,
    heaterMissing,
    boilerMissing,
    autonomyDays: electric.acPathMissing ? null : autonomy.days,
    limiter: electric.acPathMissing ? 'AC-Versorgung offen' : autonomy.name,
    knownBoundDays: autonomy.upper,
    limits,
    budgetLeft: diff(nonnegative(t.budget), weight.costEur),
  };
}

function hasBox(item) {
  return (
    [item.x, item.y, item.z ?? 0].every((v) => number(v) !== null) &&
    [item.length, item.width, item.height].every((v) => positive(v) !== null)
  );
}
function fits(box, v) {
  if (
    !hasBox(box) ||
    ![v.length, v.width, v.height].every((dim) => positive(dim) !== null)
  )
    return null;
  return (
    box.x >= 0 &&
    box.y >= 0 &&
    (box.z ?? 0) >= 0 &&
    box.x + box.length <= v.length &&
    box.y + box.width <= v.width &&
    (box.z ?? 0) + box.height <= v.height
  );
}
export function tankSpace(project, tank) {
  const v = project.vehicle || {},
    items = project.items || [];
  const inside = fits(tank, v);
  const overlaps = hasBox(tank)
    ? items
        .filter(
          (it) =>
            it.id !== tank.id &&
            !isOpening(it) &&
            !isRoof(it) &&
            hasBox(it) &&
            intersects(tank, it),
        )
        .map((it) => it.name)
    : [];
  return {
    inside,
    overlaps,
    path: extractionPath(tank, items),
    opening: tankFacts(tank),
  };
}

export function vehicleEnvelope(project, vehicle) {
  if (
    ![vehicle.length, vehicle.width, vehicle.height].every(
      (v) => positive(v) !== null,
    )
  )
    return null;
  const findings = layoutFindings({ ...project, vehicle }).filter((f) =>
    ['Höhe', 'Grenze'].includes(f.type),
  );
  return [...new Set(findings.flatMap((f) => f.ids))].map(
    (id) => project.items.find((it) => it.id === id)?.name || 'Bauteil',
  );
}

// The tank keeps its layout ID so links to hatches and pipes survive replacement.
export function withTankVariant(project, tank, archive = true) {
  const source = project.items.find((it) => it.id === tank.id);
  if (!source) return project;
  const next = {
    ...project,
    items: project.items.map((it) => (it.id === tank.id ? tank : it)),
  };
  const previous = project.records?.cards?.[tank.id];
  if (!previous || Number(source.capacity) === Number(tank.capacity))
    return next;
  const records = recordsOf(project),
    card = cardOf(source, records);
  const newCard = { ...card, status: 'Geplant' };
  if (archive) {
    const fields = [
      ['actualMass', 'Trockenmasse', 'kg'],
      ['actualLength', 'Länge', 'mm'],
      ['actualWidth', 'Breite', 'mm'],
      ['actualHeight', 'Höhe', 'mm'],
      ['actualCost', 'Kaufpreis', '€'],
    ];
    const values = fields
      .filter(([key]) => nonnegative(card[key]) !== null)
      .map(
        ([key, label, unit]) =>
          label + ' ' + Number(card[key]).toLocaleString('de-DE') + ' ' + unit,
      );
    const work =
      'Tankwechsel im Entwurf von ' +
      source.capacity +
      ' auf ' +
      tank.capacity +
      ' l. Vorheriger Stand ' +
      card.status +
      '.' +
      (values.length ? ' Frühere Ist-Werte: ' + values.join(', ') + '.' : '');
    const history = [
      ...(Array.isArray(card.history) ? card.history : []),
      {
        id: globalThis.crypto?.randomUUID?.() || 'variante-' + Date.now(),
        date: new Date().toLocaleDateString('sv-SE'),
        type: 'Variantenwechsel',
        work,
        partNumber: card.partNumber,
      },
    ];
    Object.assign(newCard, { history, verified: '', purchase: 'Geplant' });
    for (const [key] of fields) newCard[key] = '';
  }
  return {
    ...next,
    records: { ...records, cards: { ...records.cards, [tank.id]: newCard } },
  };
}

export function compareTanks(project, tankId, capacities = [100, 150]) {
  const candidates = (project.items || []).filter((it) => it.kind === 'fresh');
  const source = candidates.find((it) => it.id === tankId) || candidates[0];
  if (!source || !positive(source.capacity)) return [];
  const s = systemData(project),
    baseTrip = tripData(project);
  return capacities.map((capacity) => {
    const scale = capacity / source.capacity;
    const length = positive(source.length),
      mass = nonnegative(source.mass),
      cost = nonnegative(source.cost);
    const tank = {
      ...source,
      capacity,
      fill: 1,
      length: length === null ? null : Math.round(length * scale),
      mass: mass === null ? null : Math.round(mass * scale * 100) / 100,
      cost: cost === null ? null : Math.round(cost * scale * 100) / 100,
    };
    const trip = {
      ...baseTrip,
      season: 'Winter',
      outsideC: s.winterOutsideC,
      solarHours: s.winterSolarHours,
      driveHours: 0,
      shoreHours: 0,
    };
    const winterProject = { ...withTankVariant(project, tank, false), trip };
    return {
      capacity,
      tank,
      trip,
      result: calculate(winterProject),
      space: tankSpace(winterProject, tank),
    };
  });
}
