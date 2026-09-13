import { getFirestore, collection, addDoc, getDocs, doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, app } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ADMIN_UID } from './admin-config.js';

const db = getFirestore(app);

// ==========================================
// 0. CONFIGURAZIONE MATERIE (nome, id sezione, colore)
// Stessi colori usati nelle card materia del sito (style.css)
// ==========================================
const MATERIE = [
    { nome: "Matematica", id: "matematica", colore: "#00a2ff" },
    { nome: "Informatica", id: "informatica", colore: "#ff7c02" },
    { nome: "Fisica", id: "fisica", colore: "#a600ff" },
    { nome: "Scienze", id: "scienze", colore: "#0ad41f" },
    { nome: "Inglese", id: "inglese", colore: "#feadad" },
    { nome: "Italiano", id: "italiano", colore: "#ff0000" }
];

let sonoAdmin = false;

function trovaMateria(nome) {
    return MATERIE.find(m => m.nome === nome) || { nome, id: nome.toLowerCase(), colore: "#2563eb" };
}

// ==========================================
// 1. GENERAZIONE BARRA BOTTONI MATERIE (con smooth scroll)
// ==========================================
function generaBarraMaterie() {
    const barra = document.getElementById('barra-materie-esercizi');
    if (!barra) return;

    barra.innerHTML = MATERIE.map(m => `
        <button class="btn-materia-nav" style="background-color: ${m.colore};" data-target="sezione-${m.id}">
            ${m.nome}
        </button>
    `).join('');

    barra.querySelectorAll('.btn-materia-nav').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.target);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

// ==========================================
// 2. GENERAZIONE SEZIONI MATERIE (contenitori vuoti, popolati dopo da Firestore)
// ==========================================
function generaSezioniMaterie() {
    const contenitore = document.getElementById('contenitore-sezioni-materie');
    if (!contenitore) return;

    contenitore.innerHTML = MATERIE.map(m => `
        <section class="sezione-materia-esercizi" id="sezione-${m.id}">
            <div class="intestazione-sezione-materia" style="border-left-color: ${m.colore};">
                <h2>${m.nome}</h2>
            </div>
            <div class="griglia-esercizi-materia" id="griglia-${m.id}">
                <p class="messaggio-vuoto-materia">Caricamento esercizi...</p>
            </div>
        </section>
    `).join('');
}

// ==========================================
// 3. CARICAMENTO ESERCIZI DA FIRESTORE E RENDER NELLE SEZIONI
// ==========================================
async function caricaEsercizi() {
    try {
        const querySnapshot = await getDocs(collection(db, "esercizi_quiz"));

        // Svuota tutte le griglie e mostra il messaggio "nessun esercizio" di default
        MATERIE.forEach(m => {
            const griglia = document.getElementById(`griglia-${m.id}`);
            if (griglia) {
                griglia.innerHTML = `<p class="messaggio-vuoto-materia">Nessun esercizio disponibile per ora.</p>`;
            }
        });

        if (querySnapshot.empty) return;

        // Raggruppa gli esercizi per materia
        const esercizPerMateria = {};
        querySnapshot.forEach((docSnap) => {
            const es = { id: docSnap.id, ...docSnap.data() };
            if (!esercizPerMateria[es.materia]) esercizPerMateria[es.materia] = [];
            esercizPerMateria[es.materia].push(es);
        });

        // Popola ogni griglia con le rispettive schede
        Object.keys(esercizPerMateria).forEach((nomeMateria) => {
            const m = trovaMateria(nomeMateria);
            const griglia = document.getElementById(`griglia-${m.id}`);
            if (!griglia) return;

            griglia.innerHTML = esercizPerMateria[nomeMateria].map(es => `
                <div class="scheda-esercizio" style="border-left-color: ${m.colore}; position: relative;" data-url="${es.urlForm}" data-titolo="${es.titolo}">
                    ${sonoAdmin ? `
                        <button class="btn-elimina-esercizio" data-id="${es.id}" title="Elimina esercizio"
                            style="position: absolute; top: 0.6rem; right: 0.6rem; background: #fee2e2; color: #ef4444; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 0.9rem; line-height: 1;">
                            🗑️
                        </button>
                    ` : ''}
                    <span style="color: ${m.colore};">${m.nome}</span>
                    <h3>${es.titolo}</h3>
                </div>
            `).join('');
        });

        // Collega il click di ogni scheda all'apertura della modale
        document.querySelectorAll('.scheda-esercizio').forEach((scheda) => {
            scheda.addEventListener('click', () => {
                apriModaleQuiz(scheda.dataset.url, scheda.dataset.titolo);
            });
        });

        // Collega il click sul pulsante Elimina (solo admin), senza aprire la modale
        document.querySelectorAll('.btn-elimina-esercizio').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // evita che il click "passi" alla scheda e apra la modale

                if (!auth.currentUser || auth.currentUser.uid !== ADMIN_UID) {
                    alert("Solo l'amministratore può eliminare esercizi.");
                    return;
                }

                const conferma = confirm("Vuoi davvero eliminare questo esercizio? L'azione è irreversibile.");
                if (!conferma) return;

                try {
                    await deleteDoc(doc(db, "esercizi_quiz", btn.dataset.id));
                    caricaEsercizi(); // ricarica la lista aggiornata
                } catch (error) {
                    console.error("Errore durante l'eliminazione dell'esercizio:", error);
                    alert("Errore durante l'eliminazione dell'esercizio.");
                }
            });
        });

    } catch (error) {
        console.error("Errore nel caricamento degli esercizi:", error);
    }
}

// ==========================================
// 4. MODALE QUIZ (iframe Google Form)
// ==========================================
function apriModaleQuiz(url, titolo) {
    const overlay = document.getElementById('overlay-modale-quiz');
    const iframe = document.getElementById('iframe-quiz');
    const titoloModale = document.getElementById('titolo-modale-quiz');

    if (!overlay || !iframe) return;

    titoloModale.textContent = titolo || "Quiz";
    iframe.src = url;
    overlay.style.display = "flex";
}

function chiudiModaleQuiz() {
    const overlay = document.getElementById('overlay-modale-quiz');
    const iframe = document.getElementById('iframe-quiz');
    if (overlay) overlay.style.display = "none";
    if (iframe) iframe.src = ""; // ferma il caricamento/eventuale audio del form
}

const btnChiudiModale = document.getElementById('chiudi-modale-quiz');
if (btnChiudiModale) btnChiudiModale.addEventListener('click', chiudiModaleQuiz);

const overlayModale = document.getElementById('overlay-modale-quiz');
if (overlayModale) {
    overlayModale.addEventListener('click', (e) => {
        if (e.target === overlayModale) chiudiModaleQuiz(); // click sullo sfondo scuro
    });
}

// ==========================================
// 5. PANNELLO ADMIN: MOSTRA/NASCONDI + PUBBLICAZIONE ESERCIZIO
// ==========================================
onAuthStateChanged(auth, async (user) => {
    const pannelloAdmin = document.getElementById('pannello-admin-esercizi');

    sonoAdmin = !!(user && user.uid === ADMIN_UID);

    if (pannelloAdmin) {
        pannelloAdmin.style.display = sonoAdmin ? "block" : "none";
    }

    // Ricarica le schede per mostrare/nascondere i pulsanti Elimina in base al ruolo
    caricaEsercizi();
});

const formNuovoEsercizio = document.getElementById('form-nuovo-esercizio');
if (formNuovoEsercizio) {
    formNuovoEsercizio.addEventListener('submit', async (e) => {
        e.preventDefault();
        const stato = document.getElementById('stato-pubblicazione-esercizio');

        // Doppio controllo lato client: solo l'admin autenticato può pubblicare
        if (!auth.currentUser || auth.currentUser.uid !== ADMIN_UID) {
            alert("Solo l'amministratore può pubblicare esercizi.");
            return;
        }

        const titolo = document.getElementById('es-titolo').value.trim();
        const materia = document.getElementById('es-materia').value;
        const urlForm = document.getElementById('es-url').value.trim();

        if (stato) {
            stato.style.color = "#2563eb";
            stato.textContent = "Pubblicazione in corso...";
        }

        try {
            await addDoc(collection(db, "esercizi_quiz"), {
                titolo: titolo,
                materia: materia,
                urlForm: urlForm,
                timestamp: new Date().getTime()
            });

            if (stato) {
                stato.style.color = "green";
                stato.textContent = "Esercizio pubblicato con successo! 🎉";
            }
            formNuovoEsercizio.reset();
            caricaEsercizi(); // Ricarica subito la lista con il nuovo esercizio
        } catch (error) {
            console.error("Errore durante la pubblicazione dell'esercizio:", error);
            if (stato) {
                stato.style.color = "red";
                stato.textContent = "Errore durante la pubblicazione.";
            }
        }
    });
}

// ==========================================
// 6. AVVIO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    generaBarraMaterie();
    generaSezioniMaterie();
    caricaEsercizi();
});