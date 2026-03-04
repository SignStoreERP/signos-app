/**
 * PURE PHYSICS ENGINE: Yard Signs (v4.0)
 * Upgraded to Educational Math Ledger format. Explicit DS Handling.
 */
function calculateYardSign(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const multDS = inputs.sides === 2 ? 2 : 1;

    // --- 1. RETAIL ENGINE ---
    const baseSS = parseFloat(data.Retail_Price_Sign_SS || 25.00);
    const adderDS = parseFloat(data.Retail_Price_Sign_DS || 2.50);
    const stk1Price = parseFloat(data.Retail_Stake_T1_Price || 2.00);

    let appliedBase = baseSS;
    if (inputs.qty >= (parseFloat(data.Tier_1_Qty) || 10)) appliedBase = parseFloat(data.Tier_1_Price || 23.75);

    let retailPrint = (appliedBase + (inputs.sides === 2 ? adderDS : 0)) * inputs.qty;
    let retailStake = inputs.hasStakes ? (inputs.qty * stk1Price) : 0;
    
    const feeSetup = parseFloat(data.Retail_Fee_Setup || 15);
    const grandTotalRaw = retailPrint + retailStake + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE (MATH LEDGER) ---
    const bd = [];
    const L = (label, total, formula) => { if(total > 0) bd.push({label, total, formula}); return total; };

    const blankCost = inputs.qty >= (parseFloat(data.Bulk_Qty_Trigger) || 1100) ? parseFloat(data.Cost_Blank_Bulk || 0.65) : parseFloat(data.Cost_Blank_Standard || 0.65);
    const wastePct = parseFloat(data.Waste_Factor || 1.10);
    
    L(`Pre-Cut Coro Blanks`, (inputs.qty * blankCost) * wastePct, `${inputs.qty} Blanks * $${blankCost.toFixed(2)}/ea * ${wastePct} Waste`);
    if(inputs.hasStakes) L(`Wire H-Stakes`, inputs.qty * parseFloat(data.Cost_Stake || 0.65), `${inputs.qty} Stakes * $0.65/ea`);

    L(`Flatbed Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * multDS, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    L(`Job Setup (File RIP)`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    L(`Material Handling`, (5 / 60) * rateOp * multDS, `5 Mins * $${rateOp}/hr * ${multDS} Sides`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(data.Machine_Speed_LF_Hr || 25)) * multDS;
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(data.Rate_Machine_Flatbed || 10), `${printHrs.toFixed(2)} Hrs * $10/hr`);

    let hardCostRaw = bd.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, setupFee: feeSetup, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: bd },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}
