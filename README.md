# Voces del Corazón Maya

Revista escolar de la Escuela Secundaria Técnica #26 "José María Luis Mora". Sitio estático (HTML, CSS y JS puro) para GitHub Pages.

## Preparar el entorno (macOS)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Convertir una edición

Coloca el PDF en `pdf-originales/` (no se sube a Git) y ejecuta:

```bash
python3 scripts/convertir.py pdf-originales/revista1.pdf 2026-10 "Revista Escolar #1" "Octubre 2026"
```

Esto genera en `ediciones/2026-10/`: `paginas/pNNN-m.webp` y `pNNN-hd.webp`, `portada-og.jpg`, `info.json`, y actualiza `ediciones/ediciones.json`.

## Probar localmente

```bash
python3 -m http.server 8000
```

Abre http://localhost:8000 (necesario por el uso de `fetch`).

## Publicar una edición nueva

```bash
source .venv/bin/activate
python3 scripts/convertir.py pdf-originales/revista2.pdf 2026-11 "Revista Escolar #2" "Noviembre 2026"
git add .
git commit -m "Nueva edición 2026-11"
git push
```

El sitio queda en https://dannymrc2025.github.io/revista-voces/ (Settings > Pages, rama `main`, carpeta raíz). Los cambios tardan un par de minutos en aparecer.

## Moderar comentarios

Panel: https://dannymrc2025.github.io/revista-voces/admin.html (también desde el candado del pie de la portada). Inicia sesión con la cuenta de administrador de Firebase para aprobar, ocultar o eliminar comentarios.

Las reglas de Firestore están en `firestore.rules` y se pegan en la consola de Firebase (Firestore > Reglas > Publicar).

## Vista previa en WhatsApp

Comparte la URL `<site_url>ediciones/<edicion>/`. Esa página trae las etiquetas Open Graph y redirige al visor con JavaScript. La URL base se define en `config.json` (`site_url`).
