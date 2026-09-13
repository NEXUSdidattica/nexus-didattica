import { getFirestore, doc, getDoc, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, app } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ADMIN_UID } from './admin-config.js';

const db = getFirestore(app);
let utenteCorrente = null;

// 1. CONTROLLO ACCESSO: solo Admin e Moderatori possono vedere questa pagina.
// Un utente normale o non loggato viene rimandato subito alla Home.
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/index.html";
        return;
    }

    if (user.uid === ADMIN_UID) {
        // Il Super Admin può comunque consultare questa vista.
        utenteCorrente = user;
        caricaStudentiModeratore();
        return;
    }

    try {
        const utenteDocSnap = await getDoc(doc(db, "utenti", user.uid));
        const ruolo = utenteDocSnap.exists() ? utenteDocSnap.data().ruolo : null;

        if (ruolo !== "moderatore") {
            window.location.href = "/index.html";
            return;
        }

        utenteCorrente = user;
        caricaStudentiModeratore();
    } catch (error) {
        console.error("Errore nel controllo del ruolo:", error);
        window.location.href = "/index.html";
    }
});

// 2. TABELLA STUDENTI: sola visualizzazione. Nessun pulsante di azione:
// il moderatore non può bannare, sbloccare, promuovere o eliminare nessuno
// direttamente da qui. Admin e Moderatori non vengono nemmeno elencati.
async function caricaStudentiModeratore() {
    const tabellaBody = document.getElementById('tabella-studenti-body');
    const badgeTotale = document.getElementById('totale-studenti');
    if (!tabellaBody) return;

    try {
        const querySnapshot = await getDocs(collection(db, "utenti"));

        tabellaBody.innerHTML = "";
        let totale = 0;

        querySnapshot.forEach((docSnap) => {
            const u = docSnap.data();
            const userId = docSnap.id;
            const eAdmin = userId === ADMIN_UID;
            const eModeratore = u.ruolo === "moderatore";

            if (eAdmin || eModeratore) return;

            totale++;
            const eBannato = u.bannato === true;

            const badgeStato = eBannato
                ? '<span style="font-size: 0.8rem; color: #ef4444; font-weight: 600;">⛔ Bannato</span>'
                : '<span style="font-size: 0.8rem; color: #16a34a; font-weight: 600;">🟢 Attivo</span>';

            tabellaBody.innerHTML += `
                <tr style="border-bottom: 1px solid #f1f5f9; ${eBannato ? 'background: #fff1f2;' : ''}">
                    <td style="padding: 0.75rem 1rem; font-weight: bold; color: #1e293b;">👤 ${u.nome || 'Utente'}</td>
                    <td style="padding: 0.75rem 1rem; color: #2563eb;"><a href="mailto:${u.email}">${u.email}</a></td>
                    <td style="padding: 0.75rem 1rem; color: #64748b;">${u.dataRegistrazione || 'N/D'}</td>
                    <td style="padding: 0.75rem 1rem;">${badgeStato}</td>
                </tr>
            `;
        });

        if (totale === 0) {
            tabellaBody.innerHTML = `<tr><td colspan="4" style="padding: 1rem; text-align: center; color: #64748b;">Nessuno studente registrato al momento.</td></tr>`;
        }

        if (badgeTotale) badgeTotale.textContent = `${totale} ${totale === 1 ? 'Studente' : 'Studenti'}`;

    } catch (error) {
        console.error("Errore nel caricamento studenti:", error);
        tabellaBody.innerHTML = `<tr><td colspan="4" style="padding: 1rem; text-align: center; color: red;">Errore nel caricamento della lista studenti.</td></tr>`;
    }
}

// 3. INVIO RICHIESTA AL SUPER ADMIN (ban, eliminazioni, o qualsiasi altra azione
// che il moderatore non può fare direttamente). Salva su Firestore, letto poi
// dal pannello admin nella sezione "Richieste dai Moderatori".
const formRichiesta = document.getElementById('form-richiesta-moderatore');
if (formRichiesta) {
    formRichiesta.addEventListener('submit', async (e) => {
        e.preventDefault();
        const stato = document.getElementById('stato-richiesta-moderatore');
        if (stato) {
            stato.style.color = "#2563eb";
            stato.textContent = "Invio in corso...";
        }

        try {
            await addDoc(collection(db, "richieste_moderatori"), {
                titolo: document.getElementById('richiesta-titolo').value,
                richiesta: document.getElementById('richiesta-testo').value,
                moderatoreNome: (utenteCorrente && utenteCorrente.displayName) || "Moderatore",
                moderatoreEmail: (utenteCorrente && utenteCorrente.email) || "N/D",
                data: new Date().toLocaleString('it-IT')
            });

            if (stato) {
                stato.style.color = "green";
                stato.textContent = "Richiesta inviata! Il Super Admin la vedrà nel suo pannello.";
            }
            formRichiesta.reset();
        } catch (error) {
            console.error("Errore invio richiesta moderatore:", error);
            if (stato) {
                stato.style.color = "red";
                stato.textContent = "Errore durante l'invio della richiesta.";
            }
        }
    });
}

window.caricaStudentiModeratore = caricaStudentiModeratore;