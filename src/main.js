/**
 * main.js - inicializacao do B7 Studio Cinema.
 *
 * Liga estado, paineis, previa, linha do tempo, audio e exportacao. Tambem
 * expoe o modo `?render=1`, usado pelo renderizador local (Playwright) e pelos
 * testes automatizados, no qual a interface some e apenas o palco importa.
 */
import { normalizeProject, defaultProject, validateProject, sceneIndexAt } from './storyboard/schema.js';
import { applyPlan } from './storyboard/planner.js';
import { createPlayer } from './app/player.js';
import { createAudioEngine } from './app/audio.js';
import { createTimeline } from './app/timeline.js';
import { createInspector } from './app/inspector.js';
import * as store from './app/store.js';

const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);
const renderMode = params.has('render');

const els = {
  gl: $('#gl'),
  captions: $('#captions'),
  stage: $('#stage'),
  script: $('#script'),
  wordCount: $('#wordCount'),
  sceneList: $('#sceneList'),
  inspector: $('#inspector'),
  timeline: $('#timeline'),
  planNote: $('#planNote'),
  title: $('#projectTitle'),
  tcNow: $('#tcNow'),
  tcTotal: $('#tcTotal'),
  play: $('#btnPlay'),
  toast: $('#toast'),
  modalLocal: $('#modalLocal'),
  modalFile: $('#modalFile'),
  fileInput: $('#fileInput'),
  audioInput: $('#audioInput'),
  savedList: $('#savedList'),
};

let project = normalizeProject(defaultProject());
let selected = 0;
let peaks = [];
let pendingAudio = null;
let busy = false;
let autosaveTimer = 0;

const audio = createAudioEngine();

/* ------------------------------------------------------------------ */
/* utilidades de estado                                               */
/* ------------------------------------------------------------------ */

function retime() {
  let t = 0;
  for (const s of project.scenes) {
    s.startSec = +t.toFixed(3);
    t += +s.durationSec || 0;
  }
  project.durationSec = +t.toFixed(3);
}

function toast(msg, kind = '') {
  els.toast.textContent = msg;
  els.toast.className = `toast ${kind}`;
  els.toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { els.toast.hidden = true; }, 3200);
}

function validate() {
  const r = validateProject(project);
  if (!r.ok) toast(r.errors[0], 'error');
  return r;
}

function selectScene(i) {
  selected = Math.max(0, Math.min(project.scenes.length - 1, i));
  renderSceneList();
  inspector.build();
  timeline.draw();
}

function update(fn, opts = {}) {
  if (typeof fn === 'function') fn(project);
  retime();
  if (opts.select !== undefined) selected = Math.min(project.scenes.length - 1, opts.select);
  selected = Math.min(selected, project.scenes.length - 1);
  if (opts.rebuild) inspector.build();
  renderSceneList();
  timeline.draw();
  renderCurrent();
  scheduleAutosave();
  updateWordCount();
}

let rafRender = 0;
function renderCurrent() {
  cancelAnimationFrame(rafRender);
  rafRender = requestAnimationFrame(() => player.render(true));
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    try {
      const rec = await store.saveProjectRecord(project);
      project.id = rec.id;
    } catch (e) {
      console.warn('autosave falhou', e);
    }
  }, 900);
}

function updateWordCount() {
  const n = (els.script.value.match(/\S+/g) || []).length;
  els.wordCount.textContent = `${n} palavra${n === 1 ? '' : 's'}`;
}

function renderSceneList() {
  els.sceneList.innerHTML = project.scenes
    .map((s, i) => {
      const label = s.caption?.text || s.sourceText || `Cena ${i + 1}`;
      return `<div class="scene-item ${i === selected ? 'active' : ''}" data-scene="${i}">
        <span class="num">${i + 1}</span>
        <span class="t">${escapeHtml(label.slice(0, 34))}<small>${escapeHtml(s.set)} · ${escapeHtml(s.camera.type)}</small></span>
        <span class="dur">${s.durationSec.toFixed(1)}s</span>
      </div>`;
    })
    .join('');
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------------ */
/* player + audio + paineis                                          */
/* ------------------------------------------------------------------ */

const player = createPlayer({
  gl: els.gl,
  caption: els.captions,
  stageEl: els.stage,
  getProject: () => project,
  audio,
  onTime: (t, total) => {
    els.tcNow.textContent = fmt(t);
    els.tcTotal.textContent = fmt(total);
    const idx = sceneIndexAt(project, t);
    if (idx !== selected && !player.playing) {
      selected = idx;
      renderSceneList();
      inspector.build();
    }
    timeline.draw();
  },
  onState: (playing) => {
    els.play.textContent = playing ? '❚❚' : '▶';
  },
  onExternalProject: (p) => {
    project = normalizeProject(p);
    selected = 0;
    retime();
    renderSceneList();
    inspector.build();
    player.render(true);
  },
});

const timeline = createTimeline({
  canvas: els.timeline,
  getProject: () => project,
  getTime: () => player.time,
  getPeaks: () => peaks,
  getSceneIndex: () => selected,
  onSeek: (sec) => player.setTime(sec),
  onSelectScene: (i) => selectScene(i),
});

const inspector = createInspector({
  container: els.inspector,
  getProject: () => project,
  getSceneIndex: () => selected,
  onChange: (fn, opts) => update(fn, opts),
  onSelectScene: selectScene,
  requestAudio: async (kind) => {
    pendingAudio = kind;
    els.audioInput.value = '';
    els.audioInput.click();
  },
  requestRender: () => renderCurrent(),
  toast,
});

const fmt = (s) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
};

/* ------------------------------------------------------------------ */
/* audio                                                              */
/* ------------------------------------------------------------------ */

els.audioInput.addEventListener('change', async () => {
  const file = els.audioInput.files?.[0];
  if (!file || !pendingAudio) return;
  try {
    toast('Decodificando audio...');
    const buffer = await audio.decodeFile(file);
    const kind = pendingAudio.startsWith('music') ? 'music' : 'voice';
    if (kind === 'voice') {
      audio.setVoiceBuffer(buffer, { name: file.name });
      peaks = audio.peaks(buffer, 1400);
      project.voice = { name: file.name, duration: buffer.duration, mediaId: store.mediaId(), type: file.type };
      await store.putMedia(project.voice.mediaId, file);
    } else {
      audio.setMusicBuffer(buffer, { name: file.name });
      project.music = { name: file.name, duration: buffer.duration, mediaId: store.mediaId(), type: file.type };
      await store.putMedia(project.music.mediaId, file);
    }
    toast(`${kind === 'voice' ? 'Narracao' : 'Musica'} importada (${buffer.duration.toFixed(1)} s).`);
    inspector.build();
    timeline.draw();
    scheduleAutosave();
  } catch (err) {
    console.error(err);
    toast('Nao foi possivel ler este audio. Use MP3 ou WAV.', 'error');
  } finally {
    pendingAudio = null;
  }
});

/* ------------------------------------------------------------------ */
/* roteiro e planejamento                                             */
/* ------------------------------------------------------------------ */

els.script.addEventListener('input', () => {
  updateWordCount();
  project.script = els.script.value;
  scheduleAutosave();
});

$('#btnPlan').addEventListener('click', () => {
  const script = els.script.value.trim();
  if (!script) {
    toast('Escreva o roteiro antes de planejar.', 'error');
    return;
  }
  const maxScenes = +$('#planCount').value || 8;
  const res = applyPlan(project, script, {
    maxScenes,
    durationSec: project.voice?.duration || undefined,
  });
  project = normalizeProject(res.project);
  selected = 0;
  retime();
  renderSceneList();
  inspector.build();
  timeline.draw();
  player.setTime(0);
  els.planNote.textContent = res.notes.join(' ');
  toast(`${project.scenes.length} cenas criadas. Revise antes de renderizar.`);
  scheduleAutosave();
});

$('#btnAddScene').addEventListener('click', () => {
  const template = JSON.parse(JSON.stringify(project.scenes[selected] || project.scenes[0]));
  template.id = `s_${Math.random().toString(36).slice(2, 8)}`;
  template.caption = { ...template.caption, text: '' };
  update((p) => p.scenes.splice(selected + 1, 0, template), { rebuild: true, select: selected + 1 });
});

els.sceneList.addEventListener('click', (e) => {
  const item = e.target.closest('.scene-item');
  if (!item) return;
  selectScene(+item.dataset.scene);
  player.setTime(project.scenes[selected].startSec + 0.01);
});

els.title.addEventListener('input', () => {
  project.title = els.title.value;
  scheduleAutosave();
});

/* ------------------------------------------------------------------ */
/* transporte e atalhos                                               */
/* ------------------------------------------------------------------ */

$('#btnPlay').addEventListener('click', () => player.toggle());
$('#btnPrevFrame').addEventListener('click', () => player.stepFrame(-1));
$('#btnNextFrame').addEventListener('click', () => player.stepFrame(1));
$('#btnStart').addEventListener('click', () => { player.pause(); player.setTime(0); });
$('#btnEnd').addEventListener('click', () => { player.pause(); player.setTime(project.durationSec); });
$('#previewRes').addEventListener('change', (e) => player.setResolution(+e.target.value));

window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); player.stepFrame(-1); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); player.stepFrame(1); }
  else if (e.code === 'Home') { e.preventDefault(); player.setTime(0); }
  else if (e.code === 'End') { e.preventDefault(); player.setTime(project.durationSec); }
});

/* ------------------------------------------------------------------ */
/* arquivos e exportacao                                              */
/* ------------------------------------------------------------------ */

$('#btnProjectMenu').addEventListener('click', async () => {
  await refreshSavedList();
  els.modalFile.showModal();
});
$('#btnCloseFile').addEventListener('click', () => els.modalFile.close());

$('#btnExportJson').addEventListener('click', () => {
  store.exportJson(project);
  toast('JSON exportado.');
});

$('#btnImportJson').addEventListener('click', () => {
  els.fileInput.value = '';
  els.fileInput.click();
});

els.fileInput.addEventListener('change', async () => {
  const file = els.fileInput.files?.[0];
  if (!file) return;
  try {
    const { project: p, media } = await store.importFile(file);
    for (const m of media) {
      const isAudio = m.blob.type.startsWith('audio/');
      if (!isAudio) continue;
      const buf = await audio.decodeFile(new File([m.blob], m.name, { type: m.blob.type }));
      if (p.voice && m.name === p.voice.name) {
        audio.setVoiceBuffer(buf);
        peaks = audio.peaks(buf, 1400);
      } else if (p.music && m.name === p.music.name) {
        audio.setMusicBuffer(buf);
      }
    }
    project = normalizeProject(p);
    loadProjectIntoUi();
    toast('Projeto carregado.');
  } catch (err) {
    console.error(err);
    toast('Arquivo invalido. Use .json ou .b7zip do B7 Studio.', 'error');
  }
});

$('#btnOpen').addEventListener('click', () => { els.fileInput.value = ''; els.fileInput.click(); });

$('#btnSave').addEventListener('click', async () => {
  try {
    const rec = await store.saveProjectRecord(project);
    project.id = rec.id;
    toast('Projeto salvo no navegador.');
  } catch (e) {
    toast('Falha ao salvar.', 'error');
  }
});

$('#btnNew').addEventListener('click', () => {
  project = normalizeProject(defaultProject('Novo projeto'));
  loadProjectIntoUi();
  toast('Projeto novo.');
});

document.querySelectorAll('.model-btn').forEach((b) =>
  b.addEventListener('click', async () => {
    if (b.dataset.preset === 'blank') {
      project = normalizeProject(defaultProject('Novo projeto'));
      loadProjectIntoUi();
      return;
    }
    await loadPreset(b.dataset.preset);
    toast('Modelo carregado: Derinkuyu.');
  })
);

$('#btnWebm').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  const btn = $('#btnWebm');
  const old = btn.textContent;
  btn.disabled = true;
  try {
    player.pause();
    const { blob, mime } = await player.exportWebM({
      onProgress: (p) => { btn.textContent = `Gravando ${(p * 100).toFixed(0)}%`; },
    });
    store.downloadBlob(blob, `${store.safeName(project.title)}.webm`);
    toast(`WebM gerado (${mime}). Para MP4 use o renderizador local.`);
  } catch (err) {
    console.error(err);
    toast('Falha ao gravar WebM neste navegador.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = old;
    busy = false;
  }
});

$('#btnLocal').addEventListener('click', () => {
  $('#cmdPreview').textContent = [
    'npm install',
    `npm run render:frames -- ${store.safeName(project.title)}.b7zip`,
    'npm run render:encode -- out/video',
  ].join('\n');
  els.modalLocal.showModal();
});
$('#btnCloseLocal').addEventListener('click', () => els.modalLocal.close());
$('#btnDownloadPack').addEventListener('click', async () => {
  const media = [];
  if (project.voice?.mediaId) {
    const blob = await store.getMedia(project.voice.mediaId);
    if (blob) media.push({ name: `voice.${extFor(blob.type)}`, blob });
  }
  if (project.music?.mediaId) {
    const blob = await store.getMedia(project.music.mediaId);
    if (blob) media.push({ name: `music.${extFor(blob.type)}`, blob });
  }
  const { blob, filename } = await store.exportPackage(project, media);
  store.downloadBlob(blob, filename);
  toast('Pacote gerado. Rode o renderizador local para MP4.');
});

function extFor(type = '') {
  if (type.includes('wav')) return 'wav';
  if (type.includes('mp4') || type.includes('m4a')) return 'm4a';
  return 'mp3';
}

async function refreshSavedList() {
  const list = await store.listProjectRecords();
  els.savedList.innerHTML = list.length
    ? list
        .map((p) => `<div class="saved-row"><span>${escapeHtml(p.title)} <small class="muted">${new Date(p.updatedAt).toLocaleString('pt-BR')}</small></span><button class="mini" data-open="${p.id}">Abrir</button></div>`)
        .join('')
    : '<p class="note">Nenhum projeto salvo neste navegador.</p>';
  els.savedList.querySelectorAll('[data-open]').forEach((b) =>
    b.addEventListener('click', async () => {
      const rec = await store.getProjectRecord(b.dataset.open);
      if (rec) {
        project = normalizeProject(rec);
        loadProjectIntoUi();
        els.modalFile.close();
        toast('Projeto aberto.');
      }
    })
  );
}

function loadProjectIntoUi() {
  retime();
  selected = 0;
  els.title.value = project.title;
  els.script.value = project.script || '';
  renderSceneList();
  inspector.build();
  timeline.draw();
  player.setTime(0);
  updateWordCount();
}

async function loadPreset(name) {
  const url = new URL(`presets/${name}.b7.json`, document.baseURI);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Preset ${name} nao encontrado`);
  const json = await res.json();
  project = normalizeProject(json);
  loadProjectIntoUi();
}

/* ------------------------------------------------------------------ */
/* inicio                                                             */
/* ------------------------------------------------------------------ */

async function boot() {
  if (renderMode) {
    document.body.classList.add('render-mode');
    document.getElementById('app').style.height = '100vh';
    const injected = window.__B7_PROJECT__;
    if (injected) project = normalizeProject(injected);
    else {
      try { await loadPreset('derinkuyu'); } catch { /* usa projeto vazio */ }
    }
    retime();
    els.gl.style.width = '100%';
    els.gl.style.height = '100%';
    player.setResolution(1080);
    player.render(true);
    window.__B7_READY__ = true;
    window.dispatchEvent(new Event('b7-ready'));
    return;
  }

  // tenta restaurar o ultimo projeto salvo; senao abre o piloto
  try {
    const list = await store.listProjectRecords();
    if (list.length) {
      list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      project = normalizeProject(list[0]);
    } else {
      await loadPreset('derinkuyu');
    }
  } catch (e) {
    console.warn(e);
    try { await loadPreset('derinkuyu'); } catch { /* segue com projeto vazio */ }
  }

  els.title.value = project.title;
  els.script.value = project.script || '';
  retime();
  renderSceneList();
  inspector.build();
  timeline.resize();
  timeline.draw();
  player.setResolution(540);
  player.setTime(0);
  updateWordCount();
  window.__B7_READY__ = true;
}

boot();
