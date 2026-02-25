/**
 * PURE PHYSICS ENGINE: Custom Coroplast (v2.3)
 * Bug Fix: Corrected split array index for dimension parsing.
 */
function calculateCoro(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    
    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    const reqShort = Math.min(inputs.w, inputs.h);
    const reqLong = Math.max(inputs.w, inputs.h);
    const sideStr = inputs.sides === 2 ? 'DS' : 'SS';
    const thickStr = inputs.thickness === '10mm' ? '10' : '4';
    
    let bestFitArea = Infinity;
    let bestP1 = null, bestP10 = null, bestLabel = "";

    // A. Bounding Box Search
    Object.keys(data).forEach(key => {
        if (key.startsWith(`RET_COR${thickStr}_`) && key.endsWith(`_${sideStr}_1`)) {
            const dimStr = key.split('_')[2]; 
            const stdShort = parseInt(dimStr.substring(0, 2), 10);
            const stdLong = parseInt(dimStr.substring(2), 10);
            const stdArea = stdShort * stdLong;

            if (reqShort <= stdShort && reqLong <= stdLong && stdArea < bestFitArea) {
                bestFitArea = stdArea;
                bestP1 = parseFloat(data[key]);
                bestP10 = parseFloat(data[key.replace(/_1$/, '_10')]) || bestP1;
                bestLabel = `${stdShort}x${stdLong}`;
            }
        }
    });

    let retailPrint = 0;
    let baseSqFtRate = 0;
    const t1Qty = parseFloat(data.Tier_1_Qty || 10);
    const tierLog = [];

    if (bestP1 !== null) {
        const appliedBase = inputs.qty >= t1Qty ? bestP10 : bestP1;
        retailPrint = appliedBase * inputs.qty;
        baseSqFtRate = bestP1 / sqft;
        tierLog.push(
            { q: 1, base: bestP1, unit: bestP1 },
            { q: t1Qty, base: bestP10, unit: bestP10 }
        );
    } else {
        let minSignPrice = inputs.thickness === '10mm' ? 75 : 25;
        if (inputs.thickness === '10mm') {
            if (sqft <= 3.99) baseSqFtRate = 25.00;
            else if (sqft <= 15.99) baseSqFtRate = 21.00;
            else if (sqft <= 31.99) baseSqFtRate = 18.00;
            else baseSqFtRate = 15.00;
        } else {
            if (sqft <= 3.99) baseSqFtRate = 8.33;
            else if (sqft <= 15.99) baseSqFtRate = 7.00;
            else if (sqft <= 31.99) baseSqFtRate = 6.00;
            else baseSqFtRate = 5.00;
        }

        let signPrice = baseSqFtRate * sqft;
        if (signPrice < minSignPrice) signPrice = minSignPrice;
        if (inputs.sides === 2) signPrice *= 1.5;

        const discPct = inputs.qty >= t1Qty ? parseFloat(data.Tier_1_Disc || 0.05) : 0;
        const appliedBase = signPrice * (1 - discPct);
        retailPrint = appliedBase * inputs.qty;

        tierLog.push(
            { q: 1, base: signPrice, unit: signPrice },
            { q: t1Qty, base: signPrice * (1 - parseFloat(data.Tier_1_Disc || 0.05)), unit: signPrice * (1 - parseFloat(data.Tier_1_Disc || 0.05)) }
        );
    }

    let routerFee = 0;
    if (inputs.shape === 'CNC Simple') routerFee = parseFloat(data.Retail_Fee_Router_Easy || 30);
    if (inputs.shape === 'CNC Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard || 50);

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;

    const grandTotalRaw = retailPrint + routerFee + feeDesign + feeSetup;
    const minOrder = bestP1 !== null ? 0 : parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    tierLog.forEach(t => t.unit = (t.unit * t.q + routerFee) / t.q);

    // --- 2. COST ENGINE ---
    const costSheet = inputs.thickness === '10mm' ? parseFloat(data.Cost_Stock_10mm_4x8 || 33.49) : parseFloat(data.Cost_Stock_4mm_4x8 || 8.40);
    const costPerSqFt = costSheet / 32;
    const wastePct = parseFloat(data.Waste_Factor || 1.10);
    const rawMat = costPerSqFt * totalSqFt;
    const wasteCost = rawMat * (wastePct - 1);
    const totalInk = totalSqFt * inputs.sides * parseFloat(data.Cost_Ink_Latex || 0.16);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateCNC = parseFloat(data.Rate_CNC_Labor || 25);
    const rateMachPrint = parseFloat(data.Rate_Machine_Flatbed || 45);
    const rateMachCNC = parseFloat(data.Rate_Machine_CNC || 35);

    let costCutSetup = 0, costCutLabor = 0, costCutMach = 0, runHrsCNC = 0;
    if (inputs.shape === 'Rectangle') {
        costCutSetup = (parseFloat(data.Time_Shear_Setup || 5) / 60) * rateOp;
        costCutLabor = ((inputs.qty * 2 * parseFloat(data.Time_Shear_Cut || 1)) / 60) * rateOp;
    } else {
        costCutSetup = (parseFloat(data.Time_Setup_CNC || 10) / 60) * rateCNC;
        const routeTimeSqFt = inputs.shape === 'CNC Complex' ? parseFloat(data.Time_CNC_Complex_SqFt || 2) : parseFloat(data.Time_CNC_Easy_SqFt || 1);
        runHrsCNC = (totalSqFt * routeTimeSqFt) / 60;
        costCutLabor = runHrsCNC * rateCNC;
        costCutMach = runHrsCNC * rateMachCNC;
    }

    const setupMinsPrint = parseFloat(data.Time_Setup_Job || 15) + parseFloat(data.Time_Handling || 4);
    const costSetupPrint = (setupMinsPrint / 60) * rateOp;
    const speedPrint = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const printHrs = ((inputs.h / 12) * inputs.qty / speedPrint) * inputs.sides;
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costPrintMach = printHrs * rateMachPrint;

    const subTotal = rawMat + wasteCost + totalInk + costSetupPrint + costPrintOp + costPrintMach + costCutSetup + costCutLabor + costCutMach;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: (retailPrint + routerFee) / inputs.qty, printTotal: retailPrint, routerFee: routerFee, setupFee: feeSetup, designFee: feeDesign,
            grandTotal: grandTotal, isMinApplied: grandTotalRaw < minOrder, tiers: tierLog, yieldLabel: bestLabel ? `Yield Box: ${bestLabel}` : "Area Curve"
        },
        cost: {
            total: subTotal,
            breakdown: { rawBlanks: rawMat, wasteCost: wasteCost, wastePct: (wastePct - 1) * 100, totalInk: totalInk, costSetup: costSetupPrint + costCutSetup, costCut: costCutLabor + costCutMach, runHrs: printHrs + runHrsCNC, costMachine: costPrintMach + costCutMach, costOp: costPrintOp + costCutLabor, riskCost: riskBuffer, riskPct: (riskFactor - 1) * 100 }
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
        { id: 'w', label: 'Width (in)', type: 'number', def: 24 },
        { id: 'h', label: 'Height (in)', type: 'number', def: 18 },
        { id: 'thickness', label: 'Thickness', type: 'select', opts: [{v:'4mm', t:'4mm Standard'}, {v:'10mm', t:'10mm Heavy Duty'}] },
        { id: 'sides', label: 'Print Sides', type: 'select', opts: [{v:1, t:'1-Sided'}, {v:2, t:'2-Sided'}] },
        { id: 'shape', label: 'Cut Type', type: 'select', opts: [{v:'Rectangle', t:'Square Cut'}, {v:'CNC Simple', t:'CNC Simple'}, {v:'CNC Complex', t:'CNC Complex'}] },
        { id: 'files', label: 'Files', type: 'number', def: 1 },
        { id: 'setupPerFile', label: 'Setup / File', type: 'toggle', def: false },
        { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    retails: [
        { heading: '4mm Area Curves', key: 'COR4_T1_Rate', label: 'T1 Rate ($/sf)' },
        { key: 'COR4_T2_Rate', label: 'T2 Rate ($/sf)' },
        { heading: '10mm Area Curves', key: 'COR10_T1_Rate', label: 'T1 Rate ($/sf)' },
        { key: 'COR10_T2_Rate', label: 'T2 Rate ($/sf)' },
        { heading: 'Adders & Fees', key: 'Retail_Adder_DS_4mm', label: '4mm DS Add ($/sf)' },
        { key: 'Retail_Adder_DS_10mm', label: '10mm DS Add ($/sf)' },
        { key: 'Retail_Fee_Router_Easy', label: 'CNC Simple Fee' },
        { key: 'Retail_Fee_Router_Hard', label: 'CNC Complex Fee' },
        { heading: 'Discounts', key: 'Tier_1_Qty', label: 'T1 Discount Qty' },
        { key: 'Tier_1_Disc', label: 'T1 Discount (%)' }
    ],
    costs: [
        { heading: 'Materials', key: 'Cost_Stock_4mm_4x8', label: '4mm 4x8 Sheet ($)' },
        { key: 'Cost_Stock_10mm_4x8', label: '10mm 4x8 Sheet ($)' },
        { key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },
        { heading: 'Machine Speeds & Time', key: 'Machine_Speed_LF_Hr', label: 'Print Spd (LF/hr)' },
        { key: 'Time_Setup_Job', label: 'Print Setup (Mins)' },
        { key: 'Time_Handling', label: 'Handling (Mins)' },
        { key: 'Time_Setup_CNC', label: 'CNC Setup (Mins)' },
        { key: 'Time_CNC_Easy_SqFt', label: 'CNC Easy (Mins/sf)' },
        { heading: 'Rates & Overhead', key: 'Rate_Operator', label: 'Print Op ($/Hr)' },
        { key: 'Rate_CNC_Labor', label: 'CNC Op ($/Hr)' },
        { key: 'Rate_Machine_Flatbed', label: 'Printer Mach ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'Router Mach ($/Hr)' },
        { key: 'Labor_Attendance_Ratio', label: 'Attn Ratio (0-1)' },
        { key: 'Waste_Factor', label: 'Waste Buffer' }
    ],
    renderReceipt: function(data, fmt) {
        let retailHTML = `<div><h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
        <div class="space-y-1 text-xs text-gray-700">
        <div class="flex justify-between"><span>Base Print:</span> <span>${fmt(data.retail.printTotal)}</span></div>
        ${data.retail.routerFee > 0 ? `<div class="flex justify-between text-orange-700"><span>CNC Routing Fee:</span> <span>${fmt(data.retail.routerFee)}</span></div>` : ''}
        <div class="flex justify-between"><span>Setup Fee:</span> <span>${fmt(data.retail.setupFee || 0)}</span></div>
        ${data.retail.designFee > 0 ? `<div class="flex justify-between text-purple-700"><span>Design Fee:</span> <span>${fmt(data.retail.designFee)}</span></div>` : ''}
        <div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Retail:</span> <span>${fmt(data.retail.grandTotal)}</span></div>
        </div></div>`;

        let costHTML = `<div class="mt-6"><h4 class="text-[10px] font-bold text-red-800 uppercase mb-2 border-b border-red-200 pb-1">Physics Engine (Cost)</h4>
        <div class="space-y-1 text-xs text-gray-700">`;
        if (data.cost.breakdown) {
            const b = data.cost.breakdown;
            costHTML += `
            <div class="flex justify-between"><span>Raw Blanks/Sheets:</span> <span>${fmt(b.rawBlanks)}</span></div>
            <div class="flex justify-between"><span>Ink:</span> <span>${fmt(b.totalInk)}</span></div>
            <div class="flex justify-between"><span>Setup Labor:</span> <span>${fmt(b.costSetup)}</span></div>
            <div class="flex justify-between"><span>Machine Run (${b.runHrs ? b.runHrs.toFixed(2) : 0}h):</span> <span>${fmt(b.costMachine)}</span></div>
            <div class="flex justify-between"><span>Operator Labor (Attn Ratio):</span> <span>${fmt(b.costOp)}</span></div>
            <div class="border-t border-gray-200 mt-2 pt-1"></div>
            <div class="flex justify-between text-red-600"><span>Material Waste (${b.wastePct ? b.wastePct.toFixed(0) : 10}%):</span> <span>+ ${fmt(b.wasteCost)}</span></div>
            <div class="flex justify-between text-orange-500 opacity-80"><span>Suggested Risk Buffer (${b.riskPct ? b.riskPct.toFixed(0) : 5}%):</span> <span>(+ ${fmt(b.riskCost)})</span></div>`;
        }
        costHTML += `<div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div></div></div>`;
        return retailHTML + costHTML;
    }
};
