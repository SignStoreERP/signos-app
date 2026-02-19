// retail_acm.js - Market Pricing Engine (ACM Signs)
function calculateRetail(inputs, data) {
    // 1. Determine Base Curve Rates
    const getCurve = (sqft, thick) => {
        // FIXED: The variable here must match the parameter 'thick'
        if (thick === "3mm") {
            if (sqft < 3) return { rate: 24.00, min: 25.00 };
            if (sqft < 6) return { rate: 18.00, min: 0 };
            if (sqft < 12) return { rate: 16.00, min: 0 };
            if (sqft < 32) return { rate: 15.00, min: 0 };
            return { rate: 14.00, min: 0 };
        } else {
            if (sqft < 3) return { rate: 35.33, min: 26.50 };
            if (sqft < 6) return { rate: 20.50, min: 0 };
            if (sqft < 12) return { rate: 18.50, min: 0 };
            if (sqft < 32) return { rate: 17.50, min: 0 };
            return { rate: 16.50, min: 0 };
        }
    };

    const sqft = (inputs.w * inputs.h) / 144;
    const curve = getCurve(sqft, inputs.thickness);
    
    // 2. Base Product Calculation
    let unitBase = Math.max(sqft * curve.rate, curve.min);

    // 3. Material & Print Multipliers
    if (inputs.sides === 2) unitBase *= (1 + parseFloat(data.Retail_Adder_DS_Mult || 0.5));
    
    // FIXED: Black ACM only doubles the price if it is 6mm
    if (inputs.color === 'Black' && inputs.thickness === '6mm') {
        unitBase *= parseFloat(data.Retail_Adder_Black_Mult || 2.0);
    }

    // 4. Volume Discounts (From Matrix)
    let discPct = 0;
    let i = 1;
    const tierLog = [];

    while(data[`Disc_T${i}_Qty`]) {
        const tQty = parseFloat(data[`Disc_T${i}_Qty`]);
        const tPct = parseFloat(data[`Disc_T${i}_Pct`] || 0);
        
        if (inputs.qty >= tQty) discPct = tPct;
        
        const discountedUnit = unitBase * (1 - tPct);
        tierLog.push({ q: tQty, pct: tPct, unit: discountedUnit });
        i++;
    }

    const appliedUnit = unitBase * (1 - discPct);
    const printTotal = appliedUnit * inputs.qty;

    // 5. Flat Fees (Router)
    let routerFee = 0;
    if (inputs.shape === 'Easy') routerFee = parseFloat(data.Retail_Fee_Router_Easy || 30.00);
    if (inputs.shape === 'Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard || 50.00);

    // 6. Shop Minimums
    const grandTotalRaw = printTotal + routerFee;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const isMinApplied = grandTotalRaw < minOrder;
    const grandTotal = isMinApplied ? minOrder : grandTotalRaw;

    return {
        unitPrice: grandTotal / inputs.qty,
        printTotal: printTotal,
        routerFee: routerFee,
        grandTotal: grandTotal,
        isMinApplied: isMinApplied,
        minOrderValue: minOrder,
        tiers: tierLog
    };
}
