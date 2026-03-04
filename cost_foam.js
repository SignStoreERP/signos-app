/**
 * PURE PHYSICS ENGINE: Foam Core Boards (v2.0)
 * Upgraded to Educational Math Ledger format. Includes Hand Cutting and DS handling math.
 */
function calculateFoam(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const multDS = inputs.sides === 2 ? 2 : 1;

    // --- 1. RETAIL ENGINE ---
    let baseSqFtRate = 0;
    if (sqft <= 3.99) baseSqFtRate = parseFloat(data.FOM3_T1_Rate || 8.33);
    else if (sqft <= 15.99) baseSqFtRate = parseFloat(data.FOM3_T2_Rate || 8);
    else if (sqft <= 31.99) baseSqFtRate = parseFloat(data.FOM3_T3_Rate || 7);
    else baseSqFtRate = parseFloat(data.FOM3_T4_Rate || 6);

    let retailPrint = baseSqFtRate * totalSqFt;
    if (inputs.sides === 2) retailPrint += (totalSqFt * parseFloat(data.Retail_Adder_DS_Mult || 0.5) * baseSqFtRate);

    let routerFee = 0;
    if (inputs.shape === 'CNC Simple') routerFee = parseFloat(data.Retail_Fee_Router_Easy || 30);
    else if (inputs.shape === 'CNC Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard || 50);

    const feeSetup = inputs.setupPerFile ? parseFloat(data.Retail_Fee_Setup || 15) * inputs.files : parseFloat(data.Retail_Fee_Setup || 15);
    const grandTotalRaw = retailPrint + routerFee + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE (MATH LEDGER) ---
    const bd = [];
    const L = (label, total, formula) => { if(total > 0) bd.push({label, total, formula}); return total; };

    const sheetCost = parseFloat(data.Cost_Stock_316_4x8 || 13.86);
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);

    const sheetsNeeded = totalSqFt / 32;
    const rawBlanks = L(`Foam Core (3/16")`, sheetsNeeded * sheetCost, `(${totalSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    const wasteCost = L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);
    
    const inkCost = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * multDS;
    L(`Flatbed Ink`, inkCost, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);

    const setupMins = parseFloat(data.Time_Setup_Job || 15);
    const costSetupPrint = L(`Job Setup (File RIP)`, (setupMins / 60) * rateOp, `${setupMins} Mins * $${rateOp}/hr`);

    // Double-Sided Handling
    const handleMins = parseFloat(data.Time_Handling || 5) * multDS;
    const costHandle = L(`Material Handling`, (handleMins / 60) * rateOp, `5 Mins * $${rateOp}/hr * ${multDS} Sides`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(data.Machine_Speed_LF_Hr || 18)) * multDS;
    const opPrint = L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    const machPrint = L(`Flatbed Machine Run`, printHrs * parseFloat(data.Rate_Machine_Flatbed || 10), `${printHrs.toFixed(2)} Hrs * $10/hr`);

    let subHardCost = rawBlanks + wasteCost + inkCost + costSetupPrint + costHandle + opPrint + machPrint;

    if (inputs.shape !== 'Rectangle') {
        const cutHrs = (totalSqFt * (inputs.shape === 'CNC Simple' ? 1 : 2)) / 60;
        subHardCost += L(`CNC Router Run`, cutHrs * parseFloat(data.Rate_Machine_CNC || 10), `${cutHrs.toFixed(2)} Hrs * $10/hr`);
        subHardCost += L(`CNC Op (Attn Ratio)`, cutHrs * parseFloat(data.Rate_CNC_Labor || 25), `${cutHrs.toFixed(2)} Hrs * $25/hr`);
    } else {
        const perimeterLF = ((inputs.w * 2) + (inputs.h * 2)) / 12;
        const handMins = perimeterLF * inputs.qty * parseFloat(data.Time_Cut_Hand || 0.25);
        subHardCost += L(`Hand/Shear Cutting`, (handMins / 60) * rateShop, `${(perimeterLF * inputs.qty).toFixed(1)} LF * 0.25 Mins/LF * $${rateShop}/hr`);
    }

    const totalCost = subHardCost * riskFactor;

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, routerFee: routerFee, setupFee: feeSetup, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: bd },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}
