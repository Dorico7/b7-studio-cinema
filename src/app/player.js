/**
 * player.js - relogio de reproducao, previa e exportacao pelo navegador.
 *
 * O relogio e a fonte de verdade: `renderFrame(segundos)` desenha qualquer
 * instante. Isso permite previa, captura de quadro e renderizacao offline com
 * o mesmo codigo (usado tambem pelo renderizador local via Playwright).
 */
import { createStage } from '../engine/renderer.js';

const fmt = (s) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
};

export function createPlayer({ gl, caption, stageEl, getProject, audio, onTime, onState, onExternalProject }) {
  let stage = createStage({ gl, caption, width: 540, height: 960 });
  let time = 0;
  let playing = false;
  let raf = 0;
  let startedAt = 0;
  let startTime = 0;
  let quality = 540;
  let errorShown = false;

  function duration() {
    return getProject().durationSec || 0;
  }

  function setResolution(px) {
    quality = px;
    const h = Math.round((px * 16) / 9);
    stage.resize(px, h);
    render(true);
  }

  function render(force = false) {
    const p = getProject();
    try {
      stage.renderFrame(Math.min(time, Math.max(0, duration())), p);
      if (errorShown) {
        stageEl.querySelector('.stage-error')?.setAttribute('hidden', '');
        errorShown = false;
      }
    } catch (err) {
      console.error(err);
      const box = stageEl.querySelector('.stage-error');
      if (box) {
        box.hidden = false;
        box.textContent = `Falha ao renderizar a cena:\n${err.message}`;
      }
      errorShown = true;
    }
    onTime?.(time, duration());
  }

  function setTime(t, opts = {}) {
    time = Math.max(0, Math.min(duration(), t));
    if (opts.render !== false) render(true);
    else onTime?.(time, duration());
    if (opts.audio !== false && playing) audio?.play(time);
  }

  function tick() {
    if (!playing) return;
    const now = performance.now();
    const aud = audio?.isPlaying ? audio.currentTime() : null;
    time = Math.min(duration(), aud != null ? aud : startTime + (now - startedAt) / 1000);
    render();
    if (time >= duration() - 0.001) {
      pause();
      time = duration();
      render(true);
      onState?.(false);
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (playing) return;
    if (time >= duration() - 0.01) time = 0;
    playing = true;
    startedAt = performance.now();
    startTime = time;
    audio?.play(time);
    onState?.(true);
    raf = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
    audio?.stop();
    onState?.(false);
  }

  function toggle() {
    if (playing) pause();
    else play();
  }

  function stepFrame(dir) {
    pause();
    const fps = getProject().fps || 30;
    setTime(Math.round((time + dir / fps) * fps) / fps);
  }

  function composite(target, w, h) {
    const ctx = target.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(gl, 0, 0, w, h);
    if (caption) ctx.drawImage(caption, 0, 0, w, h);
    return target;
  }

  async function captureFramePng(sec, w = 1080, h = 1920) {
    const prev = quality;
    if (stage.width !== w) stage.resize(w, h);
    const prevTime = time;
    time = sec;
    stage.renderFrame(sec, getProject());
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const gl2 = gl;
    const cap = caption;
    const ctx = out.getContext('2d');
    ctx.drawImage(gl2, 0, 0, w, h);
    if (cap) ctx.drawImage(cap, 0, 0, w, h);
    const blob = await new Promise((res) => out.toBlob((b) => res(b), 'image/png'));
    if (stage.width !== prev) {
      const ph = Math.round((prev * 16) / 9);
      stage.resize(prev, ph);
    }
    time = prevTime;
    render(true);
    return blob;
  }

  /**
   * Grava WebM em tempo real no navegador (VP9/VP8). Retorna {blob, mime}.
   * Nao gera MP4: para MP4 use o renderizador local (FFmpeg).
   */
  async function exportWebM({ width = 1080, height = 1920, onProgress } = {}) {
    const wasPlaying = playing;
    pause();
    stage.resize(width, height);
    render(true);
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    const stream = out.captureStream(30);
    let dest = null;
    if (audio && (audio.voiceBuffer || audio.musicBuffer)) {
      const c = audio.ensureCtx();
      dest = c.createMediaStreamDestination();
      for (const tr of dest.stream.getAudioTracks()) stream.addTrack(tr);
    }
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: mime })); });
    time = 0;
    render(true);
    audio?.play(0, dest || undefined);
    rec.start(120);
    const t0 = performance.now();
    await new Promise((resolve) => {
      const step = () => {
        const el = (performance.now() - t0) / 1000;
        time = Math.min(duration(), el);
        render();
        ctx.drawImage(gl, 0, 0, width, height);
        if (caption) ctx.drawImage(caption, 0, 0, width, height);
        onProgress?.(time / duration());
        if (time >= duration() - 0.02) return resolve();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    rec.stop();
    audio?.stop();
    const blob = await done;
    const prevH = Math.round((quality * 16) / 9);
    stage.resize(quality, prevH);
    time = 0;
    render(true);
    if (wasPlaying) play();
    return { blob, mime };
  }

  /** usado pelo renderizador local e pelos testes headless */
  function exposeRenderApi() {
    let capCanvas = null;
    window.__B7_STAGE__ = stage;
    window.b7 = {
      loadProject: (p) => {
        onExternalProject?.(p);
        time = 0;
        render(true);
      },
      renderFrame: (sec) => {
        time = sec;
        stage.renderFrame(sec, getProject());
        onTime?.(sec, duration());
        return true;
      },
      duration,
      getProject: () => JSON.parse(JSON.stringify(getProject())),
      /** devolve o quadro composto (video + legendas) em RGBA base64 */
      captureRGBA: () => {
        if (!capCanvas) capCanvas = document.createElement('canvas');
        if (capCanvas.width !== gl.width || capCanvas.height !== gl.height) {
          capCanvas.width = gl.width;
          capCanvas.height = gl.height;
        }
        const ctx = capCanvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, capCanvas.width, capCanvas.height);
        ctx.drawImage(gl, 0, 0);
        if (caption) ctx.drawImage(caption, 0, 0);
        const data = ctx.getImageData(0, 0, capCanvas.width, capCanvas.height).data;
        let s = '';
        const chunk = 8192;
        for (let i = 0; i < data.length; i += chunk) s += String.fromCharCode.apply(null, data.subarray(i, i + chunk));
        return btoa(s);
      },
      setResolution: (w, h) => {
        stage.resize(w, h);
        render(true);
      },
      get time() { return time; },
      ready: true,
    };
  }

  exposeRenderApi();

  return {
    render,
    setTime,
    setResolution,
    play,
    pause,
    toggle,
    stepFrame,
    captureFramePng,
    exportWebM,
    composite,
    getStage: () => stage,
    get time() { return time; },
    get playing() { return playing; },
    get quality() { return quality; },
    fmt,
  };
}
