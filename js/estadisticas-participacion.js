import { GRUPOS, COLOR_GRADO, colorGrupo, REACC, cargarReacciones, cargarTrivia } from "./participacion-datos.js";

const $ = (id) => document.getElementById(id);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const fmt = (n) => n.toLocaleString("es-MX");
const SIN_ARTICULOS = "Define los artículos de esta edición en Ediciones → Artículos para ver sus reacciones.";

let db = null;
let token = 0;
let charts = [];
let participantes = [];
let orden = { campo: "fecha", dir: -1 };

export function iniciarParticipacion(opciones) { db = opciones.db; }
export function detenerParticipacion() { token++; destruir(); participantes = []; $("est-reacciones").replaceChildren(); $("est-trivia").replaceChildren(); }
function destruir() { charts.forEach((c) => c.destroy()); charts = []; }

async function chartLib() {
  const m = await import("https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm");
  m.Chart.register(...m.registerables);
  return m.Chart;
}

function tarjeta(titulo, valor, detalle) {
  const t = h("div", "stat");
  t.append(h("span", "stat-t", titulo), h("strong", "stat-v", valor));
  if (detalle) t.append(h("span", "stat-d", detalle));
  return t;
}
function tabla(cabeceras, filas, clasesFila) {
  const t = h("table", "trivia-tabla");
  const th = document.createElement("thead"); const tr = document.createElement("tr");
  cabeceras.forEach((c) => tr.append(h("th", "", c)));
  th.append(tr);
  const tb = document.createElement("tbody");
  filas.forEach((f, i) => {
    const r = document.createElement("tr");
    f.forEach((c) => r.append(h("td", "", String(c))));
    clasesFila?.(r, i);
    tb.append(r);
  });
  t.append(th, tb);
  const caja = h("div", "tabla-scroll"); caja.append(t);
  return caja;
}
const bloque = (titulo, ...hijos) => { const c = h("div", "card sec"); c.append(h("h3", "est-h", titulo), ...hijos); return c; };

async function pintarReacciones(id, Chart) {
  const host = $("est-reacciones");
  const { articulos } = await cargarReacciones(db, id);
  if (id !== seleccionActual) return;
  if (!articulos.length) { host.replaceChildren(h("p", "vacio", SIN_ARTICULOS)); return; }
  const total = articulos.reduce((s, a) => s + a.total, 0);
  const porTipo = REACC.map(([k, e]) => [e, articulos.reduce((s, a) => s + a[k], 0)]);
  const masUsada = total ? [...porTipo].sort((a, b) => b[1] - a[1])[0] : null;
  const fav = total ? articulos[0] : null;
  const stats = h("div", "stats");
  stats.append(
    tarjeta("Total de reacciones", fmt(total)),
    tarjeta("Artículo favorito", fav ? fav.titulo : "—", fav ? `${fav.total} reacciones` : "Aún sin reacciones"),
    tarjeta("Reacción más usada", masUsada ? `${masUsada[0]} ${fmt(masUsada[1])}` : "—")
  );
  const filas = articulos.map((a) => [a.titulo, a.seccion, ...REACC.map(([k]) => a[k]), a.total]);
  const secciones = new Map();
  articulos.forEach((a) => secciones.set(a.seccion, (secciones.get(a.seccion) || 0) + a.total));
  const porSec = [...secciones.entries()].sort((a, b) => b[1] - a[1]);

  const lienzo = h("div", "grafica"); lienzo.style.height = `${Math.max(140, articulos.length * 34 + 60)}px`;
  const canvas = document.createElement("canvas"); canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", "Reacciones por artículo");
  lienzo.append(canvas);
  host.replaceChildren(
    stats,
    bloque("Artículos", tabla(["Título", "Sección", ...REACC.map((r) => r[1]), "Total"], filas)),
    bloque("Reacciones por artículo", lienzo),
    bloque("Por sección", tabla(["Sección", "Reacciones"], porSec))
  );
  charts.push(new Chart(canvas, {
    type: "bar",
    data: {
      labels: articulos.map((a) => (a.titulo.length > 28 ? `${a.titulo.slice(0, 27)}…` : a.titulo)),
      datasets: REACC.map(([k, e, c]) => ({ label: e, data: articulos.map((a) => a[k]), backgroundColor: c }))
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#f3ead8", font: { size: 14 } } } },
      scales: {
        x: { stacked: true, beginAtZero: true, ticks: { color: "#f3ead8", precision: 0 }, grid: { color: "rgba(243,234,216,.12)" } },
        y: { stacked: true, ticks: { color: "#f3ead8" }, grid: { display: false } }
      }
    }
  }));
}

function podio(ranking) {
  const top = ranking.filter((f) => f.participantes > 0).slice(0, 3);
  const p = h("div", "trivia-podio");
  if (!top.length) { p.append(h("p", "", "Aún no hay participantes.")); return p; }
  top.forEach((f, i) => {
    const it = h("div", "trivia-podio-item"); it.style.setProperty("--grado", colorGrupo(f.grupo));
    it.append(h("span", "trivia-medalla", ["🥇", "🥈", "🥉"][i]), h("strong", "", f.grupo), h("span", "", `${f.puntos} puntos`));
    p.append(it);
  });
  return p;
}

function pintarLista(host) {
  const g = $("est-trivia-grupo")?.value || "";
  const datos = participantes.filter((p) => !g || p.grupo === g).sort((a, b) => {
    const x = a[orden.campo], y = b[orden.campo];
    const c = x instanceof Date || y instanceof Date ? (x || 0) - (y || 0)
      : typeof x === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), "es");
    return c * orden.dir;
  });
  host.replaceChildren();
  if (!datos.length) { host.append(h("p", "vacio", "Sin participantes para este filtro.")); return; }
  const t = h("table", "trivia-tabla"); const th = document.createElement("thead"); const tr = document.createElement("tr");
  [["nombre", "Nombre"], ["grupo", "Grupo"], ["aciertos", "Aciertos"], ["fecha", "Fecha"]].forEach(([k, txt]) => {
    const c = document.createElement("th"); const b = h("button", "trivia-orden", txt + (orden.campo === k ? (orden.dir > 0 ? " ↑" : " ↓") : "")); b.type = "button";
    b.addEventListener("click", () => { orden = { campo: k, dir: orden.campo === k ? -orden.dir : 1 }; pintarLista(host); });
    c.append(b); tr.append(c);
  });
  th.append(tr);
  const tb = document.createElement("tbody");
  datos.forEach((p) => {
    const r = document.createElement("tr");
    r.append(h("td", "", p.nombre || "—"), h("td", "", p.grupo || "—"), h("td", "", String(p.aciertos ?? 0)),
      h("td", "", p.fecha ? p.fecha.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—"));
    tb.append(r);
  });
  t.append(th, tb);
  const caja = h("div", "tabla-scroll"); caja.append(t); host.append(caja);
}

async function pintarTrivia(id, Chart) {
  const host = $("est-trivia");
  const t = await cargarTrivia(db, id);
  if (id !== seleccionActual) return;
  if (!t) { host.replaceChildren(h("p", "vacio", "Esta edición no tiene trivia.")); return; }
  participantes = t.participantes;
  const stats = h("div", "stats");
  stats.append(
    tarjeta("Participantes", fmt(t.total), "Alumnos"),
    tarjeta("Promedio de aciertos", t.total ? `${t.promedio.toFixed(1)} de ${t.preguntas.length}` : "—"),
    tarjeta("Puntajes perfectos", t.total ? `${t.pctPerfectos} %` : "—")
  );
  const rank = tabla(["Grupo", "Puntos", "Participantes", "Promedio"],
    t.ranking.map((f) => [f.grupo, f.puntos, f.participantes, f.participantes ? (f.puntos / f.participantes).toFixed(1) : "—"]),
    (r, i) => r.style.setProperty("--grado", colorGrupo(t.ranking[i].grupo)));

  const porGrado = [1, 2, 3].map((g) => t.ranking.filter((f) => f.grupo[0] === String(g)).reduce((s, f) => s + f.participantes, 0));
  const lienzoGrado = h("div", "grafica"); const cg = document.createElement("canvas"); cg.setAttribute("role", "img"); cg.setAttribute("aria-label", "Participantes por grado"); lienzoGrado.append(cg);

  const dif = h("div");
  if (!t.dificultad.length) dif.append(h("p", "vacio", "Sin datos por pregunta todavía"));
  else {
    const min = Math.min(...t.dificultad.map((d) => d.pct)); const max = Math.max(...t.dificultad.map((d) => d.pct));
    t.dificultad.forEach((d, i) => {
      const fila = h("div", "barra-fila"); const cab = h("div", "barra-cab");
      cab.append(h("span", "", `${i + 1}. ${d.texto.length > 60 ? `${d.texto.slice(0, 59)}…` : d.texto}`), h("strong", "", `${d.pct} %`));
      const pista = h("div", "barra-pista"); const rel = h("div", "barra-rel"); rel.style.width = `${d.pct}%`;
      if (t.dificultad.length > 1 && min !== max) rel.style.background = d.pct === min ? "#E07A5F" : d.pct === max ? "#4CAF50" : "var(--jade)";
      pista.append(rel); fila.append(cab, pista); dif.append(fila);
    });
  }

  const lista = h("div"); const filtro = h("select"); filtro.id = "est-trivia-grupo"; filtro.setAttribute("aria-label", "Filtrar por grupo");
  const todos = h("option", "", "Todos los grupos"); todos.value = ""; filtro.append(todos);
  [1, 2, 3].forEach((g) => { const og = document.createElement("optgroup"); og.label = ["1.er grado", "2.º grado", "3.er grado"][g - 1]; GRUPOS.filter((x) => x[0] === String(g)).forEach((x) => { const o = h("option", "", x); o.value = x; og.append(o); }); filtro.append(og); });
  const zona = h("div"); filtro.addEventListener("change", () => pintarLista(zona));
  lista.append(filtro, zona);

  host.replaceChildren(stats, bloque("Ranking por grupo", podio(t.ranking), rank), bloque("Participantes por grado", lienzoGrado), bloque("Dificultad de las preguntas", dif), bloque("Lista de participantes", lista));
  pintarLista(zona);
  charts.push(new Chart(cg, {
    type: "bar",
    data: { labels: ["1.º", "2.º", "3.º"], datasets: [{ data: porGrado, backgroundColor: COLOR_GRADO, borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: "#f3ead8" }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: "#f3ead8", precision: 0 }, grid: { color: "rgba(243,234,216,.12)" } } } }
  }));
}

let seleccionActual = "";
export async function cargarParticipacion(id) {
  seleccionActual = id;
  const mi = ++token;
  destruir();
  if (!id) return;
  $("est-reacciones").replaceChildren(h("p", "vacio", "Cargando…"));
  $("est-trivia").replaceChildren(h("p", "vacio", "Cargando…"));
  const Chart = await chartLib();
  if (mi !== token) return;
  const fallo = (host) => (e) => { console.warn("Participación:", e.code || e.message); if (mi === token) $(host).replaceChildren(h("p", "vacio", "No se pudo cargar esta sección.")); };
  await Promise.all([
    pintarReacciones(id, Chart).catch(fallo("est-reacciones")),
    pintarTrivia(id, Chart).catch(fallo("est-trivia"))
  ]);
}
