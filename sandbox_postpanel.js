/**
* SignOS Sandbox & Print Engine (Post & Panel)
* Features: Interactive Bidirectional Margin Calculator and #N/A Sanitization
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
    // Zero-Tolerance Strict Mode: Scrub Google Sheet errors so they don't crash the UI, 
    // but do NOT inject hardcoded guesses. Force the UI to rely strictly on the Google Sheet.
    for (let key in data) {
        if (data[key] === '#N/A' || data[key] === '#REF!') data[key] = '';
    }
};
for (let key in defaults) {
// Sanitize out Google Sheet '#N/A' strings and empty blanks
if (data[key] === undefined || data[key] === '' || data[key] == 0 || data[key] === '#N/A') {
data[key] = defaults[key];
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
// --- INTERACTIVE MARGIN CALCULATOR ---
const theCost = res.cost.total;
const theSales = res.retail.grandTotal;
const theProfit = theSales - theCost;
const theMarginPct = (theProfit / theSales) * 100;
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
// Attach Listeners for Bidirectional Math!
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
'struct_mat': { title: 'Structure Materials', items: [] },
'struct_lab': { title: 'Structure Labor', items: [] },
'paint': { title: 'Paint & Finishes', items: [] },
'graphics': { title: 'Graphics & Print', items: [] },
'concrete': { title: 'Concrete Footers', items: [] }
};
res.cost.breakdown.forEach(i => {
if (costGroups[i.cB]) costGroups[i.cB].items.push(i);
else costGroups['struct_mat'].items.push(i);
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
<div class="flex justify-between items-start text-[9px] text-gray-500 font-mono italic mt-0.5">
<span class="truncate pr-2">↳ Math: <span class="text-indigo-600">${i.formula || ''}</span></span>
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
const th = geom.above + geom.under;
const ow = geom.overallW;
const maxH = 150;
const maxW = 200;
const scale = Math.min(maxW / ow, maxH / th);
const sTh = th * scale, sOw = ow * scale, sPw = geom.w * scale, sPh = geom.h * scale;
const sClr = geom.clearance * scale, sPostD = geom.post * scale, sUnder = geom.under * scale;
const sInset = geom.inset * scale, sHoleD = geom.holeD * scale;
const pnl_y = sTh - sUnder - sClr - sPh;
const panelX = geom.mount === 'Between' ? sPostD : 0;
let p1X = 0, p2X = sOw - sPostD;
if (geom.mount === 'Flush') { p1X = sInset; p2X = sOw - sInset - sPostD; }
let bgLayer = `<rect x="0" y="${sTh - sUnder}" width="${sOw}" height="${sUnder}" fill="#22c55e" opacity="0.2"/>`;
if (geom.hasConcrete) {
const footerH = sUnder * 0.66;
const footerY = sTh - footerH;
bgLayer += `<rect x="${p1X - (sHoleD/2 - sPostD/2)}" y="${footerY}" width="${sHoleD}" height="${footerH}" fill="#94a3b8" opacity="0.6" rx="2"/>`;
bgLayer += `<rect x="${p2X - (sHoleD/2 - sPostD/2)}" y="${footerY}" width="${sHoleD}" height="${footerH}" fill="#94a3b8" opacity="0.6" rx="2"/>`;
}
bgLayer += `<rect x="${p1X}" y="0" width="${sPostD}" height="${sTh}" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>`;
bgLayer += `<rect x="${p2X}" y="0" width="${sPostD}" height="${sTh}" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>`;
// 1. SOLID FRONT SVG
let svgFrontSolid = `<svg width="${sOw}" height="${sTh}" viewBox="0 0 ${sOw} ${sTh}" style="overflow: visible;">` + bgLayer;
if (geom.mount === 'Between') svgFrontSolid += `<rect x="${panelX}" y="${pnl_y}" width="${sPw}" height="${sPh}" fill="#3b82f6" stroke="#1e3a8a" stroke-width="1.5" opacity="0.9"/>`;
else svgFrontSolid += `<rect x="${panelX}" y="${pnl_y}" width="${sPw}" height="${sPh}" fill="#3b82f6" stroke="#1e3a8a" stroke-width="1.5" opacity="0.95"/>`;
svgFrontSolid += `</svg>`;
// 2. X-RAY FRAME SVG
let svgFrontXray = `<svg width="${sOw}" height="${sTh}" viewBox="0 0 ${sOw} ${sTh}" style="overflow: visible;">` + bgLayer;
const frameThicknessScale = (geom.frameThick || 2) * scale;
const halfThick = frameThicknessScale / 2;
svgFrontXray += `<rect x="${panelX}" y="${pnl_y}" width="${sPw}" height="${sPh}" fill="#3b82f6" opacity="0.1"/>`;
svgFrontXray += `<rect x="${panelX + halfThick}" y="${pnl_y + halfThick}" width="${sPw - frameThicknessScale}" height="${sPh - frameThicknessScale}" fill="none" stroke="#94a3b8" stroke-width="${frameThicknessScale}"/>`;
if (geom.braces > 0) {
const spaces = geom.braces + 1;
const spacing = sPw / spaces;
for (let i = 1; i <= geom.braces; i++) {
const braceX = panelX + (spacing * i) - halfThick;
svgFrontXray += `<rect x="${braceX}" y="${pnl_y + frameThicknessScale}" width="${frameThicknessScale}" height="${sPh - (frameThicknessScale*2)}" fill="#94a3b8"/>`;
}
}
svgFrontXray += `</svg>`;
// 3. SIDE VIEW SVG
const sideW = Math.max(geom.post + 4, 20);
const visFaceThick = 2;
const sSideW = sideW * scale;
const px = (sSideW - sPostD) / 2;
let svgSide = `<svg width="${sSideW}" height="${sTh}" viewBox="0 0 ${sSideW} ${sTh}" style="overflow: visible;">`;
svgSide += `<rect x="0" y="${sTh - sUnder}" width="${sSideW}" height="${sUnder}" fill="#22c55e" opacity="0.2"/>`;
if (geom.hasConcrete) {
const footerH = sUnder * 0.66;
const footerY = sTh - footerH;
svgSide += `<rect x="${px - (sHoleD/2 - sPostD/2)}" y="${footerY}" width="${sHoleD}" height="${footerH}" fill="#94a3b8" opacity="0.6" rx="2"/>`;
}
svgSide += `<rect x="${px}" y="0" width="${sPostD}" height="${sTh}" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>`;
if (geom.mount === 'Between') {
svgSide += `<rect x="${px + (sPostD/2) - (visFaceThick/2)}" y="${pnl_y}" width="${visFaceThick}" height="${sPh}" fill="#1e40af"/>`;
} else {
svgSide += `<rect x="${px - visFaceThick}" y="${pnl_y}" width="${visFaceThick}" height="${sPh}" fill="#3b82f6"/>`;
if(geom.sides === 2) svgSide += `<rect x="${px + sPostD}" y="${pnl_y}" width="${visFaceThick}" height="${sPh}" fill="#3b82f6"/>`;
}
svgSide += `</svg>`;
const jobDesc = document.getElementById('job-desc').value;
// Metadata Accumulators
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
const bomItems = lastSimResult.cost.breakdown.filter(item => item.cB === 'struct_mat' || item.cB === 'paint' || item.cB === 'concrete' || item.rB === 'faces');
const labItems = lastSimResult.cost.breakdown.filter(item => item.cB === 'struct_lab' || item.cB === 'graphics' || item.meta?.time > 0);
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
<h2>Bill of Materials (Physical)</h2>`;
if (bomItems.length > 0) bomItems.forEach(item => { html += `<div class="line-item"><span>${item.label}</span><span>${fmt(item.total)}</span></div>`; });
else html += `<div class="line-item"><span style="color:#94a3b8; font-style:italic;">No distinct materials logged.</span></div>`;
html += `
</div>
<div>
<h2>Production Schedule (Tasks)</h2>`;
if (labItems.length > 0) {
labItems.forEach(item => {
if(item.meta?.time) html += `<div class="line-item"><span>${item.label}</span><span>${item.meta.time.toFixed(1)} mins</span></div>`;
});
} else { html += `<div class="line-item"><span style="color:#94a3b8; font-style:italic;">No scheduled times logged.</span></div>`; }
html += `
</div>
</div>
<div class="target-box avoid-break">
<h3 style="margin-top:0; border:none; font-size:14px; text-align:center;">PRODUCTION GOALS & TARGETS</h3>
<div class="grid-2">
<div class="line-item"><span style="font-size:13px;">Total Paid Labor Target:</span><span style="font-weight:900; font-size:14px; color:#0369a1;">${(totalTimeTarget/60).toFixed(2)} hrs</span></div>
<div class="line-item"><span style="font-size:13px;">Total Allowed Material Waste:</span><span style="font-weight:900; font-size:14px; color:#b91c1c;">${fmt(totalWasteTarget)}</span></div>
</div>
</div>
</div>
<div class="page-break"></div>
<div class="page-2">
<h2 class="avoid-break" style="margin-top: 10px;">Physics Engine (Hard Cost Breakdown)</h2>`;
const deptNames = { 'struct_mat': 'Structure Materials', 'struct_lab': 'Structure Labor', 'paint': 'Paint & Finishes', 'graphics': 'Graphics & Print', 'concrete': 'Concrete Footers', 'General': 'Miscellaneous' };
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
// INJECT EXPLICIT SUBTOTALS!
html += `
<div class="line-item" style="border-top: 1px solid #cbd5e1; margin-top: 5px; padding-top: 5px; font-weight:bold; justify-content: flex-end; gap: 20px;">
${trackTime > 0 ? `<span style="color:#0369a1;">Total Time: ${trackTime.toFixed(1)} mins</span>` : ''}
${trackWaste > 0 ? `<span style="color:#b91c1c;">Total Waste: ${fmt(trackWaste)}</span>` : ''}
<span style="color:#334155; font-style:italic;">${deptNames[track] || track} Subtotal: ${fmt(groupTotal)}</span>
</div></div>`;
}
html += `<div class="total-row avoid-break"><span>Total Hard Cost:</span><span>${fmt(lastSimResult.cost.total)}</span></div>`;
html += `<div class="avoid-break"><h2>Retail Breakdown</h2>`;
lastSimResult.retail.lineItems.forEach(i => {
if(i.unit > 0) html += `<div class="line-item"><span>${i.label}</span><span>${fmt(i.unit)}</span></div>`;
});
html += `<div class="line-item math-note">[Math: Hard Cost x 1.05 Risk / (1 - ${(lastSimResult.metrics.margin).toFixed(2)} Margin)]</div>`;
html += `<div class="total-row"><span>Gross Retail Total:</span><span>${fmt(lastSimResult.retail.grandTotal)}</span></div>`;
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