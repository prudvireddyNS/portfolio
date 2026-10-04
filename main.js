import * as THREE from './vendor/three.module.min.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sections = [...document.querySelectorAll('main > section')];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ------------------------------------------------------------------ UI */

function initUI() {
  // progress dots
  const dots = document.getElementById('dots');
  sections.forEach((s) => {
    const a = document.createElement('a');
    a.href = '#' + s.id;
    a.innerHTML = `<span>${s.dataset.label}</span>`;
    a.setAttribute('aria-label', s.dataset.label);
    dots.appendChild(a);
  });
  const dotEls = [...dots.children];

  // reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        e.target.querySelectorAll?.('[data-count]').forEach(countUp);
        if (e.target.matches('[data-count]')) countUp(e.target);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // count-up numbers
  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const end = +el.dataset.count, suffix = el.dataset.suffix || '';
    const dur = reduceMotion ? 0 : 1600, t0 = performance.now();
    (function tick(now) {
      const t = dur ? clamp((now - t0) / dur, 0, 1) : 1;
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = Math.round(end * eased).toLocaleString('en-US') + suffix;
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  }

  // rotating hero word
  const words = ['websites', 'mobile apps', 'desktop apps', 'AI agents', 'scrapers that don\'t quit', '3D worlds', 'whatever\'s next'];
  const swap = document.getElementById('swap');
  let wi = 0;
  if (!reduceMotion) {
    setInterval(() => {
      swap.classList.add('out');
      setTimeout(() => {
        wi = (wi + 1) % words.length;
        swap.textContent = words[wi];
        swap.classList.remove('out');
      }, 320);
    }, 2300);
  }

  // active dot
  const secIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        const i = sections.indexOf(e.target);
        dotEls.forEach((d, k) => d.classList.toggle('active', k === i));
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  sections.forEach((s) => secIO.observe(s));

  // cursor + card glow
  const cursor = document.querySelector('.cursor');
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    cursor.classList.add('on');
    cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    const card = e.target.closest?.('.card');
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    }
  }, { passive: true });
  document.querySelectorAll('a, .chips li, .card').forEach((el) => {
    el.addEventListener('pointerenter', () => cursor.classList.add('hover'));
    el.addEventListener('pointerleave', () => cursor.classList.remove('hover'));
  });
}

/* --------------------------------------------------------------- WebGL */

function initScene() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('bg'), antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    return false;
  }

  const LIME = 0xc6ff3d, VIOLET = 0x7c5cff, CYAN = 0x3de0ff, BG = 0x07070d;
  const SPACING = 48;               // distance between stations along z
  const N = sections.length;

  renderer.setClearColor(BG);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(BG, 0.011);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
  scene.add(camera);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const camLimeLight = new THREE.PointLight(LIME, 60, 40); camLimeLight.position.set(4, 3, 2);
  const camVioletLight = new THREE.PointLight(VIOLET, 60, 40); camVioletLight.position.set(-4, -2, 2);
  camera.add(camLimeLight, camVioletLight);

  /* camera path: one point per station, gentle wander */
  const wander = [[0, 0], [1.6, .8], [-1.6, -.6], [1.4, .6], [-1, 0], [1.2, -.8], [-1.4, .6], [1, -.4], [0, 0]];
  const path = sections.map((_, i) => new THREE.Vector3(wander[i % wander.length][0], wander[i % wander.length][1], -i * SPACING));
  const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0.3);

  const dotTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  /* dust / stars along the whole flight */
  {
    const count = 5200, pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    const palette = [new THREE.Color(LIME), new THREE.Color(VIOLET), new THREE.Color(CYAN), new THREE.Color(0xffffff)];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - .5) * 140;
      pos[i * 3 + 1] = (Math.random() - .5) * 90;
      pos[i * 3 + 2] = 60 - Math.random() * (N * SPACING + 120);
      const c = palette[(Math.random() * palette.length) | 0];
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 0.3, map: dotTex, alphaTest: .01, vertexColors: true, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending });
    scene.add(new THREE.Points(g, m));
  }

  /* ---- helpers ---- */
  const stations = [];   // { group, side, update(t, dt, closeness) }
  function addStation(i, side, group, update) {
    scene.add(group);
    stations[i] = { group, side, update, baseScale: 1 };
  }
  function textSprite(text, { size = 64, color = '#ecebf5', weight = 600 } = {}) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const font = `${weight} ${size}px ui-monospace, "JetBrains Mono", Menlo, monospace`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 40, h = size + 30;
    c.width = w; c.height = h;
    ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    ctx.fillStyle = color; ctx.fillText(text, w / 2, h / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    spr.scale.set(w / 100, h / 100, 1);
    return spr;
  }

  /* ---- 0 · hero: living particle planet ---- */
  const heroUniforms = { uTime: { value: 0 }, uPulse: { value: 0 } };
  {
    const count = 9000, pos = new Float32Array(count * 3), seed = new Float32Array(count);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      const R = 4.6;
      pos.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: heroUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uTime; uniform float uPulse;
        attribute float aSeed; varying float vMix; varying float vA;
        void main(){
          vec3 p = position;
          float n = sin(p.x*1.3+uTime*.7) + sin(p.y*1.7+uTime*.55) + sin(p.z*1.5+uTime*.65);
          p += normalize(position) * (n*.3 + uPulse*aSeed*.6);
          vec4 mv = modelViewMatrix * vec4(p,1.);
          gl_PointSize = (1.2 + aSeed*2.2) * (38. / -mv.z);
          gl_Position = projectionMatrix * mv;
          vMix = clamp(n*.17 + .5 + aSeed*.2, 0., 1.);
          vA = .55 + aSeed*.45;
        }`,
      fragmentShader: `
        varying float vMix; varying float vA;
        void main(){
          float d = length(gl_PointCoord - .5);
          if(d > .5) discard;
          float a = smoothstep(.5, .0, d) * vA;
          vec3 c = mix(vec3(.486,.361,1.), vec3(.776,1.,.239), vMix);
          gl_FragColor = vec4(c, a);
        }`
    });
    const group = new THREE.Group();
    group.add(new THREE.Points(g, m));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.015, 8, 200), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: .5 }));
    ring.rotation.x = 1.25;
    group.add(ring);
    addStation(0, 0, group, (t, dt) => {
      group.rotation.y += dt * 0.12;
      ring.rotation.z += dt * 0.2;
    });
  }

  /* ---- 1 · about: gyroscope ---- */
  {
    const group = new THREE.Group();
    const mats = [LIME, VIOLET, CYAN].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .5, roughness: .3, metalness: .7 }));
    const rings = [3.6, 2.8, 2.0].map((r, i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, .09, 16, 120), mats[i]);
      group.add(m); return m;
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.9, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: .2, metalness: .8, emissive: LIME, emissiveIntensity: .25 }));
    group.add(core);
    addStation(1, 1, group, (t, dt) => {
      rings[0].rotation.x += dt * .6; rings[0].rotation.y += dt * .2;
      rings[1].rotation.y += dt * .8; rings[1].rotation.z += dt * .3;
      rings[2].rotation.z += dt * 1.0; rings[2].rotation.x -= dt * .4;
      core.rotation.y += dt * .5; core.rotation.x += dt * .3;
    });
  }

  /* ---- 2 · now: battery pack (cells charging in a wave) ---- */
  {
    const cols = 9, rows = 5;
    const geo = new THREE.CylinderGeometry(.42, .42, 1.9, 24);
    const mat = new THREE.MeshStandardMaterial({ roughness: .35, metalness: .55 });
    const cells = new THREE.InstancedMesh(geo, mat, cols * rows);
    const capGeo = new THREE.CylinderGeometry(.16, .16, .12, 12);
    const caps = new THREE.InstancedMesh(capGeo, new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: .9, roughness: .25 }), cols * rows);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    const low = new THREE.Color(0xff4d6d), high = new THREE.Color(LIME);
    const group = new THREE.Group();
    group.add(cells, caps);
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(cols * 1 + .6, 2.4, rows * 1 + .6)),
      new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: .45 })
    );
    group.add(frame);
    group.rotation.set(.55, -.5, 0);
    addStation(2, -1, group, (t) => {
      for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) {
        const i = x * rows + z;
        const lvl = .5 + .5 * Math.sin(t * 1.4 - x * .55 - z * .35);
        dummy.position.set((x - (cols - 1) / 2), 0, (z - (rows - 1) / 2));
        dummy.scale.set(1, .55 + lvl * .45, 1);
        dummy.updateMatrix();
        cells.setMatrixAt(i, dummy.matrix);
        color.copy(low).lerp(high, lvl);
        cells.setColorAt(i, color);
        dummy.position.y = .95 * dummy.scale.y + .06;
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        caps.setMatrixAt(i, dummy.matrix);
      }
      cells.instanceMatrix.needsUpdate = true; caps.instanceMatrix.needsUpdate = true;
      if (cells.instanceColor) cells.instanceColor.needsUpdate = true;
    });
  }

  /* ---- 3 · before: scraper / agent network ---- */
  {
    const group = new THREE.Group();
    const nodeCount = 90, pts = [];
    for (let i = 0; i < nodeCount; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 3.6);
      pts.push(v);
    }
    const linePos = [], edges = [];
    for (let i = 0; i < nodeCount; i++) for (let j = i + 1; j < nodeCount; j++) {
      if (pts[i].distanceTo(pts[j]) < 2.5) { linePos.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z); edges.push([i, j]); }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: VIOLET, transparent: true, opacity: .45 })));
    const ng = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Points(ng, new THREE.PointsMaterial({ color: LIME, size: .5, map: dotTex, alphaTest: .01, depthWrite: false, sizeAttenuation: true, transparent: true, opacity: .95 })));
    // packets travelling along edges
    const packets = [];
    const pGeo = new THREE.SphereGeometry(.09, 8, 8), pMat = new THREE.MeshBasicMaterial({ color: CYAN });
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(pGeo, pMat); group.add(m);
      packets.push({ m, e: edges[(Math.random() * edges.length) | 0], t: Math.random(), s: .4 + Math.random() * .8 });
    }
    // central "target"
    const target = new THREE.Mesh(new THREE.OctahedronGeometry(.7, 0), new THREE.MeshBasicMaterial({ color: 0xff4d6d, wireframe: true }));
    group.add(target);
    addStation(3, 1, group, (t, dt) => {
      group.rotation.y += dt * .12;
      target.rotation.x += dt * .9; target.rotation.y += dt * .6;
      const s = 1 + Math.sin(t * 3) * .08; target.scale.setScalar(s);
      for (const p of packets) {
        p.t += dt * p.s;
        if (p.t > 1) { p.t = 0; p.e = edges[(Math.random() * edges.length) | 0]; }
        p.m.position.lerpVectors(pts[p.e[0]], pts[p.e[1]], p.t);
      }
    });
  }

  /* ---- 4 · numbers: orbiting data bars ---- */
  {
    const group = new THREE.Group();
    const count = 64;
    const geo = new THREE.BoxGeometry(.28, 1, .28);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .35, metalness: .4 });
    const bars = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      c.setHSL(.2 + (i / count) * .5, .85, .55); bars.setColorAt(i, c);
    }
    addStation(4, 0, group, (t) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2, r = 5.2 + Math.sin(i * 1.7) * .4;
        const h = 1 + 2.4 * (.5 + .5 * Math.sin(t * 1.2 + i * .45)) * (.6 + .4 * Math.sin(i * .9));
        dummy.position.set(Math.cos(a) * r, h / 2 - 1.5, Math.sin(a) * r - 4);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix(); bars.setMatrixAt(i, dummy.matrix);
      }
      bars.instanceMatrix.needsUpdate = true;
      group.rotation.y = t * .12;
    });
    group.add(bars);
    group.rotation.x = .25;
  }

  /* ---- 5 · built: helix of news cards (Ekloge) ---- */
  {
    const count = 46;
    const geo = new THREE.PlaneGeometry(1.7, 1.05);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: .62, side: THREE.DoubleSide, depthWrite: false });
    const cards = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D(), c = new THREE.Color();
    const pal = [LIME, CYAN, VIOLET];
    for (let i = 0; i < count; i++) { c.set(pal[i % 3]).multiplyScalar(.8 + Math.random() * .4); cards.setColorAt(i, c); }
    const group = new THREE.Group(); group.add(cards);
    addStation(5, -1, group, (t) => {
      for (let i = 0; i < count; i++) {
        const a = i * .55 + t * .35;
        const y = ((i * .34 + t * .7) % 15.6) - 7.8;
        dummy.position.set(Math.cos(a) * 3.4, y, Math.sin(a) * 3.4);
        dummy.rotation.set(0, -a + Math.PI / 2, 0);
        const fade = 1 - Math.abs(y) / 8.4;
        dummy.scale.setScalar(.35 + fade * .8);
        dummy.updateMatrix(); cards.setMatrixAt(i, dummy.matrix);
      }
      cards.instanceMatrix.needsUpdate = true;
    });
  }

  /* ---- 6 · lab: torus knot ---- */
  {
    const group = new THREE.Group();
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(2.4, .62, 260, 36, 2, 3), new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: .55 }));
    const inner = new THREE.Mesh(new THREE.TorusKnotGeometry(2.4, .3, 200, 20, 2, 3), new THREE.MeshStandardMaterial({ color: LIME, emissive: LIME, emissiveIntensity: .6, roughness: .3, metalness: .6 }));
    group.add(knot, inner);
    addStation(6, 1, group, (t, dt) => {
      group.rotation.y += dt * .3; group.rotation.x = Math.sin(t * .4) * .4;
      inner.scale.setScalar(1 + Math.sin(t * 2) * .04);
    });
  }

  /* ---- 7 · tools: python at the centre, AI tools in orbit ---- */
  {
    const group = new THREE.Group();
    const py = textSprite('python', { size: 84, color: '#c6ff3d', weight: 700 });
    py.scale.multiplyScalar(1.15);
    group.add(py);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 2), new THREE.MeshBasicMaterial({ color: LIME, wireframe: true, transparent: true, opacity: .25 }));
    group.add(core);
    const names = ['Claude', 'Codex', 'pi', 'opencode', 'hermes', 'openclaw', 'Kimi', 'DeepSeek'];
    const orbit = new THREE.Group();
    const colors = ['#ff9a5c', '#ecebf5', '#3de0ff', '#7c5cff', '#ffd23d', '#ff4d6d', '#5cffb0', '#6aa8ff'];
    names.forEach((n, i) => {
      const s = textSprite(n, { size: 54, color: colors[i] });
      const a = (i / names.length) * Math.PI * 2;
      s.position.set(Math.cos(a) * 4.8, Math.sin(i * 1.3) * 1.4, Math.sin(a) * 4.8);
      s.userData.a = a; s.userData.y = s.position.y;
      orbit.add(s);
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.8, .012, 6, 160), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .25 }));
    ring.rotation.x = Math.PI / 2;
    orbit.add(ring);
    group.add(orbit);
    group.rotation.x = .3;
    addStation(7, -1, group, (t, dt) => { orbit.rotation.y += dt * .35; core.rotation.y += dt * .4; core.rotation.x += dt * .2; });
  }

  /* ---- 8 · contact: beacon ---- */
  {
    const group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 3), new THREE.MeshStandardMaterial({ color: 0x14141f, emissive: VIOLET, emissiveIntensity: .35, roughness: .25, metalness: .8, flatShading: true }));
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5, 2), new THREE.MeshBasicMaterial({ color: LIME, wireframe: true, transparent: true, opacity: .35 }));
    group.add(core, wire);
    const waves = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.04, 96), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      group.add(m); return m;
    });
    addStation(8, 0, group, (t, dt) => {
      core.rotation.y += dt * .25; wire.rotation.y -= dt * .15; wire.rotation.x += dt * .1;
      waves.forEach((w, i) => {
        const p = ((t * .35 + i / 3) % 1);
        w.scale.setScalar(2.6 + p * 6.5);
        w.material.opacity = (1 - p) * (mobile ? .3 : .55);
      });
    });
    group.rotation.x = .2;
  }

  /* ---- layout & scroll mapping ---- */
  let vw = 1, vh = 1, mobile = false, centers = [];
  function measure() {
    vw = innerWidth; vh = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    mobile = vw / vh < 0.85 || vw < 860;
    centers = sections.map((s) => s.offsetTop + s.offsetHeight / 2);
    stations.forEach((st, i) => {
      const base = path[i];
      if (mobile) {
        st.group.position.set(base.x, base.y + 3.2, base.z - 20);
        st.baseScale = .62;
      } else {
        const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 17 * camera.aspect;
        st.group.position.set(base.x + st.side * Math.min(half * .5, 8.5), base.y, base.z - 17);
        st.baseScale = i === 0 ? .9 : 1;
      }
    });
  }

  function stationFloat() {
    const y = scrollY + vh / 2;
    if (y <= centers[0]) return 0;
    for (let i = 0; i < N - 1; i++) {
      if (y < centers[i + 1]) return i + (y - centers[i]) / (centers[i + 1] - centers[i]);
    }
    return N - 1;
  }

  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  let f = 0, fTarget = 0, last = performance.now(), time = 0, running = true;
  const look = new THREE.Vector3(), pos = new THREE.Vector3();
  document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); if (running) requestAnimationFrame(frame); });
  addEventListener('resize', measure);
  addEventListener('load', measure);

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    time += dt;

    fTarget = stationFloat();
    f += (fTarget - f) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 4.5));
    mouse.sx += (mouse.x - mouse.sx) * (1 - Math.exp(-dt * 3));
    mouse.sy += (mouse.y - mouse.sy) * (1 - Math.exp(-dt * 3));

    const u = clamp(f / (N - 1), 0, 1);
    curve.getPoint(u, pos);
    camera.position.copy(pos);
    camera.position.x += mouse.sx * .6;
    camera.position.y += -mouse.sy * .4;
    look.set(pos.x + mouse.sx * 1.4, pos.y - mouse.sy * .9, pos.z - 14);
    camera.lookAt(look);
    camera.rotation.z += Math.sin(time * .25) * .006;

    heroUniforms.uTime.value = time;
    heroUniforms.uPulse.value = Math.max(0, 1 - Math.abs(f)) * (.5 + .5 * Math.sin(time * 1.5)) * .6;

    const dtAnim = reduceMotion ? 0 : dt;
    stations.forEach((st, i) => {
      const d = Math.abs(f - i);
      const vis = d < 1.6;
      st.group.visible = vis;
      if (!vis) return;
      const close = clamp(1 - d, 0, 1);
      const k = st.baseScale * (.15 + .85 * (close * close * (3 - 2 * close)));
      st.group.scale.setScalar(k);
      st.update(time, dtAnim, close);
    });

    renderer.render(scene, camera);
  }

  measure();
  requestAnimationFrame((t) => { last = t; frame(t); });
  return true;
}

/* ---------------------------------------------------------------- boot */

initUI();
let ok = false;
try { ok = initScene(); } catch (err) { console.error(err); ok = false; }
if (!ok) document.documentElement.classList.add('no-webgl');
const loader = document.getElementById('loader');
setTimeout(() => loader.classList.add('done'), ok ? 600 : 100);
