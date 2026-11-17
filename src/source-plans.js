// Dimensions are free planning assumptions in millimetres, mass is the dry mass.
// Each concept has two independently furnished side walls, a sleeping area and a service bay.
const concepts = [
  {
    id: 'tour-kuestenpause',
    name: 'Küstenpause',
    vehicleKind: 'Kastenwagen',
    reference: [4050, 1870, 1980],
    description:
      'Querschläfer mit Trockenfach für Neopren und kurzem Weg vom Einstieg zur Sitzbank.',
    sleep: 'cross',
    depth: 1370,
    fresh: 80,
    left: ['cook', 'kit'],
    right: ['entry', 'dinette'],
    feature: ['cabinet', 'Trockenschrank für Neopren', 1470],
  },
  {
    id: 'tour-radgarage',
    name: 'Radgarage',
    vehicleKind: 'Kofferaufbau',
    reference: [4780, 2080, 2200],
    description:
      'Ein hohes Heckbett schafft eine Radgarage. Werkbank und Werkzeugfach liegen auf derselben Seite.',
    sleep: 'loft',
    depth: 1560,
    fresh: 90,
    left: ['cook', 'wet'],
    right: ['entry', 'kit', 'seat'],
    feature: ['table', 'Werkbank für Radservice', 44],
    garage: 'Radgarage',
    kitZ: 850,
  },
  {
    id: 'tour-familienkojen',
    name: 'Familienkojen',
    vehicleKind: 'Kofferaufbau',
    reference: [5240, 2180, 2280],
    description:
      'Zwei übereinanderliegende Kojen stehen einem dritten Längsbett gegenüber. Vorn gibt es einen eigenen Esstisch.',
    sleep: 'bunks',
    depth: 1920,
    fresh: 115,
    left: ['wet', 'cook', 'kit'],
    right: ['entry', 'dinette'],
    feature: ['cabinet', 'Wäschefächer für drei', 1350],
  },
  {
    id: 'tour-waldsolo',
    name: 'Solo im Wald',
    vehicleKind: 'Kastenwagen',
    reference: [3300, 1790, 1900],
    description:
      'Ein schmales Einzelbett lässt neben dem Fußende Platz für den Rucksack und eine Sitzkiste.',
    sleep: 'single',
    depth: 1870,
    fresh: 52,
    left: ['cook', 'seat'],
    right: ['entry', 'kit'],
    feature: ['cabinet', 'Vorratsfach', 810],
    opposite: 'Gepäckbank',
  },
  {
    id: 'tour-mobiles-buero',
    name: 'Mobiles Büro',
    vehicleKind: 'Kastenwagen',
    reference: [4620, 1940, 2090],
    description:
      'Die Arbeitsplatte liegt längs am Fenster. Das Bett bleibt während des Arbeitens aufgebaut.',
    sleep: 'single',
    depth: 1960,
    fresh: 75,
    left: ['cook', 'locker'],
    right: ['entry', 'desk', 'kit'],
    feature: ['cabinet', 'Akten- und Druckerfach', 870],
    opposite: 'Lesebank',
  },
  {
    id: 'tour-winterlager',
    name: 'Winterlager',
    vehicleKind: 'Kofferaufbau',
    reference: [4920, 2120, 2190],
    description:
      'Zwischen Eingang und Schlafplatz liegen eine Sitzbank zum Umziehen und ein Schrank für nasse Kleidung.',
    sleep: 'cross',
    depth: 1510,
    fresh: 120,
    left: ['wet', 'cook', 'pantry'],
    right: ['entry', 'seat', 'kit'],
    feature: ['cabinet', 'Trockenfach für Winterkleidung', 1670],
  },
  {
    id: 'tour-hundeplatz',
    name: 'Unterwegs mit Hund',
    vehicleKind: 'Kastenwagen',
    reference: [4300, 1890, 2040],
    description:
      'Die Hundebox steht neben dem Einstieg. Ein freier Mittelgang verbindet sie mit der Küche.',
    sleep: 'cross',
    depth: 1420,
    fresh: 78,
    left: ['cook', 'dinette'],
    right: ['entry', 'kit', 'locker'],
    feature: ['custom', 'Hundebox mit Seitentür', 675],
  },
  {
    id: 'tour-kartentisch',
    name: 'Am Kartentisch',
    vehicleKind: 'Kofferaufbau',
    reference: [4680, 2100, 2160],
    description:
      'Ein vorderes Querbett lässt im Heck Platz für einen Kartentisch und flache Schubfächer.',
    sleep: 'front',
    depth: 1410,
    fresh: 94,
    left: ['cook', 'seat', 'kit'],
    right: ['entry', 'desk'],
    feature: ['cabinet', 'Flachfächer für Karten', 630],
  },
  {
    id: 'tour-freie-gasse',
    name: 'Freie Mittelgasse',
    vehicleKind: 'Kofferaufbau',
    reference: [4860, 2200, 2110],
    description:
      'Ein Einzelbett, eine Umsetzbank und flache Seitenmöbel halten die Bewegungsfläche in der Mitte frei.',
    sleep: 'single',
    depth: 2020,
    fresh: 90,
    left: ['cook', 'kit'],
    right: ['entry', 'seat'],
    feature: ['cabinet', 'Flacher Wandschrank', 890],
    opposite: 'Umsetzbank',
    shallow: true,
  },
  {
    id: 'tour-musikreise',
    name: 'Mit Instrumenten reisen',
    vehicleKind: 'Kastenwagen',
    reference: [4470, 1910, 2010],
    description:
      'Ein bodennahes Fach für Instrumentenkoffer liegt neben der Küche. Die gegenüberliegende Sitzbank bleibt frei.',
    sleep: 'singleRight',
    depth: 1890,
    fresh: 68,
    left: ['entry', 'dinette'],
    right: ['cook', 'kit'],
    feature: ['custom', 'Fach für Instrumentenkoffer', 760],
    opposite: 'Ablage für Verstärker',
  },
  {
    id: 'tour-reisekueche',
    name: 'Reiseküche',
    vehicleKind: 'Kofferaufbau',
    reference: [5010, 2150, 2150],
    description:
      'Küchenzeile, zusätzliche Arbeitsplatte und Vorratsschrank bilden eine durchgehende Arbeitsseite.',
    sleep: 'cross',
    depth: 1450,
    fresh: 128,
    left: ['cook', 'prep', 'kit'],
    right: ['wet', 'entry', 'dinette'],
    feature: ['cabinet', 'Auszug für Kochvorräte', 910],
  },
  {
    id: 'tour-paddelbasis',
    name: 'Paddelbasis',
    vehicleKind: 'Kastenwagen',
    reference: [4580, 1930, 2120],
    description:
      'Unter dem erhöhten Bett reisen Packboote. Ein Staunetz und die Nasszelle nehmen die Ausrüstung nach dem Anlanden auf.',
    sleep: 'loft',
    depth: 1480,
    fresh: 86,
    left: ['wet', 'kit', 'cook'],
    right: ['entry', 'seat', 'locker'],
    feature: ['custom', 'Fach für Schwimmwesten', 580],
    garage: 'Stauraum für Packboote',
  },
  {
    id: 'tour-mobile-werkstatt',
    name: 'Mobile Werkstatt',
    vehicleKind: 'Kofferaufbau',
    reference: [5080, 2130, 2240],
    description:
      'Mit dem Bett an der Stirnwand bleibt die hintere Kabine für Werkbank und Werkzeugauszüge verfügbar.',
    sleep: 'front',
    depth: 1450,
    fresh: 72,
    left: ['cook', 'locker', 'desk'],
    right: ['seat', 'entry', 'kit'],
    feature: ['cabinet', 'Werkzeugauszüge', 830],
  },
  {
    id: 'tour-zwei-einzelbetten',
    name: 'Zwei Einzelbetten',
    vehicleKind: 'Kofferaufbau',
    reference: [4970, 2140, 2080],
    description:
      'Die beiden Längsbetten haben getrennte Einstiege. Der Mittelgang reicht bis an die Heckwand.',
    sleep: 'twin',
    depth: 1960,
    fresh: 92,
    left: ['cook', 'wet'],
    right: ['entry', 'dinette', 'kit'],
    feature: ['cabinet', 'Schmales Wäschefach', 1210],
  },
  {
    id: 'tour-stadtmobil',
    name: 'Stadtmobil',
    vehicleKind: 'Kastenwagen',
    reference: [3190, 1760, 1860],
    description:
      'Das Tagesbett teilt sich den kurzen Innenraum mit einer kompakten Küche und einem niedrigen Schuhfach.',
    sleep: 'singleRight',
    depth: 1830,
    fresh: 40,
    left: ['entry', 'kit'],
    right: ['cook', 'seat'],
    feature: ['cabinet', 'Schuhfach am Einstieg', 360],
    opposite: 'Gepäckablage',
  },
  {
    id: 'tour-beobachtung',
    name: 'Beobachtungsplatz',
    vehicleKind: 'Kastenwagen',
    reference: [4550, 1920, 2070],
    description:
      'Hinter dem vorderen Bett stehen ein Beobachtungstisch und ein gepolstertes Fach für Optik.',
    sleep: 'front',
    depth: 1350,
    fresh: 73,
    left: ['entry', 'desk', 'kit'],
    right: ['cook', 'dinette'],
    feature: ['cabinet', 'Gepolstertes Optikfach', 940],
  },
  {
    id: 'tour-lange-etappen',
    name: 'Lange Etappen',
    vehicleKind: 'Kofferaufbau',
    reference: [5350, 2210, 2290],
    description:
      'Ein großer Frischwassertank und zusätzliche Vorratsauszüge sind für lange Abschnitte zwischen Versorgungsorten eingeplant.',
    sleep: 'loft',
    depth: 1620,
    fresh: 155,
    left: ['wet', 'cook', 'kit'],
    right: ['entry', 'dinette', 'pantry'],
    feature: ['cabinet', 'Vorratsauszüge', 1420],
    garage: 'Ersatzteilstauraum',
  },
  {
    id: 'tour-kletterbus',
    name: 'Kletterbus',
    vehicleKind: 'Kofferaufbau',
    reference: [5190, 2160, 2250],
    description:
      'Drei Kojen, ein Seilfach und eine Sitzbank am Eingang trennen Schlafplätze und Ausrüstung.',
    sleep: 'bunks',
    depth: 1940,
    fresh: 102,
    left: ['entry', 'seat', 'kit'],
    right: ['cook', 'dinette', 'wet'],
    feature: ['custom', 'Belüftetes Seilfach', 870],
  },
];

export const sourceVariants = concepts.map(
  ({ id, name, description, reference, vehicleKind }) => ({
    id,
    name,
    description,
    reference,
    vehicleKind,
    group: 'Reiselayouts',
    source: 'Parametrischer Reiseentwurf',
  }),
);

const bayWeights = {
  entry: 1.1,
  cook: 1.85,
  dinette: 1.85,
  seat: 1.2,
  kit: 1.1,
  wet: 1.25,
  locker: 0.85,
  pantry: 0.75,
  desk: 1.8,
  prep: 1.25,
};
const mm = Math.round;
const positive = (value, fallback) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

function furnishSide(plan, side, start, end, width, height, build) {
  const bays = plan[side];
  const weight = bays.reduce((total, key) => total + bayWeights[key], 0);
  const right = side === 'right';
  let cursor = 0;
  for (const key of bays) {
    const x = start + mm(((end - start) * cursor) / weight) + 8;
    cursor += bayWeights[key];
    const length = Math.max(
      1,
      start + mm(((end - start) * cursor) / weight) - x - 8,
    );
    const add = (kind, name, depth, extra = {}) => {
      const w = Math.max(1, Math.min(Math.round(depth), width));
      return build(kind, {
        name,
        x,
        y: right ? width - w : 0,
        length,
        width: w,
        ...extra,
      });
    };
    if (key === 'entry') {
      add('door', 'Seiteneinstieg', 26, {
        side,
        height: Math.min(height, 1860),
        clearance: Math.min(580, mm(width * 0.32)),
      });
    } else if (key === 'cook') {
      add(
        'kitchen',
        'Küchenzeile',
        Math.min(580, width * (plan.shallow ? 0.24 : 0.3)),
        { height: 900 },
      );
    } else if (key === 'dinette' || key === 'seat') {
      const seatDepth = Math.min(510, mm(width * 0.245));
      add('bench', 'Sitzbank', seatDepth);
      if (key === 'dinette') {
        const topWidth = Math.min(390, mm(width * 0.16));
        build('table', {
          name: 'Esstisch',
          x: x + mm(length * 0.12),
          y: right ? width - seatDepth - topWidth - 10 : seatDepth + 10,
          length: Math.max(1, mm(length * 0.76)),
          width: topWidth,
          z: 715,
        });
      }
    } else if (key === 'wet') {
      add('bath', 'Nasszelle', Math.min(830, width * 0.38), {
        height: Math.min(height, 1840),
      });
    } else if (key === 'desk' || key === 'prep') {
      add(
        'table',
        key === 'desk' ? 'Arbeitsplatz' : 'Vorbereitungsfläche',
        Math.min(575, width * 0.29),
        { z: key === 'desk' ? 735 : 870 },
      );
    } else if (key === 'kit') {
      const [kind, name, h] = plan.feature;
      add(kind, name, Math.min(520, width * (plan.shallow ? 0.16 : 0.255)), {
        height: Math.min(h, height),
        z: plan.kitZ || 0,
      });
    } else {
      add(
        'cabinet',
        key === 'pantry' ? 'Vorratsschrank' : 'Kleiderschrank',
        Math.min(500, width * 0.25),
        { height: Math.min(1520, height) },
      );
    }
  }
}

function furnishSleepingArea(plan, start, length, width, height, build) {
  const transverse = ['cross', 'front', 'loft'].includes(plan.sleep);
  const stacked = plan.sleep === 'bunks';
  const twin = stacked || plan.sleep === 'twin';
  const bedWidth = transverse ? width : mm(width * (twin ? 0.36 : 0.495));
  const bedY = plan.sleep === 'singleRight' ? width - bedWidth : 0;
  const z = plan.sleep === 'loft' ? 1100 : stacked ? 625 : 740;
  const berth = { x: start, y: bedY, z, length, width: bedWidth, height: 155 };
  build('bed', {
    ...berth,
    name: transverse ? 'Querbett' : stacked ? 'Untere Koje' : 'Längsbett',
  });
  if (stacked)
    build('bed', {
      ...berth,
      name: 'Obere Koje',
      z: Math.min(height - 230, 1430),
    });
  if (twin)
    build('bed', { ...berth, name: 'Zweites Längsbett', y: width - bedWidth });
  if (plan.opposite) {
    const w = mm(width * (plan.shallow ? 0.16 : 0.23));
    build('bench', {
      name: plan.opposite,
      x: start + mm(length * 0.12),
      y: bedY === 0 ? width - w : 0,
      length: mm(length * 0.72),
      width: w,
      height: 480,
    });
  }
  const serviceWidth = transverse ? mm(width * 0.48) : bedWidth;
  if (plan.garage) {
    const y = serviceWidth + 25;
    build('custom', {
      name: plan.garage,
      x: start + 18,
      y,
      z: 0,
      length: Math.max(1, length - 36),
      width: Math.max(1, width - y - 18),
      height: z - 50,
      material: 'Sperrholz / Zurrschiene',
      mass: 17,
      cost: 155,
    });
  }
  return { x: start, y: bedY, length, width: serviceWidth };
}

function furnishServiceBay(plan, bay, build) {
  // Tanks are custom-size envelopes. Each nominal volume leaves ten percent for walls and fittings.
  const span = Math.max(1, mm(bay.length * 0.48) - 28);
  const tankWidth = Math.max(1, bay.width - 290);
  for (const [kind, factor, offset] of [
    ['fresh', 1, 0],
    ['grey', 0.72, 0.5],
  ]) {
    const capacity = mm(plan.fresh * factor);
    const height = Math.max(
      1,
      Math.ceil((capacity * 1.1e6) / (span * tankWidth)),
    );
    build(kind, {
      x: bay.x + mm(bay.length * offset) + 12,
      y: bay.y + 18,
      length: span,
      width: tankWidth,
      height,
      capacity,
      serviceWidth: Math.min(span, tankWidth) + 50,
      serviceHeight: height + 45,
    });
  }
  const y = bay.y + bay.width - 250;
  const x = bay.x + 16;
  const far = bay.x + mm(bay.length * 0.5) + 12;
  build('battery', { x, y });
  build('heater', { x: far, y });
  build('pump', { x, y, z: 260 });
  build('inverter', { x: far, y, z: 245 });
}

export function makeSourceItems(id, vehicle = {}, makeItem) {
  const plan = concepts.find((p) => p.id === id);
  if (!plan) return [];
  const [refL, refW, refH] = plan.reference;
  const length = positive(vehicle.length, refL),
    width = positive(vehicle.width, refW),
    height = positive(vehicle.height, refH);
  // Preserve the sleeping length while the available living area changes with the actual cabin.
  const bedLength = Math.max(1, Math.min(plan.depth, Math.round(length)));
  const front = plan.sleep === 'front';
  const items = [];
  const build = (kind, options) => items.push(makeItem(kind, options));
  const sleeping = furnishSleepingArea(
    plan,
    front ? 0 : length - bedLength,
    bedLength,
    width,
    height,
    build,
  );
  for (const side of ['left', 'right'])
    furnishSide(
      plan,
      side,
      front ? bedLength : 0,
      front ? length : length - bedLength,
      width,
      height,
      build,
    );
  furnishServiceBay(plan, sleeping, build);
  build('solar', {
    x: mm(length * 0.08),
    y: mm((width - 1020) * 0.5),
    z: height,
  });
  build('vent', { x: mm(length * 0.8), y: mm((width - 455) * 0.5), z: height });
  return items;
}
