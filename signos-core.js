// SignOS Core System v1.0
// Handles: IP Telemetry, Host Tracking, Session Security, and Global Navigation

const SCRIPT_URL = "https://script.google.com/a/macros/signstoremacon.com/s/AKfycbzEEf1lQ4xkXdSqcLgfLJ3FmNbLGUyElTzmac7U-t1msxLvJL8iSZ30R3bm5dCpmlKqPA/exec";

// 1. GLOBAL TELEMETRY (Runs on Load)
let clientIP = "Unknown";
const currentHost = window.location.hostname; // CAPTURES "github.io" or "zublinsystems.com"

fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then(d => { clientIP = d.ip; })
    .catch(e => console.log("IP Silent"));

// 2. SESSION SECURITY (The Bouncer)
// Prevents direct access if not logged in (bypassed on index.html)
if (!window.location.pathname.includes('index.html')) {
    const user = sessionStorage.getItem('signos_user');
    if (!user) window.location.href = 'index.html';
}

// 3. GLOBAL LOGOUT (With Telemetry)
function logout() {
    const u = sessionStorage.getItem('signos_user');
    // Fire "Goodbye" beacon with Host and IP info
    fetch(`${SCRIPT_URL}?req=log_event&action=LOGOUT&user=${u}&ip=${clientIP}&host=${currentHost}`, {mode: 'no-cors'});
    
    sessionStorage.clear();
    window.location.href = 'index.html';
}

// 4. NAVIGATION
function goBack() {
    const mode = sessionStorage.getItem('signos_mode') || 'sales'; // We need to standardize storing 'mode'
    window.location.href = `menu.html?mode=${mode}`;
}
