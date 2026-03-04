/**
 * PURE PHYSICS ENGINE: ACM Signs (v4.0)
 * Math Ledger integration with explicit Double-Sided Handling and Shear Hand Trimming.
 */
function calculateACM(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const multDS = inputs.sides === 2 ? 2 : 1;

    // --- 1. RETAIL ENGINE ---
    let baseSqFtRate = inputs.thickness === '6mm' ? parseFloat(data.ACM6_T1_Rate || 16.50) : parseFloat(data.ACM3_T1_Rate || 14.00);
    let retailPrint = baseSqFtRate * totalSqFt;

    if (inputs.sides === 2) retailPrint += (totalSqFt * parseFloat(data.Retail_Adder_DS_Mult || 0.5) * baseSqFtRate);

    let routerFee = 0;
    if (inputs.shape === 'CNC Simple') routerFee = parseFloat(data.Retail_Fee_Router_Easy || 30);
    else if (inputs.shape === 'CNC Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard || 50);

    const feeSetup = parseFloat(data.Retail_Fee_Setup || 15);
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(retailPrint + routerFee + feeSetup, minOrder);

    // --- 2. COST ENGINE (MATH LEDGER) ---
    const bd = [];
    const L = (label, total, formula) => { if(total > 0) bd.push({label, total, formula}); return total; };

    const sheetCost = inputs.thickness === '6mm' ? parseFloat(data.Cost_Stock_6mm_4x8 || 72.10) : parseFloat(data.Cost_Stock_3mm_4x8 || 52.09);
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    const rawBlanks = L(`ACM Panel (${inputs.thickness})`, (totalSqFt / 32) * sheetCost, `(${totalSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);
    L(`Flatbed Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * multDS, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    
    L(`Job Setup (File RIP)`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    L(`Material Handling`, (5 / 60) * rateOp * multDS, `5 Mins * $${rateOp}/hr * ${multDS} Sides`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(data.Machine_Speed_LF_Hr || 25)) * multDS;
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(data.Rate_Machine_Flatbed || 10), `${printHrs.toFixed(2)} Hrs * $10/hr`);

    if (inputs.shape !== 'Rectangle') {
        const cutHrs = (totalSqFt * (inputs.shape === 'CNC Simple' ? 1 : 2)) / 60;
        L(`CNC Router Run`, cutHrs * parseFloat(data.Rate_Machine_CNC || 10), `${cutHrs.toFixed(2)} Hrs * $10/hr`);
        L(`CNC Op (Attn Ratio)`, cutHrs * parseFloat(data.Rate_CNC_Labor || 25), `${cutHrs.toFixed(2)} Hrs * $25/hr`);
    } else {
        const perimeterLF = ((inputs.w * 2) + (inputs.h * 2)) / 12;
        L(`Shear Cutting (Perimeter)`, (perimeterLF * inputs.qty * parseFloat(data.Time_Cut_Hand || 0.25) / 60) * rateShop, `${(perimeterLF * inputs.qty).toFixed(1)} LF * 0.25 Mins/LF * $${rateShop}/hr`);
    }

    let hardCostRaw = bd.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, routerFee: routerFee, setupFee: feeSetup, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: bd },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}
