import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, app } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const db = getFirestore(app);

// Materie e relative sezioni, allineate a materie.html.
// Per aggiungere una nuova materia o sezione, basta aggiornare questo oggetto:
// la tendina si aggiorna automaticamente, senza toccare il resto del codice.
const MATERIE_SEZIONI = {
    "Matematica": [
        "Aritmetica",
        "Algebra",
        "Geometria Euclidea Piana",
        "Geometria Solida",
        "Geometria Analitica",
        "Trigonometria / Goniometria",
        "Analisi Matematica"
    ],
    "Informatica": [
        "Hardware & Architettura",
        "Sistemi Operativi & Software",
        "Algoritmi & Strutture Dati",
        "Linguaggi di Programmazione & Markup",
        "Reti & Web",
        "Dati, Database & Sicurezza"
    ],
    "Fisica": [
        "Strumenti & Misurazioni",
        "Dinamica & Cinematica",
        "Fluidi",
        "Termologia & Termodinamica",
        "Onde & Ottica",
        "Elettromagnetismo"
    ],
    "Scienze": [
        "Biologia",
        "Chimica",
        "Scienze della Terra"
    ],
    "Inglese": [
        "Grammar",
        "Vocabulary"
    ],
    "Italiano": [
        "Analisi Grammaticale",
        "Analisi Logica",
        "Analisi del Periodo"
    ]
};

const selectMateria = document.getElementById('verifica-materia');
const selectSezione = document.getElementById('verifica-sezione');
const formVerifiche = document.getElementById('form-verifiche');
const bloccoLoginRichiesto = document.getElementById('verifiche-login-required');
const inputEmail = document.getElementById('verifica-email');

// 0. MOSTRA IL FORM SOLO AGLI UTENTI REGISTRATI E LOGGATI
if (formVerifiche && bloccoLoginRichiesto) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            formVerifiche.style.display = "block";
            bloccoLoginRichiesto.style.display = "none";
            if (inputEmail) inputEmail.value = user.email || "";
        } else {
            formVerifiche.style.display = "none";
            bloccoLoginRichiesto.style.display = "block";
        }
    });
}

// 1. POPOLA LA TENDINA "MATERIA"
if (selectMateria) {
    Object.keys(MATERIE_SEZIONI).forEach((materia) => {
        const opt = document.createElement('option');
        opt.value = materia;
        opt.textContent = materia;
        selectMateria.appendChild(opt);
    });

    // 2. AL CAMBIO DI MATERIA, RICOSTRUISCE LA TENDINA "SEZIONE"
    selectMateria.addEventListener('change', () => {
        const sezioni = MATERIE_SEZIONI[selectMateria.value] || [];

        selectSezione.innerHTML = '';
        selectSezione.disabled = sezioni.length === 0;

        const optDefault = document.createElement('option');
        optDefault.value = '';
        optDefault.disabled = true;
        optDefault.selected = true;
        optDefault.textContent = sezioni.length ? 'Seleziona una sezione...' : 'Seleziona prima una materia...';
        selectSezione.appendChild(optDefault);

        sezioni.forEach((sezione) => {
            const opt = document.createElement('option');
            opt.value = sezione;
            opt.textContent = sezione;
            selectSezione.appendChild(opt);
        });
    });
}

// 3. INVIO DEL FORM: SALVA LA RICHIESTA SU FIRESTORE (letta dal pannello admin)
if (formVerifiche) {
    formVerifiche.addEventListener('submit', async (e) => {
        e.preventDefault();
        const stato = document.getElementById('stato-verifica');
        if (stato) {
            stato.style.color = "#2563eb";
            stato.textContent = "Invio in corso...";
        }

        try {
            await addDoc(collection(db, "richieste_verifiche"), {
                email: document.getElementById('verifica-email').value,
                materia: document.getElementById('verifica-materia').value,
                sezione: document.getElementById('verifica-sezione').value,
                argomento: document.getElementById('verifica-argomento').value,
                difficolta: document.getElementById('verifica-difficolta').value,
                classe: document.getElementById('verifica-classe').value,
                scadenza: document.getElementById('verifica-scadenza').value,
                note: document.getElementById('verifica-note').value,
                data: new Date().toLocaleString('it-IT')
            });

            if (stato) {
                stato.style.color = "green";
                stato.textContent = "Richiesta inviata con successo! Ti risponderemo al più presto. 🎉";
            }
            formVerifiche.reset();
            if (inputEmail && auth.currentUser) {
                inputEmail.value = auth.currentUser.email || "";
            }
            if (selectSezione) {
                selectSezione.innerHTML = '<option value="" disabled selected>Seleziona prima una materia...</option>';
                selectSezione.disabled = true;
            }
        } catch (error) {
            console.error("Errore invio richiesta verifica:", error);
            if (stato) {
                stato.style.color = "red";
                stato.textContent = "Errore durante l'invio della richiesta.";
            }
        }
    });
}