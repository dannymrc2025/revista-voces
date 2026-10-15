import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const REPO = "dannymrc2025/revista-voces";
const RAMA = "main";
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/";
const ANCHO_RENDER = 1800;
const ANCHO_M = 1000;
const OG_W = 1200;
const OG_H = 630;
const OG_FONDO = "#12201c";
const OG_MAX_BYTES = 300 * 1024;
const SITIO = "Voces del Corazón Maya";
const RE_ID = /^\d{4}-(0[1-9]|1[0-2])(-[a-z0-9]+)*$/;

const $ = (id) => document.getElementById(id);

let db = null;
let getEdiciones = () => [];
let onCambio = () => {};
let token = null; // solo en memoria
let siteUrl = null;
let nueva = null; // edición convertida lista para publicar
let ocupado = false;

// ---------- GitHub ----------
class ErrorGH extends Error {
  constructor(mensaje, status) { super(mensaje); this.status = status; }
}

function mensajeHttp(status) {
  if (status === 401) return "El token venció o no es válido. Reemplázalo en la sección de conexión con GitHub.";
  if (status === 403 || status === 404) return "El token no tiene permisos sobre el repositorio (requiere Contents: lectura y escritura) o se alcanzó el límite de GitHub.";
  if (status === 409 || status === 422) return "El repositorio cambió mientras se publicaba. Inténtalo de nuevo.";
  return `GitHub respondió con un error (${status}). Inténtalo de nuevo.`;
}

async function gh(ruta, { method = "GET", body, raw = false, permitir404 = false } = {}) {
  if (!token) throw new ErrorGH("Primero guarda el token de GitHub.", 0);
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}${ruta}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
  } catch {
    throw new ErrorGH("Sin conexión. Revisa tu internet e inténtalo de nuevo.", 0);
  }
  if (res.status === 404 && permitir404) return null;
  if (!res.ok) throw new ErrorGH(mensajeHttp(res.status), res.status);
  return raw ? res.text() : res.json();
}

function aBase64(blob) {
  return new Promise((ok, fallo) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1]);
    r.onerror = () => fallo(r.error);
    r.readAsDataURL(blob);
  });
}

async function crearBlob(blob) {
  const intentar = async () => (await gh("/git/blobs", {
    method: "POST", body: { content: await aBase64(blob), encoding: "base64" }
  })).sha;
  try { return await intentar(); } catch (e) {
    if (e.status === 401 || e.status === 403) throw e;
    return intentar();
  }
}

async function pool(items, limite, fn) {
  let i = 0;
  const hilo = async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } };
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, hilo));
}

// Un solo commit: estaticos = blobs fijos; construir() devuelve los textos y borrados según la rama actual.
async function commitUnico({ mensaje, estaticos = [], construir, progreso = () => {} }) {
  const cache = new Map();
  for (let intento = 0; intento < 2; intento++) {
    const ref = await gh(`/git/ref/heads/${RAMA}`);
    const base = ref.object.sha;
    const commit = await gh(`/git/commits/${base}`);
    const treeBase = commit.tree.sha;
    const leer = (p) => gh(`/contents/${p}?ref=${base}`, { raw: true, permitir404: true });
    const arbol = async () => (await gh(`/git/trees/${treeBase}?recursive=1`)).tree
      .filter((t) => t.type === "blob").map((t) => t.path);
    const { archivos, borrar } = await construir({ leer, arbol });

    const items = [
      ...estaticos.map((a) => ({ ...a, fijo: true })),
      ...archivos.map((a) => ({ path: a.path, blob: new Blob([a.text], { type: "text/plain" }) }))
    ];
    const shas = new Map();
    const pendientes = [];
    for (const it of items) {
      if (it.fijo && cache.has(it.path)) shas.set(it.path, cache.get(it.path));
      else pendientes.push(it);
    }
    let hechos = items.length - pendientes.length;
    progreso(hechos, items.length);
    await pool(pendientes, 4, async (it) => {
      const sha = await crearBlob(it.blob);
      shas.set(it.path, sha);
      if (it.fijo) cache.set(it.path, sha);
      progreso(++hechos, items.length);
    });

    const tree = await gh("/git/trees", {
      method: "POST",
      body: {
        base_tree: treeBase,
        tree: [
          ...items.map((it) => ({ path: it.path, mode: "100644", type: "blob", sha: shas.get(it.path) })),
          ...borrar.map((p) => ({ path: p, mode: "100644", type: "blob", sha: null }))
        ]
      }
    });
    const nuevo = await gh("/git/commits", {
      method: "POST", body: { message: mensaje, tree: tree.sha, parents: [base] }
    });
    try {
      await gh(`/git/refs/heads/${RAMA}`, { method: "PATCH", body: { sha: nuevo.sha } });
      return nuevo.sha;
    } catch (e) {
      if ((e.status === 409 || e.status === 422) && intento === 0) continue;
      throw e;
    }
  }
}

// ---------- Utilidades del sitio (equivalen a convertir.py) ----------
const q = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

async function cargarSiteUrl() {
  if (!siteUrl) {
    const cfg = await (await fetch("config.json", { cache: "no-store" })).json();
    siteUrl = cfg.site_url.replace(/\/+$/, "") + "/";
  }
  return siteUrl;
}

function etiquetasOg(url0, id, titulo, fecha) {
  const url = `${url0}ediciones/${id}/`;
  return [
    `  <meta property="og:title" content="${q(SITIO + " – " + titulo)}">`,
    `  <meta property="og:description" content="${q("Revista escolar de la EST #26 José María Luis Mora · " + fecha)}">`,
    `  <meta property="og:image" content="${q(url + "portada-og.jpg")}">`,
    '  <meta property="og:image:width" content="1200">',
    '  <meta property="og:image:height" content="630">',
    `  <meta property="og:url" content="${q(url)}">`,
    '  <meta property="og:type" content="website">',
    '  <meta property="og:locale" content="es_MX">'
  ].join("\n");
}

function paginaEntrada(url0, id, titulo, fecha, ext = "webp") {
  const visor = `../../revista.html?ed=${id}`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${q(SITIO + " – " + titulo)}</title>
${etiquetasOg(url0, id, titulo, fecha)}
  <link rel="stylesheet" href="../../css/styles.css">
  <script>location.replace(${JSON.stringify(visor)});</script>
</head>
<body>
  <main class="contenedor entrada">
    <h1>${q(titulo)}</h1>
    <p>${q(fecha)}</p>
    <img src="paginas/p001-m.${ext}" alt="Portada de ${q(titulo)}" width="400">
    <p><a class="boton" href="${q(visor)}">Leer la revista</a></p>
  </main>
</body>
</html>
`;
}

function actualizarIndexOg(texto, url0, ed) {
  const bloque = etiquetasOg(url0, ed.id, ed.titulo, ed.fecha);
  return texto.replace(
    /(<!-- og:inicio -->\n)[\s\S]*?(\n\s*<!-- og:fin -->)/,
    (_, a, b) => a + bloque + b
  );
}

const visibles = (lista) => lista.filter((e) => e.visible !== false);
const json = (obj) => JSON.stringify(obj, null, 2) + "\n";

async function archivosIndex(leer, lista) {
  const actual = await leer("index.html");
  const primera = visibles(lista)[0];
  if (actual === null || !primera) return [];
  const nuevo = actualizarIndexOg(actual, await cargarSiteUrl(), primera);
  return nuevo === actual ? [] : [{ path: "index.html", text: nuevo }];
}

// ---------- Conversión con PDF.js ----------
let pdfjs = null;
async function cargarPdfjs() {
  if (!pdfjs) {
    pdfjs = await import(`${PDFJS}pdf.min.mjs`);
    pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`;
  }
  return pdfjs;
}

function aBlob(canvas, tipo, calidad) {
  return new Promise((ok) => canvas.toBlob(ok, tipo, calidad));
}

function lienzo(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

async function soportaWebp() {
  const c = lienzo(1, 1);
  const b = await aBlob(c, "image/webp", 0.8);
  liberar(c);
  return !!b && b.type === "image/webp";
}

function liberar(c) {
  c.width = 0;
  c.height = 0;
}

async function crearOg(canvasPortada) {
  const c = lienzo(OG_W, OG_H);
  const ctx = c.getContext("2d");
  ctx.fillStyle = OG_FONDO;
  ctx.fillRect(0, 0, OG_W, OG_H);
  const s = Math.min(OG_W / canvasPortada.width, OG_H / canvasPortada.height, 1);
  const w = Math.round(canvasPortada.width * s);
  const h = Math.round(canvasPortada.height * s);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvasPortada, Math.floor((OG_W - w) / 2), Math.floor((OG_H - h) / 2), w, h);
  let calidad = 80;
  for (;;) {
    const b = await aBlob(c, "image/jpeg", calidad / 100);
    if (b.size < OG_MAX_BYTES || calidad <= 40) { liberar(c); return b; }
    calidad -= 5;
  }
}

async function convertir(file, { id, titulo, fecha }, progreso) {
  const lib = await cargarPdfjs();
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const webp = await soportaWebp();
  const ext = webp ? "webp" : "jpg";
  const tipo = webp ? "image/webp" : "image/jpeg";
  const [calHd, calM] = webp ? [0.80, 0.75] : [0.82, 0.78];
  const total = pdf.numPages;
  const archivos = [];
  const miniaturas = [];
  const base = `ediciones/${id}`;
  let ancho = 0;
  let alto = 0;
  let og = null;

  for (let i = 1; i <= total; i++) {
    progreso(i, total);
    const pagina = await pdf.getPage(i);
    const v1 = pagina.getViewport({ scale: 1 });
    if (i === 1) {
      ancho = Math.round(v1.width * 100) / 100;
      alto = Math.round(v1.height * 100) / 100;
    }
    const viewport = pagina.getViewport({ scale: ANCHO_RENDER / v1.width });
    const hd = lienzo(ANCHO_RENDER, Math.round(viewport.height));
    const ctx = hd.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, hd.width, hd.height);
    await pagina.render({ canvasContext: ctx, viewport }).promise;
    pagina.cleanup();

    const n = `p${String(i).padStart(3, "0")}`;
    const bHd = await aBlob(hd, tipo, calHd);
    const m = lienzo(ANCHO_M, Math.round((hd.height * ANCHO_M) / hd.width));
    const mctx = m.getContext("2d");
    mctx.imageSmoothingQuality = "high";
    mctx.drawImage(hd, 0, 0, m.width, m.height);
    const bM = await aBlob(m, tipo, calM);
    if (!bHd || !bM) throw new Error("No se pudo generar la imagen de la página.");

    archivos.push({ path: `${base}/paginas/${n}-hd.${ext}`, blob: bHd }, { path: `${base}/paginas/${n}-m.${ext}`, blob: bM });
    miniaturas.push(URL.createObjectURL(bM));
    if (i === 1) og = await crearOg(hd);
    liberar(hd);
    liberar(m);
  }
  await pdf.destroy();

  const url0 = await cargarSiteUrl();
  archivos.push({ path: `${base}/portada-og.jpg`, blob: og });
  const info = { titulo, fecha, paginas: total, ancho, alto, ext };
  const textos = [
    { path: `${base}/info.json`, text: json(info) },
    { path: `${base}/index.html`, text: paginaEntrada(url0, id, titulo, fecha, ext) }
  ];
  const peso = archivos.reduce((s, a) => s + a.blob.size, 0)
    + textos.reduce((s, a) => s + new Blob([a.text]).size, 0);
  return { id, titulo, fecha, paginas: total, ext, archivos, textos, miniaturas, peso };
}

// ---------- Interfaz: configuración del token ----------
function nota(id, texto, error = false) {
  const e = $(id);
  e.textContent = texto;
  e.classList.toggle("error", error);
}

function pintarToken() {
  const hay = !!token;
  $("gh-form").hidden = hay;
  $("gh-guardado").hidden = !hay;
  if (hay) $("gh-estado").textContent = `Token guardado ••••${token.slice(-4)}`;
}

async function guardarToken(e) {
  e.preventDefault();
  const valor = $("gh-token").value.trim();
  if (!valor.startsWith("github_pat_")) { nota("gh-msg", "El token debe empezar con github_pat_.", true); return; }
  try {
    await setDoc(doc(db, "config", "github"), { token: valor });
    token = valor;
    $("gh-token").value = "";
    nota("gh-msg", "");
    pintarToken();
  } catch {
    nota("gh-msg", "No se pudo guardar el token. Revisa tu conexión.", true);
  }
}

async function probar() {
  nota("gh-msg", "Probando conexión…");
  try {
    await gh("");
    nota("gh-msg", "Conexión correcta con el repositorio.");
  } catch (e) { nota("gh-msg", e.message, true); }
}

function reemplazar() {
  token = null;
  nota("gh-msg", "");
  pintarToken();
}

// ---------- Interfaz: nueva edición ----------
function mostrar(estado) {
  for (const [id, vis] of Object.entries({
    "ne-form": estado === "form",
    "ne-prog": estado === "convirtiendo" || estado === "subiendo",
    "ne-prev": estado === "previa",
    "ne-fin": estado === "fin"
  })) $(id).hidden = !vis;
}

function progreso(texto, hecho, total) {
  $("ne-prog-txt").textContent = texto;
  const bar = $("ne-prog-bar");
  bar.max = total;
  bar.value = hecho;
}

function limpiarNueva() {
  nueva?.miniaturas.forEach((u) => URL.revokeObjectURL(u));
  nueva = null;
  $("ne-miniaturas").replaceChildren();
}

function archivoElegido(file) {
  if (!file) return;
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    nota("ne-msg", "El archivo debe ser un PDF.", true);
    return;
  }
  $("ne-file").archivo = file;
  $("ne-nombre-archivo").textContent = file.name;
  nota("ne-msg", "");
}

function datosForm() {
  const id = $("ne-id").value.trim();
  const titulo = $("ne-titulo").value.trim();
  const fecha = $("ne-fecha").value.trim();
  const file = $("ne-file").archivo;
  if (!file) return "Elige o arrastra el PDF.";
  if (!RE_ID.test(id)) return "El ID debe ser AAAA-MM con sufijo opcional en minúsculas, por ejemplo 2026-11 o 2026-12-especial.";
  if (!titulo) return "Escribe el título.";
  if (!fecha) return "Escribe la fecha.";
  return { id, titulo, fecha, file };
}

async function iniciarConversion(datos) {
  $("ne-conf").hidden = true;
  mostrar("convirtiendo");
  try {
    limpiarNueva();
    nueva = await convertir(datos.file, datos, (i, t) => progreso(`Convirtiendo página ${i} de ${t}…`, i - 1, t));
    const mb = (nueva.peso / (1024 * 1024)).toFixed(2);
    $("ne-prev-info").textContent = `${nueva.titulo} · ${nueva.fecha} · ${nueva.paginas} páginas · ${mb} MB en total${nueva.ext === "jpg" ? " · Formato JPG (compatible con este navegador)" : ""}`;
    $("ne-miniaturas").replaceChildren(...nueva.miniaturas.map((u, i) => {
      const img = document.createElement("img");
      img.src = u;
      img.alt = `Página ${i + 1}`;
      return img;
    }));
    nota("ne-pub-msg", "");
    $("ne-publicar").disabled = false;
    mostrar("previa");
  } catch (e) {
    console.error(e.message);
    mostrar("form");
    nota("ne-msg", e instanceof ErrorGH ? e.message : "No se pudo convertir el PDF. Verifica que el archivo sea válido.", true);
  }
}

function convertirClick() {
  const datos = datosForm();
  if (typeof datos === "string") { nota("ne-msg", datos, true); return; }
  nota("ne-msg", "");
  if (getEdiciones().some((e) => e.id === datos.id)) {
    $("ne-conf").hidden = false;
    $("ne-conf-si").onclick = () => iniciarConversion(datos);
  } else iniciarConversion(datos);
}

async function publicar() {
  if (!nueva || ocupado) return;
  const ed = nueva;
  if (!token) { nota("ne-pub-msg", "Primero guarda el token de GitHub.", true); return; }
  ocupado = true;
  $("ne-publicar").disabled = true;
  mostrar("subiendo");
  progreso("Subiendo 0 de … archivos…", 0, 1);
  try {
    const nuevos = new Set([...ed.archivos, ...ed.textos].map((a) => a.path));
    await commitUnico({
      mensaje: `Edición ${ed.id}: ${ed.titulo}`,
      estaticos: ed.archivos,
      progreso: (h, t) => progreso(`Subiendo ${h} de ${t} archivos…`, h, t),
      construir: async ({ leer, arbol }) => {
        const lista = JSON.parse((await leer("ediciones/ediciones.json")) || "[]");
        const entrada = { id: ed.id, titulo: ed.titulo, fecha: ed.fecha, paginas: ed.paginas };
        if (ed.ext !== "webp") entrada.ext = ed.ext; // las listas leen la portada con este formato
        const pos = lista.findIndex((e) => e.id === ed.id);
        let borrar = [];
        if (pos >= 0) {
          lista[pos] = entrada;
          const prefijo = `ediciones/${ed.id}/`;
          borrar = (await arbol()).filter((p) => p.startsWith(prefijo) && !nuevos.has(p));
        } else lista.unshift(entrada);
        publicar.lista = lista;
        return {
          archivos: [
            ...ed.textos,
            { path: "ediciones/ediciones.json", text: json(lista) },
            ...(await archivosIndex(leer, lista))
          ],
          borrar
        };
      }
    });
    onCambio(publicar.lista);
    const url = `${await cargarSiteUrl()}ediciones/${ed.id}/`;
    $("ne-enlace").href = url;
    $("ne-enlace").textContent = url;
    $("ne-copiar").onclick = async () => {
      try { await navigator.clipboard.writeText(url); $("ne-copiar").textContent = "Enlace copiado"; }
      catch { $("ne-copiar").textContent = "No se pudo copiar"; }
    };
    $("ne-copiar").textContent = "Copiar enlace para WhatsApp";
    limpiarNueva();
    mostrar("fin");
  } catch (e) {
    mostrar("previa");
    $("ne-publicar").disabled = false;
    nota("ne-pub-msg", e instanceof ErrorGH ? e.message : "No se pudo publicar la edición. Inténtalo de nuevo.", true);
  } finally { ocupado = false; }
}

function reiniciarNueva() {
  limpiarNueva();
  $("ne-file").archivo = null;
  $("ne-file").value = "";
  $("ne-nombre-archivo").textContent = "Arrastra el PDF aquí o toca para elegirlo";
  ["ne-id", "ne-titulo", "ne-fecha"].forEach((i) => { $(i).value = ""; });
  $("ne-conf").hidden = true;
  nota("ne-msg", "");
  mostrar("form");
}

// ---------- Operaciones sobre ediciones existentes ----------
async function modificarLista(mensaje, cambiar, quitarCarpeta) {
  if (ocupado) throw new ErrorGH("Hay otra operación en curso.", 0);
  ocupado = true;
  let lista;
  try {
    await commitUnico({
      mensaje,
      construir: async ({ leer, arbol }) => {
        lista = JSON.parse((await leer("ediciones/ediciones.json")) || "[]");
        lista = cambiar(lista);
        const prefijo = quitarCarpeta ? `ediciones/${quitarCarpeta}/` : null;
        return {
          archivos: [
            { path: "ediciones/ediciones.json", text: json(lista) },
            ...(await archivosIndex(leer, lista))
          ],
          borrar: prefijo ? (await arbol()).filter((p) => p.startsWith(prefijo)) : []
        };
      }
    });
    onCambio(lista);
  } finally { ocupado = false; }
}

export function alternarVisible(id) {
  return modificarLista(`Cambiar visibilidad de la edición ${id}`, (lista) => lista.map((e) => {
    if (e.id !== id) return e;
    const { visible, ...resto } = e;
    return visible === false ? resto : { ...resto, visible: false };
  }));
}

export function eliminarEdicion(id) {
  return modificarLista(`Eliminar edición ${id}`, (lista) => lista.filter((e) => e.id !== id), id);
}

// ---------- Ciclo de vida ----------
export async function iniciarPublicar(opciones) {
  ({ db, getEdiciones, onCambio } = opciones);
  try {
    const snap = await getDoc(doc(db, "config", "github"));
    token = snap.exists() ? snap.data().token || null : null;
  } catch { token = null; }
  pintarToken();
}

export function detenerPublicar() {
  token = null;
  reiniciarNueva();
  pintarToken();
}

$("gh-form").addEventListener("submit", guardarToken);
$("gh-probar").addEventListener("click", probar);
$("gh-reemplazar").addEventListener("click", reemplazar);
$("ne-file").addEventListener("change", (e) => archivoElegido(e.target.files[0]));
const zona = $("ne-drop");
["dragenter", "dragover"].forEach((t) => zona.addEventListener(t, (e) => { e.preventDefault(); zona.classList.add("sobre"); }));
["dragleave", "drop"].forEach((t) => zona.addEventListener(t, (e) => { e.preventDefault(); zona.classList.remove("sobre"); }));
zona.addEventListener("drop", (e) => archivoElegido(e.dataTransfer.files[0]));
$("ne-convertir").addEventListener("click", convertirClick);
$("ne-conf-no").addEventListener("click", () => { $("ne-conf").hidden = true; });
$("ne-publicar").addEventListener("click", publicar);
$("ne-cancelar").addEventListener("click", reiniciarNueva);
$("ne-otra").addEventListener("click", reiniciarNueva);
