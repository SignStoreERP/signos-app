/**
 * PURE PHYSICS ENGINE: Custom Coroplast (v1.0 - Dual Track)
 * Implements Master Retail Area Curves, Hardware Adders, and Flatbed Yields.
 */

function calculateCoro(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // --- 1. RETAIL ENGINE (MARKET VALUE via AREA CURVES) ---
    let baseSqFtRate = 0;
    let pfx = inputs.thickness === '10mm' ? 'COR10' : 'COR4';
    
    // Evaluate against Master Retail Area Curves
    if (sqft <= parseFloat(data[`${pfx}_T1_Max`] || 3.99)) baseSqFtRate = parseFloat(data[`${pfx}_T1_Rate`] || 8.33);
    else if (sqft <= parseFloat(data[`${pfx}_T2_Max`] || 15.99)) baseSqFtRate = parseFloat(data[`${pfx}_T2_Rate`] || 7.00);
    else if (sqft <= parseFloat(data[`${pfx}_T3_Max`] || 31.99)) baseSqFtRate = parseFloat(data[`${pfx}_T3_Rate`] || 6.00);
    else baseSqFtRate = parseFloat(data[`${pfx}_T4_Rate`] || 5.00);

    let retailPrint = baseSqFtRate * totalSqFt;

    // Double Sided Adder
    if (inputs.sides === 2) {
        const dsAdder = inputs.thickness === '10mm' ? parseFloat(data.Retail_Adder_DS_10mm || 5.00) : parseFloat(data.Retail_Adder_DS_4mm || 2.50);
        retailPrint += (dsAdder * totalSqFt);
    }

    // 1-9 vs 10+ Volume Tier Logic
    let discPct = 0;
    const t1Qty = parseFloat(data.Tier_1_Qty || 10);
    if (inputs.qty >= t1Qty) discPct = parseFloat(data.Tier_1_Disc || 0.05); 
    retailPrint = retailPrint * (1 - discPct);

    // Finishing Adders (Contour / Hardware)
    let contourFee = 0;
    if (inputs.cut === 'Contour') contourFee = retailPrint * parseFloat(data.Retail_Adder_Contour_Pct || 0.25);

    let stakeFee = 0;
    if (inputs.stakes === 'Standard') stakeFee = parseFloat(data.Retail_Stake_Std || 2.50) * inputs.qty;
    else if (inputs.stakes === 'HD') stakeFee = parseFloat(data.Retail_Stake_HD || 4.00) * inputs.qty;

    let grommetFee = 0;
    if (inputs.grommets) grommetFee = 4 * parseFloat(data.Retail_Price_Grommet || 0.25) * inputs.qty;

    // Standard Fees
    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;

    const grandTotalRaw = retailPrint + contourFee + stakeFee + grommetFee + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // UI Tier Log (Required by Simulator)
    const tierLog = [
        { q: 1, base: baseSqFtRate, unit: (retailPrint + contourFee + stakeFee + grommetFee) / inputs.qty },
        { q: t1Qty, base: baseSqFtRate * (1 - (data.Tier_1_Disc||0.05)), unit: ((retailPrint * (1 - (data.Tier_1_Disc||0.05))) + contourFee + stakeFee + grommetFee) / inputs.qty }
    ];

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const costSheet = inputs.thickness === '10mm' ? parseFloat(data.Cost_Stock_10mm_4x8 || 33.49) : parseFloat(data.Cost_Stock_4mm_4x8 || 8.40);
    const costPerSqFt = costSheet / 32; 
    const wastePct = parseFloat(data.Waste_Factor || 1.10);
    const rawMat = costPerSqFt * totalSqFt;
    const wasteCost = rawMat * (wastePct - 1);

    const totalInk = totalSqFt * inputs.sides * parseFloat(data.Cost_Ink_Latex || 0.16);

    let costStake = 0;
    if (inputs.stakes === 'Standard') costStake = parseFloat(data.Cost_Stake_Std || 0.65) * inputs.qty;
    else if (inputs.stakes === 'HD') costStake = parseFloat(data.Cost_Stake_HD || 1.85) * inputs.qty;

    let costGrommet = 0;
    if (inputs.grommets) costGrommet = 4 * parseFloat(data.Cost_Grommet || 0.13) * inputs.qty;

    // Labor & Machines
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateMach = parseFloat(data.Rate_Machine_Flatbed || 45);

    const setupMins = parseFloat(data.Time_Setup_Job || 15) + parseFloat(data.Time_Handling || 4);
    const costSetup = (setupMins / 60) * rateOp;

    const speedPrint = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const linearFeet = (inputs.h / 12) * inputs.qty;
    const printHrs = (linearFeet / speedPrint) * inputs.sides;
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costPrintMach = printHrs * rateMach;

    const subTotal = rawMat + wasteCost + totalInk + costStake + costGrommet + costSetup + costPrintOp + costPrintMach;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: (retailPrint + contourFee + stakeFee + grommetFee) / inputs.qty,
            printTotal: retailPrint,
            contourFee: contourFee,
            stakeTotal: stakeFee,
            grommetTotal: grommetFee,
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
                stakeCost: costStake,
                grommetCost: costGrommet,
                totalInk: totalInk,
                costSetup: costSetup,
                runHrs: printHrs,
                costMachine: costPrintMach,
                costOp: costPrintOp,
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
      { id: 'cut', label: 'Cut Style', type: 'select', opts: [{v:'Square', t:'Square Cut'}, {v:'Contour', t:'Contour Shape'}] },
      { id: 'stakes', label: 'Hardware', type: 'select', opts: [{v:'None', t:'No Stakes'}, {v:'Standard', t:'Standard Wire'}, {v:'HD', t:'Heavy Duty'}] },
      { id: 'grommets', label: 'Grommets (4x)', type: 'toggle', def: false },
      { id: 'files', label: 'Files', type: 'number', def: 1 },
      { id: 'setupPerFile', label: 'Setup / File', type: 'toggle', def: false },
      { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    retails: [
      { heading: '4mm Area Curves ($/SqFt)', key: 'COR4_T1_Rate', label: '4mm Tiny ($)' },
      { key: 'COR4_T2_Rate', label: '4mm Small ($)' },
      { key: 'COR4_T3_Rate', label: '4mm Med ($)' },
      { key: 'COR4_T4_Rate', label: '4mm Large ($)' },
      { heading: '10mm Area Curves ($/SqFt)', key: 'COR10_T1_Rate', label: '10mm Tiny ($)' },
      { key: 'COR10_T2_Rate', label: '10mm Small ($)' },
      { key: 'COR10_T3_Rate', label: '10mm Med ($)' },
      { key: 'COR10_T4_Rate', label: '10mm Large ($)' },
      { heading: 'Adders & Hardware', key: 'Retail_Adder_DS_4mm', label: 'DS Adder 4mm ($)' },
      { key: 'Retail_Adder_DS_10mm', label: 'DS Adder 10mm ($)' },
      { key: 'Retail_Stake_Std', label: 'Std Stake ($)' },
      { key: 'Retail_Stake_HD', label: 'HD Stake ($)' },
      { key: 'Retail_Price_Grommet', label: 'Grommet ($/ea)' }
    ],
    costs: [
      { key: 'Cost_Stock_4mm_4x8', label: '4mm 4x8 Sheet ($)' },
      { key: 'Cost_Stock_10mm_4x8', label: '10mm 4x8 Sheet ($)' },
      { key: 'Cost_Stake_Std', label: 'Std Stake ($)' },
      { key: 'Cost_Stake_HD', label: 'HD Stake ($)' },
      { key: 'Cost_Grommet', label: 'Grommet ($/ea)' },
      { key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },
      { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
      { key: 'Rate_Machine_Flatbed', label: 'R1000 ($/Hr)' },
      { key: 'Machine_Speed_LF_Hr', label: 'Print Spd (LF/hr)' },
      { key: 'Waste_Factor', label: 'Waste (1.x)' },
      { key: 'Labor_Attendance_Ratio', label: 'Attn Ratio (0-1)' }
    ],
    
    renderReceipt: function(data, fmt) {
      let retailHTML = `
        <div>
          <h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
          <div class="space-y-1 text-xs text-gray-700">
            <div class="flex justify-between" title="Calculated from Master Area Curves."><span class="cursor-help border-b border-dotted border-gray-400">Base Print:</span> <span>${fmt(data.retail.printTotal)}</span></div>
            ${data.retail.contourFee > 0 ? `<div class="flex justify-between text-orange-700"><span>Contour Cut Adder:</span> <span>${fmt(data.retail.contourFee)}</span></div>` : ''}
            ${data.retail.stakeTotal > 0 ? `<div class="flex justify-between text-blue-700"><span>Hardware (Stakes):</span> <span>${fmt(data.retail.stakeTotal)}</span></div>` : ''}
            ${data.retail.grommetTotal > 0 ? `<div class="flex justify-between text-blue-700"><span>Grommets:</span> <span>${fmt(data.retail.grommetTotal)}</span></div>` : ''}
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
            ${b.stakeCost > 0 ? `<div class="flex justify-between"><span>Stakes:</span> <span>${fmt(b.stakeCost)}</span></div>` : ''}
            ${b.grommetCost > 0 ? `<div class="flex justify-between"><span>Grommets:</span> <span>${fmt(b.grommetCost)}</span></div>` : ''}
            <div class="flex justify-between" title="Calculated by exact square footage and Matrix Ink Cost."><span class="cursor-help border-b border-dotted border-gray-400">Ink:</span> <span>${fmt(b.totalInk)}</span></div>
            <div class="flex justify-between" title="One-time flat fee for job setup and material handling."><span class="cursor-help border-b border-dotted border-gray-400">Setup Labor:</span> <span>${fmt(b.costSetup)}</span></div>
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
