import { useEffect, useRef, useState } from 'react';
import { syncOpenings } from './layout/links.js';
import { activeId, openStore } from './storage.js';
import { createProject, now } from './project.js';

export function useWorkspace() {
  const [projects, setProjects] = useState([]);
  const entries = useRef([]);
  const selected = useRef(null);
  const store = useRef(null),
    queue = useRef(Promise.resolve()),
    pending = useRef(0),
    revisions = useRef(new Map()),
    edits = useRef(0);
  const [status, setStatus] = useState('Lädt');
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [initError, setInitError] = useState('');
  const broadcast = useRef(null);
  function display(list) {
    entries.current = list;
    setProjects([...list]);
  }
  function upsert(p) {
    const list = entries.current;
    display(
      list.some((v) => v.id === p.id)
        ? list.map((v) => (v.id === p.id ? p : v))
        : [...list, p],
    );
  }
  function select(id) {
    selected.current = id;
    activeId(id);
    setProjects([...entries.current]);
  }
  function savedStatus() {
    return store.current?.mode === 'Sitzung'
      ? 'Nur in dieser Sitzung'
      : 'Lokal gespeichert';
  }
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const db = await openStore();
        let list = await db.list();
        if (!list.length) {
          const { saved } = await db.save(
            createProject({ id: 'atlas-01' }),
            -1,
          );
          list = [saved];
        }
        if (!live) return;
        store.current = db;
        list.forEach((p) => revisions.current.set(p.id, p.rev || 0));
        const last = activeId();
        selected.current = list.some((v) => v.id === last) ? last : list[0].id;
        display(list);
        setStatus(savedStatus());
        if (db.mode === 'Sitzung')
          setProblem(
            'Der Browser erlaubt nur Arbeit in dieser Sitzung. Exportiere dein Projekt als Datei, um es zu behalten.',
          );
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('astraplanung-projects-1');
          broadcast.current = channel;
          channel.onmessage = async () => {
            await queue.current;
            if (!live || pending.current) return;
            try {
              const revision = edits.current;
              const fresh = await db.list();
              if (
                !live ||
                pending.current ||
                edits.current !== revision ||
                !fresh.length
              )
                return;
              fresh.forEach((p) => revisions.current.set(p.id, p.rev || 0));
              if (!fresh.some((v) => v.id === selected.current))
                selected.current = fresh[0].id;
              display(fresh);
            } catch {
              /* The active local state remains available. */
            }
          };
        }
      } catch {
        if (live)
          setInitError(
            'Der Projektspeicher konnte nicht geöffnet werden. Prüfe die Speicherfreigabe dieses Browsers und lade die Seite erneut.',
          );
      }
    })();
    return () => {
      live = false;
      broadcast.current?.close();
    };
  }, []);
  function save(p) {
    const next = { ...p, updatedAt: now() };
    upsert(next);
    edits.current++;
    pending.current++;
    setStatus('Speichert …');
    queue.current = queue.current.then(async () => {
      try {
        const result = await store.current.save(
          next,
          revisions.current.get(next.id) || 0,
        );
        revisions.current.set(next.id, result.saved.rev);
        if (result.copy) {
          upsert(result.copy);
          revisions.current.set(result.copy.id, result.copy.rev);
          setNotice(
            'Eine gleichzeitig gespeicherte Version findest du als „Parallelstand“ in deinen Projekten.',
          );
        }
        setProblem(
          store.current.mode === 'Sitzung'
            ? 'Dieses Projekt bitte als Datei sichern.'
            : '',
        );
        if (--pending.current === 0) {
          setStatus(savedStatus());
          broadcast.current?.postMessage(next.id);
        }
      } catch {
        pending.current--;
        setStatus('Speichern fehlgeschlagen');
        setProblem(
          'Der lokale Speicher hat die Änderung nicht übernommen. Sichere deinen aktuellen Stand über Projektdatei → Exportieren.',
        );
      }
    });
  }
  function update(updater) {
    const previous = entries.current.find((p) => p.id === selected.current);
    if (!previous) return;
    const next = typeof updater === 'function' ? updater(previous) : updater;
    if (next && next.id === previous.id && next !== previous)
      save(
        next.items === previous.items
          ? next
          : { ...next, items: syncOpenings(next.items) },
      );
  }
  function add(project) {
    select(project.id);
    save(project);
  }
  async function remove(id) {
    await queue.current;
    if (entries.current.length <= 1)
      throw new Error('Ein Projekt bleibt als Arbeitsbereich geöffnet.');
    await store.current.remove(id, revisions.current.get(id));
    const list = entries.current.filter((p) => p.id !== id);
    if (selected.current === id) select(list[0].id);
    display(list);
    broadcast.current?.postMessage(id);
  }
  return {
    projects,
    project: projects.find((p) => p.id === selected.current),
    status,
    problem,
    notice,
    setNotice,
    initError,
    select,
    update,
    add,
    remove,
  };
}
