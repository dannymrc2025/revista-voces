import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const ed = new URLSearchParams(location.search).get("ed");
const DESCONOCIDO = "Desconocido";

const texto = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : DESCONOCIDO);

function dispositivo() {
  const ua = navigator.userAgent;
  const tactil = navigator.maxTouchPoints > 1;
  const ancho = Math.min(screen.width, screen.height);
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && tactil) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/iPhone|iPod|Android|Mobile/i.test(ua)) return "movil";
  if (tactil && ancho < 768) return "movil";
  return "escritorio";
}

async function ubicacion() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 3000);
  try {
    const res = await fetch("https://get.geojs.io/v1/ip/geo.json", { signal: ctl.signal });
    const d = await res.json();
    return { ciudad: texto(d.city), region: texto(d.region), pais: texto(d.country) };
  } catch {
    return { ciudad: DESCONOCIDO, region: DESCONOCIDO, pais: DESCONOCIDO };
  } finally {
    clearTimeout(t);
  }
}

// Espera a que la portada del flipbook ya esté cargada.
function portadaLista() {
  return new Promise((ok) => {
    const limite = setTimeout(ok, 10000);
    const revisar = () => {
      const img = document.querySelector('#libro img[data-i="0"]');
      if (img && img.complete && img.naturalWidth) { clearTimeout(limite); ok(); } else setTimeout(revisar, 300);
    };
    revisar();
  });
}

async function registrar() {
  try {
    if (!ed || !/^[\w.-]+$/.test(ed)) return;
    try { if (localStorage.getItem("revista-no-contar") === "1") return; } catch { /* sin almacenamiento */ }
    const h = new Date();
    const dia = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
    const clave = `visita-${ed}-${dia}`;
    try { if (localStorage.getItem(clave)) return; } catch { /* sin almacenamiento */ }

    await portadaLista();
    try { localStorage.setItem(clave, "1"); } catch { /* sin almacenamiento */ }
    const lugar = await ubicacion();
    const db = getFirestore(initializeApp(firebaseConfig));
    await addDoc(collection(db, "visitas"), {
      edicion: ed,
      fecha: serverTimestamp(),
      ciudad: lugar.ciudad,
      region: lugar.region,
      pais: lugar.pais,
      dispositivo: dispositivo()
    });
  } catch (e) {
    console.warn("No se registró la visita:", e.code || e.message);
  }
}

registrar();
