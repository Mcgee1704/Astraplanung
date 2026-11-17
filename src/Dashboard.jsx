import {
  ArrowRight,
  BatteryCharging,
  Check,
  ChevronRight,
  CircleAlert,
  Coins,
  Droplet,
  Expand,
  FolderPen,
  Ruler,
  ScanLine,
  Weight,
} from 'lucide-react';
import { PlanPreview } from './layout/LayoutPage.jsx';
import { calculate } from './systems/model.js';
import { format, layoutName } from './project.js';
import cover from './assets/atlas-pass.webp';

function Metric({ icon: Icon, label, value, unit, detail, route, tone }) {
  return (
    <a className={'metric ' + tone} href={'#/' + route}>
      <span className="metric-icon">
        <Icon size={26} strokeWidth={1.65} />
      </span>
      <span className="metric-body">
        <span className="metric-label">{label}</span>
        <strong>
          {value}
          {unit && <small> {unit}</small>}
        </strong>
        <span className="metric-detail">{detail}</span>
      </span>
    </a>
  );
}
function CheckRow({ good, title, detail, link }) {
  return (
    <a href={'#/' + link} className="check-row">
      <span className={'check-symbol ' + (good ? 'good' : 'open')}>
        {good ? (
          <Check size={14} strokeWidth={2.6} />
        ) : (
          <CircleAlert size={17} strokeWidth={1.9} />
        )}
      </span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <ChevronRight size={15} />
    </a>
  );
}
export default function Dashboard({ project, onManage }) {
  const v = project.vehicle,
    t = project.trip,
    m = calculate(project);
  const sumKnown = m.massKg != null && v.maxMass > 0;
  const axleKnown = m.frontKg != null && m.rearKg != null;
  const axleOkay =
    axleKnown &&
    v.frontMax > 0 &&
    v.rearMax > 0 &&
    m.frontKg <= v.frontMax &&
    m.rearKg <= v.rearMax;
  const budget = t.budget;
  const goal = t.days;
  return (
    <div className="home-page">
      <header className="page-head">
        <h1>Projektübersicht</h1>
        <button className="btn manage-btn" onClick={onManage}>
          <FolderPen size={16} />
          Projekt verwalten
        </button>
      </header>
      <section
        className="project-cover"
        aria-label={'Aktives Projekt ' + project.name}
      >
        <img
          className="cover-image"
          src={cover}
          alt="Heller Reisekastenwagen auf einem Pass im Atlasgebirge"
        />
        <div className="cover-content">
          <h2>{project.name}</h2>
          <dl>
            <dt>Basisfahrzeug</dt>
            <dd>{v.name}</dd>
            <dt>Reiseprofil</dt>
            <dd>
              {t.people} {t.people === 1 ? 'Person' : 'Personen'} · {t.days}{' '}
              {t.days === 1 ? 'Tag' : 'Tage'} · {t.season}
            </dd>
            <dt>Projektstand</dt>
            <dd>{project.stage}</dd>
          </dl>
          <a className="btn cover-btn" href="#/grundriss">
            <ScanLine size={16} />
            Grundriss öffnen <ArrowRight size={16} />
          </a>
        </div>
      </section>
      <div className="metrics panel">
        <Metric
          icon={Weight}
          label="Reisegewicht"
          value={format(m.massKg)}
          unit="kg"
          detail={'von ' + format(v.maxMass) + ' kg'}
          route="gewicht"
          tone="sage"
        />
        <Metric
          icon={BatteryCharging}
          label="Autarkie"
          value={format(m.autonomyDays, 1)}
          unit="Tage"
          detail={m.limiter || 'Reiseprofil prüfen'}
          route="vergleich"
          tone="olive"
        />
        <Metric
          icon={Droplet}
          label="Frischwasser"
          value={format(m.freshL)}
          unit="l"
          detail={format(m.waterDailyL, 1) + ' l Tagesbedarf'}
          route="technik"
          tone="blue"
        />
        <Metric
          icon={Coins}
          label="Ausbaukosten"
          value={format(m.costEur)}
          unit="€"
          detail={'Plan · Budget ' + format(budget) + ' €'}
          route="werkstatt"
          tone="clay"
        />
      </div>
      <div className="overview-lower">
        <section className="panel plan-summary">
          <div className="card-heading">
            <div>
              <h2>Grundriss</h2>
              <p>{layoutName(project)}</p>
            </div>
            <a
              href="#/grundriss"
              className="icon-btn"
              aria-label="Grundriss im Editor öffnen"
            >
              <Expand size={17} />
            </a>
          </div>
          <a
            href="#/grundriss"
            className="preview-sheet"
            aria-label="Diesen Grundriss bearbeiten"
          >
            <PlanPreview project={project} />
          </a>
          <div className="plan-info">
            <span>
              <Ruler size={15} />
              {v.length > 0 && v.width > 0
                ? format(v.length / 1000, 2) +
                  ' × ' +
                  format(v.width / 1000, 2) +
                  ' m innen'
                : 'Innenaufmaß offen'}
            </span>
            <span>{project.items.length} Bauteile</span>
          </div>
        </section>
        <section className="panel checks">
          <div className="card-heading">
            <h2>Planungsprüfungen</h2>
          </div>
          <CheckRow
            good={sumKnown && m.massKg <= v.maxMass}
            title="Reisegewicht"
            detail={
              sumKnown
                ? format(Math.abs(v.maxMass - m.massKg)) +
                  ' kg ' +
                  (m.massKg <= v.maxMass ? 'Zuladung frei' : 'über der Grenze')
                : 'Fahrzeugmasse ergänzen'
            }
            link="gewicht"
          />
          <CheckRow
            good={axleOkay}
            title="Achslasten"
            detail={
              m.multiAxle
                ? 'Mehrere Achsen · Einzelrad-Messung ansehen'
                : axleKnown
                  ? axleOkay
                    ? 'Innerhalb der Grenzwerte'
                    : 'Grenzwerte prüfen'
                  : 'Wägung ergänzen'
            }
            link="gewicht"
          />
          <CheckRow
            good={m.autonomyDays != null && m.autonomyDays >= goal}
            title="Standzeit"
            detail={
              format(m.autonomyDays, 1) + ' von ' + format(goal, 1) + ' Tagen'
            }
            link="vergleich"
          />
          <CheckRow
            good={budget > 0 && m.costEur != null && m.costEur <= budget}
            title="Ausbaubudget"
            detail={
              budget > 0 && m.costEur != null
                ? format(Math.abs(budget - m.costEur)) +
                  ' € ' +
                  (m.costEur <= budget ? 'verfügbar' : 'über Budget')
                : 'Budget und Preise ergänzen'
            }
            link="werkstatt"
          />
        </section>
      </div>
    </div>
  );
}
