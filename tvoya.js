/* ═══════════════════════════════════════════════════════════════
   ТВОЯ — 3D-комната на чистом CSS 3D.
   Сцена «от замера до установки», 4 шага по скроллу:
   01 замер     — появляется комната и размерные линии
   02 3D-проект — мебель появляется красным каркасом (как в программе)
   03 производство — каркас заполняется материалами
   04 установка — двери-купе едут, ящики выдвигаются, камера облетает
   ═══════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const { SCENES, range, lerp, clamp } = window.Kit;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = t => 1 - Math.pow(1 - t, 3);

const room = $('#room');

/* плоскость (пол/стена): центр в (0,0,0), дальше — transform */
function plane(w, h, tr, cls) {
  const p = document.createElement('div'); p.className = 'pl ' + cls;
  const i = document.createElement('i');
  i.style.cssText = `width:${w}px;height:${h}px;margin:${-h / 2}px 0 0 ${-w / 2}px`;
  p.append(i); p.style.transform = tr; room.append(p); return p;
}
/* коробка w×h×d (x, y-вниз, z) */
function box(w, h, d, mat, cls = '') {
  const b = document.createElement('div'); b.className = `box ${mat} ${cls}`;
  [['f-f', w, h, `translateZ(${d / 2}px)`], ['f-k', w, h, `rotateY(180deg) translateZ(${d / 2}px)`],
   ['f-r', d, h, `rotateY(90deg) translateZ(${w / 2}px)`], ['f-l', d, h, `rotateY(-90deg) translateZ(${w / 2}px)`],
   ['f-t', w, d, `rotateX(90deg) translateZ(${h / 2}px)`], ['f-b', w, d, `rotateX(-90deg) translateZ(${h / 2}px)`]]
    .forEach(([c, fw, fh, tr]) => {
      const i = document.createElement('i'); i.className = c;
      i.style.cssText = `width:${fw}px;height:${fh}px;margin:${-fh / 2}px 0 0 ${-fw / 2}px;transform:${tr}`;
      b.append(i);
    });
  return b;
}
function dim(len, label, tr) {
  const d = document.createElement('div'); d.className = 'dim';
  d.innerHTML = `<i style="width:${len}px"></i><b>${label}</b>`;
  d.querySelector('b').style.left = len / 2 + 'px';
  d.style.transform = tr; room.append(d); return d;
}

const parts = [];
let walls = [], dims = [];
function part(el, x, y, z, k, extra = {}) {
  room.append(el); const p = { el, x, y, z, k, ...extra }; parts.push(p); return p;
}

if (room) {
  /* комната 640 × 420, высота 300 (≈ 3,2 × 2,1 × 2,7 м) */
  const RW = 640, RD = 420, RH = 300, X0 = -RW / 2, Z0 = -RD / 2;
  const sh = document.createElement('div'); sh.className = 'room-shadow'; room.append(sh);
  walls.push(plane(RW, RD, 'rotateX(90deg)', 'floor'));
  walls.push(plane(RW, RH, `translate3d(0,${-RH / 2}px,${Z0}px)`, 'wall'));
  walls.push(plane(RD, RH, `translate3d(${X0}px,${-RH / 2}px,0) rotateY(90deg)`, 'wall l'));

  dims.push(dim(RW, '3 200 мм', `translate3d(${X0}px,-3px,${Z0 + 14}px)`));
  dims.push(dim(RD, '2 100 мм', `translate3d(${X0 + 14}px,-3px,${-Z0}px) rotateY(90deg)`));
  dims.push(dim(RH, '2 700 мм', `translate3d(${-X0 - 4}px,0,${Z0 + 4}px) rotateZ(-90deg)`));

  let k = 0;
  /* кухня вдоль задней стены */
  const KX0 = -120, MOD = 105, N = 4, BD = 100, BH = 140, PL = 10;
  for (let i = 0; i < N; i++) {
    const x = KX0 + MOD * i + MOD / 2;
    part(box(MOD - 2, BH, BD, 'm-white'), x, -(PL + BH / 2), Z0 + BD / 2, k++);
    part(box(MOD - 4, BH / 2 - 3, 4, i === 1 ? 'm-graphite' : 'm-white', 'door'), x, -(PL + BH * .75), Z0 + BD + 2, k++, { drawer: i, sec: 0 });
    part(box(MOD - 4, BH / 2 - 3, 4, i === 1 ? 'm-graphite' : 'm-white', 'door'), x, -(PL + BH * .25), Z0 + BD + 2, k++, { drawer: i, sec: 1 });
    part(box(MOD - 2, 95, 60, 'm-wood'), x, -205 - 47, Z0 + 30, k++);
  }
  part(box(MOD * N, PL, BD - 8, 'm-graphite'), KX0 + MOD * N / 2, -PL / 2, Z0 + BD / 2 - 4, k++);
  part(box(MOD * N + 4, 8, BD + 6, 'm-top'), KX0 + MOD * N / 2, -(PL + BH + 4), Z0 + BD / 2 + 3, k++);

  /* шкаф-купе вдоль левой стены */
  const WD = 110, WL = 270, WH = 285, WZ = Z0 + 130 + WL / 2;
  part(box(WD, WH, WL, 'm-white'), X0 + WD / 2, -WH / 2, WZ, k++);
  const dz = WL / 4;
  part(box(4, WH - 10, WL / 2, 'm-mirror', 'slide'), X0 + WD + 4, -WH / 2, WZ - dz, k++, { slide: 1 });
  part(box(4, WH - 10, WL / 2, 'm-wood', 'slide'), X0 + WD + 8, -WH / 2, WZ + dz, k++, { slide: -1 });

  /* красный акцент — пуф (детская/прихожая), появляется при установке */
  part(box(60, 42, 60, 'm-red'), 120, -21, 70, k++, { late: true });
  room._shadow = sh;
  room._n = k;
}

let mx = 0, my = 0, smx = 0, smy = 0;
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });

function renderRoom(p) {
  if (!room) return;
  const n = room._n;
  const wallA = RM ? 1 : easeOut(range(p, 0, .08));
  walls.forEach((w, i) => { w.style.opacity = wallA; });
  const dA = RM ? 0 : clamp(range(p, .05, .12) - range(p, .26, .32), 0, 1);
  dims.forEach(d => d.style.setProperty('--dim', dA.toFixed(2)));

  parts.forEach(pt => {
    const f = pt.k / n;
    let wire = RM ? 1 : range(p, .25 + f * .12, .3 + f * .12);
    let solid = RM ? 1 : range(p, .5 + f * .14, .56 + f * .14);
    if (pt.late) { wire = solid = RM ? 1 : easeOut(range(p, .8, .86)); }
    if (wire <= 0) { pt.el.style.visibility = 'hidden'; return; }
    pt.el.style.visibility = '';
    pt.el.style.setProperty('--wire', wire.toFixed(3));
    pt.el.style.setProperty('--solid', solid.toFixed(3));
    let x = pt.x, y = pt.y - (1 - easeOut(wire)) * 60, z = pt.z;
    if (pt.late) y = pt.y - (1 - wire) * 220;
    if (pt.drawer !== undefined && !RM) {
      const a = .78 + pt.drawer * .03 + pt.sec * .012;
      const o = clamp(range(p, a, a + .05) - range(p, a + .08, a + .14), 0, 1);
      z += easeOut(o) * 60;
    }
    if (pt.slide && !RM) {
      const o = clamp(range(p, .8, .88) - range(p, .93, .99), 0, 1);
      z += pt.slide * easeOut(o) * 120;
    }
    pt.el.style.transform = `translate3d(${x}px,${y}px,${z}px)`;
  });

  smx = lerp(smx, mx, .06); smy = lerp(smy, my, .06);
  const st = room.parentElement, s = clamp(Math.min(st.clientWidth / 980, st.clientHeight / 760), .34, 1.05);
  const ry = 32 - p * 40 + smx * 10, rx = -20 + p * 4 - smy * 5;
  room.style.transform = `scale(${s.toFixed(3)}) rotateX(${rx}deg) rotateY(${ry}deg) translate3d(0,${(1 - wallA) * 80}px,0)`;
}

SCENES.room = (el, p) => {
  const steps = el._steps || (el._steps = $$('.rstep', el));
  const n = steps.length, k = Math.min(n - 1, Math.floor(p * n));
  if (el._k !== k) {
    el._k = k;
    steps.forEach((s, i) => s.classList.toggle('on', i === k));
    const num = $('.steps-num', el); if (num) num.textContent = String(k + 1).padStart(2, '0');
  }
};
const sec = $('[data-scene="room"]');
(function loop() {
  if (sec) {
    const r = sec.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) {
      const p = clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1);
      renderRoom(p);
      if (sec._k === undefined) SCENES.room(sec, p);
    }
  }
  requestAnimationFrame(loop);
})();

/* круг цены — из-под курсора */
const circ = $('[data-scene="circle"]');
if (circ && matchMedia('(hover:hover)').matches) circ.addEventListener('pointermove', e => {
  circ.style.setProperty('--cx', (e.clientX / innerWidth * 100).toFixed(1) + '%');
  circ.style.setProperty('--cy', (e.clientY / innerHeight * 100).toFixed(1) + '%');
});

/* список «что делаем»: клик → выбрать в форме и прокрутить */
$$('.what-list li').forEach((li, i) => li.addEventListener('click', () => {
  const map = ['Кухня', 'Шкаф-купе', 'Гардеробная', 'Прихожая', 'Детская', 'Санузел'];
  const v = map[i]; const form = $('.c-form');
  if (form && v) $$('input[name=kind]', form).forEach(c => { c.checked = c.value === v; });
  const t = $('#contacts'); if (t) Kit.scroll.to(t.getBoundingClientRect().top + scrollY);
}));

/* форма (демо, без сервера) */
const form = $('.c-form');
if (form) {
  const phone = form.elements.phone;
  phone.addEventListener('input', () => {
    let d = phone.value.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (d && !d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    const m = d.match(/^7(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
    if (!m) { phone.value = d ? '+' + d : ''; return; }
    let s = '+7';
    if (m[1]) s += ` (${m[1]}`; if (m[1].length === 3) s += ')';
    if (m[2]) s += ` ${m[2]}`; if (m[3]) s += `-${m[3]}`; if (m[4]) s += `-${m[4]}`;
    phone.value = s; phone.classList.remove('err');
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (phone.value.replace(/\D/g, '').length < 11) { phone.classList.add('err'); phone.focus(); return; }
    // TODO: отправка заявки (Telegram-бот / почта / VK) — см. README
    form.classList.add('sent');
    $('button', form).textContent = 'Заявка принята ✓';
    $('.c-note', form).textContent = 'Спасибо! Скоро свяжемся и уточним детали.';
  });
}
})();
