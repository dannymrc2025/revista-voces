import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, onSnapshot, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const ed = new URLSearchParams(location.search).get("ed");
const CAMPOS = ["aplauso", "wow", "corazon", "idea"];

const barra = document.getElementById("art-barra");

if (ed && /^[\w.-]+$/.test(ed) && barra) {
  const db = getFirestore(initializeApp(firebaseConfig));
  const titulo = document.getElementById("art-titulo");
  const botones = Object.fromEntries(CAMPOS.map((c) => [c, barra.querySelector(`[data-campo="${c}"]`)]));
  const sitio = barra.parentNode;
  const siguiente = barra.nextSibling;
  let lista = [];
  let actual = null;
  let baja = null;

  const clave = (art, campo) => `reaccion-${ed}-${art}-${campo}`;
  const usada = (art, campo) => { try { return localStorage.getItem(clave(art, campo)) === "1"; } catch { return false; } };
  const marcar = (art, campo, v) => {
    try { if (v) localStorage.setItem(clave(art, campo), "1"); else localStorage.removeItem(clave(art, campo)); } catch { /* sin almacenamiento */ }
  };

  function pintarUsadas() {
    for (const c of CAMPOS) {
      const ya = actual ? usada(actual.id, c) : false;
      botones[c].classList.toggle("usada", ya);
      botones[c].setAttribute("aria-pressed", String(ya));
    }
  }

  function escuchar(art) {
    baja?.();
    baja = null;
    for (const c of CAMPOS) botones[c].querySelector(".n").textContent = "0";
    if (!art) return;
    baja = onSnapshot(doc(db, "reacciones", `${ed}__${art.id}`), (s) => {
      const d = s.data() || {};
      for (const c of CAMPOS) botones[c].querySelector(".n").textContent = String(d[c] || 0);
    }, (e) => console.warn("Reacciones:", e.code || e.message));
  }

  function mostrar(art) {
    if (actual?.id === art?.id) return;
    actual = art;
    barra.classList.toggle("vacia", !art);
    titulo.textContent = art ? art.titulo : "";
    pintarUsadas();
    escuchar(art);
  }

  function alCambiar({ paginas, lectura }) {
    if (!lista.length) return;
    // En modo lectura la barra se muestra fija sobre la hoja ampliada.
    if (lectura) document.getElementById("lectura").append(barra);
    else sitio.insertBefore(barra, siguiente);
    barra.classList.toggle("en-lectura", lectura);
    document.getElementById("lectura").classList.toggle("con-barra", lectura);
    const art = lista.find((a) => paginas.some((p) => p + 1 >= a.inicio && p + 1 <= a.fin)) || null;
    mostrar(art);
  }

  function volar(boton) {
    const f = document.createElement("span");
    f.className = "vuelo";
    f.textContent = boton.dataset.emoji;
    f.setAttribute("aria-hidden", "true");
    boton.append(f);
    setTimeout(() => f.remove(), 800);
  }

  async function reaccionar(campo) {
    if (!actual || usada(actual.id, campo)) return;
    const art = actual;
    const b = botones[campo];
    marcar(art.id, campo, true);
    pintarUsadas();
    volar(b);
    try {
      await updateDoc(doc(db, "reacciones", `${ed}__${art.id}`), { [campo]: increment(1) });
    } catch (e) {
      console.warn("No se registr\u00f3 la reacci\u00f3n:", e.code || e.message);
      marcar(art.id, campo, false);
      if (actual?.id === art.id) pintarUsadas();
    }
  }

  for (const c of CAMPOS) botones[c].addEventListener("click", () => reaccionar(c));

  (async () => {
    try {
      const s = await getDoc(doc(db, "articulos", ed));
      lista = (s.exists() ? s.data().lista : []) || [];
      lista = lista.filter((a) => a && a.id && a.titulo && a.inicio >= 1 && a.fin >= a.inicio);
    } catch (e) {
      console.warn("Art\u00edculos:", e.code || e.message);
      lista = [];
    }
    if (!lista.length) return;
    barra.hidden = false;
    barra.classList.add("vacia");
    window.addEventListener("voces:pagina", (e) => alCambiar(e.detail));
    if (window.vocesPaginas) alCambiar(window.vocesPaginas);
  })();
}
