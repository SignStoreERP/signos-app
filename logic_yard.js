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
        
        // Calculate the specific stake price for THIS tier in the discount table
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

    // Separate Raw Blanks and Waste
    const rawBlanks = blankCost * inputs.qty;
    const wastePct = parseFloat(data.Waste_Factor || 1.10);
    const wasteCost = rawBlanks * (wastePct - 1);
    const totalMat = rawBlanks + wasteCost; 

    // Ink 
    const areaSqFt = (24*18)/144;
    const totalArea = areaSqFt * inputs.sides * inputs.qty;
    const totalInk = totalArea * parseFloat(data.Cost_Ink_Latex || 0.16);

    // Stakes
    const costStakeUnit = inputs.hasStakes ? parseFloat(data.Cost_Stake || 0.65) : 0;
    const totalStakeCost = costStakeUnit * inputs.qty;

    // One-Time Setup & Handling
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const setupMins = parseFloat(data.Time_Setup_Job || 15) + parseFloat(data.Time_Handling || 5);
    const costSetupCost = (setupMins / 60) * rateOp;

    // Production Yield (R1000)
    const bedCap = parseFloat(data.Printer_Bed_Capacity || 3);
    const speed = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const lfPerSet = 2.0; 
    const totalRunHrs = ((lfPerSet / bedCap / speed) * inputs.sides) * inputs.qty;

    const costMachine = totalRunHrs * parseFloat(data.Rate_Machine_Flatbed || 45);
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costOpPrint = totalRunHrs * rateOp * attnRatio;

    // Totals & Risk
    const subTotal = totalMat + totalInk + totalStakeCost + costMachine + costOpPrint + costSetupCost;
    
    // Risk is just an indicator
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
        metrics: {
            margin: (grandTotal - totalCost) / grandTotal
        }
    };
}
