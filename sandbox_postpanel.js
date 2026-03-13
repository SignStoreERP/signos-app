/**
 * SignOS Sandbox & Print Engine (Post & Panel)
 * Features: Interactive Bidirectional Margin Calculator, Parameterized Formulas, and Structural SVGs.
 */

document.addEventListener('mouseover', e => {
    const target = e.target.closest('.hover-var');
    if(target) { 
        const varName = target.getAttribute('data-var'); 
        document.querySelectorAll(`.hover-var[data-var="${varName}"]`).forEach(el => el.classList.add('highlight-var'));
        const sbxInput = document.getElementById(`wrap_sbx_${varName}`);
        if(sbxInput) sbxInput.classList.add('bg-yellow-100', 'border-yellow-400');
    }
});

document.addEventListener('mouseout', e => {
    const target = e.target.closest('.hover-var');
    if(target) { 
        const varName = target.getAttribute('data-var'); 
        document.querySelectorAll(`.hover-var[data-var="${varName}"]`).forEach(el => el.classList.remove('highlight-var'));
        const sbxInput = document.getElementById(`wrap_sbx_${varName}`);
        if(sbxInput) sbxInput.classList.remove('bg-yellow-100', 'border-yellow-400');
    }
});

function applyFallbacks(data) {
    const defaults = {
        Rate_Shop_Labor: 20, Rate_Operator: 25, Rate_Machine_Print: 5, Rate_Machine_Cut: 5, Rate_Paint_Labor: 30, Rate_CNC_Labor: 25, Rate_Machine_CNC: 10,
        Cost_Post_Cap: 5.00, Cost_Paint_SqFt: 2.50, Cost_Paint_Cup: 1.00, Cost_Adhesive_Tube: 18.71, Yield_Adhesive_Tube_LF: 10,
        Cost_Stock_040_4x8: 84.44, Cost_Stock_063_4x8: 98.12, Cost_Stock_080_4x8: 124.57, Cost_Stock_3mm_4x8: 52.09, Cost_Stock_6mm_4x8: 72.10,
        Cost_Vin_Cast: 1.30, Cost_Lam_Cast: 0.96, Cost_Ink_Latex: 0.16, Cost_Transfer_Tape: 0.15,
        Speed_Print_Roll: 150, Speed_Lam_Roll: 300, Speed_Cut_Graphtec: 50, Time_Setup_Job: 15, Time_Weld_Per_Loc: 1.5, Time_Clean_Weld_Loc: 0.33, Time_Adhesive_Per_Face: 7,
        Time_Saw_Miter: 5, Time_Saw_Band: 10, Time_Gather_Mats: 10, Time_Setup_CNC: 10, Time_CNC_Easy_SqFt: 1, Time_Shear_Cut: 0.35, 
        Time_Mount_Flat_SqFt: 0.25, Time_Sand_SqFt: 0.5, Time_Paint_Move_Prep: 15, Time_Paint_Setup: 10, Time_Paint_Cup_Change: 3, 
        Time_Paint_Primer_SqFt: 0.104, Time_Paint_Finish_SqFt: 0.312, Time_Weed_Simple: 0.42, Time_Mask_SqFt: 0.17,
        Target_Margin_Pct: 0.60, Waste_Factor: 1.15, Factor_Risk: 1.05
    };

    for (let key in defaults) {
        if (data[key] === undefined || data[key] === '' || data[key] == 0 || data[key] === '#N/A') {
            data[key] = defaults[key];
        }
    }
}

function toggleSandbox() {
    const wrap = document.getElementById('app-wrapper');
    const left = document.getElementById('sandbox-ledger');
    const right = document.getElementById('sandbox-vars');
    
    const leftContent = left.querySelector('.overflow-y-auto');
    const rightContent = right.querySelector('.overflow-y-auto');
    if (leftContent) { leftContent.classList.remove('max-h-[70vh]', 'overflow-y-auto', 'custom-scroll'); }
    if (rightContent) { rightContent.classList.remove('max-h-[70vh]', 'overflow-y-auto', 'custom-scroll'); }

    if (left.classList.contains('hidden')) {
        wrap.classList.remove('max-w-lg'); wrap.classList.add('max-w-[1250px]');
        left.classList.remove('hidden'); left.classList.add('flex');
        right.classList.remove('hidden'); right.classList.add('flex');
        if(!customSimData) {
            customSimData = { ...backendData };
            applyFallbacks(customSimData);
            buildSandboxInputs();
        }
        applySandbox();
    } else {
        wrap.classList.add('max-w-lg'); wrap.classList.remove('max-w-[1250px]');
        left.classList.add('hidden'); left.classList.remove('flex');
        right.classList.add('hidden'); right.classList.remove('flex');
    }
}

function buildSandboxInputs() {
    const buildSection = (arr, containerId) => {
        let html = '';
        arr.forEach(i => {
            if (i.heading) {
                html += `<div class="col-span-full mt-4 mb-2 border-b border-slate-200"><span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">${i.heading}</span></div>`;
            }
            let v = customSimData[i.key] !== undefined ? customSimData[i.key] : '';
            if (v !== '' && !isNaN(v) && (i.label.includes('$') || i.key.includes('Rate') || i.key.includes('Cost'))) v = parseFloat(v).toFixed(2);
            
            let desc = backendData['META_NOTE_' + i.key] || "";
            html += `
            <div id="wrap_sbx_${i.key}" class="flex justify-between items-center gap-2 transition-opacity duration-300 py-0.5">
                <label class="text-[10px] font-bold text-gray-600 truncate flex-1 hover-var cursor-help transition-all" data-var="${i.key}" title="${desc}">${i.label}</label>
                <input type="text" id="sbx_${i.key}" value="${v}" class="w-16 bg-gray-50 border border-gray-300 text-gray-800 text-[10px] font-bold text-center rounded outline-none focus:border-blue-400 focus:bg-white shadow-inner py-1">
            </div>`;
        });
        document.getElementById(containerId).innerHTML = html;
    };
    
    let dynamicCosts = [...window.POSTPANEL_CONFIG.costs];
    if (dynamicKeys && dynamicKeys.length > 0) {
        const activeMats = dynamicKeys.filter(dk => !window.POSTPANEL_CONFIG.costs.find(c => c.key === dk)).map((dk, idx) => {
            return idx === 0 ? { key: dk, heading: 'Active Project Materials', label: dk.split('_').slice(1).join(' ') + ' ($)' } : { key: dk, label: dk.split('_').slice(1).join(' ') + ' ($)' };
        });
        if (activeMats.length > 0) {
            dynamicCosts = [...activeMats, ...dynamicCosts];
        }
    }

    buildSection(window.POSTPANEL_CONFIG.retails, 'sbx-retail-inputs');
    buildSection(dynamicCosts, 'sbx-cost-inputs');
}

function applySandbox() {
    if(!customSimData) customSimData = { ...backendData };
    const harvest = (arr) => { arr.forEach(i => { 
        let el = document.getElementById(`sbx_${i.key}`);
        if(el && el.value !== "") customSimData[i.key] = parseFloat(el.value) || el.value; 
        else customSimData[i.key] = ""; 
    }); };
    harvest(window.POSTPANEL_CONFIG.retails); 
    
    let dynArr = [...window.POSTPANEL_CONFIG.costs];
    dynamicKeys.forEach(dk => { if(!dynArr.find(c => c.key === dk)) dynArr.push({key:dk}); });
    harvest(dynArr);

    document.getElementById('sim-badge').classList.remove('hidden');
    document.getElementById('main-card').classList.add('border-yellow-400');
    runCalc();
}

function resetSandbox() {
    customSimData = { ...backendData };
    applyFallbacks(customSimData);
    document.getElementById('sim-badge').classList.add('hidden');
    document.getElementById('main-card').classList.remove('border-yellow-400');
    buildSandboxInputs();
    runCalc();
}

function dimInactiveSandboxVars() {
    const activeVars = new Set();
    document.querySelectorAll('#sandbox-ledger .hover-var').forEach(el => activeVars.add(el.getAttribute('data-var')));
    
    let allVars = [...window.POSTPANEL_CONFIG.retails, ...window.POSTPANEL_CONFIG.costs];
    dynamicKeys.forEach(dk => { if(!allVars.find(c => c.key === dk)) allVars.push({key:dk}); });

    allVars.forEach(item => {
        const wrapEl = document.getElementById(`wrap_sbx_${item.key}`);
        const inputEl = document.getElementById(`sbx_${item.key}`);
        if (wrapEl && inputEl) {
            const labelEl = wrapEl.querySelector('label');
            if (activeVars.has(item.key)) {
                wrapEl.classList.remove('opacity-40'); wrapEl.classList.add('opacity-100');
                if (labelEl) { labelEl.classList.remove('text-gray-600', 'font-bold'); labelEl.classList.add('text-black', 'font-black'); }
                inputEl.classList.remove('bg-gray-50', 'text-gray-800', 'border-gray-300');
                inputEl.classList.add('bg-white', 'text-blue-900', 'border-blue-400', 'font-bold');
            } else {
                wrapEl.classList.remove('opacity-100'); wrapEl.classList.add('opacity-40');
                if (labelEl) { labelEl.classList.remove('text-black', 'font-black'); labelEl.classList.add('text-gray-600', 'font-bold'); }
                inputEl.classList.remove('bg-white', 'text-blue-900', 'border-blue-400', 'font-bold');
                inputEl.classList.add('bg-gray-50', 'text-gray-800', 'border-gray-300');
            }
        }
    });
}

function renderLedgerUI(res) {
    const fmt = (n) => "$" + (n||0).toFixed(2);
    if (!res || !res.cost || !res.cost.breakdown) return;

    const theCost = res.cost.total;
    const theSales = res.retail.grandTotal;
    const theProfit = theSales - theCost;
    const theMarginPct = theSales > 0 ? (theProfit / theSales) * 100 : 0;

    let marginHtml = `
        <div class="flex justify-between items-center border-b border-gray-100 pb-1.5 mb-1.5 mt-2">
            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest" title="Cannot be manually edited. Represents exact physics calculation.">Product Hard Cost</span>
            <span class="text-sm font-mono font-black text-red-600">${fmt(theCost)}</span>
        </div>
        <div class="flex justify-between items-center mb-1.5 group">
            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-blue-600 transition">Profit Margin (%)</span>
            <div class="flex items-center gap-1">
                <input type="number" id="interactive-margin" value="${theMarginPct.toFixed(1)}" class="w-16 border border-gray-300 rounded text-right text-sm font-black p-1 focus:border-blue-500 outline-none bg-blue-50 text-blue-800 shadow-inner transition-colors">
                <span class="text-xs font-bold text-gray-500">%</span>
            </div>
        </div>
        <div class="flex justify-between items-center mb-1.5 group">
            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-blue-600 transition">Sales Price ($)</span>
            <div class="flex items-center gap-1">
                <span class="text-xs font-bold text-gray-500">$</span>
                <input type="number" id="interactive-sales" value="${theSales.toFixed(2)}" class="w-24 border border-gray-300 rounded text-right text-sm font-black p-1 focus:border-blue-500 outline-none bg-blue-50 text-blue-800 shadow-inner transition-colors">
            </div>
        </div>
        <div class="flex justify-between items-center border-t border-gray-100 pt-1.5 mt-1.5">
            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Est. Net Profit</span>
            <span class="text-sm font-mono font-black text-green-600">${fmt(theProfit)}</span>
        </div>
        <div class="text-[8px] text-gray-400 font-mono italic text-center mt-2 border-t border-gray-100 pt-1">Math: Sales Price = Cost / (1 - Margin)</div>
    `;
    
    document.getElementById('ledger-interactive-header').innerHTML = marginHtml;

    document.getElementById('interactive-margin').addEventListener('change', (e) => {
        let m = parseFloat(e.target.value) / 100;
        if (m >= 1) m = 0.99; 
        customSimData['Target_Margin_Pct'] = m;
        customSimData['Override_Retail_Total'] = ""; 
        applySandbox();
    });
    
    document.getElementById('interactive-sales').addEventListener('change', (e) => {
        let s = parseFloat(e.target.value);
        if (s <= theCost) s = theCost + 0.01; 
        customSimData['Override_Retail_Total'] = s;
        customSimData['Target_Margin_Pct'] = ""; 
        applySandbox();
    });

    let retHtml = res.retail.breakdown.map(i => `
    <div class="mb-2 border-b border-gray-100 pb-1.5">
        <div class="flex justify-between text-[11px] text-blue-800 font-bold tracking-wide"><span>${i.label}</span><span class="font-mono">${fmt(i.total)}</span></div>
        <div class="text-[9px] text-gray-500 font-mono italic mt-0.5">↳ ${i.formula || ''}</div>
    </div>
    `).join('');
    retHtml += `<div class="flex justify-between text-[12px] font-black text-blue-700 mt-2 pt-2 border-t-2 border-blue-200"><span>Gross Retail:</span><span>${fmt(res.retail.grandTotal)}</span></div>`;
    document.getElementById('sbx-retail-breakdown').innerHTML = retHtml;

    const costGroups = {
        'metal_mat': { title: 'Metal Fabrication (Materials)', items: [] },
        'metal_lab': { title: 'Metal Fabrication (Labor)', items: [] },
        'graph_mat': { title: 'Graphics & Print (Materials)', items: [] },
        'graph_lab': { title: 'Graphics & Print (Labor)', items: [] },
        'paint_mat': { title: 'Paint & Finishes (Materials)', items: [] },
        'paint_lab': { title: 'Paint & Finishes (Labor)', items: [] }
    };
    
    res.cost.breakdown.forEach(i => {
        if (costGroups[i.cB]) costGroups[i.cB].items.push(i);
        else costGroups['metal_mat'].items.push(i); 
    });

    let cstHtml = '';
    for (const [key, group] of Object.entries(costGroups)) {
        if (group.items.length === 0) continue;
        let groupTotal = group.items.reduce((sum, item) => sum + item.total, 0);
        cstHtml += `<div class="mt-4 mb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-0.5 flex justify-between">
            <span>${group.title}</span><span class="text-slate-500 font-mono">${fmt(groupTotal)}</span>
        </div>`;
        
        cstHtml += group.items.map(i => {
            let metaTags = [];
            if (i.meta?.waste > 0) metaTags.push(`<span class="text-red-500 font-bold ml-2" title="Waste Component">W: ${fmt(i.meta.waste)}</span>`);
            if (i.meta?.time > 0) metaTags.push(`<span class="text-blue-500 font-bold ml-2" title="Estimated Time">T: ${i.meta.time.toFixed(1)}m</span>`);
            let metaStr = metaTags.length > 0 ? metaTags.join('') : '';

            return `
            <div class="mb-1.5 hover:bg-gray-50 transition cursor-help group">
                <div class="flex justify-between text-[11px] text-red-800 font-bold tracking-wide"><span>${i.label}</span><span class="font-mono">${fmt(i.total)}</span></div>
                <div class="flex justify-between items-start text-[9px] text-gray-500 font-mono italic mt-0.5 leading-snug">
                    <span class="pr-2 block flex-1">Math: <span class="text-indigo-600">${i.formula || ''}</span></span>
                    <span class="shrink-0 flex gap-1">${metaStr}</span>
                </div>
            </div>`;
        }).join('');
    }

    cstHtml += `<div class="flex justify-between text-[12px] font-black text-red-700 mt-3 pt-2 border-t-2 border-red-200"><span>Total Hard Cost:</span><span>${fmt(res.cost.total)}</span></div>`;
    document.getElementById('sbx-cost-breakdown').innerHTML = cstHtml;
}

// --- 3-VIEW HEADLESS PRINT ENGINE ---
function printSandbox() {
    if(!lastSimResult || !lastSimResult.geom) return;
    const fmt = (n) => "$" + (n||0).toFixed(2);
    const cleanHTML = (str) => str.replace(/<[^>]*>?/gm, '');
    const geom = lastSimResult.geom;
    const qty = parseInt(document.getElementById('qty').value) || 1;
    
    const padX = 25;
    const padY = 15;
    const th = geom.above + geom.under;
    const ow = geom.overallW;
    const maxH = 150; 
    const maxW = 200; 
    const scale = Math.min(maxW / ow, maxH / th);
    
    const sTh = th * scale;
    const sOw = ow * scale;
    const sClr = geom.clearance * scale;
    const sPostD = geom.post * scale;
    const sUnder = geom.under * scale;
    const sHoleD = geom.holeD * scale;

    let p1X = (sOw - (geom.postSpacing * scale + 2*sPostD)) / 2;
    let p2X = p1X + sPostD + (geom.postSpacing * scale);

    const dimColor = "#e11d48"; // Red ink for paper printout
    const fSize = 6;
    const drawHDim = (x1, x2, y, label) => { return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${dimColor}" stroke-width="0.75"/><line x1="${x1}" y1="${y-2}" x2="${x1}" y2="${y+2}" stroke="${dimColor}" stroke-width="0.75"/><line x1="${x2}" y1="${y-2}" x2="${x2}" y2="${y+2}" stroke="${dimColor}" stroke-width="0.75"/><text x="${(x1+x2)/2}" y="${y-3}" fill="${dimColor}" font-size="${fSize}" font-family="monospace" text-anchor="middle" font-weight="bold">${label}</text>`; };
    const drawVDim = (x, y1, y2, label, align="end") => { let textX = align === "end" ? x - 3 : x + 3; return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${dimColor}" stroke-width="0.75"/><line x1="${x-2}" y1="${y1}" x2="${x+2}" y2="${y1}" stroke="${dimColor}" stroke-width="0.75"/><line x1="${x-2}" y1="${y2}" x2="${x+2}" y2="${y2}" stroke="${dimColor}" stroke-width="0.75"/><text x="${textX}" y="${(y1+y2)/2 + 2}" fill="${dimColor}" font-size="${fSize}" font-family="monospace" text-anchor="${align}" font-weight="bold">${label}</text>`; };

    let bgLayer = `<rect x="0" y="${sTh - sUnder}" width="${sOw}" height="${sUnder}" fill="#22c55e" opacity="0.1"/>`;
    bgLayer += `<line x1="-5" y1="${sTh - sUnder}" x2="${sOw + 5}" y2="${sTh - sUnder}" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="3,2"/>`;

    const footerH = sUnder * 0.66;
    const footerY = sTh - footerH;
    bgLayer += `<rect x="${p1X - (sHoleD/2 - sPostD/2)}" y="${footerY}" width="${sHoleD}" height="${footerH}" fill="#94a3b8" opacity="0.3" rx="2"/>`;
    bgLayer += `<rect x="${p2X - (sHoleD/2 - sPostD/2)}" y="${footerY}" width="${sHoleD}" height="${footerH}" fill="#94a3b8" opacity="0.3" rx="2"/>`;

    const postCutThick = geom.frameThick * scale;
    const postDrawH = sTh - postCutThick;
    bgLayer += `<rect x="${p1X}" y="${postCutThick}" width="${sPostD}" height="${postDrawH}" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>`;
    bgLayer += `<rect x="${p2X}" y="${postCutThick}" width="${sPostD}" height="${postDrawH}" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>`;

    // FRONT SOLID 
    let svgFrontSolid = `<svg width="100%" height="100%" viewBox="-${padX} -${padY} ${sOw + padX*2} ${sTh + padY*2}" style="overflow: visible;">` + bgLayer;
    let currY = sTh - sUnder - sClr - (geom.totalPanelH * scale);
    geom.panels.forEach((p, i) => {
        let pW_real = p.mountStyle === 'Between' ? geom.postSpacing : p.w;
        let sPw = pW_real * scale;
        let sPh = p.h * scale;
        let panelX = p.mountStyle === 'Between' ? p1X + sPostD : (sOw - sPw) / 2;
        if (i > 0) currY += (p.gap * scale);
        
        let frameW_real = Math.max(pW_real, geom.postSpacing);
        let sFw = frameW_real * scale;
        let fX = (sOw - sFw) / 2;
        const ft = geom.frameThick * scale;
        let shareTop = (i > 0 && p.gap === 0 && p.mountStyle === geom.panels[i-1].mountStyle);
        
        svgFrontSolid += `<rect x="${fX}" y="${currY + sPh - ft}" width="${sFw}" height="${ft}" fill="#94a3b8"/>`;
        if (!shareTop) svgFrontSolid += `<rect x="${fX}" y="${currY}" width="${sFw}" height="${ft}" fill="#94a3b8"/>`;
        
        let isFlushSealed = p.mountStyle === 'Flush' && Math.abs(p.w - (geom.postSpacing + geom.post*2)) < 0.01;
        let vHeight = sPh - (shareTop ? ft : ft*2);
        let vY = currY + (shareTop ? 0 : ft);
        
        if (!isFlushSealed) {
            svgFrontSolid += `<rect x="${panelX}" y="${vY}" width="${ft}" height="${vHeight}" fill="#94a3b8"/>`;
            svgFrontSolid += `<rect x="${panelX + sPw - ft}" y="${vY}" width="${ft}" height="${vHeight}" fill="#94a3b8"/>`;
        }
        
        let faceOpacity = p.mountStyle === 'Between' ? 0.8 : 0.95;
        svgFrontSolid += `<rect x="${panelX}" y="${currY}" width="${sPw}" height="${sPh}" fill="#3b82f6" stroke="#1e3a8a" stroke-width="1.5" opacity="${faceOpacity}"/>`;
        currY += sPh;
    });

    // Apply Shop Dimensions
    svgFrontSolid += drawHDim(0, sOw, -8, geom.overallW + '" O.A.W');
    svgFrontSolid += drawHDim(p1X + sPostD, p2X, sTh - sUnder - (sClr/2), geom.postSpacing + '" I.D.');
    svgFrontSolid += drawVDim(-8, 0, sTh - sUnder, geom.above + '" A.G.', "end");
    svgFrontSolid += drawVDim(-8, sTh - sUnder, sTh, geom.under + '" B.G.', "end");
    if (sClr > 0) svgFrontSolid += drawVDim(sOw + 8, sTh - sUnder - sClr, sTh - sUnder, geom.clearance + '" Clr', "start");
    
    svgFrontSolid += `</svg>`;

    // FRONT X-RAY 
    let svgFrontXray = `<svg width="100%" height="100%" viewBox="-${padX} -${padY} ${sOw + padX*2} ${sTh + padY*2}" style="overflow: visible;">` + bgLayer;
    let currYx = sTh - sUnder - sClr - (geom.totalPanelH * scale);
    geom.panels.forEach((p, i) => {
        let pW_real = p.mountStyle === 'Between' ? geom.postSpacing : p.w;
        let sPw = pW_real * scale;
        let sPh = p.h * scale;
        let panelX = p.mountStyle === 'Between' ? p1X + sPostD : (sOw - sPw) / 2;
        if (i > 0) currYx += (p.gap * scale);
        
        let frameW_real = Math.max(pW_real, geom.postSpacing);
        let sFw = frameW_real * scale;
        let fX = (sOw - sFw) / 2;
        const ft = geom.frameThick * scale;
        let shareTop = (i > 0 && p.gap === 0 && p.mountStyle === geom.panels[i-1].mountStyle);
        
        svgFrontXray += `<rect x="${fX}" y="${currYx + sPh - ft}" width="${sFw}" height="${ft}" fill="#94a3b8"/>`;
        if (!shareTop) svgFrontXray += `<rect x="${fX}" y="${currYx}" width="${sFw}" height="${ft}" fill="#94a3b8"/>`;
        
        let isFlushSealed = p.mountStyle === 'Flush' && Math.abs(p.w - (geom.postSpacing + geom.post*2)) < 0.01;
        let vHeight = sPh - (shareTop ? ft : ft*2);
        let vY = currYx + (shareTop ? 0 : ft);

        if (!isFlushSealed) {
            svgFrontXray += `<rect x="${panelX}" y="${vY}" width="${ft}" height="${vHeight}" fill="#94a3b8"/>`;
            svgFrontXray += `<rect x="${panelX + sPw - ft}" y="${vY}" width="${ft}" height="${vHeight}" fill="#94a3b8"/>`;
        }
        
        svgFrontXray += `<rect x="${panelX}" y="${currYx}" width="${sPw}" height="${sPh}" fill="#3b82f6" stroke="#1e3a8a" stroke-width="1.5" opacity="0.25"/>`;
        currYx += sPh;
    });

    // Apply Shop Dimensions
    svgFrontXray += drawHDim(0, sOw, -8, geom.overallW + '" O.A.W');
    svgFrontXray += drawHDim(p1X + sPostD, p2X, sTh - sUnder - (sClr/2), geom.postSpacing + '" I.D.');
    svgFrontXray += drawVDim(-8, 0, sTh - sUnder, geom.above + '" A.G.', "end");
    svgFrontXray += drawVDim(-8, sTh - sUnder, sTh, geom.under + '" B.G.', "end");
    if (sClr > 0) svgFrontXray += drawVDim(sOw + 8, sTh - sUnder - sClr, sTh - sUnder, geom.clearance + '" Clr', "start");

    svgFrontXray += `</svg>`;

    // SIDE VIEW
    const sideW = Math.max(geom.post + 4, 20); 
    const visFaceThick = 2;
    const sSideW = sideW * scale;
    const px = (sSideW - sPostD) / 2;

    let svgSide = `<svg width="100%" height="100%" viewBox="-${padX} -${padY} ${sSideW + padX*2} ${sTh + padY*2}" style="overflow: visible;">`;
    svgSide += `<rect x="0" y="${sTh - sUnder}" width="${sSideW}" height="${sUnder}" fill="#22c55e" opacity="0.1"/>`;
    svgSide += `<line x1="-5" y1="${sTh - sUnder}" x2="${sSideW + 5}" y2="${sTh - sUnder}" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="3,2"/>`;
    svgSide += `<rect x="${px - (sHoleD/2 - sPostD/2)}" y="${footerY}" width="${sHoleD}" height="${footerH}" fill="#94a3b8" opacity="0.3" rx="2"/>`;
    svgSide += `<rect x="${px}" y="${postCutThick}" width="${sPostD}" height="${postDrawH}" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>`;
    
    let sy = sTh - sUnder - sClr - (geom.totalPanelH * scale);
    geom.panels.forEach((p, i) => {
        let sPh = p.h * scale;
        if (i > 0) sy += (p.gap * scale);
        if (p.mountStyle === 'Between') {
            svgSide += `<rect x="${px + (sPostD/2) - (visFaceThick/2)}" y="${sy}" width="${visFaceThick}" height="${sPh}" fill="#1e40af"/>`;
        } else {
            svgSide += `<rect x="${px - visFaceThick}" y="${sy}" width="${visFaceThick}" height="${sPh}" fill="#3b82f6"/>`;
            if(p.sides === 2) svgSide += `<rect x="${px + sPostD}" y="${sy}" width="${visFaceThick}" height="${sPh}" fill="#3b82f6"/>`;
        }
        sy += sPh;
    });

    // Apply Shop Dimensions
    svgSide += drawHDim(px, px + sPostD, -8, geom.post + '"');
    let dy = sTh - sUnder - sClr - (geom.totalPanelH * scale);
    geom.panels.forEach((p, i) => {
        let sPh = p.h * scale;
        if (i > 0) dy += (p.gap * scale);
        svgSide += drawVDim(sSideW + 8, dy, dy + sPh, p.h + '"', "start");
        dy += sPh;
    });

    svgSide += `</svg>`;

    const jobDesc = document.getElementById('job-desc').value;
    
    let totalWasteTarget = 0;
    let totalTimeTarget = 0;
    const grouped = {};
    lastSimResult.cost.breakdown.forEach(i => {
        const trk = i.cB || 'General';
        if(!grouped[trk]) grouped[trk] = [];
        grouped[trk].push(i);
        if (i.meta?.waste) totalWasteTarget += i.meta.waste;
        if (i.meta?.time) totalTimeTarget += i.meta.time;
    });

    const bomItems = lastSimResult.cost.breakdown.filter(item => item.cB && item.cB.includes('_mat'));
    let bomHtml = '';
    if (bomItems.length > 0) {
        bomItems.forEach(item => { 
            let pull = item.meta?.pull || 'N/A';
            let cut = item.meta?.cut || 'N/A';
            
            let pullCode = pull !== 'N/A' ? `<strong>PULL:</strong> <span style="color:#0369a1;">${pull}</span>` : '';
            let cutCode = cut !== 'N/A' ? `<strong>CUT:</strong> <span style="color:#0369a1;">${cut}</span>` : '';
            
            let subBar = '';
            if(pullCode || cutCode) {
                subBar = `<div style="display:flex; justify-content:space-between; font-size:9px; color:#475569; background:#f8fafc; padding:3px 4px; border-radius:2px; border: 1px solid #e2e8f0;">
                    <span style="flex:1;">${pullCode}</span>
                    <span style="flex:1;">${cutCode}</span>
                </div>`;
            }

            bomHtml += `
            <div style="border-bottom: 1px dotted #cbd5e1; padding: 4px 0; margin-bottom: 4px; break-inside: avoid;">
                <div style="font-weight:900; font-size:11px; color:#0f172a; margin-bottom: 2px;">${item.label}</div>
                ${subBar}
            </div>`; 
        });
    } else { 
        bomHtml += `<div class="line-item"><span style="color:#94a3b8; font-style:italic;">No distinct materials logged.</span></div>`; 
    }

    const labItems = lastSimResult.cost.breakdown.filter(item => (item.cB && item.cB.includes('_lab')) || item.meta?.time > 0);
    let labHtml = '';
    if (labItems.length > 0) {
        const labDepts = { 
            'metal_lab': { title: 'Metal Fabrication', items: [], totalTime: 0 }, 
            'graph_lab': { title: 'Graphics & Print', items: [], totalTime: 0 }, 
            'paint_lab': { title: 'Paint & Finishes', items: [], totalTime: 0 } 
        };
        labItems.forEach(item => {
            let track = item.cB;
            if (!labDepts[track]) track = 'metal_lab'; 
            if (labDepts[track]) {
                labDepts[track].items.push(item);
                labDepts[track].totalTime += (item.meta?.time || 0);
            }
        });
        for (const [key, group] of Object.entries(labDepts)) {
            if (group.items.length === 0) continue;
            labHtml += `
            <div style="margin-bottom: 10px; break-inside: avoid;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-weight:900; font-size:11px; background:#e0f2fe; color:#0369a1; border: 1px solid #bae6fd; padding: 4px 6px; border-radius: 3px; margin-bottom: 3px;">
                    <span style="text-transform: uppercase;">${group.title}</span>
                    <span>${(group.totalTime).toFixed(1)} MINS</span>
                </div>
            `;
            group.items.forEach(item => {
                let t = item.meta?.time ? (item.meta.time).toFixed(1) + 'm' : 'N/A';
                labHtml += `
                <div style="display:flex; justify-content:space-between; font-size:10px; color:#334155; padding: 2px 6px; border-bottom: 1px dotted #cbd5e1;">
                    <span>↳ ${item.label}</span>
                    <span style="font-weight:bold;">${t}</span>
                </div>`;
            });
            labHtml += `</div>`;
        }
    } else { 
        labHtml += `<div class="line-item"><span style="color:#94a3b8; font-style:italic;">No scheduled times logged.</span></div>`; 
    }

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Production Ledger</title>
        <style>
            @page { size: letter; margin: 0.5in; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: Arial, sans-serif; font-size: 11px; color: #000; line-height: 1.4; margin: 0; padding: 0;}
            h1 { font-size: 18px; border-bottom: 2px solid #000; margin: 0 0 10px 0; padding-bottom: 5px; text-transform: uppercase; text-align: center; font-weight: 900;}
            h2 { font-size: 13px; border-bottom: 1px solid #000; margin: 15px 0 5px 0; text-transform: uppercase; background: #e2e8f0; padding: 4px; font-weight: bold;}
            h3 { font-size: 11px; margin: 10px 0 5px 0; color: #334155; text-transform: uppercase; border-bottom: 1px dotted #ccc; font-weight: bold;}
            .drawings { display: flex; justify-content: space-around; align-items: flex-end; margin-bottom: 15px; height: 180px; padding: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px;}
            .drawing-box { display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
            .drawing-title { font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; color: #475569;}
            .drawings svg { max-height: 130px; width: auto; max-width: 100%; }
            .job-desc { font-family: monospace; font-size: 11px; white-space: pre-wrap; border: 1px solid #cbd5e1; padding: 10px; background: #f8fafc; border-radius: 4px;}
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .line-item { display: flex; justify-content: space-between; border-bottom: 1px dotted #e2e8f0; padding: 3px 0; }
            .math-note { font-family: monospace; font-size: 9px; color: #64748b; margin-left: 10px; margin-bottom: 4px;}
            .total-row { display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; border-top: 2px solid #000; padding-top: 5px; margin-top: 5px; }
            .profit-row { display: flex; justify-content: space-between; font-weight: 900; font-size: 15px; background: #dbeafe; border: 1px solid #bfdbfe; padding: 8px; margin-top: 15px; color: #1e3a8a; border-radius: 4px;}
            .avoid-break { page-break-inside: avoid; break-inside: avoid; margin-bottom: 10px; }
            .page-break { page-break-before: always; }
            .target-box { background: #f8fafc; border: 1px solid #94a3b8; padding: 15px; border-radius: 4px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="page-1">
            <h1>SIGNOS PRODUCTION LEDGER - POST & PANEL</h1>
            
            <div class="drawings avoid-break">
                <div class="drawing-box"><div class="drawing-title">Front Elevation</div>${svgFrontSolid}</div>
                <div class="drawing-box"><div class="drawing-title">X-Ray Frame</div>${svgFrontXray}</div>
                <div class="drawing-box"><div class="drawing-title">Side View</div>${svgSide}</div>
            </div>

            <div class="avoid-break">
                <h2>Job Description</h2>
                <div class="job-desc">${jobDesc}</div>
            </div>

            <div class="grid-2 avoid-break" style="margin-top:15px;">
                <div>
                    <h2>Bill of Materials (Pull & Cut)</h2>
                    ${bomHtml}
                </div>
                <div>
                    <h2>Production Schedule (Tasks)</h2>
                    ${labHtml}
                </div>
            </div>

            <div class="target-box avoid-break">
                <h3 style="margin-top:0; border:none; font-size:14px; text-align:center;">PRODUCTION GOALS & TARGETS</h3>
                <div class="grid-2">
                    <div class="line-item"><span style="font-size:13px;">Total Paid Labor Target:</span><span style="font-weight:900; font-size:14px; color:#0369a1;">${((totalTimeTarget)/60).toFixed(2)} hrs</span></div>
                    <div class="line-item"><span style="font-size:13px;">Total Allowed Material Waste:</span><span style="font-weight:900; font-size:14px; color:#b91c1c;">${fmt(totalWasteTarget)}</span></div>
                </div>
            </div>
        </div>

        <div class="page-break"></div>

        <div class="page-2">
            <h2 class="avoid-break" style="margin-top: 10px;">FINANCIAL LEDGER (MANAGEMENT ONLY)</h2>
            <div class="math-note" style="margin-bottom:10px; color:#b91c1c;"><strong>NOTE: Hard Costs below reflect the total quantity (${qty} Units).</strong></div>`;
            
            const deptNames = { 
                'metal_mat': 'Metal Fabrication (Materials)', 
                'metal_lab': 'Metal Fabrication (Labor)', 
                'paint_mat': 'Paint & Finishes (Materials)', 
                'paint_lab': 'Paint & Finishes (Labor)', 
                'graph_mat': 'Graphics & Print (Materials)', 
                'graph_lab': 'Graphics & Print (Labor)', 
                'General': 'Miscellaneous' 
            };
            
            for(const [track, items] of Object.entries(grouped)) {
                html += `<div class="avoid-break"><h3>${deptNames[track] || track}</h3>`;
                let trackWaste = 0;
                let trackTime = 0;
                
                items.forEach(i => {
                    html += `<div class="line-item"><strong>${i.label}</strong><span>${fmt(i.total)}</span></div>`;
                    let metaTags = [];
                    if (i.meta?.waste > 0) {
                        metaTags.push(`<span style="color:#b91c1c; font-weight:bold;">Waste Allowance: ${fmt(i.meta.waste)}</span>`);
                        trackWaste += i.meta.waste;
                    }
                    if (i.meta?.time > 0) {
                        metaTags.push(`<span style="color:#0369a1; font-weight:bold;">Time Target: ${i.meta.time.toFixed(1)} mins</span>`);
                        trackTime += i.meta.time;
                    }
                    let metaStr = metaTags.length > 0 ? ` &nbsp;|&nbsp; ${metaTags.join(' &nbsp;|&nbsp; ')}` : '';
                    html += `<div class="math-note">[Math: ${cleanHTML(i.formula)}]${metaStr}</div>`;
                });
                
                let groupTotal = items.reduce((sum, item) => sum + item.total, 0);
                
                html += `
                <div class="line-item" style="border-top: 1px solid #cbd5e1; margin-top: 5px; padding-top: 5px; font-weight:bold; justify-content: flex-end; gap: 20px;">
                    ${trackTime > 0 ? `<span style="color:#0369a1;">Total Time: ${trackTime.toFixed(1)} mins</span>` : ''}
                    ${trackWaste > 0 ? `<span style="color:#b91c1c;">Total Waste: ${fmt(trackWaste)}</span>` : ''}
                    <span style="color:#334155; font-style:italic;">${deptNames[track] || track} Subtotal: ${fmt(groupTotal)}</span>
                </div></div>`;
            }
            
            html += `<div class="total-row avoid-break"><span>Total Hard Cost (${qty} Units):</span><span>${fmt(lastSimResult.cost.total)}</span></div>`;

            html += `<div class="avoid-break"><h2>Retail Breakdown</h2>`;
            lastSimResult.retail.lineItems.forEach(i => {
                if(i.unit > 0) html += `<div class="line-item"><span>${i.label}</span><span>${fmt(i.unit)}</span></div>`;
            });
            html += `<div class="line-item math-note">[Math: Hard Cost x 1.05 Risk / (1 - ${(lastSimResult.metrics.margin).toFixed(2)} Margin)]</div>`;
            html += `<div class="total-row"><span>Gross Retail Total (${qty} Units):</span><span>${fmt(lastSimResult.retail.grandTotal)}</span></div>`;

            const profitDollars = lastSimResult.retail.grandTotal - lastSimResult.cost.total;
            const marginPct = (profitDollars / lastSimResult.retail.grandTotal) * 100;

            html += `
            <div class="profit-row">
                <span>Estimated Net Profit: ${fmt(profitDollars)}</span>
                <span>Profit Margin: ${marginPct.toFixed(1)}%</span>
            </div>
            
            </div>
        </div>
    </body>
    </html>`;

    const printWin = window.open('', '_blank');
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 250);
}

function exportSandbox() {
    if(!lastSimResult) return;
    const fmt = (n) => "$" + (n||0).toFixed(2);
    const cleanHTML = (str) => str.replace(/<[^>]*>?/gm, '');
    let txt = `SIGNOS DEV - FULL LEDGER EXHAUST\nTimestamp: ${new Date().toISOString()}\n----------------------------------------\n`;
    txt += `QTY: ${document.getElementById('qty').value}\n\n`;
    txt += `--- APPLIED VARIABLES ---\n`;
    window.POSTPANEL_CONFIG.retails.forEach(i => txt += `${i.key}: ${customSimData[i.key]}\n`);
    window.POSTPANEL_CONFIG.costs.forEach(i => txt += `${i.key}: ${customSimData[i.key]}\n`);
    txt += `\n--- MARKET LEDGER (RETAIL) ---\n`;
    lastSimResult.retail.breakdown.forEach(i => txt += `${i.label.padEnd(35)} ${fmt(i.total)}\n  [Math: ${cleanHTML(i.formula)}]\n`);
    txt += `----------------------------------------\nGROSS RETAIL: ${fmt(lastSimResult.retail.grandTotal)}\n`;
    txt += `\n--- PHYSICS LEDGER (COST) ---\n`;
    lastSimResult.cost.breakdown.forEach(i => txt += `${i.label.padEnd(35)} ${fmt(i.total)}\n  [Math: ${cleanHTML(i.formula)}]\n`);
    txt += `----------------------------------------\nTOTAL HARD COST: ${fmt(lastSimResult.cost.total)}\n`;
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `SignOS_Ledger_${Date.now()}.txt`;
    a.click();
}
