// ============================================
// FATE — interactions
// ============================================
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ── live clock (Europe/Prague) ───────────────────────────────
  function tickClocks() {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Prague',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const now = fmt.format(new Date());
    const top = $('#topClock');
    const splash = $('#splashClock');
    const loaderClock = $('#splashClockLoader');
    if (top) top.textContent = now;
    if (splash) splash.textContent = `${now} PRG`;
    if (loaderClock) loaderClock.textContent = `${now} PRG`;
  }
  tickClocks();
  setInterval(tickClocks, 15 * 1000);

  // ── force text-style arrow glyphs (mobile renders as emoji otherwise) ─
  //    walk all text nodes and append text-variation-selector (\uFE0E)
  //    after any U+2190–U+21FF arrow character.
  (function fixArrowGlyphs(){
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const arrowRe = /([\u2190-\u21FF])(?!\uFE0E)/g;
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) {
      if (arrowRe.test(n.nodeValue)) nodes.push(n);
    }
    nodes.forEach((node) => {
      node.nodeValue = node.nodeValue.replace(/([\u2190-\u21FF])(?!\uFE0E)/g, '$1\uFE0E');
    });
  })();

  // ── loader: 00 → 100 then lift ───────────────────────────────
  // ── loader refs (loader DOM is removed; safe nulls)
  const loader = $('#loader');
  const num = $('#loaderNum');
  const pct = $('#loaderPct');
  const bar = $('.loader-bar');
  const splash = $('#splash');
  const site = $('#site');
  const curtain = $('#curtain');

  document.body.style.overflow = 'hidden';

  // ── splash is visible immediately; nothing to load ──────────
  function runLoader() {
    return Promise.resolve();
  }

  // ── splash → site transition (pure cross-fade, no curtain) ──
  let entered = false;
  function enter() {
    if (entered) return;
    entered = true;
    splash.classList.add('exit');
    site.setAttribute('aria-hidden', 'false');
    site.classList.add('enter');
    document.body.style.overflow = '';
    setTimeout(() => {
      splash.style.display = 'none';
    }, 900);
  }

  function replay() {
    entered = false;
    document.body.style.overflow = 'hidden';
    site.classList.remove('enter');
    site.setAttribute('aria-hidden', 'true');
    splash.style.display = '';
    splash.classList.remove('exit');
    splash.classList.add('replaying');
    void splash.offsetWidth;
    splash.classList.add('reveal');
    setTimeout(() => splash.classList.remove('replaying', 'reveal'), 1000);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  splash.addEventListener('click', enter);
  splash.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); }
  });

  // ── scroll reveals ──────────────────────────────────────────
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        obs.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  $$('[data-reveal]').forEach((el) => obs.observe(el));
  $$('.piece').forEach((el) => obs.observe(el));

  // ── custom cursor ───────────────────────────────────────────
  const cursor = $('#cursor');
  const label = $('.cursor-label');
  let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  let tx = cx, ty = cy;
  let cursorOn = !matchMedia('(hover: none)').matches && window.innerWidth > 900;
  document.body.dataset.cursor = cursorOn ? 'on' : 'off';

  function loop() {
    cx += (tx - cx) * 0.22;
    cy += (ty - cy) * 0.22;
    cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  loop();

  window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });

  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-cursor]');
    if (!el) {
      cursor.classList.remove('view', 'hover');
      return;
    }
    const mode = el.dataset.cursor;
    cursor.classList.toggle('view', mode === 'view');
    cursor.classList.toggle('hover', mode === 'hover');
    if (label) label.textContent = mode === 'view' ? 'VIEW' : '';
  });

  // ── lightbox ────────────────────────────────────────────────
  const lb = $('#lightbox');
  const lbStage = $('#lbStage');
  const lbCap = $('#lbCaption');
  const lbClose = $('#lbClose');

  function openLightbox(title, slotEl) {
    lbStage.innerHTML = '';
    let img = null;
    if (slotEl && slotEl.shadowRoot) {
      img = slotEl.shadowRoot.querySelector('img');
    }
    if (img && img.src) {
      const clone = document.createElement('img');
      clone.src = img.src;
      lbStage.appendChild(clone);
    } else {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'drop image to view full size';
      lbStage.appendChild(empty);
    }
    lbCap.textContent = title || '';
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { lbStage.innerHTML = ''; }, 400);
  }

  function tryOpenFromFrame(frame) {
    const slot = frame.querySelector('image-slot');
    const hasImg = slot && slot.shadowRoot && slot.shadowRoot.querySelector('img');
    if (!hasImg) return false;
    openLightbox(frame.dataset.zoom, slot);
    return true;
  }

  $$('.piece-frame[data-zoom]').forEach((el) => {
    el.addEventListener('click', () => tryOpenFromFrame(el));
  });
  // VIEW pill button — find nearest piece-frame and open
  $$('[data-show]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fig = btn.closest('figure.piece');
      if (!fig) return;
      const frame = fig.querySelector('.piece-frame[data-zoom]');
      if (frame) tryOpenFromFrame(frame);
    });
  });
  lbClose.addEventListener('click', closeLightbox);
  lb.addEventListener('click', (e) => {
    if (e.target === lb) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lb.classList.contains('open')) closeLightbox();
  });

  // ── catalog rows → scroll to works ──────────────────────────
  $$('.cat-row[data-go]').forEach((row) => {
    row.addEventListener('click', () => {
      // ensure works-rest is open if target is inside it
      const target = document.querySelector(row.dataset.go);
      if (!target) return;
      const insideRest = target.closest('#worksRest');
      if (insideRest && insideRest.hasAttribute('hidden')) {
        openWorksRest({ scroll: false });
      }
      // wait one frame for layout then scroll
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  });

  // ── see all work toggle ──────────────────────────────────────
  const seeAllWrap = $('#seeAllWrap');
  const seeAllBtn = $('#seeAllBtn');
  const worksRest = $('#worksRest');
  const catalogSection = $('#catalog');
  function openWorksRest({ scroll = true } = {}) {
    if (!worksRest || !worksRest.hasAttribute('hidden')) return;
    worksRest.removeAttribute('hidden');
    worksRest.classList.add('opening');
    worksRest.addEventListener('animationend', () => {
      worksRest.classList.remove('opening');
      worksRest.classList.add('open');
    }, { once: true });
    if (seeAllWrap) seeAllWrap.hidden = true;
    // also reveal INDEX/catalog with see-all
    if (catalogSection && catalogSection.hasAttribute('hidden')) {
      catalogSection.removeAttribute('hidden');
      catalogSection.classList.add('opening');
      catalogSection.addEventListener('animationend', () => {
        catalogSection.classList.remove('opening');
      }, { once: true });
    }
    if (scroll) {
      requestAnimationFrame(() => {
        worksRest.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    worksRest.querySelectorAll('.piece, [data-reveal]').forEach((el) => obs.observe(el));
  }
  seeAllBtn?.addEventListener('click', () => openWorksRest());

  // ── exhibition row expand ────────────────────────────────────
  $$('.ex-row-toggle').forEach((row) => {
    row.addEventListener('click', () => {
      const targetId = row.dataset.expand;
      const photos = document.getElementById(targetId);
      if (!photos) return;
      const open = photos.classList.toggle('show');
      row.classList.toggle('open', open);
      if (open) {
        photos.removeAttribute('hidden');
        // observe slots for aspect sync
        photos.querySelectorAll('image-slot').forEach((slot) => {
          slotObs.observe(slot, { attributes: true, attributeFilter: ['data-filled'] });
          if (slot.hasAttribute('data-filled')) syncSlotToImage(slot);
        });
      }
    });
  });

  // slot aspect sync — set slot.aspectRatio to natural image dims so
  // the figcaption width always matches the photo's true width
  function syncSlotToImage(slot) {
    if (slot.classList.contains('hero-bg') || slot.classList.contains('splash-art')) return;
    const img = slot.shadowRoot?.querySelector('img');
    if (!img) return;
    const apply = () => {
      if (img.naturalWidth && img.naturalHeight) {
        slot.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
      }
    };
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener('load', apply, { once: true });
  }
  const slotObs = new MutationObserver((muts) => {
    muts.forEach((m) => {
      if (m.attributeName === 'data-filled') syncSlotToImage(m.target);
    });
  });
  requestAnimationFrame(() => {
    document.querySelectorAll('image-slot').forEach((slot) => {
      slotObs.observe(slot, { attributes: true, attributeFilter: ['data-filled'] });
      if (slot.hasAttribute('data-filled')) syncSlotToImage(slot);
    });
    setTimeout(() => {
      document.querySelectorAll('image-slot[data-filled]').forEach(syncSlotToImage);
    }, 600);
  });

  // ── back to top ─────────────────────────────────────────────
  $('#backTop')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── contact links: explicit navigation fallback for tel:/mailto: on iOS
  $$('a.contact-line').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href) return;
      // let the browser handle modifier-clicks normally
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      window.location.href = href;
    });
  });

  // ── fixed configuration (tweaks panel removed) ──────────────
  document.body.dataset.palette = 'ink';
  document.body.dataset.density = 'spacious';
  document.body.dataset.cursor = !matchMedia('(hover: none)').matches && window.innerWidth > 900 ? 'on' : 'off';
  document.body.dataset.grain = 'on';

  // ── kick off ────────────────────────────────────────────────
  window.__fate = { enter, replay };
  runLoader();
})();
