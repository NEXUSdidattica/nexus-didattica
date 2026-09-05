import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const loginForm = document.getElementById('login-form');
const errorMsg = document.getElementById('error-message');
const infoMsg = document.getElementById('info-message');
const forgotPasswordBtn = document.getElementById('forgot-password-btn');

// --- LOGIN ---
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (errorMsg) errorMsg.style.display = 'none';
        if (infoMsg) infoMsg.style.display = 'none';

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = "index.html";
        } catch (error) {
            console.error("Errore Login:", error.code);
            if (errorMsg) {
                errorMsg.textContent = getLoginErrorMessage(error.code);
                errorMsg.style.display = 'block';
            }
        }
    });
}

// --- RECUPERO PASSWORD ---
if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation(); // Blocca l'invio del form

        const emailInput = document.getElementById('email');
        const email = emailInput ? emailInput.value.trim() : "";

        if (errorMsg) errorMsg.style.display = 'none';
        if (infoMsg) infoMsg.style.display = 'none';

        if (!email) {
            if (errorMsg) {
                errorMsg.textContent = 'Scrivi la tua email nel campo sopra e poi clicca qui.';
                errorMsg.style.display = 'block';
            }
            emailInput?.focus();
            return;
        }

        // Dice a Firebase di mandare l'utente sulla NOSTRA pagina di reset
        // personalizzata, invece della pagina generica di Firebase.
        const actionCodeSettings = {
            url: "https://nexusdidattica.it/nuova_password.html",
            handleCodeInApp: false
        };

        try {
            await sendPasswordResetEmail(auth, email, actionCodeSettings);
            console.log("Email inviata con successo a:", email);
            
            if (infoMsg) {
                infoMsg.textContent = 'Email per il ripristino inviata! Controlla la tua casella di posta (e lo SPAM).';
                infoMsg.style.display = 'block';
            }
        } catch (error) {
            console.error("Errore Reset Password:", error.code, error.message);
            if (errorMsg) {
                if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                    errorMsg.textContent = 'Nessun account registrato con questa email. Registrati prima!';
                } else if (error.code === 'auth/invalid-email') {
                    errorMsg.textContent = 'Indirizzo email non valido.';
                } else {
                    errorMsg.textContent = 'Errore durante l\'invio dell\'email. Riprova.';
                }
                errorMsg.style.display = 'block';
            }
        }
    });
}

function getLoginErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            return 'Email o password non corrette.';
        case 'auth/invalid-email':
            return 'Formato email non valido.';
        case 'auth/too-many-requests':
            return 'Troppi tentativi falliti. Riprova più tardi.';
        default:
            return 'Impossibile accedere. Verifica le tue credenziali.';
    }
}