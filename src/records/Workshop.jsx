import React, { useState } from 'react';
import {
  Check,
  ClipboardList,
  FileDown,
  Hammer,
  MapPin,
  Plus,
  RotateCcw,
  Ruler,
  Scissors,
  Trash2,
} from 'lucide-react';
import {
  allCuts,
  bill,
  cutPlan,
  fabricationDimensions,
  hasValue,
  joineryLabels,
  number,
  priceValue,
  purchaseStates,
  specification,
  summary,
  uid,
  validCut,
} from './model.js';
import {
  csv,
  dims,
  Drawing,
  eur,
  Field,
  fmt,
  MiniMetric,
  priceText,
  SelectPart,
  SheetTable,
} from './shared.jsx';
import Routes from './Routes.jsx';
import StencilWorkshop from '../stencils/StencilWorkshop.jsx';

function rowPatch(rows, id, patch) {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}
const choiceStyle = (active, className = '') =>
  (active ? 'is-active ' : '') + className;

function Purchasing({ items, records, mutate, updateCard, changeItemCost }) {
  const rows = bill(items, records);
  const total = summary(items, records);
  const [filter, setFilter] = useState('Alle');
  function update(row, patch) {
    if (row.itemId != null) {
      if ('cost' in patch) changeItemCost(row.itemId, priceValue(patch.cost));
      else
        updateCard(row.itemId, {
          ...('state' in patch ? { purchase: patch.state } : {}),
          ...('paid' in patch ? { actualCost: patch.paid } : {}),
        });
    } else
      mutate((r) => ({
        ...r,
        purchases: rowPatch(r.purchases, row.id, patch),
      }));
  }
  function add() {
    setFilter('Alle');
    mutate((r) => ({
      ...r,
      purchases: [
        ...r.purchases,
        {
          id: uid(),
          name: 'Neue Zusatzposition',
          qty: 1,
          unit: 'Stk.',
          cost: '',
          paid: '',
          state: 'Geplant',
          included: false,
        },
      ],
    }));
  }
  function exportCSV() {
    csv(
      [
        [
          'Position',
          'Kenndaten',
          'Menge',
          'Einheit',
          'Planpreis je Einheit EUR',
          'Kaufpreis je Einheit EUR',
          'Erwarteter Betrag EUR',
          'Status',
          'Im Bauteilbudget enthalten',
        ],
        ...rows.map((row) => [
          row.name,
          row.label,
          priceValue(row.qty) ?? 'offen',
          row.unit,
          priceValue(row.cost) ?? 'offen',
          priceValue(row.paid) ?? 'offen',
          row.currentSum ?? 'offen',
          row.state,
          row.included ? 'ja' : 'nein',
        ]),
      ],
      'Astraplanung-Einkauf',
    );
  }
  return (
    <>
      <div className="rec-stats">
        <MiniMetric
          label={total.openPlanned ? 'Bekannte Plansumme' : 'Geplanter Einkauf'}
          value={eur(total.planned)}
          note={
            total.openPlanned
              ? 'Zwischensumme · ' + total.openPlanned + ' offen'
              : ''
          }
        />
        <MiniMetric
          label="Mit erfassten Kaufpreisen"
          value={eur(total.expected)}
          note={
            total.openExpected
              ? 'Zwischensumme · ' + total.openExpected + ' offen'
              : ''
          }
        />
        <MiniMetric
          label="Gekauft oder vorhanden"
          value={total.purchased + ' / ' + total.positions}
        />
      </div>
      <section className="panel rec-panel">
        <div className="rec-section-head">
          <div>
            <h2>Stückliste & Einkauf</h2>
            <p>
              Jedes platzierte Bauteil zählt einmal. Ergänze Verbrauchsmaterial
              oder trage den tatsächlichen Kaufpreis ein.
            </p>
          </div>
          <button className="btn" onClick={exportCSV}>
            <FileDown size={16} /> CSV
          </button>
        </div>
        <div className="rec-action-row">
          <Field
            label="Beschaffung filtern"
            value={filter}
            change={setFilter}
            options={['Alle', ...purchaseStates]}
          />
          <button className="btn" onClick={add}>
            <Plus size={16} /> Zusatzposition
          </button>
        </div>
        <SheetTable
          heads={[
            'Position',
            'Menge',
            'Ansatz / Einheit',
            'Kaufpreis / Einheit',
            'Beschaffung',
            'Summe',
          ]}
          empty="Keine Einkaufsposition entspricht dem gewählten Filter."
        >
          {rows
            .filter((row) => filter === 'Alle' || row.state === filter)
            .map((row) => {
              const fromModel = row.itemId != null;
              const label = (text) => text + ' – ' + row.name;
              return (
                <tr key={(fromModel ? 'm:' : 'x:') + row.id}>
                  <td className="rec-purchase-name">
                    {fromModel ? (
                      <>
                        <strong>{row.name}</strong>
                        {row.label && <small>{row.label}</small>}
                      </>
                    ) : (
                      <>
                        <input
                          aria-label="Bezeichnung der Zusatzposition"
                          value={row.name}
                          onChange={(e) =>
                            update(row, { name: e.target.value })
                          }
                        />
                        <label className="rec-check">
                          <input
                            type="checkbox"
                            checked={Boolean(row.included)}
                            onChange={(e) =>
                              update(row, { included: e.target.checked })
                            }
                          />{' '}
                          Bereits im Bauteilbudget
                        </label>
                        <button
                          className="rec-text-btn"
                          aria-label={label('Zusatzposition entfernen')}
                          onClick={() =>
                            mutate((r) => ({
                              ...r,
                              purchases: r.purchases.filter(
                                (line) => line.id !== row.id,
                              ),
                            }))
                          }
                        >
                          Entfernen
                        </button>
                      </>
                    )}
                  </td>
                  <td>
                    {fromModel ? (
                      '1 Stk.'
                    ) : (
                      <div className="rec-quantity">
                        <input
                          aria-label={label('Menge')}
                          type="number"
                          min="0"
                          step="any"
                          value={row.qty}
                          onChange={(e) => update(row, { qty: e.target.value })}
                        />
                        <select
                          aria-label={label('Einheit')}
                          value={row.unit}
                          onChange={(e) =>
                            update(row, { unit: e.target.value })
                          }
                        >
                          {['Stk.', 'm', 'm²', 'kg', 'l', 'Set'].map((unit) => (
                            <option key={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>
                  <td>
                    <input
                      className="rec-price"
                      aria-label={label('Planpreis in Euro')}
                      type="number"
                      min="0"
                      step=".01"
                      placeholder="offen"
                      value={row.cost ?? ''}
                      onChange={(e) => update(row, { cost: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="rec-price"
                      aria-label={label('Kaufpreis in Euro')}
                      type="number"
                      min="0"
                      step=".01"
                      placeholder="offen"
                      value={row.paid ?? ''}
                      onChange={(e) => update(row, { paid: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={label('Beschaffungsstatus')}
                      value={row.state}
                      onChange={(e) => update(row, { state: e.target.value })}
                    >
                      {purchaseStates.map((state) => (
                        <option key={state}>{state}</option>
                      ))}
                    </select>
                  </td>
                  <td className="rec-nowrap">
                    {row.included ? 'enthalten' : priceText(row.currentSum)}
                  </td>
                </tr>
              );
            })}
        </SheetTable>
      </section>
    </>
  );
}

function Drawings({ items, records, pick, setPick }) {
  if (!pick)
    return (
      <p className="rec-empty">
        Lege im Grundriss ein Bauteil an, um sein Maßblatt zu öffnen.
      </p>
    );
  const cut = cutPlan(pick, records);
  return (
    <section className="panel rec-panel">
      <div className="rec-section-head">
        <div>
          <h2>Maßblatt</h2>
          <p>
            Außenmaße entlang der Werkstückachsen und Einbaulage im Fahrzeug,
            alle Längen in Millimetern.
          </p>
        </div>
        <SelectPart items={items} chosen={pick} setChosen={setPick} />
      </div>
      <figure className="rec-figure">
        <Drawing item={pick} />
        <figcaption>
          <strong>{pick.name}</strong>
          <span>{dims(pick)} mm</span>
        </figcaption>
      </figure>
      <div className="rec-stats rec-inside">
        <MiniMetric label="X ab Frontwand" value={fmt(pick.x) + ' mm'} />
        <MiniMetric label="Y ab linker Wand" value={fmt(pick.y) + ' mm'} />
        <MiniMetric label="Z über Boden" value={fmt(pick.z) + ' mm'} />
      </div>
      <dl className="rec-dl">
        <dt>Material</dt>
        <dd>{pick.material || 'offen'}</dd>
        <dt>Bauweise</dt>
        <dd>{joineryLabels[cut.method]}</dd>
        <dt>Trockenmasse</dt>
        <dd>{hasValue(pick.mass) ? fmt(pick.mass) + ' kg' : 'offen'}</dd>
        {specification(pick, items) && (
          <>
            <dt>Kenndaten</dt>
            <dd>{specification(pick, items)}</dd>
          </>
        )}
      </dl>
      <p className="rec-hint">
        <MapPin size={15} /> Maßangaben vor dem Fertigen am Fahrzeug prüfen.
        Form und Befestigung nach Aufmaß ergänzen.
      </p>
    </section>
  );
}

function Cuts({ items, records, mutate, pick, setPick }) {
  if (!pick)
    return (
      <p className="rec-empty">
        Lege im Grundriss ein Bauteil an, um einen Zuschnitt zu planen.
      </p>
    );
  const plan = cutPlan(pick, records),
    cfg = plan.config,
    size = fabricationDimensions(pick);
  function edit(update) {
    mutate((r) => ({
      ...r,
      cuts: { ...r.cuts, [pick.id]: update(r.cuts[pick.id] ?? {}) },
    }));
  }
  function rowEdit(row, patch) {
    if (row.custom)
      edit((c) => ({ ...c, extra: rowPatch(c.extra ?? [], row.id, patch) }));
    else
      edit((c) => ({
        ...c,
        overrides: {
          ...c.overrides,
          [row.id]: { ...c.overrides?.[row.id], ...patch },
        },
      }));
  }
  function remove(row) {
    edit((c) =>
      row.custom
        ? { ...c, extra: (c.extra ?? []).filter((line) => line.id !== row.id) }
        : { ...c, hidden: [...(c.hidden ?? []), row.id] },
    );
  }
  function reset(row) {
    edit((c) => {
      const overrides = { ...c.overrides };
      delete overrides[row.id];
      return { ...c, overrides };
    });
  }
  function exportCuts() {
    csv(
      [
        [
          'Bauteil',
          'Brett',
          'Anzahl',
          'Länge mm',
          'Breite mm',
          'Stärke mm',
          'Material',
          'Status',
        ],
        ...allCuts(items, records).map((row) => [
          row.itemName,
          row.name,
          number(row.qty),
          number(row.length),
          number(row.width),
          number(row.thickness),
          row.material,
          validCut(row) ? 'Maß vorhanden' : 'Maß prüfen',
        ]),
      ],
      'Astraplanung-Zuschnitte',
    );
  }
  const total = summary(items, records);
  const shapeHints = {
    box: 'Seiten durchgehend, Boden und Deckel dazwischen. Die Rückwand liegt hinten auf. Front, Fachböden und Beschläge bei Bedarf ergänzen.',
    top: 'Die Maße beschreiben die Deck- oder Liegeplatte. Gestell, Auflager und Ausschnitte individuell ergänzen.',
    sheet:
      'Die zwei größten Außenmaße bilden die Plattenfläche. Bei einem mehrlagigen Aufbau die tatsächlichen Einzellagen als eigene Bretter erfassen.',
    custom:
      'Erfasse die am Fahrzeug gemessenen Bretter, ihre Stückzahlen und das Material.',
    bought:
      'Dieses Bauteil erscheint als Zukaufteil in der Stückliste. Für einen Eigenbau lässt sich die Bauweise umstellen.',
  };
  return (
    <>
      <div className="rec-stats">
        <MiniMetric label="Bretter im Projekt" value={fmt(total.pieces)} />
        <MiniMetric
          label="Netto-Plattenfläche"
          value={fmt(total.panelArea) + ' m²'}
        />
        <MiniMetric label="Zuschnittmaß" value="Fertigmaß" />
      </div>
      <section className="panel rec-panel">
        <div className="rec-section-head">
          <div>
            <h2>Plattenzuschnitt</h2>
            <p>
              Die Bauweise bestimmt, welche Maße sich aus dem Grundriss
              ableiten.
            </p>
          </div>
          <button className="btn" onClick={exportCuts}>
            <FileDown size={16} /> Alle als CSV
          </button>
        </div>
        <div className="rec-form-grid">
          <SelectPart items={items} chosen={pick} setChosen={setPick} />
          <Field
            label="Bauweise"
            value={plan.method}
            change={(v) => edit((c) => ({ ...c, method: v }))}
            options={Object.entries(joineryLabels)}
          />
          {plan.method !== 'bought' && (
            <Field
              label="Plattenmaterial"
              value={cfg.material ?? pick.material ?? ''}
              change={(v) => edit((c) => ({ ...c, material: v }))}
            />
          )}
          {['top', 'box', 'sheet'].includes(plan.method) && (
            <Field
              label="Plattenstärke (mm)"
              type="number"
              min=".1"
              step="any"
              value={cfg.thickness ?? plan.thickness}
              change={(v) => edit((c) => ({ ...c, thickness: v }))}
            />
          )}
          {plan.method === 'box' && (
            <Field
              label="Rückwandstärke (mm, 0 = offen)"
              type="number"
              min="0"
              step="any"
              value={cfg.back ?? 4}
              change={(v) => edit((c) => ({ ...c, back: v }))}
            />
          )}
        </div>
        <p className="rec-hint">{shapeHints[plan.method]}</p>
        {plan.issue && (
          <p className="rec-alert" role="status">
            {plan.issue}
          </p>
        )}
        {plan.method !== 'bought' && (
          <>
            <SheetTable
              heads={[
                'Brett',
                'Stk.',
                'L (mm)',
                'B (mm)',
                'D (mm)',
                'Material',
                'Ändern',
              ]}
            >
              {plan.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      aria-label={'Brettbezeichnung ' + row.name}
                      value={row.name}
                      onChange={(e) => rowEdit(row, { name: e.target.value })}
                    />
                    <small>
                      {!validCut(row)
                        ? 'Maß prüfen'
                        : row.custom
                          ? 'Eigenes Brett'
                          : row.changed
                            ? 'Überschrieben'
                            : 'Aus Außenmaß'}
                    </small>
                  </td>
                  {[
                    ['qty', 'Stückzahl'],
                    ['length', 'Zuschnittlänge'],
                    ['width', 'Zuschnittbreite'],
                    ['thickness', 'Zuschnittstärke'],
                  ].map(([key, label]) => (
                    <td key={key}>
                      <input
                        className="rec-cut-num"
                        aria-label={label + ' ' + row.name}
                        type="number"
                        min={key === 'qty' ? 1 : 0.1}
                        step={key === 'qty' ? 1 : 'any'}
                        value={row[key] ?? ''}
                        onChange={(e) =>
                          rowEdit(row, { [key]: e.target.value })
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <input
                      aria-label={'Material ' + row.name}
                      value={row.material ?? ''}
                      onChange={(e) =>
                        rowEdit(row, { material: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <div className="rec-inline">
                      {row.changed && (
                        <button
                          className="rec-icon-btn"
                          title="Abgeleitete Maße wiederherstellen"
                          aria-label={'Maße zurücksetzen ' + row.name}
                          onClick={() => reset(row)}
                        >
                          <RotateCcw size={15} />
                        </button>
                      )}
                      <button
                        className="rec-icon-btn"
                        title="Brett entfernen"
                        aria-label={'Brett entfernen ' + row.name}
                        onClick={() => remove(row)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </SheetTable>
            <div className="rec-action-row">
              <button
                className="btn"
                onClick={() =>
                  edit((c) => ({
                    ...c,
                    extra: [
                      ...(c.extra ?? []),
                      {
                        id: uid(),
                        name: 'Zusatzbrett',
                        qty: 1,
                        length: size.length,
                        width: size.width,
                        thickness: plan.thickness || 15,
                        material: plan.material,
                      },
                    ],
                  }))
                }
              >
                <Plus size={16} /> Brett ergänzen
              </button>
              {Boolean(cfg.hidden?.length) && (
                <button
                  className="rec-text-btn"
                  onClick={() => edit((c) => ({ ...c, hidden: [] }))}
                >
                  Ausgeblendete Standardbretter einblenden
                </button>
              )}
            </div>
            <p className="rec-foot">
              Die Nettofläche schließt Verschnitt aus. Schnittfuge,
              Kantenbearbeitung und verfügbare Plattenformate beim Aufteilen
              berücksichtigen.
            </p>
          </>
        )}
      </section>
    </>
  );
}

function BuildSteps({ records, mutate }) {
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState('Montage');
  const completed = records.steps.filter((step) => step.done).length;
  function change(id, patch) {
    mutate((r) => ({ ...r, steps: rowPatch(r.steps, id, patch) }));
  }
  function add(e) {
    e.preventDefault();
    if (!title.trim()) return;
    mutate((r) => ({
      ...r,
      steps: [
        ...r.steps,
        { id: uid(), title: title.trim(), phase, done: false, custom: true },
      ],
    }));
    setTitle('');
  }
  return (
    <section className="panel rec-panel">
      <div className="rec-section-head">
        <div>
          <h2>Bau- und Prüffolge</h2>
          <p>
            Erfasse Prüfbelege und Abweichungen beim Bau, solange Leitungen und
            Anschlüsse noch zugänglich sind.
          </p>
        </div>
        <span className="rec-pill">
          {completed} / {records.steps.length} erledigt
        </span>
      </div>
      <div
        className="rec-progress"
        role="progressbar"
        aria-label="Baufortschritt"
        aria-valuenow={completed}
        aria-valuemax={records.steps.length || 1}
        aria-valuemin={0}
      >
        <i
          style={{
            width: (100 * completed) / (records.steps.length || 1) + '%',
          }}
        />
      </div>
      <ol className="rec-steps">
        {records.steps.map((step, i) => (
          <li key={step.id}>
            <label className={'rec-step-check ' + (step.done ? 'is-done' : '')}>
              <input
                type="checkbox"
                checked={Boolean(step.done)}
                onChange={(e) => change(step.id, { done: e.target.checked })}
              />
              <span>{step.done ? <Check size={16} /> : i + 1}</span>
              <span className="rec-sr">{step.title} erledigt</span>
            </label>
            <div>
              <small>{step.phase}</small>
              <strong>{step.title}</strong>
              <input
                aria-label={'Prüfvermerk ' + step.title}
                placeholder="Messwert, Nachweis oder offene Frage"
                value={step.note ?? ''}
                onChange={(e) => change(step.id, { note: e.target.value })}
              />
            </div>
            {step.custom && (
              <button
                className="rec-icon-btn"
                aria-label={'Schritt entfernen ' + step.title}
                onClick={() =>
                  mutate((r) => ({
                    ...r,
                    steps: r.steps.filter((s) => s.id !== step.id),
                  }))
                }
              >
                <Trash2 size={16} />
              </button>
            )}
          </li>
        ))}
      </ol>
      <form className="rec-step-form" onSubmit={add}>
        <Field
          label="Weiterer Arbeitsschritt"
          placeholder="z. B. letzte Schrankbefestigung prüfen"
          value={title}
          change={setTitle}
          required
        />
        <Field
          label="Phase"
          value={phase}
          change={setPhase}
          options={[
            'Aufmaß',
            'Rohbau',
            'Installation',
            'Möbelbau',
            'Montage',
            'Prüfung',
            'Übergabe',
          ]}
        />
        <button className="btn" type="submit">
          <Plus size={16} /> Schritt ergänzen
        </button>
      </form>
      <p className="rec-foot">
        Leitungswege und Durchführungen fotografieren, solange sie zugänglich
        sind. Den Prüfvermerk beim betreffenden Arbeitsschritt dokumentieren.
      </p>
    </section>
  );
}

const tabs = [
  ['parts', 'Stückliste', ClipboardList],
  ['draw', 'Maßblätter', Hammer],
  ['cuts', 'Zuschnitte', Scissors],
  ['stencils', 'Schablonen', Ruler],
  ['routes', 'Leitungen', MapPin],
  ['steps', 'Baufolge', Check],
];

export default function Workshop(props) {
  const { items, records, tab, setTab } = props;
  const [id, setId] = useState('');
  const pick = items.find((item) => String(item.id) === String(id)) ?? items[0];
  return (
    <>
      <nav className="rec-tabs" aria-label="Werkstattansichten">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            className={choiceStyle(tab === key)}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setTab(key)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      {tab === 'parts' && <Purchasing {...props} />}
      {tab === 'draw' && (
        <Drawings items={items} records={records} pick={pick} setPick={setId} />
      )}
      {tab === 'cuts' && <Cuts {...props} pick={pick} setPick={setId} />}
      {tab === 'stencils' && (
        <StencilWorkshop
          key={props.project.id}
          items={items}
          records={records}
          mutate={props.mutate}
        />
      )}
      {tab === 'routes' && <Routes {...props} />}
      {tab === 'steps' && <BuildSteps {...props} />}
    </>
  );
}
