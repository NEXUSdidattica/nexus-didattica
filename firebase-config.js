import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAvRg1YYrVs3bHqPP3H2B3k9ADtes1ifSQ",
    authDomain: "nexus-didattica.firebaseapp.com",
    projectId: "nexus-didattica",
    storageBucket: "nexus-didattica.firebasestorage.app",
    messagingSenderId: "749996460911",
    appId: "1:749996460911:web:903a1747e0bea0ae99369a",
    measurementId: "G-JV2NMTLK3H"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);