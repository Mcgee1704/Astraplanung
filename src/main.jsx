import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Download,
  Folder,
  FolderOpen,
  Home,
  Layers3,
  Menu,
  Plus,
  Route,
  SquareDashed,
  Truck,
  Upload,
  Weight,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import Dashboard from './Dashboard.jsx';
import LayoutPage from './layout/LayoutPage.jsx';
import SystemsPage from './systems/SystemsPage.jsx';
import RecordsPage from './records/RecordsPage.jsx';
import Sources from './Sources.jsx';
import Itinerary from './Itinerary.jsx';
import VehiclePage from './vehicle/VehiclePage.jsx';
import ProjectManager from './ProjectManager.jsx';
import { CompassMark, Modal, go } from './ui.jsx';
import { exportProject, readProject } from './project.js';
import { useWorkspace } from './useWorkspace.js';
import './style.css';

const nav = [
  { id: 'uebersicht', label: 'Übersicht', icon: Home, group: '' },
  { id: 'fahrzeug', label: 'Fahrzeug', icon: Truck, group: 'Planung' },
  { id: 'grundriss', label: 'Grundriss', icon: SquareDashed, group: 'Planung' },
  { id: 'technik', label: 'Bordtechnik', icon: Zap, group: 'Planung' },
  { id: 'reise', label: 'Reiseprofil', icon: Route, group: 'Planung' },
  { id: 'gewicht', label: 'Gewicht & Achsen', icon: Weight, group: 'Planung' },
  {
    id: 'vergleich',
    label: 'Variantenvergleich',
    icon: Layers3,
    group: 'Ausbau',
  },
  { id: 'werkstatt', label: 'Werkstatt', icon: Wrench, group: 'Ausbau' },
  { id: 'bordakte', label: 'Fahrzeugakte', icon: FolderOpen, group: 'Ausbau' },
];
const groups = ['', 'Planung', 'Ausbau'];
function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '').split('/')[0];
  return nav.some((n) => n.id === hash) || hash === 'grundlagen'
    ? hash
    : 'uebersicht';
}
class PageBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: false };
  }
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <section className="panel error-panel">
          <h1>Ansicht konnte nicht geladen werden</h1>
          <p>Die Projektdatei lässt sich über das Menü sichern.</p>
          <button className="btn" onClick={() => go('uebersicht')}>
            Zur Übersicht
          </button>
        </section>
      );
    return this.props.children;
  }
}
function App() {
  const ws = useWorkspace(),
    { project } = ws;
  const [route, setRoute] = useState(currentRoute),
    [manager, setManager] = useState(''),
    [menu, setMenu] = useState(false),
    [mobile, setMobile] = useState(false),
    [fileError, setFileError] = useState('');
  const fileInput = useRef(null),
    menuRef = useRef(null),
    mainRef = useRef(null),
    mobileToggle = useRef(null),
    drawerRef = useRef(null);
  useEffect(() => {
    const change = () => {
      setRoute(currentRoute());
      setMobile(false);
      setMenu(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (!project) return;
    document.title =
      (nav.find((n) => n.id === route)?.label || 'Planungsgrundlagen') +
      ' · ' +
      project.name +
      ' · Astraplanung';
  }, [project?.name, route]);
  useEffect(() => {
    if (!ws.notice) return;
    const timer = setTimeout(() => ws.setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [ws.notice]);
  useEffect(() => {
    if (!menu) return;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(false);
    };
    const key = (e) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, [menu]);
  useEffect(() => {
    if (!mobile) return;
    const ref = drawerRef.current;
    const actions = () =>
      Array.from(ref.querySelectorAll('a,button')).filter(
        (el) => el.offsetParent !== null,
      );
    const key = (e) => {
      if (e.key === 'Escape') {
        setMobile(false);
        mobileToggle.current?.focus();
      }
      if (e.key === 'Tab') {
        const items = actions();
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    actions()[0]?.focus();
    document.body.classList.add('drawer-open');
    document.addEventListener('keydown', key);
    return () => {
      document.body.classList.remove('drawer-open');
      document.removeEventListener('keydown', key);
    };
  }, [mobile]);
  const importClick = () => {
    setMenu(false);
    fileInput.current?.click();
  };
  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = readProject(await file.text());
      ws.add(imported);
      setManager('');
      go('uebersicht');
      ws.setNotice('Projekt als eigene Kopie importiert.');
    } catch (err) {
      setFileError(err.message || 'Diese Datei konnte nicht geöffnet werden.');
    }
  };
  function entryManager(view) {
    setManager(view);
    setMenu(false);
    setMobile(false);
  }
  const link = ({ id, label, icon: Icon }) => (
    <a
      key={id}
      className={'nav-link ' + (route === id ? 'active' : '')}
      aria-current={route === id ? 'page' : undefined}
      href={'#/' + id}
      onClick={() => setMobile(false)}
    >
      <Icon size={19} strokeWidth={1.7} />
      <span>{label}</span>
    </a>
  );
  if (!project)
    return (
      <div className="loading-screen">
        <CompassMark size={46} />
        <h1>Astraplanung</h1>
        <p>{ws.initError || 'Projekt wird geöffnet …'}</p>
        {ws.initError && (
          <button className="btn" onClick={() => location.reload()}>
            Erneut öffnen
          </button>
        )}
      </div>
    );
  let page;
  if (route === 'uebersicht')
    page = (
      <Dashboard project={project} onManage={() => entryManager('settings')} />
    );
  else if (route === 'grundriss')
    page = <LayoutPage project={project} onChange={ws.update} />;
  else if (route === 'fahrzeug')
    page = <VehiclePage project={project} onChange={ws.update} />;
  else if (route === 'grundlagen')
    page = (
      <Sources
        onCreate={(p) => {
          ws.add(p);
          go('grundriss');
          ws.setNotice('Tourengrundriss als neues Projekt geöffnet.');
        }}
      />
    );
  else if (route === 'werkstatt' || route === 'bordakte')
    page = (
      <RecordsPage project={project} onChange={ws.update} section={route} />
    );
  else
    page = (
      <>
        <SystemsPage project={project} onChange={ws.update} section={route} />
        {route === 'reise' && (
          <Itinerary project={project} onChange={ws.update} />
        )}
      </>
    );
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#workspace"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Zum Arbeitsbereich
      </a>
      {mobile && (
        <button
          className="mobile-shade"
          aria-label="Navigation schließen"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={'sidebar ' + (mobile ? 'visible' : '')}
        ref={drawerRef}
        aria-label="Projektnavigation"
      >
        <a
          href="#/uebersicht"
          className="brand"
          onClick={() => setMobile(false)}
        >
          <CompassMark />
          <span>Astraplanung</span>
        </a>
        <nav>
          {groups.map((group) => (
            <div key={group} className="nav-group">
              {group && <h2>{group}</h2>}
              {nav.filter((n) => n.group === group).map(link)}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          {link({
            id: 'grundlagen',
            label: 'Planungsgrundlagen',
            icon: BookOpen,
          })}
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              ref={mobileToggle}
              className="icon-btn mobile-menu"
              aria-label="Navigation öffnen"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <button
              className="crumb-home"
              onClick={() => entryManager('library')}
              aria-label="Meine Projekte öffnen"
            >
              <Home size={16} />
              <span>Projekte</span>
            </button>
            <ChevronRight size={13} />
            <strong>{project.name}</strong>
          </div>
          <div className="top-actions">
            <span
              className={'saved-indicator ' + (ws.problem ? 'warn' : '')}
              role="status"
            >
              <i />
              {ws.status}
            </span>
            <div className="file-menu-wrap" ref={menuRef}>
              <button
                className="btn btn-file"
                aria-expanded={menu}
                onClick={() => setMenu((v) => !v)}
              >
                <Folder size={16} />
                <span>Projektdatei</span>
                <ChevronDown size={14} />
              </button>
              {menu && (
                <div className="file-menu">
                  <button onClick={() => entryManager('library')}>
                    <FolderOpen size={16} />
                    Meine Projekte
                  </button>
                  <button onClick={() => entryManager('new')}>
                    <Plus size={16} />
                    Neues Projekt
                  </button>
                  <button
                    onClick={() => {
                      setMenu(false);
                      exportProject(project);
                    }}
                  >
                    <Download size={16} />
                    Exportieren
                  </button>
                  <button onClick={importClick}>
                    <Upload size={16} />
                    Importieren
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <input
          type="file"
          className="sr-only"
          accept=".json,application/json"
          ref={fileInput}
          onChange={importFile}
          aria-label="Projektdatei importieren"
          tabIndex={-1}
        />
        <main id="workspace" className="workspace" ref={mainRef} tabIndex={-1}>
          {ws.problem && (
            <div role="alert" className="save-warning">
              <CircleAlert size={17} />
              {ws.problem}
              <button className="btn" onClick={() => exportProject(project)}>
                Exportieren
              </button>
            </div>
          )}
          <PageBoundary key={project.id + route}>{page}</PageBoundary>
        </main>
      </div>
      {manager && (
        <ProjectManager
          key={project.id + manager}
          workspace={ws}
          initialView={manager}
          onClose={() => setManager('')}
          onImport={importClick}
        />
      )}
      {fileError && (
        <Modal title="Import prüfen" onClose={() => setFileError('')}>
          <div className="manager-body">
            <p role="alert">{fileError}</p>
            <button className="btn primary" onClick={() => setFileError('')}>
              Schließen
            </button>
          </div>
        </Modal>
      )}
      {ws.notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {ws.notice}
          <button
            aria-label="Meldung schließen"
            onClick={() => ws.setNotice('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
if (
  import.meta.env.PROD &&
  location.protocol !== 'file:' &&
  'serviceWorker' in navigator
) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('./sw.js').catch(() => {}),
  );
}
