import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, ADMIN_UID } from "./firebase-config.js";
import { cargarReacciones, cargarTrivia, colorGrupo, REACC } from "./participacion-datos.js";

const HTML2PDF = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js";
const CHART = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm";
const C = {
  papel: "#FBF7EF", texto: "#2B2B2B", bosque: "#0D3B2B", verde: "#1B5E20", claro: "#4CAF50",
  tierra: "#6D4C41", tierraClara: "#D4A574", oro: "#E3B14A", gris: "#D9D4C7"
};
const ROLES = { "Alumno": "#4FB3D9", "Docente": "#E3B14A", "Padre o madre de familia": "#E07A5F" };
const DISP = [["movil", "Celular", "#4CAF50"], ["tablet", "Tableta", "#D4A574"], ["escritorio", "Computadora", "#6D4C41"]];
const GRUPOS = ["1A", "1B", "1C", "1D", "1E", "2A", "2B", "2C", "2D", "2E", "3A", "3B", "3C", "3D", "3E"];
const FONT = { family: "'Nunito Sans', sans-serif" };

const $ = (id) => document.getElementById(id);
const ed = new URLSearchParams(location.search).get("ed");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let edicion = null;
let reales = null;
let Chart = null;
let charts = [];
let pend = [];
let idGreca = 0;

// ---------- Utilidades ----------
function h(tag, cls, texto) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texto !== undefined) e.textContent = texto;
  return e;
}
const dia0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const masDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const clave = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const fmtFecha = (d) => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
const fmtCorta = (d) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const msg = (t) => { $("msg").textContent = t; };

// Greca escalonada sencilla; el SVG es un literal fijo, sin datos del usuario.
function greca(color, fondo) {
  const id = `gr${++idGreca}`;
  const d = h("div", "franja");
  d.innerHTML = `<svg class="greca" viewBox="0 0 816 14" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="${id}" width="28" height="14" patternUnits="userSpaceOnUse"><path d="M0 12V7h7V2h14v5h7v5" fill="none" stroke="${color}" stroke-width="2"/></pattern></defs><rect width="816" height="14" fill="${fondo}"/><rect width="816" height="14" fill="url(#${id})"/></svg>`;
  return d;
}

function cargarScript(url) {
  return new Promise((ok, fallo) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = ok;
    s.onerror = () => fallo(new Error("No se pudo cargar html2pdf"));
    document.head.append(s);
  });
}

const esperarFrames = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));

// ---------- Datos ----------
const aFecha = (v) => (v?.toDate ? v.toDate() : null);

async function cargarReales() {
  const [v, c, reacc, trivia] = await Promise.all([
    getDocs(query(collection(db, "visitas"), where("edicion", "==", ed))),
    getDocs(query(collection(db, "comentarios"), where("edicion", "==", ed), where("aprobado", "==", true))),
    cargarReacciones(db, ed).catch(() => ({ articulos: [] })),
    cargarTrivia(db, ed).catch(() => null)
  ]);
  return {
    visitas: v.docs.map((d) => ({ ...d.data(), fecha: aFecha(d.data().fecha) })),
    comentarios: c.docs.map((d) => ({ ...d.data(), fecha: aFecha(d.data().fecha) })),
    reacciones: reacc.articulos,
    trivia
  };
}

function datosEjemplo() {
  let s = 7;
  const azar = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const hoy = dia0(new Date());
  const porDia = [4, 6, 15, 30, 21, 13, 8, 6, 5, 7, 11, 9, 8, 7];
  const lugares = [
    ["Cancún", "Quintana Roo", 30], ["Playa del Carmen", "Quintana Roo", 20], ["Chetumal", "Quintana Roo", 16],
    ["Cozumel", "Quintana Roo", 10], ["Tulum", "Quintana Roo", 8], ["Mérida", "Yucatán", 9], ["Valladolid", "Yucatán", 4], ["Progreso", "Yucatán", 3]
  ];
  const pesoTotal = lugares.reduce((a, l) => a + l[2], 0);
  const elegirLugar = () => { let r = azar() * pesoTotal; for (const l of lugares) { r -= l[2]; if (r <= 0) return l; } return lugares[0]; };
  const visitas = [];
  porDia.forEach((n, i) => {
    for (let k = 0; k < n; k++) {
      const l = elegirLugar();
      const r = azar();
      visitas.push({
        fecha: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (13 - i), 8 + Math.floor(azar() * 14), Math.floor(azar() * 60)),
        ciudad: l[0], region: l[1], pais: "México",
        dispositivo: r < 0.85 ? "movil" : r < 0.92 ? "tablet" : "escritorio"
      });
    }
  });
  const base = [
    ["Alumno", "1A", "Valeria", "Me encantó la portada, los dibujos están muy bonitos."],
    ["Alumno", "1C", "Mateo", "El poema de la página 5 me hizo pensar en mi abuela."],
    ["Alumno", "2B", "Camila", "Qué orgullo ver el trabajo de mi grupo publicado."],
    ["Alumno", "2B", "Diego", "Las fotos del taller de cerámica quedaron geniales."],
    ["Alumno", "2C", "Ximena", "Aprendí palabras nuevas en maya gracias a la sección cultural."],
    ["Alumno", "3A", "Santiago", "Muy buena entrevista al director, quiero leer más."],
    ["Alumno", "3A", "Regina", "Mi cuento favorito fue el de la ceiba."],
    ["Alumno", "3D", "Emiliano", "Felicidades a todo el equipo editorial."],
    ["Alumno", "3E", "Fernanda", "Me gustaría participar en la próxima edición."],
    ["Alumno", "1E", "Ian", "Los juegos de la última página estuvieron divertidos."],
    ["Alumno", "2E", "Renata", "Gracias por incluir la receta de la abuela de mi grupo."],
    ["Alumno", "3C", "Axel", "El diseño se ve increíble en el celular."],
    ["Docente", "", "Profa. Lucía", "Un trabajo colectivo que refleja el esfuerzo de nuestros estudiantes."],
    ["Docente", "", "Prof. Alberto", "Excelente iniciativa para fortalecer la lectura y la escritura."],
    ["Docente", "", "Profa. Marisol", "Gracias a quienes colaboraron con sus textos e ilustraciones."],
    ["Padre o madre de familia", "", "Rosa", "Nos llena de orgullo ver a nuestros hijos publicando."],
    ["Padre o madre de familia", "", "Jorge", "La compartí con toda la familia, quedó muy bonita."],
    ["Padre o madre de familia", "", "Elena", "Qué bueno que tengan un espacio para expresarse."],
    ["Padre o madre de familia", "", "Mario", "Muy buen formato, se lee fácil desde el celular."],
    ["Padre o madre de familia", "", "Patricia", "Felicidades a los maestros por impulsar este proyecto."]
  ];
  const comentarios = base.map(([rol, grupo, nombre, texto], i) => {
    const c = { rol, nombre, texto, fecha: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (i % 12), 10 + (i % 8), 5 * i) };
    if (grupo) c.grupo = grupo;
    return c;
  });
  return {
    visitas,
    comentarios,
    reacciones: [
      ["Así funciona un robot", "Tecnología", 18, 12, 7, 15], ["Leyendas de la ceiba", "Lenguajes", 14, 6, 17, 4],
      ["Mapa de nuestra comunidad", "Geografía", 9, 8, 5, 10], ["Fracciones en la cocina", "Matemáticas", 7, 3, 2, 11],
      ["Palabras mayas del día", "Lenguajes", 6, 2, 8, 5], ["Reglas de convivencia", "Prefectura", 1, 0, 1, 0]
    ].map(([titulo, seccion, a, w, c, i]) => ({ titulo, seccion, aplauso: a, wow: w, corazon: c, idea: i, total: a + w + c + i })),
    trivia: {
      preguntas: [0, 1, 2, 3, 4],
      total: 142,
      promedio: 3.8,
      ranking: [["2B", 48, 12], ["1A", 42, 11], ["3C", 39, 10], ["3A", 36, 10], ["1C", 33, 9], ["2E", 31, 9], ["1E", 29, 8], ["3D", 28, 8], ["2A", 27, 8], ["1B", 26, 7], ["3E", 24, 7], ["2C", 22, 7], ["1D", 21, 6], ["3B", 20, 6], ["2D", 18, 6]]
        .map(([grupo, puntos, participantes]) => ({ grupo, puntos, participantes })),
      dificultad: [
        { texto: "¿Qué sensor usa el robot para evitar obstáculos?", seccion: "Tecnología", pct: 82 },
        { texto: "¿Qué representa la ceiba para el pueblo maya?", seccion: "Lenguajes", pct: 91 },
        { texto: "¿En qué municipio está nuestra escuela?", seccion: "Geografía", pct: 74 },
        { texto: "¿Cuánto es 3/4 de una taza si usas la mitad?", seccion: "Matemáticas", pct: 38 },
        { texto: "¿Qué significa «ka’an» en maya?", seccion: "Lenguajes", pct: 65 }
      ]
    }
  };
}

// ---------- Componentes ----------
function tarjetaSec(titulo, color, extra) {
  const s = h("section", "sec");
  s.style.setProperty("--color", color);
  const t = h("h2", "", titulo);
  if (extra) t.append(h("small", "", extra));
  const cuerpo = h("div", "cuerpo");
  s.append(t, cuerpo);
  return { s, cuerpo };
}

function vacio(icono, texto) {
  const v = h("div", "vacio");
  v.append(h("i", "", icono), h("span", "", texto));
  return v;
}

function lienzo(w, hh) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = hh;
  c.style.width = `${w}px`;
  c.style.height = `${hh}px`;
  return c;
}

function dona(etiquetas, datos, colores) {
  const c = lienzo(200, 200);
  pend.push(() => charts.push(new Chart(c, {
    type: "doughnut",
    data: { labels: etiquetas, datasets: [{ data: datos, backgroundColor: colores, borderWidth: 3, borderColor: "#fff" }] },
    options: { animation: false, responsive: false, devicePixelRatio: 2, cutout: "58%", plugins: { legend: { display: false }, tooltip: { enabled: false } } }
  })));
  return c;
}

function leyenda(items) {
  const l = h("div", "ley");
  for (const [nombre, color, valor] of items) {
    const f = h("div");
    const i = h("i");
    i.style.background = color;
    f.append(i, document.createTextNode(nombre), h("b", "", valor));
    l.append(f);
  }
  return l;
}

function pie(n, ahora) {
  const p = h("div", "pie");
  p.append(greca(C.tierra, C.papel));
  const t = h("div", "texto");
  t.append(
    h("span", "", `Reporte generado el ${ahora.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })} · Voces del Corazón Maya`),
    h("span", "", `Página ${n} de 3`)
  );
  p.append(t);
  return p;
}

function marca() {
  const m = h("div", "marca");
  m.append(h("span", "", "DATOS DE EJEMPLO"));
  return m;
}

// ---------- Hojas ----------
function estadisticas(d, hoy) {
  const fechas = d.visitas.map((v) => v.fecha).filter(Boolean).sort((a, b) => a - b);
  const porDia = new Map();
  for (const f of fechas) porDia.set(clave(f), (porDia.get(clave(f)) || 0) + 1);
  const total = d.visitas.length;
  const movil = d.visitas.filter((v) => v.dispositivo === "movil").length;
  return { total, fechas, porDia, dias: porDia.size, pctMovil: total ? Math.round((movil / total) * 100) : 0, primera: fechas[0] || null, hoy };
}

function hoja1(d, st, ejemplo) {
  const hoja = h("section", "hoja");

  const cab = h("div", "cab");
  const img = h("img");
  img.alt = "";
  img.src = `ediciones/${encodeURIComponent(edicion.id)}/paginas/p001-m.${edicion.ext || "webp"}`;
  const txt = h("div", "txt");
  txt.append(
    h("h1", "", edicion.titulo),
    h("p", "", "Escuela Secundaria Técnica #26 \"José María Luis Mora\""),
    h("p", "", edicion.fecha || ""),
    h("p", "", `Periodo: ${st.primera ? fmtFecha(st.primera) : "sin visitas aún"} – ${fmtFecha(st.hoy)}`)
  );
  cab.append(img, txt, greca(C.oro, C.bosque));

  const tarjetas = h("div", "tarjetas");
  const num = (valor, etiqueta, fondo, color = "#fff") => {
    const t = h("div", "num");
    t.style.background = fondo;
    t.style.color = color;
    t.append(h("strong", "", String(valor)), h("span", "", etiqueta));
    return t;
  };
  tarjetas.append(
    num(st.total, "Visitas totales", C.bosque),
    num(st.dias, "Días con visitas", C.verde),
    num(d.comentarios.length, "Comentarios publicados", C.tierra),
    num(`${st.pctMovil} %`, "Desde celular", C.claro, C.bosque)
  );

  let extra = "";
  let ventana = null;
  if (st.primera) {
    const fin = dia0(st.hoy);
    let ini = masDias(dia0(st.primera), -7);
    const largo = Math.round((fin - ini) / 86400000) + 1;
    if (largo > 30) ini = masDias(fin, -29);
    else if (largo < 14) ini = masDias(fin, -13);
    const dias = [];
    for (let x = ini; x <= fin; x = masDias(x, 1)) dias.push(x);
    const vals = dias.map((x) => st.porDia.get(clave(x)) || 0);
    const max = Math.max(...vals);
    const idx = vals.indexOf(max);
    ventana = { dias, vals, idx };
    if (max > 0) extra = `Día con más visitas: ${fmtCorta(dias[idx])} (${max})`;
  }
  const g = tarjetaSec("Visitas por día", C.verde, extra);
  if (!ventana || !st.total) {
    g.cuerpo.style.height = "320px";
    g.cuerpo.append(vacio("📊", "Aún no hay visitas registradas para esta edición."));
  } else {
    const c = lienzo(688, 320);
    g.cuerpo.append(c);
    pend.push(() => charts.push(new Chart(c, {
      type: "bar",
      data: {
        labels: ventana.dias.map(fmtCorta),
        datasets: [{ data: ventana.vals, backgroundColor: ventana.vals.map((_, i) => (i === ventana.idx ? C.oro : C.verde)), maxBarThickness: 28, borderRadius: 6 }]
      },
      options: {
        animation: false, responsive: false, devicePixelRatio: 2,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { ticks: { color: C.texto, font: FONT, maxRotation: 0, autoSkip: true, maxTicksLimit: 15 }, grid: { display: false } },
          y: { beginAtZero: true, suggestedMax: 5, ticks: { color: C.texto, font: FONT, precision: 0 }, grid: { color: "rgba(43, 43, 43, .12)" } }
        }
      }
    })));
  }

  const r = tarjetaSec("Resumen", C.oro);
  r.s.classList.add("resumen");
  r.cuerpo.style.justifyContent = "center";
  r.cuerpo.append(h("p", "", st.total
    ? `La edición recibió ${plural(st.total, "visita", "visitas")} en ${plural(st.dias, "día", "días")}; el ${st.pctMovil} % fue desde celular.`
    : "Cuando la edición reciba visitas, aquí aparecerá un resumen automático."));

  hoja.append(cab, tarjetas, g.s, r.s, pie(1, st.hoy));
  if (ejemplo) hoja.append(marca());
  return hoja;
}

function hoja2(d, st, ejemplo) {
  const hoja = h("section", "hoja");
  const rejilla = h("div", "rejilla");

  const L = tarjetaSec("Lugares", C.verde, "Top 8");
  if (!st.total) L.cuerpo.append(vacio("📍", "Aún no hay visitas registradas"));
  else {
    const m = new Map();
    for (const v of d.visitas) {
      const partes = [v.ciudad, v.region].filter((p, i, a) => p && p !== "Desconocido" && a.indexOf(p) === i);
      const k = partes.length ? partes.join(", ") : "Desconocido";
      m.set(k, (m.get(k) || 0) + 1);
    }
    const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const paleta = [C.verde, C.tierraClara, C.claro, C.tierra];
    top.forEach(([lugar, n], i) => {
      const f = h("div", "fila-l");
      const b = h("div", "b");
      const rel = h("div");
      rel.style.width = `${(n / top[0][1]) * 100}%`;
      rel.style.background = paleta[i % paleta.length];
      b.append(rel);
      f.append(h("span", "n", lugar), b, h("span", "v", String(n)));
      L.cuerpo.append(f);
    });
    L.cuerpo.append(h("p", "nota", "Ubicación aproximada según la conexión a internet"));
  }

  const D = tarjetaSec("Dispositivos", C.claro);
  if (!st.total) D.cuerpo.append(vacio("📱", "Aún no hay visitas registradas"));
  else {
    const cuentas = DISP.map(([k]) => d.visitas.filter((v) => v.dispositivo === k).length);
    const f = h("div", "dona");
    f.append(dona(DISP.map((x) => x[1]), cuentas, DISP.map((x) => x[2])),
      leyenda(DISP.map(([, n, col], i) => [n, col, `${Math.round((cuentas[i] / st.total) * 100)} %`])));
    D.cuerpo.append(f);
  }

  const R = tarjetaSec("Comentarios por rol", C.tierraClara);
  if (!d.comentarios.length) R.cuerpo.append(vacio("💬", "Aún no hay comentarios"));
  else {
    const m = new Map();
    for (const c of d.comentarios) m.set(c.rol, (m.get(c.rol) || 0) + 1);
    const items = [...m.entries()];
    const colores = items.map(([rol]) => ROLES[rol] || "#9AA5A0");
    const f = h("div", "dona");
    f.append(dona(items.map((i) => i[0]), items.map((i) => i[1]), colores),
      leyenda(items.map(([rol, n], i) => [rol === "Padre o madre de familia" ? "Padres" : rol, colores[i], String(n)])));
    R.cuerpo.append(f);
  }

  const G = tarjetaSec("Alumnos por grupo", ROLES.Alumno);
  const alumnos = d.comentarios.filter((c) => c.rol === "Alumno" && c.grupo);
  if (!alumnos.length) G.cuerpo.append(vacio("🎓", "Aún no hay comentarios de alumnos"));
  else {
    const cuenta = Object.fromEntries(GRUPOS.map((x) => [x, 0]));
    for (const c of alumnos) if (c.grupo in cuenta) cuenta[c.grupo]++;
    const max = Math.max(1, ...Object.values(cuenta));
    const barras = h("div", "grupos");
    for (const x of GRUPOS) {
      const col = h("div", "g");
      const b = h("div");
      b.style.height = `${Math.max(4, (cuenta[x] / max) * 140)}px`;
      b.style.background = cuenta[x] ? ROLES.Alumno : C.gris;
      col.append(h("b", "", String(cuenta[x])), b, h("span", "", x));
      barras.append(col);
    }
    G.cuerpo.append(barras);
  }

  const K = tarjetaSec("Comentarios destacados", C.oro);
  K.s.classList.add("ancho");
  if (!d.comentarios.length) K.cuerpo.append(vacio("✨", "Aún no hay comentarios publicados"));
  else {
    const lista = h("div", "coms");
    const recientes = [...d.comentarios].sort((a, b) => (b.fecha?.getTime?.() || 0) - (a.fecha?.getTime?.() || 0)).slice(0, 3);
    for (const c of recientes) {
      const t = h("div", "com");
      t.style.borderLeftColor = ROLES[c.rol] || "#9AA5A0";
      const cuerpo = c.texto.length > 150 ? `${c.texto.slice(0, 147)}…` : c.texto;
      const rol = c.rol === "Alumno" && c.grupo ? `Alumno · ${c.grupo}` : c.rol;
      t.append(h("p", "", `“${cuerpo}”`), h("small", "", `— ${c.nombre} · ${rol}`));
      lista.append(t);
    }
    K.cuerpo.append(lista);
  }

  rejilla.append(L.s, D.s, R.s, G.s, K.s);
  hoja.append(rejilla, pie(2, st.hoy));
  if (ejemplo) hoja.append(marca());
  return hoja;
}

function hoja3(d, st, ejemplo) {
  const hoja = h("section", "hoja");
  const cab = h("div", "cab3");
  const tx = h("div");
  tx.append(h("h1", "", "Participación"), h("p", "", `${edicion.titulo} · reacciones y trivia`));
  cab.append(tx, greca(C.oro, C.bosque));

  const arts = (d.reacciones || []).filter((a) => a.total > 0).sort((a, b) => b.total - a.total);
  const totalReac = (d.reacciones || []).reduce((s, a) => s + a.total, 0);
  const t = d.trivia && d.trivia.total > 0 ? d.trivia : null;
  const mini = h("div", "tarjetas tres");
  const num = (valor, etiqueta, fondo, color = "#fff") => {
    const n = h("div", "num"); n.style.background = fondo; n.style.color = color;
    n.append(h("strong", "", String(valor)), h("span", "", etiqueta)); return n;
  };
  mini.append(
    num(totalReac, "Reacciones", C.bosque),
    num(t ? t.total : 0, "Participantes de la trivia", C.verde),
    num(t ? `${t.promedio.toFixed(1)} de ${t.preguntas.length}` : "—", "Promedio de aciertos", C.claro, C.bosque)
  );

  const R = tarjetaSec("Artículos más reaccionados", C.claro, "Top 5");
  R.s.style.height = "236px";
  if (!arts.length) R.cuerpo.append(vacio("👏", "Aún no hay reacciones. ¡Pronto llegarán los primeros aplausos!"));
  else {
    const top = arts.slice(0, 5);
    const max = top[0].total;
    top.forEach((a, i) => {
      const f = h("div", "r3");
      const nombre = h("div", "n");
      nombre.append(h("span", "t", a.titulo));
      if (i === 0) nombre.append(h("em", "", "⭐ Favorito de los lectores"));
      const pista = h("div", "p");
      const barra = h("div", "s"); barra.style.width = `${(a.total / max) * 100}%`;
      REACC.forEach(([k, , color]) => {
        if (!a[k]) return;
        const seg = h("div"); seg.style.flex = String(a[k]); seg.style.background = color; barra.append(seg);
      });
      pista.append(barra);
      f.append(nombre, pista, h("b", "", String(a.total)));
      R.cuerpo.append(f);
    });
    const ley = h("div", "ley3");
    REACC.forEach(([, e, color]) => { const s = h("span", "", ` ${e}`); const i = h("i"); i.style.background = color; s.prepend(i); ley.append(s); });
    R.cuerpo.append(ley);
  }

  const T = tarjetaSec("Trivia", C.oro, "Ranking por grupo");
  T.s.style.height = "268px";
  if (!t) T.cuerpo.append(vacio("🏆", "Aún no hay participación en la trivia de esta edición. ¡Pronto habrá resultados!"));
  else {
    const g3 = h("div", "tr3");
    const top = t.ranking.filter((f) => f.participantes > 0).slice(0, 3);
    const podio = h("div", "podio3");
    [1, 0, 2].filter((i) => top[i]).forEach((i) => {
      const f = top[i];
      const e = h("div", "e");
      const bloque = h("div", "b"); bloque.style.height = `${[96, 70, 50][i]}px`; bloque.style.background = colorGrupo(f.grupo);
      bloque.textContent = String(i + 1);
      e.append(h("span", "m", ["🥇", "🥈", "🥉"][i]), h("strong", "", f.grupo), h("small", "", `${f.puntos} pts`), bloque);
      podio.append(e);
    });
    const maxP = Math.max(1, ...t.ranking.map((f) => f.puntos));
    const barras = h("div", "grupos g3");
    [...t.ranking].sort((a, b) => a.grupo.localeCompare(b.grupo)).forEach((f) => {
      const col = h("div", "g"); const b = h("div");
      b.style.height = `${Math.max(3, (f.puntos / maxP) * 130)}px`; b.style.background = f.puntos ? colorGrupo(f.grupo) : C.gris;
      col.append(h("b", "", String(f.puntos)), b, h("span", "", f.grupo)); barras.append(col);
    });
    g3.append(podio, barras);
    T.cuerpo.append(g3);
  }

  const Q = tarjetaSec("Dificultad de las preguntas", C.tierraClara, "% de acierto");
  Q.s.style.flex = "1"; Q.s.style.minHeight = "0";
  if (!t || !t.dificultad.length) Q.cuerpo.append(vacio("🧩", t ? "Sin datos por pregunta todavía" : "Cuando haya participantes, aquí verás qué preguntas fueron más difíciles."));
  else {
    const min = Math.min(...t.dificultad.map((x) => x.pct));
    const max = Math.max(...t.dificultad.map((x) => x.pct));
    t.dificultad.forEach((x, i) => {
      const f = h("div", "q3");
      const b = h("div", "b"); const r = h("div"); r.style.width = `${x.pct}%`;
      r.style.background = min !== max && x.pct === min ? "#E07A5F" : min !== max && x.pct === max ? "#4CAF50" : C.tierraClara;
      b.append(r);
      f.append(h("span", "n", `${i + 1}. ${x.texto}`), b, h("span", "v", `${x.pct} %`));
      Q.cuerpo.append(f);
    });
    const dificil = t.dificultad.reduce((a, x) => (x.pct < a.pct ? x : a));
    const facil = t.dificultad.reduce((a, x) => (x.pct > a.pct ? x : a));
    const quien = (x) => (x.seccion ? `la de ${x.seccion}` : `la ${t.dificultad.indexOf(x) + 1}`);
    if (dificil !== facil) Q.cuerpo.append(h("p", "frase3", `La pregunta más difícil fue ${quien(dificil)}: solo el ${dificil.pct} % acertó. La más fácil fue ${quien(facil)}: el ${facil.pct} % acertó.`));
  }

  hoja.append(cab, mini, R.s, T.s, Q.s, pie(3, st.hoy));
  if (ejemplo) hoja.append(marca());
  return hoja;
}

function pintar() {
  charts.forEach((c) => c.destroy());
  charts = [];
  pend = [];
  const ejemplo = $("ejemplo").checked;
  const d = ejemplo ? datosEjemplo() : reales;
  const st = estadisticas(d, new Date());
  $("hojas").replaceChildren(hoja1(d, st, ejemplo), hoja2(d, st, ejemplo), hoja3(d, st, ejemplo));
  pend.forEach((f) => f());
  ajustarEscala();
}

// En pantallas angostas se reduce la vista; el PDF siempre sale a 816 px.
function ajustarEscala() {
  const k = Math.min(1, (innerWidth - 16) / 816);
  const esc = $("escala");
  esc.style.transform = k < 1 ? `scale(${k})` : "";
  esc.style.marginLeft = `${Math.max(8, (innerWidth - 816 * k) / 2)}px`;
  $("vista").style.height = `${esc.offsetHeight * k + 56}px`;
}
addEventListener("resize", ajustarEscala);

// ---------- PDF ----------
async function descargar() {
  const btn = $("descargar");
  const cont = $("hojas");
  btn.disabled = true;
  btn.textContent = "Generando…";
  msg("");
  try {
    if (!window.html2pdf) await cargarScript(HTML2PDF);
    window.scrollTo(0, 0);
    cont.classList.add("pdf");
    await document.fonts.ready;
    await Promise.all([...cont.querySelectorAll("img")].map((i) => (i.complete ? null : new Promise((ok) => { i.onload = ok; i.onerror = ok; }))));
    await esperarFrames();
    const nombre = $("ejemplo").checked ? "Reporte-EJEMPLO.pdf" : `Reporte-${edicion.id}.pdf`;
    await window.html2pdf().set({
      margin: 0,
      filename: nombre,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, scrollX: 0, scrollY: 0, windowWidth: 816, useCORS: true, backgroundColor: C.papel },
      jsPDF: { unit: "px", format: [816, 1056], orientation: "portrait", hotfixes: ["px_scaling"] },
      pagebreak: { mode: ["css"], before: ".hoja + .hoja" }
    }).from(cont).save();
  } catch (e) {
    console.warn("Reporte PDF:", e.message);
    msg("No se pudo generar el PDF. Inténtalo de nuevo.");
  } finally {
    cont.classList.remove("pdf");
    btn.disabled = false;
    btn.textContent = "Descargar PDF";
  }
}

// ---------- Inicio ----------
async function iniciar() {
  try {
    if (!ed || !/^[\w.-]+$/.test(ed)) throw new Error("Edición no especificada");
    const lista = await (await fetch("ediciones/ediciones.json", { cache: "no-store" })).json();
    edicion = lista.find((e) => e.id === ed);
    if (!edicion) throw new Error("No se encontró la edición");
    const m = await import(CHART);
    m.Chart.register(...m.registerables);
    Chart = m.Chart;
    reales = await cargarReales();
    await Promise.all(["700 20px Cinzel", "400 12px 'Nunito Sans'", "700 12px 'Nunito Sans'"].map((f) => document.fonts.load(f).catch(() => {})));
    await document.fonts.ready;
    pintar();
    $("descargar").disabled = false;
  } catch (e) {
    console.warn("Reporte:", e.code || e.message);
    msg(e.message === "Edición no especificada" || e.message === "No se encontró la edición" ? e.message : "No se pudieron cargar los datos del reporte.");
  }
}

$("ejemplo").addEventListener("change", () => { if (edicion && reales) pintar(); });
$("descargar").addEventListener("click", descargar);

onAuthStateChanged(auth, (user) => {
  if (!user || user.uid !== ADMIN_UID) { location.replace("admin.html"); return; }
  iniciar();
});
