/**
 * PURE PHYSICS ENGINE: Acrylic Signs (v6.0)
 * Proportional Yield fix and Educational Math Ledger layout.
 */
function calculateAcrylic(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    let thk = inputs.thickness;
    if (thk === '1/4') thk = '0.25';
    if (thk === '1/2') thk = '0.5';
    if (thk === '3/4') thk = '0.75';
    if (thk === '1') thk = '1';

    // --- 1. RETAIL ENGINE ---
    let baseRate = 0;
    if (thk === '0.25') {
        if (sqft <= 10) baseRate = parseFloat(data.ACR_14_T1_Rate || 40);
        else if (sqft <= 20) baseRate = parseFloat(data.ACR_14_T2_Rate || 35);
        else baseRate = parseFloat(data.ACR_14_T3_Rate || 30);
    } else if (thk === '0.5') {
        if (sqft <= 10) baseRate = parseFloat(data.ACR_12_T1_Rate || 45);
        else baseRate = parseFloat(data.ACR_12_T2_Rate || 40);
    } else if (thk === '0.75') {
        if (sqft <= 10) baseRate = parseFloat(data.ACR_34_T1_Rate || 55);
        else baseRate = parseFloat(data.ACR_34_T2_Rate || 50);
    } else if (thk === '1') {
        if (sqft <= 10) baseRate = parseFloat(data.ACR_1IN_T1_Rate || 60);
        else baseRate = parseFloat(data.ACR_1IN_T2_Rate || 55);
    }

    let retailPrint = baseRate * totalSqFt;
    let routerFee = inputs.shape === 'Rectangle' ? 0 : parseFloat(data.Retail_Fee_Router_Easy || 30);
    const feeSetup = parseFloat(data.Retail_Fee_Setup || 25);
    const grandTotalRaw = retailPrint + routerFee + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 75);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE (MATH LEDGER) ---
    const bd = [];
    const L = (label, total, formula) => { if(total > 0) bd.push({label, total, formula}); return total; };

    let thkKey = '14';
    if (thk === '0.5') thkKey = '12';
    if (thk === '0.75') thkKey = '34';
    if (thk === '1') thkKey = '1IN';
    const colorKey = inputs.color === 'Clear' ? 'C' : 'W';
    const sheetCost = parseFloat(data[`Cost_Stock_${thkKey}_4x8_${colorKey}`]);

    const wastePct = parseFloat(data.Waste_Factor || 1.25);
    const riskFactor = parseFloat(data.Factor_Risk || 1.10);
    
    // FIX: PROPORTIONAL YIELD MATH!
    const rawBlanks = L(`Acrylic Yield (${thk}" ${inputs.color})`, (totalSqFt / 32) * sheetCost, `(${totalSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    const wasteCost = L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);

    const inkCost = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16);
    L(`Flatbed Ink`, inkCost, `${totalSqFt.toFixed(1)} SF * $0.16/SF`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const costSetupPrint = L(`Job Setup (File RIP)`, (parseFloat(data.Time_Setup_Job || 15) / 60) * rateOp, `15 Mins * $${rateOp}/hr`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(data.Speed_Print_1st || 18));
    const opPrint = L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    const machPrint = L(`Flatbed Machine Run`, printHrs * parseFloat(data.Rate_Machine_Flatbed || 10), `${printHrs.toFixed(2)} Hrs * $10/hr`);

    let subHardCost = rawBlanks + wasteCost + inkCost + costSetupPrint + opPrint + machPrint;

    if (inputs.shape !== 'Rectangle') {
        const cutHrs = (totalSqFt * 1) / 60; // Acrylic requires easy path
        subHardCost += L(`CNC Router Run`, cutHrs * parseFloat(data.Rate_Machine_CNC || 10), `${cutHrs.toFixed(2)} Hrs * $10/hr`);
        subHardCost += L(`CNC Op (Attn Ratio)`, cutHrs * parseFloat(data.Rate_CNC_Labor || 25), `${cutHrs.toFixed(2)} Hrs * $25/hr`);
    }

    const totalCost = subHardCost * riskFactor;

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, routerFee: routerFee, setupFee: feeSetup, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: bd },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}
