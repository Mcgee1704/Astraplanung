import React, { useState } from 'react';
import {
  ArrowRight,
  Cable,
  CornerDownRight,
  MapPin,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  canVerifyRoute,
  editRoute,
  endName,
  mediaOptions,
  number,
  routesOf,
  specialEnds,
  uid,
} from './model.js';
import { Field, fmt } from './shared.jsx';

function RouteMap({ route, items, vehicle, edit }) {
  const length = Math.max(1, number(vehicle?.length) || 4200),
    width = Math.max(1, number(vehicle?.width) || 1900);
  const ratio = width / length;
  const height = 600 * ratio + 34;
  const lineWidth = (2 * length) / 600;
  const itemFor = (id) => items.find((item) => String(item.id) === String(id));
  const start = itemFor(route.from),
    end = itemFor(route.to);
  const center = (item) =>
    item && [
      number(item.x) + number(item.length) / 2,
      number(item.y) + number(item.width) / 2,
    ];
  const waypoints = Array.isArray(route.points) ? route.points : [];
  const points = [
    center(start),
    ...waypoints.map((p) => [number(p.x), number(p.y)]),
    center(end),
  ].filter(Boolean);
  function addPoint(event) {
    const svg = event.currentTarget;
    const group = svg.querySelector('[data-coordinates]');
    const matrix = group?.getScreenCTM();
    if (!matrix) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    if (local.x < 0 || local.x > length || local.y < 0 || local.y > width)
      return;
    edit({
      points: [
        ...waypoints,
        { x: Math.round(local.x), y: Math.round(local.y) },
      ],
    });
  }
  return (
    <div className="rec-route-map">
      <div className="rec-route-map-caption">
        <MapPin size={15} />
        <strong>Verlauf in der Draufsicht</strong>
        <span>Front links · rechte Fahrzeugseite oben · mm</span>
      </div>
      <svg
        viewBox={`0 0 626 ${height}`}
        role="img"
        aria-label={
          'Leitungsverlauf ' +
          endName(route.from, items) +
          ' nach ' +
          endName(route.to, items)
        }
        onClick={addPoint}
      >
        <g
          data-coordinates=""
          transform={`translate(13,${height - 17}) scale(${600 / length},${-600 / length})`}
        >
          <rect
            width={length}
            height={width}
            fill="#f0f4ee"
            stroke="#657a6c"
            strokeWidth={lineWidth}
          />
          {items.map((item) => (
            <rect
              key={item.id}
              x={number(item.x)}
              y={number(item.y)}
              width={Math.max(0, number(item.length))}
              height={Math.max(0, number(item.width))}
              fill={item === start || item === end ? '#cbdccf' : 'none'}
              stroke="#b7c4b8"
              strokeWidth={lineWidth / 1.8}
            />
          ))}
          {points.length >= 2 && (
            <polyline
              points={points.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke="#b85631"
              strokeWidth={lineWidth * 1.6}
              strokeLinejoin="round"
              strokeDasharray={
                route.verified ? undefined : `${lineWidth * 3} ${lineWidth * 2}`
              }
            />
          )}
          {points.map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={lineWidth * 2}
              fill="#b85631"
              stroke="white"
              strokeWidth={lineWidth * 0.5}
            />
          ))}
        </g>
      </svg>
      <p>
        Ein Klick im Plan setzt einen Stützpunkt. Endpunkte liegen schematisch
        in der Bauteilmitte. Freie Anschlüsse lassen sich über den Textverlauf
        lokalisieren.
      </p>
      {waypoints.length > 0 && (
        <div className="rec-points">
          {waypoints.map((p, i) => (
            <button
              type="button"
              key={i}
              className="rec-point"
              title="Stützpunkt entfernen"
              aria-label={'Stützpunkt ' + (i + 1) + ' entfernen'}
              onClick={() =>
                edit({ points: waypoints.filter((_, index) => index !== i) })
              }
            >
              {i + 1}. {fmt(p.x)} / {fmt(p.y)} ×
            </button>
          ))}
        </div>
      )}
      <button
        className="rec-text-btn"
        onClick={() =>
          edit({
            points: [
              ...waypoints,
              { x: Math.round(length / 2), y: Math.round(width / 2) },
            ],
          })
        }
      >
        Stützpunkt mittig einsetzen
      </button>
      {waypoints.length > 0 && (
        <div className="rec-coordinates">
          {waypoints.map((p, i) => (
            <div key={i}>
              <Field
                label={'P' + (i + 1) + ' X (mm)'}
                type="number"
                min="0"
                max={length}
                value={p.x}
                change={(x) =>
                  edit({
                    points: waypoints.map((v, n) =>
                      n === i ? { ...v, x } : v,
                    ),
                  })
                }
              />
              <Field
                label={'P' + (i + 1) + ' Y (mm)'}
                type="number"
                min="0"
                max={width}
                value={p.y}
                change={(y) =>
                  edit({
                    points: waypoints.map((v, n) =>
                      n === i ? { ...v, y } : v,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Routes({ project, items, records, mutate }) {
  const [filter, setFilter] = useState('Alle Medien'),
    [id, setId] = useState('');
  const routes = routesOf(items, records),
    filtered = routes.filter(
      (r) => filter === 'Alle Medien' || r.medium === filter,
    );
  const active = filtered.find((route) => route.id === id) ?? filtered[0];
  const ends = [
    ...items.map((item) => [String(item.id), item.name]),
    ...Object.entries(specialEnds),
  ];
  function edit(patch) {
    if (!active) return;
    mutate((r) => editRoute(r, active, patch, items));
  }
  function add() {
    const rid = uid(),
      medium = filter === 'Alle Medien' ? 'Strom' : filter;
    const from = ends[0]?.[0] ?? '@dc',
      to = ends.find(([key]) => key !== from)?.[0] ?? '@air';
    mutate((r) => ({
      ...r,
      extraRoutes: [
        ...r.extraRoutes,
        {
          id: rid,
          medium,
          from,
          to,
          via: '',
          route: '',
          spec: '',
          protection: '',
          verified: false,
          points: [],
        },
      ],
    }));
    setId(rid);
  }
  function remove() {
    mutate((r) =>
      active.automatic
        ? { ...r, hiddenRoutes: [...r.hiddenRoutes, active.id] }
        : {
            ...r,
            extraRoutes: r.extraRoutes.filter(
              (route) => route.id !== active.id,
            ),
          },
    );
  }
  function endOptions(value) {
    return value && !ends.some(([key]) => key === String(value))
      ? [[String(value), 'Bauteil entfernt'], ...ends]
      : ends;
  }
  return (
    <section className="panel rec-panel">
      <div className="rec-section-head">
        <div>
          <h2>Leitungsplan</h2>
          <p>
            Verbinde Bauteile und halte Verlauf, Auslegung und Trennstellen vor
            dem Verkleiden fest.
          </p>
        </div>
        <button className="btn" onClick={add}>
          <Plus size={16} /> Leitungsweg
        </button>
      </div>
      <div className="rec-route-split">
        <aside className="rec-route-list">
          <Field
            label="Medium filtern"
            value={filter}
            change={setFilter}
            options={['Alle Medien', ...mediaOptions]}
          />
          {filtered.map((route) => (
            <button
              type="button"
              key={route.id}
              className={active?.id === route.id ? 'is-active' : ''}
              onClick={() => setId(route.id)}
            >
              <small>
                {route.medium} ·{' '}
                {route.missing
                  ? 'Anschluss fehlt'
                  : route.verified
                    ? 'Geprüft'
                    : 'Entwurf'}
              </small>
              <strong>{endName(route.from, items)}</strong>
              <span>
                <CornerDownRight size={13} /> {endName(route.to, items)}
              </span>
            </button>
          ))}
          {!filtered.length && (
            <p className="rec-foot">
              Für dieses Medium ist kein Verlauf erfasst.
            </p>
          )}
          {records.hiddenRoutes.length > 0 && (
            <button
              className="rec-text-btn"
              onClick={() => mutate((r) => ({ ...r, hiddenRoutes: [] }))}
            >
              Standardwege einblenden
            </button>
          )}
        </aside>
        {active ? (
          <div className="rec-route-detail">
            <div className="rec-connection">
              <Cable size={17} />
              <strong>{endName(active.from, items)}</strong>
              <ArrowRight size={16} />
              <strong>{endName(active.to, items)}</strong>
            </div>
            {(active.missing || active.from === active.to) && (
              <p className="rec-alert">
                Zwei vorhandene, unterschiedliche Anschlüsse wählen.
              </p>
            )}
            <div className="rec-form-grid">
              <Field
                label="Medium"
                value={active.medium}
                change={(medium) => {
                  edit({ medium });
                  setFilter('Alle Medien');
                }}
                options={mediaOptions}
              />
              <Field
                label="Start"
                value={active.from}
                change={(from) => edit({ from })}
                options={endOptions(active.from)}
              />
              <Field
                label="Ziel"
                value={active.to}
                change={(to) => edit({ to })}
                options={endOptions(active.to)}
              />
              <Field
                label="Zwischenstation"
                value={active.via}
                placeholder="z. B. Verteiler im Heck"
                change={(via) => edit({ via })}
              />
              <Field
                label="Leitung / Auslegung"
                value={active.spec}
                placeholder="Bezeichnung aus der Fachplanung"
                change={(spec) => edit({ spec })}
              />
              <Field
                label="Sicherung / Trenn- oder Absperrstelle"
                value={active.protection}
                placeholder="Kennung und tatsächlicher Ort"
                change={(protection) => edit({ protection })}
              />
            </div>
            <Field
              label="Weg durchs Fahrzeug"
              long
              value={active.route}
              placeholder="Durchführungen, Verlegehöhe und Zugang beschreiben"
              change={(route) => edit({ route })}
            />
            <RouteMap
              route={active}
              vehicle={project.vehicle}
              items={items}
              edit={edit}
            />
            <div className="rec-action-row">
              <label className="rec-check">
                <input
                  type="checkbox"
                  disabled={!canVerifyRoute(active, items)}
                  checked={Boolean(active.verified)}
                  onChange={(e) => edit({ verified: e.target.checked })}
                />{' '}
                Am Fahrzeug geprüft
              </label>
              <button className="rec-text-btn" onClick={remove}>
                <Trash2 size={14} /> Leitungsweg entfernen
              </button>
            </div>
            {!canVerifyRoute(active, items) && (
              <p className="rec-foot">
                Für den Prüfvermerk zwei vorhandene Anschlüsse und einen Wegtext
                oder Stützpunkt erfassen.
              </p>
            )}
            <p className="rec-foot">
              Standardwege sind Vorschläge aus dem aktuellen Grundriss.
              Kennwerte und Absicherung aus der jeweiligen Geräte- und
              Anlagenplanung übernehmen.
            </p>
          </div>
        ) : (
          <p className="rec-empty">
            Ergänze einen Weg, um Start, Ziel und Verlauf zu dokumentieren.
          </p>
        )}
      </div>
    </section>
  );
}
