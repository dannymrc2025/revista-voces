import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getAggregateFromServer, query, where, sum, count,
  writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig, "visor-trivia");
const db = getFirestore(app);
const GRUPOS = ["1A", "1B", "1C", "1D", "1E", "2A", "2B", "2C", "2D", "2E", "3A", "3B", "3C", "3D", "3E"];
const COLORES = ["#4CAF50", "#4FB3D9", "#E3B14A"];
const ROLES = ["Alumno", "Docente", "Padre o madre de familia"];
const $ = (id) => document.getElementById(id);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const clavePartida = (ed) => `voces-trivia-partida-${ed}`;
const claveRanking = (ed) => `voces-trivia-ranking-${ed}`;
let edicion = "";
let preguntas = [];
let articulos = [];
let indice = 0;
let respuestas = [];
let aciertos = 0;
let identidad = null;
let sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;

function guardarLocal(clave, valor) { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* almacenamiento no disponible */ } }
function leerLocal(clave) { try { return JSON.parse(localStorage.getItem(clave) || "null"); } catch { return null; } }
function gruposPorGrado() {
  const salida = [];
  for (let grado = 1; grado <= 3; grado++) {
    const grupo = document.createElement("optgroup");
    grupo.label = ["1.er grado", "2.º grado", "3.er grado"][grado - 1];
    for (const g of GRUPOS.filter((x) => x.startsWith(String(grado)))) { const o = h("option", "", g); grupo.append(o); }
    salida.push(grupo);
  }
  return salida;
}

async function ranking() {
  const guardado = leerLocal(claveRanking(edicion));
  if (guardado && Date.now() - guardado.t < 600000 && Array.isArray(guardado.filas)) return guardado.filas;
  const filas = await Promise.all(GRUPOS.map(async (grupo) => {
    const q = query(collection(db, "trivia_resultados"), where("edicion", "==", edicion), where("grupo", "==", grupo));
    const r = await getAggregateFromServer(q, { puntos: sum("aciertos"), participantes: count() });
    const d = r.data();
    return { grupo, puntos: d.puntos || 0, participantes: d.participantes || 0 };
  }));
  filas.sort((a, b) => b.puntos - a.puntos || (b.participantes ? b.puntos / b.participantes : 0) - (a.participantes ? a.puntos / a.participantes : 0) || a.grupo.localeCompare(b.grupo));
  guardarLocal(claveRanking(edicion), { t: Date.now(), filas });
  return filas;
}

function pintarRanking(host, filas) {
  host.replaceChildren();
  const top = filas.filter((f) => f.participantes > 0).slice(0, 3);
  const podio = h("div", "trivia-podio");
  const medallas = ["🥇", "🥈", "🥉"];
  top.forEach((f, i) => {
    const item = h("div", "trivia-podio-item");
    item.style.setProperty("--grado", COLORES[Number(f.grupo[0]) - 1]);
    item.append(h("span", "trivia-medalla", medallas[i]), h("strong", "", f.grupo), h("span", "", `${f.puntos} puntos`));
    podio.append(item);
  });
  if (!top.length) podio.append(h("p", "", "Aún no hay participantes."));
  const tabla = document.createElement("table");
  tabla.className = "trivia-tabla";
  const head = document.createElement("thead");
  const trh = document.createElement("tr");
  ["Grupo", "Puntos", "Participantes", "Promedio"].forEach((t) => trh.append(h("th", "", t)));
  head.append(trh);
  const body = document.createElement("tbody");
  for (const f of filas) {
    const tr = document.createElement("tr");
    tr.style.setProperty("--grado", COLORES[Number(f.grupo[0]) - 1]);
    tr.append(h("td", "", f.grupo), h("td", "", String(f.puntos)), h("td", "", String(f.participantes)), h("td", "", f.participantes ? (f.puntos / f.participantes).toFixed(1) : "—"));
    body.append(tr);
  }
  tabla.append(head, body);
  host.append(podio, tabla);
}

function mostrarRanking() {
  const zona = $("trivia-ranking");
  zona.hidden = false;
  zona.replaceChildren(h("p", "", "Cargando ranking…"));
  ranking().then((filas) => pintarRanking(zona, filas)).catch((e) => {
    console.warn("Ranking de trivia:", e.code || e.message);
    zona.replaceChildren(h("p", "", "No se pudo cargar el ranking. Inténtalo de nuevo."));
  });
}

function pantallaInicio(previo) {
  const panel = $("trivia-pantalla");
  panel.replaceChildren();
  panel.append(h("h2", "", "Trivia de Voces del Corazón Maya"), h("p", "trivia-sub", `${preguntas.length} preguntas`));
  if (previo) {
    panel.append(h("p", "trivia-aviso", `Ya jugaste esta edición: ${previo.aciertos} de ${previo.total} aciertos.`));
    const ver = h("button", "btn primario", "Ver resultado y ranking");
    ver.type = "button";
    ver.addEventListener("click", () => { mostrarResultado(previo, false); mostrarRanking(); });
    panel.append(ver);
    return;
  }
  const form = document.createElement("form");
  form.className = "trivia-form";
  const nombreLabel = h("label", "", "Nombre");
  const nombre = document.createElement("input");
  nombre.type = "text"; nombre.minLength = 2; nombre.maxLength = 40; nombre.required = true; nombre.autocomplete = "given-name";
  nombreLabel.append(nombre);
  const rolLabel = h("label", "", "Soy:");
  const rol = document.createElement("select");
  ROLES.forEach((r) => { const o = h("option", "", r); o.value = r; rol.append(o); });
  rolLabel.append(rol);
  const grupoLabel = h("label", "trivia-grupo", "Grupo");
  const grupo = document.createElement("select");
  grupo.required = true; grupo.append(h("option", "", "Elige tu grupo")); grupo.options[0].value = ""; grupo.append(...gruposPorGrado());
  grupoLabel.append(grupo);
  const ayuda = h("p", "trivia-ayuda", "Docentes y padres juegan fuera de concurso.");
  const iniciar = h("button", "btn primario", "Comenzar"); iniciar.type = "submit";
  rol.addEventListener("change", () => { grupoLabel.hidden = rol.value !== "Alumno"; grupo.required = rol.value === "Alumno"; });
  grupoLabel.hidden = false;
  form.append(nombreLabel, rolLabel, grupoLabel, ayuda, iniciar);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    identidad = { nombre: nombre.value.trim(), rol: rol.value, grupo: rol.value === "Alumno" ? grupo.value : "" };
    respuestas = []; aciertos = 0; indice = 0;
    mostrarPregunta();
  });
  panel.append(form);
}

function mostrarPregunta() {
  const panel = $("trivia-pantalla");
  const p = preguntas[indice];
  panel.replaceChildren();
  const cab = h("div", "trivia-progreso-cab");
  cab.append(h("span", "", `Pregunta ${indice + 1} de ${preguntas.length}`));
  const barra = document.createElement("progress"); barra.max = preguntas.length; barra.value = indice + 1;
  panel.append(cab, barra, h("h2", "trivia-pregunta", p.texto));
  const opciones = h("div", "trivia-opciones");
  p.opciones.forEach((texto, i) => {
    const b = h("button", "trivia-opcion", texto); b.type = "button";
    b.addEventListener("click", () => responder(i, opciones, p));
    opciones.append(b);
  });
  panel.append(opciones);
}

function responder(elegida, opciones, pregunta) {
  if (respuestas.length > indice) return;
  const correcta = elegida === pregunta.correcta;
  respuestas.push(elegida);
  if (correcta) aciertos++;
  [...opciones.children].forEach((b, i) => {
    b.disabled = true;
    if (i === pregunta.correcta) b.classList.add("correcta");
    else if (i === elegida) b.classList.add("incorrecta");
  });
  const panel = $("trivia-pantalla");
  if (!correcta && pregunta.articuloId) {
    const articulo = articulos.find((a) => a.id === pregunta.articuloId);
    if (articulo) {
      const recomendacion = h("div", "trivia-lee");
      recomendacion.append(h("p", "", `Lee: ${articulo.titulo}, pág. ${articulo.inicio}`));
      const ir = h("button", "btn", "Ir a esa página después"); ir.type = "button";
      ir.addEventListener("click", () => {
        cerrar();
        window.vocesIrAPagina?.(articulo.inicio - 1);
      });
      recomendacion.append(ir); panel.append(recomendacion);
    }
  }
  const siguiente = h("button", "btn primario trivia-siguiente", indice + 1 === preguntas.length ? "Ver resultado" : "Siguiente"); siguiente.type = "button";
  siguiente.addEventListener("click", () => { indice++; if (indice < preguntas.length) mostrarPregunta(); else terminar(); });
  panel.append(siguiente);
}

async function terminar() {
  const r = { aciertos, total: preguntas.length, grupo: identidad.grupo, nombre: identidad.nombre, rol: identidad.rol };
  let id = "";
  if (identidad.rol === "Alumno") {
    id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const guardar = (conRespuestas) => {
      const batch = writeBatch(db);
      const fecha = serverTimestamp();
      const nombres = { edicion, nombre: identidad.nombre, grupo: identidad.grupo, aciertos, fecha };
      if (conRespuestas) nombres.respuestas = [...respuestas];
      batch.set(doc(db, "trivia_resultados", id), { edicion, grupo: identidad.grupo, aciertos, total: preguntas.length, fecha });
      batch.set(doc(db, "trivia_nombres", id), nombres);
      return batch.commit();
    };
    try {
      await guardar(true);
    } catch (e) {
      // Compatibilidad con reglas anteriores que no admiten "respuestas".
      console.warn("Guardado con respuestas rechazado:", e.code || e.message);
      try { await guardar(false); } catch (e2) {
        console.warn("No se guardó el resultado:", e2.code || e2.message);
        $("trivia-pantalla").replaceChildren(h("p", "", "No se pudo guardar tu resultado. Revisa tu conexión e inténtalo de nuevo."));
        return;
      }
    }
  }
  guardarLocal(clavePartida(edicion), r);
  mostrarResultado(r, true);
  mostrarRanking();
}

function confeti(host) {
  if (sinMovimiento) return;
  const caja = h("div", "trivia-confeti");
  for (let i = 0; i < 36; i++) {
    const pieza = h("i");
    pieza.style.setProperty("--x", `${Math.random() * 100}%`);
    pieza.style.setProperty("--delay", `${Math.random() * .8}s`);
    pieza.style.setProperty("--color", ["#4CAF50", "#4FB3D9", "#E3B14A", "#E07A5F"][i % 4]);
    caja.append(pieza);
  }
  host.append(caja);
  setTimeout(() => caja.remove(), 2600);
}

function mostrarResultado(r, confetiSi) {
  const pct = r.total ? r.aciertos / r.total : 0;
  const panel = $("trivia-pantalla");
  panel.replaceChildren(h("h2", "", "¡Terminaste!"), h("p", "trivia-puntaje", `${r.aciertos} de ${r.total} aciertos`));
  const mensajes = pct >= .9 ? "¡Excelente! Dominas esta edición." : pct >= .8 ? "¡Muy bien! Sigue leyendo y aprendiendo." : pct >= .5 ? "¡Buen esfuerzo! Algunos artículos te esperan." : "¡Sigue explorando la revista y vuelve a leerla!";
  panel.append(h("p", "", mensajes));
  const rankingBtn = h("button", "btn primario", "Ver ranking"); rankingBtn.type = "button";
  rankingBtn.addEventListener("click", () => { $("trivia-ranking").scrollIntoView({ behavior: sinMovimiento ? "instant" : "smooth", block: "start" }); mostrarRanking(); });
  panel.append(rankingBtn);
  if (confetiSi && pct >= .8) confeti(panel);
}

async function abrir() {
  const modal = $("panel-trivia");
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  $("trivia-ranking").hidden = true;
  $("trivia-pantalla").replaceChildren(h("p", "", "Cargando trivia…"));
  try {
    const [s, a] = await Promise.all([getDoc(doc(db, "trivias", edicion)), getDoc(doc(db, "articulos", edicion))]);
    const data = s.exists() ? s.data() : {};
    preguntas = Array.isArray(data.preguntas) ? data.preguntas : [];
    articulos = (a.exists() ? a.data().lista : []) || [];
    const previa = leerLocal(clavePartida(edicion));
    if (!data.activa || preguntas.length < 3) { $("trivia-pantalla").replaceChildren(h("p", "", "La trivia no está disponible.")); return; }
    pantallaInicio(previa);
  } catch (e) {
    console.warn("Abrir trivia:", e.code || e.message);
    $("trivia-pantalla").replaceChildren(h("p", "", "No se pudo cargar la trivia. Inténtalo de nuevo."));
  }
}

function cerrar() {
  const modal = $("panel-trivia");
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  $("btn-trivia").focus({ preventScroll: true });
}

export function iniciarTrivia(ed) {
  edicion = ed;
  getDoc(doc(db, "trivias", edicion)).then((s) => { if (s.exists() && s.data().activa) $("btn-trivia").hidden = false; }).catch((e) => console.warn("Estado de trivia:", e.code || e.message));
  $("btn-trivia").addEventListener("click", abrir);
  $("trivia-cerrar").addEventListener("click", cerrar);
  $("panel-trivia").addEventListener("click", (e) => { if (e.target === $("panel-trivia")) cerrar(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("panel-trivia").hidden) cerrar(); });
}
