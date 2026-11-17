// Record each wheel actually weighed. A single tyre and a pair of twins have separate slots.
export function makeWheelWeighing() {
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

const record = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const real = (value) => typeof value === 'number' && Number.isFinite(value);
const kg = (value) => real(value) && value >= 0;
const wheelKey = /^([a-zA-Z0-9_-]+)\.(left|right)\.(single|inner|outer)$/;
function validDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + 'T00:00:00Z');
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function validWheelWeighing(value) {
  if (
    !record(value) ||
    typeof value.useBaseline !== 'boolean' ||
    !Array.isArray(value.axles) ||
    value.axles.length < 2
  )
    return false;
  if (value.axles[0]?.id !== 'front' || value.axles[1]?.id !== 'rear')
    return false;
  const ids = new Set();
  for (const axle of value.axles) {
    if (
      !record(axle) ||
      typeof axle.id !== 'string' ||
      !/^[a-zA-Z0-9_-]+$/.test(axle.id) ||
      ids.has(axle.id) ||
      typeof axle.name !== 'string' ||
      typeof axle.dual !== 'boolean'
    )
      return false;
    ids.add(axle.id);
  }
  for (const group of [value.travel, value.baseline]) {
    if (
      !record(group) ||
      !record(group.values) ||
      !validDate(group.date) ||
      typeof group.note !== 'string'
    )
      return false;
    for (const [key, reading] of Object.entries(group.values)) {
      const match = wheelKey.exec(key);
      if (!match || !ids.has(match[1]) || (reading !== null && !kg(reading)))
        return false;
    }
  }
  if (!Array.isArray(value.baseline.included)) return false;
  const included = new Set();
  for (const entry of value.baseline.included) {
    if (
      !record(entry) ||
      typeof entry.id !== 'string' ||
      !entry.id ||
      included.has(entry.id) ||
      typeof entry.name !== 'string' ||
      (entry.kg !== null && !kg(entry.kg)) ||
      (entry.x !== null && !real(entry.x))
    )
      return false;
    included.add(entry.id);
  }
  return true;
}

const inputNumber = new Intl.NumberFormat('de-DE', {
  useGrouping: false,
  maximumSignificantDigits: 17,
});
export function wheelInputText(value) {
  return value == null ? '' : inputNumber.format(value);
}
export function parseWeighNumber(raw, signed = false) {
  let text = String(raw ?? '').trim();
  if (!text) return { valid: true, value: null };
  const sign = signed && text.startsWith('-') ? -1 : 1;
  if (sign === -1) text = text.slice(1);
  if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(text)) text = text.replaceAll('.', '');
  if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text))
    return { valid: false, value: null };
  const value = Number(text.replace(',', '.')) * sign;
  return Number.isFinite(value)
    ? { valid: true, value }
    : { valid: false, value: null };
}
export function wheelKeys(axle, side) {
  return (axle.dual ? ['inner', 'outer'] : ['single']).map(
    (wheel) => axle.id + '.' + side + '.' + wheel,
  );
}
export function wheelTotals(weighing, mode) {
  const values = weighing[mode].values;
  const sum = (parts) =>
    parts.every(kg) ? parts.reduce((a, b) => a + b, 0) : null;
  let measured = 0;
  let required = 0;
  const axles = weighing.axles.map((axle) => {
    const sideKg = (side) => {
      const readings = wheelKeys(axle, side).map((key) => values[key]);
      required += readings.length;
      measured += readings.filter(kg).length;
      return sum(readings);
    };
    const leftKg = sideKg('left'),
      rightKg = sideKg('right');
    return {
      id: axle.id,
      name: axle.name,
      leftKg,
      rightKg,
      totalKg: sum([leftKg, rightKg]),
    };
  });
  const leftKg = sum(axles.map((a) => a.leftKg)),
    rightKg = sum(axles.map((a) => a.rightKg));
  return {
    axles,
    measured,
    required,
    leftKg,
    rightKg,
    totalKg: sum([leftKg, rightKg]),
  };
}

export function discardWheelAxle(weighing, id) {
  if (['front', 'rear'].includes(id)) return weighing;
  const keep = (series) => ({
    ...series,
    values: Object.fromEntries(
      Object.entries(series.values).filter(
        ([key]) => !key.startsWith(id + '.'),
      ),
    ),
  });
  return {
    ...weighing,
    axles: weighing.axles.filter((a) => a.id !== id),
    travel: keep(weighing.travel),
    baseline: keep(weighing.baseline),
  };
}
