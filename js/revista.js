(async () => {
  const $ = (id) => document.getElementById(id);
  const libro = $('libro');
  const area = $('area');

  const ed = new URLSearchParams(location.search).get('ed');
  if (!ed || !/^[\w.-]+$/.test(ed)) {
    libro.textContent = 'Edición no especificada.';
    return;
  }

  let info;
  try {
    const res = await fetch(`ediciones/${ed}/info.json`);
    if (!res.ok) throw new Error(res.status);
    info = await res.json();
  } catch {
    libro.textContent = 'No se encontró la edición.';
    return;
  }

  const total = info.paginas;
  const ratio = info.ancho / info.alto;
  const base = `ediciones/${ed}/paginas/`;
  const src = (i, v) => `${base}p${String(i + 1).padStart(3, '0')}-${v}.${info.ext || 'webp'}`;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.title = `${info.titulo} – Voces del Corazón Maya`;
  $('titulo').textContent = info.titulo;

  let flip = null;
  let actual = 0;
  let overlayAbierto = false;
  let clave = '';

  const esDoble = () => innerWidth >= 900;

  // La barra de reacciones escucha este evento (js/reacciones.js).
  function notificar(paginas, lectura) {
    window.vocesPaginas = { paginas, lectura };
    window.dispatchEvent(new CustomEvent('voces:pagina', { detail: window.vocesPaginas }));
  }

  // Asigna src solo a la página actual, 2 anteriores y 3 siguientes.
  function cargar(centro) {
    for (let i = Math.max(0, centro - 2); i <= Math.min(total - 1, centro + 3); i++) {
      const img = libro.querySelector(`img[data-i="${i}"]`);
      if (img && !img.getAttribute('src')) {
        img.alt = `Página ${i + 1}`;
        img.src = src(i, 'm');
      }
    }
  }

  function actualizarUI() {
    const doble = flip.getOrientation() === 'landscape';
    const ultima = doble ? actual + 1 >= total - 1 : actual >= total - 1;
    $('contador').textContent = doble && actual > 0 && actual + 1 < total
      ? `${actual + 1}–${actual + 2} / ${total}`
      : `${actual + 1} / ${total}`;
    $('prev').disabled = actual === 0;
    $('next').disabled = ultima;
    notificar(doble && actual > 0 && actual + 1 < total ? [actual, actual + 1] : [actual], false);
  }

  function construir() {
    const w = area.clientWidth;
    const h = area.clientHeight;
    if (!w || !h) return;

    const doble = esDoble();
    const pagW = Math.floor(doble ? Math.min(w / 2, h * ratio) : Math.min(w, h * ratio));
    const pagH = Math.floor(pagW / ratio);
    const nueva = `${doble}|${pagW}|${pagH}`;
    if (nueva === clave) return;
    clave = nueva;

    if (flip) {
      try { flip.destroy(); } catch { /* ya destruido */ }
      flip = null;
    }
    libro.replaceChildren();
    libro.style.width = `${doble ? pagW * 2 : pagW}px`;
    libro.style.height = `${pagH}px`;

    const host = document.createElement('div');
    host.style.cssText = 'width:100%;height:100%';
    for (let i = 0; i < total; i++) {
      const p = document.createElement('div');
      p.className = 'page';
      if (i === 0 || i === total - 1) p.dataset.density = 'hard';
      const img = document.createElement('img');
      img.dataset.i = i;
      img.alt = '';
      img.draggable = false;
      p.append(img);
      host.append(p);
    }
    libro.append(host);

    flip = new St.PageFlip(host, {
      width: info.ancho,
      height: info.alto,
      size: 'stretch',
      // En modo stretch, minWidth decide vertical (1 página) u horizontal (2 páginas).
      minWidth: Math.floor(pagW * 0.9),
      maxWidth: 3000,
      minHeight: 100,
      maxHeight: 4000,
      showCover: true,
      usePortrait: true,
      mobileScrollSupport: false,
      disableFlipByClick: true,
      flippingTime: reducido ? 150 : 700,
      maxShadowOpacity: 0.5,
      startPage: Math.min(actual, total - 1),
    });
    flip.loadFromHTML(host.querySelectorAll('.page'));

    flip.on('flip', (e) => {
      actual = e.data;
      cargar(actual);
      actualizarUI();
    });

    actual = flip.getCurrentPageIndex();
    cargar(actual);
    actualizarUI();
  }

  // Modo lectura: la imagen HD ocupa el ancho; el zoom cambia su ancho y el desplazamiento es nativo.
  const lectura = $('lectura');
  const vista = $('lec-vista');
  const lienzo = $('lec-lienzo');
  const limg = $('lec-img');
  const ZOOM_MAX = 4;
  let lec = 0;
  let esc = 1;
  let cargaHd = 0;

  function mostrarLectura(i) {
    lec = Math.max(0, Math.min(total - 1, i));
    esc = 1;
    lienzo.style.width = '100%';
    vista.scrollTop = 0;
    vista.scrollLeft = 0;
    limg.style.aspectRatio = `${info.ancho} / ${info.alto}`;
    limg.alt = `Página ${lec + 1}`;
    const token = ++cargaHd;
    limg.src = src(lec, 'm');
    const hd = new Image();
    hd.onload = () => { if (token === cargaHd) limg.src = hd.src; };
    hd.src = src(lec, 'hd');
    if (lec + 1 < total) new Image().src = src(lec + 1, 'hd');
    $('lec-pag').textContent = `Página ${lec + 1} de ${total}`;
    $('lec-prev').disabled = lec === 0;
    $('lec-next').disabled = lec >= total - 1;
    notificar([lec], true);
  }

  function abrirLectura(i) {
    ocultarAyuda();
    mostrarLectura(i);
    lectura.hidden = false;
    overlayAbierto = true;
    $('lec-cerrar').focus({ preventScroll: true });
  }
  function cerrarLectura() {
    lectura.hidden = true;
    cargaHd++;
    limg.removeAttribute('src');
    overlayAbierto = false;
    if (flip) {
      try { flip.turnToPage(lec); } catch { /* se queda donde estaba */ }
      actual = flip.getCurrentPageIndex();
      cargar(actual);
      actualizarUI();
    }
  }
  $('lec-cerrar').addEventListener('click', cerrarLectura);
  $('lec-prev').addEventListener('click', () => mostrarLectura(lec - 1));
  $('lec-next').addEventListener('click', () => mostrarLectura(lec + 1));
  $('leer').addEventListener('click', () => abrirLectura(actual));

  // Acerca o aleja manteniendo el punto (cx, cy) bajo (tx, ty).
  function zoom(nuevo, cx, cy, tx = cx, ty = cy) {
    nuevo = Math.min(ZOOM_MAX, Math.max(1, nuevo));
    const r = lienzo.getBoundingClientRect();
    const px = (cx - r.left) / esc;
    const py = (cy - r.top) / esc;
    esc = nuevo;
    lienzo.style.width = `${esc * 100}%`;
    const r2 = lienzo.getBoundingClientRect();
    vista.scrollLeft += r2.left + px * esc - tx;
    vista.scrollTop += r2.top + py * esc - ty;
  }

  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const medio = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
  let pinch = null;
  let multi = false;
  let deslizar = null;

  vista.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      multi = true;
      deslizar = null;
      pinch = { d: dist(e.touches), s: esc };
    } else if (e.touches.length === 1 && !multi) {
      const t = e.touches[0];
      deslizar = esc === 1 && vista.scrollTop <= 0 ? { x: t.clientX, y: t.clientY } : null;
    }
  }, { passive: true });
  vista.addEventListener('touchmove', (e) => {
    if (pinch && e.touches.length === 2) {
      e.preventDefault();
      const m = medio(e.touches);
      zoom(pinch.s * (dist(e.touches) / pinch.d), m.x, m.y);
    }
  }, { passive: false });
  vista.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pinch = null;
    if (e.touches.length > 0) return;
    if (esc < 1.05 && esc !== 1) zoom(1, innerWidth / 2, innerHeight / 2);
    const t = e.changedTouches[0];
    if (deslizar && !multi && t) {
      const dy = t.clientY - deslizar.y;
      if (dy > 100 && dy > 1.5 * Math.abs(t.clientX - deslizar.x) && esc === 1 && vista.scrollTop <= 0) cerrarLectura();
    }
    deslizar = null;
    setTimeout(() => { multi = false; }, 0);
  }, { passive: true });
  vista.addEventListener('touchcancel', () => { pinch = null; deslizar = null; multi = false; }, { passive: true });

  // Doble toque: 1x -> 2.5x centrado en el punto tocado; con zoom vuelve a 1x.
  let ult = { t: 0, x: 0, y: 0 };
  let desde = null;
  vista.addEventListener('pointerdown', (e) => { desde = { x: e.clientX, y: e.clientY }; });
  vista.addEventListener('pointerup', (e) => {
    if (!desde || multi) { desde = null; return; }
    const movido = Math.hypot(e.clientX - desde.x, e.clientY - desde.y) > 10;
    desde = null;
    if (movido) { ult.t = 0; return; }
    const ahora = Date.now();
    if (ahora - ult.t < 350 && Math.hypot(e.clientX - ult.x, e.clientY - ult.y) < 40) {
      ult.t = 0;
      if (esc === 1) zoom(2.5, e.clientX, e.clientY, innerWidth / 2, innerHeight / 2);
      else zoom(1, e.clientX, e.clientY);
    } else {
      ult = { t: ahora, x: e.clientX, y: e.clientY };
    }
  });

  // Ayuda de la primera visita en pantallas pequeñas
  const AYUDA_KEY = 'voces-ayuda-lectura';
  const globo = $('ayuda-leer');
  let tAyuda = null;
  function ocultarAyuda() {
    clearTimeout(tAyuda);
    globo.hidden = true;
  }
  function mostrarAyuda() {
    try { if (localStorage.getItem(AYUDA_KEY)) return; } catch { return; }
    if (innerWidth >= 900) return;
    try { localStorage.setItem(AYUDA_KEY, '1'); } catch { /* sin almacenamiento */ }
    globo.hidden = false;
    const r = $('leer').getBoundingClientRect();
    globo.style.bottom = `${innerHeight - r.top + 10}px`;
    const w = globo.offsetWidth;
    globo.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    globo.style.setProperty('--flecha', `${Math.max(12, Math.min(w - 12, r.left + r.width / 2 - parseFloat(globo.style.left)))}px`);
    tAyuda = setTimeout(ocultarAyuda, 5000);
  }
  globo.addEventListener('click', ocultarAyuda);
  setTimeout(mostrarAyuda, 800);

  // Doble toque o doble clic, con el mismo código para ratón y táctil.
  let ultimo = { t: 0, x: 0, y: 0 };
  let inicio = null;
  libro.addEventListener('pointerdown', (e) => { inicio = { x: e.clientX, y: e.clientY }; });
  libro.addEventListener('pointerup', (e) => {
    if (!inicio) return;
    const movido = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 10;
    inicio = null;
    if (movido) { ultimo.t = 0; return; }
    const ahora = Date.now();
    const cerca = Math.hypot(e.clientX - ultimo.x, e.clientY - ultimo.y) < 40;
    if (ahora - ultimo.t < 350 && cerca) {
      ultimo.t = 0;
      const img = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.matches?.('img[data-i]'));
      abrirLectura(img ? Number(img.dataset.i) : actual);
    } else {
      ultimo = { t: ahora, x: e.clientX, y: e.clientY };
    }
  });

  // Navegación
  $('prev').addEventListener('click', () => flip?.flipPrev());
  $('next').addEventListener('click', () => flip?.flipNext());
  window.vocesIrAPagina = (pagina) => {
    const destino = Math.max(0, Math.min(total - 1, Number(pagina) || 0));
    if (flip) {
      flip.turnToPage(destino);
      actual = destino;
      cargar(actual);
      actualizarUI();
    }
  };
  document.addEventListener('keydown', (e) => {
    if (overlayAbierto) {
      if (e.key === 'Escape') cerrarLectura();
      else if (e.key === 'ArrowLeft') mostrarLectura(lec - 1);
      else if (e.key === 'ArrowRight') mostrarLectura(lec + 1);
    } else if (e.key === 'ArrowLeft') flip?.flipPrev();
    else if (e.key === 'ArrowRight') flip?.flipNext();
  });

  // Compartir
  let siteUrl = location.href.replace(/revista\.html.*$/, '');
  try {
    const cfg = await (await fetch('config.json')).json();
    if (cfg.site_url) siteUrl = cfg.site_url.replace(/\/?$/, '/');
  } catch { /* se usa la URL actual */ }

  $('compartir').addEventListener('click', async () => {
    const url = `${siteUrl}ediciones/${ed}/`;
    const titulo = `Voces del Corazón Maya – ${info.titulo}`;
    if (navigator.share) {
      try { await navigator.share({ title: titulo, text: titulo, url }); } catch { /* cancelado */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${titulo} ${url}`)}`, '_blank', 'noopener');
    }
  });

  // Recalcular al cambiar tamaño u orientación
  let temporizador;
  new ResizeObserver(() => {
    clearTimeout(temporizador);
    temporizador = setTimeout(construir, 150);
  }).observe(area);

  construir();
})();
