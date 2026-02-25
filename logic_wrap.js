/**
 * ULTRA-SIMPLE RETAIL ENGINE: Vehicle Wraps
 * Pure SqFt Lookup + Installation Adders
 */
function calculateWrap(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // 1. Material Base Rate Lookup
    const baseRate = parseFloat(data.Retail_Price_Vehicle_SqFt) || 15.00;
    let retailPrint = baseRate * totalSqFt;

    // 2. Volume Discounts (Tiers 1 & 2 - Applied to Print Only)
    let discPct = 0;
    const t2Qty = parseFloat(data.Tier_2_Qty) || 5;
    const t1Qty = parseFloat(data.Tier_1_Qty) || 3;

    if (inputs.qty >= t2Qty) {
        discPct = parseFloat(data.Tier_2_Disc) || 0.10;
    } else if (inputs.qty >= t1Qty) {
        discPct = parseFloat(data.Tier_1_Disc) || 0.05;
    }

    retailPrint *= (1 - discPct);

    // 3. Installation Adder
    let retailInstall = 0;
    if (inputs.install === 'Yes') {
        const installRate = parseFloat(data.Retail_Install_Vehicle_SqFt) || 5.00;
        retailInstall = installRate * totalSqFt;
    }

    // 4. Shop Minimum Guard
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
