/**
 * PURE PHYSICS ENGINE: ADA Signs (v2.0)
 * Full terminology rewrite, Setup removal, and Granular Labor splitting.
 */
function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    // --- 1. RETAIL ENGINE ---
    let baseRateSqIn = inputs.coreThick === '1/8' ? parseFloat(data.Retail_Price_Ultra_18 || 0.85) : parseFloat(data.Retail_Price_Mattes_116 || 0.55);

    if (inputs.hasTactile) baseRateSqIn += parseFloat(data.Retail_Adder_Tactile || 0.15);
    
    if (inputs.backer === 'Black PVC' || inputs.backer === 'White PVC') baseRateSqIn += parseFloat(data.Retail_Adder_PVC_Backer || 0.10);
    else if (inputs.backer === 'Clear Acrylic') baseRateSqIn += parseFloat(data.Retail_Adder_Acr_Backer || 0.20);

    const retailPrint = baseRateSqIn * totalSqin;
    const brailleFee = inputs.hasBraille ? (parseFloat(data.Retail_Adder_Braille_Line || 3) * inputs.brailleLines * inputs.qty) : 0;
    
    const grandTotalRaw = retailPrint + brailleFee;
    const minOrder = parseFloat(data.Retail_Min_Order || 35);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE ---
    const sheetSqIn = 24 * 48; 
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    // Materials
    const costBackground = inputs.coreThick === '1/8' ? parseFloat(data.Cost_Stock_18_ADA || 117)/sheetSqIn : parseFloat(data.Cost_Stock_116_ADA || 75)/sheetSqIn;
    const costApplique = inputs.hasTactile ? parseFloat(data.Cost_Stock_132_Applique || 65)/sheetSqIn : 0;
    const costTape = parseFloat(data.Cost_ADA_Tape || 0.30) / 144;
    const costBead = parseFloat(data.Cost_Raster_Bead || 0.05);
    
    const rawBackground = (totalSqin * costBackground) * wastePct;
    const rawApplique = (totalSqin * costApplique) * wastePct;
    const rawTape = (totalSqin * costTape) * wastePct;
    const rawBeads = inputs.hasBraille ? (inputs.qty * inputs.brailleLines * 10 * costBead) * wastePct : 0;

    let rawBacker = 0;
    if(inputs.backer === 'Black PVC' || inputs.backer === 'White PVC') rawBacker = (totalSqin / 144) * 0.75; // Approx 3mm PVC
    else if(inputs.backer === 'Clear Acrylic') rawBacker = (totalSqin / 144) * 2.00; // Approx 3/16 Acr

    // Labor Mapping (Explicit Separation)
    const opRate = parseFloat(data.Rate_Operator || 25);
    const machRate = parseFloat(data.Rate_Machine_Engraver || 15);
    
    const costFilePrepress = (parseFloat(data.Time_Preflight_Job || 10) / 60) * opRate;
    const costMachineSetup = (parseFloat(data.Time_Engraver_Load_Per_Item || 2) * inputs.qty / 60) * opRate;
    
    const runMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.5);
    const costMachineRun = (runMins / 60) * machRate;
    const costOpAttn = (runMins / 60) * opRate * parseFloat(data.Labor_Attendance_Ratio || 0.20);
    const costWeedPrep = inputs.hasTactile ? ((totalSqin * 0.1) / 60) * opRate : 0;

    const subHardCost = rawBackground + rawApplique + rawTape + rawBeads + rawBacker + costFilePrepress + costMachineSetup + costMachineRun + costOpAttn + costWeedPrep;
    const totalCost = subHardCost * riskFactor;

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, brailleFee: brailleFee, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: { 
            rawBackground, rawApplique, rawTape, rawBeads, rawBacker, 
            costFilePrepress, costMachineSetup, costMachineRun, costOpAttn, costWeedPrep,
            wasteCost: subHardCost - (subHardCost/wastePct), riskCost: totalCost - subHardCost 
        }},
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.ADA_CONFIG = {
    tab: 'PROD_Nameplates', engine: calculateADA,
    controls: [
        { id: 'coreThick', label: 'Background Material', type: 'select', opts: [{v:'1/16', t:'1/16" ADA Core'}, {v:'1/8', t:'1/8" ADA Core'}] },
        { id: 'backer', label: 'Rigid Backer', type: 'select', opts: [{v:'None', t:'None'}, {v:'Black PVC', t:'3mm Blk PVC'}, {v:'White PVC', t:'3mm Wht PVC'}, {v:'Clear Acrylic', t:'3/16" Clr Acr'}] },
        { id: 'hasTactile', label: 'Tactile Applique', type: 'toggle', def: true },
        { id: 'hasBraille', label: 'Raster Braille', type: 'toggle', def: true },
        { id: 'brailleLines', label: 'Braille Lines', type: 'number', def: 1 }
    ],
    retails: [ { key: 'Retail_Price_Mattes_116', label: '1/16" Base' }, { key: 'Retail_Adder_Tactile', label: 'Tactile Adder' } ],
    costs: [ { key: 'Cost_Stock_116_ADA', label: '1/16" Core ($/Sht)' }, { key: 'Cost_Stock_132_Applique', label: '1/32" Applique' }, { key: 'Time_Engrave_SqIn', label: 'Engrave (Min/SqIn)' } ],
    renderReceipt: function(data, fmt) {
        const b = data.cost.breakdown;
        return `<div><h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine</h4>
        <div class="space-y-1 text-xs text-gray-700">
        <div class="flex justify-between"><span>Sign Area Base:</span> <span>${fmt(data.retail.printTotal)}</span></div>
        <div class="flex justify-between text-blue-600"><span>Braille Lines:</span> <span>${fmt(data.retail.brailleFee)}</span></div>
        <div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Retail:</span> <span>${fmt(data.retail.grandTotal)}</span></div>
        </div></div>
        <div class="mt-4"><h4 class="text-[10px] font-bold text-red-800 uppercase mb-2 border-b border-red-200 pb-1">Physics Engine (BOM)</h4>
        <div class="space-y-1 text-[10px] font-bold text-gray-600">
        <div class="flex justify-between"><span>Background Material:</span> <span>${fmt(b.rawBackground)}</span></div>
        <div class="flex justify-between"><span>Tactile Applique:</span> <span>${fmt(b.rawApplique)}</span></div>
        <div class="flex justify-between"><span>Raster Beads / 3M Tape:</span> <span>${fmt(b.rawBeads + b.rawTape)}</span></div>
        <div class="border-t border-gray-100 my-1"></div>
        <div class="flex justify-between text-orange-700"><span>File Prepress:</span> <span>${fmt(b.costFilePrepress)}</span></div>
        <div class="flex justify-between text-orange-700"><span>Engraver Setup:</span> <span>${fmt(b.costMachineSetup)}</span></div>
        <div class="flex justify-between text-orange-700"><span>Machine Run:</span> <span>${fmt(b.costMachineRun)}</span></div>
        <div class="flex justify-between text-orange-700"><span>Operator Attn & Weeding:</span> <span>${fmt(b.costOpAttn + b.costWeedPrep)}</span></div>
        <div class="flex justify-between font-black text-red-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div>
        </div></div>`;
    }
};
