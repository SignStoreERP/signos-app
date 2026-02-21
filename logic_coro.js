/**
 * PURE PHYSICS ENGINE: Custom Coroplast (v2.0 - Dual Track)
 * Implements Master Area Curves, Exact DS Math, and CNC/Shear Physics.
 */

function calculateCoro(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // --- 1. RETAIL ENGINE (MARKET VALUE via AREA CURVES) ---
    let baseSqFtRate = 0;
    let minSignPrice = 0;

    if (inputs.thickness === '10mm') {
        minSignPrice = 75; // Blue Sheet Min
        if (sqft <= 3.99) baseSqFtRate = 25.00;
        else if (sqft <= 15.99) baseSqFtRate = 21.00;
        else if (sqft <= 31.99) baseSqFtRate = 18.00;
        else baseSqFtRate = 15.00;
    } else {
        minSignPrice = 25; // Blue Sheet Min
        if (sqft <= 3.99) baseSqFtRate = 8.33;
        else if (sqft <= 15.99) baseSqFtRate = 7.00;
        else if (sqft <= 31.99) baseSqFtRate = 6.00;
        else baseSqFtRate = 5.00;
    }

    // Apply Min Price Per Sign
    let signPrice = baseSqFtRate * sqft;
    if (signPrice < minSignPrice) signPrice = minSignPrice;
    
    let retailPrint = signPrice * inputs.qty;

    // Double Sided Math (+50% exactly matches Blue Sheet)
    if (inputs.sides === 2) {
        retailPrint *= 1.5;
    }

    // 1-9 vs 10+ Volume Tier Logic
    let discPct = 0;
    const t1Qty = parseFloat(data.Tier_1_Qty || 10);
    if (inputs.qty >= t1Qty) discPct = parseFloat(data.Tier_1_Disc || 0.05); 
    retailPrint = retailPrint * (1 - discPct);

    // Shape / CNC Fees
    let routerFee = 0;
    if (inputs.shape === 'CNC Simple') routerFee = parseFloat(data.Retail_Fee_Router_Easy || 30);
    if (inputs.shape === 'CNC Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard || 50);

    // Standard Fees
    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;

    const grandTotalRaw = retailPrint + routerFee + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // UI Tier Log (Required by Simulator)
    let base1 = signPrice * (inputs.sides === 2 ? 1.5 : 1);
    let base10 = base1 * (1 - parseFloat(data.Tier_1_Disc || 0.05));

    const tierLog = [
        { q: 1, base: base1, unit: (base1 * 1 + routerFee) / 1 },
        { q: t1Qty, base: base10, unit: (base10 * t1Qty + routerFee) / t1Qty }
    ];

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const costSheet = inputs.thickness === '10mm' ? parseFloat(data.Cost_Stock_10mm_4x8 || 33.49) : parseFloat(data.Cost_Stock_4mm_4x8 || 8.40);
    const costPerSqFt = costSheet / 32; 
    const wastePct = parseFloat(data.Waste_Factor || 1.10);
    const rawMat = costPerSqFt * totalSqFt;
    const wasteCost = rawMat * (wastePct - 1);

    const totalInk = totalSqFt * inputs.sides * parseFloat(data.Cost_Ink_Latex || 0.16);

    // Labor & Machines
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateCNC = parseFloat(data.Rate_CNC_Labor || 25); 
    const rateMachPrint = parseFloat(data.Rate_Machine_Flatbed || 45);
    const rateMachCNC = parseFloat(data.Rate_Machine_CNC || 35);

    let costCutSetup = 0, costCutLabor = 0, costCutMach = 0, runHrsCNC = 0;

    // Cutting Physics
    if (inputs.shape === 'Rectangle') {
        const shearSetupMins = parseFloat(data.Time_Shear_Setup || 5);
        const shearPerCut = parseFloat(data.Time_Shear_Cut || 1);
        costCutSetup = (shearSetupMins / 60) * rateOp;
        costCutLabor = ((inputs.qty * 2 * shearPerCut) / 60) * rateOp;
    } else {
        const cncSetupMins = parseFloat(data.Time_Setup_CNC || 10);
        costCutSetup = (cncSetupMins / 60) * rateCNC;
        const routeTimeSqFt = inputs.shape === 'CNC Complex' ? parseFloat(data.Time_CNC_Complex_SqFt || 2) : parseFloat(data.Time_CNC_Easy_SqFt || 1);
        runHrsCNC = (totalSqFt * routeTimeSqFt) / 60;
        costCutLabor = runHrsCNC * rateCNC;
        costCutMach = runHrsCNC * rateMachCNC;
    }

    const setupMinsPrint = parseFloat(data.Time_Setup_Job || 15) + parseFloat(data.Time_Handling || 4);
    const costSetupPrint = (setupMinsPrint / 60) * rateOp;

    const speedPrint = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const linearFeet = (inputs.h / 12) * inputs.qty;
    const printHrs = (linearFeet / speedPrint) * inputs.sides;
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costPrintMach = printHrs * rateMachPrint;

    const subTotal = rawMat + wasteCost + totalInk + costSetupPrint + costPrintOp + costPrintMach + costCutSetup + costCutLabor + costCutMach;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: (retailPrint + routerFee) / inputs.qty,
            printTotal: retailPrint,
            routerFee: routerFee,
            setupFee: feeSetup,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            tiers: tierLog
        },
        cost: {
            total: subTotal,
            breakdown: {
                rawBlanks: rawMat,
                wasteCost: wasteCost,
                wastePct: (wastePct - 1) * 100,
                totalInk: totalInk,
                costSetup: costSetupPrint + costCutSetup,
                costCut: costCutLabor + costCutMach,
                runHrs: printHrs + runHrsCNC,
                costMachine: costPrintMach + costCutMach,
                costOp: costPrintOp + costCutLabor,
                riskCost: riskBuffer,
                riskPct: (riskFactor - 1) * 100
            }
        },
        metrics: { margin: (grandTotal - subTotal) / grandTotal }
    };
}

// ==========================================
// SIMULATOR CONFIGURATION SCHEMA
// ==========================================
window.CORO_CONFIG = {
    tab: 'PROD_Coroplast_Signs',
    engine: calculateCoro,
    controls: [
      { id: 'w', label: 'Width', type: 'number', def: 24 },
      { id: 'h', label: 'Height', type: 'number', def: 18 },
      { id: 'thickness', label: 'Material', type: 'select', opts: [{v:'4mm', t:'4mm Standard'}, {v:'10mm', t:'10mm HD'}] },
      { id: 'sides', label: 'Sides', type: 'select', opts: [{v:1, t:'1-Sided'}, {v:2, t:'2-Sided'}] },
      { id: 'shape', label: 'Cutting Method', type: 'select', opts: [{v:'Rectangle', t:'Square / Shear'}, {v:'CNC Simple', t:'CNC (Simple)'}, {v:'CNC Complex', t:'CNC (Complex)'}] },
      { id: 'files', label: 'Files', type: 'number', def: 1 },
      { id: 'setupPerFile', label: 'Setup / File', type: 'toggle', def: false },
      { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    retails: [
      { heading: 'Volume Discounts', key: 'Tier_1_Qty', label: 'Tier 1 Trigger (Qty)' },
      { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' },
      { heading: 'Router Constraints', key: 'Retail_Fee_Router_Easy', label: 'CNC Easy Fee ($)' },
      { key: 'Retail_Fee_Router_Hard', label: 'CNC Hard Fee ($)' },
      { heading: 'Flat Fees', key: 'Retail_Fee_Setup', label: 'Setup Fee ($)' },
      { key: 'Retail_Fee_Design', label: 'Design Fee ($)' }
    ],
    costs: [
      { key: 'Cost_Stock_4mm_4x8', label: '4mm 4x8 Sheet ($)' },
      { key: 'Cost_Stock_10mm_4x8', label: '10mm 4x8 Sheet ($)' },
      { key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },
      { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
      { key: 'Rate_CNC_Labor', label: 'CNC Operator ($/Hr)' },
      { key: 'Rate_Machine_Flatbed', label: 'Printer Mach ($/Hr)' },
      { key: 'Rate_Machine_CNC', label: 'Router Mach ($/Hr)' },
      { key: 'Machine_Speed_LF_Hr', label: 'Print Spd (LF/hr)' },
      { key: 'Time_Shear_Setup', label: 'Shear Setup (Mins)' },
      { key: 'Time_Shear_Cut', label: 'Shear Cut (Mins/Ea)' },
      { key: 'Time_Setup_CNC', label: 'CNC Setup (Mins)' },
      { key: 'Time_CNC_Easy_SqFt', label: 'CNC Easy (Mins/SqFt)' },
      { key: 'Time_CNC_Complex_SqFt', label: 'CNC Complex (Mins/SqFt)' },
      { key: 'Waste_Factor', label: 'Waste (1.x)' },
      { key: 'Labor_Attendance_Ratio', label: 'Attn Ratio (0-1)' }
    ],
    
    renderReceipt: function(data, fmt) {
      let retailHTML = `
        <div>
          <h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
          <div class="space-y-1 text-xs text-gray-700">
            <div class="flex justify-between" title="Calculated from Master Area Curves."><span class="cursor-help border-b border-dotted border-gray-400">Base Print:</span> <span>${fmt(data.retail.printTotal)}</span></div>
            ${data.retail.routerFee > 0 ? `<div class="flex justify-between text-orange-700"><span>CNC Router Fee:</span> <span>${fmt(data.retail.routerFee)}</span></div>` : ''}
            <div class="flex justify-between"><span>Setup Fee:</span> <span>${fmt(data.retail.setupFee || 0)}</span></div>
            ${data.retail.designFee > 0 ? `<div class="flex justify-between text-purple-700"><span>Design Fee:</span> <span>${fmt(data.retail.designFee)}</span></div>` : ''}
            <div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Retail:</span> <span>${fmt(data.retail.grandTotal)}</span></div>
          </div>
        </div>
      `;
      let costHTML = `
        <div>
          <h4 class="text-[10px] font-bold text-red-800 uppercase mb-2 border-b border-red-200 pb-1">Physics Engine (Cost)</h4>
          <div class="space-y-1 text-xs text-gray-700">`;
      if (data.cost.breakdown) {
        const b = data.cost.breakdown;
        costHTML += `
            <div class="flex justify-between" title="Pure cost of Coroplast substrate."><span class="cursor-help border-b border-dotted border-gray-400">Raw Blanks:</span> <span>${fmt(b.rawBlanks)}</span></div>
            <div class="flex justify-between" title="Calculated by exact square footage and Matrix Ink Cost."><span class="cursor-help border-b border-dotted border-gray-400">Ink:</span> <span>${fmt(b.totalInk)}</span></div>
            <div class="flex justify-between" title="One-time flat fee for job setup and material handling."><span class="cursor-help border-b border-dotted border-gray-400">Setup Labor:</span> <span>${fmt(b.costSetup)}</span></div>
            ${b.costCut > 0 ? `<div class="flex justify-between" title="Labor and machine time for either Shear cuts or CNC Routing."><span class="cursor-help border-b border-dotted border-gray-400">Cutting Time:</span> <span>${fmt(b.costCut)}</span></div>` : ''}
            <div class="flex justify-between" title="Total hours the substrate sits on the printer/router bed."><span class="cursor-help border-b border-dotted border-gray-400">Machine Run (${b.runHrs ? b.runHrs.toFixed(2) : 0}h):</span> <span>${fmt(b.costMachine)}</span></div>
            <div class="flex justify-between" title="Operator labor adjusted by the Attendance Ratio."><span class="cursor-help border-b border-dotted border-gray-400">Operator (Attn Ratio):</span> <span>${fmt(b.costOp)}</span></div>
            <div class="border-t border-gray-200 mt-2 pt-1"></div>
            <h4 class="text-[9px] font-bold text-gray-500 uppercase mb-1">Additives & Risk</h4>
            <div class="flex justify-between text-red-600" title="Physical material expected to be lost to drops or cuts. This IS added to your total cost."><span class="cursor-help border-b border-dotted border-red-400">Material Waste (${b.wastePct ? b.wastePct.toFixed(0) : 10}%):</span> <span>+ ${fmt(b.wasteCost)}</span></div>
            <div class="flex justify-between text-orange-500 opacity-80" title="Suggested financial buffer for mistakes. This is an INDICATOR ONLY and is NOT added to your hard cost."><span class="cursor-help border-b border-dotted border-orange-300">Suggested Risk Buffer (${b.riskPct ? b.riskPct.toFixed(0) : 5}%):</span> <span>(+ ${fmt(b.riskCost)})</span></div>
        `;
      }
      costHTML += `<div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div></div></div>`;
      return retailHTML + costHTML;
    }
};
