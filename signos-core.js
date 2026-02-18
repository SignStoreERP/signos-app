// SignOS Core System v1.6
// Features: Twin-Engine Env, IP Telemetry, "Island" Header Injection

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzEEf1lQ4xkXdSqcLgfLJ3FmNbLGUyElTzmac7U-t1msxLvJL8iSZ30R3bm5dCpmlKqPA/exec";
const IS_DEV_ENV = window.location.href.includes('signos-app') || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

let clientIP = "Unknown";
const currentHost = window.location.hostname;

fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then(d => { clientIP = d.ip; })
    .catch(e => console.log("IP Silent"));

if (!window.location.pathname.includes('index.html')) {
    const user = sessionStorage.getItem('signos_user');
    if (!user) window.location.href = 'index.html';
}

function logout() {
    const u = sessionStorage.getItem('signos_user');
    fetch(`${SCRIPT_URL}?req=log_event&action=LOGOUT&user=${u}&ip=${clientIP}&host=${currentHost}`, {mode: 'no-cors'});
    sessionStorage.clear();
    window.location.href = 'index.html';
}

function goBack() {
    const role = sessionStorage.getItem('signos_role');
    let mode = 'sales';
    if (role === 'PROD') mode = 'production';
    else if (role === 'ADMIN' || role === 'SUPER') mode = IS_DEV_ENV ? 'dev' : 'admin';
    window.location.href = `menu.html?mode=${mode}`;
}

// 7. UI INJECTION (Island Mode)
function injectHeader(title, showMenu = true) {
    const u = sessionStorage.getItem('signos_user') || 'GUEST';
    const r = sessionStorage.getItem('signos_role') || 'VIEW';
    
    // Check for "Main Card" container to maintain "Island" look
    const container = document.getElementById('main-card') || document.querySelector('.max-w-md') || document.body;
    
    // If inside a card, remove 'sticky' and 'shadow' from header so it blends in
    const isCard = container !== document.body;
    const stickyClass = isCard ? "" : "sticky top-0 z-50 shadow-md";
    
    const html = `
    <div class="bg-gray-900 text-white px-4 py-3 flex justify-between items-center border-b border-gray-800 ${stickyClass} shrink-0">
        <div class="flex flex-col leading-tight">
            <span class="text-gray-400 text-[10px] uppercase tracking-wider">SignOS ERP</span>
            <span class="font-bold text-white text-sm">${title}</span>
        </div>
        <div class="flex items-center gap-3">
            <div class="hidden md:block text-right mr-2">
                <div class="text-[9px] text-gray-400 uppercase">User</div>
                <div class="font-bold text-xs">${u} <span class="bg-gray-800 px-1 rounded text-blue-400 border border-gray-700">${r}</span></div>
            </div>
            ${showMenu ? `<button onclick="goBack()" class="text-gray-300 hover:text-white text-xs font-bold border border-gray-600 px-3 py-1.5 rounded transition">MENU</button>` : ''}
            <button onclick="logout()" class="text-red-400 hover:text-white text-[10px] font-bold border border-red-900/50 bg-red-900/10 px-3 py-1.5 rounded transition">EXIT</button>
        </div>
    </div>`;
    
    container.insertAdjacentHTML('afterbegin', html);
}

// Feedback Logic (Preserved)
window.addEventListener('load', function() {
    const user = sessionStorage.getItem('signos_user');
    if (!user || window.location.pathname.includes('index.html')) return;
    
    // Inject Feedback Button
    const btn = document.createElement('button');
    btn.innerHTML = '<span class="text-xl">📣</span>';
    btn.className = "fixed bottom-4 right-4 bg-white text-gray-800 p-3 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 hover:scale-110 transition z-50 flex items-center justify-center w-12 h-12";
    btn.title = "Report Bug / Request Feature";
    btn.onclick = () => {
        const page = window.location.pathname.split('/').pop() || 'Home';
        // Reuse existing modal if present, or alert for now to save space
        const title = prompt("Feature Request / Bug Report Title:");
        if(title) {
            const desc = prompt("Details:");
            if(desc) {
                fetch(`${SCRIPT_URL}?req=add_roadmap&user=${user}&cat=Feature&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(desc)}&prio=Med&target=APP&source=User&context=${page}`, {mode: 'no-cors'});
                alert("Feedback Sent!");
            }
        }
    };
    document.body.appendChild(btn);
});
