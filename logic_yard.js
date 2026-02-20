/**
 * PURE PHYSICS ENGINE: Yard Signs (v3.0 - Dual Track)
 * Generates Matrix-driven BOM and Retail outputs
 */

function calculateYardSign(inputs, data) {
    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    const baseSS = parseFloat(data.Retail_Price_Sign_SS || 25.00);
    const adderDS = parseFloat(data.Retail_Price_Sign_DS || 2.50);
    const stakePrice = parseFloat(data.Retail_Price_Stake || 2.50);

    // Tier Logic
    let appliedBase = baseSS;
    let i = 1;
    const tierLog = [];
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tPrice = parseFloat(data[`Tier_${i}_Price`] || 0);
        if (inputs.qty >= tQty) appliedBase = tPrice;
        
        const rowUnit = tPrice + (inputs.sides===2 ? adderDS : 0) + (inputs.hasStakes ? stakePrice : 0);
        tierLog.push({ q: tQty, base: tPrice, unit: rowUnit });
        i++;
    }

    const isCustom = (appliedBase === 0);
    const unitPrint = appliedBase + (inputs.sides === 2 ? adderDS : 0);
    const totalPrint = unitPrint * inputs.qty;
    const unitStake = inputs.hasStakes ? stakePrice : 0;
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

    const waste = parseFloat(data.Waste_Factor || 1.10);
    const totalMat = (blankCost * waste) * inputs.qty;

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
    const riskBuffer = subTotal * (parseFloat(data.Factor_Risk || 1.05) - 1);
    const totalCost = subTotal + riskBuffer;

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
                totalMat: totalMat + totalStakeCost,
                totalInk: totalInk,
                costSetup: costSetupCost,
                runHrs: totalRunHrs,
                costMachine: costMachine,
                costOp: costOpPrint,
                riskCost: riskBuffer
            }
        },
        metrics: {
            margin: (grandTotal - totalCost) / grandTotal
        }
    };
}
