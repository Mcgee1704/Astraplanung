import React, { useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronRight,
  CircleDot,
  MapPin,
  Search,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  cardOf,
  cardSearch,
  endName,
  fabricationDimensions,
  hasValue,
  installStates,
  number,
  routesOf,
  specification,
  uid,
} from './model.js';
import {
  cardFields,
  deltaText,
  dims,
  Field,
  fmt,
  measurements,
  safePhoto,
} from './shared.jsx';

async function readPhoto(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Bitte eine JPEG-, PNG- oder WebP-Datei auswählen.');
  if (file.size > 30 * 1024 * 1024)
    throw new Error(
      'Das Foto ist größer als 30 MB. Bitte eine kleinere Bilddatei wählen.',
    );
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 960 / img.naturalWidth, 960 / img.naturalHeight),
      canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx)
      throw new Error('Dieses Gerät kann das Foto gerade nicht verarbeiten.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.77, 0.62, 0.48, 0.34]) {
      const photo = canvas.toDataURL('image/jpeg', quality);
      if (photo.startsWith('data:image/jpeg;base64,') && photo.length < 205000)
        return photo;
    }
    throw new Error(
      'Das Foto enthält zu viele Details. Bitte einen kleineren Ausschnitt wählen.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

const fieldMap = Object.fromEntries(cardFields);
const labels = {
  make: 'Hersteller laut Typenschild',
  product: 'Modellbezeichnung',
  partNumber: 'Nummer für die Nachbestellung',
  serial: 'Seriennummer auf dem Gerät',
  place: 'z. B. unter der linken Sitzbank',
  access: 'Welche Klappe oder Abdeckung führt zum Bauteil?',
  fuse: 'Kennung und Lage der Trennstelle',
  valve: 'Kennung und Lage des Ventils',
  maintenance: 'Arbeit, Intervall und Material',
  note: 'Was wurde vor Ort anders gebaut? Welche Messung steht noch aus?',
};

function ServiceHistory({ card, apply }) {
  const [work, setWork] = useState(''),
    [type, setType] = useState('Wartung');
  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString('sv-SE'),
  );
  const history = Array.isArray(card.history) ? card.history : [];
  function log(event) {
    event.preventDefault();
    if (!work.trim() || !date) return;
    const entry = {
      id: uid(),
      date,
      type,
      work: work.trim(),
      partNumber: card.partNumber,
    };
    apply({
      history: [...history, entry],
      ...(type === 'Prüfung' ? { verified: date } : { serviceDate: date }),
    });
    setWork('');
  }
  return (
    <details className="rec-log">
      <summary>Wartungsverlauf ({history.length})</summary>
      {history.length > 0 && (
        <ol>
          {[...history].reverse().map((entry) => (
            <li key={entry.id}>
              <strong>
                {entry.date} · {entry.type}
              </strong>
              <span>{entry.work}</span>
              {entry.partNumber && (
                <small>Teilekennung zum Eintrag: {entry.partNumber}</small>
              )}
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={log}>
        <div className="rec-form-grid">
          <Field
            label="Vorgang"
            value={type}
            options={['Wartung', 'Prüfung', 'Austausch', 'Reparatur']}
            change={setType}
          />
          <Field
            label="Datum des Eintrags"
            type="date"
            value={date}
            change={setDate}
            required
          />
        </div>
        <Field
          label="Ausgeführte Arbeit"
          long
          value={work}
          change={setWork}
          required
        />
        <button className="btn" type="submit">
          <Wrench size={15} /> Eintrag speichern
        </button>
      </form>
    </details>
  );
}

function CardDetail({ item, items, records, updateCard }) {
  const card = cardOf(item, records),
    local = fabricationDimensions(item);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const routes = routesOf(items, records).filter((route) =>
    [String(route.from), String(route.to)].includes(String(item.id)),
  );
  const apply = (patch) => updateCard(item.id, patch);
  async function photo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setBusy(true);
    setMessage('');
    try {
      apply({ photo: await readPhoto(file) });
    } catch (error) {
      setMessage(error.message || 'Foto konnte nicht gelesen werden.');
    } finally {
      setBusy(false);
    }
  }
  function entry(key, type = 'text', long = false) {
    return (
      <Field
        key={key}
        label={fieldMap[key]}
        value={card[key]}
        type={type}
        long={long}
        placeholder={labels[key]}
        change={(value) => apply({ [key]: value })}
      />
    );
  }
  return (
    <section className="panel rec-panel rec-card-detail">
      <div className="rec-section-head">
        <div>
          <h2>{item.name}</h2>
          <p>
            {specification(item, items) ||
              item.material ||
              'Bauteil im Grundriss'}
          </p>
        </div>
        <Field
          label="Einbaustand"
          value={card.status}
          change={(status) => apply({ status })}
          options={installStates}
        />
      </div>
      <div className="rec-plan-strip">
        <MapPin size={16} />
        <span>
          Planlage X/Y/Z{' '}
          <strong>
            {fmt(item.x)} / {fmt(item.y)} / {fmt(item.z)} mm
          </strong>
        </span>
        <span>
          Außenmaß <strong>{dims(item)} mm</strong>
        </span>
      </div>
      <fieldset className="rec-fieldset">
        <legend>Einbau und Zugang</legend>
        <div className="rec-form-grid">
          {entry('place')}
          {entry('access')}
          {entry('fuse')}
          {entry('valve')}
        </div>
      </fieldset>
      <fieldset className="rec-fieldset">
        <legend>Komponente und Ersatzteil</legend>
        <div className="rec-form-grid">
          {entry('make')}
          {entry('product')}
          {entry('partNumber')}
          {entry('serial')}
        </div>
        {item.kind === 'pump' &&
          [card.partNumber, card.fuse, card.valve].some((v) =>
            String(v).includes('Beispiel'),
          ) && (
            <p className="rec-foot">
              Die Musterkennungen zeigen, wo Ersatzteil und Trennstellen später
              gesucht werden. Beim Einbau mit den tatsächlichen Kennungen
              ersetzen.
            </p>
          )}
      </fieldset>
      <fieldset className="rec-fieldset">
        <legend>Soll und Ist</legend>
        <div className="rec-measurements">
          {measurements.map(([key, model, label, unit]) => {
            const known =
              hasValue(local[model]) && Number.isFinite(Number(local[model]));
            return (
              <div key={key}>
                <Field
                  label={label + ' Ist (' + unit + ')'}
                  value={card[key]}
                  type="number"
                  min={key === 'actualMass' ? '0' : '.1'}
                  step="any"
                  placeholder={known ? fmt(local[model]) : 'offen'}
                  change={(value) => apply({ [key]: value })}
                />
                <small>
                  Soll {known ? fmt(local[model]) + ' ' + unit : 'offen'}
                  {known &&
                    hasValue(card[key]) &&
                    ' · Δ ' +
                      deltaText(number(card[key]), number(local[model]), unit)}
                </small>
              </div>
            );
          })}
        </div>
        {entry('note', 'text', true)}
      </fieldset>
      <fieldset className="rec-fieldset">
        <legend>Wartung und Prüfung</legend>
        {entry('maintenance', 'text', true)}
        <div className="rec-form-grid rec-dates">
          {entry('serviceDate', 'date')}
          {entry('nextDate', 'date')}
          {entry('verified', 'date')}
        </div>
        <ServiceHistory card={card} apply={apply} />
      </fieldset>
      <fieldset className="rec-fieldset">
        <legend>Verbundene Leitungen</legend>
        {routes.length ? (
          <ul className="rec-related-routes">
            {routes.map((route) => (
              <li key={route.id}>
                <span>{route.medium}</span>
                <strong>
                  {endName(route.from, items)} → {endName(route.to, items)}
                </strong>
                <small>
                  {[route.protection, route.route]
                    .filter(Boolean)
                    .join(' · ') ||
                    (route.verified ? 'Am Fahrzeug geprüft' : 'Verlauf offen')}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rec-foot">
            In der Werkstatt lassen sich Leitungswege mit diesem Bauteil
            verbinden.
          </p>
        )}
      </fieldset>
      <fieldset className="rec-fieldset">
        <legend>Einbaufoto</legend>
        {safePhoto(card.photo) && (
          <img
            className="rec-photo"
            alt={'Dokumentierter Einbau von ' + item.name}
            src={card.photo}
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="rec-sr"
          aria-label="Einbaufoto auswählen"
          tabIndex="-1"
          onChange={photo}
        />
        <div className="rec-action-row">
          <button
            className="btn"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Camera size={16} />
            {busy
              ? 'Foto wird verkleinert …'
              : safePhoto(card.photo)
                ? 'Foto ersetzen'
                : 'Foto vom Gerät'}
          </button>
          {safePhoto(card.photo) && (
            <button
              className="rec-text-btn"
              onClick={() => apply({ photo: '' })}
            >
              <Trash2 size={14} /> Foto entfernen
            </button>
          )}
        </div>
        {message && (
          <p role="alert" className="rec-alert">
            {message}
          </p>
        )}
        <p className="rec-foot">
          Das Foto wird verkleinert im Projekt und in der exportierten Bordakte
          gespeichert.
        </p>
      </fieldset>
    </section>
  );
}

export default function Archive({ items, records, updateCard }) {
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('Alle'),
    [selected, setSelected] = useState('');
  const text = search.trim().toLocaleLowerCase('de-DE');
  const results = items.filter(
    (item) =>
      cardSearch(item, records, items).includes(text) &&
      (filter === 'Alle' || cardOf(item, records).status === filter),
  );
  const active = items.find((item) => item.id === selected) ?? results[0];
  const installed = items.filter((item) =>
    installStates.slice(1).includes(cardOf(item, records).status),
  ).length;
  return (
    <div className="rec-archive">
      <aside className="panel rec-card-list">
        <div className="rec-list-top">
          <h2>Bauteile</h2>
          <span>
            {installed} von {items.length} eingebaut
          </span>
        </div>
        <label className="rec-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="Bordakte durchsuchen"
            placeholder="Teil, Ort oder Ersatzteilnummer"
            value={search}
            onChange={(e) => {
              setSelected('');
              setSearch(e.target.value);
            }}
          />
        </label>
        <Field
          label="Einbaustand filtern"
          value={filter}
          change={(value) => {
            setSelected('');
            setFilter(value);
          }}
          options={['Alle', ...installStates]}
        />
        <div className="rec-cards">
          {results.map((item) => {
            const card = cardOf(item, records);
            return (
              <button
                key={item.id}
                type="button"
                aria-current={item.id === active?.id ? 'page' : undefined}
                className={item.id === active?.id ? 'is-active' : ''}
                onClick={() => setSelected(item.id)}
              >
                {card.status === 'Geprüft' ? (
                  <Check size={15} />
                ) : card.status === 'Eingebaut' ? (
                  <Wrench size={15} />
                ) : (
                  <CircleDot size={15} />
                )}
                <span>
                  <strong>{item.name}</strong>
                  <small>{card.place || card.status}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            );
          })}
          {!results.length && (
            <p className="rec-empty">
              {active
                ? 'Der bearbeitete Eintrag ist unter der geänderten Kennung auffindbar.'
                : 'Keine passenden Bauteile.'}
            </p>
          )}
        </div>
        <p className="rec-foot">
          Die Suche findet auch Sicherungskennungen, Einbauorte und
          Wartungseinträge. Nach einem Teiletausch die neue Kennung eintragen
          und die Bordakte erneut exportieren.
        </p>
      </aside>
      {active ? (
        <CardDetail
          key={active.id}
          item={active}
          items={items}
          records={records}
          updateCard={(id, patch) => {
            setSelected(id);
            updateCard(id, patch);
          }}
        />
      ) : (
        <section className="panel rec-panel rec-empty">
          Lege Bauteile im Grundriss an oder passe die Suche an.
        </section>
      )}
    </div>
  );
}
