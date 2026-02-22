/**
 * PURE PHYSICS ENGINE: Foam Core Boards (v1.0 - Dual Track)
 * Strict Shear Cutting, Direct Print, and multi-stage print prepress.
 */

function calculateFoam(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    let baseRate = 0;
    let minPrice = parseFloat(data.FOM3_T1_Min || 25.00); // Blue sheet specifies $25 minimum for small signs
    
    // Find matching tier based on area curves
    if (sqft <= parseFloat(data.FOM3_T1_Max || 3.99)) baseRate = parseFloat(data.FOM3_T1_Rate || 8.33);
    else if (sqft <= parseFloat(data.FOM3_T2_Max || 15.99)) baseRate = parseFloat(data.FOM3_T2_Rate || 8.00);
    else if (sqft <= parseFloat(data.FOM3_T3_Max || 31.99)) baseRate = parseFloat(data.FOM3_T3_Rate || 7.00);
    else baseRate = parseFloat(data.FOM3_T4_Rate || 6.00);

    // Apply per-unit math and unit minimum
    let unitPrintPrice = sqft * baseRate;
    unitPrintPrice = Math.max(unitPrintPrice, minPrice);

    // Apply Double Sided Multiplier (e.g., +50%)
    if (inputs.sides === 2) {
        unitPrintPrice *= (1 + parseFloat(data.Retail_Adder_DS_Mult || 0.50));
    }

    // Volume Tiers
    let discPct = 0;
    let currentBestTier = 0;
    let i = 1;
    const tierLog = [];
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tDisc = parseFloat(data[`Tier_${i}_Disc`] || 0);
        tierLog.push({ q: tQty, d: tDisc });
        if (inputs.qty >= tQty) currentBestTier = tDisc;
        i++;
    }
    discPct = currentBestTier;

    const retailPrint = (unitPrintPrice * (1 - discPct)) * inputs.qty;

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;

    const grandTotalRaw = retailPrint + feeDesign;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // UI Tier Log (For Simulator)
    const simTiers = tierLog.map(t => {
        const trPrint = (unitPrintPrice * (1 - t.d)) * t.q;
        const total = Math.max(trPrint + feeDesign, minOrder);
        return { q: t.q, base: unitPrintPrice * (1 - t.d), unit: total / t.q };
    });

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const totalSqFt = sqft * inputs.qty;
    const sheetSqFt = 32; // 4x8 sheet
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    
    // Material
    const rawSheetCost = parseFloat(data.Cost_Stock_316_4x8 || 13.86);
    const costSubstrate = (totalSqFt / sheetSqFt) * rawSheetCost * wastePct;
    const costInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * inputs.sides;

    // Rates
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateMachFB = parseFloat(data.Rate_Machine_Flatbed || 10);

    // 1. Print Department Setup (Split Prepress vs Machine)
    const prepressPrintMins = parseFloat(data.Time_Prepress_Print || 10);
    const machSetupPrintMins = parseFloat(data.Time_Setup_Printer || 5) + parseFloat(data.Time_Handling || 5);
    
    const costPrepressPrint = (prepressPrintMins / 60) * rateOp;
    const costMachSetupPrint = (machSetupPrintMins / 60) * rateOp;

    // 2. Print Run
    const lfPerHour = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const estLF = totalSqFt / 2; // Approximating 24" nesting
    const printHrs = (estLF / lfPerHour) * inputs.sides;
    
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costPrintMach = printHrs * rateMachFB;

    // 3. Cutting Department (Strictly Shear/Square Cuts)
    const setupMins = parseFloat(data.Time_Shear_Setup || 5);
    const cutMins = inputs.qty * parseFloat(data.Time_Shear_Cut || 1);
    const cutHrs = (setupMins + cutMins) / 60;
    const costCutLabor = cutHrs * rateShop;

    const subTotal = costSubstrate + costInk + costPrepressPrint + costMachSetupPrint + costPrintOp + costPrintMach + costCutLabor;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: retailPrint / inputs.qty,
            printTotal: retailPrint,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            tiers: simTiers,
            baseRate: unitPrintPrice / sqft 
        },
        cost: {
            total: subTotal + riskBuffer,
            breakdown: {
                rawSubstrate: costSubstrate,
                rawInk: costInk,
                costPrepressPrint: costPrepressPrint,
                costMachSetupPrint: costMachSetupPrint,
                costPrintLabor: costPrintOp,
                costPrintMach: costPrintMach,
                costCutLabor: costCutLabor,
                riskCost: riskBuffer,
                wastePct: (wastePct - 1) * 100,
                riskPct: (riskFactor - 1) * 100
            }
        },
        metrics: { margin: (grandTotal - (subTotal + riskBuffer)) / grandTotal }
    };
}

// ==========================================
// SIMULATOR CONFIGURATION SCHEMA
// ==========================================
window.FOAM_CONFIG = {
    tab: 'PROD_Foam_Signs',
    engine: calculateFoam,
    controls: [
      { id: 'w', label: 'Width (in)', type: 'number', def: 24 },
      { id: 'h', label: 'Height (in)', type: 'number', def: 18 },
      { id: 'sides', label: 'Sides', type: 'select', opts: [{v:1, t:'Single Sided'}, {v:2, t:'Double Sided'}] },
      { id: 'files', label: 'Files', type: 'number', def: 1 },
      { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    retails: [
      { heading: 'Foam Area Curves ($/SqFt)', key: 'FOM3_T1_Min', label: 'Per-Sign Min ($)', tooltip: 'FORMAT: 25.00' },
      { key: 'FOM3_T1_Rate', label: 'Tiny (<4sf)' },
      { key: 'FOM3_T2_Rate', label: 'Small (<16sf)' },
      { key: 'FOM3_T3_Rate', label: 'Med (<32sf)' },
      { key: 'FOM3_T4_Rate', label: 'Large (>32sf)' },
      { heading: 'Multipliers', key: 'Retail_Adder_DS_Mult', label: 'Double Sided Add', tooltip: 'FORMAT: 0.50 (adds 50%)' },
      { heading: 'Volume Discounts', key: 'Tier_1_Qty', label: 'Tier 1 Trigger' },
      { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)', tooltip: 'FORMAT: 0.05' }
    ],
    costs: [
      { key: 'Cost_Stock_316_4x8', label: '3/16" Sheet ($)', tooltip: 'Cost of full 4x8 sheet. FORMAT: 13.86' },
      { key: 'Cost_Ink_Latex', label: 'Ink ($/SqFt)', tooltip: 'FORMAT: 0.16' },
      { key: 'Rate_Operator', label: 'Print Op ($/Hr)' },
      { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
      { key: 'Time_Prepress_Print', label: 'Print Prepress (Min)' },
      { key: 'Time_Setup_Printer', label: 'Print Setup (Min)' },
      { key: 'Labor_Attendance_Ratio', label: 'Operator Attn (%)', tooltip: 'FORMAT: 0.10' },
      { key: 'Waste_Factor', label: 'Waste Buffer', tooltip: 'FORMAT: 1.15' }
    ],
    
    renderReceipt: function(data, fmt) {
      let retailHTML = `
        <div>
          <h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
          <div class="space-y-1 text-xs text-gray-700">
            <div class="flex justify-between"><span class="cursor-help border-b border-dotted border-gray-400">Printed Foam Base (Calculated @ ${fmt(data.retail.baseRate)}/sf):</span> <span>${fmt(data.retail.printTotal)}</span></div>
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
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Foam Substrate:</span> <span>${fmt(b.rawSubstrate)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Ink Cost:</span> <span>${fmt(b.rawInk)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Print Prepress (RIP/Pathing):</span> <span>${fmt(b.costPrepressPrint)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Printer Setup (Load/Calibrate):</span> <span>${fmt(b.costMachSetupPrint)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Flatbed Print Run (Machine):</span> <span>${fmt(b.costPrintMach)}</span></div>
            <div class="flex justify-between"><span class="cursor-help border-b border-dotted border-gray-400" title="Factored at Operator Attention Ratio.">Flatbed Print Run (Labor):</span> <span>${fmt(b.costPrintLabor)}</span></div>
            <div class="flex justify-between text-orange-800"><span class="border-b border-dotted border-orange-300">Shear Cutting (Labor):</span> <span>${fmt(b.costCutLabor)}</span></div>
            <div class="border-t border-gray-200 mt-2 pt-1"></div>
            <h4 class="text-[9px] font-bold text-gray-500 uppercase mb-1">Additives & Risk</h4>
            <div class="flex justify-between text-red-600"><span class="border-b border-dotted border-red-400">Material Waste (${b.wastePct ? b.wastePct.toFixed(0) : 15}%):</span> <span>(Calculated Above)</span></div>
            <div class="flex justify-between text-orange-500 opacity-80"><span class="border-b border-dotted border-orange-300">Suggested Risk Buffer (${b.riskPct ? b.riskPct.toFixed(0) : 5}%):</span> <span>(+ ${fmt(b.riskCost)})</span></div>
        `;
      }
      costHTML += `<div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div></div></div>`;
      return retailHTML + costHTML;
    }
};
