/**
 * PURE PHYSICS ENGINE: Custom Coroplast (v4.0)
 * Upgraded to Educational Math Ledger format. Adds Hand Cut and explicit DS setup double-handling.
 */
function calculateCoro(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const thk = inputs.thickness;
    const multDS = inputs.sides === 2 ? 2 : 1;

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

    // --- 2. COST ENGINE (MATH LEDGER) ---
    const bd = [];
    const L = (label, total, formula) => { if(total > 0) bd.push({label, total, formula}); return total; };

    const sheetCost = thk === '10mm' ? parseFloat(data.Cost_Stock_10mm_4x8 || 33.49) : parseFloat(data.Cost_Stock_4mm_4x8 || 8.40);
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);

    const sheetsNeeded = totalSqFt / 32;
    const rawBlanks = L(`Raw Substrate (${thk})`, sheetsNeeded * sheetCost, `(${totalSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    const wasteCost = L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);
    
    const setupMins = parseFloat(data.Time_Setup_Job || 15);
    const costSetupPrint = L(`Job Setup (File RIP)`, (setupMins / 60) * rateOp, `${setupMins} Mins * $${rateOp}/hr`);

    let subHardCost = rawBlanks + wasteCost + costSetupPrint;

    if (thk === '10mm') {
        const vinCost = totalSqFt * parseFloat(data.Cost_Vin_Cal || 0.21) * multDS;
        L(`Print Media`, vinCost, `${totalSqFt.toFixed(1)} SF * $0.21/SF * ${multDS} Sides`);
        const lamCost = totalSqFt * parseFloat(data.Cost_Lam_Cal || 0.36) * multDS;
        L(`Laminate Media`, lamCost, `${totalSqFt.toFixed(1)} SF * $0.36/SF * ${multDS} Sides`);
        const inkCost = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * multDS;
        L(`Latex Ink`, inkCost, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);
        
        const printHrs = (totalSqFt / parseFloat(data.Speed_Print_Roll || 150)) * multDS;
        const opPrint = L(`Print Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
        const machPrint = L(`Roll Printer Run`, printHrs * parseFloat(data.Rate_Machine_Print || 5), `${printHrs.toFixed(2)} Hrs * $5/hr`);
        
        const mountHrs = (totalSqFt / 32) * (15 / 60) * multDS;
        const mountLab = L(`Manual Board Mounting`, mountHrs * rateShop, `${(totalSqFt/32).toFixed(1)} Sheets * 15 Mins * $${rateShop}/hr * ${multDS} Sides`);

        subHardCost += vinCost + lamCost + inkCost + opPrint + machPrint + mountLab;
    } else {
        const inkCost = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * multDS;
        L(`Flatbed Ink`, inkCost, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);
        
        const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(data.Machine_Speed_LF_Hr || 25)) * multDS;
        const opPrint = L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
        const machPrint = L(`Flatbed Machine Run`, printHrs * parseFloat(data.Rate_Machine_Flatbed || 10), `${printHrs.toFixed(2)} Hrs * $10/hr`);

        // NEW: Double Handling for Double-Sided
        const handleMins = parseFloat(data.Time_Handling || 5) * multDS;
        const costHandle = L(`Material Handling`, (handleMins / 60) * rateOp, `${handleMins} Mins * $${rateOp}/hr`);

        subHardCost += inkCost + opPrint + machPrint + costHandle;
    }

    // Finishing Math
    if (inputs.shape !== 'Rectangle') {
        const cutHrs = (totalSqFt * (inputs.shape === 'CNC Simple' ? 1 : 2)) / 60;
        const machCNC = L(`CNC Router Run`, cutHrs * parseFloat(data.Rate_Machine_CNC || 10), `${cutHrs.toFixed(2)} Hrs * $10/hr`);
        const labCNC = L(`CNC Op (Attn Ratio)`, cutHrs * parseFloat(data.Rate_CNC_Labor || 25), `${cutHrs.toFixed(2)} Hrs * $25/hr`);
        subHardCost += machCNC + labCNC;
    } else {
        const perimeterLF = ((inputs.w * 2) + (inputs.h * 2)) / 12;
        const totalLF = perimeterLF * inputs.qty;
        const handMins = totalLF * parseFloat(data.Time_Cut_Hand || 0.25);
        const costCutHand = L(`Hand/Shear Cutting`, (handMins / 60) * rateShop, `${totalLF.toFixed(1)} LF * 0.25 Mins/LF * $${rateShop}/hr`);
        subHardCost += costCutHand;
    }

    const totalCost = subHardCost * riskFactor;

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, routerFee: routerFee, setupFee: feeSetup, designFee: feeDesign, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: bd },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}
// Keep window.CORO_CONFIG from previous version, just omit the renderReceipt function since UI handles array natively!
