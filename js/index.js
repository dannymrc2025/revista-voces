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
      const a = document.createElement('a');
      a.className = 'tarjeta';
      a.href = `revista.html?ed=${encodeURIComponent(e.id)}`;

      const img = document.createElement('img');
      img.src = `ediciones/${e.id}/paginas/p001-m.webp`;
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
