import React, { useId, useState } from 'react';
import { Gauge, Plus, Scale, Trash2, Truck } from 'lucide-react';
import {
  Check,
  Grid,
  Metrics,
  More,
  Pane,
  Tabs,
  Txt,
  uid,
} from '../systems/shared.jsx';
import {
  discardWheelAxle,
  makeWheelWeighing,
  parseWeighNumber,
  wheelInputText,
  wheelKeys,
  wheelTotals,
} from './wheel-weighing.js';
import './wheel-weighing.css';

const groupNames = { travel: 'Reisefertig', baseline: 'Ausgangswägung' };
const summaryNumber = new Intl.NumberFormat('de-DE', {
  useGrouping: false,
  maximumFractionDigits: 3,
});
const mass = (value) =>
  value == null ? 'offen' : summaryNumber.format(value) + ' kg';

function Reading({ label, name, value, unit = 'kg', onValue, signed = false }) {
  const [draft, setDraft] = useState(null);
  const errorId = useId();
  const raw = draft ?? wheelInputText(value);
  const parsed = parseWeighNumber(raw, signed);
  return (
    <label className="field sy-field rw-reading">
      <span>{label}</span>
      <span className="sy-inputunit">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          name={name}
          aria-label={label}
          aria-invalid={!parsed.valid}
          aria-describedby={!parsed.valid ? errorId : undefined}
          placeholder="offen"
          value={raw}
          onChange={(e) => {
            const text = e.target.value,
              next = parseWeighNumber(text, signed);
            setDraft(text);
            if (next.valid && value !== next.value) onValue(next.value);
          }}
          onBlur={() => {
            if (parsed.valid) setDraft(null);
          }}
        />
        <small>{unit}</small>
      </span>
      {!parsed.valid && (
        <small id={errorId} className="rw-error">
          Dezimalzahl eingeben. Gespeicherter Wert:{' '}
          {value == null ? 'offen' : wheelInputText(value) + ' ' + unit}.
        </small>
      )}
    </label>
  );
}
function wheelLabel(axle, side, key) {
  const left = side === 'left';
  let position = axle.name + (left ? ' links' : ' rechts');
  if (axle.id === 'front' && axle.name === 'Vorderachse')
    position = left ? 'Vorne links (VL)' : 'Vorne rechts (VR)';
  if (axle.id === 'rear' && axle.name === 'Hinterachse')
    position = left ? 'Hinten links (HL)' : 'Hinten rechts (HR)';
  if (key.endsWith('.inner')) position += ' innen';
  if (key.endsWith('.outer')) position += ' außen';
  return position;
}

function WheelAxles({ weighing, mutate }) {
  const [pending, setPending] = useState('');
  const update = (id, patch) =>
    mutate((w) => ({
      ...w,
      axles: w.axles.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  const remove = (id) => {
    mutate((w) => discardWheelAxle(w, id));
    setPending('');
  };
  return (
    <More title="Achsen und Bereifung anpassen">
      {weighing.axles.map((axle) => (
        <div key={axle.id} className="rw-axle-config">
          <span>
            {axle.id === 'front' || axle.id === 'rear' ? (
              <strong>{axle.name}</strong>
            ) : (
              <Txt
                label="Bezeichnung der Zusatzachse"
                value={axle.name}
                change={(name) => update(axle.id, { name })}
              />
            )}
          </span>
          <Check
            label={'Zwillingsbereifung · ' + axle.name}
            value={axle.dual}
            change={(dual) => update(axle.id, { dual })}
          />
          {!['front', 'rear'].includes(axle.id) &&
            (pending === axle.id ? (
              <span className="rw-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => remove(axle.id)}
                >
                  Achse und Messwerte löschen
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPending('')}
                >
                  Abbrechen
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn sy-delete"
                onClick={() => {
                  const hasValues = [weighing.travel, weighing.baseline].some(
                    (g) =>
                      Object.keys(g.values).some(
                        (k) =>
                          k.startsWith(axle.id + '.') && g.values[k] != null,
                      ),
                  );
                  if (hasValues) setPending(axle.id);
                  else remove(axle.id);
                }}
              >
                <Trash2 size={14} />
                Achse entfernen
              </button>
            ))}
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() =>
          mutate((w) => ({
            ...w,
            axles: [
              ...w.axles,
              { id: uid(), name: 'Achse ' + (w.axles.length + 1), dual: false },
            ],
          }))
        }
      >
        <Plus size={15} />
        Weitere Achse
      </button>
      <p>
        Bei Zwillingsbereifung wird jedes innere und äußere Rad einzeln gewogen.
        Messungen für Einzel- und Zwillingsreifen bleiben je Konfiguration
        getrennt gespeichert. Beide Messreihen verwenden dieselben Achsen.
      </p>
    </More>
  );
}

function IncludedWeights({ weighing, positions, mutate }) {
  const [selected, setSelected] = useState('');
  const included = weighing.baseline.included;
  const remaining = positions.filter(
    (p) => !included.some((it) => it.id === p.id),
  );
  const change = (fn) =>
    mutate((w) => ({
      ...w,
      baseline: { ...w.baseline, included: fn(w.baseline.included) },
    }));
  const patch = (id, value) =>
    change((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...value } : row)),
    );
  return (
    <More title={'Bei der Ausgangswägung bereits an Bord · ' + included.length}>
      <p>
        Erfasse hier Ausbau, Personen oder Vorräte, die auf der Waage standen
        und im Reiseplan erneut hinzukommen. Ihre Masse und Längsposition zum
        Wägezeitpunkt werden einmal abgezogen. Bestandteile des Grundfahrzeugs
        bleiben in seiner Basismasse.
      </p>
      <div className="rw-add-weight">
        <label className="field sy-field">
          <span>Bereits gewogene Position</span>
          <select
            aria-label="Bereits gewogene Position"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Position wählen</option>
            {remaining.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} · {mass(it.kg)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn"
          disabled={!remaining.some((it) => it.id === selected)}
          onClick={() => {
            const item = remaining.find((x) => x.id === selected);
            if (item)
              change((rows) =>
                rows.some((other) => other.id === item.id)
                  ? rows
                  : [...rows, { ...item }],
              );
            setSelected('');
          }}
        >
          <Plus size={15} />
          Als gewogen erfassen
        </button>
      </div>
      {included.map((entry) => (
        <div className="rw-included" key={entry.id}>
          <strong>{entry.name}</strong>
          <Reading
            label={'Mitgewogene Masse · ' + entry.name}
            value={entry.kg}
            onValue={(kg) => patch(entry.id, { kg })}
          />
          <Reading
            label={'Schwerpunkt X bei Wägung · ' + entry.name}
            unit="mm"
            signed
            value={entry.x}
            onValue={(x) => patch(entry.id, { x })}
          />
          <button
            type="button"
            className="btn"
            aria-label={'Zuordnung entfernen · ' + entry.name}
            onClick={() =>
              change((rows) => rows.filter((it) => it.id !== entry.id))
            }
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {included.length > 0 && (
        <p>
          Die Eingabewerte sind Kopien vom Messzeitpunkt. Ein abweichendes
          tatsächliches Gewicht oder eine andere Position kann hier eingetragen
          werden.
        </p>
      )}
    </More>
  );
}

export default function WheelWeighing({ model, r }) {
  const { project, edit } = model;
  const weighing = project.vehicle.wheelWeighing || makeWheelWeighing();
  const [mode, setMode] = useState('travel'),
    [clearing, setClearing] = useState(false);
  const group = weighing[mode],
    totals = wheelTotals(weighing, mode);
  const mutate = (fn) =>
    edit((p) => ({
      ...p,
      vehicle: {
        ...p.vehicle,
        wheelWeighing: fn(p.vehicle.wheelWeighing || makeWheelWeighing()),
      },
    }));
  const patch = (values) =>
    mutate((w) => ({ ...w, [mode]: { ...w[mode], ...values } }));
  const read = (key, value) =>
    mutate((w) => {
      const values = { ...w[mode].values };
      if (value === null) delete values[key];
      else values[key] = value;
      return { ...w, [mode]: { ...w[mode], values } };
    });
  const multi = weighing.axles.length > 2;
  return (
    <div id="radlasten">
      <Pane title="Radlasten wiegen" icon={Scale}>
        <Tabs
          label="Wägezustand"
          active={mode}
          set={(m) => {
            setMode(m);
            setClearing(false);
          }}
          tabs={[
            ['travel', 'Reisefertig', Truck],
            ['baseline', 'Ausgangswägung', Gauge],
          ]}
        />
        <p className="sy-caption">
          {mode === 'travel'
            ? 'Trage die tatsächlichen Waagenwerte des beladenen Fahrzeugs ein. Diese Messreihe dokumentiert den Reisestand. Die Ausbauprognose wird separat aus ihren Ausgangswerten berechnet.'
            : 'Erfasse die Radmesswerte am Ausgangsfahrzeug. Unter „Bereits an Bord“ lassen sich mitgewogene Personen, Vorräte und Ausbauteile für die Prognose berücksichtigen.'}
        </p>
        <p className="sy-caption">
          Komma und Einzelpunkt trennen Nachkommastellen. 701.750 entspricht
          701,75 kg. Tausender kannst du als 1234 oder mit Dezimalkomma als
          1.234,5 eingeben.
        </p>
        <div className="rw-axes" key={mode}>
          {weighing.axles.map((axle, i) => (
            <fieldset key={axle.id} className="rw-axle">
              <legend>{axle.name || 'Achse ' + (i + 1)}</legend>
              <div className="rw-sides">
                {['left', 'right'].map((side) => (
                  <div key={side}>
                    {wheelKeys(axle, side).map((key) => (
                      <Reading
                        key={key}
                        name={'wheel.' + mode + '.' + key}
                        value={group.values[key]}
                        label={wheelLabel(axle, side, key)}
                        onValue={(v) => read(key, v)}
                      />
                    ))}
                    {axle.dual && (
                      <small>
                        Radpaar {side === 'left' ? 'links' : 'rechts'}{' '}
                        <b>{mass(totals.axles[i][side + 'Kg'])}</b>
                      </small>
                    )}
                  </div>
                ))}
              </div>
              <div className="rw-axle-total">
                <span>Achse gesamt</span>
                <strong>{mass(totals.axles[i].totalKg)}</strong>
              </div>
            </fieldset>
          ))}
        </div>
        <Metrics
          rows={[
            ['Links gemessen', mass(totals.leftKg)],
            ['Rechts gemessen', mass(totals.rightKg)],
            ['Gesamt gemessen', mass(totals.totalKg)],
          ]}
        />
        <p className="sy-caption" aria-live="polite">
          {totals.measured} von {totals.required} Radlasten erfasst. Summen
          erscheinen, sobald die zugehörigen Räder vollständig gewogen sind.
        </p>
        <Grid two>
          <label className="field sy-field">
            <span>Wägedatum</span>
            <input
              aria-label="Wägedatum"
              type="date"
              value={group.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </label>
          <Txt
            label="Wiegezustand / Beleg"
            value={group.note}
            change={(note) => patch({ note })}
            placeholder="Tankstände, Besatzung oder Wiegeschein"
          />
        </Grid>
        {mode === 'baseline' && (
          <>
            <IncludedWeights
              weighing={weighing}
              positions={r.weighingPositions}
              mutate={mutate}
            />
            <Check
              label="Ausgangswägung als Basis der Prognose verwenden"
              value={weighing.useBaseline}
              disabled={totals.totalKg === null && !weighing.useBaseline}
              change={(useBaseline) => mutate((w) => ({ ...w, useBaseline }))}
            />
            {totals.totalKg === null && (
              <p className="sy-caption">
                {weighing.useBaseline
                  ? 'Die aktive Ausgangswägung ist unvollständig. Die daraus abgeleitete Prognose bleibt offen.'
                  : 'Nach vollständiger Wägung kannst du diese Messreihe als Rechenbasis auswählen.'}
              </p>
            )}
            {multi && (
              <p className="sy-caption">
                Bei mehr als zwei Achsen kann der vollständige Messsatz die
                Gesamtmassenprognose speisen. Die tatsächlichen Einzelachslasten
                stehen oben.
              </p>
            )}
          </>
        )}
        <WheelAxles weighing={weighing} mutate={mutate} />
        {Object.values(group.values).some((v) => v != null) && (
          <div className="rw-actions rw-clear">
            {clearing ? (
              <>
                <span>
                  Alle Radmesswerte der Reihe „{groupNames[mode]}“ löschen?
                </span>
                <button
                  className="btn sy-delete"
                  onClick={() => {
                    patch({ values: {} });
                    setClearing(false);
                  }}
                >
                  Messwerte löschen
                </button>
                <button className="btn" onClick={() => setClearing(false)}>
                  Abbrechen
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => setClearing(true)}
              >
                <Trash2 size={14} />
                Messreihe leeren
              </button>
            )}
          </div>
        )}
      </Pane>
    </div>
  );
}
