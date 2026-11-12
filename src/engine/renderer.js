/**
 * renderer.js - palco WebGL do B7 Studio Cinema.
 *
 * Responsabilidades:
 *  - montar a cena a partir do JSON do projeto (cenarios, atores, camera, luz);
 *  - renderizar em duas passadas (cor + normal/profundidade) e aplicar o
 *    contorno de tinta e o grade cinematografico;
 *  - desenhar as legendas em um canvas 2D sobreposto (sempre nitidas);
 *  - expor `renderFrame(segundos)` deterministico para preview e exportacao.
 */
import * as THREE from 'three';
import * as P from './paint.js';
import { Pen, clamp } from './pen.js';
import { character, FX_DRAW } from './cast.js';
import { buildWorld } from './world.js';
import { framingFor } from './camera.js';
import { sceneAt, sceneProgress, sceneIndexAt, CAPTION_STYLES } from '../storyboard/schema.js';

export const PALETTES = {
  day: { skyTop: '#4f92d8', skyHor: '#cfe4f5', sun: '#fff3dc', sunI: 2.5, hemiSky: '#dbeaff', hemiGround: '#8c8266', hemiI: 1.15, fog: '#cfe0ee', fogNear: 30, fogFar: 120, vignette: 0.12, sat: 1.06, cardTint: '#ffffff', exposure: 1.15 },
  golden: { skyTop: '#7a6fb5', skyHor: '#ffc07a', sun: '#ffb46a', sunI: 2.9, hemiSky: '#ffd9b0', hemiGround: '#6b4c3a', hemiI: 1.05, fog: '#f0b98c', fogNear: 24, fogFar: 110, vignette: 0.2, sat: 1.1, cardTint: '#ffe6cc', exposure: 1.2 },
  torch: { skyTop: '#2a1e2c', skyHor: '#6b4438', sun: '#ffb066', sunI: 1.1, hemiSky: '#8a7570', hemiGround: '#3a2a2a', hemiI: 1.0, fog: '#4a3438', fogNear: 10, fogFar: 58, vignette: 0.3, sat: 1.05, cardTint: '#e8c6a8', exposure: 2.1 },
  night: { skyTop: '#101a30', skyHor: '#2c3f5e', sun: '#9db8e6', sunI: 1.0, hemiSky: '#3c5070', hemiGround: '#1a1e28', hemiI: 0.85, fog: '#1b2438', fogNear: 14, fogFar: 70, vignette: 0.28, sat: 1.0, cardTint: '#c3d2ea', exposure: 1.7 },
  cavern: { skyTop: '#241a1e', skyHor: '#4a2c26', sun: '#ffb066', sunI: 0.6, hemiSky: '#f0c9a0', hemiGround: '#4a2a24', hemiI: 1.25, fog: '#3a241f', fogNear: 16, fogFar: 90, vignette: 0.3, sat: 1.06, cardTint: '#f0c8a4', exposure: 2.2 },
  dust: { skyTop: '#9a8f7a', skyHor: '#e0cfae', sun: '#ffe6bc', sunI: 2.1, hemiSky: '#e8dcc4', hemiGround: '#8a7a5c', hemiI: 1.1, fog: '#d8c8a8', fogNear: 6, fogFar: 60, vignette: 0.22, sat: 1.02, cardTint: '#f0e2c8', exposure: 1.25 },
  'pool-night': { skyTop: '#07112c', skyHor: '#1b3152', sun: '#ffd27a', sunI: 0.52, hemiSky: '#536c93', hemiGround: '#18283b', hemiI: 0.82, fog: '#11243b', fogNear: 16, fogFar: 75, vignette: 0.26, sat: 1.18, cardTint: '#fff0cf', exposure: 1.7 },
};

const CARD_PX = { w: 1200, h: 2000 };
const CARD_M = 2.3; // altura do personagem em metros

class ActorCard {
  constructor(scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CARD_PX.w;
    this.canvas.height = CARD_PX.h;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(CARD_M * 0.6, CARD_M);
    geo.translate(0, CARD_M / 2, 0);
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, depthWrite: true });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.userData.isCard = true;
    this.mesh.userData.cardTexture = this.texture;
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.texture, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 1;
    scene.add(this.mesh);
    scene.add(this.blob);
    this.key = '';
    this.mesh.visible = false;
    this.blob.visible = false;
  }

  draw(key, fn) {
    if (this.key === key) return;
    this.key = key;
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, CARD_PX.w, CARD_PX.h);
    g.setTransform(CARD_PX.w / 600, 0, 0, CARD_PX.h / 1000, 0, 0);
    const pen = new Pen(g, { ol: 1 });
    fn(pen);
    this.texture.needsUpdate = true;
  }

  hide() {
    this.mesh.visible = false;
    this.blob.visible = false;
  }
}

let _blobTex = null;
function blobTexture() {
  if (!_blobTex) _blobTex = P.tex(P.radial('20,14,26', 0.55));
  return _blobTex;
}

const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD;
    void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD;
    void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*0.5+0.5, vD); }`,
  side: THREE.DoubleSide,
});

const cardNd = (map) =>
  new THREE.ShaderMaterial({
    uniforms: { map: { value: map } },
    vertexShader: `varying vec2 vUv; varying float vD;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD;
      void main(){ if(texture2D(map, vUv).a < 0.5) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, vD); }`,
    side: THREE.DoubleSide,
  });

export function createStage({ gl, caption, width = 540, height = 960 }) {
  const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.06, 400);

  const skyU = { top: { value: new THREE.Color('#4f92d8') }, hor: { value: new THREE.Color('#cfe4f5') } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(220, 24, 14),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top, hor; varying vec3 vP;
        void main(){ float h = clamp(vP.y, 0.0, 1.0); vec3 c = mix(hor, top, pow(h, 0.6)); gl_FragColor = vec4(c, 1.0); }`,
    })
  );
  sky.userData.isSky = true;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight('#ffffff', '#555555', 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0007;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);
  scene.fog = new THREE.Fog('#cfe0ee', 30, 120);

  // luz de preenchimento que acompanha a camera: garante leitura do assunto
  // em interiores, sem estourar as cenas externas
  const fill = new THREE.PointLight('#ffd9b0', 0, 18, 1.6);
  scene.add(fill);

  const worldRoot = new THREE.Group();
  scene.add(worldRoot);
  const worldCache = new Map();
  let currentWorldKey = null;
  let activeWorld = null;

  const cards = [];
  const overlays = [];

  // ---- alvos de render e pos-processamento ----
  let rtColor = new THREE.WebGLRenderTarget(width, height, { samples: 4, type: THREE.HalfFloatType });
  let rtNd = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsGeo = new THREE.PlaneGeometry(2, 2);
  const fsScene = (mat) => {
    const s = new THREE.Scene();
    s.add(new THREE.Mesh(fsGeo, mat));
    return s;
  };
  const postU = {
    col: { value: rtColor.texture },
    nd: { value: rtNd.texture },
    res: { value: new THREE.Vector2(width, height) },
    px: { value: 1.3 },
    vignette: { value: 0.2 },
    sat: { value: 1.05 },
    flash: { value: 0 },
    fade: { value: 0 },
    warm: { value: 0 },
    exposure: { value: 1 },
  };
  const postScene = fsScene(
    new THREE.ShaderMaterial({
      uniforms: postU,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        uniform sampler2D col, nd; uniform vec2 res; uniform float px, vignette, sat, flash, fade, warm, exposure; varying vec2 vUv;
        float edgeAt(vec2 uv, float r){
          vec4 c = texture2D(nd, uv);
          if (dot(c.rgb, c.rgb) < 0.002) return 0.0;
          float d = c.a;
          vec3 n = c.rgb * 2.0 - 1.0;
          float e = 0.0;
          float rr = r * clamp(6.0 / max(d, 0.05), 0.55, 1.35);
          for (int i = 0; i < 12; i++){
            float a = float(i) * 0.5236;
            vec2 o = vec2(cos(a), sin(a)) * rr / res;
            vec4 s = texture2D(nd, uv + o);
            float ds = s.a;
            vec3 ns = s.rgb * 2.0 - 1.0;
            e = max(e, smoothstep(0.008, 0.03, (ds - d) / max(d, 0.05)));
            if (abs(ds - d) / max(d, 0.05) < 0.08) e = max(e, smoothstep(0.9, 0.65, dot(n, ns)) * 0.85);
          }
          return e * (1.0 - smoothstep(60.0, 160.0, d) * 0.75);
        }
        void main(){
          vec3 c = texture2D(col, vUv).rgb * exposure;
          float e = edgeAt(vUv, px);
          c = mix(c, vec3(0.07, 0.05, 0.07), e);
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, sat);
          c = mix(c, c * vec3(1.06, 1.0, 0.94), warm);
          vec2 q = vUv - 0.5;
          c *= 1.0 - vignette * dot(q * vec2(1.0, 0.78), q * vec2(1.0, 0.78)) * 2.3;
          c = mix(c, vec3(1.0), clamp(flash, 0.0, 1.0));
          c = mix(c, vec3(0.0), clamp(fade, 0.0, 1.0));
          // a cena foi renderizada em espaco linear: converte para sRGB na saida
          c = max(c, vec3(0.0));
          c = pow(c, vec3(1.0 / 2.2));
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );

  // ---- legendas ----
  const capCtx = caption ? caption.getContext('2d') : null;
  let capW = width, capH = height;

  function resizeCanvas(el, w, h) {
    if (!el) return;
    el.width = w;
    el.height = h;
  }

  function resize(w, h, dpr = 1) {
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    rtColor.dispose();
    rtNd.dispose();
    rtColor = new THREE.WebGLRenderTarget(w, h, { samples: 4, type: THREE.HalfFloatType });
    rtNd = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    postU.col.value = rtColor.texture;
    postU.nd.value = rtNd.texture;
    postU.res.value.set(w, h);
    capW = w * dpr;
    capH = h * dpr;
    resizeCanvas(caption, capW, capH);
  }

  if (caption) {
    resizeCanvas(caption, width, height);
    if (caption.style) {
      caption.style.width = '100%';
      caption.style.height = '100%';
    }
  }

  function ensureWorld(setId, params, key) {
    let entry = worldCache.get(key);
    if (!entry) {
      const group = buildWorld(setId, params);
      worldRoot.add(group);
      entry = { group, setId };
      worldCache.set(key, entry);
      if (worldCache.size > 10) {
        const [oldKey, old] = worldCache.entries().next().value;
        if (oldKey !== key) {
          worldRoot.remove(old.group);
          disposeGroup(old.group);
          worldCache.delete(oldKey);
        }
      }
    }
    if (currentWorldKey !== key) {
      for (const [k, v] of worldCache) v.group.visible = k === key;
      currentWorldKey = key;
      activeWorld = entry.group;
    }
    return entry.group;
  }

  function disposeGroup(group) {
    group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          if (m.map && m.map.isCanvasTexture) m.map.dispose();
          m.dispose?.();
        }
      }
    });
  }

  function applyPalette(name, style) {
    const pal = PALETTES[name] || PALETTES.day;
    const eco = style === 'eco';
    hemi.color.set(pal.hemiSky);
    hemi.groundColor.set(pal.hemiGround);
    hemi.intensity = pal.hemiI * (eco ? 0.95 : 1);
    sun.color.set(pal.sun);
    sun.intensity = pal.sunI * (eco ? 0.85 : 1);
    fill.color.set(pal.sun);
    fill.intensity = name === 'torch' ? 11 : name === 'cavern' ? 16 : name === 'night' ? 4 : name === 'dust' ? 4 : name === 'pool-night' ? 9 : 0;
    scene.fog.color.set(pal.fog);
    scene.fog.near = pal.fogNear;
    scene.fog.far = pal.fogFar;
    skyU.top.value.set(pal.skyTop);
    skyU.hor.value.set(pal.skyHor);
    postU.vignette.value = pal.vignette;
    postU.sat.value = pal.sat;
    postU.warm.value = name === 'golden' || name === 'torch' || name === 'pool-night' ? 1 : 0;
    postU.exposure.value = pal.exposure ?? 1.2;
    cardTint = pal.cardTint || '#ffffff';
    renderer.setClearColor(pal.skyHor, 1);
  }

  let cardTint = '#ffffff';

  function placeSun(target) {
    sun.position.set(target[0] + 9, target[1] + 14, target[2] + 8);
    sun.target.position.set(target[0], target[1], target[2]);
    sun.target.updateMatrixWorld();
  }

  function getCard(i) {
    if (!cards[i]) cards[i] = new ActorCard(scene);
    return cards[i];
  }

  function getOverlay(i) {
    if (!overlays[i]) overlays[i] = new ActorCard(scene);
    return overlays[i];
  }

  function actorKey(sceneId, a, f) {
    return [sceneId, a.character, a.expression, a.L, a.R, a.prop, a.flip, a.scale, Math.round(a.look * 10), Math.round(f)].join('|');
  }

  function drawActorOn(card, sceneId, a, camPos, f, seedIndex) {
    const blinkPhase = (f + seedIndex * 13) % 46;
    const blink = blinkPhase < 2 ? 0.55 : blinkPhase < 4 ? 1 : 0;
    const bob = Math.sin((f + seedIndex * 9) * 0.14) * 0.004;
    const key = actorKey(sceneId, a, f) + '|' + blink;
    card.draw(key, (p) => {
      character(p, a.character, {
        expr: a.expression,
        blink,
        look: a.look,
        flip: a.flip,
        seed: 2 + seedIndex * 3,
        L: a.L,
        R: a.R,
        prop: a.prop,
        bob,
        headTilt: a.headTilt || 0,
      });
    });
    card.mesh.visible = true;
    const s = a.scale * (1 + bob);
    card.mesh.position.set(a.x, a.y || 0, a.z);
    card.mesh.scale.set(s, s, s);
    card.mesh.rotation.set(0, Math.atan2(camPos[0] - a.x, camPos[2] - a.z), 0);
    card.material.color.set(cardTint);
    card.blob.visible = (a.y || 0) < 0.3;
    card.blob.position.set(a.x, 0.02, a.z);
    card.blob.scale.setScalar(0.7 * s);
  }

  function clearActors() {
    for (const c of cards) c.hide();
    for (const o of overlays) o.hide();
  }

  function drawFx(scene, t) {
    const list = scene.fx || [];
    list.forEach((fx, i) => {
      const draw = FX_DRAW[fx.type];
      if (!draw) return;
      const card = getOverlay(i);
      const k = clamp((t - (fx.start ?? 0)) / (fx.duration ?? 1));
      const s = (fx.scale ?? 1) * 2.2;
      card.draw(`${scene.id}|${fx.type}|${Math.round(k * 20)}`, (p) => draw(p, fx.type === 'dust' ? k : k * 4, fx.color));
      card.mesh.visible = true;
      card.mesh.position.set(fx.x ?? 0, fx.y ?? 1.2, fx.z ?? 0);
      card.mesh.scale.set(s, s, s);
      card.mesh.rotation.set(0, 0, 0);
      card.material.opacity = 1;
      card.blob.visible = false;
    });
  }

  function drawCaptions(scene, project) {
    if (!capCtx) return;
    capCtx.setTransform(1, 0, 0, 1, 0, 0);
    capCtx.clearRect(0, 0, capW, capH);
    if (!project?.captionsEnabled) return;
    const text = (scene?.caption?.text || '').trim();
    if (!text) return;
    const style = CAPTION_STYLES[scene.caption.style] || CAPTION_STYLES.impact;
    const dpr = capW / width;
    const fontSize = Math.round(height * 0.043 * dpr);
    capCtx.font = `900 ${fontSize}px Inter, "Arial Black", Arial, sans-serif`;
    capCtx.textAlign = 'center';
    capCtx.textBaseline = 'middle';
    capCtx.lineJoin = 'round';
    const maxW = capW * 0.84;
    const words = text.toUpperCase().split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (capCtx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    const lh = fontSize * 1.16;
    const cx = capW / 2;
    const yBase = capH * (scene.caption.y ?? 0.78) - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => {
      const y = yBase + i * lh;
      capCtx.lineWidth = Math.max(6, fontSize * 0.19);
      capCtx.strokeStyle = style.outline;
      capCtx.strokeText(ln, cx, y);
      capCtx.fillStyle = style.color;
      capCtx.fillText(ln, cx, y);
    });
  }

  let lastProject = null;
  let lastSec = -1;
  let lastSceneIdx = -1;

  function renderFrame(sec, project = lastProject) {
    if (!project) return false;
    lastProject = project;
    const idx = sceneIndexAt(project, sec);
    const sceneDef = project.scenes[idx];
    const t = sceneProgress(sceneDef, sec);
    const key = `${sceneDef.set}|${JSON.stringify(sceneDef.setParams || {})}`;
    const world = ensureWorld(sceneDef.set, sceneDef.setParams || {}, key);
    applyPalette(sceneDef.light, project.style);

    const base = world.userData.cam || { pos: [0, 2, 8], look: [0, 1.2, 0], fov: 42 };
    const cam = framingFor(base, { ...sceneDef, startSec: sceneDef.startSec }, t);
    camera.position.set(...cam.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(...cam.look);
    if (cam.roll) camera.rotateZ((cam.roll * Math.PI) / 180);
    camera.fov = cam.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    fill.position.set(cam.pos[0], cam.pos[1] + 0.6, cam.pos[2] + 0.4);
    sky.position.copy(camera.position);
    placeSun(cam.look);
    activeWorld?.userData.animate?.(sec, t);

    clearActors();
    const f = sec * (project.fps || 30);
    (sceneDef.actors || []).forEach((a, i) => {
      if (a.visible === false) return;
      const animated = sceneDef.set === 'pool'
        ? { ...a, y: (a.y || 0) + Math.sin(sec * 2.1 + i) * 0.035, headTilt: Math.sin(sec * 1.6 + i) * 1.4 }
        : a;
      drawActorOn(getCard(i), sceneDef.id, animated, cam.pos, f, i + 1);
    });
    drawFx(sceneDef, t);

    // passada 1: cor
    renderer.setRenderTarget(rtColor);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(scene, camera);

    // passada 2: normal + profundidade
    const fog = scene.fog;
    const shadows = renderer.shadowMap.enabled;
    scene.fog = null;
    renderer.shadowMap.enabled = false;
    swapForNd(true);
    renderer.setRenderTarget(rtNd);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    swapForNd(false);
    scene.fog = fog;
    renderer.shadowMap.enabled = shadows;

    // composicao
    postU.px.value = Math.max(1.0, height / 700);
    postU.flash.value = 0;
    postU.fade.value = 0;
    renderer.setRenderTarget(null);
    renderer.render(postScene, fsCam);

    drawCaptions(sceneDef, project);
    lastSec = sec;
    lastSceneIdx = idx;
    return true;
  }

  function swapForNd(on) {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.isSky) {
        if (on) {
          o.userData.v0 = o.visible;
          o.visible = false;
        } else if (o.userData.v0 !== undefined) {
          o.visible = o.userData.v0;
          delete o.userData.v0;
        }
        return;
      }
      if (on) {
        o.userData.mat0 = o.material;
        if (o.userData.isCard) {
          o.material = cardNd(o.userData.cardTexture);
          o.userData.ndMat = o.material;
        } else {
          o.material = ndMat;
        }
      } else {
        o.material = o.userData.mat0;
        o.userData.ndMat?.dispose?.();
        delete o.userData.ndMat;
      }
    });
  }

  function dispose() {
    for (const [, v] of worldCache) {
      worldRoot.remove(v.group);
      disposeGroup(v.group);
    }
    worldCache.clear();
    rtColor.dispose();
    rtNd.dispose();
    renderer.dispose();
  }

  resize(width, height);

  return {
    renderer,
    scene,
    camera,
    renderFrame,
    resize,
    dispose,
    get width() { return width; },
    get height() { return height; },
    get sceneIndex() { return lastSceneIdx; },
    get time() { return lastSec; },
  };
}
