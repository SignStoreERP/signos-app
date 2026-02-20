// retail_coro.js - Market Pricing Engine (Custom Coro - Dynamic Curve Logic)
function calculateRetail(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const prefix = inputs.thickness === "4mm" ? "COR4" : "COR10";

    // 1. Dynamic Curve Logic (Reads directly from Master_Retail_Curves)
    let curveRate = 0; 
    let curveMin = 0; 
    let tierIndex = 1;
    
    while(data[`${prefix}_T${tierIndex}_Max`]) {
        const maxSqft = parseFloat(data[`${prefix}_T${tierIndex}_Max`]);
        if (sqft <= maxSqft) {
            curveRate = parseFloat(data[`${prefix}_T${tierIndex}_Rate`]);
            curveMin = parseFloat(data[`${prefix}_T${tierIndex}_Min`] || 0);
            break; 
        }
        tierIndex++;
    }

    // 2. Base Product Calculation
    let unitBase = Math.max(sqft * curveRate, curveMin);

    // 3. Double-Sided Adder (Flat SqFt Adder)
    if (inputs.sides === 2) {
        const dsAdder = inputs.thickness === "4mm" ? parseFloat(data.Retail_Adder_DS_4mm || 2.50) : parseFloat(data.Retail_Adder_DS_10mm || 5.00);
        unitBase += (sqft * dsAdder);
    }

    // 4. Volume Discounts (10+ = 5% Off)
    let discPct = 0; 
    let i = 1; 
    const tierLog = [];
    
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tPct = parseFloat(data[`Tier_${i}_Disc`] || 0);
        
        if (inputs.qty >= tQty) discPct = tPct;
        
        const discountedUnit = unitBase * (1 - tPct);
        tierLog.push({ q: tQty, pct: tPct, unit: discountedUnit });
        i++;
    }

    const appliedUnit = unitBase * (1 - discPct);
    const printTotal = appliedUnit * inputs.qty;

    // 5. Shop Minimums
    const grandTotalRaw = printTotal;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const isMinApplied = grandTotalRaw < minOrder;
    const grandTotal = isMinApplied ? minOrder : grandTotalRaw;

    return {
        unitPrice: grandTotal / inputs.qty,
        printTotal: printTotal,
        grandTotal: grandTotal,
        isMinApplied: isMinApplied,
        minOrderValue: minOrder,
        tiers: tierLog
    };
}
