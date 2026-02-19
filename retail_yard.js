// retail_yard.js - Market Pricing Engine
function calculateRetail(inputs, data) {
    // 1. Fetch Market Baseline (Blue Sheet)
    const baseSS = parseFloat(data.Retail_Price_Sign_SS || 25.00); 
    const adderDS = parseFloat(data.Retail_Price_Sign_DS || 2.50);
    const stakePrice = parseFloat(data.Retail_Price_Stake || 2.00);

    // 2. Volume Tier Logic (Smoothed Curve)
    let appliedBase = baseSS;
    let i = 1;
    const tierLog = [];

    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tPrice = parseFloat(data[`Tier_${i}_Price`] || 0);
        
        if (inputs.qty >= tQty) appliedBase = tPrice;
        
        // Calculate the actual unit price for the UI table
        const rowUnit = tPrice + (inputs.sides === 2 ? adderDS : 0) + (inputs.hasStakes ? stakePrice : 0);
        tierLog.push({ q: tQty, base: tPrice, unit: rowUnit });
        i++;
    }

    const isCustom = (appliedBase === 0); // E.g., Qty 1000+

    // 3. Line Item Totals
    const unitPrint = appliedBase + (inputs.sides === 2 ? adderDS : 0);
    const totalPrint = unitPrint * inputs.qty;
    const totalStake = (inputs.hasStakes ? stakePrice : 0) * inputs.qty;

    // 4. Fees & Minimums
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15.00);
    const feeDesignBase = parseFloat(data.Retail_Fee_Design || 30.00);
    const totalSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;
    const totalDesign = inputs.incDesign ? (feeDesignBase * inputs.files) : 0;

    const grandTotalRaw = totalPrint + totalStake + totalSetup + totalDesign;
    const minOrder = parseFloat(data.Retail_Min_Order || 75);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    return {
        unitPrice: (totalPrint + totalStake) / inputs.qty,
        printTotal: totalPrint,
        stakeTotal: totalStake,
        setupFee: totalSetup,
        designFee: totalDesign,
        grandTotal: grandTotal,
        isCustom: isCustom,
        isMinApplied: grandTotalRaw < minOrder,
        tiers: tierLog
    };
}
