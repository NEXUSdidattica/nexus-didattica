import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged, signOut, updateProfile,
    EmailAuthProvider, reauthenticateWithCredential,
    verifyBeforeUpdateEmail, updatePassword, deleteUser
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ADMIN_UID } from './admin-config.js';

const userNameEl = document.getElementById('user-fullname');
const userEmailEl = document.getElementById('user-email');
const logoutBtn = document.getElementById('profile-logout-btn');
const lessonsContainer = document.getElementById('lessons-container');
const lessonCountEl = document.getElementById('lesson-count');

// Stessi colori usati nelle card materia (style.css)
const coloriMateria = {
    'Matematica': '#00a2ff',
    'Informatica': '#ff7c02',
    'Fisica': '#a600ff',
    'Scienze': '#0ad41f',
    'Inglese': '#feadad',
    'Italiano': '#ff0000'
};
const coloreDefault = '#2563eb';

// --- ANTI-XSS: sanifica qualsiasi testo prima di inserirlo nell'HTML ---
function escapeHtml(valore) {
    return String(valore ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// --- ANTI-XSS: accetta come link solo URL relativi o http/https, mai javascript: o data: ---
function sanificaLink(link) {
    if (!link) return '#';
    const valore = String(link).trim();
    if (/^(https?:)?\/\//i.test(valore) || valore.startsWith('/') || (!valore.includes(':') && !valore.startsWith('//'))) {
        return escapeHtml(valore);
    }
    return '#';
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        userEmailEl.textContent = user.email;

        // 1. Recupera Nome e Cognome da Firestore
        try {
            const userDoc = await getDoc(doc(db, "utenti", user.uid));
            if (userDoc.exists()) {
                userNameEl.textContent = userDoc.data().nome || user.displayName || "Utente NEXUS";
            } else {
                userNameEl.textContent = user.displayName || "Utente NEXUS";
            }
        } catch (e) {
            userNameEl.textContent = user.displayName || "Utente NEXUS";
        }

        // 2. Carica le lezioni salvate dall'utente
        loadUserLessons(user.uid);

        // 3. Carica le richieste di verifica dell'utente
        loadUserVerifiche(user.uid);

    } else {
        // Se non è loggato, reindirizza al login
        window.location.href = "login.html";
    }
});

async function loadUserLessons(userId) {
    try {
        const q = query(collection(db, "user_lessons"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            lessonsContainer.style.display = 'block';
            lessonsContainer.style.width = '100%';
            lessonsContainer.innerHTML = `
                <div style="width: 100%; text-align: center; padding: 3rem 1rem; color: #64748b; box-sizing: border-box;">
                    <p style="font-size: 1.1rem; margin-bottom: 0.75rem; color: #475569;">Non hai ancora salvato nessuna lezione.</p>
                    <a href="materie.html" style="color: #2563eb; text-decoration: none; font-weight: 600; display: inline-block;">Esplora le materie →</a>
                </div>
            `;
            lessonCountEl.textContent = "0 lezioni";
            return;
        }

        lessonCountEl.textContent = `${querySnapshot.size} lezion${querySnapshot.size === 1 ? 'e' : 'i'}`;
        lessonsContainer.innerHTML = '';

        // Assicuriamoci che il contenitore principale usi un layout a colonna singola (striscia)
        lessonsContainer.style.display = 'flex';
        lessonsContainer.style.flexDirection = 'column';
        lessonsContainer.style.gap = '1rem';
        lessonsContainer.style.width = '100%';

        querySnapshot.forEach((doc) => {
            const lesson = doc.data();
            const coloreMateria = coloriMateria[lesson.materia] || coloreDefault;

            // Sanifichiamo tutti i valori che provengono dal database prima di inserirli nell'HTML
            const materiaSicura = escapeHtml(lesson.materia || 'MATEMATICA');
            const titoloSicuro = escapeHtml(lesson.titolo);
            const linkSicuro = sanificaLink(lesson.link);

            lessonsContainer.innerHTML += `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem 1.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; width: 100%; box-sizing: border-box; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 6px 16px rgba(0,0,0,0.06)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.03)'">
                    <div style="flex: 1;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: ${coloreMateria}; text-transform: uppercase; letter-spacing: 0.05em;">${materiaSicura}</span>
                        <h3 style="margin: 0.3rem 0 0 0; font-size: 1.2rem; color: #0f172a; font-weight: 600;">${titoloSicuro}</h3>
                    </div>
                    <div style="flex-shrink: 0;">
                        <a href="${linkSicuro}" style="background-color: ${coloreMateria}; color: white; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; white-space: nowrap;">
                            Riprendi lezione →
                        </a>
                    </div>
                </div>
            `;
        });

    } catch (error) {
        console.error("Errore recupero lezioni:", error);
        lessonsContainer.innerHTML = `<p style="color: #ef4444; width: 100%;">Impossibile caricare le lezioni salvate.</p>`;
    }
}

// ==========================================
// LE MIE RICHIESTE DI VERIFICA
// ==========================================
async function loadUserVerifiche(userId) {
    const container = document.getElementById('mie-verifiche-container');
    const countEl = document.getElementById('verifiche-count');
    if (!container) return;

    try {
        const q = query(collection(db, "richieste_verifiche"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            container.innerHTML = `
                <div style="width: 100%; text-align: center; padding: 2rem 1rem; color: #64748b;">
                    <p style="margin-bottom: 0.75rem;">Non hai ancora inviato nessuna richiesta di verifica.</p>
                    <a href="verifiche.html" style="color: #2563eb; text-decoration: none; font-weight: 600;">Richiedi una verifica →</a>
                </div>
            `;
            if (countEl) countEl.textContent = "0 richieste";
            return;
        }

        const richieste = querySnapshot.docs
            .map((d) => d.data())
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (countEl) countEl.textContent = `${richieste.length} richiest${richieste.length === 1 ? 'a' : 'e'}`;

        // Sanifichiamo ogni campo prima di costruire l'HTML: queste richieste sono
        // compilate dagli utenti stessi tramite un form (verifiche.html), quindi
        // vanno trattate come input non fidato.
        container.innerHTML = richieste.map((r) => {
            const daFare = r.stato !== "Inviata";
            const coloreBadge = daFare ? "#fef3c7" : "#dcfce7";
            const coloreTesto = daFare ? "#92400e" : "#166534";
            const testoBadge = daFare ? "🕓 Da fare" : "✅ Inviata";

            const argomentoSicuro = escapeHtml(r.argomento || '-');
            const classeSicura = escapeHtml(r.classe || '-');
            const difficoltaSicura = escapeHtml(r.difficolta || '-');
            const scadenzaSicura = escapeHtml(r.scadenza || '-');

            return `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.1rem 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap;">
                        <div>
                            <p style="margin: 0; font-weight: 700; color: #1e293b;">${argomentoSicuro}</p>
                            <p style="margin: 0.3rem 0 0; font-size: 0.85rem; color: #64748b;">
                                Classe: ${classeSicura} · Difficoltà: ${difficoltaSicura} · Scadenza: ${scadenzaSicura}
                            </p>
                        </div>
                        <span style="background: ${coloreBadge}; color: ${coloreTesto}; padding: 0.3rem 0.7rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; white-space: nowrap;">${testoBadge}</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Errore recupero richieste verifica:", error);
        container.innerHTML = `<p style="color: #ef4444;">Impossibile caricare le richieste di verifica.</p>`;
    }
}

// ==========================================
// MODIFICA PROFILO: NOME
// ==========================================
const formNome = document.getElementById('form-modifica-nome');
if (formNome) {
    formNome.addEventListener('submit', async (e) => {
        e.preventDefault();
        const stato = document.getElementById('stato-nome');
        const nuovoNome = document.getElementById('nuovo-nome').value.trim();
        const user = auth.currentUser;
        if (!user || !nuovoNome) return;

        stato.style.color = "#2563eb";
        stato.textContent = "Salvataggio...";

        try {
            await updateProfile(user, { displayName: nuovoNome });
            await setDoc(doc(db, "utenti", user.uid), { nome: nuovoNome }, { merge: true });

            userNameEl.textContent = nuovoNome;
            stato.style.color = "green";
            stato.textContent = "Nome aggiornato con successo! 🎉";
            formNome.reset();
        } catch (error) {
            console.error("Errore aggiornamento nome:", error);
            stato.style.color = "red";
            stato.textContent = "Errore durante l'aggiornamento del nome.";
        }
    });
}

// ==========================================
// MODIFICA PROFILO: EMAIL (richiede ri-autenticazione)
// ==========================================
const formEmail = document.getElementById('form-modifica-email');
if (formEmail) {
    formEmail.addEventListener('submit', async (e) => {
        e.preventDefault();
        const stato = document.getElementById('stato-email');
        const nuovaEmail = document.getElementById('nuova-email').value.trim();
        const passwordAttuale = document.getElementById('email-password-attuale').value;
        const user = auth.currentUser;
        if (!user) return;

        stato.style.color = "#2563eb";
        stato.textContent = "Verifica in corso...";

        try {
            const credenziali = EmailAuthProvider.credential(user.email, passwordAttuale);
            await reauthenticateWithCredential(user, credenziali);

            await verifyBeforeUpdateEmail(user, nuovaEmail);

            stato.style.color = "green";
            stato.textContent = `Ti abbiamo inviato un'email di conferma a ${nuovaEmail}. Il cambio sarà effettivo dopo aver cliccato il link. 📧`;
            formEmail.reset();
        } catch (error) {
            console.error("Errore cambio email:", error.code, error.message);
            stato.style.color = "red";
            stato.textContent = tradurreErroreAuth(error.code, "Errore durante il cambio email.");
        }
    });
}

// ==========================================
// MODIFICA PROFILO: PASSWORD (richiede ri-autenticazione)
// ==========================================
const formPassword = document.getElementById('form-modifica-password');
if (formPassword) {
    formPassword.addEventListener('submit', async (e) => {
        e.preventDefault();
        const stato = document.getElementById('stato-password');
        const passwordAttuale = document.getElementById('password-attuale').value;
        const passwordNuova = document.getElementById('password-nuova').value;
        const user = auth.currentUser;
        if (!user) return;

        stato.style.color = "#2563eb";
        stato.textContent = "Verifica in corso...";

        try {
            const credenziali = EmailAuthProvider.credential(user.email, passwordAttuale);
            await reauthenticateWithCredential(user, credenziali);

            await updatePassword(user, passwordNuova);

            stato.style.color = "green";
            stato.textContent = "Password aggiornata con successo! 🎉";
            formPassword.reset();
        } catch (error) {
            console.error("Errore cambio password:", error.code, error.message);
            stato.style.color = "red";
            stato.textContent = tradurreErroreAuth(error.code, "Errore durante il cambio password.");
        }
    });
}

// ==========================================
// ELIMINA ACCOUNT (richiede ri-autenticazione)
// ==========================================
const formElimina = document.getElementById('form-elimina-account');
if (formElimina) {
    formElimina.addEventListener('submit', async (e) => {
        e.preventDefault();
        const stato = document.getElementById('stato-eliminazione');
        const passwordAttuale = document.getElementById('elimina-password-attuale').value;
        const user = auth.currentUser;
        if (!user) return;

        // Blocco di sicurezza: l'admin non può eliminare se stesso da qui
        if (user.uid === ADMIN_UID) {
            stato.style.color = "red";
            stato.textContent = "L'account amministratore non può essere eliminato da questa pagina.";
            return;
        }

        const conferma = confirm("Sei ASSOLUTAMENTE sicuro di voler eliminare il tuo account? Questa azione è irreversibile e cancellerà anche tutte le tue lezioni salvate e richieste di verifica.");
        if (!conferma) return;

        stato.style.color = "#2563eb";
        stato.textContent = "Verifica in corso...";

        try {
            const credenziali = EmailAuthProvider.credential(user.email, passwordAttuale);
            await reauthenticateWithCredential(user, credenziali);

            stato.textContent = "Eliminazione dati in corso...";

            // 1. Elimina tutte le lezioni salvate dell'utente
            const lezioniSnap = await getDocs(query(collection(db, "user_lessons"), where("userId", "==", user.uid)));
            await Promise.all(lezioniSnap.docs.map((d) => deleteDoc(doc(db, "user_lessons", d.id))));

            // 2. Elimina tutte le richieste di verifica dell'utente
            const verificheSnap = await getDocs(query(collection(db, "richieste_verifiche"), where("userId", "==", user.uid)));
            await Promise.all(verificheSnap.docs.map((d) => deleteDoc(doc(db, "richieste_verifiche", d.id))));

            // 3. Elimina il documento utente
            await deleteDoc(doc(db, "utenti", user.uid));

            // 4. Elimina l'account da Firebase Auth (deve essere l'ultimo passo)
            await deleteUser(user);

            alert("Account eliminato con successo. Ci dispiace vederti andare via!");
            window.location.href = "index.html";
        } catch (error) {
            console.error("Errore eliminazione account:", error.code, error.message);
            stato.style.color = "red";
            stato.textContent = tradurreErroreAuth(error.code, "Errore durante l'eliminazione dell'account.");
        }
    });
}

// ==========================================
// TRADUZIONE ERRORI FIREBASE AUTH (comuni alle 3 azioni sopra)
// ==========================================
function tradurreErroreAuth(code, messaggioDefault) {
    switch (code) {
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Password attuale non corretta.';
        case 'auth/email-already-in-use':
            return 'Questa email è già associata a un altro account.';
        case 'auth/invalid-email':
            return 'Indirizzo email non valido.';
        case 'auth/weak-password':
            return 'La nuova password è troppo debole (minimo 8 caratteri).';
        case 'auth/requires-recent-login':
            return 'Per motivi di sicurezza, esci e accedi di nuovo prima di riprovare.';
        case 'auth/too-many-requests':
            return 'Troppi tentativi. Riprova più tardi.';
        default:
            return messaggioDefault;
    }
}

// Gestione Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = "index.html";
    });
}