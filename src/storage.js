import { uid, now } from './project.js';

const namespace = 'astraplanung.projects.';
const writer = uid();
function commitDraft(previous, project, expectedRevision) {
  if (previous && expectedRevision === -1)
    return { saved: previous, copy: null };
  const conflict =
    previous &&
    (previous.rev || 0) !== expectedRevision &&
    previous.writer !== writer;
  const copy = conflict
    ? {
        ...previous,
        id: uid(),
        name: previous.name + ' · Parallelstand',
        updatedAt: now(),
        rev: 1,
      }
    : null;
  const saved = { ...project, rev: (previous?.rev || 0) + 1, writer };
  return { saved, copy };
}
function browserStore(db) {
  return {
    mode: 'Datenbank',
    list: () =>
      new Promise((resolve, reject) => {
        const request = db
          .transaction('projects')
          .objectStore('projects')
          .getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
    save: (project, rev) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        const request = store.get(project.id);
        let result;
        request.onsuccess = () => {
          result = commitDraft(request.result, project, rev);
          if (result.copy) store.put(result.copy);
          store.put(result.saved);
        };
        tx.oncomplete = () => resolve(result);
        tx.onabort = tx.onerror = () =>
          reject(tx.error || new Error('Schreibvorgang abgebrochen'));
      }),
    remove: (id, rev) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        const count = store.count();
        const req = store.get(id);
        req.onsuccess = () => {
          if (count.result < 2 || (req.result && req.result.rev !== rev)) {
            tx.abort();
            return;
          }
          store.delete(id);
        };
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () =>
          reject(new Error('Der Projektstand wurde inzwischen geändert.'));
      }),
  };
}
function localStore(storage) {
  return {
    mode: storage ? 'Browserspeicher' : 'Sitzung',
    list: async () =>
      Object.keys(storage)
        .filter((key) => key.startsWith(namespace))
        .map((key) => JSON.parse(storage.getItem(key))),
    save: async (project, rev) => {
      const previous = JSON.parse(
        storage.getItem(namespace + project.id) || 'null',
      );
      const result = commitDraft(previous, project, rev);
      if (result.copy)
        storage.setItem(
          namespace + result.copy.id,
          JSON.stringify(result.copy),
        );
      storage.setItem(namespace + project.id, JSON.stringify(result.saved));
      return result;
    },
    remove: async (id, rev) => {
      if (
        Object.keys(storage).filter((key) => key.startsWith(namespace)).length <
        2
      )
        throw new Error('Ein Projekt bleibt als Arbeitsbereich geöffnet.');
      const previous = JSON.parse(storage.getItem(namespace + id) || 'null');
      if (previous && previous.rev !== rev)
        throw new Error('Der Projektstand wurde inzwischen geändert.');
      storage.removeItem(namespace + id);
    },
  };
}
let opened;
export function openStore() {
  return (opened ||= (async () => {
    try {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('astraplanung-workspace', 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('projects', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Browserspeicher belegt'));
      });
      return browserStore(db);
    } catch {
      try {
        localStorage.setItem('astra-test', '1');
        localStorage.removeItem('astra-test');
        return localStore(localStorage);
      } catch {
        const memory = new Map();
        return {
          mode: 'Sitzung',
          list: async () => Array.from(memory.values()),
          save: async (p, r) => {
            const result = commitDraft(memory.get(p.id), p, r);
            memory.set(p.id, result.saved);
            return result;
          },
          remove: async (id) => memory.delete(id),
        };
      }
    }
  })());
}
export function activeId(id) {
  try {
    if (id) localStorage.setItem('astraplanung.active', id);
    return localStorage.getItem('astraplanung.active');
  } catch {
    return null;
  }
}
