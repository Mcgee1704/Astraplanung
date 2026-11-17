import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Crosshair,
  Download,
  ExternalLink,
  Layers,
  Plus,
  Ruler,
  Trash2,
} from 'lucide-react';
import { allCuts, cardOf, cutPlan } from '../records/model.js';
import { Field } from '../records/shared.jsx';
import { createStencil, planStencil, rectanglePoints } from './geometry.js';
import { stencilPdf } from './pdf.js';
import './stencils.css';

const decimal = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 });
const mm = (value) => decimal.format(value);
const isPoint = (point) =>
  Number.isFinite(point?.x) && Number.isFinite(point?.y);
const faceOptions = [
  { id: 'LB', name: 'Länge × Breite', keys: ['actualLength', 'actualWidth'] },
  { id: 'LH', name: 'Länge × Höhe', keys: ['actualLength', 'actualHeight'] },
  { id: 'BH', name: 'Breite × Höhe', keys: ['actualWidth', 'actualHeight'] },
];
const sources = [
  ['free', 'Freie Messkontur'],
  ['rectangle', 'Gemessenes Rechteck'],
  ['item', 'Ist-Maße eines Bauteils'],
  ['cut', 'Zuschnittposition nachmessen'],
];

function measuredNumber(value, positiveOnly = false) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value).trim().replace(/^−/, '-');
  if (!/^[+-]?(?:\d+|\d+[.,]\d+|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(text))
    return null;
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && (!positiveOnly || n > 0) ? n : null;
}
const positive = (value) => measuredNumber(value, true);

function cutLabel(itemName, rowName) {
  return [itemName, rowName || 'Unbenanntes Brett'].filter(Boolean).join(' · ');
}

function Creator({ items, records, count, add, cancel }) {
  const [source, setSource] = useState('free');
  const [name, setName] = useState('');
  const [width, setWidth] = useState(null);
  const [height, setHeight] = useState(null);
  const [itemId, setItemId] = useState(items[0]?.id || '');
  const [faceId, setFaceId] = useState('LB');
  const [cutId, setCutId] = useState('');
  const cuts = useMemo(
    () =>
      allCuts(items, records).map((row) => ({
        ...row,
        key: JSON.stringify([row.itemId, row.id]),
      })),
    [items, records],
  );
  const chosenCut = cuts.find((row) => row.key === cutId) || cuts[0];
  const item = items.find((part) => part.id === itemId) || items[0];
  const face = faceOptions.find((option) => option.id === faceId);
  const card = item && cardOf(item, records);
  const measured = face.keys.map((key) => positive(card?.[key]));
  const dimensions =
    source === 'item' ? measured : [positive(width), positive(height)];
  const ready =
    source === 'free' ||
    (dimensions.every((v) => v !== null) &&
      (source !== 'item' || Boolean(item)) &&
      (source !== 'cut' || Boolean(chosenCut)));
  const suggested =
    source === 'item' && item
      ? item.name + ' · ' + face.name
      : source === 'cut' && chosenCut
        ? cutLabel(chosenCut.itemName, chosenCut.name)
        : 'Schablone ' + (count + 1);

  function chooseSource(value) {
    setSource(value);
    setWidth(null);
    setHeight(null);
  }

  function submit(event) {
    event.preventDefault();
    if (!ready) return;
    const link =
      source === 'item'
        ? item.id
        : source === 'cut'
          ? chosenCut.itemId
          : undefined;
    const draft = createStencil(name.trim() || suggested, link);
    if (source === 'cut') {
      draft.cutRef = {
        rowId: String(chosenCut.id),
        label: cutLabel(chosenCut.itemName, chosenCut.name),
      };
    }
    if (source !== 'free') draft.points = rectanglePoints(...dimensions);
    add(draft);
  }

  return (
    <section className="panel rec-panel st-new" aria-label="Neue Schablone">
      <div className="rec-section-head">
        <div>
          <h2>Schablone anlegen</h2>
          <p>
            X und Y in Millimetern ohne Tausendertrennzeichen eingeben. Komma
            und Punkt werden als Dezimalzeichen erkannt.
          </p>
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="rec-form-grid">
          <Field
            label="Ausgangspunkt"
            value={source}
            change={chooseSource}
            options={sources}
          />
          <Field
            label="Schablonenname"
            value={name}
            change={setName}
            placeholder={suggested}
          />
        </div>
        {source === 'free' && (
          <p className="rec-hint">
            Beginne mit einer leeren Punktliste. Die letzte Kante führt zurück
            zum ersten Messpunkt.
          </p>
        )}
        {source === 'item' && (
          <div className="st-source-detail">
            {items.length > 0 ? (
              <>
                <div className="rec-form-grid">
                  <Field
                    label="Bauteil mit Aufmaß"
                    value={item.id}
                    change={setItemId}
                    options={items.map((part) => [part.id, part.name])}
                  />
                  <Field
                    label="Gemessene Fläche"
                    value={faceId}
                    change={setFaceId}
                    options={faceOptions.map((option) => [
                      option.id,
                      option.name,
                    ])}
                  />
                </div>
                <p className="rec-hint">
                  Ist-Maße aus der Bordakte:{' '}
                  {dimensions
                    .map((value) =>
                      value === null ? 'offen' : mm(value) + ' mm',
                    )
                    .join(' × ')}
                  .
                </p>
                {!ready && (
                  <p className="st-note">
                    Für diese Fläche fehlen positive Ist-Maße.{' '}
                    <a href="#/bordakte">Bauteil in der Bordakte nachmessen</a>
                  </p>
                )}
              </>
            ) : (
              <p className="rec-hint">
                Für diese Auswahl zuerst ein Bauteil im Grundriss anlegen und
                seine Ist-Maße in der Bordakte erfassen.
              </p>
            )}
          </div>
        )}
        {source === 'cut' && (
          <div className="st-source-detail">
            {chosenCut ? (
              <>
                <Field
                  label="Zuschnittposition"
                  value={chosenCut.key}
                  options={cuts.map((row) => [
                    row.key,
                    cutLabel(row.itemName, row.name),
                  ])}
                  change={(id) => {
                    setCutId(id);
                    setWidth(null);
                    setHeight(null);
                  }}
                />
                <p className="rec-hint">
                  Vorgesehenes Fertigmaß:{' '}
                  {positive(chosenCut.length) && positive(chosenCut.width)
                    ? mm(chosenCut.length) + ' × ' + mm(chosenCut.width) + ' mm'
                    : 'offen'}
                  . Trage darunter die beiden am Werkstück gemessenen Werte ein.
                </p>
              </>
            ) : (
              <p className="rec-hint">
                Unter „Zuschnitte“ lassen sich Bretter für eine spätere
                Zuordnung erfassen.
              </p>
            )}
          </div>
        )}
        {(source === 'rectangle' || (source === 'cut' && chosenCut)) && (
          <div
            key={source + (source === 'cut' ? chosenCut.key : '')}
            className="rec-form-grid st-source-detail"
          >
            <Millimetres
              label="Gemessene Breite X (mm)"
              value={width}
              change={setWidth}
              positiveOnly
            />
            <Millimetres
              label="Gemessene Höhe Y (mm)"
              value={height}
              change={setHeight}
              positiveOnly
            />
          </div>
        )}
        <div className="st-actions">
          <button className="btn primary" disabled={!ready} type="submit">
            <Plus size={16} /> Schablone anlegen
          </button>
          {cancel && (
            <button className="btn" type="button" onClick={cancel}>
              Abbrechen
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function NameField({ stencil, save }) {
  const [draft, setDraft] = useState(null);
  function finish() {
    if (draft?.trim() && draft.trim() !== stencil.name) save(draft.trim());
    setDraft(null);
  }
  return (
    <label className="field rec-field">
      <span>Name der Schablone</span>
      <input
        value={draft ?? stencil.name}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            setDraft(null);
            e.preventDefault();
          }
        }}
      />
    </label>
  );
}

function Millimetres({ label, value, change, select, positiveOnly = false }) {
  const [draft, setDraft] = useState(null);
  const hint = useId();
  const shown =
    draft ?? (Number.isFinite(value) ? String(value).replace('.', ',') : '');
  const invalid =
    shown.trim() !== '' && measuredNumber(shown, positiveOnly) === null;
  return (
    <label className="st-number">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={shown}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={invalid ? hint : undefined}
        onFocus={() => {
          setDraft(shown);
          select?.();
        }}
        onBlur={() => {
          if (!invalid) setDraft(null);
        }}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          change(measuredNumber(raw, positiveOnly));
        }}
      />
      {invalid && (
        <small id={hint} className="st-input-error">
          {positiveOnly
            ? 'Positives Maß eingeben, z. B. 125,5.'
            : 'Maß vervollständigen, z. B. −8,25.'}
        </small>
      )}
    </label>
  );
}

function PointList({ points, active, setActive, update }) {
  // Raw text such as an unfinished decimal stays with its measurement while rows move.
  // Object identities are enough for this editor and do not alter the portable point format.
  const rowKeys = useRef(new WeakMap());
  const nextKey = useRef(0);
  function keyFor(point) {
    if (!rowKeys.current.has(point))
      rowKeys.current.set(point, ++nextKey.current);
    return rowKeys.current.get(point);
  }
  function patch(index, change) {
    update((previous) =>
      previous.map((point, i) => {
        if (i !== index) return point;
        const updated = change(point);
        rowKeys.current.set(updated, keyFor(point));
        return updated;
      }),
    );
    setActive(index);
  }
  function move(index, step) {
    const nextIndex = index + step;
    update((previous) => {
      if (nextIndex < 0 || nextIndex >= previous.length) return previous;
      const reordered = [...previous];
      [reordered[index], reordered[nextIndex]] = [
        reordered[nextIndex],
        reordered[index],
      ];
      return reordered;
    });
    setActive(nextIndex);
  }
  function remove(index) {
    update((previous) => previous.filter((_, i) => i !== index));
    setActive(Math.max(0, Math.min(index, points.length - 2)));
  }
  return (
    <section className="panel rec-panel st-points">
      <div className="rec-section-head">
        <div>
          <h2>Messpunkte</h2>
          <p>
            Entlang der Schnittkante der Reihe nach erfassen. Der Zwischenpunkt
            eines Kreisbogens liegt auf der gemessenen Kante.
          </p>
        </div>
        <button
          className="btn"
          onClick={() => {
            update((previous) => [...previous, { x: null, y: null }]);
            setActive(points.length);
          }}
        >
          <Plus size={16} /> Punkt ergänzen
        </button>
      </div>
      {points.length === 0 ? (
        <p className="rec-hint">
          Trage den ersten Punkt in der Liste ein oder setze ihn im Raster der
          Vorschau.
        </p>
      ) : (
        <ol className="st-point-list">
          {points.map((point, i) => {
            const n = i + 1,
              target = ((i + 1) % points.length) + 1;
            return (
              <li
                key={keyFor(point)}
                className={i === active ? 'st-point-active' : ''}
              >
                <div className="st-point-main">
                  <button
                    className="st-index"
                    type="button"
                    aria-label={'Punkt ' + n + ' in Vorschau markieren'}
                    aria-pressed={i === active}
                    onClick={() => setActive(i)}
                  >
                    P{n}
                  </button>
                  <Millimetres
                    label={'P' + n + ' X (mm)'}
                    value={point.x}
                    select={() => setActive(i)}
                    change={(x) => patch(i, (p) => ({ ...p, x }))}
                  />
                  <Millimetres
                    label={'P' + n + ' Y (mm)'}
                    value={point.y}
                    select={() => setActive(i)}
                    change={(y) => patch(i, (p) => ({ ...p, y }))}
                  />
                  <Field
                    label={'Kante P' + n + ' → P' + target}
                    value={point.via ? 'arc' : 'line'}
                    options={[
                      ['line', 'Gerade'],
                      ['arc', 'Kreisbogen'],
                    ]}
                    change={(type) =>
                      patch(i, (p) => {
                        if (type === 'arc')
                          return { ...p, via: p.via ?? { x: null, y: null } };
                        const { via, ...rest } = p;
                        return rest;
                      })
                    }
                  />
                  <div className="st-point-tools">
                    <button
                      className="rec-icon-btn"
                      disabled={i === 0}
                      aria-label={'Punkt ' + n + ' nach oben'}
                      title="Nach oben"
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="rec-icon-btn"
                      disabled={i === points.length - 1}
                      aria-label={'Punkt ' + n + ' nach unten'}
                      title="Nach unten"
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="rec-icon-btn"
                      aria-label={'Punkt ' + n + ' entfernen'}
                      title="Punkt entfernen"
                      onClick={() => remove(i)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {point.via && (
                  <div className="st-via">
                    <strong>
                      Bogen von P{n} nach P{target}
                    </strong>
                    <Millimetres
                      label={'Bogen P' + n + ' Zwischenpunkt X (mm)'}
                      value={point.via.x}
                      select={() => setActive(i)}
                      change={(x) =>
                        patch(i, (p) => ({ ...p, via: { ...p.via, x } }))
                      }
                    />
                    <Millimetres
                      label={'Bogen P' + n + ' Zwischenpunkt Y (mm)'}
                      value={point.via.y}
                      select={() => setActive(i)}
                      change={(y) =>
                        patch(i, (p) => ({ ...p, via: { ...p.via, y } }))
                      }
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function plottingBox(plan, points, showSheets) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  function include(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (plan.bounds) {
    include(plan.bounds.minX, plan.bounds.minY);
    include(plan.bounds.maxX, plan.bounds.maxY);
  }
  for (const point of points) {
    include(point.x, point.y);
    if (point.via) include(point.via.x, point.via.y);
  }
  if (showSheets && plan.ok) {
    for (const tile of plan.tiles) {
      include(tile.minX, tile.minY);
      include(tile.maxX, tile.maxY);
    }
  }
  if (
    ![minX, maxX, minY, maxY, maxX - minX, maxY - minY].every(Number.isFinite)
  ) {
    return { x: -15, y: -15, width: 330, height: 230 };
  }
  const span = Math.max(30, maxX - minX, maxY - minY);
  const width = Math.max(span * 0.36, maxX - minX) + span * 0.18;
  const height = Math.max(span * 0.28, maxY - minY) + span * 0.18;
  return {
    x: minX + (maxX - minX - width) / 2,
    y: minY + (maxY - minY - height) / 2,
    width,
    height,
  };
}

function gridStep(span) {
  const power = 10 ** Math.floor(Math.log10(span / 12));
  return ([1, 2, 5, 10].find((m) => m * power >= span / 12) || 10) * power;
}

function Preview({ plan, points, active, setActive, addPoint }) {
  const space = useRef(null);
  const canvas = useRef(null);
  const [pixels, setPixels] = useState({ width: 540, height: 280 });
  useEffect(() => {
    const element = canvas.current;
    function measure() {
      if (element.clientWidth && element.clientHeight) {
        setPixels({ width: element.clientWidth, height: element.clientHeight });
      }
    }
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const pattern = 'st-grid-' + useId().replace(/[^\w-]/g, '');
  const [showSheets, setShowSheets] = useState(true);
  const [fixedBox, setFixedBox] = useState(null);
  const box = fixedBox || plottingBox(plan, points, showSheets);
  const span = Math.max(box.width, box.height);
  const step = gridStep(span);
  const showLabels = points.length <= 60;
  const unitsPerPixel = Math.max(
    box.width / pixels.width,
    box.height / pixels.height,
  );
  const radius = unitsPerPixel * (showLabels ? 8 : 4.5);

  function clickCanvas(event) {
    if (!fixedBox || !space.current) return;
    const matrix = space.current.getScreenCTM();
    if (!matrix) return;
    const screen = event.currentTarget.createSVGPoint();
    screen.x = event.clientX;
    screen.y = event.clientY;
    const local = screen.matrixTransform(matrix.inverse());
    if (
      local.x < box.x ||
      local.x > box.x + box.width ||
      local.y < box.y ||
      local.y > box.y + box.height
    )
      return;
    addPoint({ x: Math.round(local.x), y: Math.round(local.y) });
  }

  return (
    <section className="panel rec-panel st-preview">
      <div className="rec-section-head">
        <div>
          <h2>Konturvorschau</h2>
          <p>X nach rechts, Y nach oben. Rasterabstand {mm(step)} mm.</p>
        </div>
      </div>
      <div className="st-preview-tools">
        <button
          className={'btn ' + (fixedBox ? 'st-pressed' : '')}
          aria-pressed={Boolean(fixedBox)}
          onClick={() => setFixedBox(fixedBox ? null : box)}
        >
          <Crosshair size={15} />
          {fixedBox ? 'Setzmodus beenden' : 'Punkte im Raster setzen'}
        </button>
        <label className="rec-check">
          <input
            type="checkbox"
            checked={showSheets}
            onChange={(e) => setShowSheets(e.target.checked)}
          />{' '}
          Blätter zeigen
        </label>
      </div>
      <svg
        className={'st-canvas' + (fixedBox ? ' st-crosshair' : '')}
        ref={canvas}
        viewBox={[box.x, -box.y - box.height, box.width, box.height].join(' ')}
        role="group"
        aria-label="Kontur und Blattaufteilung"
        onClick={clickCanvas}
      >
        <defs>
          <pattern
            id={pattern}
            width={step}
            height={step}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${step} 0 H 0 V ${step}`}
              stroke="#cad6cc"
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth=".8"
            />
          </pattern>
        </defs>
        <g transform="scale(1,-1)" ref={space}>
          <rect
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            fill="#f6f8f4"
          />
          {showSheets &&
            plan.ok &&
            plan.tiles.map((tile) => (
              <rect
                key={tile.row + ':' + tile.column}
                x={tile.minX}
                y={tile.minY}
                width={tile.maxX - tile.minX}
                height={tile.maxY - tile.minY}
                fill="white"
                fillOpacity=".54"
                stroke="#9aada1"
                strokeWidth="1.2"
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          <rect
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            fill={'url(#' + pattern + ')'}
          />
          {box.x <= 0 && box.x + box.width >= 0 && (
            <path d={`M 0 ${box.y} v ${box.height}`} className="st-axis" />
          )}
          {box.y <= 0 && box.y + box.height >= 0 && (
            <path d={`M ${box.x} 0 h ${box.width}`} className="st-axis" />
          )}
          {plan.path ? (
            <path
              d={plan.path}
              className={'st-contour' + (plan.ok ? '' : ' st-draft-line')}
            />
          ) : (
            points.map((point, i) => {
              const next = points[(i + 1) % points.length];
              if (points.length < 2 || !isPoint(point) || !isPoint(next))
                return null;
              const via = isPoint(point.via)
                ? point.via.x + ',' + point.via.y + ' '
                : '';
              return (
                <polyline
                  key={i}
                  points={
                    point.x + ',' + point.y + ' ' + via + next.x + ',' + next.y
                  }
                  className="st-draft-line"
                />
              );
            })
          )}
          {points.map((point, i) => (
            <React.Fragment key={i}>
              {isPoint(point.via) && (
                <circle
                  cx={point.via.x}
                  cy={point.via.y}
                  r={radius * 0.68}
                  fill="#b95b37"
                  stroke="white"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                >
                  <title>Bogen-Zwischenpunkt ab P{i + 1}</title>
                </circle>
              )}
              {isPoint(point) && (
                <g
                  transform={`translate(${point.x},${point.y})`}
                  className="st-marker"
                  role="button"
                  tabIndex={0}
                  aria-label={'Messpunkt ' + (i + 1) + ' auswählen'}
                  aria-pressed={i === active}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActive(i);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setActive(i);
                    }
                  }}
                >
                  <circle
                    r={radius * 1.12}
                    fill={i === active ? '#b95b37' : '#315d49'}
                    stroke="white"
                    strokeWidth="1.3"
                    vectorEffect="non-scaling-stroke"
                  />
                  {(showLabels || i === active) && (
                    <text
                      transform="scale(1,-1)"
                      textAnchor="middle"
                      dy=".34em"
                      fontSize={radius * 1.18}
                      fill="white"
                    >
                      {i + 1}
                    </text>
                  )}
                </g>
              )}
            </React.Fragment>
          ))}
        </g>
      </svg>
      <div className="st-caption">
        <span>
          {fixedBox
            ? 'Klick setzt einen Punkt auf volle Millimeter.'
            : 'Maße und Bogenpunkte lassen sich in der Punktliste bearbeiten.'}
        </span>
        {plan.bounds && (
          <strong>
            {mm(plan.bounds.width)} × {mm(plan.bounds.height)} mm
          </strong>
        )}
      </div>
    </section>
  );
}

function offerPdf(stencil, options, action) {
  const bytes = stencilPdf(stencil, options);
  const label = (stencil.name.trim() || 'Schablone')
    .replace(/[^\p{L}\p{N}._ -]/gu, '-')
    .slice(0, 85);
  const file = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  if (action === 'download')
    link.download = label + ' - 1zu1 ' + options.paper + '.pdf';
  else {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Chromium's PDF viewer may load asynchronously after the new tab opens.
    window.setTimeout(() => URL.revokeObjectURL(url), 300000);
  }
}

function Output({ stencil, plan, options, patch }) {
  const [error, setError] = useState('');
  function emit(action) {
    setError('');
    try {
      offerPdf(stencil, options, action);
    } catch (problem) {
      setError(problem.message || 'Das PDF konnte nicht erzeugt werden.');
    }
  }
  return (
    <section className="panel rec-panel st-output">
      <div className="rec-section-head">
        <div>
          <h2>PDF in Originalgröße</h2>
        </div>
        <Ruler size={20} aria-hidden="true" />
      </div>
      <div className="rec-form-grid">
        <Field
          label="Papierformat"
          value={options.paper}
          change={(paper) => patch({ paper })}
          options={['A4', 'A3']}
        />
        <Field
          label="Ausrichtung"
          value={options.orientation}
          change={(orientation) => patch({ orientation })}
          options={[
            ['portrait', 'Hochformat'],
            ['landscape', 'Querformat'],
          ]}
        />
      </div>
      {plan.ok ? (
        <div className="st-pages" aria-live="polite">
          <Layers size={20} />
          <div>
            <strong>
              {plan.tiles.length}{' '}
              {plan.tiles.length === 1 ? 'Blatt' : 'Blätter'}
            </strong>
            <span>
              {plan.columns} {plan.columns === 1 ? 'Spalte' : 'Spalten'} ×{' '}
              {plan.rows} {plan.rows === 1 ? 'Reihe' : 'Reihen'} ·{' '}
              {mm(plan.overlap)} mm Überlappung
            </span>
          </div>
        </div>
      ) : (
        <div className="st-errors" role="status">
          <strong>Für das Druck-PDF noch offen</strong>
          <ul>
            {plan.errors.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="st-pdf-actions">
        <button
          className="btn primary"
          disabled={!plan.ok}
          onClick={() => emit('view')}
        >
          <ExternalLink size={16} /> PDF zum Drucken öffnen
        </button>
        <button
          className="btn"
          disabled={!plan.ok}
          onClick={() => emit('download')}
        >
          <Download size={16} /> PDF herunterladen
        </button>
      </div>
      <p className="st-print-hint">
        Im PDF-Druckdialog <strong>100 % / Tatsächliche Größe</strong> wählen.
        Am ersten Blatt die waagerechte und die senkrechte Kontrollstrecke
        nachmessen. Beide müssen genau 100 mm lang sein. Mehrere Blätter an den
        Passmarken ausrichten und zusammenkleben.
      </p>
      {error && (
        <p className="rec-alert" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function Editor({ stencil, items, records, update }) {
  const [active, setActive] = useState(0);
  const points = stencil.points;
  const paper = stencil.paper || 'A4',
    orientation = stencil.orientation || 'portrait';
  const options = useMemo(() => ({ paper, orientation }), [paper, orientation]);
  const plan = useMemo(() => planStencil(stencil, options), [stencil, options]);
  const link = items.find((item) => item.id === stencil.itemId);
  const cutRow =
    stencil.cutRef && link
      ? cutPlan(link, records).rows.find(
          (row) => String(row.id) === stencil.cutRef.rowId,
        )
      : null;
  const currentCutLabel = cutRow ? cutLabel(link.name, cutRow.name) : null;
  function patch(changes) {
    update((current) => ({ ...current, ...changes }));
  }
  function updatePoints(transform) {
    update((current) => ({ ...current, points: transform(current.points) }));
  }
  return (
    <>
      <div className="st-name-row">
        <NameField stencil={stencil} save={(name) => patch({ name })} />
        {stencil.cutRef ? (
          <p className="st-note">
            <strong>
              {cutRow ? 'Zuschnittposition' : 'Ursprüngliche Zuschnittposition'}
            </strong>{' '}
            {currentCutLabel || stencil.cutRef.label}.
            {!cutRow && ' Die Position fehlt in der aktuellen Zuschnittliste.'}
            {cutRow &&
              currentCutLabel !== stencil.cutRef.label &&
              ' Beim Aufmaß hieß sie „' + stencil.cutRef.label + '“.'}
          </p>
        ) : (
          stencil.itemId && (
            <p className="st-note">
              Zugeordnetes Bauteil: {link?.name || 'Aus dem Grundriss entfernt'}
              . Die Kontur enthält das gespeicherte Aufmaß.
            </p>
          )
        )}
      </div>
      <div className="st-layout">
        <Preview
          plan={plan}
          points={points}
          active={active}
          setActive={setActive}
          addPoint={(point) => {
            updatePoints((previous) => [...previous, point]);
            setActive(points.length);
          }}
        />
        <Output stencil={stencil} plan={plan} options={options} patch={patch} />
        <PointList
          points={points}
          active={active}
          setActive={setActive}
          update={updatePoints}
        />
      </div>
    </>
  );
}

export default function StencilWorkshop({ items, records, mutate }) {
  const stencils = records.stencils || [];
  const [selectedId, setSelectedId] = useState('');
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState('');
  const selected =
    stencils.find((stencil) => stencil.id === selectedId) || stencils[0];
  const creating = adding || !selected;
  function write(transform) {
    mutate((current) => ({
      ...current,
      stencils: transform(current.stencils || []),
    }));
  }
  function add(stencil) {
    write((previous) => [...previous, stencil]);
    setSelectedId(stencil.id);
    setAdding(false);
    setPendingDelete('');
  }
  function remove() {
    write((previous) =>
      previous.filter((stencil) => stencil.id !== pendingDelete),
    );
    setSelectedId('');
    setPendingDelete('');
  }
  return (
    <div className="st-workshop">
      {selected && (
        <div className="st-library">
          <Field
            label="Gespeicherte Schablonen"
            value={selected.id}
            change={(id) => {
              setSelectedId(id);
              setAdding(false);
              setPendingDelete('');
            }}
            options={stencils.map((stencil) => [stencil.id, stencil.name])}
          />
          <button
            className="btn"
            onClick={() => {
              setAdding(true);
              setPendingDelete('');
            }}
          >
            <Plus size={16} /> Neue Schablone
          </button>
          {!creating && (
            <button
              className="rec-icon-btn"
              aria-label="Ausgewählte Schablone löschen"
              title="Schablone löschen"
              onClick={() => setPendingDelete(selected.id)}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
      {pendingDelete && selected?.id === pendingDelete && (
        <div className="st-delete" role="group" aria-label="Löschen bestätigen">
          <span>„{selected.name}“ aus dem Projekt löschen?</span>
          <button className="btn" onClick={remove}>
            Löschen bestätigen
          </button>
          <button className="rec-text-btn" onClick={() => setPendingDelete('')}>
            Behalten
          </button>
        </div>
      )}
      {creating ? (
        <Creator
          items={items}
          records={records}
          count={stencils.length}
          add={add}
          cancel={selected ? () => setAdding(false) : null}
        />
      ) : (
        <Editor
          key={selected.id}
          stencil={selected}
          items={items}
          records={records}
          update={(transform) => {
            write((previous) =>
              previous.map((stencil) =>
                stencil.id === selected.id ? transform(stencil) : stencil,
              ),
            );
          }}
        />
      )}
    </div>
  );
}
