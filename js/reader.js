(() => {
  'use strict';

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.25;
  const DOUBLE_TAP_ZOOM = 2.15;
  const TURN_MS = 820;

  const volumes = {
    1: { label: 'Tomo I', pages: 253, folder: 'tomo-1' },
    2: { label: 'Tomo II', pages: 369, folder: 'tomo-2' }
  };

  const el = {
    readerSection: document.getElementById('lector'),
    readerShell: document.getElementById('readerShell'),
    readerCanvas: document.getElementById('readerCanvas'),
    pageViewport: document.getElementById('pageViewport'),
    pageStage: document.getElementById('pageStage'),
    zoomLayer: document.getElementById('zoomLayer'),
    pageImage: document.getElementById('pageImage'),
    turnLayer: document.getElementById('turnLayer'),
    turnFrontImage: document.getElementById('turnFrontImage'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    pageInput: document.getElementById('pageInput'),
    pageTotal: document.getElementById('pageTotal'),
    pageRange: document.getElementById('pageRange'),
    volumeLabel: document.getElementById('volumeLabel'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    zoomResetBtn: document.getElementById('zoomResetBtn'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    mobileHint: document.getElementById('mobileHint')
  };

  let volume = 1;
  let page = 1;
  let animating = false;
  let focusMode = false;
  let savedScrollY = 0;

  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let mousePanStart = null;
  let pinchStart = null;
  let touchStart = null;
  let lastTap = { time: 0, x: 0, y: 0 };
  let resizeTimer = null;

  const currentVolume = () => volumes[volume];
  const isMobile = () => window.matchMedia('(max-width: 680px)').matches;
  const pathFor = (vol, n) => `pages/${volumes[vol].folder}/page-${String(n).padStart(3, '0')}.webp`;

  function pageAlt(vol, n) {
    if (n === 1) return `Portada de ${volumes[vol].label}`;
    return `Página ${n} de ${volumes[vol].label}`;
  }

  function preload(vol, n) {
    if (n < 1 || n > volumes[vol].pages) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = pathFor(vol, n);
    });
  }

  function prefetchAround() {
    [page - 2, page - 1, page + 1, page + 2].forEach((n) => preload(volume, n));
  }

  function fitStage() {
    const style = window.getComputedStyle(el.readerCanvas);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const availableW = Math.max(1, el.readerCanvas.clientWidth - padX);
    const availableH = Math.max(1, el.readerCanvas.clientHeight - padY);
    const ratio = PAGE_W / PAGE_H;

    let width = availableW;
    let height = width / ratio;
    if (height > availableH) {
      height = availableH;
      width = height * ratio;
    }

    el.pageStage.style.width = `${Math.floor(width)}px`;
    el.pageStage.style.height = `${Math.floor(height)}px`;
    clampPan();
    applyZoom(false);
  }

  function clampPan() {
    if (zoomScale <= 1.001) {
      panX = 0;
      panY = 0;
      return;
    }

    const stageW = el.pageStage.offsetWidth;
    const stageH = el.pageStage.offsetHeight;
    const canvasRect = el.readerCanvas.getBoundingClientRect();
    const maxX = Math.max(0, ((stageW * zoomScale) - canvasRect.width) / 2 + 36);
    const maxY = Math.max(0, ((stageH * zoomScale) - canvasRect.height) / 2 + 36);
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  }

  function updateZoomUI() {
    el.zoomResetBtn.textContent = `${Math.round(zoomScale * 100)}%`;
    el.zoomOutBtn.disabled = zoomScale <= MIN_ZOOM + 0.001;
    el.zoomInBtn.disabled = zoomScale >= MAX_ZOOM - 0.001;
    el.readerCanvas.classList.toggle('is-zoomed', zoomScale > 1.01);
    if (isMobile()) {
      el.mobileHint.textContent = zoomScale > 1.01
        ? 'Arrastra para mover · doble toque para ajustar'
        : 'Desliza para cambiar · pellizca para ampliar';
    }
  }

  function applyZoom(animate = false) {
    clampPan();
    el.zoomLayer.classList.toggle('zoom-animate', animate);
    el.zoomLayer.style.setProperty('--zoom', zoomScale.toFixed(4));
    el.zoomLayer.style.setProperty('--pan-x', `${panX.toFixed(2)}px`);
    el.zoomLayer.style.setProperty('--pan-y', `${panY.toFixed(2)}px`);
    updateZoomUI();
    if (animate) window.setTimeout(() => el.zoomLayer.classList.remove('zoom-animate'), 230);
  }

  function resetZoom(animate = false) {
    zoomScale = 1;
    panX = 0;
    panY = 0;
    mousePanStart = null;
    pinchStart = null;
    el.readerCanvas.classList.remove('is-panning');
    applyZoom(animate);
  }

  function zoomAt(clientX, clientY, target, animate = false) {
    const rect = el.readerCanvas.getBoundingClientRect();
    const pointX = clientX - (rect.left + rect.width / 2);
    const pointY = clientY - (rect.top + rect.height / 2);
    const old = zoomScale;
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, target));
    if (Math.abs(next - old) < 0.001) return;
    panX = pointX - (next * (pointX - panX) / old);
    panY = pointY - (next * (pointY - panY) / old);
    zoomScale = next;
    applyZoom(animate);
  }

  function setZoom(target) {
    const rect = el.readerCanvas.getBoundingClientRect();
    if (target <= MIN_ZOOM + 0.001) {
      resetZoom(true);
      return;
    }
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, target, true);
  }

  function updateUI() {
    const info = currentVolume();
    el.volumeLabel.textContent = info.label;
    el.pageInput.max = String(info.pages);
    el.pageInput.value = String(page);
    el.pageTotal.textContent = `/ ${info.pages}`;
    el.pageRange.max = String(info.pages);
    el.pageRange.value = String(page);
    el.prevBtn.disabled = page <= 1;
    el.nextBtn.disabled = page >= info.pages;
    document.querySelectorAll('.volume-tab').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.volume) === volume);
    });
  }

  function setBaseImage(vol, n) {
    el.pageImage.src = pathFor(vol, n);
    el.pageImage.alt = pageAlt(vol, n);
  }

  async function turnTo(target, direction) {
    const info = currentVolume();
    target = Math.max(1, Math.min(info.pages, target));
    if (target === page || animating) return;

    if (Math.abs(target - page) !== 1 || !direction) {
      page = target;
      resetZoom(false);
      setBaseImage(volume, page);
      el.pageStage.classList.remove('page-jump');
      void el.pageStage.offsetWidth;
      el.pageStage.classList.add('page-jump');
      window.setTimeout(() => el.pageStage.classList.remove('page-jump'), 260);
      updateUI();
      prefetchAround();
      return;
    }

    animating = true;
    resetZoom(false);
    await preload(volume, target);

    const targetSrc = pathFor(volume, target);
    const currentSrc = pathFor(volume, page);
    el.turnLayer.hidden = false;

    if (direction === 'next') {
      el.turnFrontImage.src = currentSrc;
      setBaseImage(volume, target);
      el.pageStage.classList.add('turning-next');
    } else {
      el.turnFrontImage.src = targetSrc;
      el.pageStage.classList.add('turning-prev');
    }

    window.setTimeout(() => {
      page = target;
      setBaseImage(volume, page);
      el.pageStage.classList.remove('turning-next', 'turning-prev');
      el.turnLayer.hidden = true;
      animating = false;
      updateUI();
      prefetchAround();
    }, TURN_MS + 20);
  }

  function nextPage() {
    if (page >= currentVolume().pages) return;
    turnTo(page + 1, 'next');
  }

  function prevPage() {
    if (page <= 1) return;
    turnTo(page - 1, 'prev');
  }

  async function setVolume(nextVolume, startPage = 1, scroll = false) {
    nextVolume = Number(nextVolume);
    if (!volumes[nextVolume]) return;
    volume = nextVolume;
    page = Math.max(1, Math.min(volumes[volume].pages, Number(startPage) || 1));
    animating = false;
    el.pageStage.classList.remove('turning-next', 'turning-prev', 'page-jump');
    el.turnLayer.hidden = true;
    resetZoom(false);
    await preload(volume, page);
    setBaseImage(volume, page);
    updateUI();
    fitStage();
    prefetchAround();
    if (scroll) {
      el.readerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => el.readerCanvas.focus({ preventScroll: true }), 650);
    }
  }

  function lockScroll() {
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = `-${savedScrollY}px`;
    document.body.classList.add('reader-lock');
  }

  function unlockScroll() {
    document.body.classList.remove('reader-lock');
    document.body.style.top = '';
    window.scrollTo(0, savedScrollY);
  }

  function enterFocusMode() {
    if (focusMode) return;
    focusMode = true;
    lockScroll();
    el.readerShell.classList.add('reading-focus');
    el.fullscreenBtn.setAttribute('title', 'Salir de pantalla completa');
    el.fullscreenBtn.setAttribute('aria-label', 'Salir de pantalla completa');
    window.setTimeout(fitStage, 60);
  }

  function exitFocusMode() {
    if (!focusMode) return;
    focusMode = false;
    el.readerShell.classList.remove('reading-focus');
    el.fullscreenBtn.setAttribute('title', 'Pantalla completa');
    el.fullscreenBtn.setAttribute('aria-label', 'Pantalla completa');
    resetZoom(false);
    unlockScroll();
    window.setTimeout(fitStage, 60);
  }

  async function toggleFullscreen() {
    if (focusMode) {
      exitFocusMode();
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    const canNative = Boolean(document.fullscreenEnabled && el.readerShell.requestFullscreen);
    if (canNative) {
      try {
        await el.readerShell.requestFullscreen();
        return;
      } catch (_) {}
    }
    enterFocusMode();
  }

  function distance(a, b) {
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }

  function midpoint(a, b) {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  function handleTap(x, y) {
    const now = Date.now();
    const near = Math.hypot(x - lastTap.x, y - lastTap.y) < 44;
    if (now - lastTap.time < 320 && near) {
      if (zoomScale > 1.01) resetZoom(true);
      else zoomAt(x, y, DOUBLE_TAP_ZOOM, true);
      lastTap = { time: 0, x: 0, y: 0 };
    } else {
      lastTap = { time: now, x, y };
    }
  }

  document.querySelectorAll('[data-open-volume]').forEach((btn) => {
    btn.addEventListener('click', () => setVolume(Number(btn.dataset.openVolume), 1, true));
  });

  document.querySelectorAll('.volume-tab').forEach((btn) => {
    btn.addEventListener('click', () => setVolume(Number(btn.dataset.volume), 1, false));
  });

  el.prevBtn.addEventListener('click', prevPage);
  el.nextBtn.addEventListener('click', nextPage);
  el.fullscreenBtn.addEventListener('click', toggleFullscreen);
  el.zoomOutBtn.addEventListener('click', () => setZoom(zoomScale - ZOOM_STEP));
  el.zoomInBtn.addEventListener('click', () => setZoom(zoomScale + ZOOM_STEP));
  el.zoomResetBtn.addEventListener('click', () => resetZoom(true));

  el.pageInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    turnTo(Number(el.pageInput.value), null);
    el.pageInput.blur();
  });
  el.pageInput.addEventListener('change', () => turnTo(Number(el.pageInput.value), null));
  el.pageRange.addEventListener('change', () => turnTo(Number(el.pageRange.value), null));

  document.addEventListener('keydown', (event) => {
    if (event.target && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      nextPage();
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      prevPage();
    } else if (event.key === 'Home') {
      event.preventDefault();
      turnTo(1, null);
    } else if (event.key === 'End') {
      event.preventDefault();
      turnTo(currentVolume().pages, null);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setZoom(zoomScale + ZOOM_STEP);
    } else if (event.key === '-') {
      event.preventDefault();
      setZoom(zoomScale - ZOOM_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      resetZoom(true);
    } else if (event.key === 'Escape' && focusMode) {
      exitFocusMode();
    }
  });

  el.readerCanvas.addEventListener('mousedown', (event) => {
    if (zoomScale <= 1.01 || event.button !== 0) return;
    event.preventDefault();
    mousePanStart = { x: event.clientX, y: event.clientY, panX, panY };
    el.readerCanvas.classList.add('is-panning');
  });
  window.addEventListener('mousemove', (event) => {
    if (!mousePanStart) return;
    panX = mousePanStart.panX + (event.clientX - mousePanStart.x);
    panY = mousePanStart.panY + (event.clientY - mousePanStart.y);
    applyZoom(false);
  });
  window.addEventListener('mouseup', () => {
    mousePanStart = null;
    el.readerCanvas.classList.remove('is-panning');
  });

  el.readerCanvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      const a = event.touches[0];
      const b = event.touches[1];
      const mid = midpoint(a, b);
      const rect = el.readerCanvas.getBoundingClientRect();
      pinchStart = {
        distance: distance(a, b),
        scale: zoomScale,
        panX,
        panY,
        x: mid.x - (rect.left + rect.width / 2),
        y: mid.y - (rect.top + rect.height / 2)
      };
      touchStart = null;
      return;
    }
    if (event.touches.length !== 1) return;
    const t = event.touches[0];
    touchStart = { x: t.clientX, y: t.clientY, time: Date.now(), panX, panY };
  }, { passive: false });

  el.readerCanvas.addEventListener('touchmove', (event) => {
    if (event.touches.length === 2 && pinchStart) {
      event.preventDefault();
      const a = event.touches[0];
      const b = event.touches[1];
      const mid = midpoint(a, b);
      const rect = el.readerCanvas.getBoundingClientRect();
      const pointX = mid.x - (rect.left + rect.width / 2);
      const pointY = mid.y - (rect.top + rect.height / 2);
      const ratio = distance(a, b) / Math.max(1, pinchStart.distance);
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStart.scale * ratio));
      panX = pointX - (next * (pinchStart.x - pinchStart.panX) / pinchStart.scale);
      panY = pointY - (next * (pinchStart.y - pinchStart.panY) / pinchStart.scale);
      zoomScale = next;
      applyZoom(false);
      return;
    }
    if (event.touches.length === 1 && touchStart && zoomScale > 1.01) {
      event.preventDefault();
      const t = event.touches[0];
      panX = touchStart.panX + (t.clientX - touchStart.x);
      panY = touchStart.panY + (t.clientY - touchStart.y);
      applyZoom(false);
    }
  }, { passive: false });

  el.readerCanvas.addEventListener('touchend', (event) => {
    if (pinchStart) {
      if (event.touches.length < 2) pinchStart = null;
      if (zoomScale < 1.04) resetZoom(true);
      touchStart = null;
      return;
    }
    if (!touchStart || !event.changedTouches.length) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const elapsed = Date.now() - touchStart.time;
    const moved = Math.hypot(dx, dy);

    if (zoomScale > 1.01) {
      if (moved < 12 && elapsed < 280) handleTap(t.clientX, t.clientY);
      touchStart = null;
      return;
    }

    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      dx < 0 ? nextPage() : prevPage();
    } else if (moved < 12 && elapsed < 280) {
      handleTap(t.clientX, t.clientY);
    }
    touchStart = null;
  }, { passive: true });

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === el.readerShell) {
      el.fullscreenBtn.setAttribute('title', 'Salir de pantalla completa');
      el.fullscreenBtn.setAttribute('aria-label', 'Salir de pantalla completa');
      window.setTimeout(fitStage, 70);
    } else if (!focusMode) {
      el.fullscreenBtn.setAttribute('title', 'Pantalla completa');
      el.fullscreenBtn.setAttribute('aria-label', 'Pantalla completa');
      resetZoom(false);
      window.setTimeout(fitStage, 70);
    }
  });

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitStage, 120);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitStage, 120);
    });
  }

  document.addEventListener('contextmenu', (event) => {
    if (el.readerShell.contains(event.target)) event.preventDefault();
  });
  document.addEventListener('dragstart', (event) => {
    if (event.target && event.target.tagName === 'IMG') event.preventDefault();
  });

  updateUI();
  fitStage();
  prefetchAround();
})();
