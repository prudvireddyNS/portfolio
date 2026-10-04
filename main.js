import * as THREE from 'three';

window.__ready = true;

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(hover: none)').matches;
const sections = [...document.querySelectorAll('main > section')];
const N = sections.length;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* One palette for the whole page: 3D fog, lights and CSS accents all share it. */
const PALETTE = { bg: '#0a0612', a: '#ff7a59', b: '#e0a07a', c: '#f1dccb' };
const PAL = Array.from({ length: 8 }, () => Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, new THREE.Color(v)])));

/* ------------------------------------------------------------ smooth scroll */

let lenis = null;
if (!reduceMotion && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
  if (ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
}
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
if (gsap) gsap.ticker.lagSmoothing(0);
const scrollTo = (target) => {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
};

/* ---------------------------------------------------------------------- UI */

function splitText(el) {
  const walk = (node, grad) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const c = document.createElement('span'); c.className = 'ch' + (grad ? ' grad-w' : '');
          c.textContent = part; w.appendChild(c); frag.appendChild(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) {
        const isGrad = child.classList.contains('grad');
        if (isGrad) child.classList.add('grad-split');
        walk(child, grad || isGrad);
      }
    });
  };
  walk(el, false);
  return $$('.ch', el);
}

function initUI() {
  // dots
  const dots = $('#dots');
  sections.forEach((s) => {
    const a = document.createElement('a');
    a.href = '#' + s.id;
    a.innerHTML = `<span>${s.dataset.label}</span>`;
    a.setAttribute('aria-label', s.dataset.label);
    dots.appendChild(a);
  });
  const dotEls = [...dots.children];
  const secIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) dotEls.forEach((d, k) => d.classList.toggle('active', k === sections.indexOf(e.target)));
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  sections.forEach((s) => secIO.observe(s));

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    scrollTo(a.getAttribute('href'));
  });

  // rotating hero word
  const words = ['websites', 'mobile apps', 'desktop apps', 'AI agents', 'scrapers', '3D worlds', 'whatever\'s next'];
  const swap = $('#swap');
  const swapIn = document.createElement('span'); swapIn.className = 'swap-in';
  swapIn.textContent = swap.textContent; swap.textContent = ''; swap.appendChild(swapIn);
  // reserve the widest word so the headline never reflows while it rotates
  const sizeSwap = () => {
    const cur = swapIn.textContent; let w = 0;
    words.forEach((t) => { swapIn.textContent = t; w = Math.max(w, swapIn.getBoundingClientRect().width); });
    swapIn.textContent = cur; swap.style.minWidth = `min(${Math.ceil(w)}px, 100%)`;
  };
  sizeSwap();
  (document.fonts?.ready || Promise.resolve()).then(sizeSwap);
  addEventListener('resize', sizeSwap);
  let wi = 0;
  if (!reduceMotion) {
    const next = () => { wi = (wi + 1) % words.length; swapIn.textContent = words[wi]; swap.classList.remove('out'); };
    setInterval(() => {
      let done = false;
      const fin = () => { if (done) return; done = true; next(); };
      swapIn.addEventListener('transitionend', (e) => { if (e.propertyName === 'opacity') fin(); }, { once: true });
      setTimeout(fin, 450); // fallback if transitionend never fires
      swap.classList.add('out');
    }, 3000);
  }

  // progress bar
  const bar = $('.progress i');
  const updateBar = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max, 0, 1) : 0})`;
  };
  addEventListener('scroll', updateBar, { passive: true }); updateBar();

  // --- little live visuals ---
  const cellBars = $('#cellBars');
  for (let i = 0; i < 16; i++) {
    const b = document.createElement('i');
    b.style.setProperty('--h', 40 + Math.round(Math.abs(Math.sin(i * 1.3)) * 60) + '%');
    b.style.setProperty('--d', (-i * 0.23).toFixed(2) + 's');
    cellBars.appendChild(b);
  }
  const scr = $('#scr');
  for (let i = 0; i < 12; i++) {
    const b = document.createElement('i');
    b.style.setProperty('--d', ((i * 0.37) % 3.2).toFixed(2) + 's');
    scr.appendChild(b);
  }
  const pbars = $('#pbars');
  [100, 96, 88, 66, 42, 24, 12, 5].forEach((h, k) => {
    const b = document.createElement('i');
    b.style.setProperty('--h', h + '%'); b.style.setProperty('--k', k);
    pbars.appendChild(b);
  });

  // battery ring
  const ringVal = $('#ringVal'), ringNum = $('#ringNum');
  let soc = 87;
  const setSoc = (v) => {
    soc = v;
    ringVal.style.strokeDashoffset = (326.7 * (1 - v / 100)).toFixed(1);
    ringNum.textContent = Math.round(v);
  };
  let socTimer = null;
  const startSoc = () => {
    if (socTimer) return;
    setSoc(87);
    socTimer = setInterval(() => setSoc(clamp(soc + (Math.random() > .5 ? 1 : -1) * (1 + Math.random() * 2), 78, 96)), 1600);
  };

  // terminal
  const termOut = $('#termOut');
  let typed = false;
  const typeTerminal = () => {
    if (typed) return; typed = true;
    const lines = [
      [['>>> ', 'p'], ['languages_i_actually_know', 'k']],
      [["['python']", 's']],
      [['>>> ', 'p'], ['shipped_anyway', 'k']],
      [["['typescript', 'next.js', 'react', 'c#', 'flutter']", 's']],
      [['>>> ', 'p'], ['still_running', 'k']],
      [['True', 's']],
    ];
    const caret = document.createElement('span'); caret.className = 'caret';
    termOut.textContent = ''; termOut.appendChild(caret);
    if (reduceMotion) {
      lines.forEach((l, i) => { l.forEach(([t, c]) => { const s = document.createElement('span'); s.className = c; s.textContent = t; termOut.insertBefore(s, caret); }); if (i < lines.length - 1) termOut.insertBefore(document.createTextNode('\n'), caret); });
      return;
    }
    const queue = [];
    lines.forEach((l, i) => { l.forEach(([t, c]) => queue.push({ t, c })); if (i < lines.length - 1) queue.push({ t: '\n', c: '' }); });
    let qi = 0, ci = 0, span = null;
    (function step() {
      if (qi >= queue.length) return;
      const seg = queue[qi];
      if (!span) { span = document.createElement('span'); span.className = seg.c; termOut.insertBefore(span, caret); }
      span.textContent += seg.t[ci++];
      if (ci >= seg.t.length) { qi++; ci = 0; span = null; setTimeout(step, seg.t === '\n' ? 140 : 90); }
      else setTimeout(step, seg.c === 'p' ? 40 : 22);
    })();
  };

  // number counters
  const count = (el) => {
    if (el.dataset.done) return; el.dataset.done = '1';
    const end = +el.dataset.count, dec = +(el.dataset.dec || 0), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    const fmt = (v) => pre + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US')) + suf;
    if (!gsap || reduceMotion) { el.textContent = fmt(end); return; }
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.8, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v); } });
  };

  // marquees
  const marquees = $$('.marquee').map((el) => {
    const track = $('.track', el);
    const m = { el, track, base: track.innerHTML, unit: 1, x: 0, speed: +el.dataset.speed || 50, dir: +el.dataset.dir || 1, vis: true };
    new IntersectionObserver(([e]) => { m.vis = e.isIntersecting; }).observe(el);
    return m;
  });
  const buildMarquees = () => {
    marquees.forEach((m) => {
      m.track.innerHTML = m.base;
      m.unit = m.track.scrollWidth || 1;
      const reps = Math.ceil((innerWidth * 2) / m.unit) + 1;
      m.track.innerHTML = m.base.repeat(reps + 1);
      m.x = m.dir > 0 ? -m.unit : 0;
    });
  };
  (document.fonts?.ready || Promise.resolve()).then(buildMarquees);
  addEventListener('resize', buildMarquees);

  // cursor, magnetic, tilt, tile glow
  const cursor = $('.cursor');
  if (!coarse && gsap) {
    const cx = gsap.quickTo(cursor, 'x', { duration: .35, ease: 'power3' });
    const cy = gsap.quickTo(cursor, 'y', { duration: .35, ease: 'power3' });
    addEventListener('pointermove', (e) => {
      cursor.classList.add('on'); cx(e.clientX); cy(e.clientY);
      const tile = e.target.closest?.('.tile');
      if (tile) { const r = tile.getBoundingClientRect(); tile.style.setProperty('--mx', (e.clientX - r.left) + 'px'); }
    }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const lab = e.target.closest?.('[data-cursor]');
      const hov = e.target.closest?.('a, button, .magnetic');
      cursor.classList.toggle('label', !!lab);
      cursor.classList.toggle('hover', !!hov && !lab);
      $('span', cursor).textContent = lab ? lab.dataset.cursor : '';
    });

    $$('.magnetic').forEach((el) => {
      const qx = gsap.quickTo(el, 'x', { duration: .5, ease: 'power3' });
      const qy = gsap.quickTo(el, 'y', { duration: .5, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        qx((e.clientX - (r.left + r.width / 2)) * .16); qy((e.clientY - (r.top + r.height / 2)) * .2);
      });
      el.addEventListener('pointerleave', () => { qx(0); qy(0); });
    });

    $$('.tilt').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        gsap.to(el, { rotationY: (px - .5) * 6, rotationX: (.5 - py) * 6, transformPerspective: 900, duration: .5, ease: 'power3', overwrite: 'auto' });
        el.style.setProperty('--gx', (px * 100) + '%'); el.style.setProperty('--gy', (py * 100) + '%'); el.style.setProperty('--go', 1);
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { rotationY: 0, rotationX: 0, duration: .8, ease: 'power3', overwrite: 'auto' });
        el.style.setProperty('--go', 0);
      });
    });
  }

  /* entrance animations — started once the loader is gone */
  const enter = () => {
    if (!gsap || !ScrollTrigger || reduceMotion) {
      $$('.reveal').forEach((e) => { e.style.opacity = 1; e.style.transform = 'none'; });
      $$('[data-split]').forEach((e) => splitText(e));
      $$('[data-count]').forEach(count); typeTerminal(); startSoc(); setSoc(87); pbars.classList.add('in');
      return;
    }
    // headlines: words rise out of a mask
    $$('[data-split]').forEach((el) => {
      const chars = splitText(el);
      gsap.set(chars, { y: 0, yPercent: 115 });
      const play = () => gsap.to(chars, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: .07 });
      if (el.closest('#hero')) { gsap.delayedCall(el.classList.contains('h1b') ? .25 : 0, play); }
      else ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: play });
    });
    // everything else fades up in batches
    gsap.set('.reveal', { opacity: 0, y: 12 });
    ScrollTrigger.batch('.reveal', {
      start: 'top 90%', once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: .9, ease: 'power2.out', stagger: .08 }),
    });
    // scroll-linked flourishes
    $$('.eyebrow').forEach((el) => gsap.fromTo(el, { letterSpacing: '.5em' }, { letterSpacing: '.16em', ease: 'none', scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 55%', scrub: true } }));
    $$('.proj').forEach((el, i) => gsap.fromTo(el, { yPercent: 10 + i * 4 }, { yPercent: -4, ease: 'none', scrollTrigger: { trigger: '.showcase', start: 'top bottom', end: 'bottom 40%', scrub: .6 } }));
    $$('[data-count]').forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => count(el) }));
    ScrollTrigger.create({ trigger: '#terminal', start: 'top 80%', once: true, onEnter: typeTerminal });
    ScrollTrigger.create({ trigger: '.telemetry', start: 'top 80%', once: true, onEnter: startSoc });
    ScrollTrigger.create({ trigger: '#pbars', start: 'top 90%', once: true, onEnter: () => pbars.classList.add('in') });
    ScrollTrigger.refresh();
  };

  const marqueeStep = (dt, vel) => {
    marquees.forEach((m) => {
      if (!m.vis) return;
      m.x += m.dir * (m.speed + vel * .08) * dt;
      if (m.dir > 0 && m.x > 0) m.x -= m.unit;
      if (m.dir < 0 && m.x < -m.unit) m.x += m.unit;
      m.track.style.transform = `translate3d(${m.x.toFixed(1)}px,0,0)`;
    });
  };
  return { enter, marqueeStep };
}

/* ------------------------------------------------------------------ WebGL */

async function initScene() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('#bg'), antialias: false, powerPreference: 'high-performance' });
  } catch (err) { return null; }

  const SPACING = 48;
  const mobileQuery = () => innerWidth / innerHeight < 0.85 || innerWidth < 860;
  let mobile = mobileQuery();

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0612, 0.011);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
  scene.add(camera);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const lightA = new THREE.PointLight(0xffffff, 40, 44); lightA.position.set(4, 3, 2);
  const lightB = new THREE.PointLight(0xffffff, 40, 44); lightB.position.set(-4, -2, 2);
  camera.add(lightA, lightB);

  /* post: bloom (best effort — falls back to a plain render) */
  let composer = null, bloom = null;
  try {
    if (location.search.includes('lite')) throw new Error('lite mode');
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import('./vendor/jsm/postprocessing/EffectComposer.js'),
      import('./vendor/jsm/postprocessing/RenderPass.js'),
      import('./vendor/jsm/postprocessing/UnrealBloomPass.js'),
      import('./vendor/jsm/postprocessing/OutputPass.js'),
    ]);
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.4, 0.4);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  } catch (err) { composer = null; }

  const dotTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  /* camera path */
  const wander = [[0, 0], [1.6, .8], [-1.6, -.6], [1.4, .6], [-1, 0], [1.2, -.8], [-1.4, .6], [0, 0]];
  const path = sections.map((_, i) => new THREE.Vector3(wander[i % wander.length][0], wander[i % wander.length][1], -i * SPACING));
  const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0.3);

  /* dust */
  const dustMat = new THREE.PointsMaterial({ size: 0.32, map: dotTex, alphaTest: .01, color: 0xffffff, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending });
  {
    const count = 5200, pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - .5) * 140;
      pos[i * 3 + 1] = (Math.random() - .5) * 90;
      pos[i * 3 + 2] = 60 - Math.random() * (N * SPACING + 120);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, dustMat));
  }

  /* ---- stations ---- */
  const stations = [];
  const place = [
    { side: 0, s: .9 }, { side: 1, s: 1 }, { side: -1, s: 1 }, { side: 1, s: 1 },
    { side: 0, s: .8 }, { side: 0, s: 1.1 }, { side: 0, s: .8 }, { side: 0, s: 1 },
  ];
  const station = (i, group, update) => { scene.add(group); stations[i] = { group, update, ...place[i] }; };

  const heroU = { uTime: { value: 0 }, uPulse: { value: 0 }, uScatter: { value: 1 }, uA: { value: PAL[0].a }, uB: { value: PAL[0].b } };

  // 0 · hero: living particle planet
  {
    const P = PAL[0];
    const count = 11000, pos = new Float32Array(count * 3), seed = new Float32Array(count), dir = new Float32Array(count * 3);
    const golden = Math.PI * (3 - Math.sqrt(5)), v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i, R = 4.6;
      pos.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
      seed[i] = Math.random();
      v.randomDirection().multiplyScalar(.4 + Math.random()); dir.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    const m = new THREE.ShaderMaterial({
      uniforms: heroU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uTime, uPulse, uScatter; attribute float aSeed; attribute vec3 aDir; varying float vMix; varying float vA;
        void main(){
          vec3 p = position;
          float n = sin(p.x*1.3+uTime*.7) + sin(p.y*1.7+uTime*.55) + sin(p.z*1.5+uTime*.65);
          p += normalize(position) * (n*.3 + uPulse*aSeed*.6);
          p += aDir * uScatter * 26.;
          vec4 mv = modelViewMatrix * vec4(p,1.);
          gl_PointSize = (1.3 + aSeed*2.4) * (38. / -mv.z);
          gl_Position = projectionMatrix * mv;
          vMix = clamp(n*.17 + .5 + aSeed*.2, 0., 1.);
          vA = .6 + aSeed*.4;
        }`,
      fragmentShader: `
        uniform vec3 uA, uB; varying float vMix; varying float vA;
        void main(){
          float d = length(gl_PointCoord - .5); if(d > .5) discard;
          gl_FragColor = vec4(mix(uB, uA, vMix), smoothstep(.5, .0, d) * vA);
        }`,
    });
    const group = new THREE.Group();
    group.add(new THREE.Points(g, m));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.02, 8, 220), new THREE.MeshBasicMaterial({ color: P.c, transparent: true, opacity: .55 }));
    ring.rotation.x = 1.25; group.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.012, 8, 220), new THREE.MeshBasicMaterial({ color: P.b, transparent: true, opacity: .35 }));
    ring2.rotation.set(1.9, .4, 0); group.add(ring2);
    station(0, group, (t, dt) => { group.rotation.y += dt * .12; ring.rotation.z += dt * .2; ring2.rotation.z -= dt * .14; });
  }

  // 1 · about: gyroscope
  {
    const P = PAL[1], group = new THREE.Group();
    const mats = [P.a, P.b, P.c].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .45, roughness: .3, metalness: .7 }));
    const rings = [3.6, 2.8, 2.0].map((r, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, .09, 16, 120), mats[i]); group.add(m); return m; });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.9, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: .2, metalness: .8, emissive: P.a, emissiveIntensity: .45 }));
    group.add(core);
    station(1, group, (t, dt) => {
      rings[0].rotation.x += dt * .6; rings[0].rotation.y += dt * .2;
      rings[1].rotation.y += dt * .8; rings[1].rotation.z += dt * .3;
      rings[2].rotation.z += dt; rings[2].rotation.x -= dt * .4;
      core.rotation.y += dt * .5; core.rotation.x += dt * .3;
    });
  }

  // 2 · now: battery pack
  {
    const P = PAL[2], cols = 9, rows = 5;
    const cells = new THREE.InstancedMesh(new THREE.CylinderGeometry(.42, .42, 1.9, 24), new THREE.MeshStandardMaterial({ roughness: .35, metalness: .55 }), cols * rows);
    const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(.16, .16, .12, 12), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: .9, roughness: .25 }), cols * rows);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    const low = new THREE.Color(0x5a3a3a), high = P.a;
    const group = new THREE.Group(); group.add(cells, caps);
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(cols + .6, 2.4, rows + .6)), new THREE.LineBasicMaterial({ color: P.b, transparent: true, opacity: .6 })));
    group.rotation.set(.55, -.5, 0);
    station(2, group, (t) => {
      for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) {
        const i = x * rows + z, lvl = .5 + .5 * Math.sin(t * 1.4 - x * .55 - z * .35);
        dummy.position.set(x - (cols - 1) / 2, 0, z - (rows - 1) / 2);
        dummy.scale.set(1, .55 + lvl * .45, 1); dummy.updateMatrix(); cells.setMatrixAt(i, dummy.matrix);
        color.copy(low).lerp(high, lvl); cells.setColorAt(i, color);
        dummy.position.y = .95 * dummy.scale.y + .06; dummy.scale.set(1, 1, 1); dummy.updateMatrix(); caps.setMatrixAt(i, dummy.matrix);
      }
      cells.instanceMatrix.needsUpdate = true; caps.instanceMatrix.needsUpdate = true;
      if (cells.instanceColor) cells.instanceColor.needsUpdate = true;
    });
  }

  // 3 · before: scraper / agent network
  {
    const P = PAL[3], group = new THREE.Group(), pts = [];
    for (let i = 0; i < 90; i++) pts.push(new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 3.6));
    const linePos = [], edges = [];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (pts[i].distanceTo(pts[j]) < 2.5) { linePos.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z); edges.push([i, j]); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: P.b, transparent: true, opacity: .5 })));
    group.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), new THREE.PointsMaterial({ color: P.a, size: .55, map: dotTex, alphaTest: .01, depthWrite: false, transparent: true })));
    const pGeo = new THREE.SphereGeometry(.1, 8, 8), pMat = new THREE.MeshBasicMaterial({ color: P.c });
    const packets = Array.from({ length: 22 }, () => { const m = new THREE.Mesh(pGeo, pMat); group.add(m); return { m, e: edges[(Math.random() * edges.length) | 0], t: Math.random(), s: .4 + Math.random() * .8 }; });
    const target = new THREE.Mesh(new THREE.OctahedronGeometry(.75, 0), new THREE.MeshBasicMaterial({ color: P.b, wireframe: true })); group.add(target);
    station(3, group, (t, dt) => {
      group.rotation.y += dt * .12; target.rotation.x += dt * .9; target.rotation.y += dt * .6; target.scale.setScalar(1 + Math.sin(t * 3) * .08);
      for (const p of packets) { p.t += dt * p.s; if (p.t > 1) { p.t = 0; p.e = edges[(Math.random() * edges.length) | 0]; } p.m.position.lerpVectors(pts[p.e[0]], pts[p.e[1]], p.t); }
    });
  }

  // 4 · built: helix of cards
  {
    const P = PAL[4], count = 46, dummy = new THREE.Object3D(), c = new THREE.Color(), pal = [P.a, P.b, P.c];
    const cards = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.7, 1.05), new THREE.MeshBasicMaterial({ transparent: true, opacity: .6, side: THREE.DoubleSide, depthWrite: false }), count);
    for (let i = 0; i < count; i++) { c.copy(pal[i % 3]).multiplyScalar(.8 + Math.random() * .4); cards.setColorAt(i, c); }
    const group = new THREE.Group(); group.add(cards);
    station(4, group, (t) => {
      for (let i = 0; i < count; i++) {
        const a = i * .55 + t * .35, y = ((i * .34 + t * .7) % 15.6) - 7.8;
        dummy.position.set(Math.cos(a) * 3.4, y, Math.sin(a) * 3.4); dummy.rotation.set(0, -a + Math.PI / 2, 0);
        dummy.scale.setScalar(.35 + (1 - Math.abs(y) / 8.4) * .8); dummy.updateMatrix(); cards.setMatrixAt(i, dummy.matrix);
      }
      cards.instanceMatrix.needsUpdate = true;
    });
  }

  // 5 · lab: torus knot
  {
    const P = PAL[5], group = new THREE.Group();
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(2.4, .62, 260, 36, 2, 3), new THREE.MeshBasicMaterial({ color: P.b, wireframe: true, transparent: true, opacity: .6 }));
    const inner = new THREE.Mesh(new THREE.TorusKnotGeometry(2.4, .3, 200, 20, 2, 3), new THREE.MeshStandardMaterial({ color: P.a, emissive: P.a, emissiveIntensity: .4, roughness: .3, metalness: .6 }));
    group.add(knot, inner);
    station(5, group, (t, dt) => { group.rotation.y += dt * .3; group.rotation.x = Math.sin(t * .4) * .4; inner.scale.setScalar(1 + Math.sin(t * 2) * .04); });
  }

  // 6 · tools: python core, orbiting AI satellites
  {
    const P = PAL[6], group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 2), new THREE.MeshBasicMaterial({ color: P.a, wireframe: true, transparent: true, opacity: .55 })); group.add(core);
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(.8, 1), new THREE.MeshStandardMaterial({ color: P.a, emissive: P.a, emissiveIntensity: .45, flatShading: true })); group.add(heart);
    const orbit = new THREE.Group();
    const sats = Array.from({ length: 8 }, (_, i) => {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(.28, 0), new THREE.MeshStandardMaterial({ color: i % 2 ? P.b : P.c, emissive: i % 2 ? P.b : P.c, emissiveIntensity: .4 }));
      const a = (i / 8) * Math.PI * 2; m.position.set(Math.cos(a) * 4.8, Math.sin(i * 1.3) * 1.3, Math.sin(a) * 4.8); orbit.add(m); return m;
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.8, .014, 6, 180), new THREE.MeshBasicMaterial({ color: P.b, transparent: true, opacity: .45 })); ring.rotation.x = Math.PI / 2; orbit.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.2, .014, 6, 160), new THREE.MeshBasicMaterial({ color: P.a, transparent: true, opacity: .35 })); ring2.rotation.x = Math.PI / 2; orbit.add(ring2);
    group.add(orbit); group.rotation.x = .3;
    station(6, group, (t, dt) => { orbit.rotation.y += dt * .4; core.rotation.y += dt * .4; core.rotation.x += dt * .2; heart.rotation.y -= dt * .8; sats.forEach((s) => { s.rotation.x += dt * 2; s.rotation.y += dt; }); });
  }

  // 7 · contact: beacon
  {
    const P = PAL[7], group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 3), new THREE.MeshStandardMaterial({ color: 0x14101f, emissive: P.b, emissiveIntensity: .5, roughness: .25, metalness: .8, flatShading: true }));
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5, 2), new THREE.MeshBasicMaterial({ color: P.a, wireframe: true, transparent: true, opacity: .4 }));
    group.add(core, wire);
    const waves = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.04, 96), new THREE.MeshBasicMaterial({ color: P.c, transparent: true, side: THREE.DoubleSide, depthWrite: false })); group.add(m); return m; });
    group.rotation.x = .2;
    station(7, group, (t, dt) => {
      core.rotation.y += dt * .25; wire.rotation.y -= dt * .15; wire.rotation.x += dt * .1;
      waves.forEach((w, i) => { const p = (t * .35 + i / 3) % 1; w.scale.setScalar(2.6 + p * 6.5); w.material.opacity = (1 - p) * (mobile ? .16 : .24); });
    });
  }

  /* ---- layout ---- */
  let vw = 1, vh = 1, centers = [];
  const baseBloom = () => (mobile ? .15 : .2);
  function measure() {
    vw = innerWidth; vh = innerHeight; mobile = mobileQuery();
    const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
    renderer.setPixelRatio(dpr); renderer.setSize(vw, vh, false);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(vw, vh); }
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    centers = sections.map((s) => s.offsetTop + s.offsetHeight / 2);
    stations.forEach((st, i) => {
      const base = path[i];
      if (mobile) { st.group.position.set(base.x, base.y + 3.4, base.z - 21); st.k = .62 * st.s; }
      else {
        const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 17 * camera.aspect;
        st.group.position.set(base.x + st.side * Math.min(half * .5, 8.5), base.y, base.z - (st.side ? 17 : 21)); st.k = st.s;
      }
    });
  }
  const stationFloat = () => {
    const y = scrollY + vh / 2;
    if (y <= centers[0]) return 0;
    for (let i = 0; i < N - 1; i++) if (y < centers[i + 1]) return i + (y - centers[i]) / (centers[i + 1] - centers[i]);
    return N - 1;
  };

  /* ---- palette: one fixed palette, applied once ---- */
  const P0 = PAL[0];
  scene.fog.color.copy(P0.bg); renderer.setClearColor(P0.bg);
  lightA.color.copy(P0.a); lightB.color.copy(P0.b);
  dustMat.color.copy(P0.c).lerp(P0.a, .35);

  /* ---- loop ---- */
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  addEventListener('resize', measure); addEventListener('load', measure);

  const state = { intro: reduceMotion ? 1 : 0 };
  let f = 0, last = performance.now(), time = 0, prevY = scrollY, vel = 0, fov = 55;
  const look = new THREE.Vector3(), pos = new THREE.Vector3();
  let onFrame = () => {};

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); last = now; time += dt;
    if (lenis) lenis.raf(now);

    vel += (((scrollY - prevY) / Math.max(dt, .001)) - vel) * (1 - Math.exp(-dt * 8)); prevY = scrollY;
    f += (stationFloat() - f) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 9));
    mouse.sx += (mouse.x - mouse.sx) * (1 - Math.exp(-dt * 3)); mouse.sy += (mouse.y - mouse.sy) * (1 - Math.exp(-dt * 3));

    curve.getPoint(clamp(f / (N - 1), 0, 1), pos);
    const intro = smooth(state.intro);
    camera.position.copy(pos); camera.position.z += (1 - intro) * 30;
    camera.position.x += mouse.sx * .6; camera.position.y += -mouse.sy * .4;
    look.set(pos.x + mouse.sx * 1.4, pos.y - mouse.sy * .9, pos.z - 14); camera.lookAt(look);
    fov += ((55 + (1 - intro) * 18) - fov) * (1 - Math.exp(-dt * 6));
    if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }

    heroU.uTime.value = time; heroU.uScatter.value = Math.pow(1 - intro, 2);
    heroU.uPulse.value = Math.max(0, 1 - Math.abs(f)) * (.5 + .5 * Math.sin(time * 1.5)) * .6;
    if (bloom) bloom.strength = baseBloom() + (1 - intro) * .25;

    const da = reduceMotion ? 0 : dt;
    stations.forEach((st, i) => {
      const d = Math.abs(f - i), vis = d < 1.6;
      st.group.visible = vis; if (!vis) return;
      const close = clamp(1 - d, 0, 1);
      st.group.scale.setScalar(st.k * (.12 + .88 * smooth(close)));
      st.update(time, da, close);
    });

    onFrame(dt, vel);
    composer ? composer.render() : renderer.render(scene, camera);
  }

  measure();
  requestAnimationFrame((t) => { last = t; frame(t); });
  return { state, setOnFrame: (fn) => { onFrame = fn; } };
}

/* ------------------------------------------------------------------- boot */

const ui = initUI();
const loadNum = $('#loadNum'), loadBar = $('#loadBar'), loader = $('#loader');
const loadObj = { v: 0 };
const paint = () => { loadNum.textContent = Math.round(loadObj.v); loadBar.style.transform = `scaleX(${loadObj.v / 100})`; };
if (gsap && !reduceMotion) gsap.to(loadObj, { v: 88, duration: 1.6, ease: 'power2.out', onUpdate: paint });

let scene3d = null;
const sceneReady = (async () => { try { scene3d = await initScene(); } catch (err) { console.error(err); } })();
const fontsReady = Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);

Promise.all([sceneReady, fontsReady]).then(() => {
  if (!scene3d) document.documentElement.classList.add('no-webgl');
  else scene3d.setOnFrame((dt, vel) => ui.marqueeStep(dt, vel));
  const finish = () => {
    loader.classList.add('done');
    ui.enter();
    if (scene3d && gsap && !reduceMotion) gsap.to(scene3d.state, { intro: 1, duration: 3, ease: 'power2.out' });
    if (!scene3d) {
      // no WebGL: keep marquees moving
      let last = performance.now();
      (function loop(now) { requestAnimationFrame(loop); const dt = Math.min((now - last) / 1000, .05); last = now; if (lenis) lenis.raf(now); ui.marqueeStep(dt, 0); })(last);
    }
  };
  if (gsap && !reduceMotion) gsap.to(loadObj, { v: 100, duration: .5, ease: 'power1.out', onUpdate: paint, onComplete: () => setTimeout(finish, 150) });
  else { loadObj.v = 100; paint(); finish(); }
});
