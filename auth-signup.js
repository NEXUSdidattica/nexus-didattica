import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const signupForm = document.getElementById('signup-form');
const errorMsg = document.getElementById('error-message');

if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (errorMsg) errorMsg.style.display = 'none';

        const nome = document.getElementById('nome').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // --- VALIDAZIONE PASSWORD COSTUM ---
        const hasMinLength = password.length >= 8;
        const hasNumber = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (!hasMinLength || !hasNumber || !hasSpecialChar) {
            if (errorMsg) {
                errorMsg.textContent = 'La password deve contenere almeno 8 caratteri, un numero e un carattere speciale (es. !@#$).';
                errorMsg.style.display = 'block';
            }
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await updateProfile(user, { displayName: nome });

            await setDoc(doc(db, "utenti", user.uid), {
                nome: nome,
                email: email,
                dataRegistrazione: new Date().toLocaleDateString('it-IT')
            });

            window.location.href = "index.html";

        } catch (error) {
            console.error("Errore registrazione:", error.code, error.message);
            if (errorMsg) {
                errorMsg.textContent = translateError(error.code);
                errorMsg.style.display = 'block';
            }
        }
    });
}

function translateError(code) {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'Questa email è già registrata. Prova ad accedere!';
        case 'auth/weak-password':
            return 'La password è troppo debole. Inserisci almeno 8 caratteri, un numero e un carattere speciale.';
        case 'auth/invalid-email':
            return 'Inserisci un indirizzo email valido.';
        default:
            return 'Impossibile completare la registrazione. Verifica i dati inseriti.';
    }
}