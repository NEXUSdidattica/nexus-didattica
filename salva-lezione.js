import { getFirestore, doc, setDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, app } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const db = getFirestore(app);

const btn = document.getElementById('btn-salva-lezione');
const icon = document.getElementById('bookmark-icon');
const text = document.getElementById('bookmark-text');

let currentUser = null;

const lessonId = document.body.dataset.lessonId || window.location.pathname.replace(/[^a-zA-Z0-9]/g, "_");
const materia = document.body.dataset.materia || "Matematica";

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user && btn) {
        const docRef = doc(db, "user_lessons", `${user.uid}_${lessonId}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            btn.classList.add('salvato');
            if (icon) icon.textContent = '✅';
            if (text) text.textContent = 'Salvata nel Profilo';
            btn.style.backgroundColor = '#16a34a';
        }
    }
});

if (btn) {
    btn.addEventListener('click', async () => {
        if (!currentUser) {
            alert("Devi accedere per salvare le lezioni nel tuo profilo!");
            window.location.href = "/login.html";
            return;
        }

        const docRef = doc(db, "user_lessons", `${currentUser.uid}_${lessonId}`);

        if (btn.classList.contains('salvato')) {
            btn.classList.remove('salvato');
            if (icon) icon.textContent = '🔖';
            if (text) text.textContent = 'Salva Lezione';
            btn.style.backgroundColor = '#2563eb';

            try {
                await deleteDoc(docRef);
            } catch (error) {
                console.error("Errore durante la rimozione:", error);
            }
        } else {
            btn.classList.add('salvato');
            if (icon) icon.textContent = '✅';
            if (text) text.textContent = 'Salvata nel Profilo';
            btn.style.backgroundColor = '#16a34a';

            // Cattura il titolo dall'h1 della lezione (dentro .hero-lezione, NON l'h1 dell'header del sito)
            const titoloCompleto = document.querySelector('.hero-lezione h1')?.textContent.trim() || document.title.replace(" - NEXUS didattica", "");

            try {
                await setDoc(docRef, {
                    userId: currentUser.uid,
                    titolo: titoloCompleto,
                    materia: materia,
                    link: window.location.pathname,
                    timestamp: new Date().getTime()
                });
            } catch (error) {
                console.error("Errore durante il salvataggio:", error);
            }
        }
    });
}