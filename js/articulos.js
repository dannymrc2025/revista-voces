import { doc, getDoc, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const SECCIONES = ["Tecnología", "Lenguajes", "Geografía", "Matemáticas", "Prefectura"];
const OTRA = "__otra__";

let db = null;
let edicion = null;
let items = [];
let ocupado = false;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function boton(texto, cls, fn) {
  const b = el("button", `btn ${cls || ""}`.trim(), texto);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
}

const nuevoId = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, "0")).join("");
const miniatura = (n) => `ediciones/${encodeURIComponent(edicion.id)}/paginas/p${String(n).padStart(3, "0")}-m.${edicion.ext || "webp"}`;

export function iniciarArticulos(opciones) {
  db = opciones.db;
}

export function detenerArticulos() {
  edicion = null;
  items = [];
  const cont = $("art-editor");
  cont.hidden = true;
  cont.replaceChildren();
}

export async function abrirEditorArticulos(e) {
  edicion = e;
  const cont = $("art-editor");
  cont.hidden = false;
  cont.replaceChildren(el("p", "nota", "Cargando artículos…"));
  cont.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const s = await getDoc(doc(db, "articulos", e.id));
    items = (s.exists() ? s.data().lista : []) || [];
    items = items.map((a) => ({ id: a.id, titulo: a.titulo, seccion: a.seccion, inicio: a.inicio, fin: a.fin }));
  } catch (err) {
    console.warn("Artículos:", err.code || err.message);
    cont.replaceChildren(el("p", "nota error", "No se pudieron cargar los artículos."), boton("Cerrar", "", detenerArticulos));
    return;
  }
  pintar();
}

function validar() {
  const total = edicion.paginas;
  for (const [i, a] of items.entries()) {
    const n = `Artículo ${i + 1}`;
    if (!a.titulo.trim() || a.titulo.length > 120) return `${n}: escribe un título (máximo 120 caracteres).`;
    if (!a.seccion.trim() || a.seccion.length > 40) return `${n}: escribe la sección (máximo 40 caracteres).`;
    if (!Number.isInteger(a.inicio) || !Number.isInteger(a.fin)) return `${n}: la página inicial y final deben ser números enteros.`;
    if (a.inicio < 1 || a.fin > total) return `${n}: las páginas deben estar entre 1 y ${total}.`;
    if (a.inicio > a.fin) return `${n}: la página inicial no puede ser mayor que la final.`;
  }
  const orden = [...items].sort((a, b) => a.inicio - b.inicio);
  for (let i = 1; i < orden.length; i++) {
    if (orden[i].inicio <= orden[i - 1].fin) {
      return `Se encimen las páginas de «${orden[i - 1].titulo.trim()}» y «${orden[i].titulo.trim()}».`;
    }
  }
  return null;
}

function filaArticulo(a, i) {
  const fila = el("div", "art-fila");

  const img = el("img");
  img.alt = `Página ${a.inicio}`;
  const verMiniatura = () => {
    img.hidden = !(Number.isInteger(a.inicio) && a.inicio >= 1 && a.inicio <= edicion.paginas);
    if (!img.hidden) img.src = miniatura(a.inicio);
  };
  img.addEventListener("error", () => { img.hidden = true; });
  verMiniatura();

  const campos = el("div", "art-campos");
  const titulo = el("input");
  titulo.type = "text";
  titulo.placeholder = "Título del artículo";
  titulo.maxLength = 120;
  titulo.value = a.titulo;
  titulo.setAttribute("aria-label", "Título");
  titulo.addEventListener("input", () => { a.titulo = titulo.value; });

  const dos = el("div", "art-dos");
  const sel = el("select");
  sel.setAttribute("aria-label", "Sección");
  for (const s of SECCIONES) { const o = el("option", "", s); o.value = s; sel.append(o); }
  const otra = el("option", "", "Otra…");
  otra.value = OTRA;
  sel.append(otra);
  const libre = el("input");
  libre.type = "text";
  libre.placeholder = "Escribe la sección";
  libre.maxLength = 40;
  libre.setAttribute("aria-label", "Otra sección");
  const esOtra = !SECCIONES.includes(a.seccion);
  sel.value = esOtra ? OTRA : a.seccion;
  libre.hidden = !esOtra;
  libre.value = esOtra ? a.seccion : "";
  sel.addEventListener("change", () => {
    libre.hidden = sel.value !== OTRA;
    a.seccion = sel.value === OTRA ? libre.value : sel.value;
    if (!libre.hidden) libre.focus();
  });
  libre.addEventListener("input", () => { a.seccion = libre.value; });
  dos.append(sel, libre);

  const pag = el("div", "art-pags");
  const campoPag = (rotulo, clave) => {
    const l = el("label", "", rotulo);
    const n = el("input");
    n.type = "number";
    n.min = 1;
    n.max = edicion.paginas;
    n.inputMode = "numeric";
    n.value = Number.isInteger(a[clave]) ? a[clave] : "";
    n.addEventListener("input", () => {
      a[clave] = n.value === "" ? NaN : Number(n.value);
      if (clave === "inicio") { img.alt = `Página ${a.inicio}`; verMiniatura(); }
    });
    l.append(n);
    return l;
  };
  pag.append(campoPag("Página inicial", "inicio"), campoPag("Página final", "fin"));
  campos.append(titulo, dos, pag);

  const acc = el("div", "acciones conf art-acc");
  const normal = () => acc.replaceChildren(
    boton("↑", "", () => mover(i, -1)),
    boton("↓", "", () => mover(i, 1)),
    boton("Eliminar", "peligro", () => acc.replaceChildren(
      el("span", "", "¿Eliminar este artículo y sus reacciones?"),
      boton("Sí", "peligro", () => { items.splice(i, 1); pintar(); }),
      boton("No", "", normal)
    ))
  );
  normal();
  fila.append(img, campos, acc);
  return fila;
}

function mover(i, d) {
  const j = i + d;
  if (j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  pintar();
}

function pintar() {
  const cont = $("art-editor");
  const msg = el("p", "nota", "");
  msg.setAttribute("role", "status");

  const cab = el("div", "fila-titulo");
  cab.append(el("h2", "", `Artículos: ${edicion.titulo}`), boton("Cerrar", "", detenerArticulos));

  const lista = el("div", "lista");
  if (!items.length) lista.append(el("p", "vacio", "Esta edición aún no tiene artículos."));
  else lista.append(...items.map(filaArticulo));

  const acciones = el("div", "acciones");
  acciones.append(
    boton("+ Agregar artículo", "", () => {
      const ult = items.length ? Math.min(items[items.length - 1].fin + 1, edicion.paginas) : 1;
      items.push({ id: nuevoId(), titulo: "", seccion: SECCIONES[0], inicio: ult, fin: ult });
      pintar();
      cont.querySelector(".art-fila:last-child input")?.focus();
    }),
    boton("Guardar", "primario", () => guardar(msg))
  );
  cont.replaceChildren(cab, lista, acciones, msg);
}

async function guardar(msg) {
  if (ocupado) return;
  const error = validar();
  if (error) { msg.textContent = error; msg.classList.add("error"); return; }
  ocupado = true;
  msg.classList.remove("error");
  msg.textContent = "Guardando…";
  try {
    const ref = doc(db, "articulos", edicion.id);
    const previos = (await getDoc(ref)).data()?.lista || [];
    const limpios = items.map((a) => ({ id: a.id, titulo: a.titulo.trim(), seccion: a.seccion.trim(), inicio: a.inicio, fin: a.fin }));

    await Promise.all(limpios.map(async (a) => {
      const r = doc(db, "reacciones", `${edicion.id}__${a.id}`);
      const s = await getDoc(r);
      if (!s.exists()) {
        await setDoc(r, { edicion: edicion.id, articuloId: a.id, titulo: a.titulo, aplauso: 0, wow: 0, corazon: 0, idea: 0 });
      } else if (s.data().titulo !== a.titulo) {
        await updateDoc(r, { titulo: a.titulo });
      }
    }));
    await setDoc(ref, { lista: limpios });
    const vigentes = new Set(limpios.map((a) => a.id));
    await Promise.all(previos.filter((p) => !vigentes.has(p.id)).map((p) => deleteDoc(doc(db, "reacciones", `${edicion.id}__${p.id}`))));

    items.forEach((a, i) => Object.assign(a, limpios[i]));
    msg.textContent = "Artículos guardados.";
  } catch (e) {
    console.warn("Guardar artículos:", e.code || e.message);
    msg.classList.add("error");
    msg.textContent = e.code === "unavailable" ? "Sin conexión. Inténtalo de nuevo." : "No se pudieron guardar los artículos.";
  } finally {
    ocupado = false;
  }
}
