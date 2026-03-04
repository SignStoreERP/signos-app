/**
 * PURE PHYSICS ENGINE: ADA Signs (v1.0)
 * Deep Bill of Materials mapping for Substrate, Applique, Raster Beads, and CNC Routing.
 */
function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    // --- 1. RETAIL ENGINE (Inherited from logic_ada.js) ---
    let baseRateSqIn = parseFloat(data.Retail_Price_Base_Front || data.Retail_Price_Mattes_116 || 0.55);
    if (inputs.coreThick === '1/8') baseRateSqIn = parseFloat(data.Retail_Price_Base_Reverse || data.Retail_Price_Ultra_18 || 0.85);

    let retailUnit = sqin * baseRateSqIn;
    if (inputs.hasTactile) retailUnit += (sqin * parseFloat(data.Retail_Adder_Tactile || 0.40));
    
    if (inputs.backer === 'Black PVC' || inputs.backer === 'White PVC') retailUnit += (sqin * parseFloat(data.Retail_Adder_PVC_Backer || 0.15));
    else if (inputs.backer === 'Clear Acrylic') retailUnit += (sqin * parseFloat(data.Retail_Adder_Acr_Backer || 0.25));

    if (inputs.hasBraille && inputs.brailleLines > 0) retailUnit += (inputs.brailleLines * parseFloat(data.Retail_Adder_Braille_Line || 10.00));

    let subTotal = retailUnit * inputs.qty;
    const setupFee = parseFloat(data.Retail_Fee_Setup || 15);
    subTotal += setupFee;

    let minOrder = parseFloat(data.Retail_Min_Order || 50);
    if (inputs.backer !== 'None' && data.Retail_Min_Order_CNC) minOrder = parseFloat(data.Retail_Min_Order_CNC);
    else if (data.Retail_Min_Order_Etch) minOrder = parseFloat(data.Retail_Min_Order_Etch);

    let grandTotal = Math.max(subTotal, minOrder);

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const sheetSqIn = 1200; // 24x48 standard sheet
    const wastePct = parseFloat(data.Waste_Factor || 1.25);
    const riskFactor = parseFloat(data.Factor_Risk || 1.10);
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.15);

    // Substrate & Applique Costs
    let coreSheetCost = inputs.coreThick === '1/8' ? parseFloat(data.Cost_Stock_18_ADA || 117.00) : parseFloat(data.Cost_Stock_116_ADA || 75.00);
    let rawCore = ((coreSheetCost / sheetSqIn) * totalSqin) * wastePct;
    
    let rawApplique = 0;
    let rawBeads = 0;
    if (inputs.hasTactile) {
        let appSheetCost = parseFloat(data.Cost_Stock_132_Applique || 65.00);
        rawApplique = ((appSheetCost / sheetSqIn) * totalSqin) * wastePct;
    }
    if (inputs.hasBraille) {
        rawBeads = inputs.qty * (inputs.brailleLines * 12) * parseFloat(data.Cost_Raster_Bead || 0.05); // Estimate 12 beads per line
    }

    let rawBacker = 0;
    if (inputs.backer !== 'None') {
        let backerSqFtCost = inputs.backer.includes('PVC') ? 1.50 : 2.50; // Default approximations
        rawBacker = ((totalSqin / 144) * backerSqFtCost) * wastePct;
    }

    let rawTape = ((totalSqin / 144) * parseFloat(data.Cost_ADA_Tape || 0.30)) * wastePct;
    const totalMaterials = rawCore + rawApplique + rawBeads + rawBacker + rawTape;

    // Labor & Machine Run
    const opRate = parseFloat(data.Rate_Operator || 25);
    const cncRate = parseFloat(data.Rate_CNC_Labor || 25);
    const machineRate = parseFloat(data.Rate_Machine_Engraver || parseFloat(data.Rate_Machine_Flatbed || 10));

    const prepressMins = parseFloat(data.Time_Preflight_Job || 15);
    const loadMins = parseFloat(data.Time_Engraver_Load_Per_Item || 2) * inputs.qty;
    
    // Engraving / Cutting Time (Estimated 0.5 mins per sq inch of detail)
    const engraveMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.5);

    const costPrepress = (prepressMins / 60) * opRate;
    const costHandling = (loadMins / 60) * opRate;
    const costMachRun = (engraveMins / 60) * machineRate;
    const costOpAttn = (engraveMins / 60) * (opRate * attnRatio);

    const totalHardCost = (totalMaterials + costPrepress + costHandling + costMachRun + costOpAttn) * riskFactor;

    return {
        retail: { unitPrice: retailUnit, grandTotal: grandTotal, isMinApplied: subTotal < minOrder, printTotal: retailUnit * inputs.qty, setupFee: setupFee },
        cost: {
            total: totalHardCost,
            breakdown: {
                materials: totalMaterials, rawCore: rawCore, rawApplique: rawApplique, rawBeads: rawBeads, rawBacker: rawBacker, rawTape: rawTape,
                costPrepress: costPrepress, costHandling: costHandling, costMachRun: costMachRun, costOpAttn: costOpAttn,
                wasteCost: totalMaterials - (totalMaterials / wastePct), wastePct: (wastePct - 1) * 100,
                riskCost: totalHardCost - (totalHardCost / riskFactor), riskPct: (riskFactor - 1) * 100,
                runHrs: (engraveMins / 60)
            }
        },
        metrics: { margin: (grandTotal - totalHardCost) / grandTotal }
    };
}

// ==========================================
// SIMULATOR CONFIGURATION SCHEMA
// ==========================================
window.ADA_CONFIG = {
    tab: 'PROD_Nameplates', // Mapping to Nameplates database temporarily
    engine: calculateADA,
    controls: [
        { id: 'w', label: 'Width (in)', type: 'number', def: 8 },
        { id: 'h', label: 'Height (in)', type: 'number', def: 8 },
        { id: 'coreThick', label: 'Core Thick', type: 'select', opts: [{v:'1/16', t:'1/16"'}, {v:'1/8', t:'1/8"'}] },
        { id: 'backer', label: 'Backer', type: 'select', opts: [{v:'None', t:'None'}, {v:'Black PVC', t:'3mm Black PVC'}, {v:'Clear Acrylic', t:'3/16" Clear Acrylic'}] },
        { id: 'hasTactile', label: 'Tactile Text/Picto', type: 'toggle', def: true },
        { id: 'hasBraille', label: 'Include Braille', type: 'toggle', def: true },
        { id: 'brailleLines', label: 'Braille Lines', type: 'number', def: 1 }
    ],
    dynamicUI: function(inputs) { return inputs; },
    retails: [
        { heading: 'Market Base ($/SqIn)', key: 'Retail_Price_Mattes_116', label: '1/16" Base Rate' },
        { key: 'Retail_Price_Ultra_18', label: '1/8" Base Rate' },
        { heading: 'Multipliers & Adders', key: 'Retail_Adder_Tactile', label: 'Tactile Applique Adder' },
        { key: 'Retail_Adder_PVC_Backer', label: 'PVC Backer Adder' },
        { key: 'Retail_Adder_Acr_Backer', label: 'Acrylic Backer Adder' },
        { key: 'Retail_Adder_Braille_Line', label: 'Per-Line Braille Fee' },
        { key: 'Retail_Fee_Setup', label: 'Setup Fee' },
        { key: 'Retail_Min_Order', label: 'Shop Minimum' }
    ],
    costs: [
        { heading: 'Materials', key: 'Cost_Stock_116_ADA', label: '1/16" ADA Core ($/Sht)' },
        { key: 'Cost_Stock_18_ADA', label: '1/8" ADA Core ($/Sht)' },
        { key: 'Cost_Stock_132_Applique', label: '1/32" Applique ($/Sht)' },
        { key: 'Cost_Raster_Bead', label: 'Raster Beads ($/Ea)' },
        { key: 'Cost_ADA_Tape', label: '3M ADA Tape ($/SqFt)' },
        { heading: 'Machine Speeds & Time', key: 'Time_Engrave_SqIn', label: 'Engrave Speed (Mins/SqIn)' },
        { key: 'Time_Preflight_Job', label: 'Preflight (Mins)' },
        { key: 'Time_Engraver_Load_Per_Item', label: 'Load Time (Mins/Ea)' },
        { heading: 'Rates & Overhead', key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Machine_Engraver', label: 'Engraver Mach ($/Hr)' },
        { key: 'Labor_Attendance_Ratio', label: 'Attn Ratio (0-1)' },
        { key: 'Waste_Factor', label: 'Waste Buffer' },
        { key: 'Factor_Risk', label: 'Risk Buffer' }
    ],
    renderReceipt: function(data, fmt) {
        let retailHTML = `<div><h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
        <div class="space-y-1 text-xs text-gray-700">
        <div class="flex justify-between"><span>Total Sign Structure:</span> <span>${fmt(data.retail.printTotal)}</span></div>
        <div class="flex justify-between"><span>Setup Fee:</span> <span>${fmt(data.retail.setupFee)}</span></div>
        <div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Retail:</span> <span>${fmt(data.retail.grandTotal)}</span></div>
        </div></div>`;

        let costHTML = `<div class="mt-6"><h4 class="text-[10px] font-bold text-red-800 uppercase mb-2 border-b border-red-200 pb-1">Physics Engine (Cost)</h4>
        <div class="space-y-1 text-xs text-gray-700">`;
        if (data.cost.breakdown) {
            const b = data.cost.breakdown;
            costHTML += `
            <div class="flex justify-between"><span>Substrates (Core & Applique):</span> <span>${fmt(b.rawCore + b.rawApplique)}</span></div>
            ${b.rawBacker > 0 ? `<div class="flex justify-between"><span>Backer Material:</span> <span>${fmt(b.rawBacker)}</span></div>` : ''}
            <div class="flex justify-between"><span>Raster Beads & Tape:</span> <span>${fmt(b.rawBeads + b.rawTape)}</span></div>
            <div class="flex justify-between mt-1"><span class="border-t border-dotted border-gray-400 pt-1">Prepress & Handling:</span> <span>${fmt(b.costPrepress + b.costHandling)}</span></div>
            <div class="flex justify-between"><span>Machine Run (${b.runHrs ? b.runHrs.toFixed(2) : 0}h):</span> <span>${fmt(b.costMachRun)}</span></div>
            <div class="flex justify-between"><span>Operator (Attn Ratio):</span> <span>${fmt(b.costOpAttn)}</span></div>
            <div class="border-t border-gray-200 mt-2 pt-1"></div>
            <div class="flex justify-between text-red-600"><span>Material Waste (${b.wastePct ? b.wastePct.toFixed(0) : 10}%):</span> <span>+ ${fmt(b.wasteCost)}</span></div>
            <div class="flex justify-between text-orange-500 opacity-80"><span>Risk Buffer (${b.riskPct ? b.riskPct.toFixed(0) : 5}%):</span> <span>(+ ${fmt(b.riskCost)})</span></div>`;
        }
        costHTML += `<div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div></div></div>`;
        return retailHTML + costHTML;
    }
};
