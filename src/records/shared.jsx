import React, { useId } from 'react';
import { wheelKeys, wheelTotals } from '../vehicle/wheel-weighing.js';
import {
  allCuts,
  bill,
  cardOf,
  cutPlan,
  endName,
  fabricationDimensions,
  hasValue,
  joineryLabels,
  number,
  priceValue,
  routesOf,
  specification,
  summary,
  validCut,
} from './model.js';

const de = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});
export const fmt = (value) => de.format(number(value));
export const eur = (value) => money.format(number(value));
export const priceText = (value) =>
  priceValue(value) === null ? 'offen' : eur(value);
export const sumText = (amount, open) =>
  eur(amount) +
  (open
    ? ' Zwischensumme · ' +
      open +
      ' Position' +
      (open === 1 ? '' : 'en') +
      ' offen'
    : '');
export const dims = (item) => {
  const size = fabricationDimensions(item);
  return [size.length, size.width, size.height]
    .map((value) => (hasValue(value) ? fmt(value) : '–'))
    .join(' × ');
};
export const safePhoto = (value) =>
  typeof value === 'string' &&
  /^data:image\/(?:jpeg|png|webp);base64,/i.test(value);

export function Field({
  label,
  value,
  change,
  options,
  long,
  type = 'text',
  ...attrs
}) {
  const props = {
    value: value ?? '',
    onChange: (e) => change(e.target.value),
    ...attrs,
  };
  return (
    <label className="field rec-field">
      <span>{label}</span>
      {options ? (
        <select {...props}>
          {options.map((option) => {
            const [key, title] = Array.isArray(option)
              ? option
              : [option, option];
            return (
              <option key={key} value={key}>
                {title}
              </option>
            );
          })}
        </select>
      ) : long ? (
        <textarea rows="2" {...props} />
      ) : (
        <input type={type} {...props} />
      )}
    </label>
  );
}

export function SelectPart({ items, chosen, setChosen }) {
  return (
    <Field
      label="Bauteil auswählen"
      value={chosen?.id ?? ''}
      change={setChosen}
      options={
        items.length
          ? items.map((item) => [item.id, item.name])
          : [['', 'Keine Bauteile vorhanden']]
      }
    />
  );
}

export function Drawing({ item }) {
  const pattern = 'rec-grid-' + useId().replace(/[^a-z0-9_-]/gi, '');
  const size = fabricationDimensions(item);
  const l = Math.max(0, number(size.length)),
    w = Math.max(0, number(size.width)),
    h = Math.max(0, number(size.height));
  const scale = Math.min(210 / (l || 1), 109 / (Math.max(w, h) || 1));
  function view(mid, vertical, name) {
    const a = l * scale,
      b = vertical * scale,
      x = mid - a / 2,
      y = 97 - b / 2;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={a}
          height={b}
          fill="#e2ede6"
          stroke="#35564b"
          strokeWidth="1.7"
        />
        <path
          d={`M${x},${y - 3}V${y - 16} M${x + a},${y - 3}V${y - 16} M${x},${y - 13}h${a} M${x + a + 4},${y}h13 M${x + a + 4},${y + b}h13 M${x + a + 14},${y}v${b}`}
          fill="none"
          stroke="#678075"
        />
        <text
          x={mid}
          y={y - 19}
          textAnchor="middle"
          fontSize="11"
          fill="#28463b"
        >
          {fmt(l)}
        </text>
        <text x={x + a + 20} y={y + b / 2 + 4} fontSize="11" fill="#28463b">
          {fmt(vertical)}
        </text>
        <text x={mid} y="184" textAnchor="middle" fontSize="12" fill="#41564b">
          {name}
        </text>
      </g>
    );
  }
  return (
    <svg
      className="rec-drawing"
      viewBox="0 0 640 201"
      role="img"
      aria-label={item.name + ' – Außenmaße ' + dims(item) + ' Millimeter'}
    >
      <defs>
        <pattern
          id={pattern}
          width="13"
          height="13"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r=".7" fill="#c9d3cc" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#f8faf7" />
      <rect width="100%" height="100%" fill={'url(#' + pattern + ')'} />
      {view(149, w, 'Draufsicht · L × B')}
      {view(459, h, 'Seitenansicht · L × H')}
    </svg>
  );
}

export function SheetTable({
  heads,
  children,
  empty = 'Noch keine Positionen.',
}) {
  return (
    <div className="rec-scroll">
      <table className="rec-table">
        <thead>
          <tr>
            {heads.map((head, i) => (
              <th scope="col" key={i}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {React.Children.count(children) ? (
            children
          ) : (
            <tr>
              <td colSpan={heads.length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function MiniMetric({ label, value, note }) {
  return (
    <div className="rec-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function csv(rows, name) {
  const cell = (value) => {
    let text =
      typeof value === 'number'
        ? String(value).replace('.', ',')
        : String(value ?? '');
    if (typeof value !== 'number' && /^\s*[=+\-@]/.test(text))
      text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  download(
    '\uFEFF' + rows.map((row) => row.map(cell).join(';')).join('\r\n'),
    name + '.csv',
    'text/csv;charset=utf-8',
  );
}

const sheetStyle = `
  *{box-sizing:border-box}body{font:14px/1.45 system-ui,sans-serif;color:#20372e;max-width:1000px;margin:30px auto;padding:0 24px}h1{font-size:32px;margin:6px 0}
  h2{font-size:22px;border-bottom:2px solid #698773;padding-bottom:4px;margin:26px 0 10px;break-after:avoid}h3{font-size:17px;margin:16px 0 5px;break-after:avoid}
  .doc-brand{letter-spacing:.1em;font-weight:700;font-size:12px}.doc-line{color:#526358;margin:4px 0}table{width:100%;border-collapse:collapse;margin:7px 0 16px;font-size:12px}
  th,td{text-align:left;padding:5px;border-bottom:1px solid #cdd4cf;vertical-align:top;overflow-wrap:anywhere}th{background:#e8eee9}thead{display:table-header-group}
  tr,figure,.doc-card{break-inside:avoid}.rec-drawing{max-width:600px;width:100%;height:auto;display:block}dl{display:grid;grid-template-columns:minmax(130px,25%) 1fr;margin:8px 0}
  dt,dd{padding:3px 0;margin:0;overflow-wrap:anywhere;white-space:pre-line}dt{color:#4b5e52}.doc-photo{max-width:350px;max-height:230px}
  .doc-card,.doc-figure{border-bottom:1px solid #d4ded8;padding-bottom:10px}.doc-figure{break-inside:avoid}.doc-warn{color:#824121}
  @media print{@page{margin:13mm}body{margin:0;padding:0;font-size:11px}h1{font-size:24px}h2{font-size:17px}h3{font-size:14px}table{font-size:10px}
  .rec-drawing{width:330px}.doc-photo{max-width:220px;max-height:160px}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

function documentCopy(node, title) {
  const doc = document.implementation.createHTMLDocument(title);
  doc.documentElement.lang = 'de';
  const meta = doc.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  doc.head.prepend(meta);
  const viewport = doc.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1';
  doc.head.appendChild(viewport);
  const style = doc.createElement('style');
  style.textContent = sheetStyle;
  doc.head.appendChild(style);
  doc.body.appendChild(doc.importNode(node, true));
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}

export function exportBook(node, title) {
  if (node)
    download(
      documentCopy(node, title),
      title.replace(/[^\p{L}\p{N}._ -]/gu, '-') + '.html',
      'text/html;charset=utf-8',
    );
}

export function printBook(node, title, onError) {
  if (!node) return;
  const frame = document.createElement('iframe');
  frame.title = 'Druckansicht ' + title;
  frame.className = 'rec-print-frame';
  frame.onload = async () => {
    try {
      const win = frame.contentWindow;
      await Promise.allSettled(
        Array.from(win.document.images, (img) => img.decode()),
      );
      win.addEventListener(
        'afterprint',
        () => setTimeout(() => frame.remove(), 300),
        { once: true },
      );
      win.focus();
      win.print();
      setTimeout(() => frame.remove(), 600000);
    } catch {
      frame.remove();
      onError?.(
        'Die Druckansicht ließ sich nicht öffnen. Die Offline-Datei kann im Browser gedruckt werden.',
      );
    }
  };
  frame.srcdoc = documentCopy(node, title);
  document.body.appendChild(frame);
}

export const cardFields = [
  ['make', 'Hersteller'],
  ['product', 'Typ / Modell'],
  ['partNumber', 'Ersatzteilnummer'],
  ['serial', 'Seriennummer'],
  ['place', 'Einbauort (Ist)'],
  ['access', 'Wartungszugang'],
  ['fuse', 'Sicherung / Trennstelle'],
  ['valve', 'Absperrung / Ventil'],
  ['maintenance', 'Wartung / Intervall'],
  ['serviceDate', 'Letzte Wartung'],
  ['nextDate', 'Nächste Wartung'],
  ['verified', 'Geprüft am'],
  ['note', 'Abweichungen / Notizen'],
];
export const measurements = [
  ['actualLength', 'length', 'Länge', 'mm'],
  ['actualWidth', 'width', 'Breite', 'mm'],
  ['actualHeight', 'height', 'Höhe', 'mm'],
  ['actualMass', 'mass', 'Masse', 'kg'],
];
export const deltaText = (a, b, unit) =>
  (a - b > 0 ? '+' : '') + fmt(a - b) + ' ' + unit;
const fallback = (v) => (hasValue(v) ? v : 'offen');

function RouteSheet({ items, records }) {
  return (
    <>
      <h2>Leitungsplan</h2>
      <p>
        Automatisch vorgeschlagene Verbindungen sind bis zur Prüfung Entwürfe.
        Kenndaten gemäß Geräteunterlagen und Fachplanung eintragen.
      </p>
      <SheetTable
        heads={[
          'Medium',
          'Von → nach',
          'Über / Verlauf',
          'Auslegung',
          'Schutz / Absperrung',
          'Stand',
        ]}
      >
        {routesOf(items, records).map((route) => (
          <tr key={route.id}>
            <td>{route.medium}</td>
            <td>
              {endName(route.from, items)} → {endName(route.to, items)}
            </td>
            <td>
              {[
                route.via,
                route.route,
                route.points?.length
                  ? 'Stützpunkte X/Y (mm): ' +
                    route.points
                      .map((p) => fmt(p.x) + '/' + fmt(p.y))
                      .join(' → ')
                  : '',
              ]
                .filter(Boolean)
                .join(' · ') || 'offen'}
            </td>
            <td>{fallback(route.spec)}</td>
            <td>{fallback(route.protection)}</td>
            <td>
              {route.missing
                ? 'Anschluss fehlt'
                : route.verified
                  ? 'Geprüft'
                  : 'Entwurf'}
            </td>
          </tr>
        ))}
      </SheetTable>
    </>
  );
}

function CutSheet({ items, records }) {
  const cuts = allCuts(items, records);
  return (
    <>
      <h2>Plattenzuschnitt</h2>
      <p>
        Fertigmaße in mm. Beim Korpus liegen Boden und Deckel zwischen den
        Seiten, die Rückwand liegt hinten auf. Schnittfuge und Plattenaufteilung
        beim Sägen berücksichtigen.
      </p>
      <SheetTable
        heads={[
          'Bauteil',
          'Brett',
          'Anzahl',
          'L × B',
          'Dicke',
          'Material',
          'Stand',
        ]}
      >
        {cuts.map((row) => (
          <tr key={row.itemId + ':' + row.id}>
            <td>{row.itemName}</td>
            <td>{row.name}</td>
            <td>{row.qty}</td>
            <td>
              {fmt(row.length)} × {fmt(row.width)}
            </td>
            <td>{fmt(row.thickness)}</td>
            <td>{row.material}</td>
            <td>
              {!validCut(row)
                ? 'Maß prüfen'
                : row.custom || row.changed
                  ? 'Manuell'
                  : 'Abgeleitet'}
            </td>
          </tr>
        ))}
      </SheetTable>
      {items.map((item) => {
        const plan = cutPlan(item, records);
        return plan.issue ? (
          <p className="doc-warn" key={item.id}>
            {item.name} – {plan.issue}
          </p>
        ) : null;
      })}
    </>
  );
}

function InventorySheet({ items, records }) {
  const rows = bill(items, records),
    totals = summary(items, records);
  return (
    <>
      <h2>Stückliste und Einkauf</h2>
      <p>
        {rows.length} Positionen · Ansatz{' '}
        {sumText(totals.planned, totals.openPlanned)} · mit erfassten
        Kaufpreisen {sumText(totals.expected, totals.openExpected)}
      </p>
      <SheetTable
        heads={[
          'Position',
          'Menge',
          'Vorgesehen / Einheit',
          'Gezahlt / Einheit',
          'Erwartete Summe',
          'Beschaffung',
        ]}
      >
        {rows.map((row) => (
          <tr key={(row.itemId ? 'i:' : 'p:') + row.id}>
            <td>
              {row.name}
              {row.label && ' · ' + row.label}
            </td>
            <td>
              {priceValue(row.qty) === null ? 'offen' : fmt(row.qty)} {row.unit}
            </td>
            <td>{priceText(row.cost)}</td>
            <td>{priceText(row.paid)}</td>
            <td>
              {row.included
                ? 'Im Bauteilbudget enthalten'
                : priceText(row.currentSum)}
            </td>
            <td>{row.state}</td>
          </tr>
        ))}
      </SheetTable>
    </>
  );
}

function PrintedWheelWeights({ weighing }) {
  if (!weighing) return null;
  const numberFormat = new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 3,
  });
  const kg = (n) => (Number.isFinite(n) ? numberFormat.format(n) : 'offen');
  return ['travel', 'baseline'].map((mode) => {
    const series = weighing[mode];
    const totals = wheelTotals(weighing, mode);
    if (!totals.measured && !series.date && !series.note) return null;
    return (
      <section key={mode}>
        <h2>
          {mode === 'travel'
            ? 'Reisefertige Radwägung'
            : 'Radlasten der Ausgangswägung'}
        </h2>
        {series.date && <p>Wägedatum {series.date}</p>}
        {series.note && <p>{series.note}</p>}
        <SheetTable
          heads={[
            'Achse',
            'Radposition',
            'Links (kg)',
            'Rechts (kg)',
            'Achssumme (kg)',
          ]}
        >
          {weighing.axles.map((axle, index) => {
            const left = wheelKeys(axle, 'left');
            const right = wheelKeys(axle, 'right');
            return left.map((key, i) => (
              <tr key={key}>
                <td>{axle.name}</td>
                <td>
                  {axle.dual ? (i === 0 ? 'Innen' : 'Außen') : 'Einzelrad'}
                </td>
                <td>{kg(series.values[key])}</td>
                <td>{kg(series.values[right[i]])}</td>
                {i === 0 && (
                  <td rowSpan={left.length}>
                    {kg(totals.axles[index].totalKg)}
                  </td>
                )}
              </tr>
            ));
          })}
        </SheetTable>
        <p>
          Gemessene Summen (kg) · Links {kg(totals.leftKg)} · Rechts{' '}
          {kg(totals.rightKg)} · Gesamt {kg(totals.totalKg)}
        </p>
      </section>
    );
  });
}

export function Printable({ project, items, records, archive, innerRef }) {
  return (
    <div className="rec-print-store" aria-hidden="true">
      <article ref={innerRef} className="doc-root" lang="de">
        <div className="doc-brand">ASTRAPLANUNG</div>
        <h1>{archive ? 'Bordakte' : 'Werkstattmappe'}</h1>
        <p className="doc-line">
          {project.name || 'Ausbauprojekt'} · Stand{' '}
          {new Date().toLocaleDateString('de-DE')} · {items.length} Bauteile
        </p>
        {archive ? (
          <>
            <PrintedWheelWeights weighing={project.vehicle?.wheelWeighing} />
            <h2>Bauteile und Wartung</h2>
            {items.map((item) => {
              const card = cardOf(item, records),
                local = fabricationDimensions(item);
              return (
                <section className="doc-card" key={item.id}>
                  <h3>
                    {item.name} · {card.status}
                  </h3>
                  <p>
                    Planmaß L × B × H {dims(item)} mm · Lage X/Y/Z {fmt(item.x)}{' '}
                    / {fmt(item.y)} / {fmt(item.z)} mm · Masse{' '}
                    {hasValue(item.mass) ? fmt(item.mass) + ' kg' : 'offen'}
                    {specification(item, items) &&
                      ' · ' + specification(item, items)}
                  </p>
                  <dl>
                    {cardFields.map(([key, label]) => (
                      <React.Fragment key={key}>
                        <dt>{label}</dt>
                        <dd>{fallback(card[key])}</dd>
                      </React.Fragment>
                    ))}
                    {measurements
                      .filter(([key]) => hasValue(card[key]))
                      .map(([key, plan, label, unit]) => (
                        <React.Fragment key={key}>
                          <dt>{label} (Ist)</dt>
                          <dd>
                            {fmt(card[key])} {unit} ·{' '}
                            {hasValue(local[plan])
                              ? 'Differenz ' +
                                deltaText(card[key], number(local[plan]), unit)
                              : 'Sollwert offen'}
                          </dd>
                        </React.Fragment>
                      ))}
                  </dl>
                  {Array.isArray(card.history) && card.history.length > 0 && (
                    <>
                      <h4>Wartungsverlauf</h4>
                      <SheetTable
                        heads={[
                          'Datum',
                          'Vorgang',
                          'Ausgeführte Arbeit',
                          'Teilekennung',
                        ]}
                      >
                        {card.history.map((entry) => (
                          <tr key={entry.id}>
                            <td>{entry.date}</td>
                            <td>{entry.type}</td>
                            <td>{entry.work}</td>
                            <td>{entry.partNumber || 'offen'}</td>
                          </tr>
                        ))}
                      </SheetTable>
                    </>
                  )}
                  {safePhoto(card.photo) && (
                    <img
                      className="doc-photo"
                      alt={'Einbau von ' + item.name}
                      src={card.photo}
                    />
                  )}
                </section>
              );
            })}
            <RouteSheet items={items} records={records} />
          </>
        ) : (
          <>
            <InventorySheet items={items} records={records} />
            <CutSheet items={items} records={records} />
            <h2>Maßblätter</h2>
            <p>
              Außenmaße entlang der Werkstückachsen, Einbaulage im Fahrzeug in
              mm. X ab Frontwand in Richtung Heck. Maße vor dem Zuschnitt am
              Fahrzeug bestätigen.
            </p>
            {items.map((item) => (
              <section className="doc-figure" key={item.id}>
                <h3>{item.name}</h3>
                <Drawing item={item} />
                <p>
                  L × B × H {dims(item)} mm · X/Y/Z {fmt(item.x)} /{' '}
                  {fmt(item.y)} / {fmt(item.z)} mm ·{' '}
                  {joineryLabels[cutPlan(item, records).method]}
                  {specification(item, items) &&
                    ' · ' + specification(item, items)}
                </p>
              </section>
            ))}
            <RouteSheet items={items} records={records} />
            <h2>Bau- und Prüffolge</h2>
            <ol>
              {records.steps.map((step) => (
                <li key={step.id}>
                  {step.done ? '[x]' : '[ ]'} {step.phase} · {step.title}
                  {step.note ? ' · ' + step.note : ''}
                </li>
              ))}
            </ol>
          </>
        )}
        <p className="doc-line">
          {archive
            ? 'Bei einem Austausch Teilekennung, Datum und Einbauort im Projekt aktualisieren und eine neue Bordakte ausgeben.'
            : 'Vor dem Zuschnitt die Fertigmaße am Fahrzeug bestätigen. Änderungen beim Einbau in der Bordakte dokumentieren.'}
        </p>
      </article>
    </div>
  );
}
