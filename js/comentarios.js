import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { claseRol, etiquetaRol } from "./roles.js";

const $ = (id) => document.getElementById(id);
const ed = new URLSearchParams(location.search).get("ed");

if (ed && /^[\w.-]+$/.test(ed)) {
  const db = getFirestore(initializeApp(firebaseConfig));
  const col = collection(db, "comentarios");
  const LS_KEY = "voces-ultimo-comentario";
  const ESPERA_MS = 60000;

  const panel = $("panel-comentarios");
  const lista = $("lista-comentarios");
  const form = $("form-comentario");
  const msg = $("msg-comentario");
  const texto = $("c-texto");
  const contador = $("c-contador");
  const abrir = $("btn-comentarios");

  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  function relativa(date) {
    const seg = Math.round((date.getTime() - Date.now()) / 1000);
    const tramos = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [u, s] of tramos) {
      if (Math.abs(seg) >= s) return rtf.format(Math.round(seg / s), u);
    }
    return "hace un momento";
  }

  function leerUltimo() {
    try { return Number(localStorage.getItem(LS_KEY)) || 0; } catch { return 0; }
  }
  function guardarUltimo() {
    try { localStorage.setItem(LS_KEY, String(Date.now())); } catch { /* sin almacenamiento */ }
  }

  function pintar(items) {
    abrir.textContent = `💬 Comentarios (${items.length})`;
    lista.replaceChildren();
    if (!items.length) {
      const p = document.createElement("p");
      p.className = "c-vacio";
      p.textContent = "Sé el primero en comentar";
      lista.append(p);
      return;
    }
    for (const c of items) {
      const art = document.createElement("article");
      art.className = `c-item ${claseRol(c.rol)}`;
      const cab = document.createElement("div");
      cab.className = "c-cab";
      const n = document.createElement("strong");
      n.textContent = c.nombre;
      const r = etiquetaRol(c);
      const f = document.createElement("time");
      f.textContent = c.fecha ? relativa(c.fecha.toDate()) : "";
      cab.append(n, r, f);
      const t = document.createElement("p");
      t.textContent = c.texto;
      art.append(cab, t);
      lista.append(art);
    }
  }

  async function cargar() {
    try {
      const q = query(col, where("edicion", "==", ed), where("aprobado", "==", true),
        orderBy("fecha", "desc"), limit(100));
      const snap = await getDocs(q);
      pintar(snap.docs.map((d) => d.data()));
    } catch (e) {
      console.error(e);
      lista.textContent = "No se pudieron cargar los comentarios.";
    }
  }

  function abrirPanel(v) {
    panel.classList.toggle("abierto", v);
    panel.setAttribute("aria-hidden", String(!v));
    abrir.setAttribute("aria-expanded", String(v));
  }

  abrir.addEventListener("click", () => abrirPanel(!panel.classList.contains("abierto")));
  $("c-cerrar").addEventListener("click", () => abrirPanel(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") abrirPanel(false); });

  texto.addEventListener("input", () => { contador.textContent = `${texto.value.length}/500`; });

  const selRol = $("c-rol");
  const selGrupo = $("c-grupo");
  const actualizarGrupo = () => { selGrupo.hidden = selRol.value !== "Alumno"; };
  selRol.addEventListener("change", actualizarGrupo);
  actualizarGrupo();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if ($("c-web").value) return; // honeypot

    const nombre = $("c-nombre").value.trim();
    const rol = $("c-rol").value;
    const cuerpo = texto.value.trim();
    const grupo = rol === "Alumno" ? selGrupo.value : "";

    if (nombre.length < 2 || nombre.length > 40) { msg.textContent = "El nombre debe tener de 2 a 40 caracteres."; return; }
    if (rol === "Alumno" && !grupo) { msg.textContent = "Elige tu grupo"; return; }
    if (cuerpo.length < 3 || cuerpo.length > 500) { msg.textContent = "El comentario debe tener de 3 a 500 caracteres."; return; }

    const resto = ESPERA_MS - (Date.now() - leerUltimo());
    if (resto > 0) {
      msg.textContent = `Espera ${Math.ceil(resto / 1000)} segundos para enviar otro comentario.`;
      return;
    }

    const boton = $("c-enviar");
    boton.disabled = true;
    try {
      const datos = { edicion: ed, nombre, rol, texto: cuerpo, fecha: serverTimestamp(), aprobado: false };
      if (grupo) datos.grupo = grupo;
      await addDoc(col, datos);
      guardarUltimo();
      form.reset();
      actualizarGrupo();
      contador.textContent = "0/500";
      msg.textContent = "¡Gracias! Tu comentario aparecerá cuando sea aprobado.";
    } catch (err) {
      console.error(err);
      msg.textContent = "No se pudo enviar. Inténtalo más tarde.";
    } finally {
      boton.disabled = false;
    }
  });

  cargar();
} else {
  $("btn-comentarios")?.setAttribute("hidden", "");
}
