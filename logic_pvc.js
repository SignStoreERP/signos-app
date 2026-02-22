/**
 * PURE PHYSICS ENGINE: PVC Signs (v1.4 - Dual Track)
 * Implements granular breakdown of Prepress vs Machine Setup for both Print and CNC.
 */

function calculatePVC(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    let baseRate = 0;
    let minPrice = 0;
    
    // Find matching tier based on thickness and square footage
    if (inputs.thickness === '3mm') {
        minPrice = parseFloat(data.PVC3_T1_Min || 33.00);
        if (sqft <= parseFloat(data.PVC3_T2_Max || 5.99)) baseRate = parseFloat(data.PVC3_T2_Rate || 13.20);
        else if (sqft <= parseFloat(data.PVC3_T3_Max || 11.99)) baseRate = parseFloat(data.PVC3_T3_Rate || 8.40);
        else baseRate = parseFloat(data.PVC3_T4_Rate || 7.80);
    } else {
        minPrice = parseFloat(data.PVC6_T1_Min || 33.00);
        if (sqft <= parseFloat(data.PVC6_T2_Max || 5.99)) baseRate = parseFloat(data.PVC6_T2_Rate || 22.00);
        else if (sqft <= parseFloat(data.PVC6_T3_Max || 11.99)) baseRate = parseFloat(data.PVC6_T3_Rate || 14.00);
        else baseRate = parseFloat(data.PVC6_T4_Rate || 13.00);
    }

    // Apply per-unit math and strict $33 minimum per sign
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

    // CNC Router Fee (Flat Fee per order)
    let routerFee = 0;
    if (inputs.shape === 'Easy') routerFee = parseFloat(data.Retail_Fee_Router_Easy || 30.00);
    else if (inputs.shape === 'Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard || 50.00);

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;

    // Removed Setup Fee from Retail
    const grandTotalRaw = retailPrint + routerFee + feeDesign;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // UI Tier Log (For Simulator)
    const simTiers = tierLog.map(t => {
        const trPrint = (unitPrintPrice * (1 - t.d)) * t.q;
        const total = Math.max(trPrint + routerFee + feeDesign, minOrder);
        return { q: t.q, base: unitPrintPrice * (1 - t.d), unit: total / t.q };
    });

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const totalSqFt = sqft * inputs.qty;
    const sheetSqFt = 32; // 4x8 sheet
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    
    // Material
    const rawSheetCost = inputs.thickness === '3mm' 
        ? parseFloat(data.Cost_Stock_3mm_4x8 || 29.09) 
        : parseFloat(data.Cost_Stock_6mm_4x8 || 58.37);
        
    const costSubstrate = (totalSqFt / sheetSqFt) * rawSheetCost * wastePct;
    const costInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * inputs.sides;

    // Rates
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateCNC = parseFloat(data.Rate_CNC_Labor || 25);
    const rateMachFB = parseFloat(data.Rate_Machine_Flatbed || 10);
    const rateMachCNC = parseFloat(data.Rate_Machine_CNC || 10);

    // 1. Print Department Setup (Split Prepress vs Machine)
    const prepressPrintMins = parseFloat(data.Time_Prepress_Print || 10);
    const machSetupPrintMins = parseFloat(data.Time_Setup_Printer || 5) + parseFloat(data.Time_Handling || 5);
    
    const costPrepressPrint = (prepressPrintMins / 60) * rateOp;
    const costMachSetupPrint = (machSetupPrintMins / 60) * rateOp;

    // 2. Print Run
    const lfPerHour = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const estLF = totalSqFt / 2; 
    const printHrs = (estLF / lfPerHour) * inputs.sides;
    
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costPrintMach = printHrs * rateMachFB;

    // 3. Cutting Department (Shear vs CNC)
    let cutHrs = 0;
    let cutMach = 0;
    let cutLabor = 0;
    
    let costPrepressCNC = 0;
    let costMachSetupCNC = 0;

    if (inputs.shape === 'Rectangle') {
        const setupMins = parseFloat(data.Time_Shear_Setup || 5);
        const cutMins = inputs.qty * parseFloat(data.Time_Shear_Cut || 1);
        const roundMins = inputs.rounded ? parseFloat(data.Time_Round_Setup || 5) + (inputs.qty * 4 * parseFloat(data.Time_Round_Corner || 0.5)) : 0;
        cutHrs = (setupMins + cutMins + roundMins) / 60;
        cutLabor = cutHrs * rateShop;
    } else {
        // Granular CNC Setup
        const prepressCNCMins = parseFloat(data.Time_Prepress_CNC || 15);
        const machSetupCNCMins = parseFloat(data.Time_Setup_CNC || 10);
        
        costPrepressCNC = (prepressCNCMins / 60) * rateCNC;
        costMachSetupCNC = (machSetupCNCMins / 60) * rateCNC; // Setup is 100% attended

        // CNC Run
        const runMinsSqFt = inputs.shape === 'Easy' ? parseFloat(data.Time_CNC_Easy_SqFt || 1) : parseFloat(data.Time_CNC_Complex_SqFt || 2);
        const runMins = totalSqFt * runMinsSqFt;
        cutHrs = runMins / 60;
        cutMach = cutHrs * rateMachCNC;
        // Apply Attendance Ratio to CNC run time
        cutLabor = cutHrs * rateCNC * attnRatio; 
    }

    const subTotal = costSubstrate + costInk + costPrepressPrint + costMachSetupPrint + costPrintOp + costPrintMach + costPrepressCNC + costMachSetupCNC + cutMach + cutLabor;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: (retailPrint + routerFee) / inputs.qty,
            printTotal: retailPrint,
            routerFee: routerFee,
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
                costPrint: costPrintOp + costPrintMach,
                costPrepressCNC: costPrepressCNC,
                costMachSetupCNC: costMachSetupCNC,
                costCut: cutMach + cutLabor,
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
window.PVC_CONFIG = {
    tab: 'PROD_PVC_Signs',
    engine: calculatePVC,
    controls: [
      { id: 'w', label: 'Width (in)', type: 'number', def: 24 },
      { id: 'h', label: 'Height (in)', type: 'number', def: 18 },
      { id: 'thickness', label: 'Thickness', type: 'select', opts: [{v:'3mm', t:'3mm Standard'}, {v:'6mm', t:'6mm Heavy'}] },
      { id: 'sides', label: 'Sides', type: 'select', opts: [{v:1, t:'Single Sided'}, {v:2, t:'Double Sided'}] },
      { id: 'shape', label: 'Cut Method', type: 'select', opts: [{v:'Rectangle', t:'Shear / Square'}, {v:'Easy', t:'CNC Simple'}, {v:'Complex', t:'CNC Complex'}] },
      { id: 'files', label: 'Files', type: 'number', def: 1 },
      { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    retails: [
      { heading: '3mm PVC Area Curves', key: 'PVC3_T1_Min', label: 'Per-Sign Min ($)', tooltip: 'FORMAT: 33.00' },
      { key: 'PVC3_T2_Rate', label: 'Small (<6sf) $/sf' },
      { key: 'PVC3_T3_Rate', label: 'Med (<12sf) $/sf' },
      { key: 'PVC3_T4_Rate', label: 'Large (>12sf) $/sf' },
      { heading: '6mm PVC Area Curves', key: 'PVC6_T1_Min', label: 'Per-Sign Min ($)' },
      { key: 'PVC6_T2_Rate', label: 'Small (<6sf) $/sf' },
      { key: 'PVC6_T3_Rate', label: 'Med (<12sf) $/sf' },
      { key: 'PVC6_T4_Rate', label: 'Large (>12sf) $/sf' },
      { heading: 'Multipliers & Fees', key: 'Retail_Adder_DS_Mult', label: 'Double Sided Add', tooltip: 'FORMAT: 0.50 (adds 50%)' },
      { key: 'Retail_Fee_Router_Easy', label: 'CNC Easy Fee ($)' },
      { key: 'Retail_Fee_Router_Hard', label: 'CNC Hard Fee ($)' },
      { heading: 'Volume Discounts', key: 'Tier_1_Qty', label: 'Tier 1 Trigger' },
      { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)', tooltip: 'FORMAT: 0.05' }
    ],
    costs: [
      { key: 'Cost_Stock_3mm_4x8', label: '3mm Sheet ($)', tooltip: 'Cost of full 4x8 sheet. FORMAT: 29.09' },
      { key: 'Cost_Stock_6mm_4x8', label: '6mm Sheet ($)', tooltip: 'Cost of full 4x8 sheet. FORMAT: 58.37' },
      { key: 'Cost_Ink_Latex', label: 'Ink ($/SqFt)', tooltip: 'FORMAT: 0.16' },
      { key: 'Rate_Operator', label: 'Print Op ($/Hr)' },
      { key: 'Rate_CNC_Labor', label: 'CNC Labor ($/Hr)' },
      { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
      { key: 'Time_Prepress_Print', label: 'Print Prepress (Min)', tooltip: 'Time to RIP files.' },
      { key: 'Time_Setup_Printer', label: 'Print Setup (Min)', tooltip: 'Time to load media/calibrate.' },
      { key: 'Time_Prepress_CNC', label: 'CNC Prepress (Min)', tooltip: 'Time to generate toolpaths.' },
      { key: 'Time_Setup_CNC', label: 'CNC Setup (Min)', tooltip: 'Time to mount sheet and zero bit.' },
      { key: 'Time_CNC_Easy_SqFt', label: 'CNC Easy (Min/SF)' },
      { key: 'Time_CNC_Complex_SqFt', label: 'CNC Hard (Min/SF)' },
      { key: 'Labor_Attendance_Ratio', label: 'Operator Attn (%)', tooltip: 'Percentage of machine run time the operator must actively attend. FORMAT: 0.10' },
      { key: 'Waste_Factor', label: 'Waste Buffer', tooltip: 'FORMAT: 1.15' }
    ],
    
    renderReceipt: function(data, fmt) {
      let retailHTML = `
        <div>
          <h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
          <div class="space-y-1 text-xs text-gray-700">
            <div class="flex justify-between" title="Based on Area Curves + DS rules + Per-Sign Minimums."><span class="cursor-help border-b border-dotted border-gray-400">Printed PVC Base (Calculated @ ${fmt(data.retail.baseRate)}/sf):</span> <span>${fmt(data.retail.printTotal)}</span></div>
            ${data.retail.routerFee > 0 ? `<div class="flex justify-between text-orange-700"><span>CNC Routing Fee:</span> <span>${fmt(data.retail.routerFee)}</span></div>` : ''}
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
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">PVC Substrate:</span> <span>${fmt(b.rawSubstrate)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Ink Cost:</span> <span>${fmt(b.rawInk)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Print Prepress (RIP/Pathing):</span> <span>${fmt(b.costPrepressPrint)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Printer Setup (Load/Calibrate):</span> <span>${fmt(b.costMachSetupPrint)}</span></div>
            <div class="flex justify-between"><span class="cursor-help border-b border-dotted border-gray-400" title="Factored at Operator Attention Ratio.">Flatbed Print Run:</span> <span>${fmt(b.costPrint)}</span></div>
            ${b.costPrepressCNC > 0 ? `<div class="flex justify-between text-orange-800"><span class="border-b border-dotted border-orange-300">CNC Prepress (Toolpaths):</span> <span>${fmt(b.costPrepressCNC)}</span></div>` : ''}
            ${b.costMachSetupCNC > 0 ? `<div class="flex justify-between text-orange-800"><span class="border-b border-dotted border-orange-300">CNC Setup (Mount/Zero):</span> <span>${fmt(b.costMachSetupCNC)}</span></div>` : ''}
            <div class="flex justify-between text-orange-800"><span class="cursor-help border-b border-dotted border-orange-300" title="Factored at Operator Attention Ratio.">Cutting Run (Labor & Machine):</span> <span>${fmt(b.costCut)}</span></div>
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
