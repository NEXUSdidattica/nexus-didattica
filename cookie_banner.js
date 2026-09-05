document.addEventListener("DOMContentLoaded", () => {
    const banner = document.getElementById("cookie-banner");
    const btnAccept = document.getElementById("btn-accept-all");
    const btnReject = document.getElementById("btn-reject-all");
    const openConsentBtn = document.getElementById("open-cookie-settings");

    // Controlla la scelta salvata precedentemente
    const consent = localStorage.getItem("nexus_cookie_consent");

    if (!consent) {
        banner.style.display = "block";
    }

    // Tasto Accetta Tutto
    btnAccept.addEventListener("click", () => {
        localStorage.setItem("nexus_cookie_consent", "accepted");
        banner.style.display = "none";
        // Qui si sbloccano i tag di tracciamento e AdSense
    });

    // Tasto Rifiuta Tutto (Solo essenziali)
    btnReject.addEventListener("click", () => {
        localStorage.setItem("nexus_cookie_consent", "rejected");
        banner.style.display = "none";
    });

    // Riapre il banner se l'utente clicca su "Gestisci Consenso" nel Footer
    if (openConsentBtn) {
        openConsentBtn.addEventListener("click", (e) => {
            e.preventDefault();
            banner.style.display = "block";
        });
    }
});