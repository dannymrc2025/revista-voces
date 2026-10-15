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
  const src = (i, v) => `${base}p${String(i + 1).padStart(3, '0')}-${v}.webp`;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.title = `${info.titulo} – Voces del Corazón Maya`;
  $('titulo').textContent = info.titulo;

  let flip = null;
  let actual = 0;
  let overlayAbierto = false;
  let clave = '';

  const esDoble = () => innerWidth >= 900;

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

  // Zoom HD
  function abrirZoom(i) {
    const img = $('overlay-img');
    img.alt = `Página ${i + 1}`;
    img.src = src(i, 'hd');
    $('overlay').hidden = false;
    overlayAbierto = true;
    $('cerrar').focus();
  }
  function cerrarZoom() {
    $('overlay').hidden = true;
    $('overlay-img').removeAttribute('src');
    overlayAbierto = false;
  }
  $('cerrar').addEventListener('click', cerrarZoom);

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
      abrirZoom(img ? Number(img.dataset.i) : actual);
    } else {
      ultimo = { t: ahora, x: e.clientX, y: e.clientY };
    }
  });

  // Navegación
  $('prev').addEventListener('click', () => flip?.flipPrev());
  $('next').addEventListener('click', () => flip?.flipNext());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlayAbierto) cerrarZoom();
    else if (overlayAbierto) return;
    else if (e.key === 'ArrowLeft') flip?.flipPrev();
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
