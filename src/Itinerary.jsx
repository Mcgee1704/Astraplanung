import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Flag,
  Plus,
  Route,
  Trash2,
} from 'lucide-react';
import { newStage, simulateStages } from './itinerary.js';
import { format } from './project.js';
import { UnitField } from './ui.jsx';

const reserves = {
  fresh: 'Frischwasser',
  grey: 'freier Abwasserraum',
  battery: 'Batteriereserve',
  fuel: 'Heizbrennstoff',
  heat: 'Heizleistung',
  warmWater: 'Warmwasserbereitung',
  ac: 'Versorgung der Wechselstromgeräte',
};
const stops = {
  fresh: 'Frischwasser voll',
  grey: 'Grauwasser entleert',
  battery: 'Batterie voll',
  fuel: 'Heizvorrat voll',
};
export default function Itinerary({ project, onChange }) {
  const stages = project.trip.stages || [],
    results = simulateStages(project, stages);
  const [open, setOpen] = useState('');
  const update = (fn) =>
    onChange((p) => ({
      ...p,
      trip: { ...p.trip, stages: fn(p.trip.stages || []) },
    }));
  const patch = (id, change) =>
    update((list) => list.map((s) => (s.id === id ? { ...s, ...change } : s)));
  const add = () => {
    const next = newStage(project.trip, stages.length);
    update((list) => [...list, next]);
    setOpen(next.id);
  };
  const move = (i, delta) =>
    update((list) => {
      const arr = [...list];
      [arr[i], arr[i + delta]] = [arr[i + delta], arr[i]];
      return arr;
    });
  return (
    <section className="panel itinerary">
      <div className="card-heading">
        <h2>
          <Route size={19} />
          Etappen & Nachversorgung
        </h2>
        <button className="btn" onClick={add}>
          <Plus size={15} />
          Etappe
        </button>
      </div>
      <div className="form-body">
        <p className="hint">
          Wasser, Abwasserraum, Batterieladung und Heizvorrat werden von einer
          Etappe zur nächsten fortgeschrieben. Versorgungspunkte gelten jeweils
          bei der Abfahrt.
        </p>
        {!stages.length && (
          <p className="it-empty">
            Lege die erste Etappe mit der geplanten Standdauer an.
          </p>
        )}
        {stages.map((stage, i) => {
          const result = results[i];
          return (
            <div className="it-stage" key={stage.id}>
              <button
                className="it-title"
                onClick={() => setOpen(open === stage.id ? '' : stage.id)}
                aria-expanded={open === stage.id}
              >
                <Flag size={16} />
                <strong>{stage.name || 'Etappe'}</strong>
                <span>{format(stage.days, 1)} Tage</span>
                <ChevronDown size={15} />
              </button>
              <p className={'it-result ' + result.status}>
                {result.status === 'erreicht'
                  ? 'Etappenziel erreichbar · Reisetag ' +
                    format(result.elapsed, 1)
                  : result.status === 'engpass'
                    ? 'Engpass nach ' +
                      format(result.covered, 2) +
                      ' Tagen dieser Etappe · ' +
                      result.limiting.map((k) => reserves[k]).join(', ')
                    : result.status === 'offen'
                      ? 'Offene Angaben für Dauer oder Vorräte · ' +
                        result.limiting.map((k) => reserves[k]).join(', ')
                      : 'Die vorherige Etappe ist noch offen.'}
              </p>
              {open === stage.id && (
                <div className="it-fields">
                  <div className="field-grid">
                    <UnitField
                      type="text"
                      label="Etappenname"
                      value={stage.name}
                      onChange={(v) => patch(stage.id, { name: v })}
                    />
                    <UnitField
                      label="Dauer der Etappe"
                      unit="Tage"
                      value={stage.days}
                      min=".1"
                      step="any"
                      onChange={(v) =>
                        patch(stage.id, { days: v === '' ? null : Number(v) })
                      }
                    />
                  </div>
                  <label>
                    <input
                      type="checkbox"
                      checked={stage.inherit}
                      onChange={(e) =>
                        patch(stage.id, { inherit: e.target.checked })
                      }
                    />{' '}
                    Klima und Ladezeiten aus dem Reiseprofil
                  </label>
                  {!stage.inherit && (
                    <div className="field-grid">
                      {[
                        ['outsideC', 'Außentemperatur', '°C', -100, 80],
                        ['solarHours', 'Vollsonnenstunden', 'h', 0, 24],
                        ['driveHours', 'Fahrt täglich', 'h', 0, 24],
                        ['shoreHours', 'Landstrom täglich', 'h', 0, 24],
                      ].map(([key, label, unit, min, max]) => (
                        <UnitField
                          key={key}
                          label={label}
                          unit={unit}
                          min={min}
                          max={max}
                          step="any"
                          value={stage[key]}
                          onChange={(v) =>
                            patch(stage.id, {
                              [key]: v === '' ? null : Number(v),
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                  <fieldset>
                    <legend>Versorgung vor dieser Etappe</legend>
                    {Object.entries(stops).map(([key, label]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={!!stage[key]}
                          onChange={(e) =>
                            patch(stage.id, { [key]: e.target.checked })
                          }
                        />{' '}
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  {result.end && (
                    <p className="hint">
                      Am berechneten Etappenende verbleiben{' '}
                      {format(result.end.fresh, 1)} l Frischwasser,{' '}
                      {format(result.end.grey, 1)} l freier Grauraum und{' '}
                      {format(result.end.battery)} Wh bis zur Batteriereserve.
                    </p>
                  )}
                  <div className="it-actions">
                    <button
                      className="btn"
                      disabled={i === 0}
                      aria-label="Etappe nach oben"
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="btn"
                      disabled={i === stages.length - 1}
                      aria-label="Etappe nach unten"
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        update((list) => list.filter((s) => s.id !== stage.id))
                      }
                    >
                      <Trash2 size={15} />
                      Entfernen
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
