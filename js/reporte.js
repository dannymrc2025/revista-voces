const HTML2PDF = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js";
const C = {
  papel: "#FBF7EF", texto: "#2B2B2B", bosque: "#0D3B2B", verde: "#1B5E20", claro: "#4CAF50",
  tierra: "#6D4C41", tierraClara: "#D4A574", oro: "#E3B14A", gris: "#D9D4C7"
};
const ROLES = { "Alumno": "#4FB3D9", "Docente": "#E3B14A", "Padre o madre de familia": "#E07A5F" };
const DISP = [["movil", "Celular", "#4CAF50"], ["tablet", "Tableta", "#D4A574"], ["escritorio", "Computadora", "#6D4C41"]];
const GRUPOS = ["1A", "1B", "1C", "1D", "1E", "2A", "2B", "2C", "2D", "2E", "3A", "3B", "3C", "3D", "3E"];
const FONT = { family: "'Nunito Sans', sans-serif" };

const CSS = `
.rp { width: 816px; font-family: 'Nunito Sans', sans-serif; color: ${C.texto}; background: ${C.papel}; }
.rp * { box-sizing: border-box; }
.rp-pag { position: relative; width: 816px; height: 1056px; overflow: hidden; background: ${C.papel}; }
.rp-pag2 { height: 1055px; }
.rp h1, .rp h2 { font-family: 'Cinzel', Georgia, serif; margin: 0; }
.rp-greca { display: block; width: 816px; height: 16px; }
.rp-cab { background: ${C.bosque}; color: #fff; display: flex; gap: 24px; align-items: center; padding: 24px 40px; }
.rp-cab img { width: 110px; height: auto; border-radius: 4px; border: 3px solid ${C.oro}; background: #fff; flex: none; }
.rp-cab h1 { font-size: 28px; line-height: 1.15; color: ${C.oro}; }
.rp-cab p { margin: 5px 0 0; font-size: 13px; opacity: .92; }
.rp-cuerpo { padding: 22px 40px 0; }
.rp-tarjetas { display: flex; gap: 12px; }
.rp-t { flex: 1; border-radius: 12px; padding: 14px 12px; text-align: center; color: #fff; }
.rp-t strong { display: block; font-family: 'Cinzel', Georgia, serif; font-size: 34px; line-height: 1.1; }
.rp-t span { font-size: 12px; font-weight: 700; }
.rp h2 { font-size: 16px; color: ${C.verde}; margin: 0 0 8px; }
.rp-sec { margin-top: 20px; }
.rp-nota { font-size: 11px; color: ${C.tierra}; margin: 6px 0 0; }
.rp-frase { margin-top: 18px; padding: 14px 16px; border-left: 5px solid ${C.oro}; background: #fff; border-radius: 8px; font-size: 15px; }
.rp-vacio { padding: 14px; border: 1.5px dashed ${C.tierraClara}; border-radius: 10px; text-align: center; font-size: 13px; color: ${C.tierra}; }
.rp-fila { display: flex; align-items: center; gap: 10px; height: 22px; font-size: 12px; }
.rp-fila .n { width: 230px; flex: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rp-fila .b { flex: 1; height: 12px; background: #EFE8D8; border-radius: 6px; overflow: hidden; }
.rp-fila .b div { height: 100%; border-radius: 6px; }
.rp-fila .v { width: 28px; text-align: right; font-weight: 700; flex: none; }
.rp-dos { display: flex; gap: 24px; }
.rp-dos > div { flex: 1; min-width: 0; }
.rp-dona { display: flex; align-items: center; gap: 12px; }
.rp-leyenda { font-size: 12px; display: flex; flex-direction: column; gap: 5px; }
.rp-leyenda i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; }
.rp-grupos { display: flex; align-items: flex-end; gap: 6px; height: 100px; }
.rp-g { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; font-size: 10px; }
.rp-g div { width: 100%; border-radius: 3px 3px 0 0; }
.rp-g b { font-size: 10px; margin-bottom: 2px; }
.rp-com { margin-bottom: 8px; padding: 9px 12px; background: #fff; border-radius: 8px; border-left: 5px solid ${C.gris}; font-size: 12px; }
.rp-com p { margin: 0 0 4px; font-style: italic; overflow-wrap: anywhere; }
.rp-com small { font-size: 11px; color: ${C.tierra}; font-weight: 700; }
.rp-pie { position: absolute; left: 0; right: 0; bottom: 0; }
.rp-pie div { display: flex; justify-content: space-between; padding: 6px 40px 8px; font-size: 10px; color: ${C.tierra}; }
`;

// Greca escalonada sencilla; el SVG es un literal fijo, sin datos del usuario.
const GRECA = (color, fondo) => `<svg class="rp-greca" viewBox="0 0 816 16" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="g${color.slice(1)}" width="32" height="16" patternUnits="userSpaceOnUse"><path d="M0 14V8h8V2h16v6h8v6" fill="none" stroke="${color}" stroke-width="2.5"/></pattern></defs><rect width="816" height="16" fill="${fondo}"/><rect width="816" height="16" fill="url(#g${color.slice(1)})"/></svg>`;

function h(tag, cls, texto) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

const fmtFecha = (d) => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
const fmtCorta = (d) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
const clave = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

function cargarScript(url) {
  return new Promise((ok, fallo) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = ok;
    s.onerror = () => fallo(new Error("No se pudo cargar html2pdf"));
    document.head.append(s);
  });
}

function cargarImagen(img, url) {
  return new Promise((ok) => { img.onload = ok; img.onerror = ok; img.src = url; });
}

function vacio(texto) { return h("div", "rp-vacio", texto); }

function lugarDe(v) {
  const partes = [v.ciudad, v.region].filter((p, i, a) => p && p !== "Desconocido" && a.indexOf(p) === i);
  return partes.length ? partes.join(", ") : "Desconocido";
}

function lienzo(w, hh) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = hh;
  c.style.width = `${w}px`;
  c.style.height = `${hh}px`;
  return c;
}

function leyenda(items) {
  const l = h("div", "rp-leyenda");
  for (const [nombre, color, texto] of items) {
    const f = h("div");
    const i = h("i");
    i.style.background = color;
    f.append(i, document.createTextNode(`${nombre}: ${texto}`));
    l.append(f);
  }
  return l;
}

function dona(Chart, etiquetas, datos, colores) {
  const c = lienzo(150, 150);
  new Chart(c, {
    type: "doughnut",
    data: { labels: etiquetas, datasets: [{ data: datos, backgroundColor: colores, borderWidth: 2, borderColor: C.papel }] },
    options: { animation: false, responsive: false, devicePixelRatio: 2, cutout: "58%", plugins: { legend: { display: false }, tooltip: { enabled: false } } }
  });
  return c;
}

export async function generarReporte({ edicion, visitas, comentarios, Chart }) {
  if (!window.html2pdf) await cargarScript(HTML2PDF);
  if (document.fonts?.load) {
    await Promise.all(["700 20px Cinzel", "400 12px 'Nunito Sans'", "700 12px 'Nunito Sans'"].map((f) => document.fonts.load(f).catch(() => {})));
    await document.fonts.ready;
  }

  const hoy = new Date();
  const fechas = visitas.map((v) => v.fecha?.toDate?.()).filter(Boolean).sort((a, b) => a - b);
  const total = visitas.length;
  const porDia = new Map();
  for (const f of fechas) porDia.set(clave(f), (porDia.get(clave(f)) || 0) + 1);
  const diasConVisitas = porDia.size;
  const movil = visitas.filter((v) => v.dispositivo === "movil").length;
  const pctMovil = total ? Math.round((movil / total) * 100) : 0;
  const primera = fechas[0];

  const raiz = h("div", "rp");
  const estilo = document.createElement("style");
  estilo.textContent = CSS;
  raiz.append(estilo);

  const pie = (n) => {
    const p = h("div", "rp-pie");
    p.innerHTML = GRECA(C.tierra, C.papel);
    const f = h("div");
    f.append(
      h("span", "", `Reporte generado el ${hoy.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })} · Voces del Corazón Maya`),
      h("span", "", `Página ${n} de 2`)
    );
    p.append(f);
    return p;
  };

  // ----- Página 1 -----
  const p1 = h("section", "rp-pag");
  const greca1 = h("div");
  greca1.innerHTML = GRECA(C.oro, C.bosque);
  const cab = h("div", "rp-cab");
  const portada = h("img");
  portada.alt = "";
  const textos = h("div");
  textos.append(
    h("h1", "", edicion.titulo),
    h("p", "", "Escuela Secundaria Técnica #26 \"José María Luis Mora\""),
    h("p", "", edicion.fecha || ""),
    h("p", "", `Periodo: ${primera ? fmtFecha(primera) : "sin visitas aún"} – ${fmtFecha(hoy)}`)
  );
  cab.append(portada, textos);

  const cuerpo1 = h("div", "rp-cuerpo");
  const tarjetas = h("div", "rp-tarjetas");
  const tarjeta = (valor, etiqueta, fondo, color = "#fff") => {
    const t = h("div", "rp-t");
    t.style.background = fondo;
    t.style.color = color;
    t.append(h("strong", "", String(valor)), h("span", "", etiqueta));
    return t;
  };
  tarjetas.append(
    tarjeta(total, "Visitas totales", C.bosque),
    tarjeta(diasConVisitas, "Días con visitas", C.verde),
    tarjeta(comentarios.length, "Comentarios publicados", C.tierra),
    tarjeta(`${pctMovil} %`, "Desde celular", C.claro, C.bosque)
  );
  cuerpo1.append(tarjetas);

  const secDia = h("div", "rp-sec");
  secDia.append(h("h2", "", "Visitas por día"));
  const graficas = [];
  if (!total) {
    secDia.append(vacio("Aún no hay visitas registradas para esta edición."));
  } else {
    const ini = new Date(primera.getFullYear(), primera.getMonth(), primera.getDate());
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const dias = [];
    for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) dias.push(new Date(d));
    const vals = dias.map((d) => porDia.get(clave(d)) || 0);
    const max = Math.max(...vals);
    const idxMax = vals.indexOf(max);
    const c = lienzo(736, 300);
    secDia.append(c, h("p", "rp-nota", `Día con más visitas: ${fmtFecha(dias[idxMax])} (${max})`));
    graficas.push(() => new Chart(c, {
      type: "bar",
      data: { labels: dias.map(fmtCorta), datasets: [{ data: vals, backgroundColor: vals.map((_, i) => (i === idxMax ? C.oro : C.verde)), borderRadius: 3 }] },
      options: {
        animation: false, responsive: false, devicePixelRatio: 2,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { ticks: { color: C.texto, font: FONT, maxTicksLimit: 12, maxRotation: 0 }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: C.texto, font: FONT, precision: 0 }, grid: { color: "rgba(43, 43, 43, .12)" } }
        }
      }
    }));
  }
  cuerpo1.append(secDia);

  const frase = h("p", "rp-frase", total
    ? `La edición recibió ${plural(total, "visita", "visitas")} en ${plural(diasConVisitas, "día", "días")}; el ${pctMovil} % fue desde celular.`
    : "Cuando la edición reciba visitas, aquí aparecerá un resumen.");
  cuerpo1.append(frase);
  p1.append(greca1, cab, cuerpo1, pie(1));

  // ----- Página 2 -----
  const p2 = h("section", "rp-pag rp-pag2");
  const greca2 = h("div");
  greca2.innerHTML = GRECA(C.oro, C.bosque);
  const cuerpo2 = h("div", "rp-cuerpo");
  cuerpo2.style.paddingTop = "16px";

  const secLugares = h("div");
  secLugares.append(h("h2", "", "Lugares"));
  if (!total) secLugares.append(vacio("Aún no hay visitas registradas."));
  else {
    const m = new Map();
    for (const v of visitas) m.set(lugarDe(v), (m.get(lugarDe(v)) || 0) + 1);
    const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const paleta = [C.verde, C.tierraClara, C.claro, C.tierra];
    top.forEach(([lugar, n], i) => {
      const f = h("div", "rp-fila");
      const b = h("div", "b");
      const r = h("div");
      r.style.width = `${(n / top[0][1]) * 100}%`;
      r.style.background = paleta[i % paleta.length];
      b.append(r);
      f.append(h("span", "n", lugar), b, h("span", "v", String(n)));
      secLugares.append(f);
    });
    secLugares.append(h("p", "rp-nota", "Ubicación aproximada según la conexión a internet"));
  }

  const dos = h("div", "rp-dos rp-sec");
  const colDisp = h("div");
  colDisp.append(h("h2", "", "Dispositivos"));
  if (!total) colDisp.append(vacio("Sin datos todavía"));
  else {
    const cuentas = DISP.map(([k]) => visitas.filter((v) => v.dispositivo === k).length);
    const f = h("div", "rp-dona");
    f.append(dona(Chart, DISP.map((d) => d[1]), cuentas, DISP.map((d) => d[2])),
      leyenda(DISP.map(([, n, c], i) => [n, c, `${Math.round((cuentas[i] / total) * 100)} %`])));
    colDisp.append(f);
  }
  const colRol = h("div");
  colRol.append(h("h2", "", "Comentarios por rol"));
  if (!comentarios.length) colRol.append(vacio("Aún no hay comentarios"));
  else {
    const m = new Map();
    for (const c of comentarios) m.set(c.rol, (m.get(c.rol) || 0) + 1);
    const items = [...m.entries()];
    const colores = items.map(([r]) => ROLES[r] || "#9AA5A0");
    const f = h("div", "rp-dona");
    f.append(dona(Chart, items.map((i) => i[0]), items.map((i) => i[1]), colores),
      leyenda(items.map(([r, n], i) => [r === "Padre o madre de familia" ? "Padres" : r, colores[i], String(n)])));
    colRol.append(f);
  }
  dos.append(colDisp, colRol);

  const secGrupos = h("div", "rp-sec");
  secGrupos.append(h("h2", "", "Participación de alumnos por grupo"));
  const alumnos = comentarios.filter((c) => c.rol === "Alumno" && c.grupo);
  if (!alumnos.length) secGrupos.append(vacio("Aún no hay comentarios de alumnos"));
  else {
    const cuenta = Object.fromEntries(GRUPOS.map((g) => [g, 0]));
    for (const c of alumnos) if (c.grupo in cuenta) cuenta[c.grupo]++;
    const max = Math.max(1, ...Object.values(cuenta));
    const barras = h("div", "rp-grupos");
    for (const g of GRUPOS) {
      const col = h("div", "rp-g");
      const b = h("div");
      b.style.height = `${Math.max(4, (cuenta[g] / max) * 72)}px`;
      b.style.background = cuenta[g] ? ROLES.Alumno : C.gris;
      col.append(h("b", "", String(cuenta[g])), b, h("span", "", g));
      barras.append(col);
    }
    secGrupos.append(barras);
  }

  const secCom = h("div", "rp-sec");
  secCom.append(h("h2", "", "Comentarios destacados"));
  if (!comentarios.length) secCom.append(vacio("Aún no hay comentarios publicados"));
  else {
    const recientes = [...comentarios].sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0)).slice(0, 3);
    for (const c of recientes) {
      const t = h("div", "rp-com");
      t.style.borderLeftColor = ROLES[c.rol] || "#9AA5A0";
      const cuerpo = c.texto.length > 220 ? `${c.texto.slice(0, 217)}…` : c.texto;
      const rol = c.rol === "Alumno" && c.grupo ? `Alumno · ${c.grupo}` : c.rol;
      t.append(h("p", "", `“${cuerpo}”`), h("small", "", `— ${c.nombre} · ${rol}`));
      secCom.append(t);
    }
  }

  cuerpo2.append(secLugares, dos, secGrupos, secCom);
  p2.append(greca2, cuerpo2, pie(2));
  raiz.append(p1, p2);
  const fuera = h("div");
  fuera.style.cssText = "position:fixed;left:-10000px;top:0;width:816px;pointer-events:none";
  fuera.append(raiz);
  document.body.append(fuera);

  try {
    await cargarImagen(portada, `ediciones/${encodeURIComponent(edicion.id)}/paginas/p001-m.${edicion.ext || "webp"}`);
    graficas.forEach((g) => g());
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    await window.html2pdf().set({
      margin: 0,
      filename: `Reporte-${edicion.id}.pdf`,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: C.papel, scrollX: 0, scrollY: 0, windowWidth: 816 },
      jsPDF: { unit: "pt", format: "letter", orientation: "portrait" },
      pagebreak: { mode: ["css"], before: ".rp-pag2" }
    }).from(raiz).save();
  } finally {
    fuera.remove();
  }
}
