// Toggle mostra/nascondi password (icona "occhio").
// Funziona su qualsiasi pagina: basta avere un pulsante con classe
// "btn-toggle-password" e attributo data-target="id-del-campo-password".
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn-toggle-password').forEach((bottone) => {
        bottone.addEventListener('click', () => {
            const campo = document.getElementById(bottone.dataset.target);
            if (!campo) return;

            const nascosta = campo.type === 'password';
            campo.type = nascosta ? 'text' : 'password';
            bottone.textContent = nascosta ? '🙈' : '👁️';
            bottone.setAttribute('aria-label', nascosta ? 'Nascondi password' : 'Mostra password');
        });
    });
});