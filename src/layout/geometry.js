import { catalog } from './templates.js';

export const isTank = (item) => ['fresh', 'grey'].includes(item.kind);
export const isOpening = (item) =>
  ['door', 'window', 'hatch', 'inlet'].includes(item.kind);
export const isRoof = (item) =>
  item.mount === 'roof' || ['solar', 'roofvent'].includes(item.kind);
export const groupOf = (item) => catalog[item.kind]?.group || 'Eigene Bauteile';
export const formatMM = (value) =>
  Math.round(Number(value) || 0).toLocaleString('de-DE');
export const dimensions = (item) =>
  [item.length, item.width, item.height].map(formatMM).join(' × ');

export function envelope(vehicle = {}) {
  return {
    length: Math.max(1, Number(vehicle.length) || 4200),
    width: Math.max(1, Number(vehicle.width) || 1900),
    height: Math.max(1, Number(vehicle.height) || 2100),
  };
}

export function isVisible(item, layer) {
  if (layer === 'roof') return isRoof(item);
  if (layer === 'all') return true;
  if (isRoof(item)) return false;
  if (layer === 'systems') return groupOf(item) === 'Bordtechnik';
  if (layer === 'living') return groupOf(item) !== 'Bordtechnik';
  return true;
}

const overlap = (a, sizeA, b, sizeB) => a < b + sizeB && a + sizeA > b;
export const intersects = (a, b) =>
  overlap(a.x, a.length, b.x, b.length) &&
  overlap(a.y, a.width, b.y, b.width) &&
  overlap(a.z, a.height, b.z, b.height);

export function fitsInside(child, parent) {
  return (
    child.x >= parent.x &&
    child.y >= parent.y &&
    child.z >= parent.z &&
    child.x + child.length <= parent.x + parent.length &&
    child.y + child.width <= parent.y + parent.width &&
    child.z + child.height <= parent.z + parent.height
  );
}

export function availableParents(child, items) {
  const ids = new Map(items.map((item) => [item.id, item]));
  return items.filter((candidate) => {
    if (isOpening(candidate) || isRoof(candidate) !== isRoof(child))
      return false;
    const visited = new Set([child.id]);
    let parent = candidate;
    while (parent) {
      if (visited.has(parent.id)) return false;
      visited.add(parent.id);
      parent = ids.get(parent.parentId);
    }
    return true;
  });
}

export function transformContents(before, after, items) {
  const dx = after.x - before.x,
    dy = after.y - before.y,
    dz = after.z - before.z;
  const quarterTurn =
    ((after.rotation || 0) - (before.rotation || 0) + 360) % 360 === 90;
  if (!dx && !dy && !dz && !quarterTurn) return items;
  const descendants = new Set(),
    queue = [before.id];
  const children = new Map();
  for (const item of items) {
    if (!item.parentId) continue;
    if (!children.has(item.parentId)) children.set(item.parentId, []);
    children.get(item.parentId).push(item.id);
  }
  while (queue.length)
    for (const id of children.get(queue.pop()) || []) {
      if (id !== before.id && !descendants.has(id)) {
        descendants.add(id);
        queue.push(id);
      }
    }
  return items.map((item) => {
    if (!descendants.has(item.id)) return item;
    if (!quarterTurn)
      return { ...item, x: item.x + dx, y: item.y + dy, z: item.z + dz };
    return {
      ...item,
      x: after.x + before.width - (item.y - before.y) - item.width,
      y: after.y + item.x - before.x,
      z: item.z + dz,
      length: item.width,
      width: item.length,
      rotation: ((item.rotation || 0) + 90) % 360,
    };
  });
}

export function alignOpening(item, vehicle) {
  const area = envelope(vehicle);
  if (item.side === 'left') return { ...item, y: 0 };
  if (item.side === 'front') return { ...item, x: 0 };
  if (item.side === 'rear') return { ...item, x: area.length - item.length };
  return { ...item, y: area.width - item.width };
}

function doorZone(item) {
  const depth = Math.max(0, Number(item.clearance) || 0);
  if (item.side === 'front') return { ...item, length: depth + item.length };
  if (item.side === 'rear')
    return { ...item, x: item.x - depth, length: depth + item.length };
  if (item.side === 'left') return { ...item, width: depth + item.width };
  return { ...item, y: item.y - depth, width: depth + item.width };
}

export function tankFacts(item) {
  const grossVolume = (item.length * item.width * item.height) / 1e6;
  const openingKnown = item.serviceWidth > 0 && item.serviceHeight > 0;
  // Upright end-on extraction with a straight path. This tests the aperture alone.
  const fitsOpening = openingKnown
    ? Math.min(item.length, item.width) <= item.serviceWidth &&
      item.height <= item.serviceHeight
    : null;
  return { grossVolume, fitsOpening, openingKnown };
}

export function extractionPath(tank, items) {
  const hatch = items.find(
    (item) => item.id === tank.serviceId && item.kind === 'hatch',
  );
  if (!hatch) return null;
  const lateral = ['left', 'right'].includes(hatch.side);
  const aligned = lateral
    ? tank.x >= hatch.x && tank.x + tank.length <= hatch.x + hatch.length
    : tank.y >= hatch.y && tank.y + tank.width <= hatch.y + hatch.width;
  const heightFits =
    tank.z >= hatch.z && tank.z + tank.height <= hatch.z + hatch.height;
  const corridor = { ...tank };
  if (hatch.side === 'left') {
    corridor.y = hatch.y;
    corridor.width = Math.max(0, tank.y - hatch.y);
  }
  if (hatch.side === 'right') {
    corridor.y = tank.y + tank.width;
    corridor.width = Math.max(0, hatch.y + hatch.width - corridor.y);
  }
  if (hatch.side === 'front') {
    corridor.x = hatch.x;
    corridor.length = Math.max(0, tank.x - hatch.x);
  }
  if (hatch.side === 'rear') {
    corridor.x = tank.x + tank.length;
    corridor.length = Math.max(0, hatch.x + hatch.length - corridor.x);
  }
  const obstacles = items.filter(
    (item) =>
      item.id !== tank.id &&
      !isOpening(item) &&
      !isRoof(item) &&
      intersects(corridor, item),
  );
  return { hatch, corridor, aligned: aligned && heightFits, obstacles };
}

export function layoutFindings(project) {
  const area = envelope(project.vehicle);
  const items = project.items || [];
  const findings = [];
  const add = (type, title, detail, ...members) =>
    findings.push({ type, title, detail, ids: members.map((item) => item.id) });
  for (const item of items) {
    const outside =
      item.x < 0 ||
      item.y < 0 ||
      item.x + item.length > area.length ||
      item.y + item.width > area.width;
    if (outside)
      add(
        'Grenze',
        item.name + ' ragt über die Grundfläche',
        'Position und Außenmaß am Fahrzeug abgleichen.',
        item,
      );
    if (isRoof(item)) {
      if (item.z < area.height)
        add(
          'Höhe',
          item.name + ' liegt unter Dachniveau',
          'Dachniveau im Modell: ' + formatMM(area.height) + ' mm.',
          item,
        );
    } else if (item.z < 0 || item.z + item.height > area.height) {
      add(
        'Höhe',
        item.name + ' liegt außerhalb der Innenhöhe',
        'Ober- und Unterkante mit der nutzbaren Innenhöhe vergleichen.',
        item,
      );
    }
    if (isOpening(item)) {
      const aligned = alignOpening(item, project.vehicle);
      if (item.x !== aligned.x || item.y !== aligned.y)
        add(
          'Öffnung',
          item.name + ' liegt abseits der gewählten Wand',
          'Wandseite im Inspector neu wählen oder das Bauteil bis an die Wand versetzen.',
          item,
        );
    }
    if (item.parentId) {
      const parent = items.find(
        (other) => other.id === item.parentId && other !== item,
      );
      if (!parent)
        add(
          'Einbau',
          'Einbauort für ' + item.name + ' fehlt',
          'Hohlraum im Bauteil neu zuordnen.',
          item,
        );
      else if (!fitsInside(item, parent))
        add(
          'Einbau',
          item.name + ' passt nicht vollständig in ' + parent.name,
          'Bauteil oder Einbauzuordnung prüfen.',
          item,
          parent,
        );
    }
    if (isTank(item)) {
      const facts = tankFacts(item);
      if (item.capacity > facts.grossVolume)
        add(
          'Volumen',
          item.name + ' ist für den Inhalt zu klein',
          'Äußeres Hüllvolumen ' +
            facts.grossVolume.toLocaleString('de-DE', {
              maximumFractionDigits: 1,
            }) +
            ' l. Nenninhalt oder Außenmaße mit dem Datenblatt abgleichen.',
          item,
        );
      if (!facts.openingKnown)
        add(
          'Zugang',
          'Klappenmaß für ' + item.name + ' fehlt',
          'Lichte Breite und Höhe der Ausbauöffnung eintragen.',
          item,
        );
      if (facts.fitsOpening === false)
        add(
          'Zugang',
          item.name + ' passt aufrecht nicht durch die Klappe',
          'Die kleinste horizontale Tankseite und Tankhöhe überschreiten in mindestens einer Richtung das lichte Maß.',
          item,
        );
      const path = extractionPath(item, items);
      if (item.serviceId && !path)
        add(
          'Zugang',
          'Wartungsklappe für ' + item.name + ' fehlt',
          'Eine vorhandene Klappe zuordnen oder den Ausbauweg vor Ort aufnehmen.',
          item,
        );
      if (path && !path.aligned)
        add(
          'Zugang',
          item.name + ' und Klappe fluchten nicht',
          'Für einen geraden Ausbau müssen Tankquerschnitt und Höhenlage in das lichte Klappenmaß passen.',
          item,
          path.hatch,
        );
      if (path?.obstacles.length)
        add(
          'Zugang',
          'Gerader Ausbauweg für ' + item.name + ' belegt',
          path.obstacles.map((other) => other.name).join(', ') +
            ' im Ausbauweg.',
          item,
          ...path.obstacles,
        );
    }
  }
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (isRoof(a) !== isRoof(b) || (isOpening(a) && isOpening(b))) continue;
      if (
        (a.parentId === b.id && fitsInside(a, b)) ||
        (b.parentId === a.id && fitsInside(b, a))
      )
        continue;
      if (isOpening(a) || isOpening(b)) {
        const opening = isOpening(a) ? a : b;
        const solid = opening === a ? b : a;
        if (opening.passageId === solid.id) continue;
        if (
          intersects(
            opening.kind === 'door' ? doorZone(opening) : opening,
            solid,
          )
        ) {
          add(
            'Öffnung',
            opening.name + ' und ' + solid.name,
            opening.kind === 'door'
              ? 'Im eingeräumten Einstiegsbereich liegt ein Bauteil.'
              : 'Ein Hüllkörper liegt in der Wandöffnung.',
            opening,
            solid,
          );
        }
      } else if (intersects(a, b)) {
        add(
          'Kollision',
          a.name + ' und ' + b.name,
          'Die maßstäblichen Hüllkörper überschneiden sich in Länge, Breite und Höhe. Hohlräume vor Ort abgleichen.',
          a,
          b,
        );
      }
    }
  }
  return findings;
}

export function clampPosition(item, x, y, vehicle, snap = 0) {
  const area = envelope(vehicle);
  const round = (v) => (snap > 0 ? Math.round(v / snap) * snap : Math.round(v));
  return {
    x: Math.max(0, Math.min(Math.max(0, area.length - item.length), round(x))),
    y: Math.max(0, Math.min(Math.max(0, area.width - item.width), round(y))),
  };
}
