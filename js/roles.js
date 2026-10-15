export const GRUPOS = {
  "1.er grado": ["1A", "1B", "1C", "1D", "1E"],
  "2.º grado": ["2A", "2B", "2C", "2D", "2E"],
  "3.er grado": ["3A", "3B", "3C", "3D", "3E"]
};

const CLASES = { "Alumno": "rol-alumno", "Docente": "rol-docente", "Padre o madre de familia": "rol-padre" };

// Cualquier rol desconocido (p. ej. "Otro" en comentarios antiguos) usa el gris neutro.
export const claseRol = (rol) => CLASES[rol] || "rol-otro";

export function etiquetaRol(c) {
  const s = document.createElement("span");
  s.className = "rol-pill";
  s.textContent = c.rol === "Alumno" && c.grupo ? `Alumno · ${c.grupo}` : c.rol;
  return s;
}
