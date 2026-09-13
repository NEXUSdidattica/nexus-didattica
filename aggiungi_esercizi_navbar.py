#!/usr/bin/env python3
"""
Aggiunge il link "Esercizi" subito dopo "Chi Siamo" nella NAVBAR di tutte
le pagine HTML del sito NEXUS didattica — senza toccare il footer.

Come riconosce navbar da footer:
  Nel menu in alto, subito dopo "Chi Siamo" c'è sempre il link "Materie".
  Nel footer, dopo "Chi Siamo" c'è sempre "Contatti" (mai "Materie").
  Lo script inserisce "Esercizi" SOLO quando trova quella sequenza precisa.

Gestisce automaticamente qualsiasi numero di "../" davanti a chi_siamo.html
(0, 1, 2... a seconda di quanto è annidato il file), e usa lo stesso
numero di "../" per il nuovo link a esercizi.html.

USO:
  1. Metti questo file nella cartella principale del sito (root, insieme
     a index.html, style.css, ecc.)
  2. Apri il Terminale in quella cartella
  3. Prova prima in modalità DRY-RUN (non modifica nulla, mostra solo
     un'anteprima di cosa farebbe):

         python3 aggiungi_esercizi_navbar.py --dry-run

  4. Se l'anteprima sembra corretta, esegui sul serio:

         python3 aggiungi_esercizi_navbar.py

Lo script è SICURO da rilanciare più volte: se un file ha già il link
Esercizi al posto giusto, lo salta senza duplicarlo.
"""

import argparse
import os
import re
import sys

# Cerca "Chi Siamo" (con qualsiasi prefisso ../) seguito, subito dopo,
# da un link che inizia con "materie" (con qualsiasi prefisso ../).
# Questo è vero SOLO in navbar, mai nel footer.
PATTERN = re.compile(
    r'(<a href="((?:\.\./)*)chi_siamo\.html"[^>]*>Chi Siamo</a>)'
    r'(\s*<a href="(?:\.\./)*materie)',
    re.IGNORECASE
)

# Se il link Esercizi è GIA' presente subito dopo Chi Siamo, non rifare nulla
GIA_PRESENTE = re.compile(
    r'<a href="((?:\.\./)*)chi_siamo\.html"[^>]*>Chi Siamo</a>\s*'
    r'<a href="(?:\.\./)*esercizi\.html">Esercizi</a>',
    re.IGNORECASE
)


def elabora_file(percorso, dry_run):
    with open(percorso, "r", encoding="utf-8") as f:
        contenuto = f.read()

    if GIA_PRESENTE.search(contenuto):
        return "già presente"

    def sostituisci(m):
        prefisso = m.group(2)  # es. "", "../", "../../"
        chi_siamo_tag = m.group(1)
        resto = m.group(3)
        nuovo_link = f'\n                <a href="{prefisso}esercizi.html">Esercizi</a>'
        return chi_siamo_tag + nuovo_link + resto

    nuovo_contenuto, n_sostituzioni = PATTERN.subn(sostituisci, contenuto)

    if n_sostituzioni == 0:
        return "nessuna navbar trovata"

    if not dry_run:
        with open(percorso, "w", encoding="utf-8") as f:
            f.write(nuovo_contenuto)

    return f"aggiornato ({n_sostituzioni} navbar)"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                         help="Mostra cosa farebbe senza modificare i file")
    parser.add_argument("--cartella", default=".",
                         help="Cartella radice del sito (default: quella corrente)")
    args = parser.parse_args()

    file_html = []
    for radice, _dirs, files in os.walk(args.cartella):
        for nome in files:
            if nome.lower().endswith(".html"):
                file_html.append(os.path.join(radice, nome))

    if not file_html:
        print("Nessun file .html trovato. Sei nella cartella giusta?")
        sys.exit(1)

    print(f"Trovati {len(file_html)} file .html. "
          f"{'DRY-RUN (nessuna modifica reale)' if args.dry_run else 'Modalità SCRITTURA'}\n")

    contatori = {}
    for percorso in sorted(file_html):
        esito = elabora_file(percorso, args.dry_run)
        contatori[esito] = contatori.get(esito, 0) + 1
        # Mostra solo le righe interessanti per non intasare il terminale
        if "aggiornato" in esito or "nessuna" in esito:
            print(f"  {esito:28s}  {percorso}")

    print("\n=== RIEPILOGO ===")
    for esito, conteggio in contatori.items():
        print(f"  {conteggio:5d}  {esito}")

    if args.dry_run:
        print("\nQuesto era un DRY-RUN: nessun file è stato modificato.")
        print("Se il riepilogo ti convince, rilancia SENZA --dry-run.")


if __name__ == "__main__":
    main()
