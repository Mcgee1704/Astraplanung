import { calculate, systemData, tripData } from './systems/model.js';
import { uid } from './project.js';

const known = (v) => typeof v === 'number' && Number.isFinite(v);
const nonnegative = (v) => (known(v) && v >= 0 ? v : null);
export function newStage(trip, index) {
  return {
    id: uid(),
    name: 'Etappe ' + (index + 1),
    days: index === 0 ? trip.days : 1,
    inherit: true,
    outsideC: trip.outsideC,
    solarHours: trip.solarHours,
    driveHours: trip.driveHours,
    shoreHours: trip.shoreHours,
    fresh: false,
    grey: false,
    battery: false,
    fuel: false,
  };
}
export function simulateStages(project, stages) {
  const s = systemData(project),
    t = tripData(project),
    base = calculate(project);
  const maximum = {
    fresh: base.freshL,
    grey: base.greyL,
    battery:
      known(base.batteryWh) && known(s.reserveCharge)
        ? Math.max(0, base.batteryWh * (1 - s.reserveCharge))
        : null,
    fuel: nonnegative(s.fuelAmount),
  };
  let remaining = {
    fresh: base.freshAvailableL,
    grey: base.greyAvailableL,
    battery: base.usableWh,
    fuel: maximum.fuel,
  };
  let elapsed = 0,
    stopped = false;
  return stages.map((stage) => {
    if (stopped) return { id: stage.id, status: 'wartet', elapsed };
    const trip = { ...t };
    if (!stage.inherit)
      for (const key of ['outsideC', 'solarHours', 'driveHours', 'shoreHours'])
        trip[key] = stage[key];
    const result = calculate({ ...project, trip });
    for (const key of Object.keys(maximum))
      if (stage[key]) remaining[key] = maximum[key];
    const daily = {
      fresh: result.waterDailyL,
      grey: result.greyDailyL,
      battery: result.balanceWh == null ? null : -result.balanceWh,
      fuel: result.fuelDaily,
    };
    const limits = Object.entries(daily).map(([key, rate]) => {
      if (!known(rate)) return [key, null];
      if (
        key === 'battery' &&
        result.consumptionWh > 0 &&
        result.batteryWh === 0
      )
        return [key, 0];
      if (rate <= 0) return [key, Infinity];
      return [key, known(remaining[key]) ? remaining[key] / rate : null];
    });
    limits.push(
      [
        'heat',
        result.heatShortfall == null
          ? null
          : result.heatShortfall
            ? 0
            : Infinity,
      ],
      [
        'warmWater',
        result.waterHeatShortfall == null
          ? null
          : result.waterHeatShortfall
            ? 0
            : Infinity,
      ],
    );
    if (result.acPathMissing) limits.push(['ac', null]);
    const duration = nonnegative(stage.days);
    if (!duration || limits.some(([, n]) => n === null)) {
      stopped = true;
      return {
        id: stage.id,
        status: 'offen',
        elapsed,
        limiting: limits.filter(([, n]) => n === null).map(([k]) => k),
      };
    }
    const limit = Math.min(...limits.map(([, n]) => n));
    const covered = Math.min(limit, duration);
    const start = { ...remaining };
    remaining = Object.fromEntries(
      Object.entries(daily).map(([key, rate]) => [
        key,
        known(remaining[key]) && known(maximum[key])
          ? Math.max(0, Math.min(maximum[key], remaining[key] - rate * covered))
          : null,
      ]),
    );
    elapsed += covered;
    stopped = limit < duration - 1e-8;
    return {
      id: stage.id,
      status: stopped ? 'engpass' : 'erreicht',
      covered,
      elapsed,
      start,
      end: { ...remaining },
      limiting: stopped
        ? limits.filter(([, n]) => Math.abs(n - limit) < 1e-6).map(([k]) => k)
        : [],
    };
  });
}
