import { useMemo, useState } from 'react';
import { sourceVariants } from './source-plans.js';
import { createProject, format } from './project.js';
import { PlanPreview } from './layout/LayoutPage.jsx';
import { ArrowUpRight, BookOpen, Layers, Route, Zap } from 'lucide-react';

const entries = [
  {
    group: 'Grundriss',
    icon: Layers,
    title: 'Nutzbare Innenmaße erfassen',
    text: 'Miss Länge, Breite und Höhe an den engsten Stellen. Erfasse auch Radkästen und die lichte Öffnung der Tür. Bei einem geplanten Bodenaufbau zählt die fertige Fußbodenhöhe.',
    route: 'fahrzeug',
  },
  {
    group: 'Grundriss',
    icon: Layers,
    title: 'Wartungszugang freihalten',
    text: 'Verknüpfe den Tank mit seiner Wartungsklappe. Prüfe Öffnung und Ausbauweg bei eingebautem Bett und montierten Schränken.',
    route: 'grundriss',
  },
  {
    group: 'Bordtechnik',
    icon: Zap,
    title: 'Spannungen und Geräte zuordnen',
    text: 'Wähle die Spannungen von Fahrzeug und Aufbau. Ordne den Verbrauchern ihre Geräte zu und hinterlege den Verlauf jedes Strompfads im Elektroplan.',
    route: 'technik',
  },
  {
    group: 'Bordtechnik',
    icon: Zap,
    title: 'Standzeit für die Etappe vergleichen',
    text: 'Lege Personen, Außentemperatur und Sonnenstunden fest. Vergleiche die gewünschte Standzeit mit Strom, Frischwasser, Abwasser und Heizvorrat.',
    route: 'reise',
  },
  {
    group: 'Praxis',
    icon: BookOpen,
    title: 'Zuschnitt am Fahrzeug bestätigen',
    text: 'Gleiche vor dem Sägen Außenmaße, Plattenstärken und Wandverlauf ab. Abweichende Bretter lassen sich in der Werkstatt einzeln anpassen.',
    route: 'werkstatt',
  },
  {
    group: 'Praxis',
    icon: Route,
    title: 'Ersatzteile unterwegs finden',
    text: 'Erfasse Modell, Ersatzteilnummer und Einbauort. Ein Foto vor dem Schließen der Verkleidung hilft später, Leitungen und Absperrungen zu finden.',
    route: 'bordakte',
  },
];
export default function Sources({ onCreate }) {
  const [variant, setVariant] = useState(sourceVariants[0].id);
  const info = sourceVariants.find((v) => v.id === variant);
  const preview = useMemo(
    () =>
      createProject({ name: info.name, variant: info.id, preset: 'source' }),
    [info],
  );
  const [filter, setFilter] = useState('Alle');
  const openPlan = () => onCreate(preview);
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Planungsgrundlagen</h1>
          <p>
            Wähle einen Tourengrundriss oder öffne die Hinweise für deinen
            nächsten Planungsschritt.
          </p>
        </div>
      </header>
      <div className="segment-bar" aria-label="Planungsbereiche filtern">
        {['Alle', 'Grundriss', 'Bordtechnik', 'Praxis'].map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            className={f === filter ? 'selected' : ''}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {(filter === 'Alle' || filter === 'Grundriss') && (
        <section className="panel source-library">
          <div className="card-heading">
            <h2>
              <Layers size={18} /> Tourengrundrisse
            </h2>
            <span>{sourceVariants.length} Varianten</span>
          </div>
          <div className="source-browser">
            <a
              href="#/grundriss"
              className="source-preview"
              aria-label="Neues Projekt mit gezeigtem Grundriss öffnen"
              onClick={(e) => {
                e.preventDefault();
                openPlan();
              }}
            >
              <PlanPreview project={preview} />
            </a>
            <div className="source-controls">
              <label className="field">
                <span>Tourengrundriss</span>
                <select
                  value={variant}
                  onChange={(e) => setVariant(e.target.value)}
                >
                  {sourceVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {info.description} Innenmaße{' '}
                {info.reference.map((n) => format(n)).join(' × ')} mm.
              </p>
              <button className="btn primary" onClick={openPlan}>
                Als neues Projekt öffnen <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
        </section>
      )}
      <div className="source-list">
        {entries
          .filter((e) => filter === 'Alle' || e.group === filter)
          .map(({ icon: Icon, ...e }) => (
            <article key={e.title} className="panel source-row">
              <span className="source-icon">
                <Icon size={21} />
              </span>
              <div>
                <h2>{e.title}</h2>
                <p>{e.text}</p>
              </div>
              <a
                className="icon-btn"
                href={'#/' + e.route}
                aria-label={e.title + ' in der Planung öffnen'}
              >
                <ArrowUpRight size={18} />
              </a>
            </article>
          ))}
      </div>
      <p className="hint">
        Vor der Bestellung die Maße am Fahrzeug, die tatsächlichen Gewichte und
        die Kennwerte der ausgewählten Geräte im Projekt eintragen.
      </p>
    </>
  );
}
