import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, app } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ADMIN_UID } from './admin-config.js';

const db = getFirestore(app);

// 1. GESTIONE AUTENTICAZIONE E VISTE ADMIN/UTENTE
const authButtons = document.querySelector('.auth-buttons');

onAuthStateChanged(auth, async (user) => {
    const adminLink = document.getElementById('admin-link');
    const sezioneAdminProfilo = document.getElementById('sezione-admin-profilo');
    const sezioneLezioni = document.getElementById('sezione-lezioni-utente');

    if (user) {
        // Controllo BAN: se l'utente è stato bloccato dall'admin, lo disconnettiamo subito
        if (user.uid !== ADMIN_UID) {
            try {
                const utenteDocSnap = await getDoc(doc(db, "utenti", user.uid));
                if (utenteDocSnap.exists() && utenteDocSnap.data().bannato === true) {
                    await signOut(auth);
                    alert("Il tuo account è stato sospeso. Contatta l'assistenza se pensi sia un errore.");
                    window.location.href = "/index.html";
                    return;
                }
            } catch (error) {
                console.error("Errore nel controllo stato account:", error);
            }
        }

        if (authButtons) {
            const nomeUtente = user.displayName || "Profilo";
            authButtons.innerHTML = `
                <a href="/profilo.html" class="btn-profile">👤 ${nomeUtente}</a>
                <button id="logout-btn" class="btn-logout">Esci</button>
            `;

            document.getElementById('logout-btn').addEventListener('click', async () => {
                await signOut(auth);
                window.location.reload();
            });
        }

        if (user.uid === ADMIN_UID) {
            if (adminLink) adminLink.style.display = "inline-block";
            if (sezioneAdminProfilo) sezioneAdminProfilo.style.display = "block";
            if (sezioneLezioni) sezioneLezioni.style.display = "none";
            console.log("Modalità Admin Attiva 👑");

            const adminDocRef = doc(db, "utenti", ADMIN_UID);
            const adminDocSnap = await getDoc(adminDocRef);
            if (!adminDocSnap.exists()) {
                await setDoc(adminDocRef, {
                    nome: user.displayName || "NEXUS Admin",
                    email: user.email,
                    dataRegistrazione: new Date().toLocaleDateString('it-IT')
                });
            }
        } else {
            if (adminLink) adminLink.style.display = "none";
            if (sezioneAdminProfilo) sezioneAdminProfilo.style.display = "none";
            if (sezioneLezioni) sezioneLezioni.style.display = "block";
        }

        if (window.location.pathname.includes("admin.html")) {
            caricaUtentiAdmin();
        }

    } else {
        if (authButtons) {
            authButtons.innerHTML = `
                <a href="/login.html" class="btn-login">Accedi</a>
                <a href="/registrati.html" class="btn-register">Registrati</a>
            `;
        }
        if (adminLink) adminLink.style.display = "none";
        if (sezioneAdminProfilo) sezioneAdminProfilo.style.display = "none";
        if (sezioneLezioni) sezioneLezioni.style.display = "block";
    }
});

// 2. PUBBLICAZIONE NUOVO ESERCIZIO E GESTIONE STORICO
const formSfida = document.getElementById('form-sfida');
if (formSfida) {
    formSfida.addEventListener('submit', async (e) => {
        e.preventDefault();
        const stato = document.getElementById('stato-sfida');
        if (stato) stato.textContent = "Salvataggio in corso...";

        const materiaTitolo = document.getElementById('materia-titolo').value;
        const testoSfida = document.getElementById('testo-sfida').value;
        const titoloPassato = document.getElementById('titolo-passato').value;
        const soluzionePassata = document.getElementById('soluzione-passata').value;
        const dataAttuale = new Date().toLocaleString('it-IT');

        try {
            // A. Salva l'esercizio corrente per la Home Page
            await setDoc(doc(db, "esercizi_settimana", "attuale"), {
                materiaTitolo: materiaTitolo,
                testoSfida: testoSfida,
                titoloPassato: titoloPassato,
                soluzionePassata: soluzionePassata,
                dataAggiornamento: new Date().toISOString()
            });

            // B. Se hai inserito una soluzione passata, aggiorna l'ultimo quesito salvato nello storico!
            if (soluzionePassata.trim() !== "") {
                const querySnapshot = await getDocs(collection(db, "storico_esercizi"));
                if (!querySnapshot.empty) {
                    const docs = querySnapshot.docs.sort((a, b) => b.data().timestamp - a.data().timestamp);
                    const ultimoDoc = docs[0]; // Trova il quesito precedente

                    await setDoc(doc(db, "storico_esercizi", ultimoDoc.id), {
                        soluzioneSalvata: soluzionePassata
                    }, { merge: true });
                }
            }

            // C. Salva il NUOVO quesito nello storico (in attesa di soluzione per la prossima volta)
            await addDoc(collection(db, "storico_esercizi"), {
                materiaTitolo: materiaTitolo,
                testoSfida: testoSfida,
                soluzioneSalvata: "",
                dataPubblicazione: dataAttuale,
                timestamp: new Date().getTime()
            });

            if (stato) {
                stato.style.color = "green";
                stato.textContent = "Esercizio aggiornato e storico allineato! 🎉";
            }
            formSfida.reset();
            caricaStoricoEserciziAdmin();
        } catch (error) {
            console.error("Errore salvataggio:", error);
            if (stato) {
                stato.style.color = "red";
                stato.textContent = "Errore durante il salvataggio.";
            }
        }
    });
}

// 2.1 FUNZIONE PER MOSTRARE L'ARCHIVIO STORICO ALL'ADMIN
async function caricaStoricoEserciziAdmin() {
    const listaElem = document.getElementById('lista-storico-esercizi');
    const badgeTotale = document.getElementById('totale-esercizi-storico');
    if (!listaElem) return;

    try {
        const querySnapshot = await getDocs(collection(db, "storico_esercizi"));

        if (querySnapshot.empty) {
            listaElem.innerHTML = "<p style='color: #64748b;'>Nessun esercizio presente nello storico.</p>";
            if (badgeTotale) badgeTotale.textContent = "0 Quesiti Salvati";
            return;
        }

        const docs = querySnapshot.docs.sort((a, b) => b.data().timestamp - a.data().timestamp);

        listaElem.innerHTML = "";
        let totale = docs.length;

        docs.forEach((docSnap) => {
            const item = docSnap.data();
            listaElem.innerHTML += `
                <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-weight: bold; color: #2563eb; font-size: 0.9rem;">📌 ${item.materiaTitolo}</span>
                        <span style="font-size: 0.8rem; color: #64748b;">${item.dataPubblicazione || 'Data N/D'}</span>
                    </div>
                    <p style="margin: 0; color: #1e293b; font-weight: 600; font-size: 0.95rem;">${item.testoSfida}</p>
                    ${item.soluzioneSalvata ? `
                        <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #166534; background: #f0fdf4; padding: 0.5rem; border-radius: 6px; border: 1px solid #bbf7d0;">
                            <strong>Soluzione salvata:</strong> ${item.soluzioneSalvata}
                        </div>
                    ` : '<div style="margin-top:0.4rem; font-size:0.75rem; color:#94a3b8; font-style:italic;">In attesa di soluzione...</div>'}
                </div>
            `;
        });

        if (badgeTotale) badgeTotale.textContent = `${totale} Quesit${totale === 1 ? 'o Salvato' : 'i Salvati'}`;

    } catch (error) {
        console.error("Errore caricamento storico esercizi:", error);
        listaElem.innerHTML = "<p style='color: red;'>Errore nel caricamento dello storico.</p>";
    }
}

if (window.location.pathname.includes("admin.html")) {
    caricaStoricoEserciziAdmin();
}


// 3. CARICAMENTO ESERCIZIO SULLA HOME PAGE
async function caricaEsercizioHome() {
    try {
        const docRef = doc(db, "esercizi_settimana", "attuale");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            const elemMateria = document.getElementById('nuovo-quesito-titolo');
            const elemTesto = document.getElementById('nuovo-quesito-testo');
            const elemTitoloVecchio = document.getElementById('vecchia-soluzione-titolo');
            const elemSoluzioneVecchia = document.getElementById('vecchia-soluzione-testo');

            if (elemMateria && data.materiaTitolo) {
                elemMateria.textContent = data.materiaTitolo;
            }
            if (elemTesto && data.testoSfida) {
                elemTesto.innerHTML = data.testoSfida.replace(/\n/g, '<br>');
            }
            if (elemTitoloVecchio && data.titoloPassato) {
                elemTitoloVecchio.textContent = "Quesito: " + data.titoloPassato;
            }
            if (elemSoluzioneVecchia && data.soluzionePassata) {
                elemSoluzioneVecchia.innerHTML = `<p>${data.soluzionePassata.replace(/\n/g, '<br>')}</p>`;
            }
        }
    } catch (error) {
        console.error("Errore nel caricamento della sfida:", error);
    }
}

// Avvio automatico quando il DOM è del tutto caricato
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.es-settimana')) {
        caricaEsercizioHome();
    }
});

// 4. SALVATAGGIO MESSAGGI DA CONTATTI.HTML
const formContatti = document.getElementById('form-contatti');
if (formContatti) {
    formContatti.addEventListener('submit', async (e) => {
        e.preventDefault();
        const stato = document.getElementById('stato-messaggio');
        if (stato) {
            stato.style.color = "#2563eb";
            stato.textContent = "Invio in corso...";
        }

        try {
            await addDoc(collection(db, "messaggi_contatti"), {
                nome: document.getElementById('nome').value,
                email: document.getElementById('email').value,
                motivo: document.getElementById('motivo').value,
                messaggio: document.getElementById('messaggio').value,
                data: new Date().toLocaleString('it-IT')
            });

            if (stato) {
                stato.style.color = "green";
                stato.textContent = "Messaggio inviato con successo! Ti risponderemo al più presto. 🎉";
            }
            formContatti.reset();
        } catch (error) {
            console.error("Errore invio messaggio:", error);
            if (stato) {
                stato.style.color = "red";
                stato.textContent = "Errore durante l'invio del messaggio.";
            }
        }
    });
}

// 5. MOSTRA MESSAGGI NEL PANNELLO ADMIN (ADMIN.HTML)
async function caricaMessaggiAdmin() {
    const listaElem = document.getElementById('lista-messaggi');
    if (!listaElem) return;

    try {
        const querySnapshot = await getDocs(collection(db, "messaggi_contatti"));
        if (querySnapshot.empty) {
            listaElem.innerHTML = "<p style='color: #64748b;'>Nessun messaggio ricevuto finora.</p>";
            return;
        }

        listaElem.innerHTML = "";
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            listaElem.innerHTML += `
                <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 1.2rem; border-radius: 10px; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; color: #1e293b; margin-bottom: 0.5rem;">
                        <span>👤 ${data.nome} (<a href="mailto:${data.email}">${data.email}</a>)</span>
                        <span style="font-size: 0.85rem; color: #64748b;">${data.data}</span>
                    </div>
                    <p style="margin: 0.2rem 0; font-size: 0.9rem; color: #2563eb;"><strong>Motivo:</strong> ${data.motivo}</p>
                    <p style="margin-top: 0.5rem; color: #334155; line-height: 1.5;">${data.messaggio}</p>
                </div>
            `;
        });
    } catch (error) {
        console.error("Errore nel caricamento messaggi:", error);
        listaElem.innerHTML = "<p style='color: red;'>Errore nel caricamento dei messaggi.</p>";
    }
}

if (window.location.pathname.includes("admin.html")) {
    caricaMessaggiAdmin();
}

// 6. SISTEMA NOTIFICHE / AVVISI GLOBALI
async function caricaAvvisoGlobale() {
    const banner = document.getElementById('banner-avviso-admin');
    const testo = document.getElementById('testo-avviso-admin');
    if (!banner || !testo) return;

    try {
        const docRef = doc(db, "impostazioni_sito", "avviso");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().attivo) {
            testo.textContent = "📢 " + docSnap.data().messaggio;
            banner.style.display = "block";
        } else {
            banner.style.display = "none";
        }
    } catch (error) {
        console.error("Errore nel caricamento dell'avviso:", error);
    }
}

caricaAvvisoGlobale();

const btnPubblicaAvviso = document.getElementById('btn-pubblica-avviso');
const btnRimuoviAvviso = document.getElementById('btn-rimuovi-avviso');

if (btnPubblicaAvviso) {
    btnPubblicaAvviso.addEventListener('click', async () => {
        const input = document.getElementById('input-avviso');
        const stato = document.getElementById('stato-avviso-admin');
        if (!input.value.trim()) return;

        stato.style.color = "#2563eb";
        stato.textContent = "Pubblicazione in corso...";

        try {
            await setDoc(doc(db, "impostazioni_sito", "avviso"), {
                messaggio: input.value,
                attivo: true,
                data: new Date().toISOString()
            });

            stato.style.color = "green";
            stato.textContent = "Avviso pubblicato su tutto il sito! 🎉";
            input.value = "";
            caricaAvvisoGlobale();
        } catch (error) {
            console.error(error);
            stato.style.color = "red";
            stato.textContent = "Errore durante la pubblicazione.";
        }
    });
}

if (btnRimuoviAvviso) {
    btnRimuoviAvviso.addEventListener('click', async () => {
        const stato = document.getElementById('stato-avviso-admin');
        stato.style.color = "#2563eb";
        stato.textContent = "Rimozione in corso...";

        try {
            await setDoc(doc(db, "impostazioni_sito", "avviso"), {
                messaggio: "",
                attivo: false
            });

            stato.style.color = "green";
            stato.textContent = "Banner rimosso con successo!";
            caricaAvvisoGlobale();
        } catch (error) {
            console.error(error);
            stato.style.color = "red";
            stato.textContent = "Errore durante la rimozione.";
        }
    });
}

// 7. SVUOTA MESSAGGI RICEVUTI
const btnSvuotaMessaggi = document.getElementById('btn-svuota-messaggi');

if (btnSvuotaMessaggi) {
    btnSvuotaMessaggi.addEventListener('click', async () => {
        const conferma = confirm("Sei sicuro di voler eliminare TUTTI i messaggi ricevuti? L'azione è irreversibile.");
        if (!conferma) return;

        const listaElem = document.getElementById('lista-messaggi');
        if (listaElem) listaElem.innerHTML = "<p style='color: #ef4444; font-weight: bold;'>Eliminazione in corso...</p>";

        try {
            const querySnapshot = await getDocs(collection(db, "messaggi_contatti"));
            const promesseEliminazione = querySnapshot.docs.map((docSnap) =>
                deleteDoc(doc(db, "messaggi_contatti", docSnap.id))
            );
            await Promise.all(promesseEliminazione);

            alert("Tutti i messaggi sono stati eliminati con successo!");
            caricaMessaggiAdmin();
        } catch (error) {
            console.error("Errore durante l'eliminazione dei messaggi:", error);
            alert("Errore durante l'eliminazione dei messaggi.");
        }
    });
}

// 8. MOSTRA TABELLA UTENTI IN ADMIN.HTML
async function caricaUtentiAdmin() {
    const tabellaBody = document.getElementById('tabella-utenti-body');
    const badgeTotale = document.getElementById('totale-utenti');
    if (!tabellaBody) return;

    try {
        const querySnapshot = await getDocs(collection(db, "utenti"));

        if (querySnapshot.empty) {
            tabellaBody.innerHTML = `<tr><td colspan="4" style="padding: 1rem; text-align: center; color: #64748b;">Nessun utente registrato al momento.</td></tr>`;
            if (badgeTotale) badgeTotale.textContent = "0 Iscritti";
            return;
        }

        tabellaBody.innerHTML = "";
        let totale = 0;

        querySnapshot.forEach((docSnap) => {
            totale++;
            const u = docSnap.data();
            const userId = docSnap.id;
            const eAdmin = userId === ADMIN_UID;
            const eModeratore = u.ruolo === "moderatore";
            const eBannato = u.bannato === true;

            let badgeStato = '<span style="font-size: 0.8rem; color: #16a34a; font-weight: 600;">🟢 Attivo</span>';
            if (eModeratore) badgeStato = '<span style="font-size: 0.8rem; color: #2563eb; font-weight: 600;">🛡️ Moderatore</span>';
            if (eBannato) badgeStato = '<span style="font-size: 0.8rem; color: #ef4444; font-weight: 600;">⛔ Bannato</span>';

            let azioni = '<span style="font-size: 0.8rem; color: #94a3b8;">Protezione Admin</span>';
            if (!eAdmin) {
                azioni = `
                    ${eModeratore ? `
                        <button onclick="rimuoviModeratore('${userId}')"
                                style="background-color: #e2e8f0; color: #334155; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; margin: 2px;">
                            🛡️ Rimuovi Mod
                        </button>
                    ` : `
                        <button onclick="promuoviModeratore('${userId}')"
                                style="background-color: #2563eb; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; margin: 2px;">
                            🛡️ Promuovi
                        </button>
                    `}
                    ${eBannato ? `
                        <button onclick="sbloccaUtente('${userId}', '${u.nome || u.email}')"
                                style="background-color: #16a34a; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; margin: 2px;">
                            ✅ Sblocca
                        </button>
                    ` : `
                        <button onclick="bannaUtente('${userId}', '${u.nome || u.email}')"
                                style="background-color: #f59e0b; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; margin: 2px;">
                            ⛔ Banna
                        </button>
                    `}
                    <button onclick="eliminaUtente('${userId}', '${u.nome || u.email}')" 
                            style="background-color: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; margin: 2px;">
                        🗑️ Elimina
                    </button>
                `;
            }

            tabellaBody.innerHTML += `
                <tr style="border-bottom: 1px solid #f1f5f9; ${eAdmin ? 'background: #fef2f2;' : ''} ${eBannato ? 'background: #fff1f2;' : ''}">
                    <td style="padding: 0.75rem 1rem; font-weight: bold; color: #1e293b;">
                        ${eAdmin ? '👑 ' : '👤 '}${u.nome || 'Utente'} ${eAdmin ? '<span style="font-size:0.75rem; color:#ef4444; margin-left:5px;">(Admin)</span>' : ''}
                    </td>
                    <td style="padding: 0.75rem 1rem; color: #2563eb;"><a href="mailto:${u.email}">${u.email}</a></td>
                    <td style="padding: 0.75rem 1rem; color: #64748b;">${u.dataRegistrazione || 'N/D'}</td>
                    <td style="padding: 0.75rem 1rem;">${eAdmin ? '<span style="font-size:0.8rem; color:#ef4444; font-weight:600;">👑 Admin</span>' : badgeStato}</td>
                    <td style="padding: 0.75rem 1rem; text-align: center; white-space: nowrap;">${azioni}</td>
                </tr>
            `;
        });

        if (badgeTotale) badgeTotale.textContent = `${totale} ${totale === 1 ? 'Iscritto' : 'Iscritti'}`;

    } catch (error) {
        console.error("Errore nel caricamento utenti:", error);
        tabellaBody.innerHTML = `<tr><td colspan="5" style="padding: 1rem; text-align: center; color: red;">Errore nel caricamento della lista utenti.</td></tr>`;
    }
}

async function eliminaUtente(userId, nomeUtente) {
    const conferma = confirm(`Sei sicuro di voler eliminare l'utente "${nomeUtente}"? L'azione è irreversibile.`);
    if (!conferma) return;

    try {
        await deleteDoc(doc(db, "utenti", userId));
        alert(`Utente ${nomeUtente} eliminato con successo!`);
        caricaUtentiAdmin();
    } catch (error) {
        console.error("Errore durante l'eliminazione:", error);
        alert("Si è verificato un errore durante l'eliminazione dell'utente.");
    }
}

async function promuoviModeratore(userId) {
    try {
        await setDoc(doc(db, "utenti", userId), { ruolo: "moderatore" }, { merge: true });
        caricaUtentiAdmin();
    } catch (error) {
        console.error("Errore durante la promozione:", error);
        alert("Errore durante la promozione a moderatore.");
    }
}

async function rimuoviModeratore(userId) {
    try {
        await setDoc(doc(db, "utenti", userId), { ruolo: "utente" }, { merge: true });
        caricaUtentiAdmin();
    } catch (error) {
        console.error("Errore durante la rimozione del ruolo:", error);
        alert("Errore durante la rimozione del ruolo di moderatore.");
    }
}

async function bannaUtente(userId, nomeUtente) {
    const conferma = confirm(`Vuoi davvero sospendere l'utente "${nomeUtente}"? Non potrà più accedere al sito finché non lo sblocchi.`);
    if (!conferma) return;

    try {
        await setDoc(doc(db, "utenti", userId), { bannato: true }, { merge: true });
        alert(`Utente ${nomeUtente} sospeso.`);
        caricaUtentiAdmin();
    } catch (error) {
        console.error("Errore durante la sospensione:", error);
        alert("Errore durante la sospensione dell'utente.");
    }
}

async function sbloccaUtente(userId, nomeUtente) {
    try {
        await setDoc(doc(db, "utenti", userId), { bannato: false }, { merge: true });
        alert(`Utente ${nomeUtente} sbloccato.`);
        caricaUtentiAdmin();
    } catch (error) {
        console.error("Errore durante lo sblocco:", error);
        alert("Errore durante lo sblocco dell'utente.");
    }
}

window.eliminaUtente = eliminaUtente;
window.promuoviModeratore = promuoviModeratore;
window.rimuoviModeratore = rimuoviModeratore;
window.bannaUtente = bannaUtente;
window.sbloccaUtente = sbloccaUtente;


// ==========================================
// STATISTICHE E MONITORAGGIO
// ==========================================

// Registra una visita (una sola volta per sessione di navigazione, per non gonfiare il contatore ad ogni ricarica)
async function registraVisita() {
    if (sessionStorage.getItem('nexus_visita_registrata')) return;
    try {
        await setDoc(doc(db, "statistiche", "generali"), {
            visiteTotali: increment(1)
        }, { merge: true });
        sessionStorage.setItem('nexus_visita_registrata', '1');
    } catch (error) {
        console.error("Errore nella registrazione della visita:", error);
    }
}
registraVisita();

// Popola la dashboard statistiche nel pannello Admin
async function caricaStatisticheAdmin() {
    const statVisite = document.getElementById('stat-visite');
    if (!statVisite) return;

    try {
        const [visiteSnap, utentiSnap, messaggiSnap, eserciziSnap, roadmapSnap] = await Promise.all([
            getDoc(doc(db, "statistiche", "generali")),
            getDocs(collection(db, "utenti")),
            getDocs(collection(db, "messaggi_contatti")),
            getDocs(collection(db, "storico_esercizi")),
            getDocs(collection(db, "roadmap_materie"))
        ]);

        statVisite.textContent = visiteSnap.exists() ? (visiteSnap.data().visiteTotali || 0) : 0;
        document.getElementById('stat-utenti').textContent = utentiSnap.size;
        document.getElementById('stat-messaggi').textContent = messaggiSnap.size;
        document.getElementById('stat-esercizi').textContent = eserciziSnap.size;
        document.getElementById('stat-roadmap').textContent = roadmapSnap.size;
    } catch (error) {
        console.error("Errore nel caricamento delle statistiche:", error);
    }
}

if (window.location.pathname.includes("admin.html")) {
    caricaStatisticheAdmin();
}



// ==========================================
// GESTIONE MODALITÀ MANUTENZIONE (BLINDATA)
// ==========================================
let manutenzioneAttiva = false;

async function controllaManutenzione(user) {
    const paginaAttuale = window.location.pathname;

    // Se l'utente è l'Admin verificato o si trova già nella pagina Admin, non bloccare mai
    const eAdmin = user && user.uid === ADMIN_UID;
    if (eAdmin || paginaAttuale.includes("admin.html") || paginaAttuale.endsWith("/admin")) {
        return;
    }

    try {
        const docRef = doc(db, "impostazioni_sito", "manutenzione");
        const docSnap = await getDoc(docRef);

        const isAttivo = docSnap.exists() ? docSnap.data().attivo : false;
        const siamoInManutenzione = paginaAttuale.includes("manutenzione.html");

        if (isAttivo && !siamoInManutenzione) {
            // Manutenzione ATTIVA -> Vai alla pagina di manutenzione
            window.location.href = "/manutenzione.html";
        } else if (!isAttivo && siamoInManutenzione) {
            // Manutenzione DISATTIVATA -> Torna alla Home
            window.location.href = "/index.html";
        }
    } catch (error) {
        console.error("Errore nel controllo manutenzione:", error);
    }
}

async function caricaStatoManutenzioneAdmin() {
    const badge = document.getElementById('stato-manutenzione-badge');
    const btn = document.getElementById('btn-toggle-manutenzione');
    if (!badge || !btn) return;

    try {
        const docRef = doc(db, "impostazioni_sito", "manutenzione");
        const docSnap = await getDoc(docRef);

        manutenzioneAttiva = docSnap.exists() ? docSnap.data().attivo : false;

        if (manutenzioneAttiva) {
            badge.textContent = "Stato: ATTIVA 🚨";
            badge.style.background = "#fee2e2";
            badge.style.color = "#991b1b";
            btn.textContent = "Disattiva Manutenzione";
            btn.style.background = "#16a34a";
        } else {
            badge.textContent = "Stato: DISATTIVATA";
            badge.style.background = "#e2e8f0";
            badge.style.color = "#475569";
            btn.textContent = "Attiva Manutenzione";
            btn.style.background = "#e11d48";
        }
    } catch (error) {
        console.error("Errore recupero stato manutenzione:", error);
    }
}

// Gestione del click del pulsante Admin
const btnToggleManutenzione = document.getElementById('btn-toggle-manutenzione');
if (btnToggleManutenzione) {
    btnToggleManutenzione.addEventListener('click', async () => {
        const nuovoStato = !manutenzioneAttiva;
        const conferma = confirm(`Vuoi davvero ${nuovoStato ? 'ATTIVARE' : 'DISATTIVARE'} la manutenzione?`);
        if (!conferma) return;

        try {
            await setDoc(doc(db, "impostazioni_sito", "manutenzione"), {
                attivo: nuovoStato,
                dataModifica: new Date().toISOString()
            }, { merge: true });

            alert(`Modalità manutenzione ${nuovoStato ? 'attivata' : 'disattivata'}!`);
            caricaStatoManutenzioneAdmin();
        } catch (error) {
            console.error("Errore aggiornamento manutenzione:", error);
            alert("Errore durante il salvataggio.");
        }
    });
}

// Esecuzione immediata al controllo Firebase
onAuthStateChanged(auth, (user) => {
    controllaManutenzione(user);
    if (document.getElementById('btn-toggle-manutenzione')) {
        caricaStatoManutenzioneAdmin();
    }
});

// BLOCCO MODULI E CONTATTI
let formBloccati = false;

async function controllaStatoForm() {
    const formContattiElem = document.getElementById('form-contatti');
    const statoMessaggioElem = document.getElementById('stato-messaggio');

    try {
        const docRef = doc(db, "impostazioni_sito", "blocco_form");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().bloccati) {
            formBloccati = true;

            if (formContattiElem) {
                const tastoSubmit = formContattiElem.querySelector('button[type="submit"]');
                if (tastoSubmit) {
                    tastoSubmit.disabled = true;
                    tastoSubmit.style.opacity = "0.5";
                    tastoSubmit.style.cursor = "not-allowed";
                }
                if (statoMessaggioElem) {
                    statoMessaggioElem.style.color = "#d97706";
                    statoMessaggioElem.textContent = "🔒 L'invio di nuovi messaggi è momentaneamente sospeso dall'amministrazione.";
                }
            }
        }
    } catch (error) {
        console.error("Errore controllo stato form:", error);
    }
}

controllaStatoForm();

async function caricaStatoFormAdmin() {
    const badge = document.getElementById('stato-form-badge');
    const btn = document.getElementById('btn-toggle-form');
    if (!badge || !btn) return;

    try {
        const docRef = doc(db, "impostazioni_sito", "blocco_form");
        const docSnap = await getDoc(docRef);

        formBloccati = docSnap.exists() ? docSnap.data().bloccati : false;

        if (formBloccati) {
            badge.textContent = "Form: BLOCCATI 🔒";
            badge.style.background = "#fef3c7";
            badge.style.color = "#92400e";
            btn.textContent = "Sblocca Invio Form";
            btn.style.background = "#16a34a";
        } else {
            badge.textContent = "Form: ATTIVI 🟢";
            badge.style.background = "#dcfce7";
            badge.style.color = "#166534";
            btn.textContent = "Blocca Invio Form";
            btn.style.background = "#f59e0b";
        }
    } catch (error) {
        console.error("Errore caricamento stato form:", error);
    }
}

const btnToggleForm = document.getElementById('btn-toggle-form');
if (btnToggleForm) {
    btnToggleForm.addEventListener('click', async () => {
        const nuovoStato = !formBloccati;

        try {
            await setDoc(doc(db, "impostazioni_sito", "blocco_form"), {
                bloccati: nuovoStato,
                dataModifica: new Date().toISOString()
            });

            alert(`Invio moduli ${nuovoStato ? 'bloccato' : 'sbloccato'}!`);
            caricaStatoFormAdmin();
        } catch (error) {
            console.error("Errore modifica blocco form:", error);
            alert("Errore durante l'aggiornamento.");
        }
    });
}

if (window.location.pathname.includes("admin.html")) {
    caricaStatoFormAdmin();
}


// POP-UP NOTIZIA FLASH (MODAL)
async function controllaEmostraPopUp() {
    if (window.location.pathname.includes("admin.html")) return;

    try {
        const docRef = doc(db, "impostazioni_sito", "popup_notizia");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().attivo) {
            const data = docSnap.data();

            const vistoID = localStorage.getItem("popup_visto_id");
            if (vistoID === data.dataCreazione) return;

            const modalHTML = `
                <div id="nexus-popup-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 99999; padding: 1rem; animation: fadeIn 0.3s ease;">
                    <div style="background: white; border-radius: 16px; max-width: 480px; width: 100%; padding: 2rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); text-align: center; position: relative;">
                        <span id="chiudi-nexus-popup" style="position: absolute; top: 1rem; right: 1.2rem; font-size: 1.5rem; color: #94a3b8; cursor: pointer; font-weight: bold;">&times;</span>
                        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">⚡</div>
                        <h2 style="color: #1e293b; margin-top: 0; margin-bottom: 0.75rem; font-size: 1.4rem;">${data.titolo}</h2>
                        <p style="color: #475569; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">${data.testo.replace(/\n/g, '<br>')}</p>
                        <button id="btn-ho-capito-popup" style="background: #2563eb; color: white; border: none; padding: 0.75rem 2rem; border-radius: 10px; font-weight: 600; font-size: 0.95rem; cursor: pointer; width: 100%;">Ho Capito!</button>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);

            const chiudiModal = () => {
                const elem = document.getElementById('nexus-popup-overlay');
                if (elem) elem.remove();
                localStorage.setItem("popup_visto_id", data.dataCreazione);
            };

            document.getElementById('chiudi-nexus-popup').addEventListener('click', chiudiModal);
            document.getElementById('btn-ho-capito-popup').addEventListener('click', chiudiModal);
        }
    } catch (error) {
        console.error("Errore controllo Pop-Up:", error);
    }
}

controllaEmostraPopUp();

async function caricaStatoPopUpAdmin() {
    const badge = document.getElementById('stato-popup-badge');
    const inputTitolo = document.getElementById('popup-titolo');
    const inputTesto = document.getElementById('popup-testo');
    if (!badge) return;

    try {
        const docRef = doc(db, "impostazioni_sito", "popup_notizia");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (inputTitolo) inputTitolo.value = data.titolo || "";
            if (inputTesto) inputTesto.value = data.testo || "";

            if (data.attivo) {
                badge.textContent = "Stato: ATTIVO ⚡";
                badge.style.background = "#dcfce7";
                badge.style.color = "#166534";
            } else {
                badge.textContent = "Stato: DISATTIVATO";
                badge.style.background = "#e2e8f0";
                badge.style.color = "#475569";
            }
        }
    } catch (error) {
        console.error("Errore stato Pop-Up:", error);
    }
}

const btnPubblicaPopUp = document.getElementById('btn-pubblica-popup');
const btnDisattivaPopUp = document.getElementById('btn-disattiva-popup');

if (btnPubblicaPopUp) {
    btnPubblicaPopUp.addEventListener('click', async () => {
        const titolo = document.getElementById('popup-titolo').value.trim();
        const testo = document.getElementById('popup-testo').value.trim();
        const stato = document.getElementById('stato-operazione-popup');

        if (!titolo || !testo) {
            alert("Compila sia il titolo che il testo del pop-up.");
            return;
        }

        if (stato) { stato.style.color = "#2563eb"; stato.textContent = "Pubblicazione in corso..."; }

        try {
            await setDoc(doc(db, "impostazioni_sito", "popup_notizia"), {
                titolo: titolo,
                testo: testo,
                attivo: true,
                dataCreazione: new Date().toISOString()
            });

            if (stato) { stato.style.color = "green"; stato.textContent = "Pop-Up attivato e mostrato sul sito! 🚀"; }
            caricaStatoPopUpAdmin();
        } catch (error) {
            console.error(error);
            if (stato) { stato.style.color = "red"; stato.textContent = "Errore durante la pubblicazione."; }
        }
    });
}

if (btnDisattivaPopUp) {
    btnDisattivaPopUp.addEventListener('click', async () => {
        const stato = document.getElementById('stato-operazione-popup');
        if (stato) { stato.style.color = "#2563eb"; stato.textContent = "Disattivazione in corso..."; }

        try {
            await setDoc(doc(db, "impostazioni_sito", "popup_notizia"), {
                attivo: false
            });

            if (stato) { stato.style.color = "green"; stato.textContent = "Pop-Up disattivato con successo!"; }
            caricaStatoPopUpAdmin();
        } catch (error) {
            console.error(error);
            if (stato) { stato.style.color = "red"; stato.textContent = "Errore durante la disattivazione."; }
        }
    });
}

if (window.location.pathname.includes("admin.html")) {
    caricaStatoPopUpAdmin();
}


// SALVATAGGIO NUOVO ARGOMENTO ROADMAP
const formRoadmap = document.getElementById('form-roadmap');
if (formRoadmap) {
    formRoadmap.addEventListener('submit', async (e) => {
        e.preventDefault();
        const statoMsg = document.getElementById('stato-salvataggio-roadmap');
        if (statoMsg) statoMsg.textContent = "Salvataggio...";

        const badgeStato = document.getElementById('roadmap-stato-badge').value;
        const titolo = document.getElementById('roadmap-titolo').value;
        const descrizione = document.getElementById('roadmap-descrizione').value;

        try {
            await addDoc(collection(db, "roadmap_materie"), {
                stato: badgeStato,
                titolo: titolo,
                descrizione: descrizione,
                timestamp: new Date().getTime()
            });

            if (statoMsg) {
                statoMsg.style.color = "green";
                statoMsg.textContent = "Argomento aggiunto con successo! 🎉";
            }
            formRoadmap.reset();
            caricaRoadmapDinamica(); // Ricarica subito la lista nell'Admin
        } catch (error) {
            console.error("Errore salvataggio roadmap:", error);
            if (statoMsg) {
                statoMsg.style.color = "red";
                statoMsg.textContent = "Errore durante il salvataggio.";
            }
        }
    });
}

async function caricaRoadmapDinamica() {
    const gridElem = document.getElementById('lista-roadmap-dinamica');
    if (!gridElem) return;

    try {
        // Inizializza il database Firestore
        const db = getFirestore(app);
        const querySnapshot = await getDocs(collection(db, "roadmap_materie"));

        if (querySnapshot.empty) {
            gridElem.innerHTML = "<p style='color: #64748b; text-align: center; grid-column: 1/-1;'>Nessun argomento in programma al momento.</p>";
            return;
        }

        gridElem.innerHTML = "";

        querySnapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const docId = docSnap.id;
            const badgeClass = item.stato === "In Arrivo" ? "badge-soon" : "badge-planned";
            const isAdminPage = window.location.pathname.includes("admin.html");

            gridElem.innerHTML += `
                <div class="roadmap-card" id="card-${docId}">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.8rem;">
                        <span class="roadmap-badge ${badgeClass}" style="margin: 0;">${item.stato}</span>
                        ${isAdminPage ? `
                            <button onclick="eliminaElementoRoadmap('${docId}')" 
                                    style="background: #fee2e2; color: #ef4444; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.8rem; white-space: nowrap;">
                                🗑️ Elimina
                            </button>
                        ` : ''}
                    </div>
                    <h3 class="roadmap-title" style="margin: 0 0 0.5rem 0;">${item.titolo}</h3>
                    <p class="roadmap-desc" style="margin: 0;">${item.descrizione}</p>
                </div>
            `;
        });
    } catch (error) {
        console.error("Errore dettagliato caricamento roadmap:", error);
        gridElem.innerHTML = "<p style='color: red; text-align: center; grid-column: 1/-1;'>Errore nel caricamento del programma.</p>";
    }
}

// FUNZIONE PER ELIMINARE DA FIREBASE
window.eliminaElementoRoadmap = async function (docId) {
    if (confirm("Sei sicuro di voler eliminare questo argomento dalla Roadmap?")) {
        try {
            await deleteDoc(doc(db, "roadmap_materie", docId));
            caricaRoadmapDinamica(); // Ricarica la lista aggiornata
        } catch (error) {
            console.error("Errore durante l'eliminazione:", error);
            alert("Errore durante l'eliminazione dell'elemento.");
        }
    }
};

// Avvia il caricamento sia su materie.html che su admin.html
if (window.location.pathname.includes("materie.html") || window.location.pathname.includes("admin.html")) {
    caricaRoadmapDinamica();
}