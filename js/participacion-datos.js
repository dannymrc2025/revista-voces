import {
  collection, doc, getDoc, getDocs, getAggregateFromServer, query, where, sum, count
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const GRUPOS = ["1A", "1B", "1C", "1D", "1E", "2A", "2B", "2C", "2D", "2E", "3A", "3B", "3C", "3D", "3E"];
export const COLOR_GRADO = ["#4CAF50", "#4FB3D9", "#E3B14A"];
export const colorGrupo = (g) => COLOR_GRADO[Number(g[0]) - 1] || "#9AA5A0";
export const REACC = [["aplauso", "👏", "#E3B14A"], ["wow", "🤯", "#4FB3D9"], ["corazon", "❤️", "#E07A5F"], ["idea", "💡", "#4CAF50"]];

export function ordenarRanking(filas) {
  const prom = (f) => (f.participantes ? f.puntos / f.participantes : 0);
  return filas.sort((a, b) => b.puntos - a.puntos || prom(b) - prom(a) || a.grupo.localeCompare(b.grupo));
}

// Une la lista de artículos con sus contadores de reacciones.
export async function cargarReacciones(db, ed) {
  const [a, r] = await Promise.all([
    getDoc(doc(db, "articulos", ed)),
    getDocs(query(collection(db, "reacciones"), where("edicion", "==", ed)))
  ]);
  const lista = (a.exists() ? a.data().lista : []) || [];
  const porId = new Map(r.docs.map((d) => [d.data().articuloId, d.data()]));
  const articulos = lista.map((x) => {
    const d = porId.get(x.id) || {};
    const fila = { id: x.id, titulo: x.titulo, seccion: x.seccion, inicio: x.inicio };
    REACC.forEach(([k]) => { fila[k] = d[k] || 0; });
    fila.total = REACC.reduce((s, [k]) => s + fila[k], 0);
    return fila;
  }).sort((x, y) => y.total - x.total);
  return { articulos, lista };
}

// Devuelve null si la edición no tiene trivia activa. "participantes" trae nombres: no mostrarlos en el reporte.
export async function cargarTrivia(db, ed) {
  const s = await getDoc(doc(db, "trivias", ed));
  if (!s.exists() || !s.data().activa) return null;
  const preguntas = s.data().preguntas || [];
  const lista = ((await getDoc(doc(db, "articulos", ed))).data()?.lista) || [];
  const [ranking, nombres] = await Promise.all([
    Promise.all(GRUPOS.map(async (grupo) => {
      const q = query(collection(db, "trivia_resultados"), where("edicion", "==", ed), where("grupo", "==", grupo));
      const d = (await getAggregateFromServer(q, { puntos: sum("aciertos"), participantes: count() })).data();
      return { grupo, puntos: d.puntos || 0, participantes: d.participantes || 0 };
    })),
    getDocs(query(collection(db, "trivia_nombres"), where("edicion", "==", ed)))
  ]);
  const part = nombres.docs.map((d) => ({ ...d.data(), fecha: d.data().fecha?.toDate?.() || null }));
  const n = part.length;
  const perfectos = part.filter((p) => p.aciertos === preguntas.length).length;
  const conResp = part.filter((p) => Array.isArray(p.respuestas) && p.respuestas.length === preguntas.length);
  const dificultad = conResp.length ? preguntas.map((p, i) => {
    const art = lista.find((x) => x.id === p.articuloId);
    const ok = conResp.filter((x) => x.respuestas[i] === p.correcta).length;
    return { texto: p.texto, seccion: art?.seccion || "", pct: Math.round((ok / conResp.length) * 100) };
  }) : [];
  return {
    preguntas,
    ranking: ordenarRanking(ranking),
    participantes: part,
    total: n,
    promedio: n ? part.reduce((s, p) => s + (p.aciertos || 0), 0) / n : 0,
    pctPerfectos: n ? Math.round((perfectos / n) * 100) : 0,
    dificultad
  };
}
