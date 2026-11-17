import React, { useEffect, useId, useRef, useState } from 'react';
import {
  BedDouble,
  Box,
  Boxes,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Copy,
  DoorOpen,
  FileDown,
  Grid2X2,
  Layers3,
  LayoutTemplate,
  List,
  Move,
  PackagePlus,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  Ruler,
  Search,
  SlidersHorizontal,
  Square,
  Tag,
  Trash2,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Modal } from '../ui.jsx';
import { changeLayout, syncOpenings } from './links.js';
import {
  catalog,
  layoutVariants,
  makeItem,
  makeLayout,
  newItemId,
} from './templates.js';
import {
  alignOpening,
  availableParents,
  clampPosition,
  dimensions,
  envelope,
  extractionPath,
  formatMM,
  groupOf,
  isOpening,
  isRoof,
  isTank,
  isVisible,
  layoutFindings,
  tankFacts,
  transformContents,
} from './geometry.js';
import PlanDrawing, { materials } from './PlanDrawing.jsx';
import Plan3D from './Plan3D.jsx';
import { exportSvg, printLayout } from './output.jsx';
import './layout.css';

const layers = [
  ['interior', 'Innenraum'],
  ['living', 'Möbel & Karosserie'],
  ['systems', 'Bordtechnik'],
  ['roof', 'Dach'],
  ['all', 'Alle Ebenen'],
];
const groups = ['Möbel', 'Bordtechnik', 'Karosserie', 'Eigene Bauteile'];
const categoryIcon = (group) =>
  group === 'Bordtechnik'
    ? Zap
    : group === 'Karosserie'
      ? DoorOpen
      : group === 'Eigene Bauteile'
        ? Box
        : BedDouble;
const dotStyle = (kind) => ({
  background: (materials[kind] || materials.custom)[0],
  borderColor: (materials[kind] || materials.custom)[1],
});
const libraryIds = new Set(layoutVariants.map((variant) => variant.id));
const libraryGroup = (id) =>
  libraryIds.has(id)
    ? id.startsWith('tour-')
      ? 'tours'
      : 'examples'
    : 'saved';
function importedVariants(project) {
  const stored = Object.entries(project.layoutDrafts || {})
    .filter(([id, items]) => !libraryIds.has(id) && validDraft(items))
    .map(([id]) => id);
  if (
    typeof project.layoutVariant === 'string' &&
    !libraryIds.has(project.layoutVariant)
  )
    stored.push(project.layoutVariant);
  const ids = [...new Set(stored)].sort();
  return ids.map((id, index) => ({
    id,
    name:
      ids.length === 1
        ? 'Importierter Entwurf'
        : 'Importierter Entwurf ' + (index + 1),
    description: 'Gespeicherte Belegung aus diesem Projekt.',
    reference: null,
    source: '',
  }));
}
const variantOf = (id, project) =>
  layoutVariants.find((v) => v.id === id) ||
  importedVariants(project).find((v) => v.id === id) || {
    id,
    name: 'Eigener Entwurf',
    reference: null,
    source: '',
  };

function LayoutButton({ icon: Icon, label, children, ...props }) {
  return (
    <button
      type="button"
      className="layout-tool"
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={17} />
      {children}
    </button>
  );
}

function ValueField({
  label,
  value,
  onCommit,
  min,
  max,
  unit,
  step = 'any',
  type = 'number',
  required = true,
}) {
  const [draft, setDraft] = useState(value ?? ''),
    [error, setError] = useState('');
  const input = useRef(null);
  useEffect(() => {
    setDraft(value ?? '');
    setError('');
  }, [value]);
  function commit() {
    const old = value ?? '';
    if (draft === '' && !required) {
      if (old !== '') onCommit(type === 'number' ? null : '');
      return;
    }
    const next = type === 'number' ? Number(draft) : String(draft).trim();
    if (
      draft === '' ||
      !input.current?.checkValidity() ||
      (type === 'number' && !Number.isFinite(next)) ||
      (required && next === '')
    ) {
      setError(
        draft === ''
          ? 'Bitte einen Wert eingeben.'
          : min !== undefined && next < min
            ? 'Mindestens ' + min + ' ' + (unit || '') + ' eingeben.'
            : max !== undefined && next > max
              ? 'Höchstens ' + max + ' ' + (unit || '') + ' eingeben.'
              : step === 1
                ? 'Bitte eine ganze Zahl eingeben.'
                : 'Bitte einen gültigen Wert eingeben.',
      );
      return;
    }
    if (next !== old) onCommit(next);
  }
  return (
    <label className="field layout-value">
      <span>{label}</span>
      <span className="layout-value-wrap">
        <input
          ref={input}
          type={type}
          value={draft}
          min={min}
          max={max}
          step={type === 'number' ? step : undefined}
          maxLength={type === 'text' ? 160 : undefined}
          required={required}
          aria-invalid={!!error}
          onChange={(e) => {
            setDraft(e.target.value);
            setError('');
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === 'Escape') {
              setError('');
              setDraft(value ?? '');
            }
          }}
        />
        {unit && <i>{unit}</i>}
      </span>
      {error && (
        <small className="layout-input-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}

function CatalogDialog({ project, onAdd, onClose, onRemove }) {
  const [term, setTerm] = useState(''),
    [group, setGroup] = useState('Alle');
  const own = Array.isArray(project.customCatalog) ? project.customCatalog : [];
  const options = [
    ...Object.entries(catalog).map(([kind, item]) => ({
      ...item,
      kind,
      token: kind,
    })),
    ...own.map((item) => ({
      ...item,
      group: 'Eigene Bauteile',
      token: item.templateId,
    })),
  ].filter(
    (item) =>
      (group === 'Alle' || item.group === group) &&
      (item.name + ' ' + item.group + ' ' + (item.material || ''))
        .toLocaleLowerCase('de')
        .includes(term.trim().toLocaleLowerCase('de')),
  );
  return (
    <Modal title="Bauteilkatalog" onClose={onClose} wide>
      <div className="layout-dialog-body">
        <p>
          Maße, Trockenmassen und Preise der Katalogbauteile sind Beispielwerte.
          Nach dem Einfügen kannst du deine Produktdaten eintragen.
        </p>
        <label className="layout-search">
          <Search size={17} />
          <input
            autoFocus
            placeholder="Bauteil oder Material suchen"
            aria-label="Bauteil oder Material suchen"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <div className="layout-groupbar">
          {['Alle', ...groups].map((g) => (
            <button
              key={g}
              className={'layout-chip ' + (group === g ? 'chosen' : '')}
              onClick={() => setGroup(g)}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="layout-catalog-list">
          {options.map((item) => {
            const Icon = categoryIcon(item.group);
            return (
              <div className="layout-catalog-row" key={item.token}>
                <button
                  onClick={() =>
                    onAdd(item.kind, item.templateId ? item : null)
                  }
                >
                  <i style={dotStyle(item.kind)}>
                    <Icon size={18} />
                  </i>
                  <span>
                    <b>{item.name}</b>
                    <small>{dimensions(item)} mm</small>
                  </span>
                  <Plus size={17} />
                </button>
                {item.templateId && (
                  <LayoutButton
                    icon={Trash2}
                    label={'Katalogvorlage ' + item.name + ' entfernen'}
                    onClick={() => onRemove(item.templateId)}
                  />
                )}
              </div>
            );
          })}
          {!options.length && (
            <p className="layout-empty">Keine passenden Bauteile im Katalog.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function SourceDialog({ project, onChoose, onClose }) {
  const saved = importedVariants(project);
  const options = [...layoutVariants, ...saved];
  const active =
    typeof project.layoutVariant === 'string' ? project.layoutVariant : 'empty';
  const [choice, setChoice] = useState(active);
  const [group, setGroup] = useState(libraryGroup(active));
  const v = variantOf(choice, project);
  function selectGroup(next) {
    if (next === group) return;
    const first = options.find((entry) => libraryGroup(entry.id) === next);
    if (!first) return;
    setGroup(next);
    setChoice(libraryGroup(active) === next ? active : first.id);
  }
  return (
    <Modal title="Grundrissvarianten" onClose={onClose} wide>
      <div className="layout-dialog-body">
        <p>
          Wechsle zwischen Entwürfen für dasselbe Fahrzeug. Beim Zurückwechseln
          erscheint die zuletzt gespeicherte Belegung der gewählten Variante.
        </p>
        <div className="layout-groupbar">
          {[
            ['examples', 'Planungsbeispiele'],
            ['tours', 'Reiselayouts'],
            ...(saved.length ? [['saved', 'Importierte Entwürfe']] : []),
          ].map(([id, name]) => (
            <button
              key={id}
              className={'layout-chip ' + (id === group ? 'chosen' : '')}
              aria-pressed={id === group}
              onClick={() => selectGroup(id)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="layout-variant-grid">
          {options
            .filter((entry) => libraryGroup(entry.id) === group)
            .map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={
                  'layout-variant ' + (choice === entry.id ? 'chosen' : '')
                }
                aria-pressed={choice === entry.id}
                onClick={() => setChoice(entry.id)}
              >
                <span>
                  <LayoutTemplate size={18} />
                  <b>{entry.name}</b>
                  {entry.id === project.layoutVariant && <Check size={16} />}
                </span>
                <small>{entry.description}</small>
              </button>
            ))}
        </div>
        {v.reference && (
          <div className="layout-source-note">
            <b>Beispielaufmaß</b>
            <p>
              {v.vehicleKind} mit {v.reference.map(formatMM).join(' × ')} mm
              Innenmaß.
            </p>
            <p>
              Möbel passen sich den Projektmaßen an. Prüfe Einbauorte,
              Gerätemaße und Bewegungsflächen am Fahrzeug.
            </p>
          </div>
        )}
        <div className="layout-dialog-actions">
          <button className="btn" onClick={onClose}>
            Schließen
          </button>
          <button
            className="btn primary"
            disabled={choice === project.layoutVariant}
            onClick={() => onChoose(choice)}
          >
            Entwurf öffnen
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Inspector({
  item,
  all,
  findings,
  onUpdate,
  onDuplicate,
  onRotate,
  onDelete,
  onRemember,
}) {
  const [tab, setTab] = useState('Maße');
  const defs = [
    ['length', 'Länge'],
    ['width', 'Breite'],
    ['height', 'Höhe'],
    ['x', 'X · ab Front'],
    ['y', 'Y · ab links'],
    ['z', 'Z · ab Boden'],
  ];
  const issues = findings.filter((f) => f.ids.includes(item.id));
  const path = isTank(item) ? extractionPath(item, all) : null;
  return (
    <aside className="panel layout-inspector">
      <div className="layout-boxhead">
        <SlidersHorizontal size={17} />
        <h2>Bauteileigenschaften</h2>
      </div>
      <div className="layout-inspect-title">
        <i style={dotStyle(item.kind)}></i>
        <div>
          <small>{groupOf(item)}</small>
          <h3>{item.name}</h3>
        </div>
      </div>
      <div className="layout-tabline">
        {['Maße', 'Ausstattung'].map((t) => (
          <button
            key={t}
            className={tab === t ? 'active' : ''}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="layout-inspect-body">
        {tab === 'Maße' ? (
          <>
            <ValueField
              label="Bezeichnung"
              value={item.name}
              type="text"
              onCommit={(v) => onUpdate({ name: v })}
            />
            <div className="layout-numbergrid">
              {defs.map(([key, label], i) => (
                <ValueField
                  key={key}
                  label={label}
                  value={item[key]}
                  min={i < 3 ? 1 : undefined}
                  step={1}
                  unit="mm"
                  onCommit={(v) => onUpdate({ [key]: v })}
                />
              ))}
            </div>
            {isOpening(item) ? (
              <label className="field">
                <span>Wandseite</span>
                <select
                  value={item.side || 'right'}
                  onChange={(e) => onUpdate({ side: e.target.value })}
                >
                  {[
                    ['left', 'Links in Fahrtrichtung'],
                    ['right', 'Rechts in Fahrtrichtung'],
                    ['front', 'Vordere Wand'],
                    ['rear', 'Heckwand'],
                  ].map(([id, n]) => (
                    <option key={id} value={id}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <button className="btn layout-narrow" onClick={onRotate}>
                <RotateCw size={15} /> Um 90° drehen
              </button>
            )}
          </>
        ) : (
          <>
            <ValueField
              label="Material"
              type="text"
              required={false}
              value={item.material}
              onCommit={(v) => onUpdate({ material: v })}
            />
            <div className="layout-numbergrid">
              <ValueField
                label="Trockenmasse"
                value={item.mass}
                min={0}
                unit="kg"
                required={false}
                onCommit={(v) => onUpdate({ mass: v })}
              />
              <ValueField
                label="Planpreis"
                value={item.cost}
                min={0}
                unit="€"
                required={false}
                onCommit={(v) => onUpdate({ cost: v })}
              />
            </div>
            {!isOpening(item) && (
              <label className="field">
                <span>Einbau in Hohlraum</span>
                <select
                  value={item.parentId || ''}
                  onChange={(e) => onUpdate({ parentId: e.target.value })}
                >
                  <option value="">Freistehendes Bauteil</option>
                  {availableParents(item, all).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {isTank(item) && (
              <>
                <div className="layout-numbergrid">
                  <ValueField
                    label="Nenninhalt"
                    value={item.capacity}
                    min={0}
                    unit="l"
                    onCommit={(v) => onUpdate({ capacity: v })}
                  />
                  <ValueField
                    label="Füllstand"
                    value={Math.round((item.fill ?? 0) * 100)}
                    min={0}
                    max={100}
                    unit="%"
                    onCommit={(v) => onUpdate({ fill: v / 100 })}
                  />
                </div>
                <label className="field">
                  <span>Wartungsklappe im Grundriss</span>
                  <select
                    value={item.serviceId || ''}
                    onChange={(e) => onUpdate({ serviceId: e.target.value })}
                  >
                    <option value="">Manuelles Klappenmaß</option>
                    {all
                      .filter((a) => a.kind === 'hatch')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="layout-numbergrid">
                  <ValueField
                    label="Lichte Breite"
                    value={item.serviceWidth}
                    min={0}
                    unit="mm"
                    onCommit={(v) => onUpdate({ serviceWidth: v })}
                  />
                  <ValueField
                    label="Lichte Höhe"
                    value={item.serviceHeight}
                    min={0}
                    unit="mm"
                    onCommit={(v) => onUpdate({ serviceHeight: v })}
                  />
                </div>
                <small className="layout-note">
                  Hüllvolumen{' '}
                  {tankFacts(item).grossVolume.toLocaleString('de-DE', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  l.{' '}
                  {path
                    ? path.aligned && !path.obstacles.length
                      ? 'Gerader Ausbauweg zur zugeordneten Klappe im Modell frei.'
                      : 'Geometrie und Hindernisse im Ausbauweg prüfen.'
                    : 'Für eine Prüfung des geraden Ausbauwegs eine Klappe im Grundriss zuordnen.'}
                </small>
              </>
            )}
            {item.kind === 'solar' && (
              <ValueField
                label="Modulleistung"
                value={item.watts}
                min={0}
                unit="Wp"
                onCommit={(v) => onUpdate({ watts: v })}
              />
            )}
            {item.kind === 'battery' && (
              <div className="layout-numbergrid">
                <ValueField
                  label="Kapazität"
                  value={item.ah}
                  min={0}
                  unit="Ah"
                  onCommit={(v) => onUpdate({ ah: v })}
                />
                <ValueField
                  label="Nennspannung"
                  value={item.voltage}
                  min={1}
                  unit="V"
                  onCommit={(v) => onUpdate({ voltage: v })}
                />
              </div>
            )}
            {item.kind === 'door' && (
              <ValueField
                label="Freiraum nach innen"
                value={item.clearance}
                min={0}
                unit="mm"
                onCommit={(v) => onUpdate({ clearance: v })}
              />
            )}
            <button className="btn layout-narrow" onClick={onRemember}>
              <PackagePlus size={15} />
              Im Katalog merken
            </button>
          </>
        )}
        {!!issues.length && (
          <div className="layout-warning">
            <CircleAlert size={15} />
            <span>
              {issues[0].title}
              {issues.length > 1 ? ' (+' + (issues.length - 1) + ')' : ''}
            </span>
          </div>
        )}
        <div className="layout-item-actions">
          <button className="btn" onClick={onDuplicate}>
            <Copy size={15} /> Kopieren
          </button>
          <LayoutButton
            icon={Trash2}
            label="Bauteil entfernen"
            onClick={onDelete}
          />
        </div>
      </div>
    </aside>
  );
}

function validDraft(list) {
  return (
    Array.isArray(list) &&
    list.every(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        ['x', 'y', 'z', 'length', 'width', 'height'].every((key) =>
          Number.isFinite(item[key]),
        ) &&
        item.width > 0 &&
        item.length > 0 &&
        item.height > 0,
    )
  );
}

function changeItem(prev, id, changes) {
  const before = prev.items.find((i) => i.id === id);
  if (!before) return prev;
  let item = { ...before, ...changes };
  if (isOpening(item)) {
    if (
      changes.side &&
      ['left', 'right'].includes(before.side) !==
        ['left', 'right'].includes(item.side)
    ) {
      [item.length, item.width] = [item.width, item.length];
      item.x = 0;
      item.y = 0;
    }
    if (
      changes.side ||
      changes.length !== undefined ||
      changes.width !== undefined
    )
      item = alignOpening(item, prev.vehicle);
  }
  const items = transformContents(
    before,
    item,
    prev.items.map((i) => (i.id === id ? item : i)),
  );
  if (isTank(item) && item.serviceId) {
    const at = items.findIndex(
      (i) => i.id === item.serviceId && i.kind === 'hatch',
    );
    if (at >= 0) {
      const hatch = { ...items[at] };
      const span = ['left', 'right'].includes(hatch.side) ? 'length' : 'width';
      if (changes.serviceWidth !== undefined && changes.serviceWidth > 0)
        hatch[span] = changes.serviceWidth;
      if (changes.serviceHeight !== undefined && changes.serviceHeight > 0)
        hatch.height = changes.serviceHeight;
      item.serviceWidth = hatch[span];
      item.serviceHeight = hatch.height;
      items[at] = hatch;
    }
  }
  if (item.kind === 'hatch') {
    for (let i = 0; i < items.length; i++)
      if (items[i].serviceId === id)
        items[i] = {
          ...items[i],
          serviceWidth: ['left', 'right'].includes(item.side)
            ? item.length
            : item.width,
          serviceHeight: item.height,
        };
  }
  return { ...prev, items: syncOpenings(items) };
}

const hasInterior = (v) =>
  ['length', 'width', 'height'].every(
    (k) => Number.isFinite(v?.[k]) && v[k] > 0,
  );
export function PlanPreview({ project }) {
  if (!hasInterior(project.vehicle))
    return <span className="hint">Innenaufmaß offen</span>;
  return (
    <div className="layout-mini">
      <PlanDrawing project={project} layer="interior" labels={false} preview />
    </div>
  );
}

export default function LayoutPage({ project, onChange }) {
  const [selected, setSelected] = useState(null),
    [mode, setMode] = useState('2D'),
    [layer, setLayer] = useState('interior');
  const [dialog, setDialog] = useState(''),
    [grid, setGrid] = useState(true),
    [labels, setLabels] = useState(true),
    [snap, setSnap] = useState(25);
  const [angle, setAngle] = useState(34),
    [elevation, setElevation] = useState(34),
    [zoom, setZoom] = useState(1),
    [notice, setNotice] = useState('');
  const [partQuery, setPartQuery] = useState(''),
    [past, setPast] = useState([]);
  const headingId = useId();
  const variant = variantOf(project.layoutVariant, project),
    area = envelope(project.vehicle);
  const current = project.items.find((i) => i.id === selected);
  const findings = layoutFindings(project);
  const sourceCount = project.items.length;
  useEffect(() => {
    setSelected(null);
    setPast([]);
    setDialog('');
    setNotice('');
  }, [project.id]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4200);
    return () => clearTimeout(t);
  }, [notice]);
  function apply(updater, message) {
    setPast((earlier) => [
      ...earlier.slice(-19),
      {
        items: project.items,
        layoutVariant: project.layoutVariant,
        layoutDrafts: project.layoutDrafts,
        layoutBindings: project.layoutBindings,
        systems: project.systems,
        customCatalog: project.customCatalog,
      },
    ]);
    onChange(updater);
    if (message) setNotice(message);
  }
  function undo() {
    const last = past.at(-1);
    if (!last) return;
    setPast((old) => old.slice(0, -1));
    onChange((prev) => ({ ...prev, ...last }));
    setSelected(null);
    setNotice('Letzte Grundrissänderung zurückgenommen.');
  }
  function choose(id) {
    setSelected(id);
    const part = project.items.find((i) => i.id === id);
    if (part && !isVisible(part, layer))
      setLayer(
        isRoof(part)
          ? 'roof'
          : groupOf(part) === 'Bordtechnik'
            ? 'systems'
            : 'interior',
      );
  }
  function add(kind, template) {
    const props = template ? { ...template } : {};
    for (const k of [
      'templateId',
      'token',
      'group',
      'serviceId',
      'passageId',
      'parentId',
      'id',
    ])
      delete props[k];
    let item = makeItem(kind, props);
    const pos = clampPosition(
      item,
      (area.length - item.length) / 2,
      (area.width - item.width) / 2,
      project.vehicle,
      snap,
    );
    item = { ...item, ...pos, z: isRoof(item) ? area.height : item.z };
    if (isOpening(item)) item = alignOpening(item, area);
    apply(
      (prev) => ({ ...prev, items: [...prev.items, item] }),
      item.name + ' hinzugefügt.',
    );
    setSelected(item.id);
    setLayer(
      isRoof(item)
        ? 'roof'
        : groupOf(item) === 'Bordtechnik'
          ? 'systems'
          : 'interior',
    );
    setDialog('');
  }
  function replace(choice) {
    const saved = project.layoutDrafts?.[choice];
    const next = validDraft(saved)
      ? saved
      : makeLayout(choice, project.vehicle);
    apply(
      (prev) => changeLayout(prev, choice, next),
      variantOf(choice, project).name + ' geöffnet.',
    );
    setSelected(null);
    setLayer('interior');
    setDialog('');
  }
  function update(changes) {
    if (current) apply((prev) => changeItem(prev, current.id, changes));
  }
  function duplicate() {
    if (!current) return;
    const id = newItemId();
    let item = {
      ...current,
      ...clampPosition(current, current.x + 100, current.y + 100, area, snap),
      name: current.name + ' · Kopie',
      id,
    };
    if (isOpening(item)) item = alignOpening(item, area);
    delete item.serviceId;
    delete item.passageId;
    apply(
      (prev) => ({ ...prev, items: [...prev.items, item] }),
      'Bauteil kopiert.',
    );
    setSelected(id);
  }
  function remember() {
    const { id, serviceId, passageId, ...properties } = current;
    const template = { ...properties, templateId: newItemId() };
    apply(
      (prev) => ({
        ...prev,
        customCatalog: [...(prev.customCatalog || []), template],
      }),
      'Im eigenen Bauteilkatalog gespeichert.',
    );
  }
  async function output(type) {
    try {
      if (type === 'print') {
        if (!(await printLayout(project)))
          setNotice('Bitte das Druckfenster für diese Seite zulassen.');
      } else {
        await exportSvg(project, layer);
        setNotice('SVG in Originalmaßen erstellt.');
      }
    } catch {
      setNotice('Die Zeichnung konnte nicht ausgegeben werden.');
    }
  }
  const visibleParts = project.items.filter((i) =>
    (i.name + ' ' + groupOf(i))
      .toLocaleLowerCase('de')
      .includes(partQuery.toLocaleLowerCase('de')),
  );
  const displayLayer = (v) => {
    setLayer(v);
    if (current && !isVisible(current, v)) setSelected(null);
  };
  if (!hasInterior(project.vehicle))
    return (
      <>
        <header className="page-head">
          <h1>Grundriss</h1>
        </header>
        <section className="panel form-body">
          <h2>Innenaufmaß offen</h2>
          <p>
            Für eine bemaßte Zeichnung fehlen Innenlänge, Breite oder Höhe. Die
            vorhandenen Bauteile sind im Projekt gespeichert.
          </p>
          <div>
            <a className="btn primary" href="#/fahrzeug">
              Fahrzeugmaße ergänzen
            </a>
          </div>
        </section>
      </>
    );
  return (
    <div className="layout-page">
      <header className="page-head">
        <div>
          <h1>Grundriss & Innenausbau</h1>
          <p>
            Plane Möbel, Bordtechnik und Wartungszugänge im vermessenen
            Innenraum.
          </p>
        </div>
        <button className="btn primary" onClick={() => setDialog('catalog')}>
          <Plus size={17} /> Bauteil hinzufügen
        </button>
      </header>
      <div className="layout-subhead">
        <button className="btn" onClick={() => setDialog('sources')}>
          <LayoutTemplate size={16} />
          {variant.name}
          <ChevronDown size={14} />
        </button>
        <a className="layout-vehicle-link" href="#/fahrzeug">
          <Ruler size={15} />
          {dimensions(area)} mm
        </a>
        <div className="layout-outputs">
          <LayoutButton
            icon={RotateCcw}
            label="Letzte Grundrissänderung zurücknehmen"
            disabled={!past.length}
            onClick={undo}
          />
          <button className="btn" onClick={() => output('print')}>
            <Printer size={15} />
            Druckplan
          </button>
          <LayoutButton
            icon={FileDown}
            label="Maßstäbliche SVG exportieren"
            onClick={() => output('svg')}
          />
        </div>
      </div>
      <div className="layout-workarea">
        <section className="panel layout-artboard" aria-labelledby={headingId}>
          <div className="layout-canvas-head">
            <div>
              <span className="layout-swatch" />{' '}
              <h2 id={headingId}>
                {mode === '3D' ? 'Raumansicht' : 'Grundriss'}
              </h2>
            </div>
            <div className="layout-segment">
              {['2D', '3D'].map((v) => (
                <button
                  key={v}
                  className={v === mode ? 'active' : ''}
                  onClick={() => setMode(v)}
                  aria-pressed={v === mode}
                >
                  {v === '2D' ? <Square size={14} /> : <Box size={14} />} {v}
                </button>
              ))}
            </div>
          </div>
          <div className="layout-layerline">
            <label className="layout-layer">
              <Layers3 size={15} />
              <select
                value={layer}
                aria-label="Sichtbare Ebene"
                onChange={(e) => displayLayer(e.target.value)}
              >
                {layers.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="layout-view-tools">
              <LayoutButton
                icon={ZoomOut}
                label="Ansicht verkleinern"
                disabled={zoom <= 1}
                onClick={() => setZoom((v) => Math.max(1, v - 0.5))}
              />
              <LayoutButton
                icon={ZoomIn}
                label="Ansicht vergrößern"
                disabled={zoom >= 3}
                onClick={() => setZoom((v) => Math.min(3, v + 0.5))}
              />
              <LayoutButton
                icon={Grid2X2}
                disabled={mode === '3D'}
                aria-pressed={grid}
                label="100-mm-Raster umschalten"
                onClick={() => setGrid(!grid)}
              />
              <LayoutButton
                icon={Tag}
                aria-pressed={labels}
                label="Beschriftung umschalten"
                onClick={() => setLabels(!labels)}
              />
            </div>
          </div>
          <div className="layout-board">
            <div style={{ width: zoom * 100 + '%', height: zoom * 100 + '%' }}>
              {mode === '2D' ? (
                <PlanDrawing
                  project={project}
                  layer={layer}
                  selected={selected}
                  onSelect={choose}
                  onMove={({ id, x, y }) => {
                    apply((prev) => changeItem(prev, id, { x, y }));
                  }}
                  grid={grid}
                  labels={labels}
                  snap={snap}
                />
              ) : (
                <Plan3D
                  project={project}
                  layer={layer}
                  selected={selected}
                  onSelect={choose}
                  labels={labels}
                  angle={angle}
                  elevation={elevation}
                />
              )}
            </div>
          </div>
          {mode === '2D' ? (
            <div className="layout-board-foot">
              <span>
                <Move size={14} /> Bauteil ziehen oder Maße eingeben
              </span>
              <label>
                Fangraster{' '}
                <select
                  aria-label="Fangraster"
                  value={snap}
                  onChange={(e) => setSnap(Number(e.target.value))}
                >
                  {[0, 10, 25, 50, 100].map((v) => (
                    <option key={v} value={v}>
                      {v ? v + ' mm' : 'Aus'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <div className="layout-orbit">
              <label>
                <RotateCw size={14} />
                Drehung
                <input
                  aria-label="3D-Drehung"
                  type="range"
                  min="-180"
                  max="180"
                  value={angle}
                  onChange={(e) => setAngle(Number(e.target.value))}
                />
              </label>
              <label>
                Neigung
                <input
                  aria-label="3D-Neigung"
                  type="range"
                  min="12"
                  max="75"
                  value={elevation}
                  onChange={(e) => setElevation(Number(e.target.value))}
                />
              </label>
            </div>
          )}
        </section>
        {current ? (
          <Inspector
            key={current.id}
            item={current}
            all={project.items}
            findings={findings}
            onUpdate={update}
            onDuplicate={duplicate}
            onRotate={() =>
              update({
                length: current.width,
                width: current.length,
                rotation: ((current.rotation || 0) + 90) % 360,
              })
            }
            onDelete={() => {
              apply(
                (prev) => ({
                  ...prev,
                  items: prev.items.filter((i) => i.id !== selected),
                }),
                'Bauteil entfernt. Rückgängig ist verfügbar.',
              );
              setSelected(null);
            }}
            onRemember={remember}
          />
        ) : (
          <aside className="panel layout-parts-short">
            <div className="layout-boxhead">
              <Boxes size={17} />
              <h2>Bauteile</h2>
              <span>{sourceCount}</span>
            </div>
            <div className="layout-parts-scroll">
              {project.items.map((i) => (
                <button key={i.id} onClick={() => choose(i.id)}>
                  <i style={dotStyle(i.kind)} />
                  <span>{i.name}</span>
                  <small>{formatMM(i.length)} mm</small>
                </button>
              ))}
              {!sourceCount && (
                <p className="layout-empty">
                  Die Kabine ist leer. Füge das erste Bauteil aus dem Katalog
                  hinzu.
                </p>
              )}
            </div>
          </aside>
        )}
      </div>
      <details className="panel layout-fold">
        <summary>
          <List size={18} />
          <b>Aufmaßliste</b>
          <span>{sourceCount} Bauteile</span>
          <ChevronDown size={17} />
        </summary>
        <div className="layout-fold-body">
          <p>
            X beginnt an der vorderen Innenwand und steigt zum Heck. Die rechte
            Fahrzeugseite liegt oben im Plan. Y beginnt an der linken Wand in
            Fahrtrichtung und steigt nach rechts. Z beginnt am Fußboden. Das
            Fahrerhaus ist zur Orientierung skizziert.
          </p>
          <label className="layout-search">
            <Search size={16} />
            <input
              placeholder="Bauteil suchen"
              aria-label="Aufmaßliste durchsuchen"
              value={partQuery}
              onChange={(e) => setPartQuery(e.target.value)}
            />
          </label>
          <div className="layout-table-wrap">
            <table>
              <thead>
                <tr>
                  {['Bauteil', 'X', 'Y', 'Z', 'L × B × H (mm)'].map((v) => (
                    <th key={v}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleParts.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <button onClick={() => choose(i.id)}>{i.name}</button>
                    </td>
                    <td>{formatMM(i.x)}</td>
                    <td>{formatMM(i.y)}</td>
                    <td>{formatMM(i.z)}</td>
                    <td>{dimensions(i)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleParts.length && (
              <p className="layout-empty">Keine passenden Bauteile.</p>
            )}
          </div>
        </div>
      </details>
      <details className="panel layout-fold">
        <summary>
          {findings.length ? (
            <CircleAlert size={18} />
          ) : (
            <CheckCheck size={18} />
          )}
          <b>Geometrieprüfung</b>
          <span>
            {findings.length
              ? findings.length + ' Hinweise'
              : 'Keine Überschneidungen'}
          </span>
          <ChevronDown size={17} />
        </summary>
        <div className="layout-fold-body">
          <p>
            Verglichen werden rechteckige Hüllkörper, Wandöffnungen, die
            Innenhöhe und geradlinige Tankausbauwege. Rundungen der Karosserie,
            Befestigungen und Anschlüsse am Fahrzeug prüfen.
          </p>
          {findings.map((f, i) => (
            <button
              className="layout-finding"
              key={i}
              onClick={() => choose(f.ids[0])}
            >
              <CircleAlert size={16} />
              <span>
                <b>{f.title}</b>
                <small>{f.detail}</small>
              </span>
            </button>
          ))}
        </div>
      </details>
      {notice && (
        <div className="layout-notice" role="status">
          {notice}
          <button aria-label="Meldung schließen" onClick={() => setNotice('')}>
            <X size={14} />
          </button>
        </div>
      )}
      {dialog === 'catalog' && (
        <CatalogDialog
          project={project}
          onClose={() => setDialog('')}
          onAdd={add}
          onRemove={(id) =>
            apply(
              (prev) => ({
                ...prev,
                customCatalog: prev.customCatalog.filter(
                  (t) => t.templateId !== id,
                ),
              }),
              'Katalogvorlage entfernt.',
            )
          }
        />
      )}
      {dialog === 'sources' && (
        <SourceDialog
          project={project}
          onClose={() => setDialog('')}
          onChoose={replace}
        />
      )}
    </div>
  );
}
