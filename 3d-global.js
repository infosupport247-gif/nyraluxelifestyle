/* ============================================================
   NYRA LIFESTYLE — 3D ANIMATED SITE
   Shared Three.js scene manager + 3D CSS framework
   * 不要在其它网页中使用私有 API
   ============================================================ */

/* ---------- shared CSS (3d.css) ---------- */
/* 全局 CSS 变量和 3D 卡片、滚动动画、粒子等 */

/* ============================================================
   GLOBAL 3D SCENE MANAGER
   One scene per page. Call init3D({...}) from each page's
   own <script> after DOM ready.
   ============================================================ */

const _3D = (() => {
  const scenes = new Map();
  let mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let rafId = null;
  let scrollY = 0;

  /* ---------- mouse + scroll tracking ---------- */
  window.addEventListener('mousemove', e => {
    mouse.tx = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  /* ---------- smooth mouse lerp ---------- */
  function lerpMouse() {
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    rafId = requestAnimationFrame(lerpMouse);
  }
  lerpMouse();

  /* ---------- easing ---------- */
  const ease = t => 1 - Math.pow(1 - t, 3);

  /* ---------- create scene ---------- */
  function createScene(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 8);

    /* ---------- lights ---------- */
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff0e0, 1.3);
    key.position.set(5, 8, 6);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xd4a0a0, 0.35);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xc9a84c, 0.5);
    rim.position.set(0, -5, 5);
    scene.add(rim);

    /* ---------- mouse parallax group ---------- */
    const parGroup = new THREE.Group();
    scene.add(parGroup);

    /* ---------- resize ---------- */
    function onResize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (opts.onResize) opts.onResize(w, h);
    }
    window.addEventListener('resize', onResize);

    return { renderer, scene, camera, parGroup, onResize };
  }

  /* ---------- animate loop ---------- */
  function startLoop(id, fn) {
    function frame(t) {
      const s = scenes.get(id);
      if (!s) return;
      fn(s, t);
      s.renderer.render(s.scene, s.camera);
      s.raf = requestAnimationFrame(frame);
    }
    scenes.get(id).raf = requestAnimationFrame(frame);
  }

  /* ---------- teardown ---------- */
  function destroy(id) {
    const s = scenes.get(id);
    if (!s) return;
    if (s.raf) cancelAnimationFrame(s.raf);
    if (s.onResize) window.removeEventListener('resize', s.onResize);
    s.renderer.dispose();
    s.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
    scenes.delete(id);
  }

  /* ---------- 主入口 ---------- */
  function init3D(opts) {
    const id = opts.id || 'default';
    const existing = scenes.get(id);
    if (existing) return existing;

    const canvas = opts.canvas || document.getElementById(opts.canvasId);
    if (!canvas) { console.warn('[3D] canvas not found:', opts.canvasId); return null; }

    const s = createScene(canvas);
    s.opts = opts;
    scenes.set(id, s);

    /* ---------- 交给各页面自行添加几何体 ---------- */
    if (opts.onInit) opts.onInit(s);

    startLoop(id, (scene, t) => {
      if (opts.onAnimate) opts.onAnimate(scene, t);
    });

    return s;
  }

  /* ---------- 工具：创建带纹理的平面 ---------- */
  function textureFromUrl(url, color = 0xffffff, opacity = 1) {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    return mat;
  }

  function createPlane(w, h, material, pos = [0, 0, 0], rot = [0, 0, 0]) {
    const g = new THREE.PlaneGeometry(w, h);
    const m = new THREE.Mesh(g, material);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rot[0], rot[1], rot[2]);
    return m;
  }

  /* ---------- 粒子字段 ---------- */
  function createParticles(count, spread, color, size, alpha) {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i*3]   = (Math.random() - 0.5) * spread;
      positions[i*3+1] = (Math.random() - 0.5) * spread;
      positions[i*3+2] = (Math.random() - 0.5) * spread * 0.6 - 4;
      sizes[i] = Math.random() * size + size * 0.3;
      speeds[i] = 0.2 + Math.random() * 0.6;
      offsets[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: alpha,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    points.userData = { speeds, offsets, spread };
    return points;
  }

  function animateParticles(points, t) {
    const pos = points.geometry.attributes.position.array;
    const { speeds, offsets, spread } = points.userData;
    const len = pos.length / 3;
    for (let i = 0; i < len; i++) {
      const i3 = i * 3;
      pos[i3+1] += Math.sin(t * 0.0008 * speeds[i] + offsets[i]) * 0.0015;
      pos[i3]   += Math.cos(t * 0.0006 * speeds[i] + offsets[i]) * 0.001;
    }
    points.geometry.attributes.position.needsUpdate = true;
  }

  /* ---------- 文字 headline 3D 版 ---------- */
  function createTextSprite(text, opts = {}) {
    const {
      fontSize = 1.8,
      color = '#111111',
      fontFamily = 'Bodoni Moda, serif',
      weight = '700',
      letterSpacing = 0,
      gradient = null,
    } = opts;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1024;
    canvas.height = 256;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gradient) {
      const g = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.forEach(([stop, col]) => g.addColorStop(stop, col));
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = color;
    }

    ctx.font = `${weight} ${fontSize}rem/${fontSize * 1.1}rem ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (letterSpacing) {
      const words = text.split(' ');
      let x = canvas.width / 2;
      const tracking = letterSpacing * 10;
      words.forEach((word, i) => {
        const w = ctx.measureText(word).width;
        ctx.fillText(word, x - (words.length > 1 ? (words.length - 1 - i) * tracking / 2 : 0), canvas.height / 2);
        x += w + tracking;
      });
    } else {
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 1,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(4.5, 1.125, 1);
    return sprite;
  }

  /* ---------- 3D 卡片方案（用于文章、作品集卡片） ---------- */
  function tiltCard(el, intensity = 12) {
    if (!el) return;
    el.addEventListener('mousemove', e => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty('--rx', (-y * intensity).toFixed(2) + 'deg');
      el.style.setProperty('--ry', (x * intensity).toFixed(2) + 'deg');
    });
    el.addEventListener('mouseleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  }

  return {
    init3D,
    destroy,
    createParticles,
    animateParticles,
    createTextSprite,
    textureFromUrl,
    createPlane,
    tiltCard,
    mouse,
    scrollY,
    ease,
  };
})();

/* ---------- 在页面卸载时清理所有场景 ---------- */
window.addEventListener('beforeunload', () => {
  document.querySelectorAll('[data-3d-id]').forEach(el => {
    _3D.destroy(el.dataset['3dId'] ?? '');
  });
});

/* ---------- 滚动触发动画（Intersection Observer） ---------- */
const scrollObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

function observeEl(el) { if (el) scrollObserver.observe(el); }
function observeSel(sel) { document.querySelectorAll(sel).forEach(observeEl); }

/* ---------- 磁悬浮按钮效果 ---------- */
function magneticBtn(el, strength = 12) {
  if (!el) return;
  el.addEventListener('mousemove', e => {
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width * strength;
    const y = (e.clientY - rect.top - rect.height / 2) / rect.height * strength;
    el.style.transform = `translate(${x}px, ${y}px)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
  });
}
