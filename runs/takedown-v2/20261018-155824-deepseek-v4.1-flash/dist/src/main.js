import * as THREE from 'three';

/* ============================================================
   DUEL // a tiny Burnout-style one-on-one racer
   ============================================================ */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const rand = (a, b) => a + Math.random() * (b - a);
const qs = new URLSearchParams(location.search);
const DEMO = qs.has('demo');
const HALF = 10.2;          // half road width
const WALL = HALF - 1.15;   // max lateral offset for a car

/* ---------------- renderer / scene ---------------- */
const canvas = document.getElementById('game');
const renderScale = DEMO ? 0.7 : 0.85;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(Math.round(innerWidth * renderScale), Math.round(innerHeight * renderScale), false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x5a2032, 0.0032);

const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.3, 2200);
camera.position.set(0, 10, -20);

addEventListener('resize', () => {
  renderer.setSize(Math.round(innerWidth * renderScale), Math.round(innerHeight * renderScale), false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

/* ---------------- textures ---------------- */
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const asphaltTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#5c5966'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    const v = 48 + Math.random() * 55;
    g.fillStyle = `rgba(${v},${v},${v + 3},${Math.random() * .5})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1.3, 1.3);
  }
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = `rgba(10,9,12,${rand(.12, .3)})`; g.lineWidth = rand(1, 4);
    g.beginPath(); const x = Math.random() * w; g.moveTo(x, 0); g.lineTo(x + rand(-18, 18), h); g.stroke();
  }
});

const dirtTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#4a2e26'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) {
    const v = Math.random();
    g.fillStyle = v > .5 ? `rgba(120,78,58,${rand(.05, .3)})` : `rgba(22,14,16,${rand(.1, .35)})`;
    g.fillRect(Math.random() * w, Math.random() * h, rand(1, 4), rand(1, 3));
  }
});

const glowTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(.25, 'rgba(255,210,150,.85)');
  gr.addColorStop(.6, 'rgba(255,120,40,.25)');
  gr.addColorStop(1, 'rgba(255,80,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, false);

const smokeTex = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,.8)');
  gr.addColorStop(.5, 'rgba(255,255,255,.3)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, false);

/* ---------------- sky ---------------- */
const sunDir = new THREE.Vector3(-0.62, 0.12, 0.78).normalize();
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1600, 32, 20),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: sunDir } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      varying vec3 vW; uniform vec3 sunDir;
      void main(){
        vec3 d = normalize(vW);
        float h = clamp(d.y*.5+.5, 0., 1.);
        vec3 low = vec3(1.0,.38,.16);
        vec3 mid = vec3(.62,.16,.26);
        vec3 high = vec3(.09,.045,.14);
        vec3 col = mix(low, mid, smoothstep(.48,.62,h));
        col = mix(col, high, smoothstep(.58,.95,h));
        float sun = pow(max(dot(d, sunDir),0.), 220.);
        float halo = pow(max(dot(d, sunDir),0.), 8.);
        col += vec3(1.0,.55,.2)*sun*2.2 + vec3(1.0,.32,.08)*halo*.28;
        float band = smoothstep(.47,.5,h)*smoothstep(.56,.52,h);
        col += vec3(1.0,.5,.2)*band*.12;
        gl_FragColor = vec4(col,1.);
      }`
  })
);
sky.frustumCulled = false;
scene.add(sky);

// sun glow sprite
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0xffb060, transparent: true, opacity: .95,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false
}));
sunSprite.scale.set(520, 520, 1);
sunSprite.position.copy(sunDir).multiplyScalar(1200);
scene.add(sunSprite);

/* ---------------- lights ---------------- */
scene.add(new THREE.HemisphereLight(0xffc0a0, 0x2a1622, 2.3));
const key = new THREE.DirectionalLight(0xffd0a0, 2.7);
key.position.set(-80, 90, 120);
scene.add(key);
const rim = new THREE.DirectionalLight(0xff4c70, .8);
rim.position.set(60, 30, -100);
scene.add(rim);

/* ---------------- track ---------------- */
class Track {
  constructor() {
    this.ctrl = [];
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 172 + Math.sin(a * 3 + .55) * 54 + Math.sin(a * 5 + 1.9) * 25 + Math.cos(a * 2 - .4) * 17;
      this.ctrl.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    this.curve = new THREE.CatmullRomCurve3(this.ctrl, true, 'catmullrom', 0.55);
    this.N = 1100;
    this.pts = []; this.tan = []; this.nrm = []; this.cum = [0];
    for (let i = 0; i < this.N; i++) {
      const p = this.curve.getPointAt(i / this.N);
      this.pts.push(p);
    }
    for (let i = 0; i < this.N; i++) {
      const a = this.pts[(i - 1 + this.N) % this.N], b = this.pts[(i + 1) % this.N];
      const t = new THREE.Vector3().subVectors(b, a); t.y = 0; t.normalize();
      this.tan.push(t);
      this.nrm.push(new THREE.Vector3(t.z, 0, -t.x));
    }
    for (let i = 0; i < this.N; i++) {
      const d = this.pts[i].distanceTo(this.pts[(i + 1) % this.N]);
      this.cum.push(this.cum[i] + d);
    }
    this.length = this.cum[this.N];
    this.build();
  }

  sample(i) { return this.pts[((i % this.N) + this.N) % this.N]; }

  nearest(pos, hint = -1) {
    let best = Infinity, bi = 0;
    if (hint >= 0) {
      for (let k = -18; k <= 18; k++) {
        const i = (hint + k + this.N) % this.N;
        const d = (pos.x - this.pts[i].x) ** 2 + (pos.z - this.pts[i].z) ** 2;
        if (d < best) { best = d; bi = i; }
      }
    }
    if (hint < 0 || best > 900) {
      for (let i = 0; i < this.N; i++) {
        const d = (pos.x - this.pts[i].x) ** 2 + (pos.z - this.pts[i].z) ** 2;
        if (d < best) { best = d; bi = i; }
      }
    }
    const i0 = bi;
    let i1 = (bi + 1) % this.N;
    const A = this.pts[i0], B = this.pts[i1];
    const abx = B.x - A.x, abz = B.z - A.z;
    const len2 = abx * abx + abz * abz || 1;
    let f = ((pos.x - A.x) * abx + (pos.z - A.z) * abz) / len2;
    f = clamp(f, 0, 1);
    const cx = A.x + abx * f, cz = A.z + abz * f, cy = A.y + (B.y - A.y) * f;
    const n = this.nrm[i0];
    const lat = (pos.x - cx) * n.x + (pos.z - cz) * n.z;
    return {
      idx: i0, f, center: new THREE.Vector3(cx, cy, cz), lat,
      normal: n, tangent: this.tan[i0],
      s: this.cum[i0] + f * (this.cum[i1 >= this.N ? 0 : i1] - this.cum[i0] + (i1 === 0 ? this.length : 0))
    };
  }

  ahead(idx, dist, lat = 0) {
    const step = dist / (this.length / this.N);
    const i = ((Math.round(idx + step) % this.N) + this.N) % this.N;
    return this.pts[i].clone().addScaledVector(this.nrm[i], lat);
  }

  build() {
    const N = this.N;
    const pos = [], uv = [], idxs = [];
    const roadMat = new THREE.MeshBasicMaterial({ map: asphaltTex, color: 0xffffff, side: THREE.DoubleSide });
    for (let i = 0; i <= N; i++) {
      const k = i % N;
      const p = this.pts[k], n = this.nrm[k];
      for (const side of [-1, 1]) {
        pos.push(p.x + n.x * HALF * side, p.y + .02, p.z + n.z * HALF * side);
        uv.push(side > 0 ? 1 : 0, i * .62);
      }
      if (i < N) {
        const a = i * 2;
        idxs.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idxs); g.computeVertexNormals();
    this.road = new THREE.Mesh(g, roadMat);
    this.road.receiveShadow = false;
    scene.add(this.road);

    // shoulder
    this.ribbon(HALF, HALF + 4.2, new THREE.MeshLambertMaterial({ map: dirtTex, color: 0xc09a88 }), -0.03, 1.4);
    this.ribbon(-HALF - 4.2, -HALF, new THREE.MeshLambertMaterial({ map: dirtTex, color: 0xc09a88 }), -0.03, 1.4);

    // white edge lines
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf4eee2, toneMapped: false });
    this.ribbon(HALF - .55, HALF - .25, lineMat, .045);
    this.ribbon(-HALF + .25, -HALF + .55, lineMat, .045);

    // glowing rails just outside the wall
    const railMat = new THREE.MeshBasicMaterial({ color: 0xff6a00, toneMapped: false });
    this.ribbon(HALF + .95, HALF + 1.12, railMat, .92);
    this.ribbon(-HALF - 1.12, -HALF - .95, railMat, .92);

    // center dashes
    const dashGeo = new THREE.BoxGeometry(.22, .03, 3.2);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xc9c1b2 });
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, Math.floor(this.length / 12));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < dashes.count; i++) {
      const k = Math.floor((i * 12 / this.length) * N) % N;
      const p = this.pts[k], t = this.tan[k];
      const yaw = Math.atan2(t.x, t.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      m.compose(new THREE.Vector3(p.x, p.y + .055, p.z), q, sc);
      dashes.setMatrixAt(i, m);
    }
    scene.add(dashes);

    // barriers
    const bGeo = new THREE.BoxGeometry(.42, .62, 2.4);
    const bMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const count = Math.floor(this.length / 3.4) * 2;
    const bars = new THREE.InstancedMesh(bGeo, bMat, count);
    const c1 = new THREE.Color(0xb3261d), c2 = new THREE.Color(0xe8d6c0), c3 = new THREE.Color(0x2b2b33);
    let bi = 0;
    for (let i = 0; i < Math.floor(this.length / 3.4); i++) {
      const k = Math.floor((i * 3.4 / this.length) * N) % N;
      const p = this.pts[k], t = this.tan[k], n = this.nrm[k];
      const yaw = Math.atan2(t.x, t.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      for (const side of [-1, 1]) {
        m.compose(new THREE.Vector3(p.x + n.x * (HALF + 1.35) * side, p.y + .34, p.z + n.z * (HALF + 1.35) * side), q, sc);
        bars.setMatrixAt(bi, m);
        bars.setColorAt(bi, i % 3 === 0 ? c1 : (i % 3 === 1 ? c2 : c3));
        bi++;
      }
    }
    bars.instanceColor.needsUpdate = true;
    scene.add(bars);

    // street lights
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1b1b22, metalness: .7, roughness: .5 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffcf8a, toneMapped: false });
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a40, transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 26; i++) {
      const k = Math.floor((i / 26) * N) % N;
      const p = this.pts[k], n = this.nrm[k], side = i % 2 ? 1 : -1;
      const base = p.clone().addScaledVector(n, (HALF + 3.6) * side);
      const grp = new THREE.Group(); grp.position.copy(base);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .14, 7, 5), poleMat);
      pole.position.y = 3.5; grp.add(pole);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.4, 5), poleMat);
      arm.rotation.z = Math.PI / 2; arm.position.set(-side * 1.1, 6.95, 0); grp.add(arm);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(.9, .13, .42), bulbMat);
      bulb.position.set(-side * 2.2, 6.9, 0); grp.add(bulb);
      const sp = new THREE.Sprite(glowMat); sp.scale.set(3.5, 3.5, 1); sp.position.set(-side * 2.2, 6.8, 0); grp.add(sp);
      scene.add(grp);
    }

    // billboards
    const slogans = ['DUEL', 'NO BRAKES', 'BURNOUT', 'FULL SEND'];
    for (let i = 0; i < 4; i++) {
      const k = Math.floor(((i / 4 + .12) % 1) * N);
      const p = this.pts[k], n = this.nrm[k], side = i % 2 ? 1 : -1;
      const tex = canvasTex(512, 256, (g, w, h) => {
        g.fillStyle = '#15070c'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#ff6a00'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24);
        g.fillStyle = '#ffefe0'; g.font = 'bold 92px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(slogans[i], w / 2, h / 2 - 4);
        g.fillStyle = '#ff8a00'; g.font = 'bold 24px Arial'; g.fillText('BURNOUT RACING FUEL', w / 2, h - 46);
      }, false);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false }));
      const base = p.clone().addScaledVector(n, (HALF + 10) * side);
      sign.position.set(base.x, p.y + 7, base.z);
      sign.lookAt(base.x - n.x * side, p.y + 7, base.z - n.z * side);
      scene.add(sign);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(.35, 7, .35), poleMat);
      legs.position.set(base.x, p.y + 3.5, base.z); scene.add(legs);
    }

    // distant hills
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x321c2c });
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + rand(-.05, .05);
      const r = rand(290, 760);
      const h = rand(18, 95);
      const geo = new THREE.ConeGeometry(rand(30, 100), h, Math.floor(rand(4, 7)), 1);
      const rock = new THREE.Mesh(geo, rockMat);
      rock.position.set(Math.cos(a) * r, h * .5 - 6, Math.sin(a) * r);
      rock.rotation.y = rand(0, 6);
      scene.add(rock);
    }
    // city silhouette far off
    const cityMat = new THREE.MeshBasicMaterial({ color: 0x1b0e1a });
    for (let i = 0; i < 34; i++) {
      const a = 1.2 + i * .012;
      const r = 620 + rand(-40, 40);
      const h = rand(20, 90);
      const b = new THREE.Mesh(new THREE.BoxGeometry(rand(10, 28), h, rand(10, 28)), cityMat);
      b.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
      scene.add(b);
    }

    // ground
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1500, 48), new THREE.MeshLambertMaterial({
      map: dirtTex, color: 0x9a6650
    }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.2;
    ground.material.map.repeat.set(120, 120);
    scene.add(ground);
  }

  ribbon(latA, latB, mat, y, uvScale = 1) {
    mat.side = THREE.DoubleSide;
    const N = this.N, pos = [], uv = [], idxs = [];
    for (let i = 0; i <= N; i++) {
      const k = i % N, p = this.pts[k], n = this.nrm[k];
      for (const l of [latA, latB]) {
        pos.push(p.x + n.x * l, p.y + y, p.z + n.z * l);
        uv.push(0, i * uvScale);
      }
      if (i < N) { const a = i * 2; idxs.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idxs); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat); scene.add(mesh); return mesh;
  }
}

const track = new Track();

/* ---------------- particles ---------------- */
class Particles {
  constructor(count, tex, additive, baseSize) {
    this.count = count; this.i = 0;
    this.p = new Float32Array(count * 3);
    this.c = new Float32Array(count * 3);
    this.s = new Float32Array(count);
    this.a = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.max = new Float32Array(count);
    this.grow = new Float32Array(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.s, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.a, 1));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: tex }, uScale: { value: innerHeight * .42 } },
      vertexShader: `attribute float size; attribute vec3 color; attribute float alpha;
        varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.);
          gl_PointSize=size*uScale/max(1.,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
        void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC,t.a*vA); }`
    });
    this.mesh = new THREE.Points(g, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.baseSize = baseSize;
  }
  spawn(x, y, z, n, opt = {}) {
    for (let j = 0; j < n; j++) {
      const i = this.i++ % this.count;
      this.p[i * 3] = x + rand(-.4, .4); this.p[i * 3 + 1] = y + rand(-.2, .4); this.p[i * 3 + 2] = z + rand(-.4, .4);
      const sp = opt.speed ?? 4;
      this.vel[i * 3] = rand(-sp, sp) + (opt.vx || 0);
      this.vel[i * 3 + 1] = rand(.3, sp) + (opt.vy || 0);
      this.vel[i * 3 + 2] = rand(-sp, sp) + (opt.vz || 0);
      const c = opt.color || [1, .45, .05];
      this.c[i * 3] = c[0]; this.c[i * 3 + 1] = c[1]; this.c[i * 3 + 2] = c[2];
      const sz = opt.size ?? this.baseSize;
      this.s[i] = sz * rand(.65, 1.4);
      this.a[i] = 1;
      this.max[i] = this.life[i] = (opt.life ?? .7) * rand(.6, 1.35);
      this.grow[i] = opt.grow ?? 0;
    }
  }
  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { this.a[i] = 0; continue; }
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.max[i]);
      this.a[i] = t * t;
      this.vel[i * 3 + 1] -= (this.grow[i] ? -0.15 : 9) * dt;
      this.p[i * 3] += this.vel[i * 3] * dt;
      this.p[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3] *= 1 - 1.2 * dt; this.vel[i * 3 + 2] *= 1 - 1.2 * dt;
      if (this.grow[i]) this.s[i] += this.grow[i] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }
}

const sparks = new Particles(360, glowTex, true, .34);
const smoke = new Particles(240, smokeTex, false, 1.8);

/* ---------------- car ---------------- */
function makeCar(color, accent, isPlayer) {
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: .34, metalness: .5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x101015, roughness: .8, metalness: .15 });
  const accentMat = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a1820, roughness: .1, metalness: .9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, .46, 4.25), bodyMat);
  body.position.y = .55; grp.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.78, .24, 1.1), bodyMat);
  nose.position.set(0, .42, 1.9); grp.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, .56, 1.72), glassMat);
  cabin.position.set(0, 1.0, -.2); grp.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, .1, 1.1), bodyMat);
  roof.position.set(0, 1.29, -.35); grp.add(roof);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(.42, .02, 2.2), accentMat);
  stripe.position.set(0, .79, .75); grp.add(stripe);
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.1, .08, .55), darkMat);
  splitter.position.set(0, .27, 2.2); grp.add(splitter);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.05, .07, .52), darkMat);
  wing.position.set(0, 1.18, -2.02); grp.add(wing);
  for (const x of [-.78, .78]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(.08, .3, .2), darkMat);
    strut.position.set(x, 1.02, -2.0); grp.add(strut);
  }
  const side = new THREE.Mesh(new THREE.BoxGeometry(2.12, .13, 2.4), darkMat);
  side.position.set(0, .33, 0); grp.add(side);

  // lights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2cc, toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1b00, toneMapped: false });
  for (const x of [-.62, .62]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(.42, .12, .06), headMat);
    h.position.set(x, .55, 2.14); grp.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(.48, .14, .06), tailMat);
    t.position.set(x, .66, -2.14); grp.add(t);
  }
  const headGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe0a0, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false }));
  headGlow.scale.set(2.2, 2.2, 1); headGlow.position.set(0, .6, 2.3); grp.add(headGlow);

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(.4, .4, .34, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x09090c, roughness: .9 });
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x2a2a33 });
  const wheels = [], fronts = [];
  for (const [x, z, front] of [[-1.02, 1.38, 1], [1.02, 1.38, 1], [-1.02, -1.38, 0], [1.02, -1.38, 0]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, .4, z);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .36, 8), rimMat);
    rim.rotation.z = Math.PI / 2; wheel.add(rim);
    pivot.add(wheel); grp.add(pivot);
    wheels.push(wheel); if (front) fronts.push(pivot);
  }

  // boost flames
  const flames = [];
  for (const x of [-.5, .5]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(.16, .95, 6), new THREE.MeshBasicMaterial({
      color: 0xffa030, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    f.rotation.x = -Math.PI / 2; f.position.set(x, .42, -2.75); f.scale.setScalar(0); grp.add(f);
    flames.push(f);
  }

  // underglow
  const under = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.2), new THREE.MeshBasicMaterial({
    map: glowTex, color: isPlayer ? 0x2fd8ff : 0xff4400, transparent: true, opacity: .5,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  under.rotation.x = -Math.PI / 2; under.position.y = .06; grp.add(under);

  // blob shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.4), new THREE.MeshBasicMaterial({
    map: smokeTex, color: 0x000000, transparent: true, opacity: .65, depthWrite: false
  }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; grp.add(shadow);

  grp.scale.setScalar(1.12);
  scene.add(grp);
  return { grp, wheels, fronts, flames, bodyMat, accentMat, headGlow };
}

class Car {
  constructor(isPlayer, x, z, heading) {
    this.isPlayer = isPlayer;
    this.mesh = makeCar(isPlayer ? 0x1590b5 : 0xd92c1b, isPlayer ? 0x35e6ff : 0xffa000, isPlayer);
    this.pos = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3();
    this.heading = heading;
    this.steer = 0;
    this.speed = 0;
    this.lastInput = { throttle: 0, steer: 0, drift: false, boost: false };
    this.aiTarget = null;
    this.drift = false;
    this.boosting = false;
    this.boost = 60;
    this.wheelSpin = 0;
    this.idx = 0;
    this.lat = 0;
    this.s = 0;
    this.wrecked = false;
    this.crashed = false;
    this.invuln = 0;
    this.damage = 0;
    this.lastPlayerHit = 0;
    this.hitCooldown = 0;
    this.bumpCooldown = 0;
    this.offtrack = 0;
    this.tilt = 0;
    this.spin = 0;
    this.driftTime = 0;
    this.driftScore = 0;
    this.rammed = 0;
  }

  reset(x, z, heading, speed = 0) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.vel.set(Math.sin(heading) * speed, 0, Math.cos(heading) * speed);
    this.speed = speed; this.drift = false; this.boosting = false;
    this.wrecked = false; this.crashed = false; this.invuln = 1.6;
    this.tilt = 0; this.spin = 0; this.damage = this.isPlayer ? 0 : 100;
    this.driftTime = 0;
  }

  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  right(out = new THREE.Vector3()) { return out.set(Math.cos(this.heading), 0, -Math.sin(this.heading)); }

  step(dt, input) {
    this.lastInput = input;
    if (this.wrecked || this.crashed) return;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    this.lastPlayerHit = Math.max(0, this.lastPlayerHit - dt);
    this.rammed = Math.max(0, this.rammed - dt);

    const fwd = this.forward(), right = this.right();
    let vLong = this.vel.dot(fwd);
    if (DEMO && this.isPlayer && demoGap > 7 && vLong < 108) vLong += 75 * dt;
    let vLat = this.vel.dot(right);

    // boost
    const wantBoost = input.boost && this.boost > 1 && vLong > 8;
    this.boosting = wantBoost;
    if (wantBoost) this.boost = Math.max(0, this.boost - 27 * dt);
    else this.boost = Math.min(100, this.boost + 1.6 * dt);

    const driftHeld = input.drift && Math.abs(vLong) > 14;
    this.drift = driftHeld && Math.abs(input.steer) > .12 || (driftHeld && Math.abs(vLat) > 4);
    const grip = (this.drift || this.rammed > 0) ? 1.25 : 7.4;
    const maxSpd = (this.boosting ? 114 : 86) * (this.isPlayer ? (DEMO ? 1.1 : 1) : .96);

    // engine / brake
    if (input.throttle > 0) {
      const acc = (this.boosting ? 56 : 30) * input.throttle;
      vLong += acc * clamp(1 - vLong / maxSpd, 0, 1) * dt;
      if (vLong < maxSpd) vLong += 4 * dt;
    } else if (input.throttle < 0) {
      if (vLong > 2) vLong -= 58 * dt;
      else vLong -= 15 * dt;
    }
    // drag
    vLong -= vLong * .10 * dt;
    if (vLat) vLat *= Math.exp(-grip * dt);

    if (this.drift && Math.abs(vLong) > 20) {
      this.driftTime += dt;
      this.driftScore += Math.abs(vLat) * dt * 9;
      this.boost = Math.min(100, this.boost + Math.abs(vLat) * dt * .22);
    } else this.driftTime = Math.max(0, this.driftTime - dt * 2);

    // steering
    this.steer = damp(this.steer, input.steer, 11, dt);
    const spdRatio = clamp(Math.abs(vLong) / 26, .18, 1);
    const yawGain = (this.drift ? 1.85 : 1.42) * (1 - clamp(Math.abs(vLong) / 190, 0, .32));
    let yaw = this.steer * yawGain * spdRatio * Math.sign(vLong || 1);
    if (this.drift) yaw *= 1.12;
    this.heading = wrapAngle(this.heading + yaw * dt);

    vLong = clamp(vLong, -22, 125);
    vLat = clamp(vLat, -42, 42);

    if (this.wrecked) return;
    const nf = this.forward(), nr = this.right();
    this.vel.copy(nf).multiplyScalar(vLong).addScaledVector(nr, vLat);
    this.speed = vLong;
    this.pos.addScaledVector(this.vel, dt);

    // drift/motion effects
    const slip = Math.abs(vLat);
    if (this.drift && this.drift && slip > 2.5 && Math.random() < dt * 40) {
      const back = this.pos.clone().addScaledVector(nf, -2.1).addScaledVector(nr, rand(-.8, .8));
      smoke.spawn(back.x, back.y + .4, back.z, 1, {
        speed: 1.2, life: .9, size: rand(.9, 1.9), color: [.62, .58, .62], grow: 2.4
      });
    }
    if (this.drift && slip > 3.5 && Math.random() < dt * 18) {
      const p = this.pos.clone().addScaledVector(nf, 1.9).addScaledVector(nr, rand(-1, 1));
      sparks.spawn(p.x, p.y + .3, p.z, 2, { speed: 3, color: [1, .55, .1], life: .35, size: .4 });
    }
    if (this.boosting) {
      if (Math.random() < dt * 45) {
        const p = this.pos.clone().addScaledVector(nf, -2.5);
        smoke.spawn(p.x, p.y + .5, p.z, 1, { speed: .6, life: .35, size: 1.0, color: [1, .55, .18], grow: 1.5 });
      }
    }

    // visuals
    this.mesh.grp.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.grp.rotation.y = this.heading;
    this.mesh.grp.rotation.z = damp(this.mesh.grp.rotation.z, -this.steer * .035 - (this.drift ? vLat * .004 : 0), 8, dt);
    this.wheelSpin += this.speed * dt * 1.1;
    for (const w of this.mesh.wheels) w.rotation.x = this.wheelSpin;
    for (const f of this.mesh.fronts) f.rotation.y = this.steer * .42;
    for (const f of this.mesh.flames) {
      f.scale.setScalar(this.boosting ? rand(.7, 1.35) : 0);
      f.material.opacity = rand(.45, .85);
    }
    this.mesh.headGlow.material.opacity = .45 + Math.random() * .08;
  }

  placeOnTrack(sample) {
    this.pos.set(sample.center.x, sample.center.y, sample.center.z);
    this.pos.addScaledVector(sample.normal, sample.lat);
    this.idx = sample.idx; this.s = sample.s; this.lat = sample.lat;
  }
}

/* ---------------- audio ---------------- */
class Sound {
  constructor() {
    this.ok = false;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = .85; this.master.connect(this.ctx.destination);
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;

      // engine
      this.engGain = this.ctx.createGain(); this.engGain.gain.value = .05;
      this.engFilter = this.ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 700;
      this.osc1 = this.ctx.createOscillator(); this.osc1.type = 'sawtooth';
      this.osc2 = this.ctx.createOscillator(); this.osc2.type = 'square';
      this.osc1.connect(this.engFilter); this.osc2.connect(this.engFilter);
      this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
      this.osc1.start(); this.osc2.start();

      // tire noise
      const tireSrc = this.ctx.createBufferSource(); tireSrc.buffer = buf; tireSrc.loop = true;
      this.tireFilter = this.ctx.createBiquadFilter(); this.tireFilter.type = 'bandpass'; this.tireFilter.frequency.value = 2100; this.tireFilter.Q.value = 1.6;
      this.tireGain = this.ctx.createGain(); this.tireGain.gain.value = 0;
      tireSrc.connect(this.tireFilter).connect(this.tireGain).connect(this.master); tireSrc.start();

      // wind
      const windSrc = this.ctx.createBufferSource(); windSrc.buffer = buf; windSrc.loop = true;
      this.windFilter = this.ctx.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 420;
      this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0;
      windSrc.connect(this.windFilter).connect(this.windGain).connect(this.master); windSrc.start();
      this.ok = true;
      this.dest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.dest);
      this.ctx.resume();
      window.__startAudioRec = () => {
        this.ctx.resume();
        window.__audioChunks = [];
        const rec = new MediaRecorder(this.dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 });
        rec.ondataavailable = (e) => { if (e.data.size) window.__audioChunks.push(e.data); };
        rec.start(250);
        window.__audioRec = rec;
      };
      window.__stopAudioRec = () => new Promise((resolve) => {
        const rec = window.__audioRec;
        if (!rec) return resolve(0);
        rec.onstop = async () => {
          const blob = new Blob(window.__audioChunks, { type: 'audio/webm' });
          await fetch('/upload/audio', { method: 'POST', body: blob });
          resolve(blob.size);
        };
        rec.stop();
      });
    } catch (e) { console.warn('audio off', e); }
  }
  resume() { if (this.ok && this.ctx.state === 'suspended') this.ctx.resume(); }
  update(speed, throttle, drift, boost, wrecked) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const rpm = clamp(Math.abs(speed) / 105, 0, 1);
    const f = 42 + rpm * 150 + (boost ? 24 : 0) + Math.sin(t * 9) * 1.2;
    this.osc1.frequency.setTargetAtTime(f, t, .03);
    this.osc2.frequency.setTargetAtTime(f * .5 + 1.3, t, .03);
    this.engFilter.frequency.setTargetAtTime(500 + rpm * 2200 + (throttle > 0 ? 500 : 0), t, .08);
    this.engGain.gain.setTargetAtTime(wrecked ? .008 : .035 + rpm * .035 + (throttle > 0 ? .012 : 0), t, .1);
    this.tireGain.gain.setTargetAtTime(drift ? .045 + rpm * .05 : 0, t, .07);
    this.tireFilter.frequency.setTargetAtTime(1700 + rpm * 1600, t, .1);
    this.windGain.gain.setTargetAtTime(rpm * .055, t, .1);
  }
  hit(power = 1) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(130 * power, t); o.frequency.exponentialRampToValueAtTime(34, t + .35);
    g.gain.setValueAtTime(.6 * power, t); g.gain.exponentialRampToValueAtTime(.001, t + .45);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + .5);
    this.noiseBurst(1, .25 * power, 1200, .28);
  }
  noiseBurst(vol = .3, dur = .2, freq = 1400, q = 1) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + dur + .05);
  }
  crash() {
    this.noiseBurst(.35, .6, 380, .7);
    this.hit(1.5);
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(45, t + .7);
    g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .8);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + .85);
  }
  takedown() {
    this.hit(1.8);
    this.noiseBurst(.2, .7, 2400, .8);
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * .055);
      g.gain.linearRampToValueAtTime(.11, t + i * .055 + .01);
      g.gain.exponentialRampToValueAtTime(.001, t + i * .055 + .38);
      o.connect(g).connect(this.master); o.start(t + i * .055); o.stop(t + i * .055 + .4);
    });
  }
  boostSfx() {
    this.noiseBurst(.12, .5, 900, .5);
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(300, t + .4);
    g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .5);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + .55);
  }
}
const sound = new Sound();

/* ---------------- race / state ---------------- */
const player = new Car(true, 0, 0, 0);
const rival = new Car(false, 0, 0, 0);

function placeAt(sIdx, lat, speed) {
  const s = track.nearest(track.sample(sIdx));
  const car = null;
  return s;
}

// starting grid: rival a few metres ahead, player alongside
{
  const i0 = 8;
  const p0 = track.sample(i0), p1 = track.sample(i0 + 9);
  const h0 = Math.atan2(track.tan[i0].x, track.tan[i0].z);
  const h1 = Math.atan2(track.tan[(i0 + 9) % track.N].x, track.tan[(i0 + 9) % track.N].z);
  player.pos.copy(p0).addScaledVector(track.nrm[i0], -2.1);
  player.heading = h0;
  player.vel.set(Math.sin(h0) * 34, 0, Math.cos(h0) * 34);
  player.speed = 34;
  rival.pos.copy(p1).addScaledVector(track.nrm[(i0 + 9) % track.N], 2.1);
  rival.heading = h1;
  rival.vel.set(Math.sin(h1) * 36, 0, Math.cos(h1) * 36);
  rival.speed = 36;
  rival.damage = 100;
  player.idx = i0; rival.idx = i0 + 9;
}

let takedowns = 0, lap = 1, elapsed = 0;
let timeScale = 1, slowTimer = 0;
let cameraMode = 'chase', camTimer = 0, camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let shake = 0, flashTimer = 0;
let playerCrashTimer = 0;
let rivalRespawnTimer = 0;
let rivalStuck = 0;
let demoRamCd = 0;
let demoTakedownTimer = 0;
let demoGap = 0;
let lastPlayerS = player.s;
let announceTimer = 0;

const ui = {
  speed: document.getElementById('speed'),
  gear: document.getElementById('gear'),
  boost: document.getElementById('boostBar'),
  boostPct: document.getElementById('boostPct'),
  td: document.getElementById('tdCount'),
  health: document.getElementById('rivalHealth'),
  rivalTag: document.getElementById('rivalTag'),
  lap: document.getElementById('lapNum'),
  timer: document.getElementById('timer'),
  announce: document.getElementById('announce'),
  big: document.getElementById('announceBig'),
  sub: document.getElementById('announceSub'),
  driftWrap: document.getElementById('driftWrap'),
  driftFill: document.getElementById('driftFill'),
  flash: document.getElementById('flash'),
  hit: document.getElementById('hitflash'),
  crashlines: document.getElementById('crashlines'),
  speedlines: document.getElementById('speedlines'),
};

const BOOST_SEGS = 20;
for (let i = 0; i < BOOST_SEGS; i++) ui.boost.appendChild(document.createElement('i'));

function announce(big, sub, crash = false) {
  ui.big.textContent = big; ui.sub.textContent = sub;
  ui.announce.className = crash ? 'crash' : '';
  void ui.announce.offsetWidth;
  ui.announce.classList.add('show');
  if (crash) ui.announce.classList.add('crash');
  announceTimer = 2.7;
}

/* ---------------- collisions ---------------- */
const tmpV = new THREE.Vector3();
const tmpN = new THREE.Vector3();
const tmpF = new THREE.Vector3();

function resolveWall(car) {
  if (car.wrecked) return;
  const near = track.nearest(car.pos, car.idx);
  car.idx = near.idx; car.lat = near.lat; car.s = near.s;
  car.pos.y = near.center.y;
  const limit = WALL + (car.offtrack ? 0 : 0);
  if (Math.abs(near.lat) > WALL) {
    const sign = Math.sign(near.lat);
    const pen = Math.abs(near.lat) - WALL;
    car.pos.addScaledVector(near.normal, -sign * pen);
    const vn = car.vel.dot(near.normal) * sign;
    if (vn > 0) {
      const impact = Math.abs(vn);
      car.vel.addScaledVector(near.normal, -sign * vn * 1.35);
      // scrape along the barrier instead of getting pinned nose-first
      const fwd = car.forward();
      const align = Math.atan2(near.tangent.x, near.tangent.z);
      if (Math.abs(fwd.dot(near.tangent)) < .72 && impact > 1.5) {
        const turn = wrapAngle(align - car.heading);
        car.heading = wrapAngle(car.heading + clamp(turn, -.9, .9) * Math.min(.6, impact * .05));
        car.vel.addScaledVector(near.tangent, 4 * Math.sign(car.vel.dot(near.tangent) || 1));
      }
      const loss = clamp(impact * .017, 0, .5);
      car.vel.multiplyScalar(1 - loss);
      // scrape sparks
      const p = car.pos.clone().addScaledVector(near.normal, sign * 1.05);
      sparks.spawn(p.x, p.y + .45, p.z, Math.min(18, 3 + impact), {
        speed: Math.min(13, 3 + impact * .35), color: [1, .55, .1], life: .5, size: .55,
        vx: car.vel.x * .3, vz: car.vel.z * .3
      });
      shake = Math.min(1.2, shake + impact * .018);
      if (car.isPlayer) {
        if (impact > 25 && car.hitCooldown <= 0) {
          sound.hit(clamp(impact / 35, .5, 1.4));
          car.hitCooldown = .3;
          ui.hit.classList.remove('go'); void ui.hit.offsetWidth; ui.hit.classList.add('go');
          if (impact > (DEMO ? 40 : 33) && !car.crashed) crashPlayer(impact);
        }
      } else {
        if (car.lastPlayerHit > 0 && impact > 5) {
          car.damage -= impact * 1.9 + 10;
          if (!car.wrecked) sound.hit(1);
          ui.hit.classList.remove('go'); void ui.hit.offsetWidth; ui.hit.classList.add('go');
          if (car.damage <= 0 || impact > 8) takedownRival();
        }
      }
      if (impact > 6) sound.hit(clamp(impact / 40, .25, 1));
    }
    car.pos.y = near.center.y;
  }
}

function carCollision() {
  if (player.wrecked || rival.wrecked || player.crashed) return;
  const dx = rival.pos.x - player.pos.x, dz = rival.pos.z - player.pos.z;
  const d = Math.hypot(dx, dz);
  const minD = 3.05;
  if (d > minD || d < .001) return;
  tmpN.set(dx / d, 0, dz / d);
  const overlap = minD - d;
  player.pos.addScaledVector(tmpN, -overlap * .5);
  rival.pos.addScaledVector(tmpN, overlap * .5);
  const rel = tmpV.copy(rival.vel).sub(player.vel);
  const closing = rel.dot(tmpN);
  if (closing < 0) {
    const power = Math.min(38, -closing * .95);
    rival.vel.addScaledVector(tmpN, power);
    player.vel.addScaledVector(tmpN, -power * .3);
    rival.lastPlayerHit = 1.5;
    rival.rammed = 1.35;
    rival.damage -= 13 + Math.min(32, -closing * .85) + (player.boosting ? 8 : 0);
    player.boost = Math.min(100, player.boost + 4);
    shake = Math.min(1.4, shake + .18 + -closing * .007);
    const p = player.pos.clone().addScaledVector(tmpN, 1.2);
    sparks.spawn(p.x, p.y + .6, p.z, 16, { speed: 9, color: [1, .7, .15], life: .45, size: .5 });
    sound.hit(clamp(-closing / 22, .3, 1.1));
    if (rival.damage <= 0) takedownRival();
    if (DEMO && !rival.wrecked && demoRamCd <= 0) {
      // make the showcase duel land a proper wall slam
      const rn = track.nrm[rival.idx];
      const side = Math.sign(rival.lat) || 1;
      rival.vel.addScaledVector(rn, side * 24);
      rival.rammed = 1.5;
      rival.lastPlayerHit = 1.6;
      demoRamCd = 6;
      demoTakedownTimer = .85;
      shake = Math.min(1.6, shake + .5);
    }
  }
}

function crashPlayer(impact) {
  if (player.crashed) return;
  player.crashed = true;
  playerCrashTimer = 1.45;
  slowTimer = .65;
  timeScale = .28;
  shake = 1.6;
  flashTimer = .4;
  player.vel.multiplyScalar(.25);
  sound.crash();
  announce('CRASHED', 'RESPAWNING', true);
  ui.flash.classList.remove('go'); void ui.flash.offsetWidth; ui.flash.classList.add('go');
  ui.crashlines.classList.remove('go'); void ui.crashlines.offsetWidth; ui.crashlines.classList.add('go');
}

function takedownRival() {
  if (rival.wrecked) return;
  rival.wrecked = true;
  rival.damage = 0;
  takedowns++;
  ui.td.textContent = takedowns;
  rivalRespawnTimer = 4.2;
  slowTimer = 1.15;
  timeScale = .3;
  shake = 1.5;
  player.boost = Math.min(100, player.boost + 32);
  sound.takedown();
  announce('TAKEDOWN!', 'RIVAL WRECKED  ·  +1');
  ui.flash.classList.remove('go'); void ui.flash.offsetWidth; ui.flash.classList.add('go');
  cameraMode = 'takedown'; camTimer = 2.4;
  // explosive debris
  const p = rival.pos;
  sparks.spawn(p.x, p.y + .8, p.z, 90, { speed: 16, color: [1, .55, .08], life: .9, size: .8, vy: 4 });
  smoke.spawn(p.x, p.y + .8, p.z, 35, { speed: 6, color: [.1, .08, .09], life: 2.4, size: 2.6, grow: 3.2, vy: 1.5 });
  rival.spin = rand(8, 15) * (Math.random() < .5 ? -1 : 1);
  rival.tilt = rand(.3, .8);
}

function respawnRival() {
  const near = track.nearest(player.pos, player.idx);
  const behind = track.ahead(near.idx, DEMO ? 38 : -26, rand(-2.5, 2.5));
  const h = Math.atan2(near.tangent.x, near.tangent.z);
  rival.reset(behind.x, behind.z, h, DEMO ? 18 : 26);
  rival.damage = 100;
  rival.invuln = 1.2;
  rival.wrecked = false;
  rival.mesh.grp.rotation.set(0, h, 0);
  const nr = track.nearest(rival.pos, near.idx);
  rival.idx = nr.idx; rival.lat = nr.lat;
  ui.rivalTag.textContent = 'REMEMBER ME';
  setTimeout(() => { if (!rival.wrecked) ui.rivalTag.textContent = 'DUEL'; }, 2500);
}

function respawnPlayer() {
  const near = track.nearest(player.pos, player.idx);
  const h = Math.atan2(near.tangent.x, near.tangent.z);
  player.reset(near.center.x, near.center.z, h, 20);
  player.pos.y = near.center.y;
  player.idx = near.idx;
  player.crashed = false;
  player.invuln = 1.5;
  cameraMode = 'chase';
  player.mesh.grp.rotation.set(0, h, 0);
}

/* ---------------- driving AI ---------------- */
function racingInput(car, aggressive, demoPlayer = false) {
  const fwd = car.forward();
  let target, look = 13 + clamp(car.speed, 0, 100) * .22;
  const ni = (car.idx + Math.round(look / (track.length / track.N)) + track.N) % track.N;

  if (demoPlayer && !rival.wrecked) {
    const dx = rival.pos.x - car.pos.x, dz = rival.pos.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    const ahead = (dx * fwd.x + dz * fwd.z);
    if (dist < 46 && ahead > -6) {
      const rn = track.nrm[rival.idx];
      const side = rival.lat > 0 ? 1 : -1;
      // hang on the inside line, then cut through the rival toward the wall
      const shove = clamp((22 - dist) / 16, 0, 1);
      const inside = Math.abs(car.lat) < 6.2;
      target = dist < 24 ? rival.pos.clone() : rival.pos.clone().addScaledVector(rn, side * 2.0);
      car.aiTarget = target;
      const desired = Math.atan2(target.x - car.pos.x, target.z - car.pos.z);
      const diff = wrapAngle(desired - car.heading);
      const steer = clamp(diff * 2.3, -1, 1);
      const curve = 1 - track.tan[ni].dot(track.tan[(ni + 20) % track.N]);
      const wantSpd = 84 - curve * 40;
      return {
        steer,
        throttle: car.speed < wantSpd ? 1 : -.3,
        drift: dist > 24 && (Math.abs(diff) > .34 || curve > .12) && car.speed > 36,
        boost: dist < 42 && dist > 4 && Math.abs(diff) < .5 && car.boost > 15 && ahead > 0 && curve < .1,
        chase: true
      };
    }
  }

  target = track.pts[ni].clone();
  car.aiTarget = target;
  // subtle racing line
  const lat = Math.sin(ni * .035) * 2.2 * (aggressive ? 1 : .6);
  target.addScaledVector(track.nrm[ni], lat);
  const desired = Math.atan2(target.x - car.pos.x, target.z - car.pos.z);
  const diff = wrapAngle(desired - car.heading);
  let steer = clamp(diff * 2.1, -1, 1);
  if (car.isPlayer && Math.abs(car.lat) > 7.4) steer = clamp(-Math.sign(car.lat) * .9, -1, 1);

  // speed from corner sharpness ahead
  const t0 = track.tan[ni], t1 = track.tan[(ni + 24) % track.N], t2 = track.tan[(ni + 48) % track.N];
  const curve = (1 - t0.dot(t1)) + (1 - t1.dot(t2)) * .5;
  let wantSpd = 86 - curve * 42;
  wantSpd = clamp(wantSpd, 32, 88);
  if (!car.isPlayer) {
    const gap = player.s - car.s;
    if (gap > 55) wantSpd += 8;
    if (gap < -60) wantSpd -= 8;
    wantSpd += aggressive * 3;
    if (DEMO) {
      const d = Math.hypot(player.pos.x - car.pos.x, player.pos.z - car.pos.z);
      if (d > 8) wantSpd = Math.min(wantSpd, 38);
      if (d > 75) wantSpd = Math.min(wantSpd, 30);
    }
  }
  const throttle = car.speed < wantSpd ? 1 : (car.speed > wantSpd + 6 ? -.25 : .15);
  if (DEMO && car.isPlayer) {
    const dd = Math.hypot(rival.pos.x - car.pos.x, rival.pos.z - car.pos.z);
    return {
      steer, throttle,
      drift: Math.abs(diff) > .24 && car.speed > 30 && curve > .02,
      boost: curve < .07 && car.boost > 8 && dd > 8,
    };
  }
  return {
    steer,
    throttle,
    drift: Math.abs(diff) > .24 && car.speed > 30 && curve > .02,
    boost: curve < .045 && car.boost > 22 && car.speed > 45 && Math.abs(diff) < .2,
  };
}

/* ---------------- input ---------------- */
const keys = {};
let everPressed = false;
let input = { throttle: 0, steer: 0, drift: false, boost: false };
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  everPressed = true;
  sound.resume();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('pointerdown', () => sound.resume());

let prevBoost = false;
function readInput() {
  if (DEMO) return racingInput(player, 1, true);
  if (!everPressed) {
    const ai = racingInput(player, 0, false);
    ai.boost = false;
    if (player.speed > 62) ai.throttle = 0;
    return ai;
  }
  const k = (c) => !!keys[c];
  let throttle = (k('KeyW') || k('ArrowUp') ? 1 : 0) + (k('KeyS') || k('ArrowDown') ? -1 : 0);
  const steer = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  const boost = k('Space');
  if (boost && !prevBoost) sound.boostSfx();
  prevBoost = boost;
  return { throttle, steer: clamp(throttle && Math.abs(throttle) ? steer : steer, -1, 1), drift: k('ShiftLeft') || k('ShiftRight'), boost };
}

/* ---------------- camera ---------------- */
function initCamera() {
  const f = player.forward();
  camPos.copy(player.pos).addScaledVector(f, -9).add(new THREE.Vector3(0, 4, 0));
  camLook.copy(player.pos).addScaledVector(f, 7).add(new THREE.Vector3(0, 1.2, 0));
  camera.position.copy(camPos); camera.lookAt(camLook);
}

function updateCamera(dt, realDt) {
  const f = player.forward(), r = player.right();
  const speed = clamp(player.speed, 0, 120);

  if (cameraMode === 'takedown') {
    camTimer -= realDt;
    const rf = rival.forward(), rr = rival.right();
    const side = 1;
    const want = rival.pos.clone()
      .addScaledVector(rf, -8.5).addScaledVector(rr, 5.5 * side).add(new THREE.Vector3(0, 3.3, 0));
    const look = rival.pos.clone().add(new THREE.Vector3(0, 1, 0));
    camPos.lerp(want, 1 - Math.exp(-4.5 * dt));
    camLook.lerp(look, 1 - Math.exp(-7 * dt));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    camera.fov = damp(camera.fov, 58, 4, dt); camera.updateProjectionMatrix();
    if (camTimer <= 0) cameraMode = 'chase';
    return;
  }

  const drift = player.drift ? clamp(player.vel.dot(r) * .02, -.9, .9) : 0;
  const back = 6.6 + speed * .022;
  const want = player.pos.clone()
    .addScaledVector(f, -back)
    .addScaledVector(r, -drift * 1.6)
    .add(new THREE.Vector3(0, 2.75 + speed * .006, 0));
  const look = player.pos.clone()
    .addScaledVector(f, 8 + speed * .085)
    .addScaledVector(r, -drift * 2.4)
    .add(new THREE.Vector3(0, 2.1, 0));
  const kp = player.crashed ? 2.5 : 18.0;
  camPos.lerp(want, 1 - Math.exp(-kp * realDt));
  camLook.lerp(look, 1 - Math.exp(-7 * realDt));

  if (shake > 0) {
    const s = shake * shake;
    camera.position.copy(camPos).add(new THREE.Vector3(rand(-s, s), rand(-s, s) * .7, rand(-s, s)));
    shake = Math.max(0, shake - realDt * 3.2);
  } else camera.position.copy(camPos);
  camera.lookAt(camLook);
  const targetFov = 60 + clamp(speed / 100, 0, 1) * 7 + (player.boosting ? 8 : 0);
  camera.fov = damp(camera.fov, targetFov, 3.5, realDt);
  camera.updateProjectionMatrix();
}

/* ---------------- HUD ---------------- */
let hudTimer = 0;
function updateHUD(dt) {
  hudTimer += dt;
  if (hudTimer < .05) return;
  hudTimer = 0;
  const mph = Math.round(Math.abs(player.speed) * 2.24);
  ui.speed.textContent = mph;
  ui.gear.textContent = player.speed < -1 ? 'R' : Math.max(1, Math.min(6, 1 + Math.floor(Math.abs(player.speed) / 18)));
  const segs = ui.boost.children;
  const on = Math.round(player.boost / 100 * BOOST_SEGS);
  for (let i = 0; i < BOOST_SEGS; i++) segs[i].classList.toggle('on', i < on);
  ui.boost.classList.toggle('hot', player.boosting);
  ui.boostPct.textContent = Math.round(player.boost);
  ui.health.style.width = `${clamp(rival.damage, 0, 100)}%`;
  ui.lap.textContent = lap;
  const mm = Math.floor(elapsed / 60), ss = (elapsed % 60).toFixed(1).padStart(4, '0');
  ui.timer.textContent = `${mm}:${ss}`;
  const drifting = player.driftTime > .15 && !player.crashed;
  ui.driftWrap.classList.toggle('on', drifting);
  ui.driftFill.style.width = `${clamp(player.speed > 0 ? Math.abs(player.vel.dot(player.right())) * 5 : 0, 0, 100)}%`;
  const spd = clamp((Math.abs(player.speed) - 70) / 45, 0, 1) * .5 + (player.boosting ? .35 : 0);
  ui.speedlines.style.opacity = spd.toFixed(2);
}

/* ---------------- effects helpers ---------------- */
function wallSparkAt(car, side) {
  const n = track.nearest(car.pos, car.idx).normal;
  const p = car.pos.clone().addScaledVector(n, side * 1.1);
  sparks.spawn(p.x, p.y + .5, p.z, 6, { speed: 5, color: [1, .6, .12], life: .4, size: .45 });
}

function wreckUpdate(car, dt) {
  if (!car.wrecked) return;
  car.spin = (car.spin || 6) * (1 - dt * .8);
  car.mesh.grp.rotation.y += car.spin * dt;
  car.tilt = damp(car.tilt, 0, 1.3, dt);
  car.mesh.grp.rotation.z = car.tilt;
  car.mesh.grp.rotation.x = car.tilt * .55;
  car.mesh.grp.position.y = car.pos.y + Math.sin(performance.now() * .005) * .04;
  if (Math.random() < dt * 28) {
    smoke.spawn(car.pos.x + rand(-.9, .9), car.pos.y + .7, car.pos.z + rand(-.9, .9), 1, {
      speed: 1.1, life: 2.2, size: 1.8, color: [.16, .12, .13], grow: 2.6, vy: 1.8
    });
  }
  if (Math.random() < dt * 20) {
    sparks.spawn(car.pos.x + rand(-1, 1), car.pos.y + .6, car.pos.z + rand(-1, 1), 1, {
      speed: 2.5, color: [1, .4, .03], life: .7, size: .7, vy: 2.5
    });
  }
}

/* ---------------- main loop ---------------- */
initCamera();
let last = performance.now();
let started = false;

function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min(.12, (now - last) / 1000);
  last = now;
  if (!started) { started = true; }

  // slow motion easing
  if (slowTimer > 0) {
    slowTimer -= realDt;
    timeScale = damp(timeScale, .3, 12, realDt);
  } else {
    timeScale = damp(timeScale, 1, 4.5, realDt);
  }
  const dt = realDt * timeScale;
  elapsed += realDt;
  demoGap = Math.hypot(player.pos.x - rival.pos.x, player.pos.z - rival.pos.z);
  demoRamCd = Math.max(0, demoRamCd - realDt);
  if (demoTakedownTimer > 0 && !rival.wrecked) {
    demoTakedownTimer -= realDt;
    const rn = track.nrm[rival.idx];
    const side = Math.sign(rival.lat) || 1;
    rival.vel.addScaledVector(rn, side * 60 * realDt);
    rival.rammed = 1;
    if (demoTakedownTimer <= 0) takedownRival();
  }

  // update cars
  const pInput = readInput();
  if (!player.crashed && !player.wrecked) player.step(dt, pInput);
  if (!rival.wrecked) {
    const rInput = racingInput(rival, 1, false);
    rival.step(dt, rInput);
    // AI wall avoidance / recovery
    if (Math.abs(rival.lat) > WALL - 1.2) {
      const n = track.nearest(rival.pos, rival.idx).normal;
      rival.vel.addScaledVector(n, -Math.sign(rival.lat) * 13 * dt);
    }
  }
  wreckUpdate(player, dt);
  wreckUpdate(rival, dt);

  resolveWall(player);
  resolveWall(rival);
  carCollision();

  // keep meshes grounded / place when not moving
  if (!player.wrecked) {
    player.mesh.grp.position.set(player.pos.x, player.pos.y, player.pos.z);
    player.mesh.grp.rotation.y = player.heading;
  }

  // respawns
  if (player.crashed) {
    playerCrashTimer -= realDt;
    player.vel.multiplyScalar(1 - realDt * 4);
    player.pos.addScaledVector(player.vel, realDt);
    player.mesh.grp.position.set(player.pos.x, player.pos.y, player.pos.z);
    player.mesh.grp.rotation.y += realDt * 5;
    player.mesh.grp.rotation.z = Math.sin(elapsed * 40) * .03;
    if (playerCrashTimer <= 0) respawnPlayer();
  }
  if (rival.wrecked) {
    rivalRespawnTimer -= realDt;
    if (rivalRespawnTimer <= 0) respawnRival();
  } else {
    if (Math.abs(rival.speed) < 11) rivalStuck += realDt; else rivalStuck = Math.max(0, rivalStuck - realDt * 2);
    if (rivalStuck > 1.4) {
      const near = track.nearest(rival.pos, rival.idx);
      const h = Math.atan2(near.tangent.x, near.tangent.z);
      rival.reset(near.center.x, near.center.z, h, 28);
      rival.damage = Math.max(rival.damage, 60);
      rivalStuck = 0;
    }
  }

  if (announceTimer > 0) {
    announceTimer -= realDt;
    if (announceTimer <= 0) ui.announce.className = '';
  }

  // lap counting
  const dS = player.s - lastPlayerS;
  if (dS < -track.length * .5) { lap++; }
  lastPlayerS = player.s;

  // camera & sound
  updateCamera(realDt, realDt);
  sound.update(player.speed, pInput.throttle, player.drift, player.boosting, player.crashed);

  sparks.update(realDt);
  smoke.update(realDt);
  updateHUD(realDt);

  // sun/sky follow
  sky.position.copy(camera.position).multiplyScalar(.1);
  sunSprite.position.copy(camera.position).addScaledVector(sunDir, 1100);

  renderer.render(scene, camera);
}

// make sure meshes start in place
resolveWall(player); resolveWall(rival);
player.mesh.grp.position.set(player.pos.x, player.pos.y, player.pos.z);
player.mesh.grp.rotation.y = player.heading;
rival.mesh.grp.position.set(rival.pos.x, rival.pos.y, rival.pos.z);
rival.mesh.grp.rotation.y = rival.heading;

// expose small debug hook for the trailer tooling
window.__duel = {
  player, rival, track, camera, takedowns: () => takedowns,
  teleportPlayerToRival() {
    const n = track.nearest(rival.pos, rival.idx);
    player.pos.copy(rival.pos).addScaledVector(n.normal, -3);
    player.heading = rival.heading; player.idx = rival.idx;
    player.vel.copy(rival.vel).multiplyScalar(1.02);
  }
};

requestAnimationFrame(frame);
