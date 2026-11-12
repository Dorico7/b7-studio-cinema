/**
 * audio.js - narracao, musica e sincronizacao no preview.
 *
 * O audio importado e decodificado no navegador (sem upload). A previa toca a
 * voz junto com a linha do tempo; a musica entra com volume reduzido e ducking
 * simples quando ha voz. A exportacao usa os mesmos buffers.
 */
export function createAudioEngine() {
  let ctx = null;
  let voiceBuffer = null;
  let musicBuffer = null;
  let voiceNode = null;
  let musicNode = null;
  let voiceGain = null;
  let musicGain = null;
  let startedAt = 0;
  let startOffset = 0;
  let playing = false;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ sampleRate: 48000 });
    }
    return ctx;
  }

  async function decodeFile(file) {
    const c = ensureCtx();
    const buf = await file.arrayBuffer();
    const audio = await c.decodeAudioData(buf.slice(0));
    return audio;
  }

  function peaks(buffer, buckets = 900) {
    if (!buffer) return [];
    const ch = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / buckets));
    const out = [];
    for (let i = 0; i < buckets; i++) {
      let max = 0;
      const start = i * step;
      for (let j = 0; j < step; j += 4) {
        const v = Math.abs(ch[start + j] || 0);
        if (v > max) max = v;
      }
      out.push(max);
    }
    return out;
  }

  function stopNodes() {
    for (const n of [voiceNode, musicNode]) {
      if (n) {
        try { n.stop(); } catch { /* ja parado */ }
      }
    }
    voiceNode = null;
    musicNode = null;
  }

  function play(offsetSec = 0, destination = null) {
    const c = ensureCtx();
    if (c.state === 'suspended') c.resume();
    stopNodes();
    if (!voiceBuffer && !musicBuffer) return;
    const out = destination || c.destination;
    startOffset = Math.max(0, offsetSec);
    startedAt = c.currentTime;
    if (voiceBuffer) {
      voiceNode = c.createBufferSource();
      voiceNode.buffer = voiceBuffer;
      voiceGain = c.createGain();
      voiceGain.gain.value = 1;
      voiceNode.connect(voiceGain).connect(out);
      const off = Math.min(startOffset, voiceBuffer.duration);
      voiceNode.start(0, off);
    }
    if (musicBuffer) {
      musicNode = c.createBufferSource();
      musicNode.buffer = musicBuffer;
      musicNode.loop = true;
      musicGain = c.createGain();
      musicGain.gain.value = voiceBuffer ? 0.16 : 0.5;
      musicNode.connect(musicGain).connect(out);
      musicNode.start(0, startOffset % musicBuffer.duration);
    }
    playing = true;
  }

  function stop() {
    stopNodes();
    playing = false;
  }

  function currentTime() {
    if (!playing) return startOffset;
    return startOffset + (ensureCtx().currentTime - startedAt);
  }

  function setVoiceBuffer(buf, meta = {}) {
    voiceBuffer = buf;
    voiceMeta = { ...meta };
  }

  function setMusicBuffer(buf, meta = {}) {
    musicBuffer = buf;
    musicMeta = { ...meta };
  }

  let voiceMeta = {};
  let musicMeta = {};

  function dispose() {
    stopNodes();
    ctx?.close();
    ctx = null;
    voiceBuffer = musicBuffer = null;
  }

  return {
    ensureCtx,
    decodeFile,
    peaks,
    play,
    stop,
    currentTime,
    setVoiceBuffer,
    setMusicBuffer,
    get voiceBuffer() { return voiceBuffer; },
    get musicBuffer() { return musicBuffer; },
    get voiceMeta() { return voiceMeta; },
    get musicMeta() { return musicMeta; },
    get isPlaying() { return playing; },
    dispose,
  };
}
