/**
 * ULTRA-SIMPLE RETAIL ENGINE: Vehicle Wraps
 * Dynamic Line Items + Perf "Included" Math + Installation
 */
function calculateWrap(inputs, data) {
    const retWrap = parseFloat(data.Retail_Price_Vehicle_SqFt) || 15.00;
    const retPerf = parseFloat(data.Retail_Price_Perf_SqFt) || 12.00;
    const retInstall = parseFloat(data.Retail_Install_Vehicle_SqFt) || 5.00;

    let totalRetailPrint = 0;
    let totalInstallSqFt = 0;
    let displaySqFt = 0;

    // 1. Iterate through dynamic vehicle panels
    inputs.panels.forEach(p => {
        const sqft = (p.w * p.h) / 144;
        const area = sqft * inputs.qty;
        displaySqFt += area;

        let retailUnit = 0;
        
        if (p.material === 'perf') {
            // If Perf is included in the main wrap, charge $0 for print & $0 for install
            retailUnit = p.included ? 0 : retPerf;
            if (!p.included) totalInstallSqFt += area;
        } else {
            retailUnit = retWrap;
            totalInstallSqFt += area;
        }

        totalRetailPrint += (retailUnit * area);
    });

    // 2. Volume Discounts (Tiers 1 & 2 - Applied to Print Only)
    let discPct = 0;
    const t2Qty = parseFloat(data.Tier_2_Qty) || 5;
    const t1Qty = parseFloat(data.Tier_1_Qty) || 3;

    if (inputs.qty >= t2Qty) {
        discPct = parseFloat(data.Tier_2_Disc) || 0.10;
    } else if (inputs.qty >= t1Qty) {
        discPct = parseFloat(data.Tier_1_Disc) || 0.05;
    }

    let appliedPrintRetail = totalRetailPrint * (1 - discPct);

    // 3. Installation Adder
    let retailInstall = 0;
    if (inputs.install === 'Yes') {
        retailInstall = totalInstallSqFt * retInstall;
    }

    // 4. Shop Minimum Guard
    const minOrder = parseFloat(data.Retail_Min_Order) || 150;
    let grandTotalRaw = appliedPrintRetail + retailInstall;
    let grandTotal = Math.max(grandTotalRaw, minOrder);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: appliedPrintRetail,
            installTotal: retailInstall,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            displaySqFt: displaySqFt
        },
        cost: { total: 0 } 
    };
}
