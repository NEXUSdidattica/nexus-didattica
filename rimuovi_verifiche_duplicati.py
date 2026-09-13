#!/usr/bin/env python3
"""
Rimuove i link duplicati a "Verifiche" nella navbar, tenendo solo la
PRIMA occorrenza in ogni file (qualunque numero di "../" abbia).

USO:
  1. Metti questo file nella cartella principale del sito (root).
  2. Apri il Terminale in quella cartella.
  3. Prova prima in modalità sicura (non modifica nulla):

         python3 rimuovi_verifiche_duplicati.py --dry-run

  4. Se l'anteprima ti convince, esegui sul serio:

         python3 rimuovi_verifiche_duplicati.py
"""

import argparse
import os
import re
import sys

# Riconosce una riga che contiene SOLO il link a verifiche.html
# (con eventuali spazi prima/dopo, e qualsiasi numero di ../)
RIGA_VERIFICHE = re.compile(
    r'^\s*<a href="(?:\.\./)*verifiche\.html">Verifiche</a>\s*$'
)


def elabora_file(percorso, dry_run):
    with open(percorso, "r", encoding="utf-8") as f:
        righe = f.readlines()

    nuove_righe = []
    trovate = 0
    rimosse = 0

    for riga in righe:
        if RIGA_VERIFICHE.match(riga):
            trovate += 1
            if trovate == 1:
                # Prima occorrenza: la teniamo
                nuove_righe.append(riga)
            else:
                # Occorrenze successive: le saltiamo (rimosse)
                rimosse += 1
        else:
            nuove_righe.append(riga)

    if rimosse == 0:
        return "nessun doppione", 0

    if not dry_run:
        with open(percorso, "w", encoding="utf-8") as f:
            f.writelines(nuove_righe)

    return f"rimossi {rimosse} doppioni (trovate {trovate} in totale)", rimosse


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

    file_con_doppioni = 0
    totale_rimosse = 0

    for percorso in sorted(file_html):
        esito, rimosse = elabora_file(percorso, args.dry_run)
        if rimosse > 0:
            file_con_doppioni += 1
            totale_rimosse += rimosse
            print(f"  {esito:45s}  {percorso}")

    print("\n=== RIEPILOGO ===")
    print(f"  File con doppioni trovati : {file_con_doppioni}")
    print(f"  Righe duplicate rimosse   : {totale_rimosse}")

    if args.dry_run:
        print("\nQuesto era un DRY-RUN: nessun file è stato modificato.")
        print("Se il riepilogo ti convince, rilancia SENZA --dry-run.")


if __name__ == "__main__":
    main()
