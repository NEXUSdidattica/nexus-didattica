#!/usr/bin/env python3
"""
Genera sitemap.xml per NEXUS didattica.

Uso:
    1. Metti questo file nella cartella principale del repository
       (allo stesso livello di index.html).
    2. Apri il Terminale in quella cartella.
    3. Esegui: python3 genera_sitemap.py
    4. Verra' creato/aggiornato il file sitemap.xml nella stessa cartella.
"""

import os
from datetime import date

# ---- CONFIGURAZIONE ----------------------------------------------------

DOMINIO = "https://nexusdidattica.it"

# Cartelle da NON includere nella scansione (nomi esatti, case-sensitive)
CARTELLE_ESCLUSE = {
    ".git",
    ".github",
    "node_modules",
    "prove",  # cartella di test vista nel repository
}

# File HTML da NON includere nella sitemap (percorso relativo alla root,
# con gli slash come su Linux/Mac). Aggiungi qui altre pagine private.
FILE_ESCLUSI = {
    "admin.html",
    "login.html",
    "registrati.html",
    "profilo.html",
    "manutenzione.html",
}

# --------------------------------------------------------------------------

def trova_pagine_html(cartella_radice):
    pagine = []
    for cartella_corrente, sottocartelle, files in os.walk(cartella_radice):
        # Rimuovi le cartelle escluse dalla scansione (in place, per os.walk)
        sottocartelle[:] = [d for d in sottocartelle if d not in CARTELLE_ESCLUSE]

        for nome_file in files:
            if not nome_file.lower().endswith(".html"):
                continue

            percorso_completo = os.path.join(cartella_corrente, nome_file)
            percorso_relativo = os.path.relpath(percorso_completo, cartella_radice)
            percorso_relativo = percorso_relativo.replace(os.sep, "/")

            if percorso_relativo in FILE_ESCLUSI:
                continue

            pagine.append(percorso_relativo)

    return sorted(pagine)


def genera_xml(pagine):
    oggi = date.today().isoformat()
    righe = ['<?xml version="1.0" encoding="UTF-8"?>']
    righe.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')

    for percorso in pagine:
        url = f"{DOMINIO}/{percorso}"
        # La homepage ha priorita' massima, il resto priorita' standard
        priorita = "1.0" if percorso == "index.html" else "0.7"
        righe.append("  <url>")
        righe.append(f"    <loc>{url}</loc>")
        righe.append(f"    <lastmod>{oggi}</lastmod>")
        righe.append(f"    <priority>{priorita}</priority>")
        righe.append("  </url>")

    righe.append("</urlset>")
    return "\n".join(righe)


def main():
    cartella_radice = os.path.dirname(os.path.abspath(__file__))
    pagine = trova_pagine_html(cartella_radice)

    if not pagine:
        print("ATTENZIONE: nessuna pagina .html trovata. Controlla di aver "
              "messo questo script nella cartella giusta del repository.")
        return

    xml = genera_xml(pagine)

    output_path = os.path.join(cartella_radice, "sitemap.xml")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(xml)

    print(f"Fatto! Trovate {len(pagine)} pagine.")
    print(f"Sitemap salvata in: {output_path}")
    print("\nEsempi di pagine incluse:")
    for p in pagine[:10]:
        print(f"  - {p}")
    if len(pagine) > 10:
        print(f"  ... e altre {len(pagine) - 10} pagine")


if __name__ == "__main__":
    main()
