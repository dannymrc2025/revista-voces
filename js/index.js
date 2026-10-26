(async () => {
  const lista = document.getElementById('lista');
  try {
    const res = await fetch('ediciones/ediciones.json');
    const ediciones = await res.json();
    lista.textContent = '';
    if (!ediciones.length) {
      lista.textContent = 'Aún no hay ediciones publicadas.';
      return;
    }
    for (const e of ediciones.filter((x) => x.visible !== false)) {
      if (e.estado === 'proximamente') {
        const tarjeta = document.createElement('article');
        tarjeta.className = 'tarjeta tarjeta-proximamente';
        tarjeta.setAttribute('aria-label', `${e.titulo}, ${e.fecha}. Próximamente`);

        const portada = document.createElement('div');
        portada.className = 'portada-proximamente';
        portada.setAttribute('aria-hidden', 'true');
        const marca = document.createElement('span');
        marca.textContent = 'Voces del Corazón Maya';
        const numero = document.createElement('strong');
        numero.textContent = '#2';
        const sello = document.createElement('span');
        sello.className = 'sello-proximamente';
        sello.textContent = 'Próximamente';
        portada.append(marca, numero, sello);

        const t = document.createElement('strong');
        t.textContent = e.titulo;
        const f = document.createElement('span');
        f.textContent = e.fecha;
        tarjeta.append(portada, t, f);
        lista.append(tarjeta);
        continue;
      }

      const a = document.createElement('a');
      a.className = 'tarjeta';
      a.href = `revista.html?ed=${encodeURIComponent(e.id)}`;

      const img = document.createElement('img');
      img.src = `ediciones/${e.id}/paginas/p001-m.${e.ext || 'webp'}`;
      img.alt = `Portada de ${e.titulo}`;
      img.loading = 'lazy';

      const t = document.createElement('strong');
      t.textContent = e.titulo;
      const f = document.createElement('span');
      f.textContent = e.fecha;

      a.append(img, t, f);
      lista.append(a);
    }
  } catch {
    lista.textContent = 'No se pudieron cargar las ediciones.';
  }
})();
