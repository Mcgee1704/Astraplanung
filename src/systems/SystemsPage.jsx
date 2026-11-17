import React from 'react';
import { calculate } from './model.js';
import { Head, useModel } from './shared.jsx';
import Technology from './Technology.jsx';
import { Journey, Weight } from './Journey.jsx';
import Comparison from './Comparison.jsx';
import './systems.css';

const headings = {
  technik: [
    'Bordtechnik',
    'Plane die Versorgung deines Ausbaus und verfolge ihre Wirkung auf einen Reisetag.',
  ],
  reise: [
    'Reiseprofil',
    'Lege fest, wer mitfährt, wo du stehen möchtest und wie lange die eigenen Vorräte reichen sollen.',
  ],
  vergleich: [
    'Variantenvergleich',
    'Prüfe Ausbauentscheidungen am selben Reiseprofil und Fahrzeugmodell.',
  ],
  gewicht: [
    'Gewicht & Achslasten',
    'Prüfe den beladenen Entwurf gegen die zulässigen Gesamt- und Achsmassen.',
  ],
};
export default function SystemsPage({
  project,
  onChange,
  section = 'technik',
}) {
  const model = useModel(project, onChange);
  const r = calculate(project);
  const [title, sub] = headings[section] || headings.technik;
  return (
    <div className="sy-page">
      <Head title={title}>{sub}</Head>
      {section === 'reise' ? (
        <Journey model={model} r={r} />
      ) : section === 'vergleich' ? (
        <Comparison model={model} />
      ) : section === 'gewicht' ? (
        <Weight model={model} r={r} />
      ) : (
        <Technology model={model} r={r} />
      )}
    </div>
  );
}
