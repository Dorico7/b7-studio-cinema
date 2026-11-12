/**
 * inspector.js - painel direito: propriedades da cena, atores, legenda,
 * efeitos e audio. Tudo sem escrever codigo: apenas campos e seletores.
 */
import {
  SET_CATALOG, CAMERA_MOVES, LIGHTS, LIGHTS_PT, CHARACTERS, CHARACTERS_PT,
  EXPRESSIONS, EXPRESSIONS_PT, POSES, POSES_PT, PROPS, PROPS_PT, CAPTION_STYLES,
  defaultActor,
} from '../storyboard/schema.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const options = (obj, value) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === value ? ' selected' : ''}>${esc(v)}</option>`).join('');

export function createInspector({ container, getProject, getSceneIndex, onChange, onSelectScene, requestAudio, requestRender, toast }) {
  let suppressRebuild = false;

  function build() {
    const p = getProject();
    const i = getSceneIndex();
    const s = p.scenes[i];
    if (!s) {
      container.innerHTML = '<p class="muted">Nenhuma cena.</p>';
      return;
    }
    const actors = s.actors || [];
    container.innerHTML = `
      <div class="insp-section">
        <div class="panel-head"><h2>Cena ${i + 1} de ${p.scenes.length}</h2><span class="muted">${s.durationSec.toFixed(1)} s</span></div>
        <div class="field"><span>Cenario</span>
          <select data-scene="set">${options(Object.fromEntries(Object.entries(SET_CATALOG).map(([k, v]) => [k, v.label])), s.set)}</select>
        </div>
        <div class="field-row">
          <div class="field"><span>Luz</span><select data-scene="light">${options(LIGHTS_PT, s.light)}</select></div>
          <div class="field"><span>Duracao (s)</span><input type="number" min="0.4" max="60" step="0.1" value="${s.durationSec}" data-scene="durationSec" /></div>
        </div>
        <div class="field"><span>Movimento de camera</span>
          <select data-cam="type">${options(CAMERA_MOVES, s.camera.type)}</select>
        </div>
        <div class="field"><span>Intensidade do movimento</span>
          <input type="range" min="0" max="1" step="0.05" value="${s.camera.intensity}" data-cam="intensity" />
        </div>
      </div>

      <div class="insp-section">
        <div class="panel-head"><h2>Atores</h2><button class="mini" data-add-actor="1">+ ator</button></div>
        ${actors.map((a, j) => actorCard(a, j)).join('')}
      </div>

      <div class="insp-section">
        <h3>Legenda</h3>
        <div class="field"><span>Texto (curto, 2 a 5 palavras)</span>
          <input type="text" maxlength="90" value="${esc(s.caption.text)}" data-caption="text" />
        </div>
        <div class="field-row">
          <div class="field"><span>Estilo</span><select data-caption="style">${options(Object.fromEntries(Object.entries(CAPTION_STYLES).map(([k, v]) => [k, v.label])), s.caption.style)}</select></div>
          <div class="field"><span>Altura</span><input type="range" min="0.45" max="0.9" step="0.01" value="${s.caption.y}" data-caption="y" /></div>
        </div>
        <label class="field" style="flex-direction:row;align-items:center;gap:8px">
          <input type="checkbox" ${p.captionsEnabled ? 'checked' : ''} data-project="captionsEnabled" /> <span style="color:var(--text)">Legendas ligadas</span>
        </label>
      </div>

      <div class="insp-section">
        <div class="panel-head"><h2>Efeitos</h2><button class="mini" data-add-fx="1">+ efeito</button></div>
        ${(s.fx || []).length ? (s.fx || []).map((f, k) => `
          <div class="actor-card">
            <div class="actor-head"><span>${esc(f.type)}</span><button class="mini danger" data-del-fx="${k}">remover</button></div>
            <div class="field-row">
              <div class="field"><span>Inicio (s)</span><input type="number" min="0" step="0.1" value="${f.start ?? 0}" data-fx="${k}" data-fx-prop="start" /></div>
              <div class="field"><span>Duracao (s)</span><input type="number" min="0.1" step="0.1" value="${f.duration ?? 1}" data-fx="${k}" data-fx-prop="duration" /></div>
            </div>
            <div class="field"><span>Escala</span><input type="range" min="0.1" max="2" step="0.05" value="${f.scale ?? 0.4}" data-fx="${k}" data-fx-prop="scale" /></div>
          </div>`).join('') : '<p class="note">Sem efeitos nesta cena.</p>'}
      </div>

      <div class="insp-section">
        <h3>Cena</h3>
        <div class="field-row">
          <button data-scene-act="dup">Duplicar</button>
          <button data-scene-act="del" class="danger">Excluir</button>
        </div>
      </div>

      <div class="insp-section">
        <h3>Audio</h3>
        <div class="audio-box">
          <span class="name">${p.voice ? esc(p.voice.name) : 'Sem narracao'}</span>
          <span class="meta">${p.voice ? `${p.voice.duration.toFixed(1)} s` : 'importe um MP3/WAV'}</span>
          <div class="audio-actions">
            <button class="mini" data-audio="voice">${p.voice ? 'Substituir' : 'Importar voz'}</button>
            ${p.voice ? '<button class="mini danger" data-audio="voice-rm">Remover</button>' : ''}
          </div>
        </div>
        <div class="audio-box" style="margin-top:6px">
          <span class="name">${p.music ? esc(p.music.name) : 'Sem musica'}</span>
          <span class="meta">${p.music ? `${p.music.duration.toFixed(1)} s` : 'trilha opcional'}</span>
          <div class="audio-actions">
            <button class="mini" data-audio="music">${p.music ? 'Substituir' : 'Importar musica'}</button>
            ${p.music ? '<button class="mini danger" data-audio="music-rm">Remover</button>' : ''}
          </div>
        </div>
      </div>

      <div class="insp-section">
        <h3>Projeto</h3>
        <div class="field-row">
          <div class="field"><span>FPS</span><select data-project="fps"><option value="24"${p.fps === 24 ? ' selected' : ''}>24</option><option value="30"${p.fps === 30 ? ' selected' : ''}>30</option></select></div>
          <div class="field"><span>Qualidade</span><select data-project="style">
            <option value="eco"${p.style === 'eco' ? ' selected' : ''}>Eco</option>
            <option value="equilibrado"${p.style === 'equilibrado' ? ' selected' : ''}>Equilibrado</option>
            <option value="cinema"${p.style === 'cinema' ? ' selected' : ''}>Cinema leve</option>
          </select></div>
        </div>
      </div>
    `;
  }

  function actorCard(a, j) {
    return `
      <div class="actor-card" data-actor-card="${j}">
        <div class="actor-head"><span>Ator ${j + 1}</span>${j > 0 ? `<button class="mini danger" data-del-actor="${j}">remover</button>` : ''}</div>
        <div class="field"><span>Personagem</span><select data-actor="${j}" data-actor-prop="character">${options(CHARACTERS_PT, a.character)}</select></div>
        <div class="field"><span>Expressao</span><select data-actor="${j}" data-actor-prop="expression">${options(EXPRESSIONS_PT, a.expression)}</select></div>
        <div class="field-row">
          <div class="field"><span>Braco esquerdo</span><select data-actor="${j}" data-actor-prop="L">${options(POSES_PT, a.L)}</select></div>
          <div class="field"><span>Braco direito</span><select data-actor="${j}" data-actor-prop="R">${options(POSES_PT, a.R)}</select></div>
        </div>
        <div class="field"><span>Objeto na mao</span><select data-actor="${j}" data-actor-prop="prop"><option value="">nenhum</option>${options(PROPS_PT, a.prop || '')}</select></div>
        <div class="field-row">
          <div class="field"><span>X</span><input type="number" step="0.1" value="${a.x}" data-actor="${j}" data-actor-prop="x" /></div>
          <div class="field"><span>Z</span><input type="number" step="0.1" value="${a.z}" data-actor="${j}" data-actor-prop="z" /></div>
        </div>
        <div class="field-row">
          <div class="field"><span>Escala</span><input type="range" min="0.4" max="2" step="0.05" value="${a.scale}" data-actor="${j}" data-actor-prop="scale" /></div>
          <div class="field"><span>Invertido</span><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" ${a.flip ? 'checked' : ''} data-actor="${j}" data-actor-prop="flip" /> <span class="muted">espelhar</span></label></div>
        </div>
        <div class="field"><span>Olhar (esq/dir)</span><input type="range" min="-1" max="1" step="0.1" value="${a.look}" data-actor="${j}" data-actor-prop="look" /></div>
      </div>`;
  }

  function scene() {
    return getProject().scenes[getSceneIndex()];
  }

  container.addEventListener('change', (e) => {
    const el = e.target;
    const v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.scene) {
      const prop = el.dataset.scene;
      onChange((p) => {
        const s = p.scenes[getSceneIndex()];
        if (prop === 'durationSec') s.durationSec = Math.max(0.4, Math.min(60, +v || 1));
        else s[prop] = v;
      }, { rebuild: true, retime: prop === 'durationSec' });
    } else if (el.dataset.cam) {
      const prop = el.dataset.cam;
      onChange((p) => {
        const s = p.scenes[getSceneIndex()];
        s.camera[prop] = prop === 'intensity' ? +v : v;
      }, { rebuild: prop !== 'intensity' });
    } else if (el.dataset.actor !== undefined) {
      const j = +el.dataset.actor;
      const prop = el.dataset.actorProp;
      onChange((p) => {
        const a = p.scenes[getSceneIndex()].actors[j];
        if (!a) return;
        if (['x', 'z', 'scale', 'look'].includes(prop)) a[prop] = +v;
        else if (prop === 'flip') a.flip = !!v;
        else if (prop === 'prop') a.prop = v || null;
        else a[prop] = v;
      }, { rebuild: !['x', 'z', 'scale', 'look'].includes(prop) });
    } else if (el.dataset.caption) {
      const prop = el.dataset.caption;
      onChange((p) => {
        const s = p.scenes[getSceneIndex()];
        s.caption[prop] = prop === 'y' ? +v : v;
      }, { rebuild: false });
    } else if (el.dataset.project) {
      const prop = el.dataset.project;
      onChange((p) => {
        if (prop === 'fps') p.fps = +v;
        else if (prop === 'captionsEnabled') p.captionsEnabled = !!v;
        else p[prop] = v;
      }, { rebuild: prop === 'fps' });
    } else if (el.dataset.fx !== undefined) {
      const k = +el.dataset.fx;
      const prop = el.dataset.fxProp;
      onChange((p) => {
        const f = p.scenes[getSceneIndex()].fx[k];
        if (f) f[prop] = +v;
      }, { rebuild: false });
    }
  });

  container.addEventListener('input', (e) => {
    const el = e.target;
    if (el.type === 'range' || el.type === 'number' || el.type === 'text') {
      // reaproveita o mesmo caminho do change, mas sem reconstruir o painel
      const fake = { target: el };
      const v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.caption) {
        onChange((p) => { p.scenes[getSceneIndex()].caption[el.dataset.caption] = el.dataset.caption === 'y' ? +v : v; }, { rebuild: false });
      } else if (el.dataset.actor !== undefined) {
        const prop = el.dataset.actorProp;
        if (['x', 'z', 'scale', 'look'].includes(prop)) {
          onChange((p) => { const a = p.scenes[getSceneIndex()].actors[+el.dataset.actor]; if (a) a[prop] = +v; }, { rebuild: false });
        }
      } else if (el.dataset.cam === 'intensity') {
        onChange((p) => { p.scenes[getSceneIndex()].camera.intensity = +v; }, { rebuild: false });
      } else if (el.dataset.scene === 'durationSec') {
        onChange((p) => { p.scenes[getSceneIndex()].durationSec = Math.max(0.4, Math.min(60, +v || 1)); }, { rebuild: false, retime: true });
      } else if (el.dataset.fx !== undefined) {
        onChange((p) => { const f = p.scenes[getSceneIndex()].fx[+el.dataset.fx]; if (f) f[el.dataset.fxProp] = +v; }, { rebuild: false });
      }
    }
  });

  container.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.addActor) {
      onChange((p) => { p.scenes[getSceneIndex()].actors.push({ ...defaultActor('worker'), x: 1.2, z: 0.6 }); }, { rebuild: true });
    } else if (t.dataset.delActor) {
      onChange((p) => { p.scenes[getSceneIndex()].actors.splice(+t.dataset.delActor, 1); }, { rebuild: true });
    } else if (t.dataset.addFx) {
      onChange((p) => { p.scenes[getSceneIndex()].fx.push({ type: 'dust', x: 0, y: 1.2, z: 0, scale: 0.4, start: 0.2, duration: 1 }); }, { rebuild: true });
    } else if (t.dataset.delFx) {
      onChange((p) => { p.scenes[getSceneIndex()].fx.splice(+t.dataset.delFx, 1); }, { rebuild: true });
    } else if (t.dataset.sceneAct === 'dup') {
      onChange((p) => {
        const i = getSceneIndex();
        const copy = JSON.parse(JSON.stringify(p.scenes[i]));
        copy.id = `s_${Math.random().toString(36).slice(2, 8)}`;
        p.scenes.splice(i + 1, 0, copy);
      }, { rebuild: true, retime: true, select: getSceneIndex() + 1 });
    } else if (t.dataset.sceneAct === 'del') {
      if (getProject().scenes.length <= 1) return toast('O projeto precisa de pelo menos uma cena.', 'error');
      onChange((p) => { p.scenes.splice(getSceneIndex(), 1); }, { rebuild: true, retime: true, select: Math.max(0, getSceneIndex() - 1) });
    } else if (t.dataset.audio) {
      requestAudio(t.dataset.audio);
    }
  });

  return { build };
}
