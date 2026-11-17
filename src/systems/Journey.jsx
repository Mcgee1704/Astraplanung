import React from 'react';
import {
  Backpack,
  CalendarDays,
  CircleGauge,
  Compass,
  Gauge,
  MapPin,
  Scale,
  Truck,
  Users,
} from 'lucide-react';
import { seasons } from './model.js';
import WheelWeighing from '../vehicle/WheelWeighing.jsx';
import {
  fmt,
  days,
  Grid,
  Metrics,
  Ledger,
  More,
  N,
  Notice,
  Pane,
  Percent,
  Select,
  Txt,
} from './shared.jsx';
const set = (fn, k) => (v) => fn({ [k]: v });

function RangeBars({ r, daysWanted }) {
  const validTarget = typeof daysWanted === 'number' && daysWanted > 0;
  const max = validTarget
    ? daysWanted
    : Math.max(1, ...r.limits.map(([, v]) => (Number.isFinite(v) ? v : 0)));
  return (
    <div className="sy-ranges">
      {r.limits
        .filter(([l]) => !['Heizleistung', 'Warmwasserbereitung'].includes(l))
        .map(([l, value]) => (
          <div key={l}>
            <div>
              <span>{l}</span>
              <strong>{days(value)}</strong>
            </div>
            <span className="sy-track">
              <i
                className={Number.isFinite(value) && value < max ? 'short' : ''}
                style={{
                  width:
                    Math.max(
                      0,
                      Math.min(
                        100,
                        ((value === Infinity ? max : (value ?? 0)) / max) * 100,
                      ),
                    ) + '%',
                }}
              />
            </span>
          </div>
        ))}
    </div>
  );
}

export function Journey({ model, r }) {
  const { t, patchTrip: pt } = model;
  const desired = t.days;
  const meets =
    r.autonomyDays == null || desired == null
      ? null
      : r.autonomyDays >= desired;
  return (
    <>
      <Pane title="Standdauer am Reiseziel" icon={Compass}>
        <Metrics
          rows={[
            ['Gewünschte Autarkie', days(desired), CalendarDays],
            ['Berechnete Standdauer', days(r.autonomyDays), Gauge],
            ['Erster Engpass', r.limiter, Compass],
          ]}
        />
        <RangeBars r={r} daysWanted={desired} />
        {meets === false && (
          <Notice>
            {r.limiter} begrenzt die geplante Standdauer. Mehr Vorrat in einem
            anderen System verlängert sie erst, wenn dieser Engpass gelöst ist.
          </Notice>
        )}
        {r.heatShortfall && (
          <Notice>
            Für die gewünschten Temperaturen reicht die angenommene Heizleistung
            rechnerisch nicht aus.
          </Notice>
        )}
        {r.autonomyDays === null && (
          <Notice>
            Mindestens eine Voraussetzung der Autarkieberechnung ist offen.
            Prüfe die Einzelwerte in der Bordtechnik.
          </Notice>
        )}
      </Pane>
      <Pane title="Reiseprofil" icon={MapPin}>
        <Grid>
          <Txt
            label="Reisegebiet"
            value={t.region}
            placeholder="z. B. Alpenraum"
            change={set(pt, 'region')}
          />
          <Select
            label="Jahreszeit"
            value={t.season}
            options={Object.keys(seasons)}
            change={(v) => pt({ season: v, ...seasons[v] })}
          />
          <N
            label="Gewünschte Tage ohne Versorgung"
            value={desired}
            step={0.5}
            unit="Tage"
            change={set(pt, 'days')}
          />
          <N
            label="Reisende"
            value={t.people}
            whole
            change={set(pt, 'people')}
          />
          <N
            label="Wasser je Person und Tag"
            value={t.waterPerPerson}
            unit="l"
            change={set(pt, 'waterPerPerson')}
          />
          <Percent
            label="Anteil als Grauwasser"
            value={t.greyFraction}
            change={set(pt, 'greyFraction')}
          />
          <N
            label="Außentemperatur"
            value={t.outsideC}
            min={-100}
            max={80}
            unit="°C"
            change={set(pt, 'outsideC')}
          />
          <N
            label="Vollsonnenstunden pro Tag"
            value={t.solarHours}
            max={24}
            unit="h"
            change={set(pt, 'solarHours')}
          />
          <N
            label="Fahrzeit pro Tag"
            value={t.driveHours}
            max={24}
            unit="h"
            change={set(pt, 'driveHours')}
          />
          <N
            label="Landstrom pro Tag"
            value={t.shoreHours}
            max={24}
            unit="h"
            change={set(pt, 'shoreHours')}
          />
          <N
            label="Ausbaubudget"
            value={t.budget}
            unit="€"
            change={set(pt, 'budget')}
          />
        </Grid>
        <p className="sy-caption">
          Eine Jahreszeit setzt Startwerte für Sonne und Außentemperatur.
          Ersetze sie durch Werte für Route, Monat, Höhe und Stellplatz.
        </p>
      </Pane>
      <Pane title="Versorgung unterwegs" icon={Backpack}>
        <Grid two>
          <Txt
            area
            label="Etappen und Versorgungsstellen"
            value={t.route}
            placeholder="Längste Etappe, Wasser nachfüllen, Abwasser entsorgen, Brennstoff nachfassen"
            change={set(pt, 'route')}
          />
          <Txt
            area
            label="Wartung und Ersatz unterwegs"
            value={t.notes}
            placeholder="Werkstätten, Ersatzteile, Höhe, Zollunterlagen und Kontakt vor Ort"
            change={set(pt, 'notes')}
          />
        </Grid>
      </Pane>
    </>
  );
}

export function VehicleFields({ vehicle: v, patch, compact = false }) {
  return (
    <Grid>
      <Txt
        label="Fahrzeugbezeichnung"
        value={v.name}
        change={set(patch, 'name')}
      />
      <N
        label="Innenlänge"
        value={v.length}
        unit="mm"
        change={set(patch, 'length')}
      />
      <N
        label="Innenbreite"
        value={v.width}
        unit="mm"
        change={set(patch, 'width')}
      />
      <N
        label="Innenhöhe"
        value={v.height}
        unit="mm"
        change={set(patch, 'height')}
      />
      <N
        label="Zulässige Gesamtmasse"
        value={v.maxMass}
        unit="kg"
        change={set(patch, 'maxMass')}
      />
      <N
        label="Basismasse vor Ausbau"
        value={v.baseMass}
        unit="kg"
        change={set(patch, 'baseMass')}
      />
      <N
        label="Radstand"
        value={v.wheelbase}
        unit="mm"
        change={set(patch, 'wheelbase')}
      />
      <N
        label="Lage der Vorderachse X"
        value={v.frontAxleX}
        unit="mm"
        min={-20000}
        change={set(patch, 'frontAxleX')}
      />
      <N
        label="Zulässige Vorderachslast"
        value={v.frontMax}
        unit="kg"
        change={set(patch, 'frontMax')}
      />
      <N
        label="Zulässige Hinterachslast"
        value={v.rearMax}
        unit="kg"
        change={set(patch, 'rearMax')}
      />
      <N
        label="Gewogene Vorderachse vor Ausbau"
        value={v.baseFront}
        unit="kg"
        change={set(patch, 'baseFront')}
      />
      <N
        label="Gewogene Hinterachse vor Ausbau"
        value={v.baseRear}
        unit="kg"
        change={set(patch, 'baseRear')}
      />
      {!compact && (
        <Txt
          label="Beleg der Ausgangswägung"
          value={v.weighRef}
          placeholder="Datum, Belegnummer, Tankfüllung"
          change={set(patch, 'weighRef')}
        />
      )}
    </Grid>
  );
}
export function Weight({ model, r }) {
  const { project, t, patchTrip: pt, patchVehicle } = model;
  const v = project.vehicle;
  const columns = [
    ['Gesamtfahrzeug', r.massKg, v.maxMass, r.payloadKg],
    ['Vorderachse', r.frontKg, v.frontMax, r.frontReserveKg],
    ['Hinterachse', r.rearKg, v.rearMax, r.rearReserveKg],
  ];
  return (
    <>
      <WheelWeighing model={model} r={r} />
      <Pane
        title="Reisefertige Masse"
        icon={Scale}
        sub={
          r.wheelBaseline
            ? 'Prognose auf Basis der gewählten Radwägung am Ausgangsfahrzeug.'
            : 'Prognose aus Basisfahrzeug, Ausbau und Reisebeladung.'
        }
      >
        <Metrics
          rows={[
            ['Masse bei Abfahrt', fmt(r.massKg, 'kg'), Truck],
            ['Verbleibende Zuladung', fmt(r.payloadKg, 'kg'), Scale],
            ['Davon Wasser an Bord', fmt(r.fluidKg, 'kg'), CircleGauge],
          ]}
        />
        <div className="sy-scroll">
          <table className="sy-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Rechenwert</th>
                <th>Zulässig</th>
                <th>Reserve</th>
              </tr>
            </thead>
            <tbody>
              {columns.map(([name, weight, max, free]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{fmt(weight, 'kg')}</td>
                  <td>{fmt(max, 'kg')}</td>
                  <td className={free != null && free < 0 ? 'sy-negative' : ''}>
                    {fmt(free, 'kg')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.multiAxle && (
          <Notice>
            Bei mehr als zwei Achsen zeigt die Radwägung die tatsächliche Last
            jeder Achse. Die Längsschwerpunktrechnung gilt für Zweiachser.
          </Notice>
        )}
        {r.wheelBaseline && !r.multiAxle && !r.hasAxleWeights && (
          <Notice>
            Die ausgewählte Ausgangswägung benötigt vollständige Radmessungen.
          </Notice>
        )}
        {!r.wheelBaseline && !r.multiAxle && !r.hasAxleWeights && (
          <Notice>
            Für die Achslastprognose fehlen Ausgangswägungen. Wiege Vorder- und
            Hinterachse vor dem Ausbau im selben Beladungszustand und trage die
            Werte unten ein.
          </Notice>
        )}
        {r.hasAxleWeights && (r.frontKg == null || r.rearKg == null) && (
          <Notice>
            Für die Achslastprognose fehlen Radstand, Achslage oder Masse bzw.
            Schwerpunkt einer Zuladung.
          </Notice>
        )}
        {columns.some((x) => x[3] != null && x[3] < 0) && (
          <Notice>
            Mindestens eine zulässige Masse ist überschritten. Prüfe die rot
            markierte Reserve und die Lage schwerer Bauteile.
          </Notice>
        )}
        {r.baseDiscrepancy != null && Math.abs(r.baseDiscrepancy) >= 1 && (
          <Notice>
            Die{' '}
            {r.wheelBaseline && r.includedKg
              ? 'um mitgewogene Positionen bereinigte Ausgangswägung'
              : 'Summe der Achswägungen'}{' '}
            weicht um {fmt(r.baseDiscrepancy, 'kg')} von der eingetragenen
            Basismasse ab. Die Prognose verwendet die Wägung.
          </Notice>
        )}
        <More title="Massenaufstellung und Rechenweg">
          <Ledger
            rows={[
              [
                r.wheelBaseline
                  ? 'Gewogener Ausgangszustand'
                  : 'Basis vor Ausbau',
                fmt(r.baseKg, 'kg'),
              ],
              ...(r.wheelBaseline
                ? [
                    [
                      'Mitgewogene Modellpositionen, abzuziehen',
                      fmt(r.includedKg === null ? null : -r.includedKg, 'kg'),
                    ],
                  ]
                : []),
              ['Ausbau trocken im Plan', fmt(r.plannedDryMassKg, 'kg')],
              ['Ausbau trocken in der Rechnung', fmt(r.dryMassKg, 'kg')],
              ['Frisch- und Grauwasser', fmt(r.fluidKg, 'kg')],
              ['Reisende', fmt(r.peopleKg, 'kg')],
              ['Gepäck und Vorräte', fmt(r.cargoKg, 'kg')],
              ['Separater Heizbrennstoff', fmt(r.fuelKg, 'kg')],
            ]}
          />
          <p>
            Im ebenen Stand beträgt der zusätzliche Hinterachsanteil einer Masse
            m: m × (Schwerpunkt X − Vorderachse X) / Radstand. Die Vorderachse
            trägt die Differenz. Die Bauteilmitte dient als angenäherter
            Längsschwerpunkt. Hinter der Hinterachse angebrachte Masse kann die
            Vorderachse entlasten. Abschließend reisefertig wiegen.
          </p>
        </More>
        <More
          title={
            'Herkunft der Bauteilmassen · ' + r.measuredCount + ' Ist-Werte'
          }
        >
          <p>
            Für eingebaute oder geprüfte Bauteile mit eingetragener Ist-Masse
            gilt der Wert aus der Bordakte. Weitere Bauteile gehen mit ihrer
            geplanten Trockenmasse ein.
          </p>
          <div className="sy-scroll">
            <table className="sy-table">
              <thead>
                <tr>
                  <th>Bauteil</th>
                  <th>Plan</th>
                  <th>In der Rechnung</th>
                  <th>Grundlage</th>
                </tr>
              </thead>
              <tbody>
                {r.massDetails.map((it) => (
                  <tr key={it.id}>
                    <th scope="row">{it.name}</th>
                    <td>{fmt(it.planned, 'kg')}</td>
                    <td>{fmt(it.used, 'kg')}</td>
                    <td>
                      {it.measured ? 'Ist-Masse aus Bordakte' : 'Planansatz'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </More>
      </Pane>
      <Pane title="Reisende und Gepäck" icon={Users}>
        <Grid>
          <N
            label="Anzahl Reisende"
            value={t.people}
            whole
            change={set(pt, 'people')}
          />
          <N
            label="Masse je Person"
            value={t.personKg}
            unit="kg"
            change={set(pt, 'personKg')}
          />
          <N
            label="Gemeinsamer Schwerpunkt Reisende X"
            value={t.occupantX}
            unit="mm"
            min={-20000}
            change={set(pt, 'occupantX')}
          />
          <N
            label="Gepäck und Proviant"
            value={t.cargoKg}
            unit="kg"
            change={set(pt, 'cargoKg')}
          />
          <N
            label="Gepäckschwerpunkt X"
            value={t.cargoX}
            unit="mm"
            min={-20000}
            change={set(pt, 'cargoX')}
          />
        </Grid>
        <p className="sy-caption">
          X = 0 ist die vordere Innenwand des Ausbaus. Positive Werte liegen in
          Richtung Heck. Berücksichtige Personen, Gepäck und Kraftstoff jeweils
          einmal.
        </p>
      </Pane>
      <Pane title="Basisfahrzeug und Wägung" icon={Truck}>
        <VehicleFields vehicle={v} patch={patchVehicle} />
        <p className="sy-caption">
          Direkte Achswägungen gelten beim Zweiachser als Ausgangsbasis, solange
          keine Einzelrad-Ausgangswägung für die Prognose ausgewählt ist.
        </p>
      </Pane>
    </>
  );
}
