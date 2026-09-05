import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
                <div style="width: 100%; text-align: center; padding: 3rem 1rem; color: #64748b; box-sizing: border-border-box;">
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
            lessonsContainer.innerHTML += `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem 1.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; width: 100%; box-sizing: border-box; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 6px 16px rgba(0,0,0,0.06)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.03)'">
                    <div style="flex: 1;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: ${coloreMateria}; text-transform: uppercase; letter-spacing: 0.05em;">${lesson.materia || 'MATEMATICA'}</span>
                        <h3 style="margin: 0.3rem 0 0 0; font-size: 1.2rem; color: #0f172a; font-weight: 600;">${lesson.titolo}</h3>
                    </div>
                    <div style="flex-shrink: 0;">
                        <a href="${lesson.link || '#'}" style="background-color: ${coloreMateria}; color: white; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; white-space: nowrap;">
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

// Gestione Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = "index.html";
    });
}