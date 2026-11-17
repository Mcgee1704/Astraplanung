export function openingFor(tank, items) {
  if (!tank.serviceId)
    return {
      width: tank.serviceWidth ?? null,
      height: tank.serviceHeight ?? null,
    };
  const hatch = items.find(
    (i) => i.kind === 'hatch' && i.id === tank.serviceId,
  );
  return hatch
    ? {
        width: ['left', 'right'].includes(hatch.side)
          ? hatch.length
          : hatch.width,
        height: hatch.height,
      }
    : { width: null, height: null };
}
export function syncOpenings(items) {
  return items.map((item) => {
    if (!item.serviceId || !['grey', 'fresh'].includes(item.kind)) return item;
    const { width, height } = openingFor(item, items);
    return item.serviceWidth === width && item.serviceHeight === height
      ? item
      : { ...item, serviceWidth: width, serviceHeight: height };
  });
}
function captureBindings(systems) {
  return {
    loads: Object.fromEntries(
      (systems.loads || []).map((l) => [l.id, l.itemId]),
    ),
    heaterItemId: systems.heaterItemId,
    boilerItemId: systems.boilerItemId,
  };
}
function equivalent(id, from, to) {
  if (!id || id === 'auto' || to.some((i) => i.id === id)) return id;
  const old = from.find((i) => i.id === id);
  if (!old) return id;
  const matches = to.filter((i) => i.kind === old.kind);
  if (matches.length === 1) return matches[0].id;
  const named = matches.filter((i) => i.name === old.name);
  return named.length === 1 ? named[0].id : id;
}
export function changeLayout(project, choice, items) {
  const drafts = {
    ...project.layoutBindings,
    [project.layoutVariant || 'empty']: captureBindings(project.systems),
  };
  const saved = drafts[choice];
  const resolve = (key, id, collection) =>
    collection && Object.hasOwn(collection, key)
      ? collection[key]
      : equivalent(id, project.items, items);
  const systems = {
    ...project.systems,
    loads: project.systems.loads.map((load) => ({
      ...load,
      itemId: resolve(load.id, load.itemId, saved?.loads),
    })),
    heaterItemId: resolve('heaterItemId', project.systems.heaterItemId, saved),
    boilerItemId: resolve('boilerItemId', project.systems.boilerItemId, saved),
  };
  return {
    ...project,
    items: syncOpenings(items),
    layoutVariant: choice,
    systems,
    layoutBindings: drafts,
    layoutDrafts: {
      ...project.layoutDrafts,
      [project.layoutVariant || 'empty']: project.items,
    },
  };
}
