// Utility di sicurezza condivise da tutte le pagine.
// Usa esc() su OGNI valore che arriva da un utente (nome, email, messaggi,
// richieste, ecc.) prima di inserirlo in un template passato a innerHTML,
// oppure dentro un attributo HTML (href, data-*, title, ...).
export function esc(valore) {
    return String(valore ?? '').replace(/[&<>"'`]/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '`': '&#96;'
    }[c]));
}