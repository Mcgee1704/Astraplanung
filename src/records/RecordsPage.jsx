import React, { useRef, useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { partsOf, recordsOf } from './model.js';
import { exportBook, Printable, printBook } from './shared.jsx';
import Archive from './Archive.jsx';
import Workshop from './Workshop.jsx';
import './records.css';

export default function RecordsPage({
  project,
  onChange,
  section = 'werkstatt',
}) {
  const isArchive = section === 'bordakte';
  const records = recordsOf(project),
    items = partsOf(project);
  const printable = useRef(null);
  const [error, setError] = useState('');
  const title =
    (project.name || 'Ausbauprojekt') +
    ' – ' +
    (isArchive ? 'Bordakte' : 'Werkstattmappe');
  function mutate(fn) {
    onChange((current) => ({ ...current, records: fn(recordsOf(current)) }));
  }
  function updateCard(id, patch) {
    mutate((r) => ({
      ...r,
      cards: { ...r.cards, [id]: { ...r.cards[id], ...patch } },
    }));
  }
  function changeItemCost(id, cost) {
    onChange((current) => ({
      ...current,
      items: partsOf(current).map((item) =>
        item.id === id ? { ...item, cost } : item,
      ),
    }));
  }
  return (
    <div className="rec-page">
      <header className="page-head rec-page-head">
        <div>
          <h1>{isArchive ? 'Bordakte' : 'Werkstatt'}</h1>
          <p>
            {isArchive
              ? 'Einbauorte, Ersatzteile und Wartung für unterwegs.'
              : 'Maßblätter, Material und Leitungswege für den Ausbau.'}
          </p>
        </div>
        <div className="rec-header-actions">
          <button
            type="button"
            className="btn"
            onClick={() => exportBook(printable.current, title)}
          >
            <FileDown size={16} /> Offline-Datei
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => printBook(printable.current, title, setError)}
          >
            <Printer size={16} /> {isArchive ? 'Bordakte' : 'Werkstattmappe'}{' '}
            drucken
          </button>
        </div>
      </header>
      {error && (
        <p className="rec-alert" role="alert">
          {error}
        </p>
      )}
      {isArchive ? (
        <Archive {...{ project, items, records, mutate, updateCard }} />
      ) : (
        <Workshop
          {...{ project, items, records, mutate, updateCard, changeItemCost }}
        />
      )}
      <Printable
        project={project}
        items={items}
        records={records}
        archive={isArchive}
        innerRef={printable}
      />
    </div>
  );
}
