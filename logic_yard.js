/**
 * PURE PHYSICS ENGINE: Yard Signs (v3.1 - Dual Track)
 * Implements 3-Tier Stake Pricing Logic
 */

function calculateYardSign(inputs, data) {
    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    const baseSS = parseFloat(data.Retail_Price_Sign_SS || 25.00);
    const adderDS = parseFloat(data.Retail_Price_Sign_DS || 2.50);

    // Dynamic Stake Pricing (3 Tiers)
    const stk1Price = parseFloat(data.Retail_Stake_T1_Price || 2.00);
    const stkT2Q = parseFloat(data.Retail_Stake_T2_Qty || 50);
    const stkT2P = parseFloat(data.Retail_Stake_T2_Price || 1.75);
    const stkT3Q = parseFloat(data.Retail_Stake_T3_Qty || 100);
    const stkT3P = parseFloat(data.Retail_Stake_T3_Price || 1.50);

    let activeStakePrice = stk1Price;
    if (inputs.qty >= stkT3Q) activeStakePrice = stkT3P;
    else if (inputs.qty >= stkT2Q) activeStakePrice = stkT2P;

    // Print Tier Logic
    let appliedBase = baseSS;
    let i = 1;
    const tierLog = [];
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tPrice = parseFloat(data[`Tier_${i}_Price`] || 0);
        if (inputs.qty >= tQty) appliedBase = tPrice;
        
        let rowStakePrice = stk1Price;
        if (tQty >= stkT3Q) rowStakePrice = stkT3P;
        else if (tQty >= stkT2Q) rowStakePrice = stkT2P;

        const rowUnit = tPrice + (inputs.sides === 2 ? adderDS : 0) + (inputs.hasStakes ? rowStakePrice : 0);
        tierLog.push({ q: tQty, base: tPrice, unit: rowUnit });
        i++;
    }

    const isCustom = (appliedBase === 0);
    const unitPrint = appliedBase + (inputs.sides === 2 ? adderDS : 0);
    const totalPrint = unitPrint * inputs.qty;
    const unitStake = inputs.hasStakes ? activeStakePrice : 0;
    const totalStake = unitStake * inputs.qty;

    // Fees
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15.00);
    const feeDesignBase = parseFloat(data.Retail_Fee_Design || 45.00);
    const totalSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;
    const totalDesign = inputs.incDesign ? (feeDesignBase * inputs.files) : 0;

    const grandTotalRaw = totalPrint + totalStake + totalSetup + totalDesign;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    const isMinApplied = grandTotalRaw < minOrder;

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const bulkTrigger = parseFloat(data.Bulk_Qty_Trigger || 1000);
    let blankCost = parseFloat(data.Cost_Blank_Standard || 0.65);
    if (inputs.qty >= bulkTrigger) blankCost = parseFloat(data.Cost_Blank_Bulk || 0.65);

    const rawBlanks = blankCost * inputs.qty;
    const wastePct = parseFloat(data.Waste_Factor || 1.10);
    const wasteCost = rawBlanks * (wastePct - 1);
    const totalMat = rawBlanks + wasteCost; 

    const areaSqFt = (24*18)/144;
    const totalArea = areaSqFt * inputs.sides * inputs.qty;
    const totalInk = totalArea * parseFloat(data.Cost_Ink_Latex || 0.16);

    const costStakeUnit = inputs.hasStakes ? parseFloat(data.Cost_Stake || 0.65) : 0;
    const totalStakeCost = costStakeUnit * inputs.qty;

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const setupMins = parseFloat(data.Time_Setup_Job || 15) + parseFloat(data.Time_Handling || 5);
    const costSetupCost = (setupMins / 60) * rateOp;

    const bedCap = parseFloat(data.Printer_Bed_Capacity || 3);
    const speed = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const lfPerSet = 2.0; 
    const totalRunHrs = ((lfPerSet / bedCap / speed) * inputs.sides) * inputs.qty;

    const costMachine = totalRunHrs * parseFloat(data.Rate_Machine_Flatbed || 45);
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costOpPrint = totalRunHrs * rateOp * attnRatio;

    const subTotal = totalMat + totalInk + totalStakeCost + costMachine + costOpPrint + costSetupCost;
    
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);
    const totalCost = subTotal; 

    return {
        retail: {
            unitPrice: (totalPrint + totalStake) / inputs.qty,
            printTotal: totalPrint,
            stakeTotal: totalStake,
            setupFee: totalSetup,
            designFee: totalDesign,
            grandTotal: grandTotal,
            isCustom: isCustom,
            isMinApplied: isMinApplied,
            tiers: tierLog
        },
        cost: {
            total: totalCost,
            breakdown: {
                rawBlanks: rawBlanks,
                wasteCost: wasteCost,           
                wastePct: (wastePct - 1) * 100, 
                stakeCost: totalStakeCost,
                totalInk: totalInk,
                costSetup: costSetupCost,
                runHrs: totalRunHrs,
                costMachine: costMachine,
                costOp: costOpPrint,
                riskCost: riskBuffer,           
                riskPct: (riskFactor - 1) * 100 
            }
        },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

// ==========================================
// SIMULATOR CONFIGURATION SCHEMA
// ==========================================
window.YARD_CONFIG = {
    tab: 'PROD_Yard_Signs',
    engine: calculateYardSign,
    controls: [
      { id: 'sides', label: 'Print Sides', type: 'select', opts: [{v:1, t:'Single Sided'}, {v:2, t:'Double Sided'}] },
      { id: 'hasStakes', label: 'Wire Stakes', type: 'toggle', def: true }, 
      { id: 'files', label: 'Files', type: 'number', def: 1 },
      { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false },
      { id: 'setupPerFile', label: 'Setup / File', type: 'toggle', def: false }
    ],
    retails: [
      { heading: 'Print Base (Coroplast)', key: 'Retail_Price_Sign_SS', label: 'Base Sign ($)' },
      { key: 'Tier_1_Qty', label: 'Tier 1 Trigger (Qty)' },
      { key: 'Tier_1_Price', label: 'Tier 1 Base ($)' },
      { heading: 'Hardware (Wire Stakes)', key: 'Retail_Stake_T1_Price', label: 'Stake 1-49 ($)' },
      { key: 'Retail_Stake_T2_Qty', label: 'Stake T2 Qty' },
      { key: 'Retail_Stake_T2_Price', label: 'Stake T2 ($)' },
      { key: 'Retail_Stake_T3_Qty', label: 'Stake T3 Qty' },
      { key: 'Retail_Stake_T3_Price', label: 'Stake T3 ($)' }
    ],
    costs: [
      { key: 'Cost_Blank_Standard', label: 'Blank Cost ($)' },
      { key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },
      { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
      { key: 'Rate_Machine_Flatbed', label: 'R1000 ($/Hr)' },
      { key: 'Machine_Speed_LF_Hr', label: 'Print Spd (LF/hr)' },
      { key: 'Printer_Bed_Capacity', label: 'Bed Qty (Nesting)' },
      { key: 'Time_Setup_Job', label: 'Setup (Mins)' },
      { key: 'Time_Handling', label: 'Handling (Mins)' },
      { key: 'Waste_Factor', label: 'Waste (1.x)' },
      { key: 'Factor_Risk', label: 'Risk (1.x)' },
      { key: 'Labor_Attendance_Ratio', label: 'Attn Ratio (0-1)' }
    ],
    
    renderReceipt: function(data, fmt) {
      let retailHTML = `
        <div>
          <h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
          <div class="space-y-1 text-xs text-gray-700">
            <div class="flex justify-between" title="Strict market value based on square footage and Blue Sheet tiers."><span class="cursor-help border-b border-dotted border-gray-400">Base Print:</span> <span>${fmt(data.retail.printTotal)}</span></div>
            ${data.retail.stakeTotal > 0 ? `<div class="flex justify-between"><span>Wire Stakes:</span> <span>${fmt(data.retail.stakeTotal)}</span></div>` : ''}
            <div class="flex justify-between"><span>Setup Fee:</span> <span>${fmt(data.retail.setupFee || 0)}</span></div>
            ${data.retail.designFee > 0 ? `<div class="flex justify-between"><span>Design Fee:</span> <span>${fmt(data.retail.designFee)}</span></div>` : ''}
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
            <div class="flex justify-between" title="Pure cost of Coroplast sheets (Quantity x Base Cost)."><span class="cursor-help border-b border-dotted border-gray-400">Raw Blanks:</span> <span>${fmt(b.rawBlanks)}</span></div>
            ${b.stakeCost > 0 ? `<div class="flex justify-between"><span>Stakes:</span> <span>${fmt(b.stakeCost)}</span></div>` : ''}
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
