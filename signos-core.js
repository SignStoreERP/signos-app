// SignOS Core System v1.3
// Handles: IP Telemetry, Host Tracking, Session Security, Global Navigation, and Environment Detection

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzEEf1lQ4xkXdSqcLgfLJ3FmNbLGUyElTzmac7U-t1msxLvJL8iSZ30R3bm5dCpmlKqPA/exec";

// 1. ENVIRONMENT DETECTION (The "Twin-Engine" Logic)
const IS_DEV_ENV = window.location.href.includes('signos-app') || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

// 2. GLOBAL TELEMETRY
let clientIP = "Unknown";
const currentHost = window.location.hostname;

fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then(d => { clientIP = d.ip; })
    .catch(e => console.log("IP Silent"));

// 3. SESSION SECURITY
if (!window.location.pathname.includes('index.html')) {
    const user = sessionStorage.getItem('signos_user');
    if (!user) window.location.href = 'index.html';
}

// 4. GLOBAL LOGOUT
function logout() {
    const u = sessionStorage.getItem('signos_user');
    fetch(`${SCRIPT_URL}?req=log_event&action=LOGOUT&user=${u}&ip=${clientIP}&host=${currentHost}`, {mode: 'no-cors'});
    sessionStorage.clear();
    window.location.href = 'index.html';
}

// 5. NAVIGATION (Updated for SUPER)
function goBack() {
    const role = sessionStorage.getItem('signos_role');
    let mode = 'sales';
    
    if (role === 'PROD') mode = 'production';
    // SUPER and ADMIN default to 'dev' mode if they are on the Dev Repo
    else if (role === 'ADMIN' || role === 'SUPER') mode = IS_DEV_ENV ? 'dev' : 'admin';
    
    window.location.href = `menu.html?mode=${mode}`;
}
