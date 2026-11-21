/* ═══════════════════════════════════════════════════════════════
   SCROLL KIT — движок полноэкранных скролл-сцен. Без библиотек.

   Как устроено:
   1) <section data-scene="имя" data-length="300"> — секция длиной 300vh,
      внутри .pin залипает на весь экран, пока секцию пролистывают.
   2) Каждый кадр движок считает прогресс p (0…1) и пишет в CSS:
        --p  линейный прогресс,  --e  сглаженный (ease-in-out).
      Большинство эффектов описаны в kit.css формулами от --p/--e.
   3) Для эффектов, где нужен JS, в объекте SCENES есть обработчик
      с тем же именем: SCENES.steps(el, p, dt) и т.д.
      Новая сцена = новый ключ в SCENES + CSS.
   ═══════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1);      // v в отрезке [a,b] → 0…1
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const RM    = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(hover: none)').matches;
const root = document.documentElement, body = document.body;
let vw = innerWidth, vh = innerHeight;

/* ─────────── 1. ПЛАВНЫЙ СКРОЛЛ (инерция колеса) ───────────
   На тач-устройствах остаётся родной скролл. Выключить: SMOOTH = false */
const SMOOTH = !TOUCH && !RM;
const scroll = {
  y: scrollY, target: scrollY, last: scrollY, vel: 0, mine: -1,
  max: () => root.scrollHeight - vh,
  to(y) { y = clamp(y, 0, this.max()); if (SMOOTH) this.target = y; else scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' }); },
  tick() {
    if (SMOOTH) {
      if (this.mine >= 0 && Math.abs(scrollY - this.mine) > 2) this.y = this.target = scrollY; // полоса/клавиатура
      if (Math.abs(this.target - this.y) > .4) { this.y = lerp(this.y, this.target, .1); scrollTo(0, this.y); this.mine = scrollY; }
      else { this.y = this.target = scrollY; this.mine = -1; }
    } else this.y = scrollY;
    this.vel = lerp(this.vel, this.y - this.last, .2); this.last = this.y;
  }
};
if (SMOOTH) addEventListener('wheel', e => {
  if (e.ctrlKey) return;
  e.preventDefault();
  if (scroll.mine < 0) scroll.y = scroll.target = scrollY;
  const k = e.deltaMode === 1 ? 36 : e.deltaMode === 2 ? vh : 1;
  scroll.target = clamp(scroll.target + e.deltaY * k, 0, scroll.max());
  scroll.mine = scrollY;
}, { passive: false });
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const t = a.getAttribute('href').length > 1 && $(a.getAttribute('href'));
  if (!t) return; e.preventDefault();
  scroll.to(t.getBoundingClientRect().top + scrollY);
}));

/* ─────────── 2. РАЗБИВКА ТЕКСТА НА БУКВЫ ─────────── */
function split(el) {
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  el.setAttribute('aria-label', text); el.textContent = '';
  let i = 0;
  text.split(' ').forEach((w, wi, arr) => {
    const wd = document.createElement('span'); wd.className = 'wd'; wd.setAttribute('aria-hidden', 'true');
    for (const c of w) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; s.style.setProperty('--i', i++); wd.append(s); }
    el.append(wd); if (wi < arr.length - 1) { el.append(' '); i++; }
  });
}
$$('[data-split]').forEach(split);
// [data-split] и [data-reveal] получают .in при входе в экран (кроме тех, что внутри сцен-глав)
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: .2, rootMargin: '0px 0px -8% 0px' });
$$('[data-split],[data-reveal]').forEach(el => { if (!el.closest('[data-manual]')) io.observe(el); });

/* ─────────── 3. ПОДГОНКА КРУПНОГО ТЕКСТА ───────────
   Самое длинное слово всегда помещается в ширину контейнера. */
const FIT = '.huge, .step h2, .split-item h3, .stack-card h3, .tz-word, .rstep h2, .h-more b';
const mctx = document.createElement('canvas').getContext('2d');
function fitText() {
  $$(FIT).forEach(el => {
    el.style.fontSize = '';
    const cs = getComputedStyle(el);
    const box = cs.display.startsWith('inline') ? el.parentElement : el;
    const avail = box.clientWidth * .96; if (!avail) return;
    const fs = parseFloat(cs.fontSize), ls = parseFloat(cs.letterSpacing) || 0;
    mctx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
    let t = el.getAttribute('aria-label') || el.textContent;
    if (cs.textTransform === 'uppercase') t = t.toUpperCase();
    const maxW = Math.max(0, ...t.split(/\s+/).map(w => mctx.measureText(w).width + ls * w.length));
    if (maxW > avail) el.style.fontSize = Math.floor(fs * avail / maxW) + 'px';
  });
}

/* ═══════════════ 4. СЦЕНЫ ═══════════════ */
const SCENES = {
  // главы: меняем активный шаг и фон
  steps(el, p) {
    const steps = el._steps || (el._steps = $$('.step', el));
    const media = el._media || (el._media = $$('.steps-media > *', el));
    const n = steps.length, k = Math.min(n - 1, Math.floor(p * n));
    if (el._k !== k) {
      el._k = k;
      steps.forEach((s, i) => { s.classList.toggle('on', i === k); s.querySelector('[data-split]')?.classList.toggle('in', i === k); });
      media.forEach((m, i) => m.classList.toggle('on', i === k));
      const num = $('.steps-num', el); if (num) num.textContent = String(k + 1).padStart(2, '0');
    }
  },
  // заливка слов
  words(el, p) {
    const ws = el._w || (el._w = (() => {
      const t = $('.words-text', el), arr = t.textContent.trim().split(/\s+/);
      t.setAttribute('aria-label', t.textContent.trim()); t.textContent = '';
      return arr.map((w, i) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; s.setAttribute('aria-hidden', 'true'); t.append(s); if (i < arr.length - 1) t.append(' '); return s; });
    })());
    const n = Math.round(range(p, .05, .85) * ws.length);
    if (el._n !== n) { el._n = n; ws.forEach((w, i) => w.classList.toggle('on', i < n)); }
  },
  // горизонтальная лента: длина секции подгоняется под ширину ленты
  horizontal(el, p) {
    const tr = el._tr || (el._tr = $('.h-track', el));
    const span = Math.max(0, tr.scrollWidth - vw);
    el._x = lerp(el._x || 0, -p * span, RM ? 1 : .15);
    tr.style.transform = `translate3d(${el._x}px,0,0) skewX(${RM ? 0 : clamp(-scroll.vel * .1, -5, 5)}deg)`;
    if (!RM) $$('.h-card', tr).forEach(c => {
      const b = c.getBoundingClientRect(), d = (b.left + b.width / 2 - vw / 2) / vw;
      c.style.setProperty('--ry', clamp(-d * 20, -28, 28) + 'deg');
      c.style.setProperty('--sc', (1 - Math.min(Math.abs(d), 1) * .1).toFixed(3));
    });
  },
  // пролёт сквозь слово: масштаб растёт по кубу, чтобы в конце «влететь»
  textzoom(el, p) {
    const e = easeIO(range(p, .05, .95));
    el.style.setProperty('--tzs', (1 + Math.pow(e, 3) * 60).toFixed(3));
  },
};
// у горизонтали длина считается от контента
function layoutScenes() {
  $$('[data-scene]').forEach(el => {
    if (el.dataset.scene === 'horizontal') {
      const tr = $('.h-track', el);
      el.style.height = (Math.max(0, tr.scrollWidth - vw) + vh) + 'px';
    } else el.style.setProperty('--len', el.dataset.length || 300);
  });
}
const scenes = $$('[data-scene]');
function tickScenes(dt) {
  scenes.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.bottom < -vh * .2 || r.top > vh * 1.2) return;           // вне экрана — не считаем
    const p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
    if (el._p !== undefined && Math.abs(el._p - p) < 1e-4 && el.dataset.scene !== 'horizontal') return;
    el._p = p;
    el.style.setProperty('--p', p.toFixed(4));
    el.style.setProperty('--e', easeIO(p).toFixed(4));
    SCENES[el.dataset.scene]?.(el, p, dt);
  });
}

/* ─────────── 5. SPLIT: липкий текст + медиа ─────────── */
const splits = $$('.split').map(s => ({ items: $$('.split-item', s), media: $$('.split-media > *', s), k: -1 }));
function tickSplit() {
  splits.forEach(s => {
    let k = 0, best = 1e9;
    s.media.forEach((m, i) => { const r = m.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - vh / 2); if (d < best) { best = d; k = i; } });
    if (k !== s.k) { s.k = k; s.items.forEach((it, i) => it.classList.toggle('on', i === k)); s.media.forEach((m, i) => m.classList.toggle('on', i === k)); }
  });
}

/* ─────────── 6. STACK: насколько карточку накрыла следующая ─────────── */
const stackCards = $$('.stack-card');
stackCards.forEach((c, i) => c.style.setProperty('--k', i));
function tickStack() {
  stackCards.forEach((c, i) => {
    const next = stackCards[i + 1]; if (!next || next.parentElement !== c.parentElement) return;
    const top = parseFloat(getComputedStyle(c).top);
    c.style.setProperty('--cover', range(top + vh * .8 - next.getBoundingClientRect().top, 0, vh * .8).toFixed(3));
  });
}

/* ─────────── 7. MARQUEE от скорости скролла ─────────── */
const marquees = $$('.marquee').map(m => {
  const t = $('.marquee-track', m), base = t.innerHTML; let g = 0;
  while (t.scrollWidth < vw * 2 && g++ < 10) t.innerHTML += base;
  t.innerHTML += t.innerHTML;
  return { m, t, dir: +m.dataset.dir || 1, x: 0 };
});
function tickMarquee(dt) {
  if (RM) return;
  const v = clamp(scroll.vel, -80, 80);
  marquees.forEach(q => {
    const half = q.t.scrollWidth / 2;
    q.x -= (60 + Math.abs(v) * 12) * (v < -1 ? -1 : 1) * q.dir * dt;
    if (q.x <= -half) q.x += half; if (q.x > 0) q.x -= half;
    q.t.style.transform = `translate3d(${q.x}px,0,0) skewX(${clamp(-v * .25, -10, 10)}deg)`;
  });
}

/* ─────────── 8. КУРСОР ─────────── */
const cur = $('.cursor'), curLabel = cur && $('span', cur);
const mouse = { x: vw / 2, y: vh / 2, cx: vw / 2, cy: vh / 2 };
addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
if (cur && !TOUCH) document.addEventListener('pointerover', e => {
  const t = e.target.closest('[data-cursor]');
  cur.classList.toggle('big', !!t); if (t) curLabel.textContent = t.dataset.cursor;
});
function tickCursor() {
  if (!cur || TOUCH) return;
  mouse.cx = lerp(mouse.cx, mouse.x, .18); mouse.cy = lerp(mouse.cy, mouse.y, .18);
  cur.style.transform = `translate3d(${mouse.cx}px,${mouse.cy}px,0)`;
}
// магнитные элементы
if (!TOUCH && !RM) $$('[data-magnetic]').forEach(el => {
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect();
    el.style.transition = 'transform .2s'; el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .3}px,${(e.clientY - r.top - r.height / 2) * .3}px)`; });
  el.addEventListener('pointerleave', () => { el.style.transition = 'transform .8s cubic-bezier(.16,1,.3,1)'; el.style.transform = ''; });
});

/* ─────────── 9. ФУТЕР-РАСКРЫТИЕ и прогресс ─────────── */
const footer = $('.footer'), main = $('main'), prog = $('.progress');
function layoutFooter() {
  if (!footer || !main) return;
  const h = footer.offsetHeight, fits = h < vh * .9;
  footer.classList.toggle('reveal', fits); main.style.marginBottom = fits ? h + 'px' : '';
}
function tickFooter() {
  const max = scroll.max();
  if (prog) prog.style.setProperty('--sp', clamp(scroll.y / Math.max(1, max), 0, 1).toFixed(4));
  if (footer) footer.style.setProperty('--fp', clamp((scroll.y - (max - footer.offsetHeight)) / footer.offsetHeight, 0, 1).toFixed(3));
}

/* ─────────── РАЗМЕРЫ ─────────── */
function layout() {
  // телефон: адресная строка меняет innerHeight — не пересчитываемся из-за неё
  if (TOUCH && innerWidth === vw) vh = Math.max(vh, innerHeight); else vh = innerHeight;
  vw = innerWidth;
  fitText(); layoutScenes(); layoutFooter();
  scenes.forEach(el => { el._p = undefined; });
}
let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(layout, 120); });
layout();
document.fonts?.ready.then(layout);
addEventListener('load', layout);

/* ─────────── ЦИКЛ ─────────── */
let last = performance.now();
(function frame(t) {
  const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
  scroll.tick();
  tickScenes(dt); tickSplit(); tickStack(); tickMarquee(dt); tickCursor(); tickFooter();
  requestAnimationFrame(frame);
})(last);

// наружу — чтобы подключать свои сцены из другого файла:  Kit.SCENES.myScene = (el, p) => {...}
window.Kit = { SCENES, scroll, range, easeIO, lerp, clamp };
})();
