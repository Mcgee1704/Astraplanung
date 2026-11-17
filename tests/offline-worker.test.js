import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('Offline-Neustart unter einem Unterpfad lädt Startseite und Modul auch bei Vary: Origin', async () => {
  const scope = 'https://fahrzeug.example/planung/';
  const handlers = new Map();
  const cached = new Map([
    [scope + 'index.html', 'Startseite'],
    [scope + 'assets/anwendung.js', 'Programm'],
  ]);
  const cache = {
    match(url, options) {
      if (url.endsWith('.js') && !options?.ignoreVary) return undefined;
      return cached.get(url);
    },
  };
  const source = await readFile(new URL('../scripts/offline-worker.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    URL,
    buildId: 'test',
    shellPaths: ['./index.html', './assets/anwendung.js'],
    self: {
      registration: { scope },
      addEventListener: (name, handler) => handlers.set(name, handler),
    },
    caches: { open: async () => cache },
    fetch() { throw new Error('Das Gerät ist offline.'); },
  });
  function request(path, mode) {
    let response;
    handlers.get('fetch')({
      request: { url: new URL(path, scope).href, method: 'GET', mode },
      respondWith(value) { response = value; },
    });
    return response;
  }
  assert.equal(await request('./?projekt=van', 'navigate'), 'Startseite');
  assert.equal(await request('assets/anwendung.js', 'cors'), 'Programm');
  assert.equal(request('eigenes-dokument.html', 'navigate'), undefined);
  assert.equal(request('/andere-app/', 'navigate'), undefined);
});
