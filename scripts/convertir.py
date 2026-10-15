#!/usr/bin/env python3
"""Convierte un PDF en una edición web de la revista.

Uso: python3 scripts/convertir.py <ruta.pdf> <nombre-edicion> "<título>" "<fecha>"
"""
import json
import re
import sys
from html import escape
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ANCHO_RENDER = 1800
ANCHO_M = 1000
OG_SIZE = (1200, 630)
OG_FONDO = "#12201c"
OG_MAX_BYTES = 300 * 1024
SITIO = "Voces del Corazón Maya"


def cargar_site_url():
    cfg = json.loads((RAIZ / "config.json").read_text(encoding="utf-8"))
    return cfg["site_url"].rstrip("/") + "/"


def etiquetas_og(site_url, ed_id, titulo, fecha):
    q = lambda s: escape(s, quote=True)
    url = f"{site_url}ediciones/{ed_id}/"
    return "\n".join([
        f'  <meta property="og:title" content="{q(SITIO + " – " + titulo)}">',
        f'  <meta property="og:description" content="{q("Revista escolar de la EST #26 José María Luis Mora · " + fecha)}">',
        f'  <meta property="og:image" content="{q(url + "portada-og.jpg")}">',
        '  <meta property="og:image:width" content="1200">',
        '  <meta property="og:image:height" content="630">',
        f'  <meta property="og:url" content="{q(url)}">',
        '  <meta property="og:type" content="website">',
        '  <meta property="og:locale" content="es_MX">',
    ])


def crear_entrada(carpeta, site_url, ed_id, titulo, fecha):
    q = lambda s: escape(s, quote=True)
    visor = f"../../revista.html?ed={ed_id}"
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{q(SITIO + " – " + titulo)}</title>
{etiquetas_og(site_url, ed_id, titulo, fecha)}
  <link rel="stylesheet" href="../../css/styles.css">
  <script>location.replace({json.dumps(visor)});</script>
</head>
<body>
  <main class="contenedor entrada">
    <h1>{q(titulo)}</h1>
    <p>{q(fecha)}</p>
    <img src="paginas/p001-m.webp" alt="Portada de {q(titulo)}" width="400">
    <p><a class="boton" href="{q(visor)}">Leer la revista</a></p>
  </main>
</body>
</html>
"""
    (carpeta / "index.html").write_text(html, encoding="utf-8")


def actualizar_index(site_url, ed):
    ruta = RAIZ / "index.html"
    bloque = etiquetas_og(site_url, ed["id"], ed["titulo"], ed["fecha"])
    texto = ruta.read_text(encoding="utf-8")
    nuevo = re.sub(
        r"(<!-- og:inicio -->\n).*?(\n\s*<!-- og:fin -->)",
        lambda m: m.group(1) + bloque + m.group(2),
        texto,
        flags=re.S,
    )
    ruta.write_text(nuevo, encoding="utf-8")


def mb(n_bytes):
    return n_bytes / (1024 * 1024)


def crear_og(portada, destino):
    lienzo = Image.new("RGB", OG_SIZE, OG_FONDO)
    img = portada.convert("RGB")
    img.thumbnail(OG_SIZE, Image.LANCZOS)
    x = (OG_SIZE[0] - img.width) // 2
    y = (OG_SIZE[1] - img.height) // 2
    lienzo.paste(img, (x, y))
    calidad = 80
    while True:
        lienzo.save(destino, "JPEG", quality=calidad, optimize=True)
        if destino.stat().st_size < OG_MAX_BYTES or calidad <= 40:
            break
        calidad -= 5  # WhatsApp ignora imágenes de más de 300 KB


def actualizar_ediciones(ruta, entrada):
    lista = []
    if ruta.exists():
        lista = json.loads(ruta.read_text(encoding="utf-8"))
    for i, e in enumerate(lista):
        if e.get("id") == entrada["id"]:
            lista[i] = entrada
            break
    else:
        lista.insert(0, entrada)  # la más reciente primero
    ruta.write_text(json.dumps(lista, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    if len(sys.argv) != 5:
        print(__doc__)
        sys.exit(1)

    pdf_ruta = Path(sys.argv[1])
    nombre, titulo, fecha = sys.argv[2], sys.argv[3], sys.argv[4]

    if not pdf_ruta.is_file():
        sys.exit(f"No se encontró el PDF: {pdf_ruta}")
    if "/" in nombre or "\\" in nombre or nombre.startswith("."):
        sys.exit("El nombre de la edición no es válido.")

    site_url = cargar_site_url()
    carpeta = RAIZ / "ediciones" / nombre
    paginas_dir = carpeta / "paginas"
    paginas_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_ruta)
    total = doc.page_count
    ancho_pt = round(doc[0].rect.width, 2)
    alto_pt = round(doc[0].rect.height, 2)
    peso_m = peso_hd = 0

    for i, pagina in enumerate(doc, start=1):
        zoom = ANCHO_RENDER / pagina.rect.width
        pix = pagina.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

        base = f"p{i:03d}"
        ruta_hd = paginas_dir / f"{base}-hd.webp"
        ruta_m = paginas_dir / f"{base}-m.webp"

        img.save(ruta_hd, "WEBP", quality=80, method=6)
        alto_m = round(img.height * ANCHO_M / img.width)
        img.resize((ANCHO_M, alto_m), Image.LANCZOS).save(ruta_m, "WEBP", quality=75, method=6)

        peso_m += ruta_m.stat().st_size
        peso_hd += ruta_hd.stat().st_size
        print(f"[{i}/{total}] {base} listo")

        if i == 1:
            crear_og(img, carpeta / "portada-og.jpg")

    doc.close()

    info = {"titulo": titulo, "fecha": fecha, "paginas": total, "ancho": ancho_pt, "alto": alto_pt}
    (carpeta / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    ruta_lista = RAIZ / "ediciones" / "ediciones.json"
    actualizar_ediciones(
        ruta_lista,
        {"id": nombre, "titulo": titulo, "fecha": fecha, "paginas": total},
    )
    crear_entrada(carpeta, site_url, nombre, titulo, fecha)
    actualizar_index(site_url, json.loads(ruta_lista.read_text(encoding="utf-8"))[0])

    print(f"\nEdición '{nombre}' lista: {total} páginas")
    print(f"Peso versión m:  {mb(peso_m):.2f} MB")
    print(f"Peso versión hd: {mb(peso_hd):.2f} MB")


if __name__ == "__main__":
    main()
