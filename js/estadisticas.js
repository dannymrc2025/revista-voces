import {
  collection, query, where, getDocs, getCountFromServer, Timestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const NO_CONTAR = "revista-no-contar";
const DISPOSITIVOS = { movil: "Celular", tablet: "Tableta", escritorio: "Computadora" };

let db = null;
let getEdiciones = () => [];
let getPublicados = () => [];
let cargado = false;
let cargando = false;
let grafica = null;
let chartLib = null;
let seleccion = null;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const fmt = (n) => n.toLocaleString("es-MX");
const claveDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function contar(q) {
  return (await getCountFromServer(q)).data().count;
}

function tarjetaResumen(titulo, valor, detalle) {
  const t = el("div", "stat");
  t.append(el("span", "stat-t", titulo), el("strong", "stat-v", valor));
  if (detalle) t.append(el("span", "stat-d", detalle));
  return t;
}

async function cargarResumen() {
  const col = collection(db, "visitas");
  const ediciones = getEdiciones();
  const hace7 = Timestamp.fromDate(new Date(Date.now() - 7 * 86400000));
  const [total, ultimos7, porEd] = await Promise.all([
    contar(col),
    contar(query(col, where("fecha", ">=", hace7))),
    Promise.all(ediciones.map((e) => contar(query(col, where("edicion", "==", e.id)))))
  ]);
  const filas = ediciones.map((e, i) => ({ e, visitas: porEd[i] })).sort((a, b) => b.visitas - a.visitas);
  const top = filas[0] && filas[0].visitas > 0 ? filas[0].e.titulo : "—";
  $("est-resumen").replaceChildren(
    tarjetaResumen("Visitas totales", fmt(total)),
    tarjetaResumen("Últimos 7 días", fmt(ultimos7)),
    tarjetaResumen("Edición más leída", top)
  );
  pintarTabla(filas);
}

function pintarTabla(filas) {
  const cont = $("est-tabla");
  if (!filas.length) { cont.replaceChildren(el("p", "vacio", "Aún no hay ediciones.")); return; }
  const publicados = getPublicados();
  cont.replaceChildren(...filas.map(({ e, visitas }) => {
    const n = publicados.filter((c) => c.edicion === e.id).length;
    const fila = el("button", "est-fila");
    fila.type = "button";
    const img = el("img");
    img.src = `ediciones/${encodeURIComponent(e.id)}/paginas/p001-m.${e.ext || "webp"}`;
    img.alt = "";
    img.loading = "lazy";
    const info = el("div");
    info.append(el("strong", "", e.titulo), el("span", "", `${fmt(visitas)} ${visitas === 1 ? "visita" : "visitas"} · ${n} ${n === 1 ? "comentario" : "comentarios"}`));
    fila.append(img, info);
    fila.addEventListener("click", () => { $("est-ed").value = e.id; cargarEdicion(e.id); $("est-detalle").scrollIntoView({ behavior: "smooth", block: "start" }); });
    return fila;
  }));
}

function agrupar(docs) {
  const hoy = new Date();
  const dias = [];
  const porDia = new Map();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    dias.push(d);
    porDia.set(claveDia(d), 0);
  }
  const lugares = new Map();
  const disp = { movil: 0, tablet: 0, escritorio: 0 };
  for (const v of docs) {
    const f = v.fecha?.toDate?.();
    if (f) {
      const k = claveDia(f);
      if (porDia.has(k)) porDia.set(k, porDia.get(k) + 1);
    }
    const partes = [v.ciudad, v.region, v.pais].filter((p, i, a) => p && p !== "Desconocido" && a.indexOf(p) === i);
    const lugar = partes.length ? partes.join(", ") : "Desconocido";
    lugares.set(lugar, (lugares.get(lugar) || 0) + 1);
    if (v.dispositivo in disp) disp[v.dispositivo]++;
  }
  return { dias, porDia, lugares, disp, total: docs.length };
}

async function cargarChart() {
  if (!chartLib) {
    const m = await import("https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm");
    m.Chart.register(...m.registerables);
    chartLib = m.Chart;
  }
  return chartLib;
}

async function pintarGrafica(dias, porDia) {
  const Chart = await cargarChart();
  grafica?.destroy();
  grafica = new Chart($("est-grafica"), {
    type: "bar",
    data: {
      labels: dias.map((d) => `${d.getDate()}/${d.getMonth() + 1}`),
      datasets: [{ data: dias.map((d) => porDia.get(claveDia(d))), backgroundColor: "#2f8f83", borderRadius: 3 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => `Día ${i[0].label}` } } },
      scales: {
        x: { ticks: { color: "#f3ead8", maxTicksLimit: 8, maxRotation: 0 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: "#f3ead8", precision: 0 }, grid: { color: "rgba(243, 234, 216, .12)" } }
      }
    }
  });
}

function pintarLugares(lugares) {
  let filas = [...lugares.entries()];
  if (filas.length > 15) {
    const otros = filas.filter(([, n]) => n === 1);
    filas = filas.filter(([, n]) => n > 1);
    filas.sort((a, b) => b[1] - a[1]);
    if (otros.length) filas.push(["Otros", otros.length]);
  } else filas.sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...filas.map(([, n]) => n));
  const cont = $("est-lugares");
  if (!filas.length) { cont.replaceChildren(el("p", "vacio", "Sin visitas registradas.")); return; }
  cont.replaceChildren(...filas.map(([lugar, n]) => {
    const f = el("div", "barra-fila");
    const cab = el("div", "barra-cab");
    cab.append(el("span", "", lugar), el("strong", "", fmt(n)));
    const pista = el("div", "barra-pista");
    const rel = el("div", "barra-rel");
    rel.style.width = `${(n / max) * 100}%`;
    pista.append(rel);
    f.append(cab, pista);
    return f;
  }));
}

function pintarDispositivos(disp, total) {
  const cont = $("est-disp");
  if (!total) { cont.replaceChildren(el("p", "vacio", "Sin visitas registradas.")); return; }
  cont.replaceChildren(...Object.entries(DISPOSITIVOS).map(([k, nombre]) => {
    const pct = Math.round((disp[k] / total) * 100);
    const f = el("div", "barra-fila");
    const cab = el("div", "barra-cab");
    cab.append(el("span", "", nombre), el("strong", "", `${pct} %`));
    const pista = el("div", "barra-pista");
    const rel = el("div", "barra-rel");
    rel.style.width = `${pct}%`;
    pista.append(rel);
    f.append(cab, pista);
    return f;
  }));
}

async function cargarEdicion(id) {
  seleccion = id;
  if (!id) return;
  $("est-detalle-msg").textContent = "Cargando…";
  try {
    const snap = await getDocs(query(collection(db, "visitas"), where("edicion", "==", id)));
    if (seleccion !== id) return;
    const g = agrupar(snap.docs.map((d) => d.data()));
    $("est-detalle-msg").textContent = `${fmt(g.total)} ${g.total === 1 ? "visita" : "visitas"} en total`;
    pintarLugares(g.lugares);
    pintarDispositivos(g.disp, g.total);
    await pintarGrafica(g.dias, g.porDia);
  } catch (e) {
    console.warn("Estadísticas de la edición:", e.code || e.message);
    $("est-detalle-msg").textContent = "No se pudieron cargar las estadísticas de esta edición.";
  }
}

async function cargarTodo() {
  if (cargando) return;
  cargando = true;
  $("est-msg").textContent = "Cargando…";
  $("est-actualizar").disabled = true;
  try {
    const ediciones = getEdiciones();
    const sel = $("est-ed");
    const previa = sel.value;
    sel.replaceChildren(...ediciones.map((e) => {
      const o = el("option", "", e.titulo);
      o.value = e.id;
      return o;
    }));
    if (ediciones.some((e) => e.id === previa)) sel.value = previa;
    await cargarResumen();
    $("est-msg").textContent = "";
    cargado = true;
    await cargarEdicion(sel.value);
  } catch (e) {
    console.warn("Estadísticas:", e.code || e.message);
    $("est-msg").textContent = "No se pudieron cargar las estadísticas. Revisa tu conexión.";
  } finally {
    cargando = false;
    $("est-actualizar").disabled = false;
  }
}

function leerNoContar() {
  try { return localStorage.getItem(NO_CONTAR) === "1"; } catch { return false; }
}

export function iniciarEstadisticas(opciones) {
  ({ db, getEdiciones, getPublicados } = opciones);
  $("est-contar").checked = !leerNoContar();
}

export function abrirEstadisticas() {
  if (!cargado) cargarTodo();
}

export function detenerEstadisticas() {
  cargado = false;
  seleccion = null;
  grafica?.destroy();
  grafica = null;
}

$("est-actualizar").addEventListener("click", cargarTodo);
$("est-ed").addEventListener("change", (e) => cargarEdicion(e.target.value));

$("est-pdf").addEventListener("click", () => {
  const id = $("est-ed").value;
  if (id) window.open(`reporte.html?ed=${encodeURIComponent(id)}`, "_blank");
});
$("est-contar").addEventListener("change", (e) => {
  try {
    if (e.target.checked) localStorage.removeItem(NO_CONTAR);
    else localStorage.setItem(NO_CONTAR, "1");
  } catch { /* sin almacenamiento */ }
});
