/*
 * Draws one frame of a scene for any time t (seconds). Everything is a pure function of t, so the
 * renderer can step through frames in any order and get identical output.
 *
 * Scene format (see scenes.js):
 *   shots:      [{ shot, at, fade }]            screenshot crossfades (shot = manifest key)
 *   camera:     [{ t, at, z }]                  at = 'shot.box' | [x, y] in screenshot pixels; z = zoom
 *   cursor:     [{ t, at, dx, dy }] | null      pointer path; tip lands on the box centre (+dx/dy)
 *   clicks:     [t, ...]                        click ripple + press at the cursor position
 *   highlights: [{ from, to, at, pad }]         glowing ring around a box
 *   callouts:   [{ from, to, at, text, side }]  label pill next to a box
 *   captions:   [{ from, to, kicker, title }]   lower-left title
 *   cards:      [{ from, to, html }]            full-frame title card
 *   ticks:      [{ from, to, at }]              a checkbox drawn as ticked (for clicks the screenshots don't show)
 */
(() => {
  const W = 1440;
  const H = 900;
  const FADE = 0.35;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);

  /** 0→1→0 envelope for an element shown between from and to. */
  function envelope(t, from, to, fadeIn = 0.3, fadeOut = 0.3) {
    if (t < from || t > to) return 0;
    return Math.min(1, (t - from) / fadeIn, (to - t) / fadeOut);
  }

  function resolveBox(ref) {
    if (Array.isArray(ref)) return ref.length === 4 ? { x: ref[0], y: ref[1], w: ref[2], h: ref[3] } : { x: ref[0], y: ref[1], w: 0, h: 0 };
    const [shot, key] = ref.split('.');
    const box = window.MANIFEST[shot]?.boxes?.[key];
    if (!box) throw new Error(`Unknown box ${ref}`);
    return box;
  }
  const centre = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

  /** Eased interpolation through keyframes [{t, ...numbers}]. */
  function track(keys, t, fields) {
    if (!keys.length) return null;
    if (t <= keys[0].t) return keys[0];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i].t) {
        const a = keys[i - 1];
        const b = keys[i];
        const k = easeInOut((t - a.t) / (b.t - a.t || 1));
        return Object.fromEntries(fields.map((f) => [f, lerp(a[f], b[f], k)]));
      }
    }
    return keys.at(-1);
  }

  function el(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    parent.appendChild(e);
    return e;
  }

  const CURSOR_SVG = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M3 2 L3 19 L7.6 14.8 L10.6 21.6 L13.6 20.3 L10.7 13.6 L17 13.4 Z" fill="#fff" stroke="#0f1d33" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  let scene;
  let parts;

  function setup(name) {
    scene = window.SCENES[name];
    if (!scene) throw new Error(`Unknown scene ${name}`);
    const world = document.getElementById('world');
    const hud = document.getElementById('hud');
    world.innerHTML = '';
    hud.innerHTML = '';

    const shots = scene.shots.map((s) => {
      const meta = window.MANIFEST[s.shot];
      if (!meta) throw new Error(`Unknown shot ${s.shot}`);
      const img = el('img', 'shot', world);
      img.src = `shots/${meta.file}`;
      img.style.width = `${meta.w}px`;
      img.style.height = `${meta.h}px`;
      return { ...s, fade: s.fade ?? FADE, meta, img };
    });

    const camera = scene.camera.map((k) => {
      const p = centre(resolveBox(k.at ?? [W / 2, H / 2]));
      return { t: k.t, x: p.x + (k.dx ?? 0), y: p.y + (k.dy ?? 0), z: k.z ?? 1 };
    });

    // The pointer rests at each stop for `hold` seconds (so clicks land on target) before moving on.
    const cursorKeys = (scene.cursor ?? []).flatMap((k, i, all) => {
      const p = centre(resolveBox(k.at));
      const key = { t: k.t, x: p.x + (k.dx ?? 0), y: p.y + (k.dy ?? 0) };
      const next = all[i + 1]?.t ?? Infinity;
      const hold = Math.min(k.hold ?? 0.5, Math.max(0, next - k.t - 0.3));
      return hold > 0 ? [key, { ...key, t: k.t + hold }] : [key];
    });

    const TICK = '<svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const ticks = (scene.ticks ?? []).map((k) => ({ ...k, box: resolveBox(k.at), node: el('div', 'tick', world, TICK) }));
    const rings = (scene.highlights ?? []).map((h) => ({ ...h, box: resolveBox(h.at), node: el('div', 'ring', world) }));
    const callouts = (scene.callouts ?? []).map((c) => ({ ...c, box: resolveBox(c.at), node: el('div', 'callout', hud, c.text) }));
    const captions = (scene.captions ?? []).map((c) => ({ ...c, node: el('div', 'caption', hud, `<small>${c.kicker}</small><strong>${c.title}</strong>`) }));
    const cards = (scene.cards ?? []).map((c) => ({ ...c, node: el('div', 'card', hud, c.html) }));
    const ripples = (scene.clicks ?? []).map((t) => ({ t, node: el('div', 'ripple', hud) }));
    const cursor = cursorKeys.length ? el('div', 'cursor', hud, CURSOR_SVG) : null;

    parts = { shots, camera, cursorKeys, ticks, rings, callouts, captions, cards, ripples, cursor, world };
    return Promise.all([
      ...shots.map((s) => s.img.decode().catch(() => {})),
      document.fonts.ready,
    ]).then(() => ({ duration: scene.duration, poster: scene.poster ?? scene.duration / 2 }));
  }

  function render(t) {
    const { shots, camera, cursorKeys, ticks, rings, callouts, captions, cards, ripples, cursor, world } = parts;

    // Screenshots: the newest one that has started fades in over the one before it.
    let current = 0;
    shots.forEach((s, i) => { if (t >= s.at) current = i; });
    shots.forEach((s, i) => {
      let o = 0;
      if (i === current) o = s.at === 0 && i === 0 ? 1 : easeOut(clamp((t - s.at) / s.fade, 0, 1));
      else if (i === current - 1) o = 1;
      s.img.style.opacity = o;
      s.img.style.zIndex = i === current ? 2 : 1;
    });
    const shot = shots[current].meta;

    // Camera, kept inside the current screenshot.
    const cam = track(camera, t, ['x', 'y', 'z']) ?? { x: W / 2, y: H / 2, z: 1 };
    const z = cam.z;
    const cx = clamp(cam.x, W / (2 * z), Math.max(W / (2 * z), shot.w - W / (2 * z)));
    const cy = clamp(cam.y, H / (2 * z), Math.max(H / (2 * z), shot.h - H / (2 * z)));
    const ox = W / 2 - cx * z;
    const oy = H / 2 - cy * z;
    world.style.transform = `translate(${ox}px, ${oy}px) scale(${z})`;
    const toScreen = (x, y) => ({ x: ox + x * z, y: oy + y * z });

    for (const k of ticks) {
      const on = t >= k.from && t <= k.to;
      Object.assign(k.node.style, { left: `${k.box.x}px`, top: `${k.box.y}px`, width: `${k.box.w}px`, height: `${k.box.h}px`, opacity: on ? 1 : 0, transform: `scale(${on ? 1 - 0.25 * Math.max(0, 1 - (t - k.from) / 0.15) : 1})` });
    }

    for (const r of rings) {
      const pad = r.pad ?? 8;
      const o = envelope(t, r.from, r.to, 0.35, 0.35);
      const pulse = 1 + 0.015 * Math.sin((t - r.from) * 5);
      Object.assign(r.node.style, {
        left: `${r.box.x - pad}px`, top: `${r.box.y - pad}px`, width: `${r.box.w + pad * 2}px`, height: `${r.box.h + pad * 2}px`,
        opacity: o, transform: `scale(${pulse * (0.96 + 0.04 * o)})`, borderWidth: `${3 / z}px`,
      });
    }

    for (const c of callouts) {
      const o = envelope(t, c.from, c.to, 0.3, 0.3);
      const side = c.side ?? 'right';
      const a = toScreen(c.box.x, c.box.y);
      const b = toScreen(c.box.x + c.box.w, c.box.y + c.box.h);
      const rect = c.node.getBoundingClientRect();
      const gap = 16;
      let x = side === 'left' ? a.x - rect.width - gap : side === 'right' ? b.x + gap : (a.x + b.x) / 2 - rect.width / 2;
      let y = side === 'top' ? a.y - rect.height - gap : side === 'bottom' ? b.y + gap : (a.y + b.y) / 2 - rect.height / 2;
      x = clamp(x, 20, W - rect.width - 20);
      y = clamp(y, 20, H - rect.height - 20);
      Object.assign(c.node.style, { left: `${x}px`, top: `${y}px`, opacity: o, transform: `translateY(${(1 - o) * 10}px)` });
    }

    for (const c of captions) {
      const o = envelope(t, c.from, c.to, 0.45, 0.35);
      Object.assign(c.node.style, { opacity: o, transform: `translateY(${(1 - easeOut(o)) * 24}px)` });
    }

    for (const c of cards) {
      const o = envelope(t, c.from, c.to, c.fadeIn ?? 0.5, c.fadeOut ?? 0.6);
      const k = clamp((t - c.from) / 1.2, 0, 1);
      c.node.style.opacity = o;
      c.node.style.transform = `scale(${1.04 - 0.04 * easeOut(k)})`;
    }

    if (cursor) {
      const p = track(cursorKeys, t, ['x', 'y']);
      const s = toScreen(p.x, p.y);
      const first = cursorKeys[0].t;
      const last = scene.cursorUntil ?? scene.duration;
      const visible = envelope(t, Math.max(0, first - 0.3), last, 0.3, 0.3);
      let press = 1;
      for (const r of ripples) {
        const d = t - r.t;
        if (d > -0.12 && d < 0.18) press = Math.min(press, 0.82 + 0.18 * Math.abs(d < 0 ? d / 0.12 : d / 0.18));
      }
      Object.assign(cursor.style, { opacity: visible, transform: `translate(${s.x - 3}px, ${s.y - 2}px) scale(${press})` });
      for (const r of ripples) {
        const d = t - r.t;
        const on = d >= 0 && d <= 0.6;
        const k = on ? easeOut(d / 0.6) : 0;
        const at = on ? toScreen(track(cursorKeys, r.t, ['x', 'y']).x, track(cursorKeys, r.t, ['x', 'y']).y) : { x: -100, y: -100 };
        Object.assign(r.node.style, { left: `${at.x}px`, top: `${at.y}px`, opacity: on ? 1 - k : 0, transform: `scale(${0.3 + k * 1.1})` });
      }
    }
  }

  window.__setup = setup;
  window.__render = render;

  // ---------- interactive preview ----------
  const params = new URLSearchParams(location.search);
  if (params.has('render')) return;
  const name = params.get('scene') ?? Object.keys(window.SCENES)[0];
  const controls = document.getElementById('controls');
  const scrub = document.getElementById('scrub');
  const time = document.getElementById('time');
  const play = document.getElementById('play');
  const pick = document.getElementById('pick');
  controls.hidden = false;
  for (const key of Object.keys(window.SCENES)) el('option', '', pick, key).value = key;
  pick.value = name;
  pick.onchange = () => { location.search = `?scene=${pick.value}`; };
  setup(name).then(({ duration }) => {
    let playing = true;
    let start = performance.now() - Number(params.get('t') ?? 0) * 1000;
    let t = 0;
    play.onclick = () => { playing = !playing; play.textContent = playing ? 'Pause' : 'Play'; start = performance.now() - t * 1000; };
    scrub.oninput = () => { t = (scrub.value / 1000) * duration; start = performance.now() - t * 1000; render(t); };
    const tick = (now) => {
      if (playing) {
        t = ((now - start) / 1000) % duration;
        scrub.value = String(Math.round((t / duration) * 1000));
        render(t);
      }
      time.textContent = `${t.toFixed(1)}s / ${duration}s`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
})();
