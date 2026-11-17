import { useState } from 'react';
import {
  ArrowRight,
  Copy,
  FilePlus2,
  FolderClosed,
  FolderOpen,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  copyProject,
  createProject,
  formatDate,
  stages,
  vehiclePresets,
} from './project.js';
import { layoutVariants } from './layout/templates.js';
import { Modal } from './ui.jsx';

export default function ProjectManager({
  workspace,
  initialView = 'library',
  onClose,
  onImport,
}) {
  const { project, projects, add, update, select, remove, setNotice } =
    workspace;
  const [view, setView] = useState(initialView),
    [name, setName] = useState(initialView === 'new' ? '' : project.name),
    [error, setError] = useState('');
  const [stage, setStage] = useState(project.stage),
    [buildType, setBuildType] = useState(project.buildType || 'Fernreisemobil');
  const [variant, setVariant] = useState('1a'),
    [preset, setPreset] = useState('van'),
    [deleteTarget, setDeleteTarget] = useState(null);
  const startNew = () => {
    setError('');
    setName('');
    setView('new');
  };
  const submit = (e) => {
    e.preventDefault();
    const title = name.trim();
    if (!title) {
      setError('Bitte einen Projektnamen eingeben.');
      return;
    }
    if (view === 'new') {
      add(createProject({ name: title, variant, preset }));
      setNotice('Neues Projekt angelegt.');
    } else {
      update((p) => ({ ...p, name: title, stage, buildType }));
      setNotice('Projektdaten gespeichert.');
    }
    onClose();
  };
  return (
    <Modal
      title={
        view === 'new'
          ? 'Neues Ausbauprojekt'
          : view === 'settings'
            ? 'Projekt verwalten'
            : 'Meine Projekte'
      }
      onClose={onClose}
      wide={view === 'library'}
    >
      {view === 'library' ? (
        <div className="manager-body">
          <div className="manager-toolbar">
            <button className="btn primary" onClick={startNew}>
              <Plus size={16} />
              Neues Projekt
            </button>
            <button className="btn" onClick={onImport}>
              <Upload size={16} />
              Importieren
            </button>
          </div>
          <div className="project-list">
            {[...projects]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((p) => (
                <div className="project-row" key={p.id}>
                  <button
                    className="project-switch"
                    onClick={() => {
                      select(p.id);
                      onClose();
                    }}
                  >
                    <span className="project-mini">
                      <FolderClosed size={20} />
                    </span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.vehicle.name} · {formatDate(p.updatedAt)}
                      </small>
                    </span>
                    {p.id === project.id ? (
                      <span className="active-project">Aktiv</span>
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={'Kopie von ' + p.name + ' anlegen'}
                    title="Als neues Projekt duplizieren"
                    onClick={() => {
                      add(copyProject(p));
                      setNotice('Kopie als neues Projekt geöffnet.');
                      onClose();
                    }}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={p.name + ' löschen'}
                    title="Projekt löschen"
                    disabled={projects.length < 2}
                    onClick={() => setDeleteTarget(p)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
          </div>
          {deleteTarget && (
            <div className="inline-confirm">
              <p>„{deleteTarget.name}“ aus diesem Browser löschen?</p>
              <button className="btn" onClick={() => setDeleteTarget(null)}>
                Abbrechen
              </button>{' '}
              <button
                className="btn danger"
                onClick={async () => {
                  try {
                    await remove(deleteTarget.id);
                    setDeleteTarget(null);
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Projekt löschen
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="manager-body">
          <label className="field">
            <span>Projektname</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={90}
              autoFocus
              placeholder="Name deines Ausbaus"
            />
          </label>
          {view === 'new' ? (
            <>
              <label className="field">
                <span>Basisfahrzeug mit Beispielmaßen</span>
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                >
                  {layoutVariants.find((v) => v.id === variant)?.reference && (
                    <option value="source">
                      Innenmaße des Beispielgrundrisses
                    </option>
                  )}
                  {Object.entries(vehiclePresets).map(([id, v]) => (
                    <option key={id} value={id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Grundriss zum Start</span>
                <select
                  value={variant}
                  onChange={(e) => {
                    setVariant(e.target.value);
                    if (e.target.value.startsWith('tour-')) setPreset('source');
                    else if (e.target.value === 'empty' && preset === 'source')
                      setPreset('van');
                  }}
                >
                  {[
                    ['Planungsbeispiele', false],
                    ['Tourengrundrisse', true],
                  ].map(([group, isTour]) => (
                    <optgroup key={group} label={group}>
                      {layoutVariants
                        .filter((v) => v.id.startsWith('tour-') === isTour)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                  {!layoutVariants.some((v) => v.id === 'empty') && (
                    <option value="empty">Leerer Innenraum</option>
                  )}
                </select>
              </label>
            </>
          ) : (
            <div className="field-grid">
              <label className="field">
                <span>Ausbauart</span>
                <input
                  value={buildType}
                  onChange={(e) => setBuildType(e.target.value)}
                  maxLength={80}
                  required
                />
              </label>
              <label className="field">
                <span>Projektstand</span>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  {stages.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setError('');
                setView('library');
              }}
            >
              <FolderOpen size={15} />
              Meine Projekte
            </button>
            <button type="submit" className="btn primary">
              {view === 'new' ? <FilePlus2 size={15} /> : <Save size={15} />}{' '}
              {view === 'new' ? 'Projekt anlegen' : 'Speichern'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
