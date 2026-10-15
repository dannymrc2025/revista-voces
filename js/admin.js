import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, ADMIN_UID } from "./firebase-config.js";
import { iniciarPublicar, detenerPublicar, alternarVisible, eliminarEdicion } from "./publicar.js";

const $ = (id) => document.getElementById(id);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const col = collection(db, "comentarios");
const TITULO = "Administración – Voces del Corazón Maya";

let pendientes = [];
let publicados = [];
let ediciones = [];
let unsubs = [];

const ts = (c) => (c.fecha?.toMillis ? c.fecha.toMillis() : 0);
const masNuevo = (a, b) => ts(b) - ts(a);
const fechaHora = (c) => c.fecha?.toDate
  ? c.fecha.toDate().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
  : "—";

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

async function accion(fn) {
  try { await fn(); } catch (e) {
    console.error(e);
    alert(e.code === "unavailable" ? "Sin conexión. Inténtalo de nuevo." : "No se pudo completar la acción.");
  }
}

// ---------- Tarjetas ----------
function tarjeta(c, botones) {
  const card = el("article", "card");
  const meta = el("div", "meta");
  meta.append(el("strong", "", c.nombre), el("span", "", c.rol), el("span", "", `Edición ${c.edicion}`), el("span", "", fechaHora(c)));
  const acciones = el("div", "acciones");
  card.append(meta, el("p", "", c.texto), acciones);

  const normal = () => acciones.replaceChildren(...botones(confirmar));
  function confirmar(textoPregunta, alSi) {
    acciones.replaceChildren(
      el("span", "", textoPregunta),
      boton("Sí", "peligro", () => accion(alSi)),
      boton("No", "", normal)
    );
    acciones.classList.add("conf");
    acciones.firstChild.style.flex = "1 1 100%";
  }
  normal();
  return card;
}

function pintarPendientes() {
  const lista = $("lista-pend");
  const ord = [...pendientes].sort(masNuevo);
  $("n-pend").textContent = `${ord.length} ${ord.length === 1 ? "pendiente" : "pendientes"}`;
  document.title = ord.length ? `(${ord.length}) ${TITULO}` : TITULO;
  $("aprobar-todos").hidden = ord.length === 0;
  if (!ord.length) cancelarTodos();

  if (!ord.length) { lista.replaceChildren(el("p", "vacio", "No hay comentarios pendientes.")); return; }
  lista.replaceChildren(...ord.map((c) => tarjeta(c, (confirmar) => [
    boton("Aprobar", "primario", () => accion(() => updateDoc(doc(db, "comentarios", c.id), { aprobado: true }))),
    boton("Rechazar", "peligro", () => confirmar("¿Eliminar?", () => deleteDoc(doc(db, "comentarios", c.id))))
  ])));
}

function pintarPublicados() {
  const lista = $("lista-pub");
  const ed = $("sel-ed").value;
  const ord = publicados.filter((c) => c.edicion === ed).sort(masNuevo);
  if (!ord.length) { lista.replaceChildren(el("p", "vacio", "No hay comentarios publicados en esta edición.")); return; }
  lista.replaceChildren(...ord.map((c) => tarjeta(c, (confirmar) => [
    boton("Ocultar", "", () => accion(() => updateDoc(doc(db, "comentarios", c.id), { aprobado: false }))),
    boton("Eliminar", "peligro", () => confirmar("¿Eliminar?", () => deleteDoc(doc(db, "comentarios", c.id))))
  ])));
}

function pintarEdiciones() {
  const cont = $("lista-ed");
  cont.replaceChildren(...ediciones.map((e) => {
    const n = publicados.filter((c) => c.edicion === e.id).length;
    const fila = el("div", "ed");
    const img = el("img");
    img.src = `ediciones/${encodeURIComponent(e.id)}/paginas/p001-m.webp`;
    img.alt = `Portada de ${e.titulo}`;
    img.loading = "lazy";
    const info = el("div");
    info.append(el("strong", "", e.titulo), el("span", "", e.fecha || ""), el("span", "", `${n} ${n === 1 ? "comentario aprobado" : "comentarios aprobados"}`));
    const oculta = e.visible === false;
    if (oculta) { info.append(el("span", "etiqueta", "Oculta")); fila.classList.add("oculta"); }

    const acc = el("div", "acciones conf");
    const normal = () => acc.replaceChildren(
      boton(oculta ? "Mostrar" : "Ocultar", "", () => operar(() => alternarVisible(e.id))),
      boton("Eliminar", "peligro", confirmar)
    );
    const confirmar = () => acc.replaceChildren(
      el("span", "", `¿Eliminar "${e.titulo}"? Se borran sus páginas; los comentarios se conservan.`),
      boton("Sí, eliminar", "peligro", () => operar(() => eliminarEdicion(e.id))),
      boton("No", "", normal)
    );
    async function operar(fn) {
      acc.replaceChildren(el("span", "", "Publicando cambio…"));
      try { await fn(); } catch (err) {
        acc.replaceChildren(el("span", "", err.message || "No se pudo completar la acción."), boton("Cerrar", "", normal));
      }
    }
    normal();
    fila.append(img, info, acc);
    return fila;
  }));
}

// ---------- Aprobar todos ----------
function cancelarTodos() {
  $("aprobar-todos-conf").hidden = true;
  $("aprobar-todos").hidden = pendientes.length === 0;
}
$("aprobar-todos").addEventListener("click", () => {
  $("aprobar-todos-txt").textContent = `¿Aprobar los ${pendientes.length} comentarios pendientes?`;
  $("aprobar-todos").hidden = true;
  $("aprobar-todos-conf").hidden = false;
});
$("todos-no").addEventListener("click", cancelarTodos);
$("todos-si").addEventListener("click", () => accion(async () => {
  const lote = pendientes.slice(0, 450); // límite de 500 por lote
  const batch = writeBatch(db);
  lote.forEach((c) => batch.update(doc(db, "comentarios", c.id), { aprobado: true }));
  await batch.commit();
  cancelarTodos();
}));

// ---------- Datos en vivo ----------
function escuchar() {
  const mapa = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
  const fallo = (e) => console.error(e);
  unsubs.push(
    onSnapshot(query(col, where("aprobado", "==", false)), (s) => { pendientes = mapa(s); pintarPendientes(); }, fallo),
    onSnapshot(query(col, where("aprobado", "==", true)), (s) => { publicados = mapa(s); pintarPublicados(); pintarEdiciones(); }, fallo)
  );
}
function detener() {
  unsubs.forEach((u) => u());
  unsubs = [];
  pendientes = [];
  publicados = [];
  document.title = TITULO;
}

async function cargarEdiciones() {
  let lista;
  try {
    const res = await fetch("ediciones/ediciones.json", { cache: "no-store" });
    lista = await res.json();
  } catch { lista = []; }
  aplicarEdiciones(lista);
}

function aplicarEdiciones(lista) {
  ediciones = lista;
  const sel = $("sel-ed");
  const actual = sel.value;
  sel.replaceChildren(...ediciones.map((e) => {
    const o = el("option", "", e.titulo);
    o.value = e.id;
    return o;
  }));
  if (ediciones.some((e) => e.id === actual)) sel.value = actual;
  pintarEdiciones();
  pintarPublicados();
}
$("sel-ed").addEventListener("change", pintarPublicados);

// ---------- Pestañas ----------
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("activa", x === t));
  $("tab-comentarios").hidden = t.dataset.tab !== "comentarios";
  $("tab-ediciones").hidden = t.dataset.tab !== "ediciones";
}));

// ---------- Sesión ----------
function errorAuth(e) {
  switch (e.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Correo o contraseña incorrectos.";
    case "auth/invalid-email": return "El correo no es válido.";
    case "auth/too-many-requests": return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    case "auth/network-request-failed": return "Sin conexión. Revisa tu internet.";
    case "auth/user-disabled": return "Esta cuenta está deshabilitada.";
    default: return "No se pudo iniciar sesión.";
  }
}

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("l-msg");
  msg.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("l-correo").value.trim(), $("l-clave").value);
  } catch (err) {
    msg.textContent = errorAuth(err);
  }
});

$("salir").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user && user.uid !== ADMIN_UID) {
    await signOut(auth);
    $("l-msg").textContent = "Acceso no autorizado";
    return;
  }
  const dentro = !!user;
  $("login").hidden = dentro;
  $("panel").hidden = !dentro;
  detener();
  detenerPublicar();
  if (dentro) {
    $("form-login").reset();
    await cargarEdiciones();
    iniciarPublicar({ db, getEdiciones: () => ediciones, onCambio: aplicarEdiciones });
    escuchar();
  }
});
