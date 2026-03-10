/**
 * ARCHITECTURAL CAD CONTROLLER (v1.2.1)
 * Features: Fixed Z-Index array order, Vector Bounding Box Alignment, and Drag/Drop repairs.
 */

let backendData = {}, coreColors = [], tactileColors = [];
let is3D = false;
let activeColorLayerId = null;
let dragStartId = null;

// --- WORKSPACE & CAD STATE ---
const DPI = 72;
let selectedIds = [];
let isDraggingObj = false;
let dragStartX = 0, dragStartY = 0;
let initDragTransforms = {};

// Viewport Camera State (Pan & Zoom)
let viewport = { x: 40, y: -40, z: 1.0 }; 
let isMiddlePanning = false;
let panStartX = 0, panStartY = 0;

let buildState = {
    qty: 1, hardware: 'None', layers: []
};

function generateId() { return Math.random().toString(36).substr(2, 9); }

// --- LAYER MUTATORS ---
function addLayer() {
    let defColor = coreColors.find(c => c.Name === 'Black') || { Name: 'Black', Hex_Code: '#000000', Code: '322-401' };
    let newId = generateId();
    buildState.layers.push({
        id: newId, type: '1/16 Core',
        w: 8, h: 8, x: 0, y: 0, rot: 0, anchor: 'bl', 
        colorName: defColor.Name, colorHex: defColor.Hex_Code, colorCode: defColor.Code,
        elements: []
    });
    selectedIds = [newId];
    renderLayersUI(); runCalc();
}

function removeLayer(id) {
    buildState.layers = buildState.layers.filter(l => l.id !== id);
    selectedIds = selectedIds.filter(sid => sid !== id);
    renderLayersUI(); runCalc();
}

function updateLayerData(id, field, val, fromUI = true) {
    let l = buildState.layers.find(x => x.id === id);
    if (l) {
        if (field === 'type') {
            l.type = val;
            if (val === '1/32 Tactile') {
                let tc = tactileColors.find(c => c.Name === 'White') || { Name: 'White', Hex_Code: '#FFFFFF', Code: '311-2048' };
                l.colorName = tc.Name; l.colorHex = tc.Hex_Code; l.colorCode = tc.Code;
            }
            if (fromUI) renderLayersUI();
        } else if (field === 'text' || field === 'anchor') {
            l[field] = val;
        } else {
            let parsed = parseFloat(val) || 0;
            if (field === 'x' || field === 'y') parsed = Math.max(0, parsed); 
            l[field] = parsed;
        }
        
        if (field === 'anchor') updateContextToolbar();
        runCalc();
    }
}

function moveLayer(id, direction) {
    const idx = buildState.layers.findIndex(l => l.id === id);
    if (idx < 0) return;
    if (direction === -1 && idx > 0) { // UP
        let temp = buildState.layers[idx];
        buildState.layers[idx] = buildState.layers[idx-1];
        buildState.layers[idx-1] = temp;
    } else if (direction === 1 && idx < buildState.layers.length - 1) { // DOWN
        let temp = buildState.layers[idx];
        buildState.layers[idx] = buildState.layers[idx+1];
        buildState.layers[idx+1] = temp;
    }
    renderLayersUI(); runCalc();
}

// --- LEFT PANEL DRAG & DROP (FIXED) ---
function handleDragStart(e, id) { dragStartId = id; e.target.classList.add('opacity-50'); e.dataTransfer.effectAllowed = 'move'; }
function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('layer-drop-zone'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('layer-drop-zone'); }
function handleDragEnd(e) { e.target.classList.remove('opacity-50'); dragStartId = null; }
function handleDrop(e, id) {
    e.preventDefault(); e.currentTarget.classList.remove('layer-drop-zone');
    if (!dragStartId || dragStartId === id) return;
    
    const startIndex = buildState.layers.findIndex(l => l.id === dragStartId);
    const dropIndex = buildState.layers.findIndex(l => l.id === id);
    
    if (startIndex > -1 && dropIndex > -1) {
        // EXACT FIX: Added  to extract the object from the spliced array
        const item = buildState.layers.splice(startIndex, 1); 
        buildState.layers.splice(dropIndex, 0, item);
        renderLayersUI(); runCalc();
    }
}

// --- VIRTUAL WORKSPACE PANNING & ZOOMING ---
function handleCanvasWheel(e) {
    e.preventDefault();
    const zoomSensitivity = 0.002;
    let delta = -e.deltaY * zoomSensitivity;
    let newZoom = Math.min(Math.max(0.1, viewport.z + delta), 5.0);

    let rect = document.getElementById('preview-wrapper').getBoundingClientRect();
    let mouseX = e.clientX - rect.left;
    let mouseY = e.clientY - rect.top;

    viewport.x = mouseX - (mouseX - viewport.x) * (newZoom / viewport.z);
    viewport.y = mouseY - (mouseY - viewport.y) * (newZoom / viewport.z);
    viewport.z = newZoom;

    updateCanvasTransform();
}

function updateCanvasTransform() {
    const grid = document.getElementById('svg-preview-container');
    if(is3D) {
        grid.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.z}) rotateX(60deg) rotateZ(-45deg)`;
    } else {
        grid.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.z})`;
    }
}

// --- VIRTUAL WORKSPACE: MOUSE EVENTS ---
function handleCanvasMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        isMiddlePanning = true;
        panStartX = e.clientX - viewport.x;
        panStartY = e.clientY - viewport.y;
        document.body.style.cursor = 'grabbing';
        return;
    }

    if (e.button === 0) {
        if(is3D) return; 
        
        let target = e.target.closest('.cad-layer');
        if (target) {
            let id = target.getAttribute('data-id');
            if(!selectedIds.includes(id)) {
                if (e.shiftKey) selectedIds.push(id);
                else selectedIds = [id];
                renderLayersUI(); updatePreview();
            }
            
            isDraggingObj = true;
            dragStartX = e.clientX; dragStartY = e.clientY;
            initDragTransforms = {};
            selectedIds.forEach(sid => {
                let l = buildState.layers.find(x => x.id === sid);
                initDragTransforms[sid] = { x: l.x, y: l.y };
            });
        } else {
            selectedIds = [];
            renderLayersUI(); updatePreview();
        }
    }
}

function handleCanvasMouseMove(e) {
    if (isMiddlePanning) {
        viewport.x = e.clientX - panStartX;
        viewport.y = e.clientY - panStartY;
        updateCanvasTransform();
        return;
    }

    if (isDraggingObj && !is3D) {
        let dx = (e.clientX - dragStartX) / viewport.z;
        let dy = -(e.clientY - dragStartY) / viewport.z; 
        
        let dinX = dx / DPI;
        let dinY = dy / DPI;

        selectedIds.forEach(sid => {
            let l = buildState.layers.find(x => x.id === sid);
            let init = initDragTransforms[sid];
            
            let snappedX = Math.round((init.x + dinX) * 8) / 8;
            let snappedY = Math.round((init.y + dinY) * 8) / 8;
            
            l.x = Math.max(0, snappedX);
            l.y = Math.max(0, snappedY);
        });
        
        updatePreview(); 
    }
}

function handleCanvasMouseUp(e) {
    if (isMiddlePanning) {
        isMiddlePanning = false;
        document.body.style.cursor = 'default';
    }
    
    if (isDraggingObj) {
        isDraggingObj = false;
        renderLayersUI(); 
        runCalc(); 
    }
}

// --- VIRTUAL WORKSPACE: DESIGN TOOLS (VECTOR ALIGNMENT MATH) ---
function setAnchor(pos) {
    if(selectedIds.length === 0) return;
    selectedIds.forEach(id => updateLayerData(id, 'anchor', pos, false));
    updateContextToolbar();
}

function rotateSelected(deg) {
    if(selectedIds.length === 0) return;
    selectedIds.forEach(id => {
        let l = buildState.layers.find(x => x.id === id);
        l.rot = (l.rot + deg) % 360;
    });
    updateContextToolbar(); renderLayersUI(); runCalc();
}

function setExplicitRotation(val) {
    if(selectedIds.length === 0) return;
    selectedIds.forEach(id => updateLayerData(id, 'rot', val, false));
}

function alignSelected(mode) {
    if(selectedIds.length === 0) return;

    // Helper: Translate 9-point anchor into absolute boundaries for Vector Math
    const getBounds = (l) => {
        let left = l.x;
        let bottom = l.y;
        if(l.anchor.includes('c')) left = l.x - (l.w / 2);
        if(l.anchor.includes('r')) left = l.x - l.w;
        if(l.anchor.includes('m')) bottom = l.y - (l.h / 2);
        if(l.anchor.includes('t')) bottom = l.y - l.h;
        return { left, bottom, right: left + l.w, top: bottom + l.h, w: l.w, h: l.h };
    };

    // Helper: Apply new boundaries back to the object's specific anchor format
    const applyBounds = (l, newLeft, newBottom) => {
        let nx = newLeft;
        let ny = newBottom;
        if(l.anchor.includes('c')) nx = newLeft + (l.w / 2);
        if(l.anchor.includes('r')) nx = newLeft + l.w;
        if(l.anchor.includes('m')) ny = newBottom + (l.h / 2);
        if(l.anchor.includes('t')) ny = newBottom + l.h;
        l.x = nx; l.y = ny;
    };
    
    if (selectedIds.length === 1) {
        // Single Object: Align to absolute (0,0) origin strictly
        let l = buildState.layers.find(x => x.id === selectedIds);
        let b = getBounds(l);
        if (mode === 'left' || mode === 'center-x' || mode === 'right') applyBounds(l, 0, b.bottom);
        if (mode === 'top' || mode === 'center-y' || mode === 'bottom') applyBounds(l, b.left, 0);
    } else {
        // Multi-Object: Calculate Group Bounding Box
        let selectedLayers = buildState.layers.filter(l => selectedIds.includes(l.id));
        let bounds = selectedLayers.map(getBounds);

        let minX = Math.min(...bounds.map(b => b.left));
        let maxX = Math.max(...bounds.map(b => b.right));
        let minY = Math.min(...bounds.map(b => b.bottom));
        let maxY = Math.max(...bounds.map(b => b.top));

        let centerX = minX + ((maxX - minX) / 2);
        let centerY = minY + ((maxY - minY) / 2);

        selectedLayers.forEach(l => {
            let b = getBounds(l);
            if (mode === 'left') applyBounds(l, minX, b.bottom);
            if (mode === 'right') applyBounds(l, maxX - b.w, b.bottom);
            if (mode === 'center-x') applyBounds(l, centerX - (b.w / 2), b.bottom);
            if (mode === 'bottom') applyBounds(l, b.left, minY);
            if (mode === 'top') applyBounds(l, b.left, maxY - b.h);
            if (mode === 'center-y') applyBounds(l, b.left, centerY - (b.h / 2));
        });
    }
    renderLayersUI(); runCalc();
}

function updateContextToolbar() {
    const tb = document.getElementById('context-toolbar');
    if (selectedIds.length > 0 && !is3D) {
        tb.classList.remove('hidden');
        let l = buildState.layers.find(x => x.id === selectedIds);
        if (l) {
            document.querySelectorAll('.anchor-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-pos') === l.anchor);
            });
            document.getElementById('ui-rot-input').value = l.rot || 0;
        }

        // Dynamically update the Align label based on Multi-Select status
        const alignLabel = document.getElementById('ui-align-label');
        if (alignLabel) alignLabel.innerText = selectedIds.length > 1 ? "Align Group" : "Align to 0,0";

    } else {
        tb.classList.add('hidden');
    }
}

// --- COLOR MODAL SYSTEM ---
function openColorModal(layerId) {
    activeColorLayerId = layerId;
    document.getElementById('color-search').value = '';
    document.getElementById('color-modal').classList.remove('hidden');
    renderColorGrid();
}
function closeModal() { document.getElementById('color-modal').classList.add('hidden'); }

function renderColorGrid() {
    const grid = document.getElementById('modal-grid');
    const search = document.getElementById('color-search').value.toLowerCase();
    let l = buildState.layers.find(x => x.id === activeColorLayerId);
    if (!l) return;

    let data = [];
    if (l.type === '1/32 Tactile') data = tactileColors;
    else if (l.type.includes('Core')) data = coreColors.filter(c => String(c.Thickness).includes(l.type.replace(' Core','')));
    else if (l.type === '3mm PVC') data = [ {Name:'Black', Hex_Code:'#000000', Code:'PVC-BLK'}, {Name:'White', Hex_Code:'#ffffff', Code:'PVC-WHT'} ];
    
    let html = '';
    data.forEach(c => {
        if (search && !c.Name.toLowerCase().includes(search)) return;
        let bgStyle = `background-color: ${c.Hex_Code};`;
        if (l.type.includes('Core') && c.Core_Hex && c.Hex_Code !== '#e5e7eb') bgStyle = `background: linear-gradient(135deg, ${c.Hex_Code} 50%, ${c.Core_Hex} 50%);`;
        
        html += `
        <button onclick="selectColor('${c.Code || c.Name}')" class="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-200 transition w-[72px] focus:outline-none">
            <div class="w-10 h-10 rounded-full border border-gray-400 shadow-sm" style="${bgStyle}"></div>
            <span class="text-[9px] font-bold text-gray-700 text-center leading-tight w-full break-words">${c.Name}</span>
        </button>`;
    });
    grid.innerHTML = html;
}

function selectColor(codeOrName) {
    let l = buildState.layers.find(x => x.id === activeColorLayerId);
    if (!l) return;
    let data = l.type === '1/32 Tactile' ? tactileColors : coreColors;
    if (l.type === '3mm PVC') data = [ {Name:'Black', Hex_Code:'#000000', Code:'PVC-BLK'}, {Name:'White', Hex_Code:'#ffffff', Code:'PVC-WHT'} ];
    
    let item = data.find(c => c.Code === codeOrName || c.Name === codeOrName);
    if (item) { l.colorHex = item.Hex_Code; l.colorName = item.Name; l.colorCode = item.Code || 'UNK'; }
    closeModal(); renderLayersUI(); runCalc();
}

// --- UI RENDERER ---
function renderLayersUI() {
    const cont = document.getElementById('layers-container');
    if(buildState.layers.length === 0) {
        cont.innerHTML = `<div class="text-center p-8 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 font-bold text-xs">No layers built. Add a material layer below.</div>`;
        return;
    }

    let html = '';
    buildState.layers.forEach((l, index) => {
        const isSelected = selectedIds.includes(l.id);
        const borderCls = isSelected ? "border-blue-500 shadow-md ring-1 ring-blue-500 z-10" : "border-gray-200 shadow-sm opacity-90";
        
        html += `
        <div class="bg-white border rounded-xl overflow-hidden transition-all duration-200 ${borderCls} relative" onclick="selectLayer(event, '${l.id}')">
            <div class="p-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center cursor-grab active:cursor-grabbing" draggable="true" ondragstart="handleDragStart(event, '${l.id}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${l.id}')" ondragend="handleDragEnd(event)">
                <div class="flex items-center gap-2 pointer-events-none">
                    <div class="flex flex-col gap-0 mr-1 bg-white border border-gray-200 rounded shadow-inner pointer-events-auto" onclick="event.stopPropagation()">
                        <button onclick="moveLayer('${l.id}', -1)" class="text-gray-400 hover:text-blue-500 hover:bg-gray-100 text-[8px] px-1 py-0.5 border-b border-gray-100 leading-none focus:outline-none">▲</button>
                        <button onclick="moveLayer('${l.id}', 1)" class="text-gray-400 hover:text-blue-500 hover:bg-gray-100 text-[8px] px-1 py-0.5 leading-none focus:outline-none">▼</button>
                    </div>
                    <span class="bg-gray-300 text-gray-700 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shrink-0">L${index+1}</span>
                    <select onchange="updateLayerData('${l.id}', 'type', this.value); event.stopPropagation();" class="pointer-events-auto font-black text-xs text-gray-800 bg-transparent outline-none cursor-pointer border-b border-dashed border-gray-300 pb-0.5">
                        <option value="1/32 Tactile" ${l.type==='1/32 Tactile'?'selected':''}>1/32" Tactile Face</option>
                        <option value="1/16 Core" ${l.type==='1/16 Core'?'selected':''}>1/16" ADA Core</option>
                        <option value="1/8 Core" ${l.type==='1/8 Core'?'selected':''}>1/8" ADA Core</option>
                        <option value="3mm PVC" ${l.type==='3mm PVC'?'selected':''}>3mm PVC Backer</option>
                        <option value="3/16 Acrylic" ${l.type==='3/16 Acrylic'?'selected':''}>3/16" Clear Acrylic</option>
                    </select>
                </div>
                <button onclick="removeLayer('${l.id}'); event.stopPropagation();" class="text-gray-400 hover:text-red-500 transition font-bold focus:outline-none text-lg leading-none z-10 relative">✕</button>
            </div>
            
            <div class="p-3 grid grid-cols-5 gap-2" onclick="event.stopPropagation()">
                <div class="col-span-1"><label class="block text-[8px] font-bold text-gray-400 uppercase mb-0.5">W (in)</label><input type="number" value="${l.w}" step="0.5" min="1" oninput="updateLayerData('${l.id}', 'w', this.value, false)" class="w-full border rounded p-1 text-xs font-bold text-center outline-none focus:border-blue-500 bg-gray-50 shadow-inner"></div>
                <div class="col-span-1"><label class="block text-[8px] font-bold text-gray-400 uppercase mb-0.5">H (in)</label><input type="number" value="${l.h}" step="0.5" min="1" oninput="updateLayerData('${l.id}', 'h', this.value, false)" class="w-full border rounded p-1 text-xs font-bold text-center outline-none focus:border-blue-500 bg-gray-50 shadow-inner"></div>
                <div class="col-span-1 border-l pl-2 border-gray-100"><label class="block text-[8px] font-bold text-gray-400 uppercase mb-0.5">X Pos</label><input type="number" value="${l.x}" step="0.125" min="0" oninput="updateLayerData('${l.id}', 'x', this.value, false)" class="w-full border rounded p-1 text-[10px] font-bold text-center outline-none focus:border-blue-500"></div>
                <div class="col-span-1"><label class="block text-[8px] font-bold text-gray-400 uppercase mb-0.5">Y Pos</label><input type="number" value="${l.y}" step="0.125" min="0" oninput="updateLayerData('${l.id}', 'y', this.value, false)" class="w-full border rounded p-1 text-[10px] font-bold text-center outline-none focus:border-blue-500"></div>
                <div class="col-span-1 border-l pl-2 border-gray-100 flex flex-col justify-end">
                    <label class="block text-[8px] font-bold text-gray-400 uppercase mb-0.5">Color</label>
                    <div onclick="${l.type.includes('Clear') ? '' : `openColorModal('${l.id}')`}" class="${l.type.includes('Clear') ? 'opacity-50' : 'cursor-pointer hover:border-blue-400'} w-full border border-gray-300 rounded h-[24px] shadow-sm flex items-center justify-center transition" style="background-color: ${l.colorHex}" title="${l.colorName}"></div>
                </div>
            </div>
        </div>`;
    });
    cont.innerHTML = html;
    updateContextToolbar();
}

function selectLayer(e, id) {
    e.stopPropagation();
    if (e.shiftKey) {
        if (selectedIds.includes(id)) selectedIds = selectedIds.filter(sid => sid !== id);
        else selectedIds.push(id);
    } else {
        selectedIds = [id];
    }
    renderLayersUI(); updatePreview();
}

// --- PREVIEW RENDERER ---
function setViewMode(mode) {
    is3D = mode === '3D';
    
    const wrapper = document.getElementById('preview-wrapper');
    wrapper.classList.toggle('isometric-view', is3D);
    wrapper.classList.toggle('is-2d-mode', !is3D);
    
    document.getElementById('btn-view-2d').className = is3D ? "bg-white/90 text-gray-700 border border-gray-300 px-3 py-1.5 rounded shadow-sm text-[9px] font-black uppercase tracking-widest transition backdrop-blur-sm focus:outline-none" : "bg-blue-600 text-white border border-blue-700 px-3 py-1.5 rounded shadow-md text-[9px] font-black uppercase tracking-widest transition focus:outline-none";
    document.getElementById('btn-view-3d').className = !is3D ? "bg-white/90 text-gray-700 border border-gray-300 px-3 py-1.5 rounded shadow-sm text-[9px] font-black uppercase tracking-widest transition backdrop-blur-sm focus:outline-none" : "bg-blue-600 text-white border border-blue-700 px-3 py-1.5 rounded shadow-md text-[9px] font-black uppercase tracking-widest transition focus:outline-none";
    
    if(is3D) { selectedIds = []; renderLayersUI(); }
    
    viewport.x = 40;
    viewport.y = is3D ? 40 : -40; 
    viewport.z = 1.0;
    updateCanvasTransform();
    
    updateContextToolbar();
    updatePreview();
}

function updatePreview() {
    const target = document.getElementById('layer-render-target');
    if(buildState.layers.length === 0) {
        target.innerHTML = '';
        document.getElementById('grid-axes').style.display = 'none';
        return;
    }
    
    document.getElementById('grid-axes').style.display = is3D ? 'none' : 'block';

    let html = '';
    let layerCount = buildState.layers.length;

    buildState.layers.forEach((l, idx) => {
        const isTactile = l.type === '1/32 Tactile';
        const bgHex = isTactile ? 'transparent' : l.colorHex;
        const isSelected = selectedIds.includes(l.id);
        const dimOpacity = (selectedIds.length > 0 && !isSelected && !is3D) ? 'opacity: 0.3;' : 'opacity: 1;';
        const borderCls = isTactile ? (isSelected ? 'cad-selected' : '') : (isSelected ? 'cad-selected' : 'border border-black/20');
        
        let xPct = 0, yPct = 0;
        if(l.anchor.includes('c')) xPct = 50;
        if(l.anchor.includes('r')) xPct = 100;
        if(l.anchor.includes('m')) yPct = 50;
        if(l.anchor.includes('t')) yPct = 100;

        let leftPx = (l.x * DPI);
        let bottomPx = (l.y * DPI); 
        let wPx = l.w * DPI;
        let hPx = l.h * DPI;

        // FIXED: Reversed Z-Index Math. Index 0 (Top of Menu) gets highest physical space and CSS z-index!
        let currentZ = is3D ? ((layerCount - idx) * 30) : 0;
        let zIndex = layerCount - idx; 

        let transformStr = `transform: translate(-${xPct}%, ${yPct}%) translateZ(${currentZ}px) rotate(${l.rot || 0}deg); transform-origin: ${xPct}% ${100 - yPct}%; z-index: ${zIndex};`;

        html += `
        <div data-id="${l.id}" class="cad-layer ${borderCls}" style="background-color: ${bgHex}; left: ${leftPx}px; bottom: ${bottomPx}px; width: ${wPx}px; height: ${hPx}px; ${transformStr} ${dimOpacity}">
            ${isTactile ? `<div class="w-full h-full border-2 border-dashed" style="border-color: ${l.colorHex}; pointer-events: none;"></div>` : ''}
        </div>`;
    });

    target.innerHTML = html;
}

// --- MASTER MATH ENGINE ---
function runCalc() {
    if(!backendData.Retail_Min_Order) return;
    
    buildState.qty = parseInt(document.getElementById('sys-qty').value) || 1;
    buildState.hardware = document.getElementById('sys-hardware').value;

    updatePreview();

    if (buildState.layers.length === 0) {
        document.getElementById('ui-total').innerText = "$0.00";
        document.getElementById('ui-unit-price').innerText = "Unit: $0.00";
        document.getElementById('ledger-items').innerHTML = `<div class="text-center text-xs text-gray-400 italic py-2">Awaiting Configuration</div>`;
        return;
    }

    try {
        const result = calculateArchitectural(buildState, backendData);
        
        document.getElementById('ui-total').innerText = `$${(result.retail.grandTotal || 0).toFixed(2)}`;
        document.getElementById('ui-unit-price').innerText = `Unit: $${(result.retail.unitPrice || 0).toFixed(2)}`;
        document.getElementById('min-badge').classList.toggle('hidden', !result.retail.isMinApplied);
        
        let breakdownHtml = result.retail.breakdown.map(b => `
            <div class="flex justify-between text-[10px] text-gray-600 border-b border-gray-100 pb-1 mb-1">
                <span>${b.label}</span>
                <span class="font-bold text-gray-800">$${b.total.toFixed(2)}</span>
            </div>
        `).join('');
        document.getElementById('ledger-items').innerHTML = breakdownHtml;

    } catch(e) { console.error("Physics Engine Error:", e); }
}

function exportCanvasSVG() {
    if(buildState.layers.length === 0) return alert("Add layers before exporting.");

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    buildState.layers.forEach(l => {
        let ox = 0, oy = 0;
        if(l.anchor.includes('c')) ox = l.w / 2;
        if(l.anchor.includes('r')) ox = l.w;
        if(l.anchor.includes('m')) oy = l.h / 2;
        if(l.anchor.includes('t')) oy = l.h;

        let left = l.x - ox;
        let bottom = l.y - oy;
        let right = left + l.w;
        let top = bottom + l.h;

        if (left < minX) minX = left;
        if (bottom < minY) minY = bottom;
        if (right > maxX) maxX = right;
        if (top > maxY) maxY = top;
    });

    const totalW = maxX - minX;
    const totalH = maxY - minY;

    let svgBody = '';
    
    // FIXED: Reverse array order so the bottom layer is rendered first in SVG XML
    const printStack = [...buildState.layers].reverse();
    
    printStack.forEach(l => {
        let ox = 0, oy = 0;
        if(l.anchor.includes('c')) ox = l.w / 2;
        if(l.anchor.includes('r')) ox = l.w;
        if(l.anchor.includes('m')) oy = l.h / 2;
        if(l.anchor.includes('t')) oy = l.h;

        let svgAnchorX = l.x - minX;
        let svgAnchorY = maxY - l.y;
        
        let rectX = -ox * DPI;
        let rectY = -(l.h - oy) * DPI;
        
        let transform = `transform="translate(${svgAnchorX * DPI} ${svgAnchorY * DPI}) rotate(${l.rot || 0}) translate(${rectX} ${rectY})"`;

        let inner = '';
        if (l.type === '1/32 Tactile') {
            inner = `<rect width="${l.w * DPI}" height="${l.h * DPI}" fill="none" stroke="${l.colorHex}" stroke-width="2" stroke-dasharray="4"/>`;
        } else {
            inner = `<rect width="${l.w * DPI}" height="${l.h * DPI}" fill="${l.colorHex}" />`;
        }
        svgBody += `<g ${transform}>${inner}</g>`;
    });

    const finalSVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
    <svg width="${totalW}in" height="${totalH}in" viewBox="0 0 ${totalW * DPI} ${totalH * DPI}" xmlns="http://www.w3.org/2000/svg">
        ${svgBody}
    </svg>`;

    const blob = new Blob([finalSVG], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SignOS_CAD_Export_${totalW}x${totalH}.svg`;
    a.click();
    URL.revokeObjectURL(url);
}

// --- INIT ---
window.addEventListener('load', async () => {
    if (typeof injectHeader === 'function') injectHeader("A La Carte CAD Builder");

    SignOS_UI.showLoader('preview-wrapper', 'Loading Material Data...');

    try {
        const payload = await SignOS.fetchProductData('PROD_ADA_Signs', ['REF_Colors_Rowmark']);
        backendData = payload.config;
        const rawRowmark = payload.tables['REF_Colors_Rowmark'] || [];
        
        coreColors = rawRowmark.filter(r => r.Series && (r.Series.includes('Ultra-Mattes') || r.Series.includes('Mattes'))).map(c => ({
            Code: c.Item_Code, Name: c.Cap_Color, Hex_Code: (c.Cap_Hex === 'Transparent' || c.Cap_Color.includes('Clear')) ? '#e5e7eb' : c.Cap_Hex, Core_Hex: c.Core_Hex, Thickness: c.Thickness
        }));
        
        tactileColors = rawRowmark.filter(r => r.Series && r.Series.includes('ADA Alternative')).map(c => ({
            Code: c.Item_Code, Name: c.Cap_Color, Hex_Code: c.Cap_Hex
        }));

        SignOS_UI.hideLoader('preview-wrapper');
        addLayer();
        setViewMode('2D');
        
        viewport.x = 40;
        viewport.y = -40;
        updateCanvasTransform();
        
    } catch(e) {
        console.error("API Error:", e);
        SignOS_UI.hideLoader('preview-wrapper', true);
    }
});