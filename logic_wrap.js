/**
 * ULTRA-SIMPLE RETAIL ENGINE: Vehicle Wraps
 * Supports Cast Wrap and Window Perf. Zero Setup Fees.
 */
function calculateWrap(inputs, data) {
    const retWrap = parseFloat(data.Retail_Price_Vehicle_SqFt) || 15.00;
    const retPerf = parseFloat(data.Retail_Price_Perf_SqFt) || 12.00;
    
    // Install Base & Complexity Multiplier
    const baseInstall = parseFloat(data.Retail_Price_Install_Simple) || 5.00;
    const retInstall = inputs.complexity === 'complex' ? (baseInstall * (parseFloat(data.Retail_Mult_Complex) || 2.5)) : baseInstall;

    let totalRetailPrint = 0;
    let totalInstallSqFt = 0;
    let displaySqFt = 0;

    inputs.panels.forEach(p => {
        const sqft = (p.w * p.h) / 144;
        const area = sqft * inputs.qty;
        displaySqFt += area;
        
        if (p.material.startsWith('perf')) {
            if (!p.included) {
                totalRetailPrint += (retPerf * area);
                totalInstallSqFt += area;
            }
        } else {
            totalRetailPrint += (retWrap * area);
            totalInstallSqFt += area;
        }
    });

    let discPct = 0;
    if (inputs.qty >= (parseFloat(data.Tier_2_Qty) || 5)) discPct = parseFloat(data.Tier_2_Disc) || 0.10;
    else if (inputs.qty >= (parseFloat(data.Tier_1_Qty) || 3)) discPct = parseFloat(data.Tier_1_Disc) || 0.05;

    let appliedPrintRetail = totalRetailPrint * (1 - discPct);
    let retailInstall = inputs.install === 'Yes' ? (totalInstallSqFt * retInstall) : 0;
    
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

