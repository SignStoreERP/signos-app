/**
 * SignOS Log Analyzer Logic (v2.16)
 * Handles API communication, parsing, filtering, and rendering for admin_viewer.html
 */

let rawData = [];
let displayData = [];
let currentSort = { key: 'time', dir: 'desc' };
let activeFilters = { users: [], roles: [], actions: [], targets: [], ips: [] };

// --- INIT ---
window.onload = function() {
    const u = sessionStorage.getItem('signos_user');
    const r = sessionStorage.getItem('signos_role');
    
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

function goBack() { window.location.href = 'menu.html'; }

// --- API FETCHING ---

async function loadArchiveList() {
    const list = document.getElementById('archive-list');
    list.innerHTML = '<div class="text-center py-4"><div class="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto"></div></div>';

    try {
        const response = await fetch(`${SCRIPT_URL}?req=get_archive_index`);
        const data = await response.json();

        list.innerHTML = "";
        
        if (!data || data.length === 0) { 
            list.innerHTML = '<div class="text-center py-4 text-xs text-gray-400">No Archives Found</div>'; 
            return; 
        }

        data.forEach(file => {
            const item = document.createElement('div');
            item.className = "archive-item p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition";
            
            const d = new Date(file.date);
            const dateStr = d.toLocaleDateString() + " " + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const typeBadge = file.type === 'MANUAL_EXPORT' ? '<span class="text-[9px] text-orange-500 font-bold ml-1">MANUAL</span>' : '';

            item.innerHTML = `<div class="flex justify-between items-center mb-1"><span class="text-[10px] font-bold text-gray-500">${dateStr}</span>${typeBadge}</div><div class="text-xs font-bold text-gray-800 truncate" title="${file.name}">${file.name}</div><div class="text-[9px] text-gray-400 mt-0.5">${file.count} events</div>`;
            
            item.onclick = () => loadCloudFile(file.file_id, file.name, item);
            list.appendChild(item);
        });

    } catch (e) { list.innerHTML = `<div class="text-red-500 text-xs p-2">Error: ${e.message}</div>`; }
}

async function loadCloudFile(fileId, fileName, domElement) {
    // Highlight active file
    document.querySelectorAll('.archive-item').forEach(el => el.classList.remove('active'));
    if(domElement) domElement.classList.add('active');

    document.getElementById('current-file-name').innerText = fileName;
    document.getElementById('loader').classList.remove('hidden');

    try {
        const response = await fetch(`${SCRIPT_URL}?req=get_log_content&file_id=${fileId}`);
        const data = await response.json();

        if(data.status === 'success') parseLogs(data.content);
        else alert("Error reading file: " + data.message);

    } catch(e) { alert("Network Error: " + e.message); }
    finally { document.getElementById('loader').classList.add('hidden'); }
}

// --- PARSING ENGINE ---

function parseLogs(text) {
    const lines = text.split('\n');
    rawData = [];

    // Skip Header if present (Timestamp | IP...)
    let startIdx = 0;
    if (lines.length > 0 && lines.startsWith("Timestamp")) startIdx = 2;

    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split by Pipe (|)
        const cols = line.split('|').map(c => c.trim());

        if (cols.length >= 6) {
            const actionDisplay = cols[1] ? cols[1].toUpperCase() : "---";
            const metaRaw = cols.slice(6).join('|') || "{}";

            rawData.push({
                time: cols,
                ip: cols[2],
                user: cols[3],
                role: cols[4],
                action: actionDisplay,
                target: cols[5],
                meta: metaRaw,
                raw: line.toLowerCase()
            });
        }
    }

    if(rawData.length === 0) alert("File parsed but no valid log rows were found.");
    
    populateFilters(rawData);
    resetFilters(false);
}

// --- FILTERING LOGIC ---

function populateFilters(data) {
    const extract = (key) => [...new Set(data.map(i => i[key]).filter(x => x && x !== 'N/A' && x !== ''))].sort();

    renderChips('filter-users', extract('user'), 'users', 'chip-user');
    renderChips('filter-roles', extract('role'), 'roles', 'chip-role');
    renderChips('filter-actions', extract('action'), 'actions', 'chip-action');
    renderChips('filter-targets', extract('target'), 'targets', 'chip-target');
    renderChips('filter-ips', extract('ip'), 'ips', 'chip-ip');
}

function renderChips(containerId, items, filterType, cssClass) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    items.forEach(val => {
        const btn = document.createElement('button');
        btn.className = `filter-chip ${cssClass}`;
        btn.innerText = val;
        btn.onclick = function() { toggleFilter(filterType, val, this); };
        container.appendChild(btn);
    });
}

function toggleFilter(type, value, btn) {
    const arr = activeFilters[type];
    const idx = arr.indexOf(value);
    
    if(idx === -1) { arr.push(value); btn.classList.add('active'); }
    else { arr.splice(idx, 1); btn.classList.remove('active'); }
    
    applyFilters();
}

function resetFilters(shouldRender = true) {
    activeFilters = { users: [], roles: [], actions: [], targets: [], ips: [] };
    document.getElementById('filter-search').value = "";
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    
    if(shouldRender) applyFilters();
    else applyFilters();
}

function applyFilters() {
    const search = document.getElementById('filter-search').value.toLowerCase();

    displayData = rawData.filter(item => {
        if (search && !item.raw.includes(search)) return false;
        if (activeFilters.users.length > 0 && !activeFilters.users.includes(item.user)) return false;
        if (activeFilters.roles.length > 0 && !activeFilters.roles.includes(item.role)) return false;
        if (activeFilters.actions.length > 0 && !activeFilters.actions.includes(item.action)) return false;
        if (activeFilters.targets.length > 0 && !activeFilters.targets.includes(item.target)) return false;
        if (activeFilters.ips.length > 0 && !activeFilters.ips.includes(item.ip)) return false;
        return true;
    });

    sortData(currentSort.key);
}

// --- SORTING & RENDERING ---

function sortData(key) {
    if (currentSort.key === key) currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    else { currentSort.key = key; currentSort.dir = 'asc'; if(key === 'time') currentSort.dir = 'desc'; }

    document.querySelectorAll('.sort-header span').forEach(el => el.innerText = '');
    document.getElementById('sort-'+key).innerText = currentSort.dir === 'asc' ? '▲' : '▼';

    displayData.sort((a, b) => {
        let valA = String(a[key] || "").toLowerCase();
        let valB = String(b[key] || "").toLowerCase();
        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('log-body');
    tbody.innerHTML = '';
    document.getElementById('stat-count').innerText = displayData.length;

    if (displayData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-400">No matching logs found.</td></tr>';
        return;
    }

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
            <td class="p-3 whitespace-nowrap text-gray-500 font-mono text-[10px]">${row.time}</td>
            <td class="p-3 font-bold text-gray-800 text-xs whitespace-nowrap">${cell(row.user)}</td>
            <td class="p-3 text-xs whitespace-nowrap"><span class="bg-gray-100 px-1.5 py-0.5 rounded font-bold text-gray-600">${row.role}</span></td>
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
