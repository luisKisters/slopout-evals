import * as THREE from 'three';

// ============ RENDERER / SCENE ============
const container = document.getElementById('game');
const params = new URLSearchParams(location.search);
const LOW = params.has('low');
const renderer = new THREE.WebGLRenderer({ antialias: !LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(LOW ? 0.75 : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1440);
scene.fog = new THREE.Fog(0x2a1a4e, 150, 900);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(0, 6, -14);

const hemi = new THREE.HemisphereLight(0xffb36b, 0x3a4a6b, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xff9a3c, 1.6);
sun.position.set(-180, 140, -120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
sun.shadow.camera.far = 600;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x8fb4ff, 0.55);
fill.position.set(200, 90, 180);
scene.add(fill);
scene.add(new THREE.AmbientLight(0x606080, 0.5));

// Sunset sky dome
{
  const geo = new THREE.SphereGeometry(2200, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x0b1035) }, mid: { value: new THREE.Color(0xb33a6b) }, bot: { value: new THREE.Color(0xff8c3a) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top,mid,bot;
      void main(){ float h=normalize(vP).y; vec3 c=h>0.12? mix(mid,top,smoothstep(0.12,0.7,h)) : mix(bot,mid,smoothstep(-0.08,0.12,h));
      // sun glow
      vec3 sd=normalize(vec3(-0.55,0.18,-0.35)); vec3 d=normalize(vP);
      float s=pow(max(dot(d,sd),0.0),24.0); c+=vec3(1.0,0.55,0.2)*s*1.2;
      gl_FragColor=vec4(c,1.0); }`
  });
  scene.add(new THREE.Mesh(geo, mat));
}

// ============ TRACK ============
const HW = 15; // half width
const ctrlPts = [
  [0, -300], [130, -275], [225, -190], [205, -70], [260, 30],
  [210, 140], [110, 190], [10, 150], [-60, 230], [-180, 210],
  [-260, 100], [-235, -40], [-270, -160], [-150, -230], [-60, -190]
].map(([x, z]) => new THREE.Vector3(x, 0, z));
const curve = new THREE.CatmullRomCurve3(ctrlPts, true, 'catmullrom', 0.6);
const N = 800;
const centers = curve.getSpacedPoints(N); centers.pop();
const tangents = [];
for (let i = 0; i < N; i++) {
  const t = curve.getTangentAt(i / N); t.y = 0; t.normalize(); tangents.push(t);
}
function sideDir(i) { const t = tangents[i]; return new THREE.Vector3(-t.z, 0, t.x); }

function nearestIndex(pos, hint = -1) {
  if (hint >= 0) {
    let best = hint, bd = Infinity;
    for (let k = -40; k <= 40; k++) {
      const i = (hint + k + N) % N;
      const dx = pos.x - centers[i].x, dz = pos.z - centers[i].z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    // if too far (respawn/teleport), full search
    if (bd < 60 * 60) return best;
  }
  let best = 0, bd = Infinity;
  for (let i = 0; i < N; i += 2) {
    const dx = pos.x - centers[i].x, dz = pos.z - centers[i].z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  // refine
  for (let k = -2; k <= 2; k++) {
    const i = (best + k + N) % N;
    const dx = pos.x - centers[i].x, dz = pos.z - centers[i].z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function trackInfo(pos, hint) {
  const i = nearestIndex(pos, hint);
  const s = sideDir(i);
  const dx = pos.x - centers[i].x, dz = pos.z - centers[i].z;
  const lat = dx * s.x + dz * s.z;
  return { i, lat, side: s, tan: tangents[i], center: centers[i] };
}

// Road ribbon
{
  const verts = [], norms = [], uvs = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const j = i % N, s = sideDir(j), c = centers[j];
    verts.push(c.x - s.x * HW, 0, c.z - s.z * HW, c.x + s.x * HW, 0, c.z + s.z * HW);
    norms.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, i * 0.15, 1, i * 0.15);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  const m = new THREE.MeshStandardMaterial({ color: 0x33363e, roughness: 0.95, metalness: 0 });
  const road = new THREE.Mesh(g, m);
  road.receiveShadow = true;
  scene.add(road);

  // shoulder stripes: thin ribbons at edges
  for (const sgn of [-1, 1]) {
    const v = [], id = [];
    for (let i = 0; i <= N; i++) {
      const j = i % N, s = sideDir(j), c = centers[j];
      const o1 = HW - 1.1, o2 = HW - 0.1;
      v.push(c.x + s.x * o1 * sgn, 0.02, c.z + s.z * o1 * sgn, c.x + s.x * o2 * sgn, 0.02, c.z + s.z * o2 * sgn);
      if (i < N) { const a = i * 2; id.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    gg.setIndex(id); gg.computeVertexNormals();
    scene.add(new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: sgn < 0 ? 0xffb300 : 0xf5f5f5 })));
  }

  // center dashes
  const dashGeo = new THREE.PlaneGeometry(0.5, 6);
  dashGeo.rotateX(-Math.PI / 2);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, 200);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < 200; k++) {
    const i = Math.floor(k / 200 * N);
    P.copy(centers[i]); P.y = 0.03;
    Q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangents[i]);
    M.compose(P, Q, S); dashes.setMatrixAt(k, M);
  }
  scene.add(dashes);

  // walls: left/right ribbons with height
  const wallH = 2.6;
  for (const sgn of [-1, 1]) {
    const v = [], id = [], colors = [];
    const cA = new THREE.Color(0xff5a1f), cB = new THREE.Color(0xffffff);
    for (let i = 0; i <= N; i++) {
      const j = i % N, s = sideDir(j), c = centers[j];
      const bx = c.x + s.x * HW * sgn, bz = c.z + s.z * HW * sgn;
      v.push(bx, 0, bz, bx, wallH, bz);
      const stripe = Math.floor(i / 8) % 2 === 0 ? cA : cB;
      colors.push(stripe.r * 0.7, stripe.g * 0.7, stripe.b * 0.7, stripe.r, stripe.g, stripe.b);
      if (i < N) { const a = i * 2; if (sgn > 0) id.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else id.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    gg.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    gg.setIndex(id); gg.computeVertexNormals();
    const wall = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
    wall.castShadow = false; wall.receiveShadow = false;
    scene.add(wall);
  }
}

// Ground + props
{
  const g = new THREE.Mesh(new THREE.CircleGeometry(1600, 48), new THREE.MeshStandardMaterial({ color: 0x241b3d, roughness: 1 }));
  g.rotation.x = -Math.PI / 2; g.position.y = -0.5; g.receiveShadow = true;
  scene.add(g);
  // light posts
  const poleG = new THREE.CylinderGeometry(0.25, 0.35, 9, 6);
  const poleM = new THREE.MeshStandardMaterial({ color: 0x222633 });
  const headG = new THREE.SphereGeometry(0.7, 8, 8);
  const headM = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const poles = new THREE.InstancedMesh(poleG, poleM, 80);
  const heads = new THREE.InstancedMesh(headG, headM, 80);
  const M = new THREE.Matrix4();
  for (let k = 0; k < 80; k++) {
    const i = Math.floor(k / 80 * N);
    const s = sideDir(i);
    const px = centers[i].x + s.x * (HW + 4), pz = centers[i].z + s.z * (HW + 4);
    M.makeTranslation(px, 4.5, pz); poles.setMatrixAt(k, M);
    M.makeTranslation(px, 9.2, pz); heads.setMatrixAt(k, M);
    if (!LOW && k % 16 === 0) { const L = new THREE.PointLight(0xffa64d, 120, 70); L.position.set(px, 9, pz); scene.add(L); }
  }
  scene.add(poles); scene.add(heads);
  // rocks / palms: cones
  const rockG = new THREE.ConeGeometry(3, 9, 5);
  const rockM = new THREE.MeshStandardMaterial({ color: 0x3a2b55, roughness: 1 });
  const rocks = new THREE.InstancedMesh(rockG, rockM, 160);
  for (let k = 0; k < 160; k++) {
    const a = Math.random() * Math.PI * 2, r = 320 + Math.random() * 700;
    M.makeTranslation(Math.cos(a) * r, 3, Math.sin(a) * r);
    rocks.setMatrixAt(k, M);
  }
  rocks.castShadow = true;
  scene.add(rocks);
}

// ============ CARS ============
function buildCar(bodyColor, accent) {
  const grp = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.55, emissive: bodyColor, emissiveIntensity: 0.28 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x11131a, roughness: 0.7 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x0e2233, roughness: 0.1, metalness: 0.9 });
  const accM = new THREE.MeshBasicMaterial({ color: accent });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 4.4), bodyM);
  body.position.y = 0.75; body.castShadow = true; grp.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 1.0), bodyM);
  nose.position.set(0, 0.6, 2.6); nose.castShadow = true; grp.add(nose);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.0), glassM);
  cab.position.set(0, 1.3, -0.2); cab.castShadow = true; grp.add(cab);
  const spoil = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 0.5), darkM);
  spoil.position.set(0, 1.35, -2.1); grp.add(spoil);
  for (const sx of [-0.9, 0.9]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.5), darkM);
    fin.position.set(sx, 1.1, -2.1); grp.add(fin);
  }
  // neon underglow
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.8), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.35 }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06; grp.add(glow);
  // headlights / taillights
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff6c9 }));
    h.position.set(sx, 0.75, 3.11); grp.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    t.position.set(sx, 0.85, -2.21); grp.add(t);
  }
  // wheels
  const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.4, 12); wg.rotateZ(Math.PI / 2);
  const wm = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 });
  const wheels = [];
  for (const [x, z] of [[-1.1, 1.5], [1.1, 1.5], [-1.1, -1.5], [1.1, -1.5]]) {
    const w = new THREE.Mesh(wg, wm); w.position.set(x, 0.42, z); grp.add(w); wheels.push(w);
  }
  // boost flame
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 8),
    new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.9 }));
  flame.rotation.x = Math.PI / 2; flame.position.set(0, 0.7, -3.6); flame.visible = false;
  grp.add(flame);
  scene.add(grp);
  return { grp, wheels, flame, glow };
}

const playerMesh = buildCar(0xff7a00, 0xff9a00);
const rivalMesh = buildCar(0x1e4dff, 0x00e5ff);

function makeState(startIdx, latOff) {
  const c = centers[startIdx], t = tangents[startIdx];
  return {
    pos: new THREE.Vector3(c.x, 0, c.z),
    vel: new THREE.Vector3(t.x * 20, 0, t.z * 20),
    heading: Math.atan2(t.x, t.z),
    idx: startIdx, lat: latOff,
    boost: 45, boosting: false, drifting: false,
    invuln: 0,
    wrecked: false, wreckT: 0, crashT: 0,
    contactT: -10, driftScore: 0, lastLat: 0
  };
}
const player = makeState(0, 0);
const rival = makeState(25, 3);
rival.boost = 60;

// ============ INPUT ============
const keys = {};
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true; keys[e.code] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space'].includes(e.code.toLowerCase()) || e.code === 'Space') e.preventDefault();
  ensureAudio();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; keys[e.code] = false; });
const autoMode = params.has('auto');
const autoKeys = {};
function pressed(...ks) {
  if (autoMode) return ks.some(k => autoKeys[k]);
  return ks.some(k => keys[k]);
}

// ============ AUDIO (procedural) ============
let AC = null, engOsc = null, engOsc2 = null, engGain = null, skidGain = null, boostGain = null;
function ensureAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch { return; }
  engOsc = AC.createOscillator(); engOsc.type = 'sawtooth'; engOsc.frequency.value = 70;
  engOsc2 = AC.createOscillator(); engOsc2.type = 'square'; engOsc2.frequency.value = 35;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
  engGain = AC.createGain(); engGain.gain.value = 0.05;
  engOsc.connect(f); engOsc2.connect(f); f.connect(engGain); engGain.connect(AC.destination);
  engOsc.start(); engOsc2.start();
  // noise buffer
  const len = AC.sampleRate * 1.5;
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const mk = (type, freq, g0) => {
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = freq;
    const g = AC.createGain(); g.gain.value = g0;
    src.connect(fl); fl.connect(g); g.connect(AC.destination); src.start();
    return g;
  };
  skidGain = mk('bandpass', 1400, 0);
  boostGain = mk('highpass', 2500, 0);
}
function blip(freqA, freqB, dur, type = 'square', vol = 0.2) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freqA, AC.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(freqB, 1), AC.currentTime + dur);
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
}
function noiseBurst(dur = 0.5, vol = 0.5, freq = 800) {
  if (!AC) return;
  const len = AC.sampleRate * dur;
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const dd = buf.getChannelData(0);
  for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = AC.createBufferSource(); s.buffer = buf;
  const fl = AC.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = freq;
  const g = AC.createGain(); g.gain.value = vol;
  s.connect(fl); fl.connect(g); g.connect(AC.destination); s.start();
}
function takedownSound() {
  noiseBurst(0.6, 0.6, 2500);
  [220, 330, 440, 660, 880].forEach((f, i) => setTimeout(() => blip(f, f * 1.5, 0.18, 'sawtooth', 0.25), i * 70));
}
function crashSound() { noiseBurst(0.7, 0.7, 900); blip(120, 30, 0.5, 'sine', 0.5); }

// ============ PARTICLES ============
const MAXP = 900;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * 3);
const pCol = new Float32Array(MAXP * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
function roundTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.55, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const pMat = new THREE.PointsMaterial({ size: 1.5, map: roundTex(), vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false });
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
scene.add(points);
const parts = [];
function spawn(o) { if (LOW && Math.random() < 0.5) return; if (parts.length > MAXP) parts.shift(); parts.push(Object.assign({ life: 0.8, age: 0, vx: 0, vy: 2, vz: 0, r: 1, g: 1, b: 1, grav: -2 }, o)); }
function sparks(p, n = 14, base = { r: 1, g: 0.7, b: 0.2 }) {
  for (let i = 0; i < n; i++) spawn({
    x: p.x, y: 0.8, z: p.z, life: 0.4 + Math.random() * 0.5,
    vx: (Math.random() - 0.5) * 22, vy: 2 + Math.random() * 8, vz: (Math.random() - 0.5) * 22,
    r: base.r, g: base.g * Math.random() + 0.2, b: base.b, grav: -18
  });
}
function smoke(p, dark = 0.25) {
  spawn({ x: p.x + (Math.random() - 0.5) * 1.5, y: 0.6, z: p.z + (Math.random() - 0.5) * 1.5, life: 0.9 + Math.random() * 0.5, vx: (Math.random() - 0.5) * 4, vy: 3 + Math.random() * 3, vz: (Math.random() - 0.5) * 4, r: dark + 0.35, g: dark + 0.32, b: dark + 0.32, grav: 2 });
}
function updateParticles(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.age += dt;
    if (p.age >= p.life) { parts.splice(i, 1); continue; }
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y = Math.max(0.1, p.y + p.vy * dt); p.z += p.vz * dt;
  }
  for (let i = 0; i < MAXP; i++) {
    if (i < parts.length) {
      const p = parts[i], f = 1 - p.age / p.life;
      pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
      pCol[i * 3] = p.r * f; pCol[i * 3 + 1] = p.g * f; pCol[i * 3 + 2] = p.b * f;
    } else { pPos[i * 3 + 1] = -100; }
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

// ============ HUD ============
const el = id => document.getElementById(id);
let takedowns = 0;
let flashTimer = 0;
function flash(text, cls, sub = '') {
  const f = el('flash'); f.textContent = text; f.className = ''; void f.offsetWidth; f.className = cls;
  const s = el('flashSub'); s.textContent = sub; s.style.opacity = sub ? 1 : 0;
  flashTimer = 1.4;
}

// ============ GAME LOGIC ============
const clock = new THREE.Clock();
let camPos = new THREE.Vector3(0, 6, -20);
let slowmo = 1;

function respawn(st, aheadOf = null) {
  let idx = st.idx;
  if (aheadOf) idx = (aheadOf.idx + 40) % N;
  const c = centers[idx], t = tangents[idx];
  st.pos.set(c.x, 0, c.z);
  st.heading = Math.atan2(t.x, t.z);
  st.vel.set(t.x * 12, 0, t.z * 12);
  st.wrecked = false; st.wreckT = 0; st.crashT = 0;
  st.invuln = 2.5;
  st.idx = idx;
}

function wreckRival(cause) {
  if (rival.wrecked) return;
  rival.wrecked = true; rival.wreckT = 0;
  takedowns++;
  el('tdNum').textContent = takedowns;
  player.boost = Math.min(100, player.boost + 40);
  flash('TAKEDOWN!', 'takedown', cause || 'RIVAL WRECKED +BOOST');
  takedownSound();
  slowmo = 0.35;
  setTimeout(() => slowmo = 1, 450);
  sparks(rival.pos, 40); smoke(rival.pos, 0.1); smoke(rival.pos, 0.1); smoke(rival.pos, 0.1);
  noiseBurst(0.5, 0.5, 3000);
}

function crashPlayer() {
  if (player.crashT > 0) return;
  player.crashT = 1.1;
  flash('CRASHED', 'crashed', '');
  crashSound();
  sparks(player.pos, 30, { r: 1, g: 0.4, b: 0.1 });
  smoke(player.pos, 0.1);
  el('fade').style.opacity = 0.7;
  setTimeout(() => el('fade').style.opacity = 0, 250);
}

function updateCar(st, mesh, dt, isPlayer) {
  if (st.invuln > 0) st.invuln = Math.max(0, st.invuln - dt);
  if (st.wrecked) {
    st.wreckT += dt;
    st.vel.multiplyScalar(1 - 3 * dt);
    st.pos.addScaledVector(st.vel, dt);
    mesh.grp.position.copy(st.pos);
    mesh.grp.rotation.y = st.heading + st.wreckT * 6;
    mesh.grp.rotation.z = Math.min(0.6, st.wreckT * 0.8);
    if (Math.random() < 0.4) smoke(st.pos, 0.08);
    if (st.wreckT > 2.2) respawn(st, isPlayer ? null : player);
    mesh.flame.visible = false;
    return;
  }
  if (isPlayer && st.crashT > 0) {
    st.crashT -= dt;
    st.vel.multiplyScalar(1 - 4 * dt);
    st.pos.addScaledVector(st.vel, dt);
    if (st.crashT <= 0) respawn(st);
    mesh.grp.position.copy(st.pos);
    return;
  }

  const fwdX = Math.sin(st.heading), fwdZ = Math.cos(st.heading);
  const speed = Math.hypot(st.vel.x, st.vel.z);

  if (isPlayer) {
    if (autoMode) computeAuto(st);
    const gas = pressed('w', 'arrowup');
    const brake = pressed('s', 'arrowdown');
    const left = pressed('a', 'arrowleft');
    const right = pressed('d', 'arrowright');
    const wantDrift = pressed('shift') && speed > 14;
    const wantBoost = pressed(' ', 'space') && st.boost > 1 && speed > 5;
    st.drifting = wantDrift;
    st.boosting = wantBoost;

    const ACC = 34, BOOST_ACC = 55, BRAKE = 50, MAXV = 58, BOOST_MAX = 92, REV_MAX = 16;
    if (gas) {
      const a = wantBoost ? BOOST_ACC : ACC;
      st.vel.x += fwdX * a * dt; st.vel.z += fwdZ * a * dt;
    }
    if (brake) {
      const fSpeed = st.vel.x * fwdX + st.vel.z * fwdZ;
      if (fSpeed > 2) { st.vel.x -= fwdX * BRAKE * dt; st.vel.z -= fwdZ * BRAKE * dt; }
      else { st.vel.x -= fwdX * 18 * dt; st.vel.z -= fwdZ * 18 * dt; }
    }
    if (wantBoost) {
      st.boost = Math.max(0, st.boost - 32 * dt);
      if (Math.random() < 0.7) sparks(st.pos, 1, { r: 0.4, g: 0.8, b: 1 });
    }
    // steering
    const spdF = Math.min(speed / 30, 1);
    let steer = 0;
    if (left) steer -= 1; if (right) steer += 1;
    const gripTurn = wantDrift ? 2.6 : 1.7;
    st.heading += steer * gripTurn * spdF * dt * (speed > 1 ? 1 : 0) * (st.vel.x * fwdX + st.vel.z * fwdZ >= 0 ? 1 : -1);

    // grip: align velocity to heading
    const fSpd = st.vel.x * fwdX + st.vel.z * fwdZ;
    const lSpd = st.vel.x * fwdZ - st.vel.z * fwdX; // lateral (perp)
    const grip = wantDrift ? 1.6 : 7.5;
    const newL = lSpd * Math.max(0, 1 - grip * dt);
    const px = fwdZ, pz = -fwdX;
    st.vel.x = fwdX * fSpd + px * newL;
    st.vel.z = fwdZ * fSpd + pz * newL;

    // cap speed
    const maxV = wantBoost ? BOOST_MAX : MAXV;
    const sp2 = Math.hypot(st.vel.x, st.vel.z);
    if (sp2 > maxV) { st.vel.multiplyScalar(maxV / sp2); }

    // rolling drag + passive boost reward for fast driving
    if (!gas && !wantBoost) st.vel.multiplyScalar(Math.max(0, 1 - 0.25 * dt));
    if (speed > 40) st.boost = Math.min(100, st.boost + 6 * dt);

    // drift boost charge + fx
    if (wantDrift && Math.abs(newL) > 4 && steer !== 0) {
      st.boost = Math.min(100, st.boost + 16 * dt);
      st.driftScore += dt * 30;
      el('driftTag').style.opacity = 1;
      el('driftTag').style.opacity = 1;
      el('driftNum').textContent = Math.floor(st.driftScore);
      if (Math.random() < 0.8) smoke(st.pos, 0.4);
    } else {
      if (!wantDrift) st.driftScore = 0;
      el('driftTag').style.opacity = 0;
    }
  } else {
    // ---- RIVAL AI ----
    const info = trackInfo(st.pos, st.idx); st.idx = info.i;
    const lookAhead = 26;
    const ti = (info.i + lookAhead) % N;
    let tx = centers[ti].x, tz = centers[ti].z;
    // weave/block + ram player
    const dxP = player.pos.x - st.pos.x, dzP = player.pos.z - st.pos.z;
    const distP = Math.hypot(dxP, dzP);
    let dhP = Math.atan2(dxP, dzP) - st.heading;
    while (dhP > Math.PI) dhP -= Math.PI * 2;
    while (dhP < -Math.PI) dhP += Math.PI * 2;
    if (distP < 40 && Math.abs(dhP) < 1.1 && !player.crashT) {
      tx = player.pos.x + player.vel.x * 0.35;
      tz = player.pos.z + player.vel.z * 0.35;
    } else {
      const s = sideDir(ti);
      const weave = Math.sin(performance.now() * 0.0006) * 5;
      tx += s.x * weave; tz += s.z * weave;
    }
    const want = Math.atan2(tx - st.pos.x, tz - st.pos.z);
    let dh = want - st.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    dh += info.lat * 0.02; // lateral feedback: don't grind walls
    st.heading += THREE.MathUtils.clamp(dh * 3.2, -2.2, 2.2) * dt * Math.min(1, speed / 12 + 0.3);
    const rubber = distP > 18 ? 44 : 62;
    const rMax = rubber + (st.boost > 50 ? 8 : 0);
    st.vel.x += Math.sin(st.heading) * 34 * dt;
    st.vel.z += Math.cos(st.heading) * 34 * dt;
    // grip
    const fx = Math.sin(st.heading), fz = Math.cos(st.heading);
    const fS = st.vel.x * fx + st.vel.z * fz;
    const lS = st.vel.x * fz - st.vel.z * fx;
    const nl = lS * Math.max(0, 1 - 6 * dt);
    st.vel.x = fx * fS + fz * nl; st.vel.z = fz * fS - fx * nl;
    const sp = Math.hypot(st.vel.x, st.vel.z);
    if (sp > rMax) st.vel.multiplyScalar(rMax / sp);
    st.boosting = st.boost > 20 && (distP < 18 || distP > 55);
    if (st.boosting) { st.boost -= 20 * dt; st.vel.multiplyScalar(1 + 0.35 * dt); }
    else st.boost = Math.min(100, st.boost + 4 * dt);
    const sp2 = Math.hypot(st.vel.x, st.vel.z);
    const cap2 = rMax + (st.boosting ? 25 : 0);
    if (sp2 > cap2) st.vel.multiplyScalar(cap2 / sp2);
  }

  // integrate
  st.pos.addScaledVector(st.vel, dt);

  // walls
  const info = trackInfo(st.pos, st.idx);
  st.idx = info.i; st.lat = info.lat;
  const lim = HW - 1.3;
  if (Math.abs(info.lat) > lim) {
    const s = info.side;
    const sgn = Math.sign(info.lat);
    const nx = -s.x * sgn, nz = -s.z * sgn; // points back toward road
    // push out
    const over = Math.abs(info.lat) - lim;
    st.pos.x += nx * over; st.pos.z += nz * over;
    const vn = st.vel.x * nx + st.vel.z * nz;
    const impact = -vn; // positive when moving into wall
    if (impact > 0) {
      st.vel.x += nx * impact * 1.6;
      st.vel.z += nz * impact * 1.6;
      st.vel.multiplyScalar(0.72);
      const sp = Math.hypot(st.vel.x, st.vel.z);
      if (isPlayer) {
        sparks(st.pos, 6);
        if (st.invuln <= 0 && impact > 15 && sp > 20) crashPlayer();
        else if (impact > 4) { noiseBurst(0.15, 0.2, 2000); smoke(st.pos, 0.3); }
      } else {
        sparks(st.pos, 6);
        const now = clock.elapsedTime;
        if (st.invuln <= 0 && impact > 12 && (now - st.contactT < 2.5)) wreckRival('SLAMMED INTO THE WALL');
        else if (st.invuln <= 0 && impact > 16) { // solo hard crash also wrecks, no takedown credit feel but still counts small
          st.wrecked = true; st.wreckT = 0;
          sparks(st.pos, 30); smoke(st.pos, 0.1);
        }
      }
    }
  }

  // visuals
  mesh.grp.position.copy(st.pos);
  mesh.grp.position.y = 0;
  const latV = st.vel.x * Math.cos(st.heading) - st.vel.z * Math.sin(st.heading);
  const visualSlide = THREE.MathUtils.clamp(-latV * 0.03, -0.45, 0.45);
  mesh.grp.rotation.y = st.heading + (isPlayer && st.drifting ? visualSlide * 1.4 : visualSlide * 0.4);
  mesh.grp.rotation.z = THREE.MathUtils.lerp(mesh.grp.rotation.z, (isPlayer && st.drifting ? visualSlide * 0.5 : 0), 0.2);
  mesh.flame.visible = !!st.boosting;
  if (st.boosting) { mesh.flame.scale.set(1, 0.7 + Math.random() * 0.7, 1); }
  mesh.wheels.forEach((w, i) => { w.rotation.x += Math.hypot(st.vel.x, st.vel.z) * dt * 1.8; });
  if (st.drifting && Math.random() < 0.6) smoke(st.pos, 0.45);
}

// Autopilot for demo/trailer recording (?auto=1): drives, drifts, boosts, hunts rival.
function computeAuto(st) {
  for (const k in autoKeys) autoKeys[k] = false;
  const info = trackInfo(st.pos, st.idx);
  const ti = (info.i + 40) % N;
  let tx = centers[ti].x, tz = centers[ti].z;
  const dxR = rival.pos.x - st.pos.x, dzR = rival.pos.z - st.pos.z;
  const dR = Math.hypot(dxR, dzR);
  let dhRival = Math.atan2(dxR, dzR) - st.heading;
  while (dhRival > Math.PI) dhRival -= Math.PI * 2;
  while (dhRival < -Math.PI) dhRival += Math.PI * 2;
  if (dR < 60 && Math.abs(dhRival) < 1.2 && !rival.wrecked) { tx = rival.pos.x + rival.vel.x * 0.4; tz = rival.pos.z + rival.vel.z * 0.4; }
  const want = Math.atan2(tx - st.pos.x, tz - st.pos.z);
  let dh = want - st.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const speed = Math.hypot(st.vel.x, st.vel.z);
  // lateral feedback: steer back toward center when pinned near a wall (lat>0 = left side)
  const dhC = dh + st.lat * 0.035;
  const sharp = Math.abs(dhC) > 0.55 && speed > 28;
  autoKeys['w'] = !(Math.abs(dhC) > 0.8 && speed > 35); autoKeys['arrowup'] = autoKeys['w'];
  autoKeys['s'] = sharp; autoKeys['arrowdown'] = sharp;
  autoKeys['a'] = dhC < -0.05; autoKeys['arrowleft'] = dhC < -0.05;
  autoKeys['d'] = dhC > 0.05; autoKeys['arrowright'] = dhC > 0.05;
  autoKeys['shift'] = Math.abs(dh) > 0.28 && speed > 18;
  if (st.boost > 70) st.boostLatch = true;
  else if (st.boost < 12) st.boostLatch = false;
  const b = !!st.boostLatch && Math.abs(dhC) < 0.6 && speed > 30;
  autoKeys[' '] = b; autoKeys['space'] = b;
}

// car-car collision + takedown detection
function carCollision(dt) {
  if (rival.wrecked || player.crashT > 0) return;
  if (player.invuln > 0 || rival.invuln > 0) return;
  const dx = rival.pos.x - player.pos.x, dz = rival.pos.z - player.pos.z;
  const d = Math.hypot(dx, dz);
  if (d > 4.4 || d < 0.01) return;
  const nx = dx / d, nz = dz / d;
  const overlap = 4.4 - d;
  // heavier push on rival when boosting
  const pPush = player.boosting ? 0.25 : 0.5;
  player.pos.x -= nx * overlap * pPush; player.pos.z -= nz * overlap * pPush;
  rival.pos.x += nx * overlap * (1 - pPush); rival.pos.z += nz * overlap * (1 - pPush);
  // relative velocity along normal (player -> rival)
  const rvx = player.vel.x - rival.vel.x, rvz = player.vel.z - rival.vel.z;
  const rel = rvx * nx + rvz * nz;
  const now = clock.elapsedTime;
  rival.contactT = now; player.contactT = now;
  if (rel > 4) {
    const shove = rel * (player.boosting ? 1.1 : 0.75);
    rival.vel.x += nx * shove; rival.vel.z += nz * shove;
    player.vel.x -= nx * shove * 0.25; player.vel.z -= nz * shove * 0.25;
    // nudge rival heading for drama
    rival.heading += (Math.random() - 0.5) * 0.25;
    sparks(rival.pos, 10);
    noiseBurst(0.2, 0.35, 1800);
    blip(150, 90, 0.15, 'square', 0.2);
    // takedown check: rival near wall and shove strong
    const rInfo = trackInfo(rival.pos, rival.idx);
    const nearWall = Math.abs(rInfo.lat) > HW - 5.5;
    if ((nearWall && rel > 3) || rel > 8 || (player.boosting && rel > 3)) {
      // force rival into wall then wreck: give extra lateral shove toward wall
      const sgn = Math.sign(rInfo.lat) || 1;
      rival.vel.x += rInfo.side.x * sgn * 14;
      rival.vel.z += rInfo.side.z * sgn * 14;
      wreckRival(player.boosting ? 'BOOST TAKEDOWN!' : 'TAKEDOWN!');
    }
  } else {
    // gentle separation
    rival.vel.x += nx * 2 * dt * 10; rival.vel.z += nz * 2 * dt * 10;
  }
  // rival slams player into wall -> player crash
  const pInfo = trackInfo(player.pos, player.idx);
  if (player.invuln <= 0 && Math.abs(pInfo.lat) > HW - 4.5) {
    const rvx2 = rival.vel.x - player.vel.x, rvz2 = rival.vel.z - player.vel.z;
    const rel2 = -(rvx2 * nx + rvz2 * nz);
    if (rel2 > 9) {
      const sgn = Math.sign(pInfo.lat) || 1;
      player.vel.x += pInfo.side.x * sgn * 10;
      player.vel.z += pInfo.side.z * sgn * 10;
      crashPlayer();
    }
  }
}

// ============ CAMERA / HUD per-frame ============
const camLook = new THREE.Vector3();
function updateCamera(dt) {
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  const speed = Math.hypot(player.vel.x, player.vel.z);
  const back = 10.5 + speed * 0.045, up = 4.4 + speed * 0.012;
  const dx = player.pos.x - fx * back, dz = player.pos.z - fz * back;
  // keep camera above road
  const k = 1 - Math.pow(0.001, dt);
  camPos.x += (dx - camPos.x) * k;
  camPos.z += (dz - camPos.z) * k;
  camPos.y += ((up - camPos.y) * k);
  camera.position.copy(camPos);
  camLook.set(player.pos.x + fx * 9, 1.6, player.pos.z + fz * 9);
  camera.lookAt(camLook);
  const targetFov = 70 + Math.min(speed * 0.28, 22) + (player.boosting ? 8 : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
  camera.updateProjectionMatrix();
  // sun follows player for shadows
  sun.position.set(player.pos.x - 180, 140, player.pos.z - 120);
  sun.target.position.copy(player.pos);
  sun.target.updateMatrixWorld();
  // speed lines
  el('speedlines').style.opacity = speed > 55 || player.boosting ? 0.7 : 0;
}

function updateHUD() {
  const speed = Math.hypot(player.vel.x, player.vel.z);
  const mph = Math.round(speed * 2.7);
  const sv = el('speedVal');
  sv.textContent = mph;
  sv.classList.toggle('boosting', player.boosting);
  el('boostFill').style.width = player.boost + '%';
  el('boostBar').classList.toggle('full', player.boost > 99);
  const d = Math.hypot(rival.pos.x - player.pos.x, rival.pos.z - player.pos.z);
  el('rivalDist').textContent = Math.round(d) + 'm';
  if (flashTimer > 0) { flashTimer -= 1 / 60; if (flashTimer <= 0) { el('flash').className = ''; el('flash').style.opacity = 0; el('flashSub').style.opacity = 0; } }
  // engine sound
  if (AC && engOsc) {
    const f = 55 + speed * 3.4 + (player.boosting ? 40 : 0);
    engOsc.frequency.value = f;
    engOsc2.frequency.value = f * 0.5;
    engGain.gain.value = 0.04 + Math.min(speed / 90, 1) * 0.05;
    skidGain.gain.value = player.drifting ? 0.16 : 0;
    boostGain.gain.value = player.boosting ? 0.12 : 0;
  }
}

// ============ LOOP ============
window.GAME = { player, rival, centers, tangents, N, HW, get autoKeys() { return autoKeys; } };
respawn(player); respawn(rival);
camPos.set(player.pos.x - Math.sin(player.heading) * 12, 5, player.pos.z - Math.cos(player.heading) * 12);
let elapsed = 0;
function frame() {
  requestAnimationFrame(frame);
  let dt = Math.min(clock.getDelta(), 0.05);
  dt *= slowmo;
  elapsed += dt;
  updateCar(player, playerMesh, dt, true);
  updateCar(rival, rivalMesh, dt, false);
  carCollision(dt);
  updateParticles(dt);
  updateCamera(Math.min(dt, 0.05));
  updateHUD();
  renderer.render(scene, camera);
}
frame();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
