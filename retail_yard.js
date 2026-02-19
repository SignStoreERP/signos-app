// retail_yard.js - Market Pricing Engine (Matrix Discount Aligned)
function calculateRetail(inputs, data) {
    // 1. Fetch Market Baseline
    const baseSS = parseFloat(data.Retail_Price_Sign_SS || 25.00); 
    const adderDS = parseFloat(data.Retail_Price_Sign_DS || 2.50);
    
    // 2. Dynamic Stake Tier Logic (Product Specific)
    let stakePrice = parseFloat(data.Retail_Stake_T1_Price || 2.00);
    if (data.Retail_Stake_T2_Qty && inputs.qty >= parseFloat(data.Retail_Stake_T2_Qty)) stakePrice = parseFloat(data.Retail_Stake_T2_Price || 1.75);
    if (data.Retail_Stake_T3_Qty && inputs.qty >= parseFloat(data.Retail_Stake_T3_Qty)) stakePrice = parseFloat(data.Retail_Stake_T3_Price || 1.50);

    // 3. Centralized Volume Tiers (From Matrix)
    let discPct = 0;
    let i = 1;
    const tierLog = [];
    const basePrintUnit = baseSS + (inputs.sides === 2 ? adderDS : 0);

    while(data[`Disc_T${i}_Qty`]) {
        const tQty = parseFloat(data[`Disc_T${i}_Qty`]);
        const tPct = parseFloat(data[`Disc_T${i}_Pct`] || 0);
        
        if (inputs.qty >= tQty) discPct = tPct;
        
        // Calculate the row unit for the UI display table
        const discountedPrint = basePrintUnit * (1 - tPct);
        const rowUnit = discountedPrint + (inputs.hasStakes ? stakePrice : 0);
        tierLog.push({ q: tQty, pct: tPct, unit: rowUnit });
        i++;
    }

    // 4. Line Item Totals
    const unitPrint = basePrintUnit * (1 - discPct);
    const totalPrint = unitPrint * inputs.qty;
    const totalStake = (inputs.hasStakes ? stakePrice : 0) * inputs.qty;
    const grandTotalRaw = totalPrint + totalStake;

    // 5. Shop Minimum Check
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const isMinApplied = grandTotalRaw < minOrder;
    const grandTotal = isMinApplied ? minOrder : grandTotalRaw;

    return {
        unitPrice: grandTotal / inputs.qty,
        printTotal: totalPrint,
        stakeTotal: totalStake,
        grandTotal: grandTotal,
        isMinApplied: isMinApplied,
        minOrderValue: minOrder,
        tiers: tierLog
    };
}
