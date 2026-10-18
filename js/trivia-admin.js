import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
let db = null;
let edicion = null;
let preguntas = [];
let articulos = [];
let vistaPrevia = false;
let ocupado = false;

function boton(texto, fn, cls = "") { const b = h("button", `btn ${cls}`.trim(), texto); b.type = "button"; b.addEventListener("click", fn); return b; }
function nuevoId() { return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2); }

export function iniciarTriviaAdmin(opciones) { db = opciones.db; }
export function detenerTriviaAdmin() {
  edicion = null; preguntas = []; articulos = []; vistaPrevia = false;
  $("trivia-editor").hidden = true; $("trivia-editor").replaceChildren();
}

export async function abrirEditorTrivia(e) {
  edicion = e; vistaPrevia = false;
  const cont = $("trivia-editor"); cont.hidden = false; cont.replaceChildren(h("p", "nota", "Cargando trivia…"));
  cont.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const [s, a] = await Promise.all([getDoc(doc(db, "trivias", e.id)), getDoc(doc(db, "articulos", e.id))]);
    const data = s.exists() ? s.data() : {};
    preguntas = Array.isArray(data.preguntas) ? data.preguntas.map((p) => ({ texto: p.texto || "", opciones: Array.isArray(p.opciones) ? [...p.opciones] : ["", "", "", ""], correcta: Number.isInteger(p.correcta) ? p.correcta : 0, articuloId: p.articuloId || "" })) : [];
    while (preguntas.length < 3) preguntas.push({ texto: "", opciones: ["", "", "", ""], correcta: 0, articuloId: "" });
    articulos = (a.exists() ? a.data().lista : []) || [];
    pintarEditor(!!data.activa);
  } catch (err) {
    console.warn("Trivia:", err.code || err.message);
    cont.replaceChildren(h("p", "nota error", "No se pudo cargar la trivia o los artículos."), boton("Cerrar", detenerTriviaAdmin));
  }
}

function pintarEditor(activa = false, mensaje = "") {
  const cont = $("trivia-editor");
  const cab = h("div", "fila-titulo");
  cab.append(h("h2", "", `Trivia: ${edicion.titulo}`), boton("Cerrar", detenerTriviaAdmin));
  const activarLabel = h("label", "trivia-switch", "Trivia activa");
  const activar = document.createElement("input"); activar.type = "checkbox"; activar.checked = activa;
  activarLabel.prepend(activar);
  const lista = h("div", "trivia-editor-lista");
  preguntas.forEach((p, i) => lista.append(filaPregunta(p, i)));
  const acciones = h("div", "acciones");
  acciones.append(
    boton("+ Agregar pregunta", () => { if (preguntas.length >= 10) return; preguntas.push({ texto: "", opciones: ["", "", "", ""], correcta: 0, articuloId: "" }); pintarEditor(activar.checked); }, ""),
    boton("Vista previa", () => { vistaPrevia = true; pintarEditor(activar.checked); }, ""),
    boton("Guardar", () => guardarTrivia(activar.checked, msg), "primario")
  );
  const msg = h("p", "nota", mensaje); msg.setAttribute("role", "status");
  cont.replaceChildren(cab, activarLabel, lista, acciones, msg);
  if (vistaPrevia) cont.append(pintarVistaPrevia(() => { vistaPrevia = false; pintarEditor(activar.checked); }));
}

function filaPregunta(p, i) {
  const card = h("article", "trivia-pregunta-editor");
  const titulo = h("div", "trivia-pregunta-cab");
  titulo.append(h("h3", "", `Pregunta ${i + 1}`));
  if (preguntas.length > 3) titulo.append(boton("Eliminar", () => { preguntas.splice(i, 1); pintarEditor(); }, "peligro"));
  const texto = document.createElement("textarea"); texto.rows = 2; texto.maxLength = 500; texto.required = true; texto.placeholder = "Texto de la pregunta"; texto.value = p.texto;
  texto.addEventListener("input", () => { p.texto = texto.value; });
  const opciones = h("div", "trivia-opciones-editor");
  p.opciones = Array.from({ length: 4 }, (_, j) => p.opciones[j] || "");
  p.opciones.forEach((op, j) => {
    const label = h("label", "trivia-opcion-editor");
    const radio = document.createElement("input"); radio.type = "radio"; radio.name = `correcta-${p._key || (p._key = nuevoId())}`; radio.checked = p.correcta === j; radio.setAttribute("aria-label", `Opción ${j + 1} correcta`);
    radio.addEventListener("change", () => { p.correcta = j; });
    const input = document.createElement("input"); input.type = "text"; input.maxLength = 180; input.required = true; input.placeholder = `Opción ${j + 1}`; input.value = op;
    input.addEventListener("input", () => { p.opciones[j] = input.value; });
    label.append(radio, input); opciones.append(label);
  });
  const articuloLabel = h("label", "trivia-articulo-label", "Artículo relacionado (opcional)");
  const articulo = document.createElement("select");
  const vacio = h("option", "", "Sin artículo relacionado"); vacio.value = ""; articulo.append(vacio);
  articulos.forEach((a) => { const o = h("option", "", `${a.titulo} · pág. ${a.inicio}`); o.value = a.id; articulo.append(o); });
  articulo.value = p.articuloId || ""; articulo.addEventListener("change", () => { p.articuloId = articulo.value; });
  articuloLabel.append(articulo);
  card.append(titulo, texto, opciones, articuloLabel);
  return card;
}

function validarTrivia() {
  if (preguntas.length < 3 || preguntas.length > 10) return "La trivia debe tener entre 3 y 10 preguntas.";
  for (const [i, p] of preguntas.entries()) {
    if (!p.texto.trim()) return `Escribe el texto de la pregunta ${i + 1}.`;
    if (p.opciones.length !== 4 || p.opciones.some((o) => !o.trim())) return `Completa las cuatro opciones de la pregunta ${i + 1}.`;
    if (!Number.isInteger(p.correcta) || p.correcta < 0 || p.correcta > 3) return `Selecciona la opción correcta de la pregunta ${i + 1}.`;
    if (p.articuloId && !articulos.some((a) => a.id === p.articuloId)) return `El artículo relacionado de la pregunta ${i + 1} ya no existe.`;
  }
  return "";
}

async function guardarTrivia(activa, msg) {
  if (ocupado) return;
  const error = validarTrivia();
  if (error) { msg.textContent = error; msg.classList.add("error"); return; }
  ocupado = true; msg.textContent = "Guardando…"; msg.classList.remove("error");
  try {
    const preguntasLimpias = preguntas.map((p) => ({ texto: p.texto.trim(), opciones: p.opciones.map((o) => o.trim()), correcta: p.correcta, articuloId: p.articuloId || "" }));
    await setDoc(doc(db, "trivias", edicion.id), { activa, preguntas: preguntasLimpias });
    preguntas = preguntasLimpias;
    pintarEditor(activa, "Trivia guardada.");
  } catch (e) {
    console.warn("Guardar trivia:", e.code || e.message);
    msg.classList.add("error"); msg.textContent = e.code === "permission-denied" ? "No se pudo guardar. Verifica las reglas publicadas para trivias." : "No se pudo guardar la trivia.";
  } finally { ocupado = false; }
}

function pintarVistaPrevia(cerrar) {
  const caja = h("section", "trivia-preview");
  const cab = h("div", "fila-titulo"); cab.append(h("h3", "", "Vista previa · no cuenta"), boton("Cerrar vista previa", cerrar));
  caja.append(cab);
  let i = 0;
  const pintar = () => {
    const p = preguntas[i];
    const cuerpo = h("div", "trivia-preview-pregunta");
    const avance = document.createElement("progress"); avance.max = preguntas.length; avance.value = i + 1;
    cuerpo.append(h("span", "", `Pregunta ${i + 1} de ${preguntas.length}`), avance, h("strong", "", p.texto));
    const lista = h("div", "trivia-opciones");
    p.opciones.forEach((op, j) => { const b = boton(op, () => { [...lista.children].forEach((x) => { x.disabled = true; }); lista.children[p.correcta].classList.add("correcta"); if (j !== p.correcta) lista.children[j].classList.add("incorrecta"); const sig = boton(i === preguntas.length - 1 ? "Terminar vista previa" : "Siguiente", () => { if (i < preguntas.length - 1) { i++; pintar(); } else cerrar(); }, "primario"); cuerpo.append(sig); }); lista.append(b); });
    cuerpo.append(lista); caja.replaceChildren(cab, cuerpo);
  };
  if (preguntas.length) pintar();
  return caja;
}

