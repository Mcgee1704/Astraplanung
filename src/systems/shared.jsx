import React from 'react';
import { CircleAlert, ChevronDown, Plus } from 'lucide-react';
import { systemData, tripData } from './model.js';

export function fmt(value, unit = '', digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value))
    return 'offen';
  if (value === Infinity) return 'ausgeglichen';
  return (
    Number(value).toLocaleString('de-DE', { maximumFractionDigits: digits }) +
    (unit ? ' ' + unit : '')
  );
}
export function days(value) {
  if (value === Infinity) return 'ausgeglichen';
  if (value > 0 && value < 0.1) return '< 0,1 Tage';
  return fmt(value, value === 1 ? 'Tag' : 'Tage', 1);
}
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  'sys-' + Date.now().toString(36) + Math.random().toString(36).slice(2);

export function useModel(project, onChange) {
  const edit = (fn) => onChange((p) => fn(p ?? project));
  const patch = (key, values) =>
    edit((p) => ({
      ...p,
      [key]: {
        ...(key === 'systems'
          ? systemData(p)
          : key === 'trip'
            ? tripData(p)
            : p[key]),
        ...values,
      },
    }));
  const updateItem = (id, values) =>
    edit((p) => ({
      ...p,
      items: p.items.map((it) => (it.id === id ? { ...it, ...values } : it)),
    }));
  const changeList = (key, transform) =>
    edit((p) => {
      const s = systemData(p);
      return { ...p, systems: { ...s, [key]: transform(s[key] || []) } };
    });
  return {
    project,
    edit,
    s: systemData(project),
    t: tripData(project),
    patchTrip: (values) => patch('trip', values),
    patchSystem: (values) => patch('systems', values),
    patchVehicle: (values) => patch('vehicle', values),
    updateItem,
    changeList,
  };
}

export function Head({ title, children }) {
  return (
    <header className="page-head sy-head">
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}
export function Pane({ title, icon: Icon, children, action, sub }) {
  return (
    <section className="panel sy-pane">
      <header className="sy-pane-head">
        <div>
          {Icon && <Icon size={18} aria-hidden="true" />}
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {sub && <p className="sy-caption">{sub}</p>}
      {children}
    </section>
  );
}
export function Notice({ children }) {
  return (
    <div className="sy-notice">
      <CircleAlert size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
export function N({
  label,
  value,
  change,
  unit,
  min = 0,
  max,
  step = 'any',
  whole = false,
  placeholder,
  compact = false,
}) {
  return (
    <label className={'field sy-field' + (compact ? ' sy-compact' : '')}>
      <span>{label}</span>
      <span className="sy-inputunit">
        <input
          aria-label={label}
          type="number"
          value={value ?? ''}
          min={min}
          max={max}
          step={whole ? 1 : step}
          placeholder={placeholder ?? 'offen'}
          onChange={(e) => {
            const raw = e.target.value;
            change(
              raw === '' || !Number.isFinite(e.target.valueAsNumber)
                ? null
                : e.target.valueAsNumber,
            );
          }}
        />
        {unit && <small>{unit}</small>}
      </span>
    </label>
  );
}
export function Percent({ label, value, change }) {
  return (
    <N
      label={label}
      value={value == null ? null : Math.round(value * 10000) / 100}
      unit="%"
      max={100}
      change={(v) => change(v === null ? null : v / 100)}
    />
  );
}
export function Txt({ label, value, change, placeholder, area = false }) {
  return (
    <label className="field sy-field">
      <span>{label}</span>
      {area ? (
        <textarea
          aria-label={label}
          rows={3}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => change(e.target.value)}
        />
      ) : (
        <input
          type="text"
          aria-label={label}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => change(e.target.value)}
        />
      )}
    </label>
  );
}
export function Select({ label, value, change, options }) {
  return (
    <label className="field sy-field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => change(e.target.value)}
      >
        {options.map((opt) =>
          Array.isArray(opt) ? (
            <option key={opt[0]} value={opt[0]}>
              {opt[1]}
            </option>
          ) : (
            <option key={opt}>{opt}</option>
          ),
        )}
      </select>
    </label>
  );
}
export function Check({ label, value, change, disabled = false }) {
  return (
    <label className="sy-check">
      <input
        type="checkbox"
        disabled={disabled}
        checked={Boolean(value)}
        onChange={(e) => change(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function Grid({ children, two = false }) {
  return <div className={'sy-fields' + (two ? ' sy-two' : '')}>{children}</div>;
}
export function Metrics({ rows }) {
  return (
    <dl className="sy-metrics">
      {rows.map(([label, value, Icon]) => (
        <div key={label}>
          <dt>
            {Icon && <Icon size={15} aria-hidden="true" />}
            {label}
          </dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Ledger({ rows }) {
  return (
    <dl className="sy-ledger">
      {rows.map(([label, val]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{val}</dd>
        </div>
      ))}
    </dl>
  );
}
export function More({ title, children, open }) {
  return (
    <details className="sy-more" open={open || undefined}>
      <summary>
        {title}
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div>{children}</div>
    </details>
  );
}
export function Tabs({ tabs, active, set, label }) {
  return (
    <nav className="sy-tabs" aria-label={label}>
      {tabs.map(([key, text, Icon]) => (
        <button
          type="button"
          key={key}
          aria-pressed={active === key}
          className={active === key ? 'active' : ''}
          onClick={() => set(key)}
        >
          {Icon && <Icon size={16} aria-hidden="true" />}
          {text}
        </button>
      ))}
    </nav>
  );
}
export function Add({ children, action }) {
  return (
    <button className="btn sy-add" type="button" onClick={action}>
      <Plus size={15} aria-hidden="true" />
      {children}
    </button>
  );
}
export function BoardItems({ items, kind, model }) {
  const selected = items.filter((it) => it.kind === kind);
  const battery = kind === 'battery';
  if (!selected.length)
    return (
      <p className="sy-caption">
        Im Grundriss ist {battery ? 'keine Aufbaubatterie' : 'kein Solarmodul'}{' '}
        eingeplant.
      </p>
    );
  return (
    <div className="sy-equipment">
      {selected.map((it) => (
        <div className="sy-inlineitem" key={it.id}>
          <strong>{it.name}</strong>
          {battery ? (
            <>
              <N
                compact
                label="Nennspannung"
                value={it.voltage}
                unit="V"
                change={(v) => model.updateItem(it.id, { voltage: v })}
              />
              <N
                compact
                label="Nennkapazität"
                value={it.ah}
                unit="Ah"
                change={(v) => model.updateItem(it.id, { ah: v })}
              />
            </>
          ) : (
            <N
              compact
              label="Modulleistung"
              value={it.watts}
              unit="Wp"
              change={(v) => model.updateItem(it.id, { watts: v })}
            />
          )}
        </div>
      ))}
    </div>
  );
}
