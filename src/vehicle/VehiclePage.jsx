import { useState } from 'react';
import { Ruler, Truck, Weight, Save } from 'lucide-react';
import { format, makeVehicle, vehiclePresets } from '../project.js';
import { UnitField } from '../ui.jsx';

const dimensions = [
  ['length', 'Innenlänge'],
  ['width', 'Innenbreite'],
  ['height', 'Innenhöhe'],
  ['wheelbase', 'Radstand'],
  ['frontAxleX', 'Vorderachse relativ zur vorderen Innenwand'],
];
const weights = [
  ['maxMass', 'Zulässige Gesamtmasse'],
  ['baseMass', 'Grundmasse vor Ausbau'],
  ['frontMax', 'Zulässige Vorderachslast'],
  ['rearMax', 'Zulässige Hinterachslast'],
  ['baseFront', 'Vorderachse gewogen'],
  ['baseRear', 'Hinterachse gewogen'],
];
function ProfileDiagram({ vehicle }) {
  const wheelbase = Number(vehicle.wheelbase),
    front = Number(vehicle.frontAxleX),
    len = Number(vehicle.length);
  const valid =
    [wheelbase, front, len].every(Number.isFinite) && len > 0 && wheelbase > 0;
  if (!valid) return null;
  const min = Math.min(front - 600, 0),
    max = Math.max(len + 400, front + wheelbase + 400),
    scale = (450 - 38) / (max - min),
    x = (n) => 18 + (n - min) * scale;
  const rear = front + wheelbase,
    cabin = x(0);
  return (
    <svg
      viewBox="0 0 465 132"
      role="img"
      aria-label="Längsschnitt mit Innenlänge und Achspositionen"
      className="vehicle-diagram"
    >
      <defs>
        <pattern
          id="vehicle-grid"
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r=".7" fill="#c7d3c6" />
        </pattern>
      </defs>
      <rect width="465" height="132" fill="url(#vehicle-grid)" />
      <path
        d={
          'M' +
          x(min + 100) +
          ' 80 V65 L' +
          (cabin - 16) +
          ' 39 Q' +
          (cabin - 12) +
          ' 34 ' +
          cabin +
          ' 34 H' +
          x(len - 30) +
          ' Q' +
          x(len + 100) +
          ' 34 ' +
          x(len + 120) +
          ' 45 V81 Z'
        }
        fill="#e8eee3"
        stroke="#637e67"
        strokeWidth="1.7"
      />
      <path
        d={'M' + cabin + ' 35V81M' + (cabin - 6) + ' 42l-2 17h-27l13-17z'}
        fill="#cdded8"
        stroke="#778e7c"
      />
      {[front, rear].map((v, i) => (
        <g key={i}>
          <circle
            cx={x(v)}
            cy="80"
            r="13"
            fill="#365345"
            stroke="#fafaf3"
            strokeWidth="3"
          />
          <circle cx={x(v)} cy="80" r="5" fill="#c7d4c8" />
          <line x1={x(v)} x2={x(v)} y1="95" y2="111" stroke="#7d9083" />
        </g>
      ))}
      <path d={'M' + x(front) + ' 105H' + x(rear)} stroke="#7d9083" />
      <text x={(x(front) + x(rear)) / 2} y="123" textAnchor="middle">
        Radstand {format(wheelbase)} mm
      </text>
      <path
        d={'M' + cabin + ' 26V16m0 5H' + x(len) + 'm0 -5v10'}
        fill="none"
        stroke="#879989"
      />
      <text x={(cabin + x(len)) / 2} y="13" textAnchor="middle">
        {format(len)} mm innen
      </text>
    </svg>
  );
}
export default function VehiclePage({ project, onChange }) {
  const [draft, setDraft] = useState(() => ({ ...project.vehicle })),
    [preset, setPreset] = useState(''),
    [feedback, setFeedback] = useState('');
  const set = (k, v) => {
    setFeedback('Ungespeicherte Änderungen');
    setDraft((d) => ({ ...d, [k]: v }));
  };
  const save = (e) => {
    e.preventDefault();
    const vehicle = { ...draft };
    for (const [key] of [...dimensions, ...weights]) {
      const raw = draft[key];
      vehicle[key] = raw === '' || raw == null ? null : Number(raw);
    }
    onChange((prev) => ({ ...prev, vehicle }));
    setFeedback('Fahrzeugdaten gespeichert');
  };
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Fahrzeug & Aufmaß</h1>
          <p>Maße und Gewichte des Basisfahrzeugs für alle Ausbauvarianten.</p>
        </div>
      </header>
      <form className="vehicle-form" onSubmit={save}>
        <section className="panel form-panel">
          <div className="card-heading">
            <h2>
              <Truck size={20} /> Basisfahrzeug
            </h2>
          </div>
          <div className="form-body">
            <div className="preset-input">
              <label className="field">
                <span>Fahrzeugvorlage</span>
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                >
                  <option value="">Eigene Fahrzeugdaten</option>
                  {Object.entries(vehiclePresets).map(([id, v]) => (
                    <option key={id} value={id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn"
                disabled={!preset}
                onClick={() => {
                  setDraft(makeVehicle(preset));
                  setFeedback(
                    'Beispielwerte im Formular. Zum Übernehmen speichern.',
                  );
                }}
              >
                Beispielwerte einsetzen
              </button>
            </div>
            <div className="field-grid">
              <UnitField
                label="Fahrzeugbezeichnung"
                type="text"
                value={draft.name}
                onChange={(v) => set('name', v)}
                required
                maxLength={100}
              />
              <UnitField
                label="Aufbauform"
                type="text"
                value={draft.kind}
                onChange={(v) => set('kind', v)}
                required
                maxLength={100}
              />
            </div>
          </div>
        </section>
        <div className="vehicle-columns">
          <section className="panel form-panel">
            <div className="card-heading">
              <h2>
                <Ruler size={19} /> Innenraum & Fahrwerk
              </h2>
            </div>
            <div className="form-body">
              <ProfileDiagram vehicle={draft} />
              <div className="field-grid">
                {dimensions.map(([key, label]) => (
                  <UnitField
                    key={key}
                    label={label}
                    value={draft[key]}
                    unit="mm"
                    onChange={(v) => set(key, v)}
                    min={key === 'frontAxleX' ? undefined : 1}
                    step="any"
                    required={['length', 'width', 'height'].includes(key)}
                  />
                ))}
              </div>
              <p className="hint">
                Der Nullpunkt liegt an der vorderen Innenwand. Positionen zum
                Heck sind positiv.
              </p>
            </div>
          </section>
          <section className="panel form-panel">
            <div className="card-heading">
              <h2>
                <Weight size={19} /> Gewichte & Wägedaten
              </h2>
            </div>
            <div className="form-body">
              <div className="field-grid">
                {weights.map(([key, label]) => (
                  <UnitField
                    key={key}
                    label={label}
                    value={draft[key]}
                    unit="kg"
                    onChange={(v) => set(key, v)}
                    min={0}
                    step="any"
                    placeholder="offen"
                  />
                ))}
              </div>
              <p className="hint">
                Beide Achsen im selben Ausgangszustand wiegen. Personen, Gepäck
                und Ausbau erfasst du separat. Die Startwerte sind
                Planungsannahmen.
              </p>
              <UnitField
                label="Quelle / Wiegezustand"
                type="text"
                value={draft.weighRef ?? draft.measurement ?? ''}
                onChange={(v) => set('weighRef', v)}
                placeholder="z. B. Wiegeschein, Tankfüllung und Datum"
              />
            </div>
          </section>
        </div>
        <section className="panel form-panel">
          <div className="form-body">
            <label className="field">
              <span>Aufmaßnotizen</span>
              <textarea
                rows="3"
                value={draft.notes || ''}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Radkästen, Dachverjüngung, Ausstattung …"
              />
            </label>
            <div className="form-actions">
              <span role="status">{feedback}</span>
              <button className="btn primary" type="submit">
                <Save size={16} />
                Fahrzeugdaten speichern
              </button>
            </div>
          </div>
        </section>
      </form>
    </>
  );
}
