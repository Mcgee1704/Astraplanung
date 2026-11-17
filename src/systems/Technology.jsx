import React, { useState } from 'react';
import {
  BatteryCharging,
  Cable,
  ChevronRight,
  CirclePlus,
  Droplets,
  Flame,
  Gauge,
  PlugZap,
  Snowflake,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
import { loadWh, tankFill, tankSpace, topologies } from './model.js';
import {
  canVerifyRoute,
  editRoute,
  endName,
  recordsOf,
  routesOf,
  specialEnds,
} from '../records/model.js';
import {
  Add,
  BoardItems,
  Check,
  Grid,
  Ledger,
  Metrics,
  More,
  N,
  Notice,
  Pane,
  Percent,
  Select,
  Tabs,
  Txt,
  days,
  fmt,
  uid,
} from './shared.jsx';

const field = (patch, key) => (value) => patch({ [key]: value });
const externalPV =
  'https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/pvgis-5-tools/grid-pv-systems_en';

function FlowBar({ result }) {
  const rows = [
    ['Solar', result.solarWh, 'solar'],
    ['Fahrt', result.alternatorWh, 'drive'],
    ['Landstrom', result.shoreWh, 'shore'],
  ];
  const cap = Math.max(1, result.consumptionWh ?? 0, result.generationWh ?? 0);
  return (
    <div className="sy-flow">
      <div className="sy-flowline">
        <span>Ertrag</span>
        <div>
          {rows.map(([label, value, cls]) => (
            <i
              key={label}
              className={cls}
              style={{ width: ((value ?? 0) / cap) * 100 + '%' }}
            />
          ))}
        </div>
        <b>{fmt(result.generationWh, 'Wh', 0)}</b>
      </div>
      <div className="sy-flowline">
        <span>Verbrauch</span>
        <div>
          <i
            className="use"
            style={{ width: ((result.consumptionWh ?? 0) / cap) * 100 + '%' }}
          />
        </div>
        <b>{fmt(result.consumptionWh, 'Wh', 0)}</b>
      </div>
      <div className="sy-flowkey">
        {rows.map(([label, value, cls]) => (
          <span key={label}>
            <i className={cls} />
            {label} {fmt(value, 'Wh', 0)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Loads({ model }) {
  const { s, project, changeList } = model;
  const editLoad = (id, patch) =>
    changeList('loads', (list) =>
      list.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    );
  return (
    <Pane
      title="Verbraucher"
      icon={PlugZap}
      action={
        <Add
          action={() =>
            changeList('loads', (list) => [
              ...list,
              {
                id: uid(),
                name: 'Zusätzlicher Verbraucher',
                watts: 20,
                hours: 1,
                qty: 1,
                bus: 'DC',
              },
            ])
          }
        >
          Verbraucher
        </Add>
      }
    >
      <div className="sy-load-list">
        {s.loads.map((load) => (
          <More
            key={load.id}
            title={
              <span className="sy-foldlabel">
                <strong>{load.name || 'Verbraucher'}</strong>
                <small>
                  {fmt(loadWh(load, s, project.items), 'Wh/Tag', 0)}
                </small>
              </span>
            }
          >
            <Grid>
              <Txt
                label="Bezeichnung"
                value={load.name}
                change={(v) => editLoad(load.id, { name: v })}
              />
              <Select
                label="Versorgung"
                value={load.bus}
                options={[
                  ['DC', 'DC · direkt'],
                  ['AC', 'AC · Wechselrichter'],
                ]}
                change={(v) => editLoad(load.id, { bus: v })}
              />
              <N
                label="Leistung je Gerät"
                value={load.watts}
                unit="W"
                change={(v) => editLoad(load.id, { watts: v })}
              />
              <N
                label="Aktive Zeit je Tag"
                value={load.hours}
                max={24}
                unit="h"
                change={(v) => editLoad(load.id, { hours: v })}
              />
              <N
                label="Anzahl"
                value={load.qty ?? 1}
                whole
                change={(v) => editLoad(load.id, { qty: v })}
              />
              <Select
                label="Bauteilzuordnung"
                value={load.itemId || ''}
                options={[
                  ['', 'Unabhängig vom Grundriss'],
                  ...(load.itemId &&
                  !project.items.some((it) => it.id === load.itemId)
                    ? [[load.itemId, 'Zuordnung im Grundriss fehlt']]
                    : []),
                  ...project.items.map((it) => [it.id, it.name]),
                ]}
                change={(v) => editLoad(load.id, { itemId: v })}
              />
            </Grid>
            {load.itemId &&
              !project.items.some((it) => it.id === load.itemId) && (
                <Notice>
                  Das zugeordnete Bauteil fehlt. Der Verbrauch ist bis zur neuen
                  Zuordnung aus der Bilanz genommen.
                </Notice>
              )}
            <div className="sy-row-actions">
              <Check
                label="In der Bilanz"
                value={load.enabled !== false}
                change={(v) => editLoad(load.id, { enabled: v })}
              />
              <button
                className="btn sy-delete"
                onClick={() =>
                  changeList('loads', (list) =>
                    list.filter((x) => x.id !== load.id),
                  )
                }
              >
                <Trash2 size={15} />
                Entfernen
              </button>
            </div>
          </More>
        ))}
      </div>
      {project.items
        .filter(
          (it) =>
            ['fridge', 'vent', 'fan', 'light', 'pump', 'inverter'].includes(
              it.kind,
            ) && !s.loads.some((l) => l.itemId === it.id),
        )
        .map((it) => (
          <button
            key={it.id}
            className="btn sy-attach"
            onClick={() =>
              changeList('loads', (list) => {
                const matching = list.find(
                  (l) =>
                    !l.itemId &&
                    l.id ===
                      {
                        pump: 'pump',
                        fridge: 'refrigeration',
                        light: 'lights',
                      }[it.kind],
                );
                return matching
                  ? list.map((l) =>
                      l.id === matching.id
                        ? { ...l, itemId: it.id, name: it.name }
                        : l,
                    )
                  : [
                      ...list,
                      {
                        id: uid(),
                        name:
                          it.kind === 'inverter'
                            ? it.name + ' · Eigenverbrauch'
                            : it.name,
                        itemId: it.id,
                        bus: 'DC',
                        watts: it.watts ?? null,
                        hours: null,
                        qty: 1,
                      },
                    ];
              })
            }
          >
            <CirclePlus size={14} />
            {it.name} zuordnen
          </button>
        ))}
      <p className="sy-caption">
        Aktive Laufzeit pro Tag schließt Schaltpausen aus. Heizlüfter und
        elektrische Wärme sind separat in der Bilanz erfasst.
      </p>
    </Pane>
  );
}

function Energy({ model, r }) {
  const { s, t, project, patchSystem: ps, patchTrip: pt } = model;
  return (
    <>
      <Pane title="Tagesbilanz" icon={Zap}>
        <Metrics
          rows={[
            [
              'Verfügbar bis Reserve',
              fmt(r.usableWh, 'Wh', 0),
              BatteryCharging,
            ],
            ['Saldo je Tag', fmt(r.balanceWh, 'Wh', 0), Zap],
            ['Zeit bis Batteriereserve', days(r.electricDays), Gauge],
          ]}
        />
        <FlowBar result={r} />
        {r.acPathMissing && (
          <Notice>
            Der Entwurf enthält Wechselstrombedarf. Ergänze den Wechselrichter
            im Grundriss oder erfasse unten die Kennung eines vorhandenen
            Geräts. Bis dahin bleiben Strombilanz und Standdauer offen.
          </Notice>
        )}
        {r.scheduleOverlap && (
          <Notice>
            Fahrt und Landstrom belegen zusammen mehr als 24 Stunden. Korrigiere
            die Tageszeiten für die Energiebilanz.
          </Notice>
        )}
        <More title="Rechenweg und Gültigkeit">
          <p>
            Verbraucherenergie = Anzahl × Watt × aktive Stunden. Bei
            Wechselstrom kommt der Verlust des Wechselrichters hinzu.
            Solarertrag = Wp × Vollsonnenstunden × nutzbarer Anteil. Fahrt und
            Landstrom zählen nur während der eingetragenen Stunden.
          </p>
          <p>
            Die Zeit bis zur Reserve ergibt sich aus verfügbarer Batterieladung
            geteilt durch das tägliche Defizit. Eine ausgeglichene Tagesbilanz
            beschreibt einen wiederholten Durchschnittstag. Stunden mit
            Schatten, Lastspitzen und der Verlauf über Nacht brauchen eine
            gesonderte Prüfung. Standortbezogene Daten und Stundenverläufe
            bietet die EU-Kommission.{' '}
            <a href={externalPV} target="_blank" rel="noreferrer">
              PVGIS für Inselanlagen
            </a>
          </p>
        </More>
      </Pane>
      <div className="sy-pair">
        <Pane title="Speicher" icon={BatteryCharging}>
          <BoardItems items={project.items} kind="battery" model={model} />
          <Grid two>
            <Percent
              label="Ladestand am Start"
              value={s.startCharge}
              change={field(ps, 'startCharge')}
            />
            <Percent
              label="Ladereserve"
              value={s.reserveCharge}
              change={field(ps, 'reserveCharge')}
            />
          </Grid>
          <Ledger
            rows={[['Nennenergie aller Blöcke', fmt(r.batteryWh, 'Wh', 0)]]}
          />
          {s.startCharge < s.reserveCharge && (
            <Notice>
              Die eingestellte Reserve ist bereits zu Beginn erreicht.
            </Notice>
          )}
        </Pane>
        <Pane title="Stromerzeugung" icon={Sun}>
          <BoardItems items={project.items} kind="solar" model={model} />
          <Grid two>
            <N
              label="Vollsonnenstunden je Tag"
              value={t.solarHours}
              max={24}
              unit="h"
              change={field(pt, 'solarHours')}
            />
            <Percent
              label="Nutzbarer PV-Anteil"
              value={s.pvEfficiency}
              change={field(ps, 'pvEfficiency')}
            />
          </Grid>
          <Check
            label="Solarertrag einbeziehen"
            value={s.solarEnabled}
            change={field(ps, 'solarEnabled')}
          />
        </Pane>
      </div>
      <Pane title="Weitere Ladequellen" icon={PlugZap}>
        <Grid>
          <N
            label="Ladebooster am Ausgang"
            value={s.alternatorW}
            unit="W"
            change={field(ps, 'alternatorW')}
          />
          <N
            label="Fahrzeit je Tag"
            value={t.driveHours}
            max={24}
            unit="h"
            change={field(pt, 'driveHours')}
          />
          <Check
            label="Fahrtladung einbeziehen"
            value={s.alternatorEnabled}
            change={field(ps, 'alternatorEnabled')}
          />
          <N
            label="Landladegerät am Ausgang"
            value={s.shoreW}
            unit="W"
            change={field(ps, 'shoreW')}
          />
          <N
            label="Landstromzeit je Tag"
            value={t.shoreHours}
            max={24}
            unit="h"
            change={field(pt, 'shoreHours')}
          />
          <Check
            label="Landstrom einbeziehen"
            value={s.shoreEnabled}
            change={field(ps, 'shoreEnabled')}
          />
          <Percent
            label="Wirkungsgrad Wechselrichter"
            value={s.inverterEfficiency}
            change={field(ps, 'inverterEfficiency')}
          />
          <Txt
            label="Externer Wechselrichter · Bestandskennung"
            value={s.externalInverterRef}
            placeholder="Einbauort / Beleg eines vorhandenen Geräts"
            change={field(ps, 'externalInverterRef')}
          />
        </Grid>
        <Ledger
          rows={[
            [
              'Angesetzter Wechselrichter',
              r.inverterSource || 'Kein Gerät belegt',
            ],
          ]}
        />
        <p className="sy-caption">
          Die Landstromzeit beschreibt die Einspeisung am Ladegerät. Den
          Wechselstrombedarf übersetzt der belegte Wechselrichter in
          Batteriebedarf.
        </p>
      </Pane>
      <Loads model={model} />
    </>
  );
}

function Wiring({ model }) {
  const { s, project, patchSystem, edit } = model;
  const net = topologies[s.topology] || topologies['24/12'];
  const rows = routesOf(project.items, recordsOf(project)).filter(
    (row) => row.medium === 'Strom',
  );
  const endpoints = [
    ...project.items.map((it) => [it.id, it.name]),
    ...Object.entries(specialEnds),
  ];
  const write = (transform) =>
    edit((p) => ({ ...p, records: transform(recordsOf(p)) }));
  const update = (row, patch) =>
    write((records) => editRoute(records, row, patch, project.items));
  const add = () =>
    write((records) => ({
      ...records,
      extraRoutes: [
        ...records.extraRoutes,
        {
          id: uid(),
          medium: 'Strom',
          from: project.items.find((it) => it.kind === 'battery')?.id || '@dc',
          via: '',
          to: '@dc',
          protection: '',
          route: '',
          spec: '',
          verified: false,
        },
      ],
    }));
  const remove = (row) =>
    write((records) =>
      row.automatic
        ? {
            ...records,
            hiddenRoutes: [...new Set([...records.hiddenRoutes, row.id])],
          }
        : {
            ...records,
            extraRoutes: records.extraRoutes.filter((x) => x.id !== row.id),
          },
    );
  return (
    <Pane
      title="Elektroplan"
      icon={Cable}
      action={<Add action={add}>Strompfad</Add>}
    >
      <Grid two>
        <Select
          label="Fahrzeugnetz / Aufbaunetz"
          value={s.topology}
          change={field(patchSystem, 'topology')}
          options={Object.entries(topologies).map(([id, n]) => [id, n.label])}
        />
      </Grid>
      <p className="sy-caption">
        Der Starterkreis ist mit {net.starter} V, der Aufbau mit{' '}
        {net.house} V geplant. Jede hier bearbeitete Leitung erscheint mit
        denselben Daten in der Bordakte.
      </p>
      {rows.map((row) => (
        <More
          key={row.id}
          title={
            <span className="sy-route">
              <b>{endName(row.from, project.items)}</b>
              <ChevronRight size={14} />
              {row.via && (
                <>
                  <span>{row.via}</span>
                  <ChevronRight size={14} />
                </>
              )}
              <b>{endName(row.to, project.items)}</b>
            </span>
          }
        >
          <Grid>
            <Select
              label="Quelle"
              value={row.from}
              options={endpoints}
              change={(v) => update(row, { from: v })}
            />
            <Txt
              label="Gerät / Verteiler"
              value={row.via}
              change={(v) => update(row, { via: v })}
            />
            <Select
              label="Ziel"
              value={row.to}
              options={endpoints}
              change={(v) => update(row, { to: v })}
            />
            <Txt
              label="Schutzorgan / Kennung"
              value={row.protection}
              placeholder="laut geprüfter Planung"
              change={(v) => update(row, { protection: v })}
            />
            <Txt
              label="Leitung / Nachweis"
              value={row.spec}
              placeholder="Dokument oder Messwert"
              change={(v) => update(row, { spec: v })}
            />
            <Txt
              label="Verlauf"
              value={row.route}
              change={(v) => update(row, { route: v })}
            />
          </Grid>
          <div className="sy-row-actions">
            <Check
              label="Pfad fachlich geprüft"
              value={row.verified}
              disabled={!canVerifyRoute(row, project.items)}
              change={(v) => update(row, { verified: v })}
            />
            <button className="btn sy-delete" onClick={() => remove(row)}>
              <Trash2 size={15} />
              Strompfad entfernen
            </button>
          </div>
          {!canVerifyRoute(row, project.items) && (
            <p className="sy-caption">
              Für den Prüfvermerk sind zwei verschiedene vorhandene Endpunkte
              und ein dokumentierter Verlauf erforderlich.
            </p>
          )}
        </More>
      ))}
      {!rows.length && (
        <p className="sy-caption">
          Ergänze Komponenten im Grundriss oder lege einen Strompfad an.
        </p>
      )}
      <p className="sy-caption">
        Schutzorgane, Leitungsdaten und Prüfvermerk stammen aus der fachlich
        geprüften Installation.
      </p>
    </Pane>
  );
}

function Tank({ model, item }) {
  const { project, updateItem } = model;
  const change = (k, v) => updateItem(item.id, { [k]: v });
  const space = tankSpace(project, item);
  const hatches = project.items.filter((it) => it.kind === 'hatch');
  const setHatch = (id) => {
    const h = hatches.find((it) => it.id === id);
    updateItem(
      item.id,
      h
        ? {
            serviceId: id,
            serviceWidth: ['left', 'right'].includes(h.side)
              ? h.length
              : h.width,
            serviceHeight: h.height,
          }
        : { serviceId: '' },
    );
  };
  return (
    <More
      title={
        <span className="sy-foldlabel">
          <strong>{item.name}</strong>
          <small>{fmt(item.capacity, 'l')}</small>
        </span>
      }
    >
      <Grid>
        <N
          label="Tankvolumen"
          value={item.capacity}
          unit="l"
          change={(v) => change('capacity', v)}
        />
        <Percent
          label="Füllstand bei Abfahrt"
          value={tankFill(item)}
          change={(v) => change('fill', v)}
        />
        <Select
          label="Wartungsklappe im Grundriss"
          value={item.serviceId || ''}
          options={[
            ['', 'Offen / nur Öffnungsmaß'],
            ...hatches.map((h) => [h.id, h.name]),
          ]}
          change={setHatch}
        />
        {!space.path && (
          <>
            <N
              label="Öffnung Breite"
              value={item.serviceWidth}
              unit="mm"
              change={(v) => change('serviceWidth', v)}
            />
            <N
              label="Öffnung Höhe"
              value={item.serviceHeight}
              unit="mm"
              change={(v) => change('serviceHeight', v)}
            />
          </>
        )}
      </Grid>
      <Ledger
        rows={[
          ['Zugang für Tankausbau', accessText(space)],
          ...(space.path
            ? [
                [
                  'Lichte Klappe',
                  fmt(
                    ['left', 'right'].includes(space.path.hatch.side)
                      ? space.path.hatch.length
                      : space.path.hatch.width,
                    'mm',
                    0,
                  ) +
                    ' × ' +
                    fmt(space.path.hatch.height, 'mm', 0),
                ],
              ]
            : []),
        ]}
      />
    </More>
  );
}
export function accessText(space) {
  if (!space) return 'Aufmaß offen';
  if (space.path) {
    const results = [];
    if (!space.path.aligned) results.push('Tank und Öffnung fluchten nicht');
    if (space.path.obstacles.length)
      results.push(
        'Ausbauweg belegt durch ' +
          space.path.obstacles.map((it) => it.name).join(', '),
      );
    return results.join(' · ') || 'Gerader Ausbauweg frei';
  }
  if (!space.opening.openingKnown) return 'Klappenmaß und Ausbauweg offen';
  return space.opening.fitsOpening
    ? 'Öffnungsmaß reicht · Ausbauweg offen'
    : 'Öffnung zu klein · Ausbauweg offen';
}
function Water({ model, r }) {
  const { project, s, t, patchTrip: pt, patchSystem: ps } = model;
  const tanks = project.items.filter((it) =>
    ['fresh', 'grey'].includes(it.kind),
  );
  return (
    <>
      <Pane title="Wasservorräte" icon={Droplets}>
        <Metrics
          rows={[
            ['Frischwasser an Bord', fmt(r.freshAvailableL, 'l'), Droplets],
            ['Freier Grauwassertank', fmt(r.greyAvailableL, 'l'), Droplets],
            ['Standdauer Wasser', days(r.waterDays), Gauge],
          ]}
        />
        <Ledger
          rows={[
            ['Frischwasserbedarf pro Tag', fmt(r.waterDailyL, 'l')],
            ['Abwasser pro Tag', fmt(r.greyDailyL, 'l')],
            ['Bis Frischwasser aufgebraucht', days(r.freshDays)],
            ['Bis Grauwassertank voll', days(r.greyDays)],
          ]}
        />
      </Pane>
      <Pane title="Tanks und Wartungszugang" icon={Droplets}>
        {tanks.length ? (
          tanks.map((it) => <Tank key={it.id} item={it} model={model} />)
        ) : (
          <p className="sy-caption">
            Füge im Grundriss einen Frischwasser- oder Grauwassertank ein, um
            seine Füllung und den Wartungszugang zu planen.
          </p>
        )}
        <p className="sy-caption">
          Für den geraden Tankausbau prüft der Planer Fluchtung und Bauteile
          zwischen Tank und zugeordneter Wandklappe. Ohne zugeordnete Klappe
          prüft er nur den lichten Durchlass.
        </p>
      </Pane>
      <Pane title="Bedarf und Installation" icon={Gauge}>
        <Grid two>
          <N
            label="Wasser je Person und Tag"
            value={t.waterPerPerson}
            unit="l"
            change={field(pt, 'waterPerPerson')}
          />
          <Percent
            label="Anteil als Grauwasser"
            value={t.greyFraction}
            change={field(pt, 'greyFraction')}
          />
        </Grid>
        <Txt
          area
          label="Filter, Entleerung und Frostschutz"
          value={s.waterNotes}
          placeholder="Entleerungstiefpunkte, Filterwechsel und Zugang zu Absperrungen"
          change={field(ps, 'waterNotes')}
        />
        <p className="sy-caption">
          Frisch- und Grauwasser zählen mit rund 1 kg je Liter zur Reisemasse.
          Miss den Zugang zu Tank, Filter und Ablass auch bei montierten
          Möbeln. Halte die Lage des Entleerungspunkts im Fahrzeug fest.
        </p>
      </Pane>
    </>
  );
}
function Heat({ model, r }) {
  const { s, t, project, patchSystem: ps, patchTrip: pt } = model;
  const fuel = ['diesel', 'gas'].includes(s.heater);
  const changeHeater = (heater) => {
    const changed = { heater };
    if (heater === 'gas' && s.heater !== 'gas')
      Object.assign(changed, { fuelKg: 1, fuelKwh: 12.8, fuelAmount: 11 });
    if (heater === 'diesel' && s.heater !== 'diesel')
      Object.assign(changed, { fuelKg: 0.84, fuelKwh: 9.8, fuelAmount: 12 });
    if (heater === 'electric') changed.heaterEfficiency = 1;
    if (s.heater === 'electric' && ['diesel', 'gas'].includes(heater))
      changed.heaterEfficiency = 0.83;
    ps(changed);
  };
  return (
    <>
      <Pane title="Wärmebedarf" icon={Flame}>
        <Metrics
          rows={[
            ['Heizlast am Auslegungspunkt', fmt(r.heatLoadW, 'W', 0), Flame],
            ['Warmwasserbedarf je Tag', fmt(r.hotWaterWh, 'Wh', 0), Droplets],
            ['Brennstoff je Tag', fmt(r.fuelDaily, r.fuelUnit, 2), Gauge],
          ]}
        />
        {r.heaterMissing && (
          <Notice>
            Zum gewählten Wärmesystem fehlt ein eingeplantes Heizgerät. Ergänze
            es im Grundriss oder ordne unten ein vorhandenes Bauteil zu.
          </Notice>
        )}
        {r.waterHeatShortfall && (
          <Notice>
            Der separate Boiler fehlt oder seine Leistung deckt die tägliche
            Warmwasserarbeit nicht.
          </Notice>
        )}
        {r.heatShortfall && (
          <Notice>
            Die gewählte Heizleistung deckt den berechneten Bedarf bei diesen
            Temperaturen oder über den Tag nicht.
          </Notice>
        )}
        <More title="Wärmebilanz nachvollziehen">
          <p>
            Die Innenmaße ergeben eine angenäherte Hüllfläche von{' '}
            {fmt(r.area, 'm²')} und {fmt(r.volume, 'm³')} beheiztem Volumen.
            Heizlast = Temperaturdifferenz × (Hüllfläche × mittlerer U-Wert +
            0,34 × Luftwechsel × Volumen). Warmwasser benötigt näherungsweise
            1,163 Wh je Liter und Kelvin Temperaturhub.
          </p>
          <p>
            Raumwärme und Warmwasser ergeben nach Wirkungsgrad den
            Energieeinsatz. Der Lüfter läuft rechnerisch für die thermische
            Tagesarbeit geteilt durch die Heizleistung. Ein separater
            elektrischer Boiler fließt mit seinem eigenen Wirkungsgrad in die
            Strombilanz ein. Wärmebrücken, Wind, Fensterflächen, Feuchteeintrag
            und Fremdwärme können den realen Bedarf verändern.
          </p>
        </More>
      </Pane>
      <Pane title="Klima und Hülle" icon={Snowflake}>
        <Grid>
          <N
            label="Außentemperatur"
            value={t.outsideC}
            min={-100}
            max={80}
            unit="°C"
            change={field(pt, 'outsideC')}
          />
          <N
            label="Innentemperatur"
            value={s.insideC}
            min={-30}
            max={50}
            unit="°C"
            change={field(ps, 'insideC')}
          />
          <N
            label="Heizzeit je Tag"
            value={s.heatHours}
            unit="h"
            max={24}
            change={field(ps, 'heatHours')}
          />
          <N
            label="Mittlerer U-Wert der Hülle"
            value={s.uValue}
            unit="W/m²K"
            change={field(ps, 'uValue')}
          />
          <N
            label="Luftwechsel pro Stunde"
            value={s.airChanges}
            unit="1/h"
            change={field(ps, 'airChanges')}
          />
        </Grid>
      </Pane>
      <Pane title="Heizung und Warmwasser" icon={Flame}>
        <Grid>
          <Select
            label="Wärmequelle"
            value={s.heater}
            options={[
              ['diesel', 'Diesel'],
              ['gas', 'Flüssiggas'],
              ['electric', 'Elektrisch'],
              ['none', 'Keine Heizung'],
            ]}
            change={changeHeater}
          />
          <Select
            label="Heizgerät im Grundriss"
            value={s.heaterItemId || 'auto'}
            change={field(ps, 'heaterItemId')}
            options={[
              ['auto', 'Erstes eingeplantes Heizgerät'],
              ...(s.heaterItemId &&
              s.heaterItemId !== 'auto' &&
              !project.items.some((it) => it.id === s.heaterItemId)
                ? [[s.heaterItemId, 'Bauteil entfernt']]
                : []),
              ...project.items.map((it) => [it.id, it.name]),
            ]}
          />
          {s.heater === 'electric' && (
            <Select
              label="Stromversorgung Raumheizung"
              value={s.heaterBus}
              options={[
                ['DC', 'Gleichstrom'],
                ['AC', 'Über Wechselrichter'],
              ]}
              change={field(ps, 'heaterBus')}
            />
          )}
          <N
            label="Nutzbare Heizleistung"
            value={s.heaterPowerW}
            unit="W"
            change={field(ps, 'heaterPowerW')}
          />
          <Percent
            label="Heizungswirkungsgrad"
            value={s.heaterEfficiency}
            change={field(ps, 'heaterEfficiency')}
          />
          <N
            label="Warmwasser je Person und Tag"
            value={s.hotWaterL}
            unit="l"
            change={field(ps, 'hotWaterL')}
          />
          <N
            label="Temperaturhub Warmwasser"
            value={s.waterDeltaK}
            unit="K"
            change={field(ps, 'waterDeltaK')}
          />
          <Select
            label="Warmwasser erzeugen"
            value={s.hotWaterSource}
            options={[
              ['heater', 'Über die Raumheizung'],
              ['electric', 'Separater Elektroboiler'],
            ]}
            change={field(ps, 'hotWaterSource')}
          />
          {s.hotWaterSource === 'electric' && (
            <>
              <Select
                label="Boiler im Grundriss"
                value={s.boilerItemId || 'auto'}
                change={field(ps, 'boilerItemId')}
                options={[
                  ['auto', 'Erster eingeplanter Boiler'],
                  ...project.items.map((it) => [it.id, it.name]),
                ]}
              />
              <N
                label="Nutzbare Boilerleistung"
                value={s.boilerPowerW}
                unit="W"
                change={field(ps, 'boilerPowerW')}
              />
              <Percent
                label="Boilerwirkungsgrad"
                value={s.boilerEfficiency}
                change={field(ps, 'boilerEfficiency')}
              />
              <Select
                label="Stromversorgung Boiler"
                value={s.boilerBus}
                options={[
                  ['DC', 'Gleichstrom'],
                  ['AC', 'Über Wechselrichter'],
                ]}
                change={field(ps, 'boilerBus')}
              />
            </>
          )}
          {fuel && (
            <>
              <N
                label="Elektrischer Lüfterbedarf im Betrieb"
                value={s.heaterFanW}
                unit="W"
                change={field(ps, 'heaterFanW')}
              />
              <N
                label="Verfügbarer Heizbrennstoff"
                value={s.fuelAmount}
                unit={r.fuelUnit}
                change={field(ps, 'fuelAmount')}
              />
              <N
                label="Brennstoffenergie je Einheit"
                value={s.fuelKwh}
                unit={'kWh/' + r.fuelUnit}
                change={field(ps, 'fuelKwh')}
              />
            </>
          )}
        </Grid>
        {fuel && (
          <>
            <Check
              label="Brennstoff zusätzlich zur gewogenen Basis als Zuladung ansetzen"
              value={s.extraFuel}
              change={field(ps, 'extraFuel')}
            />
            {s.extraFuel && (
              <Grid two>
                <N
                  label="Masse je Brennstoffeinheit"
                  value={s.fuelKg}
                  unit={'kg/' + r.fuelUnit}
                  change={field(ps, 'fuelKg')}
                />
                <N
                  label="Brennstoff-Schwerpunkt X"
                  value={s.fuelX}
                  min={-10000}
                  unit="mm"
                  change={field(ps, 'fuelX')}
                />
              </Grid>
            )}
          </>
        )}
        <Txt
          area
          label="Lüftung, Kondensat und Wartung"
          value={s.thermalNotes}
          placeholder="Luftführung, Dämmstöße, Herstellerunterlagen und Servicezugänge"
          change={field(ps, 'thermalNotes')}
        />
      </Pane>
    </>
  );
}
export default function Technology({ model, r }) {
  const [tab, setTab] = useState('electric');
  return (
    <>
      <Tabs
        label="Bereiche der Bordtechnik"
        active={tab}
        set={setTab}
        tabs={[
          ['electric', 'Energie', BatteryCharging],
          ['wiring', 'Elektroplan', Cable],
          ['water', 'Wasser', Droplets],
          ['heat', 'Wärme & Klima', Flame],
        ]}
      />
      {tab === 'electric' && <Energy model={model} r={r} />}
      {tab === 'wiring' && <Wiring model={model} />}
      {tab === 'water' && <Water model={model} r={r} />}
      {tab === 'heat' && <Heat model={model} r={r} />}
    </>
  );
}
