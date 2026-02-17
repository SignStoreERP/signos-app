/**
 * PURE PHYSICS ENGINE: Yard Signs
 * Decoupled from HTML. Used by Calculator AND Simulator.
 * 
 * @param {Object} inputs - { qty, sides, files, hasStakes, incDesign, setupPerFile }
 * @param {Object} data - The JSON object returned from SignOS Backend
 */
function calculateYardSign(inputs, data) {
    
    // --- 1. RETAIL ENGINE ---
    const baseSS = parseFloat(data.Retail_Price_Sign_SS || 15.00);
    const adderDS = parseFloat(data.Retail_Price_Sign_DS || 3.00);
    const stakePrice = parseFloat(data.Retail_Price_Stake || 2.50);
    
    // Tier Logic
    let appliedBase = baseSS;
    let i = 1;
    const tierLog = []; // For the discount table
    
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tPrice = parseFloat(data[`Tier_${i}_Price`] || 0);
        
        if (inputs.qty >= tQty) appliedBase = tPrice;
        
        // Log for UI Table
        tierLog.push({ q: tQty, p: tPrice, total: tPrice + (inputs.sides===2?adderDS:0) + (inputs.hasStakes?stakePrice:0) });
        i++;
    }

    // Custom Quote Trigger
    const isCustom = (appliedBase === 0);

    // Unit Calculation
    let unitPrice = appliedBase;
    if (inputs.sides === 2) unitPrice += adderDS;
    if (inputs.hasStakes) unitPrice += stakePrice;

    // Fees
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15.00);
    const feeDesignBase = parseFloat(data.Retail_Fee_Design || 45.00);
    
    const totalSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;
    const totalDesign = inputs.incDesign ? (feeDesignBase * inputs.files) : 0;
    
    const productTotal = unitPrice * inputs.qty;
    let grandTotal = productTotal + totalSetup + totalDesign;

    // Min Order
    const minOrder = parseFloat(data.Retail_Min_Order || 75);
    const isMinApplied = grandTotal < minOrder;
    if (isMinApplied) grandTotal = minOrder;

    // --- 2. COST ENGINE (IN-HOUSE) ---
    const bulkTrigger = parseFloat(data.Bulk_Qty_Trigger || 1100);
    let blankCost = parseFloat(data.Cost_Blank_Standard || 0.91);
    if (inputs.qty >= bulkTrigger) blankCost = parseFloat(data.Cost_Blank_Bulk || 0.79);

    const waste = parseFloat(data.Waste_Factor || 1.05);
    const totalMat = (blankCost * waste) * inputs.qty;
    
    // Ink
    const areaSqFt = (24*18)/144;
    const totalArea = areaSqFt * inputs.sides * inputs.qty;
    const totalInk = totalArea * parseFloat(data.Cost_Ink_Base || 0.16);
    
    // Stakes
    const costStakeUnit = inputs.hasStakes ? parseFloat(data.Cost_Stake || 0.93) : 0;
    const totalStake = costStakeUnit * inputs.qty;

    // Production Time
    const bedCap = parseFloat(data.Printer_Bed_Capacity || 3);
    const speed = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const lfPerSet = 2.0; // 24" high / 12
    const totalRunHrs = ((lfPerSet / bedCap / speed) * inputs.sides) * inputs.qty;
    
    const costMachine = totalRunHrs * parseFloat(data.Rate_Machine || 45);
    const costOp = totalRunHrs * parseFloat(data.Rate_Operator || 25);
    
    const setupHrs = (parseFloat(data.Time_Setup_Base||15) + (parseFloat(data.Time_Setup_Adder||2) * inputs.files)) / 60;
    const costSetup = setupHrs * parseFloat(data.Rate_Operator || 25);

    const totalCost = totalMat + totalInk + totalStake + costMachine + costOp + costSetup;

    // Return Pure Data Object
    return {
        retail: {
            unitPrice: unitPrice,
            productTotal: productTotal,
            setupFee: totalSetup,
            designFee: totalDesign,
            grandTotal: grandTotal,
            isCustom: isCustom,
            isMinApplied: isMinApplied,
            tiers: tierLog
        },
        cost: {
            total: totalCost,
            material: totalMat,
            ink: totalInk,
            stake: totalStake,
            labor: costOp + costSetup,
            machine: costMachine
        },
        metrics: {
            margin: (grandTotal - totalCost) / grandTotal
        }
    };
}
