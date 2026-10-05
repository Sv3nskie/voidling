// Voidling menus: title, pause and run-over screens, plus the How to play and Settings panels.
// Mouse and touch click the items; keyboard and gamepad move the highlight
// (↑ ↓ choose, Enter / Space / A select, Esc / B back, ← → flip a setting).
(() => {
  const V = window.V, G = V.G;
  const $ = id => document.getElementById(id);
  const MENUS = ['title', 'pauseMenu', 'over'];
  const panels = []; // open panels, topmost last: [{ el, from }]

  const items = el => [...el.querySelectorAll('.menu-item')].filter(b => b.offsetParent !== null);
  const select = (el, btn) => {
    for (const b of el.querySelectorAll('.menu-item')) b.classList.toggle('sel', b === btn);
    if (btn) { btn.focus({ preventScroll: true }); btn.scrollIntoView({ block: 'nearest' }); }
  };
  const top = () => (panels.length ? panels[panels.length - 1].el
    : MENUS.map($).find(m => !m.hidden && !m.classList.contains('leaving')) || null);

  function fill(id) {
    if (id === 'title') {
      const rec = $('bestTitle');
      rec.hidden = !(G.best > 0);
      if (G.best > 0) rec.innerHTML = `Best height ${G.best} m<small>${V.ZONES[V.zoneAt(G.best)].name}</small>`;
    }
    if (id === 'pauseMenu') {
      const P = G.P, h = G.meters(P.y);
      $('pauseInfo').textContent = `${h} m  ·  ${V.ZONES[V.zoneAt(h)].name}`;
      resetQuit();
    }
  }
  function show(id) {
    const el = $(id);
    el.hidden = false;
    el.classList.remove('leaving');
    el.shownAt = performance.now();
    fill(id);
    select(el, items(el)[0]);
  }
  function hide(id, fade = false) {
    const el = $(id);
    if (el.hidden) return;
    if (!fade) { el.hidden = true; el.classList.remove('leaving'); return; }
    el.classList.add('leaving');
    setTimeout(() => { if (el.classList.contains('leaving')) { el.hidden = true; el.classList.remove('leaving'); } }, 450);
  }
  function openPanel(id, from) {
    const el = $(id), under = top();
    if (under && under.classList.contains('menu')) under.classList.add('under');
    panels.push({ el, from });
    el.hidden = false;
    el.shownAt = performance.now();
    sync();
    select(el, items(el)[0]);
  }
  function closePanel() {
    const p = panels.pop();
    if (!p) return false;
    p.el.hidden = true;
    const under = top();
    if (under) { under.classList.remove('under'); select(under, p.from); }
    return true;
  }

  // Settings
  function sync() {
    for (const b of document.querySelectorAll('[data-set]')) {
      const on = !!V.settings[b.dataset.set];
      b.classList.toggle('off', !on);
      b.querySelector('b').textContent = on ? 'On' : 'Off';
    }
  }
  function toggle(key) {
    if (key === 'sound') { V.audio.init(); V.audio.toggleMute(); } else { V.settings[key] = !V.settings[key]; V.saveSettings(); }
    sync();
  }

  // Leaving a run from the pause menu asks once more
  const quit = $('quitBtn');
  function resetQuit() { quit.classList.remove('warn'); quit.textContent = 'Main menu'; clearTimeout(quit.timer); }

  function activate(b) {
    if (!b) return;
    const layer = b.closest('.menu, .panel');
    // A press meant for the game must not hit a menu that just appeared (mashing jump as you die)
    if (performance.now() - (layer.shownAt || 0) < (layer.id === 'over' ? 700 : 150)) return;
    if (b.dataset.panel) return openPanel(b.dataset.panel, b);
    if (b.dataset.set) return toggle(b.dataset.set);
    if ('back' in b.dataset) return closePanel();
    if (b.id === 'playBtn' || b.id === 'againBtn') G.start();
    else if (b.id === 'resumeBtn') G.setPaused(false);
    else if (b.id === 'menuBtn') G.toMenu();
    else if (b.id === 'quitBtn') {
      if (!quit.classList.contains('warn')) {
        quit.classList.add('warn'); quit.textContent = 'Quit this run?';
        quit.timer = setTimeout(resetQuit, 3500);
      } else { resetQuit(); G.toMenu(); }
    }
  }
  // Back: closes a panel, resumes from pause, leaves the run-over screen. False on the title.
  function back() {
    if (closePanel()) return true;
    const el = top();
    if (!el) return false;
    if (el.id === 'pauseMenu') { G.setPaused(false); return true; }
    if (el.id === 'over') { G.toMenu(); return true; }
    return false;
  }
  // Called every frame: true while a menu is open (it owns the keyboard / gamepad then)
  function update() {
    const el = top();
    if (!el) return false;
    const I = V.input, list = items(el);
    const i = list.findIndex(b => b.classList.contains('sel'));
    if (I.hit('up')) select(el, list[(i - 1 + list.length) % list.length]);
    else if (I.hit('down')) select(el, list[(i + 1) % list.length]);
    else if ((I.hit('left') || I.hit('right')) && list[i] && list[i].dataset.set) toggle(list[i].dataset.set);
    else if (I.hit('ok') || (I.hit('start') && el.id !== 'pauseMenu')) activate(list[i] || list[0]);
    else if (I.hit('back') || (el.id === 'pauseMenu' && I.hit('pause'))) back();
    return true;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('.menu-item');
    if (b) { V.audio.init(); activate(b); }
  });
  document.addEventListener('pointerover', e => {
    const b = e.target.closest('.menu-item');
    if (b && e.pointerType === 'mouse') select(b.closest('.menu, .panel'), b);
  });
  sync();

  G.menu = { show, hide, back, update, sync };
})();
