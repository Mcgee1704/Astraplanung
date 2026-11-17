import React, { useState } from 'react';
import { Check, Snowflake, Trash2, Truck } from 'lucide-react';
import {
  calculate,
  compareTanks,
  vehicleEnvelope,
  withTankVariant,
} from './model.js';
import { accessText } from './Technology.jsx';
import { VehicleFields } from './Journey.jsx';
import {
  Add,
  Grid,
  More,
  N,
  Notice,
  Pane,
  Select,
  Tabs,
  days,
  fmt,
  uid,
} from './shared.jsx';

function ComparisonTable({ columns, rows }) {
  return (
    <div className="sy-scroll">
      <table className="sy-table sy-comparison">
        <thead>
          <tr>
            <th>Merkmal</th>
            {columns.map(([id, name]) => (
              <th key={id}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, values]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {values.map((v, i) => (
                <td key={columns[i][0]}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TankComparison({ model }) {
  const { project, s, patchSystem: ps, edit } = model;
  const options = project.items.filter((it) => it.kind === 'fresh');
  const chosen = options.some((it) => it.id === s.compareTankId)
    ? s.compareTankId
    : options[0]?.id;
  const variants = compareTanks(project, chosen);
  const [applied, setApplied] = useState(null);
  const row = (label, convert) => [label, variants.map(convert)];
  const currentTank = options.find((it) => it.id === chosen);
  const sourceLength = currentTank?.length;
  const sourceEnvelope =
    currentTank &&
    [currentTank.length, currentTank.width, currentTank.height].every(
      (n) => n > 0,
    )
      ? (currentTank.length * currentTank.width * currentTank.height) / 1e6
      : null;
  const rows = [
    row('Standdauer gesamt', (v) => days(v.result.autonomyDays)),
    row('Erster Engpass', (v) => v.result.limiter),
    row('Frischwasser reicht für', (v) => days(v.result.freshDays)),
    row('Grauwassertank voll nach', (v) => days(v.result.greyDays)),
    row('Batteriereserve nach', (v) => days(v.result.electricDays)),
    row('Heizbrennstoff reicht für', (v) => days(v.result.fuelDays)),
    row('Tanklänge im Grundriss', (v) => fmt(v.tank.length, 'mm', 0)),
    row('Belegter Bauraum · äußeres Hüllvolumen', (v) =>
      fmt(v.space.opening.grossVolume, 'l'),
    ),
    row('Bauraumänderung gegenüber aktuellem Tank', (v) =>
      fmt(
        sourceEnvelope === null
          ? null
          : v.space.opening.grossVolume - sourceEnvelope,
        'l',
      ),
    ),
    row('Zusätzliche Länge gegenüber Entwurf', (v) =>
      fmt(
        v.tank.length == null || sourceLength == null
          ? null
          : v.tank.length - sourceLength,
        'mm',
        0,
      ),
    ),
    row('Platz im Fahrzeug', (v) =>
      v.space.inside === null
        ? 'Aufmaß offen'
        : v.space.inside
          ? 'Innerhalb der Innenmaße'
          : 'Überragt die Innenmaße',
    ),
    row('Berührte Einbauräume', (v) =>
      v.space.inside === null
        ? 'Aufmaß offen'
        : v.space.overlaps.join(', ') || 'Keine Überschneidung',
    ),
    row('Wartungszugang', (v) => accessText(v.space)),
    row('Trockenmasse Tank in der Rechnung', (v) => {
      const line = v.result.massDetails.find((it) => it.id === v.tank.id);
      return (
        fmt(line.used, 'kg') +
        (line.measured ? ' · Ist-Messung' : ' · Planansatz')
      );
    }),
    row('Fahrzeugmasse bei Abfahrt', (v) => fmt(v.result.massKg, 'kg')),
    row('Zuladungsreserve', (v) => fmt(v.result.payloadKg, 'kg')),
    row(
      'Vorderachse / Hinterachse',
      (v) => fmt(v.result.frontKg, 'kg') + ' / ' + fmt(v.result.rearKg, 'kg'),
    ),
    row('Verbleibende Hinterachsreserve', (v) =>
      fmt(v.result.rearReserveKg, 'kg'),
    ),
    row('Gesamte Plankosten', (v) => fmt(v.result.costEur, '€', 0)),
    row('Tank im Ausbauplan', (v) => (
      <button
        className="btn"
        onClick={() => {
          edit((p) => withTankVariant(p, v.tank));
          setApplied(v.capacity);
        }}
      >
        <Check size={15} />
        {applied === v.capacity && currentTank?.capacity === v.capacity
          ? 'Übernommen'
          : v.capacity + ' l übernehmen'}
      </button>
    )),
  ];
  return (
    <>
      <Pane
        title="100 oder 150 Liter im Winter"
        icon={Snowflake}
        sub="Beide Entwürfe starten mit vollem Vergleichstank, ohne Fahrt und ohne Landstrom. Alle anderen Vorräte und Verbraucher bleiben auf dem Projektstand."
      >
        <Grid>
          <Select
            label="Frischwassertank im Entwurf"
            value={chosen || ''}
            options={
              options.length
                ? options.map((it) => [it.id, it.name])
                : [['', 'Noch kein Tank']]
            }
            change={(v) => {
              ps({ compareTankId: v });
              setApplied(null);
            }}
          />
          <N
            label="Winterliche Außentemperatur"
            value={s.winterOutsideC}
            min={-100}
            max={80}
            unit="°C"
            change={(v) => ps({ winterOutsideC: v })}
          />
          <N
            label="Winterliche Vollsonnenstunden"
            value={s.winterSolarHours}
            max={24}
            unit="h"
            change={(v) => ps({ winterSolarHours: v })}
          />
        </Grid>
        {variants.length ? (
          <>
            <ComparisonTable
              columns={variants.map((v) => [v.capacity, v.capacity + ' Liter'])}
              rows={rows}
            />
            {!variants[0].result.hasAxleWeights && (
              <Notice>
                Die Ausgangswägungen der Achsen fehlen. Die errechnete
                Gesamtmasse ersetzt diese Messwerte nicht.
              </Notice>
            )}
          </>
        ) : (
          <Notice>
            Der Vergleich benötigt einen eingeplanten Frischwassertank mit
            positivem Nennvolumen. Trage das Volumen in der Wasserplanung ein.
          </Notice>
        )}
        <More title="Annahmen des Vergleichs">
          <p>
            Breite, Höhe und Einbaubeginn X des gewählten Tanks sind fest.
            Länge, Trockenmasse und Planpreis skalieren proportional zum
            Volumen. Der belegte Bauraum ist das äußere Hüllvolumen aus Länge ×
            Breite × Höhe. Der Schwerpunkt sitzt in der Tankmitte. Für den Kauf
            gelten tatsächliche Behältermaße und Herstellerdaten. Die Kosten
            umfassen alle geplanten Einkaufspositionen.
          </p>
          <p>
            Die Ausbauprüfung berücksichtigt lichte Maße, Höhenlage und
            Hindernisse bis zur zugeordneten Wartungsklappe. Absichtlich
            verschachtelte Bauteile, etwa ein Tank unter einem Bett, können im
            Modell dieselbe Hülle belegen. Prüfe den realen Ausschnitt und den
            Zugang am Muster.
          </p>
          <p>
            „Übernehmen“ aktualisiert den Tank mit seiner Modellgröße, seinem
            Preis, seiner Trockenmasse und voller Füllung. Bei einer anderen
            Tankgröße bleiben frühere Ist-Maße und Ist-Masse im Wartungsverlauf
            dokumentiert. In die neue Rechenvariante geht ihr Planansatz ein.
            Das Reiseprofil behält seine eingestellten Werte.
          </p>
        </More>
      </Pane>
    </>
  );
}

function Vehicles({ model }) {
  const { project, s, changeList } = model;
  const options = [
    { id: 'current', vehicle: project.vehicle, current: true },
    ...s.candidates,
  ];
  const results = options.map((opt) =>
    calculate({ ...project, vehicle: opt.vehicle }),
  );
  const map = (label, fn) => [
    label,
    options.map((c, i) => fn(c.vehicle, results[i])),
  ];
  const edit = (id, values) =>
    changeList('candidates', (list) =>
      list.map((c) =>
        c.id === id ? { ...c, vehicle: { ...c.vehicle, ...values } } : c,
      ),
    );
  const add = () =>
    changeList('candidates', (list) => [
      ...list,
      {
        id: uid(),
        vehicle: {
          ...project.vehicle,
          name: 'Kandidat ' + (list.length + 1),
          baseMass: null,
          baseFront: null,
          baseRear: null,
          weighRef: '',
          purchasePrice: null,
        },
      },
    ]);
  const envelope = (v) => {
    const outside = vehicleEnvelope(project, v);
    if (outside === null) return 'Aufmaß offen';
    return outside.length ? outside.join(', ') : 'Alle Bauteile im Baurahmen';
  };
  const rows = [
    map('Angebotspreis Basisfahrzeug', (v) => fmt(v.purchasePrice, '€', 0)),
    map(
      'Innenmaße L × B × H',
      (v) =>
        [v.length, v.width, v.height].map((x) => fmt(x, '', 0)).join(' × ') +
        ' mm',
    ),
    map('Grundriss auf Fahrzeug übertragen', (v) => envelope(v)),
    map('Reisemasse mit gleichem Ausbau', (_, r) => fmt(r.massKg, 'kg')),
    map('Zuladungsreserve', (_, r) => fmt(r.payloadKg, 'kg')),
    map('Reserve Vorderachse', (_, r) => fmt(r.frontReserveKg, 'kg')),
    map('Reserve Hinterachse', (_, r) => fmt(r.rearReserveKg, 'kg')),
    map('Heizlast bei geplanter Temperatur', (_, r) =>
      fmt(r.heatLoadW, 'W', 0),
    ),
    map('Versorgungsengpass', (_, r) => r.limiter),
    map('Kauf und geplanter Ausbau', (v, r) =>
      fmt(
        v.purchasePrice == null || r.costEur == null
          ? null
          : Number(v.purchasePrice) + r.costEur,
        '€',
        0,
      ),
    ),
  ];
  return (
    <Pane
      title="Basisfahrzeuge vor dem Kauf"
      icon={Truck}
      action={<Add action={add}>Fahrzeug ergänzen</Add>}
      sub="Derselbe Ausbau und dasselbe Reiseprofil werden in jedes Fahrzeug eingesetzt. Neue Kandidaten beginnen mit den Maßen des aktuellen Fahrzeugs."
    >
      <ComparisonTable
        columns={options.map((c) => [c.id, c.vehicle.name || 'Fahrzeug'])}
        rows={rows}
      />
      <More title="Angebotspreis des aktuellen Fahrzeugs">
        <Grid>
          <N
            label="Kaufpreis"
            value={project.vehicle.purchasePrice}
            unit="€"
            change={(v) => model.patchVehicle({ purchasePrice: v })}
          />
        </Grid>
      </More>
      {s.candidates.map((c) => (
        <More key={c.id} title={c.vehicle.name || 'Kandidat'}>
          <VehicleFields
            compact
            vehicle={c.vehicle}
            patch={(values) => edit(c.id, values)}
          />
          <Grid>
            <N
              label="Kaufpreis"
              value={c.vehicle.purchasePrice}
              unit="€"
              change={(v) => edit(c.id, { purchasePrice: v })}
            />
          </Grid>
          <button
            className="btn sy-delete"
            onClick={() =>
              changeList('candidates', (list) =>
                list.filter((x) => x.id !== c.id),
              )
            }
          >
            <Trash2 size={15} />
            Kandidat entfernen
          </button>
        </More>
      ))}
    </Pane>
  );
}
export default function Comparison({ model }) {
  const [tab, setTab] = useState('winter');
  return (
    <>
      <Tabs
        label="Varianten vergleichen"
        active={tab}
        set={setTab}
        tabs={[
          ['winter', 'Wintervergleich', Snowflake],
          ['vehicles', 'Fahrzeugkauf', Truck],
        ]}
      />
      {tab === 'winter' ? (
        <TankComparison model={model} />
      ) : (
        <Vehicles model={model} />
      )}
    </>
  );
}
