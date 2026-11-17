import React from 'react';
import PlanDrawing, { drawingBounds } from './PlanDrawing.jsx';
import { dimensions, formatMM, isRoof } from './geometry.js';
import { downloadFile } from '../project.js';

function Sheet({ project, layer, title, scale }) {
  const b = drawingBounds(project.vehicle);
  return (
    <section className="sheet">
      <h1>{project.name}</h1>
      <h2>{title}</h2>
      <p>
        Innenaufmaß {dimensions(project.vehicle)} mm · 1 : {scale} bei Druck in
        tatsächlicher Größe (100 %)
      </p>
      <div
        style={{
          width: b.width / scale + 'mm',
          height: b.height / scale + 'mm',
        }}
      >
        <PlanDrawing project={project} layer={layer} numbered grid />
      </div>
      <div className="bar" style={{ width: 1000 / scale + 'mm' }} />{' '}
      <small>Kontrollstrecke 1.000 mm im Fahrzeug</small>
      <p>
        X ab vorderer Innenwand zum Heck, Y ab linker Wand nach rechts in
        Fahrtrichtung, Z ab Fußboden nach oben. Alle Maße in mm. Das Fahrerhaus
        ist zur Orientierung skizziert.
      </p>
    </section>
  );
}

export async function printLayout(project) {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.opener = null;
  try {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const b = drawingBounds(project.vehicle);
    const scale = Math.max(
      5,
      Math.ceil(Math.max(b.width / 246, b.height / 115) / 5) * 5,
    );
    const sheets = [
      ['living', 'Möbel und Karosserie'],
      ['systems', 'Bordtechnik unter Dachniveau'],
    ];
    if (project.items.some(isRoof)) sheets.push(['roof', 'Dachbelegung']);
    const report = (
      <html lang="de">
        <head>
          <meta charSet="utf-8" />
          <title>{project.name} · Werkstattgrundriss</title>
          <style>
            {
              '@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:10pt Arial,sans-serif;color:#263e33;margin:0}h1{font-size:20pt;margin:0 0 3mm}h2{font-size:14pt;margin:0 0 2mm}p{margin:1.5mm 0 3mm;max-width:246mm}.sheet{break-after:page}.bar{height:1.2mm;background:#253b31;border-left:1mm solid #253b31;border-right:1mm solid #253b31}table{border-collapse:collapse;width:100%;font-size:9pt}th,td{padding:2mm;text-align:left;border-bottom:.2mm solid #aebaae}thead{display:table-header-group}tr{break-inside:avoid}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
            }
          </style>
        </head>
        <body>
          {sheets.map(([layer, title]) => (
            <Sheet
              key={layer}
              project={project}
              layer={layer}
              title={title}
              scale={scale}
            />
          ))}
          <h1>Aufmaß- und Bauteilliste</h1>
          <p>
            {project.name} · Bezugspunkt ist die vordere linke Bodenecke.
            Laufende Nummern entsprechen den Zeichnungen.
          </p>
          <table>
            <thead>
              <tr>
                {[
                  'Nr.',
                  'Bauteil',
                  'X',
                  'Y',
                  'Z',
                  'L × B × H (mm)',
                  'Material',
                ].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {project.items.map((i, n) => (
                <tr key={i.id}>
                  <td>{n + 1}</td>
                  <td>{i.name}</td>
                  <td>{formatMM(i.x)}</td>
                  <td>{formatMM(i.y)}</td>
                  <td>{formatMM(i.z)}</td>
                  <td>{dimensions(i)}</td>
                  <td>{i.material || 'Offen'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </body>
      </html>
    );
    win.document.open();
    win.document.write('<!doctype html>' + renderToStaticMarkup(report));
    win.document.close();
    win.focus();
    win.setTimeout(() => win.print(), 180);
    return true;
  } catch (err) {
    win.close();
    throw err;
  }
}

export async function exportSvg(project, layer) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const bounds = drawingBounds(project.vehicle);
  const source = renderToStaticMarkup(
    <PlanDrawing project={project} layer={layer} labels grid />,
  );
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const svg = doc.documentElement;
  svg.setAttribute('width', bounds.width + 'mm');
  svg.setAttribute('height', bounds.height + 'mm');
  const safeName = (project.name || 'Grundriss')
    .replace(/[^\p{L}\p{N}_. -]/gu, '-')
    .slice(0, 80);
  downloadFile(
    safeName + '-Grundriss.svg',
    new XMLSerializer().serializeToString(doc),
    'image/svg+xml;charset=utf-8',
  );
}
