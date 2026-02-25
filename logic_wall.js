/**
 * ULTRA-SIMPLE RETAIL ENGINE: Interior Wall Wraps
 * Dynamic Line Item Math + Installation Adders
 */
function calculateWall(inputs, data) {
    let totalSqFt = 0;
    
    // 1. Iterate through dynamic wall panels
    inputs.panels.forEach(p => {
        totalSqFt += (p.w * p.h) / 144;
    });
    
    // Multiply by the "Fleet" quantity (if they are ordering 3 identical sets of these walls)
    totalSqFt *= inputs.qty;

    // 2. Material Base Rate Lookup
    const baseRate = parseFloat(data.Retail_Price_Wall_SqFt) || 10.00;
    let retailPrint = baseRate * totalSqFt;

    // 3. Volume Discounts (Tiers 1 & 2 - Applied to Print Only)
    let discPct = 0;
    const t2Qty = parseFloat(data.Tier_2_Qty) || 5;
    const t1Qty = parseFloat(data.Tier_1_Qty) || 3;

    if (inputs.qty >= t2Qty) {
        discPct = parseFloat(data.Tier_2_Disc) || 0.10;
    } else if (inputs.qty >= t1Qty) {
        discPct = parseFloat(data.Tier_1_Disc) || 0.05;
    }
    retailPrint *= (1 - discPct);

    // 4. Installation Adder
    let retailInstall = 0;
    if (inputs.install === 'Yes') {
        const installRate = parseFloat(data.Retail_Install_Wall_SqFt) || 3.00;
        retailInstall = installRate * totalSqFt;
    }

    // 5. Shop Minimum Guard
    const minOrder = parseFloat(data.Retail_Min_Order) || 150;
    let grandTotalRaw = retailPrint + retailInstall;
    let grandTotal = Math.max(grandTotalRaw, minOrder);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            installTotal: retailInstall,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder
        },
        cost: { total: 0 } 
    };
}
