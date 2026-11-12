/**
 * store.js - persistencia local (IndexedDB) e pacotes de projeto.
 *
 * Nada sai do computador do usuario: projetos e midias ficam no navegador e,
 * ao exportar, viram um arquivo .b7zip (zip) com project.json + midias.
 */
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

const DB_NAME = 'b7studio';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    try {
      result = fn(s);
    } catch (e) {
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
    t.onerror = () => reject(t.error);
  });
}

export async function saveProjectRecord(project) {
  const id = project.id || `p_${Date.now().toString(36)}`;
  const record = { ...project, id, updatedAt: new Date().toISOString() };
  await tx('projects', 'readwrite', (s) => s.put(record));
  return record;
}

export async function listProjectRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('projects', 'readonly');
    const req = t.objectStore('projects').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getProjectRecord(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('projects', 'readonly');
    const req = t.objectStore('projects').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProjectRecord(id) {
  await tx('projects', 'readwrite', (s) => s.delete(id));
}

export async function putMedia(id, blob) {
  await tx('media', 'readwrite', (s) => s.put(blob, id));
}

export async function getMedia(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('media', 'readonly');
    const req = t.objectStore('media').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export const mediaId = () => `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const safeName = (s) =>
  (s || 'projeto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 48) || 'projeto';

export function exportJson(project, filename) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename || `${safeName(project.title)}.json`);
}

/** empacota projeto + midias em um zip .b7zip */
export async function exportPackage(project, media = []) {
  const files = {};
  const projectCopy = JSON.parse(JSON.stringify(project));
  files['project.json'] = strToU8(JSON.stringify(projectCopy, null, 2));
  for (const m of media) {
    if (!m?.blob) continue;
    const buf = new Uint8Array(await m.blob.arrayBuffer());
    files[`media/${m.name}`] = buf;
  }
  files['LEIA-ME.txt'] = strToU8(
    [
      'Pacote do B7 Studio Cinema',
      '',
      '1) npm install',
      '2) npm run render:frames -- este-arquivo.b7zip',
      '3) npm run render:encode -- out/<pasta-gerada>',
      '',
      'O renderizador abre o app no Chromium (Playwright), desenha cada quadro e',
      'o FFmpeg monta o MP4 1080x1920 com o audio. Requer Node 20+, FFmpeg no PATH.',
    ].join('\n')
  );
  const zipped = zipSync(files, { level: 0 });
  const blob = new Blob([zipped], { type: 'application/zip' });
  return { blob, filename: `${safeName(project.title)}.b7zip` };
}

/** le um .b7zip (ou json) e devolve projeto + midias */
export async function importFile(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = file.name.endsWith('.b7zip') || file.name.endsWith('.zip') || (buf[0] === 0x50 && buf[1] === 0x4b);
  if (!isZip) {
    const text = strFromU8(buf);
    return { project: JSON.parse(text), media: [] };
  }
  const files = unzipSync(buf);
  if (!files['project.json']) throw new Error('Pacote sem project.json');
  const project = JSON.parse(strFromU8(files['project.json']));
  const media = [];
  for (const [path, data] of Object.entries(files)) {
    if (!path.startsWith('media/')) continue;
    const name = path.slice(6);
    const type = name.endsWith('.mp3') ? 'audio/mpeg' : name.endsWith('.wav') ? 'audio/wav' : name.endsWith('.m4a') ? 'audio/mp4' : 'application/octet-stream';
    media.push({ name, blob: new Blob([data], { type }) });
  }
  return { project, media };
}
