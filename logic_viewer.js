/**
 * SignOS Log Analyzer Logic (v2.18)
 * Fixes: "lines.startsWith" crash. 
 * Logic: Arrays don't have .startsWith(), only strings do. Changed to lines[0].startsWith().
 */

let rawData = [];
let displayData = [];
let currentSort = { key: 'time', dir: 'desc' };
let activeFilters = { users: [], roles: [], actions: [], targets: [], ips: [] };

// --- INIT ---
window.onload = function() {
    const u = sessionStorage.getItem('signos_user');
    
    // Auth Check handled by core, but we update UI
    if(document.getElementById('auth-user')) {
        document.getElementById('auth-user').innerText = u || "GUEST";
    }
    
    // Load local file listener
    const fileInput = document.getElementById('file-input');
    if(fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files; 
            if (!file) return;
            
            document.getElementById('current-file-name').innerText = "Local: " + file.name;
            const reader = new FileReader();
            reader.onload = (e) => parseLogs(e.target.result);
            reader.readAsText(file);
        });
    }

    loadArchiveList();
};

function goBack() { window.history.back(); }

// --- API FETCHING ---

async function loadArchiveList() {
    const list = document.getElementById('archive-list');
    list.innerHTML = '<div class="text-center py-4"><div class="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div></div>';

    try {
        const response = await fetch(`${SCRIPT_URL}?req=get_archive_index`);
        const data = await response.json();
        
        if (!data || data.length === 0) {
            list.innerHTML = '<div class="text-xs text-gray-400 text-center py-4">No archives found.</div>';
            return;
        }

        list.innerHTML = ""; // Clear loader

        data.forEach((item, index) => {
            const div = document.createElement('div');
            // Check if it's the "LIVE" item (usually first, or marked specially)
            const isLive = item.type === "LIVE" || item.name.includes("Current"); 
            
            div.className = `archive-item p-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition ${index === 0 ? 'active' : ''}`;
            div.onclick = () => loadLogContent(item, div);
            
            div.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-xs text-gray-700">${item.date}</span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded ${item.type === 'AUTO' ? 'bg-gray-100 text-gray-500' : 'bg-purple-100 text-purple-600'}">${item.type}</span>
                </div>
                <div class="text-[10px] text-gray-400 truncate">${item.name}</div>
                <div class="text-[9px] text-gray-300 mt-1">${item.count || '0'} rows</div>
            `;
            list.appendChild(div);
        });

        // Auto-load the first item (usually Live or latest)
        if(data.length > 0) loadLogContent(data[0], list.firstChild);

    } catch (e) {
        list.innerHTML = `<div class="text-xs text-red-500 text-center py-4">Error loading index</div>`;
    }
}

async function loadLogContent(item, element) {
    // 1. Highlight UI
    document.querySelectorAll('.archive-item').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    
    document.getElementById('current-file-name').innerText = item.name;
    document.getElementById('table-body').innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-400">Loading data...</td></tr>';

    try {
        // Handle Live Logs vs Archive Files
        let content = "";
        
        if (item.type === "LIVE" || item.file_id === "LIVE") {
             // Fetch Live JSON directly
             const res = await fetch(`${SCRIPT_URL}?req=get_live_logs`);
             const json = await res.json();
             if(json.status === "success") {
                 parseLiveArray(json.logs);
                 return;
             }
        } else {
            // Fetch Text File
            const response = await fetch(`${SCRIPT_URL}?req=get_log_content&file_id=${item.file_id}`);
            const data = await response.json();
            content = data.content;
        }

        if (content) parseLogs(content);

    } catch (e) {
        console.error(e);
        alert("Failed to load log file.");
    }
}

// --- PARSING ENGINE ---

function parseLiveArray(data) {
    // Handles array data from Google Sheet (Live) directly
    if(!data || data.length < 2) return;
    
    // Skip Header Row (Index 0)
    const rows = data.slice(1); 
    
    rawData = rows.map(r => {
        // Map Columns: Timestamp(0), IP(1), User(2), Role(3), Action(4), Target(5), Meta(6)
        return {
            time: r[0] ? new Date(r[0]).toLocaleString() : "N/A",
            ip: r[1],
            user: r[2],
            role: r[3],
            action: r[4],
            target: r[5],
            meta: r[6]
        };
    });
    
    applyFilters();
}

function parseLogs(content) {
    if (!content) return;

    // 1. Split into lines
    let lines = content.split('\n').filter(l => l.trim() !== "");

    // 2. Remove Header if present
    // --- BUG FIX v2.18: Added [0] to target the string, not the array ---
    if (lines.length > 0 && lines[0].startsWith("Timestamp")) {
        lines.shift(); // Remove first line
    }

    // 3. Map to Objects
    rawData = lines.map(line => {
        const parts = line.split(" | ");
        if (parts.length < 5) return null; // Skip malformed lines

        return {
            time: parts[0] || "N/A",
            ip: parts[1] || "Unknown",
            user: parts[2] || "Guest",
            role: parts[3] || "N/A",
            action: parts[4] || "VIEW",
            target: parts[5] || "N/A",
            meta: parts[6] || "{}"
        };
    }).filter(x => x); // Remove nulls

    applyFilters();
}

// --- FILTERING & SORTING ---

function applyFilters() {
    // 1. Filter
    displayData = rawData.filter(row => {
        // Placeholder for future complex filters
        return true; 
    });

    // 2. Sort
    displayData.sort((a, b) => {
        const dateA = new Date(a.time);
        const dateB = new Date(b.time);
        return currentSort.dir === 'asc' ? dateA - dateB : dateB - dateA;
    });

    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    displayData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "log-row border-b border-gray-50";
        tr.onclick = () => openModal(row);

        // Styling based on action type
        if (row.action.includes('ORDER') || row.action.includes('SUBMIT')) tr.classList.add('log-checkout');
        if (row.user === 'GUEST' && row.action.includes('AUTH')) tr.classList.add('log-error');
        if (row.action.includes('AUTH') && row.role !== 'N/A') tr.classList.add('log-auth');

        // Text Truncation
        let metaShort = row.meta;
        if(metaShort.length > 50) metaShort = metaShort.substring(0, 47) + "...";
        
        const cell = (val) => `<span class="hover:text-blue-600 font-medium">${val}</span>`;

        tr.innerHTML = `
            <td class="p-3 text-gray-600 whitespace-nowrap text-xs">${cell(row.time)}</td>
            <td class="p-3 font-bold text-gray-800 text-xs">${row.user}</td>
            <td class="p-3"><span class="bg-gray-100 text-[10px] px-1.5 py-0.5 rounded font-bold text-gray-600">${row.role}</span></td>
            <td class="p-3 font-bold text-xs whitespace-nowrap"><span class="text-blue-600">${row.action}</span></td>
            <td class="p-3 text-gray-500 text-xs whitespace-nowrap">${cell(row.target)}</td>
            <td class="p-3 text-gray-400 font-mono text-[10px] whitespace-nowrap">${cell(row.ip)}</td>
            <td class="p-3 text-gray-400 font-mono text-[9px] truncate max-w-xs hover:text-gray-600 transition" title='${row.meta}'>${metaShort}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- MODAL LOGIC ---

function openModal(row) {
    document.getElementById('m-time').innerText = row.time;
    document.getElementById('m-ip').innerText = row.ip;
    document.getElementById('m-user').innerText = row.user;
    document.getElementById('m-role').innerText = row.role;
    document.getElementById('m-action').innerText = row.action;
    document.getElementById('m-target').innerText = row.target;

    try {
        const metaObj = JSON.parse(row.meta);
        document.getElementById('m-meta').innerText = JSON.stringify(metaObj, null, 2);
    } catch(e) {
        document.getElementById('m-meta').innerText = row.meta;
    }

    document.getElementById('detail-modal').classList.remove('hidden');
    document.body.classList.add('modal-active');
}

function closeModal() {
    document.getElementById('detail-modal').classList.add('hidden');
    document.body.classList.remove('modal-active');
}
