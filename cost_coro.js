/**
 * PURE PHYSICS ENGINE: Custom Coroplast (v2.4)
 * Integrating Roll Media + Mounting Physics for 10mm to correct margin reporting.
 */
function calculateCoro(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const thk = inputs.thickness;

    // --- 1. RETAIL ENGINE ---
    let baseSqFtRate = 0;
    if (thk === '4mm') {
        if (sqft <= 3.99) baseSqFtRate = parseFloat(data.COR4_T1_Rate) || 8.33;
        else if (sqft <= 15.99) baseSqFtRate = parseFloat(data.COR4_T2_Rate) || 7.00;
        else if (sqft <= 31.99) baseSqFtRate = parseFloat(data.COR4_T3_Rate) || 6.00;
        else baseSqFtRate = parseFloat(data.COR4_T4_Rate) || 5.00;
    } else {
        if (sqft <= 3.99) baseSqFtRate = parseFloat(data.COR10_T1_Rate) || 25.00;
        else if (sqft <= 15.99) baseSqFtRate = parseFloat(data.COR10_T2_Rate) || 21.00;
        else if (sqft <= 31.99) baseSqFtRate = parseFloat(data.COR10_T3_Rate) || 18.00;
        else baseSqFtRate = parseFloat(data.COR10_T4_Rate) || 15.00;
    }

    let retailPrint = baseSqFtRate * totalSqFt;
    if (inputs.sides === 2) retailPrint += (totalSqFt * parseFloat(thk === '10mm' ? data.Retail_Adder_DS_10mm || 5 : data.Retail_Adder_DS_4mm || 2.5));

    let routerFee = 0;
    if (inputs.shape === 'CNC Simple') routerFee = parseFloat(data.Retail_Fee_Router_Easy || 30);
    else if (inputs.shape === 'CNC Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard || 50);

    const feeSetup = inputs.setupPerFile ? (parseFloat(data.Retail_Fee_Setup || 15) * inputs.files) : parseFloat(data.Retail_Fee_Setup || 15);
    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;

    const grandTotalRaw = retailPrint + routerFee + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE ---
    const sheetCost = thk === '10mm' ? parseFloat(data.Cost_Stock_10mm_4x8 || 33.49) : parseFloat(data.Cost_Stock_4mm_4x8 || 8.40);
    const rawBlanks = Math.ceil(totalSqFt / 32) * sheetCost;
    const wastePct = parseFloat(data.Waste_Factor || 1.10);
    
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateMachPrint = parseFloat(data.Rate_Machine_Flatbed || 10);
    const costSetup = (parseFloat(data.Time_Setup_Job || 15) / 60) * rateOp;

    let subHardCost = 0;
    let totalInk = 0;
    let costPrintMach = 0;
    let costPrintOp = 0;
    let costCutMach = 0;
    let costCutLabor = 0;
    let costMountLabor = 0;
    let rawMountVin = 0;
    let rawMountLam = 0;

    if (thk === '10mm') {
        // Roll Print + Mount Workflow
        rawMountVin = totalSqFt * parseFloat(data.Cost_Vin_Cal || 0.21) * wastePct * inputs.sides;
        rawMountLam = totalSqFt * parseFloat(data.Cost_Lam_Cal || 0.36) * wastePct * inputs.sides;
        totalInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * inputs.sides;
        
        const printHrs = (totalSqFt / parseFloat(data.Speed_Print_Roll || 150)) * inputs.sides;
        costPrintOp = printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10);
        costPrintMach = printHrs * parseFloat(data.Rate_Machine_Print || 5);
        
        // Labor: 15 mins per sheet area per side to mount
        const mountHrs = (totalSqFt / 32) * (15 / 60) * inputs.sides;
        costMountLabor = mountHrs * parseFloat(data.Rate_Shop_Labor || 20);

        if (inputs.shape !== 'Rectangle') {
            const cutHrs = (totalSqFt * (inputs.shape === 'CNC Simple' ? 1 : 2)) / 60;
            costCutMach = cutHrs * parseFloat(data.Rate_Machine_CNC || 10);
            costCutLabor = cutHrs * parseFloat(data.Rate_CNC_Labor || 25);
        }

        subHardCost = rawBlanks + (rawBlanks*(wastePct-1)) + rawMountVin + rawMountLam + totalInk + costSetup + costPrintOp + costPrintMach + costMountLabor + costCutMach + costCutLabor;
    } else {
        // Direct Flatbed Workflow
        totalInk = totalSqFt * inputs.sides * parseFloat(data.Cost_Ink_Latex || 0.16);
        const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(data.Machine_Speed_LF_Hr || 25)) * inputs.sides;
        costPrintOp = printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10);
        costPrintMach = printHrs * rateMachPrint;

        if (inputs.shape !== 'Rectangle') {
            const cutHrs = (totalSqFt * (inputs.shape === 'CNC Simple' ? 1 : 2)) / 60;
            costCutMach = cutHrs * parseFloat(data.Rate_Machine_CNC || 10);
            costCutLabor = cutHrs * parseFloat(data.Rate_CNC_Labor || 25);
        } else {
            costCutLabor = ((parseFloat(data.Time_Shear_Setup || 5) + inputs.qty) / 60) * rateOp;
        }
        
        subHardCost = rawBlanks + (rawBlanks*(wastePct-1)) + totalInk + costSetup + costPrintOp + costPrintMach + costCutMach + costCutLabor;
    }

    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const totalCost = subHardCost * riskFactor;

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, routerFee: routerFee, setupFee: feeSetup, designFee: feeDesign, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: { rawBlanks: rawBlanks, rawVinylLam: rawMountVin + rawMountLam, totalInk: totalInk, costSetup: costSetup, costMachine: costPrintMach + costCutMach, costOp: costPrintOp + costCutLabor + costMountLabor, wasteCost: subHardCost - (subHardCost/wastePct), riskCost: totalCost - subHardCost } },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.CORO_CONFIG = {
    tab: 'PROD_Coroplast_Signs', engine: calculateCoro,
    controls: [
        { id: 'w', label: 'Width (in)', type: 'number', def: 24 }, { id: 'h', label: 'Height (in)', type: 'number', def: 18 },
        { id: 'thickness', label: 'Thickness', type: 'select', opts: [{v:'4mm', t:'4mm Standard'}, {v:'10mm', t:'10mm Heavy Duty'}] },
        { id: 'sides', label: 'Print Sides', type: 'select', opts: [{v:1, t:'1-Sided'}, {v:2, t:'2-Sided'}] },
        { id: 'shape', label: 'Cut Type', type: 'select', opts: [{v:'Rectangle', t:'Square Cut'}, {v:'CNC Simple', t:'CNC Simple'}, {v:'CNC Complex', t:'CNC Complex'}] }
    ],
    retails: [ { key: 'COR4_T1_Rate', label: '4mm Base' }, { key: 'COR10_T1_Rate', label: '10mm Base' } ],
    costs: [ { key: 'Cost_Stock_4mm_4x8', label: '4mm Sheet' }, { key: 'Cost_Stock_10mm_4x8', label: '10mm Sheet' }, { key: 'Cost_Vin_Cal', label: '10mm Mnt Vinyl' } ],
    renderReceipt: function(data, fmt) {
        return `<div><h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
        <div class="space-y-1 text-xs text-gray-700">
        <div class="flex justify-between"><span>Base Print:</span> <span>${fmt(data.retail.printTotal)}</span></div>
        <div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Retail:</span> <span>${fmt(data.retail.grandTotal)}</span></div>
        </div></div>
        <div class="mt-4"><h4 class="text-[10px] font-bold text-red-800 uppercase mb-2 border-b border-red-200 pb-1">Physics Engine (Cost)</h4>
        <div class="space-y-1 text-xs text-gray-700">
        <div class="flex justify-between"><span>Raw Blanks/Mounting:</span> <span>${fmt(data.cost.breakdown.rawBlanks + data.cost.breakdown.rawVinylLam)}</span></div>
        <div class="flex justify-between"><span>Machine & Labor:</span> <span>${fmt(data.cost.breakdown.costMachine + data.cost.breakdown.costOp)}</span></div>
        <div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div>
        </div></div>`;
    }
};
