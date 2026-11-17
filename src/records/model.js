import { openingFor } from '../layout/links.js';

export const purchaseStates = ['Geplant', 'Bestellt', 'Gekauft', 'Vorhanden'];
export const installStates = ['Geplant', 'Eingebaut', 'Geprüft'];
export const mediaOptions = ['Strom', 'Frischwasser', 'Abwasser', 'Heizung'];
export const joineryLabels = {
  box: 'Offener Plattenkorpus',
  top: 'Einzelne Deckplatte',
  sheet: 'Platte im Außenmaß',
  custom: 'Eigene Zuschnitte',
  bought: 'Zukaufteil',
};

export const number = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
const nonnegative = (value) => Math.max(0, number(value));
export const hasValue = (value) =>
  value !== null && value !== undefined && value !== '';
export const partsOf = (project) =>
  Array.isArray(project?.items) ? project.items : [];
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);

const baseSteps = [
  [
    'measure',
    'Aufmaß',
    'Innenmaße, Radkästen und Befestigungspunkte am Fahrzeug messen',
  ],
  [
    'layout',
    'Rohbau',
    'Möbelumrisse anzeichnen, Bewegungsflächen und Ausbauwege prüfen',
  ],
  [
    'shell',
    'Rohbau',
    'Fenster, Dämmung, Belüftung und Feuchteschutz abstimmen',
  ],
  [
    'routes',
    'Installation',
    'Leitungswege, Durchführungen und Wartungsöffnungen vor dem Schließen markieren',
  ],
  [
    'systems',
    'Installation',
    'Elektrik, Wasser und Heizung montieren und Einbauorte dokumentieren',
  ],
  [
    'checks',
    'Prüfung',
    'Dichtheit, Abschaltungen und Funktion prüfen und Nachweise erfassen',
  ],
  [
    'furniture',
    'Möbelbau',
    'Zuschnittmaße am Fahrzeug bestätigen, Möbel montieren und befestigen',
  ],
  [
    'handover',
    'Übergabe',
    'Reisefertig wiegen, Ist-Maße ergänzen und Bordakte offline übergeben',
  ],
];

const examplePump = {
  partNumber: 'MUSTER-P-01 (Beispiel)',
  fuse: 'F-P (Beispielkennung)',
  valve: 'V-P (Beispielkennung)',
};

export function makeRecords(items = []) {
  return {
    cards: Object.fromEntries(
      items.map((item) => [
        item.id,
        item.kind === 'pump' ? { ...examplePump } : {},
      ]),
    ),
    cuts: {},
    stencils: [],
    purchases: [],
    routeEdits: {},
    extraRoutes: [],
    hiddenRoutes: [],
    steps: baseSteps.map(([id, phase, title]) => ({
      id,
      phase,
      title,
      done: false,
    })),
  };
}

export function recordsOf(project) {
  const base = makeRecords();
  const data = project?.records ?? {};
  const result = {};
  for (const key of Object.keys(base)) {
    if (Array.isArray(base[key]))
      result[key] = Array.isArray(data[key]) ? data[key] : base[key];
    else
      result[key] =
        data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])
          ? data[key]
          : base[key];
  }
  return result;
}

export function cardOf(item, records) {
  const card = {
    status: installStates[0],
    purchase: purchaseStates[0],
    make: '',
    product: '',
    partNumber: '',
    serial: '',
    place: '',
    access: '',
    fuse: '',
    valve: '',
    maintenance: '',
    serviceDate: '',
    nextDate: '',
    verified: '',
    note: '',
    photo: '',
    history: [],
    actualLength: '',
    actualWidth: '',
    actualHeight: '',
    actualMass: '',
    actualCost: '',
  };
  if (item?.kind === 'pump') Object.assign(card, examplePump);
  return { ...card, ...records.cards?.[item.id] };
}

export function defaultJoinery(kind) {
  if (
    [
      'cabinet',
      'overhead',
      'kitchen',
      'bench',
      'wardrobe',
      'drawer',
      'cupboard',
      'shelf',
    ].includes(kind)
  )
    return 'box';
  if (['table', 'bed', 'worktop'].includes(kind)) return 'top';
  if (['wall', 'floor', 'insulation'].includes(kind)) return 'sheet';
  return 'bought';
}

// Layout stores the occupied vehicle axes. Fabrication dimensions follow the component itself.
export function fabricationDimensions(item) {
  const quarterTurn = Math.abs(number(item.rotation)) % 180 === 90;
  return {
    length: quarterTurn ? item.width : item.length,
    width: quarterTurn ? item.length : item.width,
    height: item.height,
    mass: item.mass,
  };
}

export function cutPlan(item, records) {
  const config = records.cuts?.[item.id] ?? {};
  const method = Object.hasOwn(joineryLabels, config.method)
    ? config.method
    : defaultJoinery(item.kind);
  const size = fabricationDimensions(item);
  const length = nonnegative(size.length);
  const width = nonnegative(size.width);
  const height = nonnegative(size.height);
  const sorted = [length, width, height].sort((a, b) => b - a);
  const thickness = nonnegative(
    config.thickness ?? (method === 'sheet' ? sorted[2] : 15),
  );
  const back = nonnegative(config.back ?? 4);
  const material =
    config.material ||
    (typeof item.material === 'string' ? item.material : '') ||
    'Plattenmaterial';
  const base = [];
  let issue = '';
  function add(id, name, qty, a, b, t) {
    base.push({
      id,
      name,
      qty,
      length: a,
      width: b,
      thickness: t,
      material,
      custom: false,
    });
  }
  if (method === 'box') {
    if (
      thickness <= 0 ||
      length <= 2 * thickness ||
      width <= back ||
      height <= 2 * thickness
    ) {
      issue = 'Außenmaße und Plattenstärken ergeben keinen baubaren Korpus.';
    } else {
      add('sides', 'Seiten', 2, height, width - back, thickness);
      add(
        'horizontals',
        'Boden und Deckel',
        2,
        length - 2 * thickness,
        width - back,
        thickness,
      );
      if (back > 0) add('back', 'Rückwand', 1, length, height, back);
    }
  } else if (method === 'top') {
    if (length > 0 && width > 0 && thickness > 0)
      add(
        'top',
        item.kind === 'bed' ? 'Liegeplatte' : 'Deckplatte',
        1,
        length,
        width,
        thickness,
      );
    else issue = 'Länge, Breite und Plattenstärke müssen größer als null sein.';
  } else if (method === 'sheet') {
    if (sorted[1] > 0 && thickness > 0)
      add('sheet', item.name, 1, sorted[0], sorted[1], thickness);
    else issue = 'Außenmaße und Stärke am Fahrzeug erfassen.';
  }
  const rows =
    method === 'bought'
      ? []
      : [
          ...base
            .filter((row) => !config.hidden?.includes(row.id))
            .map((row) => ({
              ...row,
              ...(config.overrides?.[row.id] ?? {}),
              changed: Boolean(config.overrides?.[row.id]),
            })),
          ...(Array.isArray(config.extra)
            ? config.extra.map((row) => ({ ...row, custom: true }))
            : []),
        ];
  return { method, thickness, back, material, rows, issue, config };
}

export const validCut = (row) =>
  [row.qty, row.length, row.width, row.thickness].every(
    (v) => hasValue(v) && Number.isFinite(Number(v)) && Number(v) > 0,
  ) && Number.isInteger(Number(row.qty));

export function allCuts(items, records) {
  return items.flatMap((item) =>
    cutPlan(item, records).rows.map((row) => ({
      ...row,
      itemId: item.id,
      itemName: item.name,
    })),
  );
}

export function specification(item, items = []) {
  const f = (value) => number(value).toLocaleString('de-DE');
  if (['fresh', 'grey'].includes(item.kind)) {
    const opening = openingFor(item, items);
    return (
      (hasValue(item.capacity)
        ? f(item.capacity) + ' l Nenninhalt'
        : 'Nenninhalt offen') +
      (opening?.width > 0 && opening?.height > 0
        ? ' · Ausbauöffnung ' +
          f(opening.width) +
          ' × ' +
          f(opening.height) +
          ' mm'
        : ' · Ausbauöffnung offen')
    );
  }
  if (item.kind === 'battery' && hasValue(item.ah))
    return (
      f(item.ah) +
      ' Ah' +
      (hasValue(item.voltage) ? ' · ' + f(item.voltage) + ' V' : '')
    );
  if (item.kind === 'solar' && hasValue(item.watts))
    return f(item.watts) + ' Wp';
  return '';
}

export function priceValue(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim()))
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function bill(items, records) {
  const model = items.map((item) => {
    const card = cardOf(item, records);
    return {
      id: item.id,
      itemId: item.id,
      name: item.name,
      label: [specification(item, items), card.product]
        .filter(Boolean)
        .join(' · '),
      qty: 1,
      unit: 'Stk.',
      cost: priceValue(item.cost),
      paid: card.actualCost,
      state: card.purchase,
      included: false,
    };
  });
  const extra = records.purchases.map((line) => ({ ...line, itemId: null }));
  return [...model, ...extra].map((line) => {
    const planned = priceValue(line.cost),
      actual = priceValue(line.paid),
      qty = priceValue(line.qty);
    const amount = (unitPrice) =>
      line.included || qty === 0
        ? 0
        : unitPrice === null || qty === null
          ? null
          : qty * unitPrice;
    return {
      ...line,
      plannedSum: amount(planned),
      currentSum: amount(actual ?? planned),
    };
  });
}

export function summary(items, records) {
  const rows = bill(items, records);
  const cuts = allCuts(items, records);
  return {
    planned: rows.reduce((sum, line) => sum + (line.plannedSum ?? 0), 0),
    expected: rows.reduce((sum, line) => sum + (line.currentSum ?? 0), 0),
    openPlanned: rows.filter((line) => line.plannedSum === null).length,
    openExpected: rows.filter((line) => line.currentSum === null).length,
    purchased: rows.filter((line) =>
      ['Gekauft', 'Vorhanden'].includes(line.state),
    ).length,
    positions: rows.length,
    pieces: cuts
      .filter(validCut)
      .reduce((sum, row) => sum + number(row.qty), 0),
    panelArea: cuts
      .filter(validCut)
      .reduce((sum, row) => sum + (row.length * row.width * row.qty) / 1e6, 0),
  };
}

export const specialEnds = {
  '@air': 'Warmluftauslass',
  '@fuel': 'Brennstoffquelle',
  '@dc': 'DC-Verteilung',
  '@fresh': 'Frischwasseranschluss',
  '@drain': 'Abwasseranschluss',
  '@starter': 'Starterkreis',
  '@shore': 'Landanschluss',
  '@ac': 'Wechselstromverbraucher',
};

function generatedRoutes(items) {
  const ofKind = (kind) => items.filter((item) => item.kind === kind);
  const first = (kind) => ofKind(kind)[0];
  const routes = [];
  function add(medium, start, end, via) {
    if (start == null || end == null) return;
    const from = String(start.id ?? start),
      to = String(end.id ?? end);
    const id = [medium, from, to].map(encodeURIComponent).join('/');
    routes.push({
      id,
      medium,
      from,
      to,
      via,
      route: '',
      protection: '',
      spec: '',
      verified: false,
      automatic: true,
    });
  }
  const battery = first('battery');
  add('Strom', '@starter', battery, 'DC/DC-Ladewandler');
  add('Strom', '@shore', battery, 'Netzladegerät');
  add('Strom', battery, '@ac', 'Wechselrichter');
  add('Strom', battery, '@dc', 'Hauptverteilung');
  for (const pump of ofKind('pump')) {
    add('Frischwasser', first('fresh'), pump, '');
    add('Strom', first('battery'), pump, 'DC-Verteilung');
  }
  for (const tank of ofKind('fresh').slice(1))
    add(
      'Frischwasser',
      tank,
      first('pump'),
      'Tankwahl / Zusammenführung prüfen',
    );
  for (const boiler of ofKind('boiler'))
    add(
      'Frischwasser',
      first('pump') ?? first('fresh'),
      boiler,
      'Kaltwasserzulauf',
    );
  for (const fixture of items.filter((item) =>
    ['kitchen', 'bath', 'shower', 'sink'].includes(item.kind),
  )) {
    add(
      'Frischwasser',
      first('pump') ?? first('fresh'),
      fixture,
      first('pump') ? '' : 'Druckerzeugung klären',
    );
    add('Abwasser', fixture, first('grey'), '');
    add('Frischwasser', first('boiler'), fixture, 'Warmwasserabgang');
  }
  for (const heater of ofKind('heater')) {
    add('Strom', first('battery'), heater, 'DC-Verteilung');
    add('Heizung', heater, '@air', 'Wärmeverteilung prüfen');
  }
  for (const panel of ofKind('solar'))
    add(
      'Strom',
      panel,
      first('battery'),
      first('controller')?.name || 'Laderegler',
    );
  for (const appliance of items.filter((item) =>
    ['fridge', 'light', 'fan', 'vent', 'inverter'].includes(item.kind),
  )) {
    add(
      'Strom',
      first('battery'),
      appliance,
      first('fusebox')?.name || 'DC-Verteilung',
    );
  }
  return routes;
}

export function routesOf(items, records) {
  const known = new Set([
    ...items.map((item) => String(item.id)),
    ...Object.keys(specialEnds),
  ]);
  return [
    ...generatedRoutes(items)
      .filter((route) => !records.hiddenRoutes.includes(route.id))
      .map((route) => ({ ...route, ...records.routeEdits[route.id] })),
    ...records.extraRoutes,
  ].map((route) => ({
    ...route,
    verified: Boolean(route.verified && canVerifyRoute(route, items)),
    missing: !known.has(String(route.from)) || !known.has(String(route.to)),
  }));
}

export function canVerifyRoute(route, items) {
  if (!route || String(route.from) === String(route.to)) return false;
  const known = new Set([
    ...items.map((item) => String(item.id)),
    ...Object.keys(specialEnds),
  ]);
  if (!known.has(String(route.from)) || !known.has(String(route.to)))
    return false;
  const isCoordinate = (value) =>
    (typeof value === 'number' ||
      (typeof value === 'string' && value.trim() !== '')) &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0;
  const validPoint = (point) => point && [point.x, point.y].every(isCoordinate);
  return (
    Boolean(typeof route.route === 'string' && route.route.trim()) ||
    (Array.isArray(route.points) && route.points.some(validPoint))
  );
}

export function editRoute(records, route, patch, items) {
  const isCheck = Object.keys(patch).every((key) => key === 'verified');
  const changes = {
    ...patch,
    verified:
      isCheck && Boolean(patch.verified) && canVerifyRoute(route, items),
  };
  if (route.automatic) {
    return {
      ...records,
      routeEdits: {
        ...records.routeEdits,
        [route.id]: { ...records.routeEdits[route.id], ...changes },
      },
    };
  }
  return {
    ...records,
    extraRoutes: records.extraRoutes.map((row) =>
      row.id === route.id ? { ...row, ...changes } : row,
    ),
  };
}

export function endName(value, items) {
  return (
    items.find((item) => String(item.id) === String(value))?.name ??
    specialEnds[value] ??
    'Bauteil entfernt'
  );
}

export function cardSearch(item, records, items = []) {
  const card = cardOf(item, records);
  const log = Array.isArray(card.history)
    ? card.history.flatMap((entry) => [
        entry.date,
        entry.type,
        entry.work,
        entry.partNumber,
      ])
    : [];
  return [
    item.name,
    item.material,
    specification(item, items),
    ...log,
    ...Object.entries(card)
      .filter(([key]) => key !== 'photo' && key !== 'history')
      .map(([, value]) => value),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('de-DE');
}
