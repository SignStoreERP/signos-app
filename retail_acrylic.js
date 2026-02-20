// retail_acrylic.js - Market Pricing Engine (Acrylic Signs - Strictly Backend Driven)
function calculateRetail(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // 1. Base Rate & Print Mode Adders
    let baseRate = inputs.thickness === '187' ? parseFloat(data.Retail_Price_187_SqFt || 45) : parseFloat(data.Retail_Price_125_SqFt || 35);
    if (inputs.mode === '2nd_Std') baseRate += parseFloat(data.Retail_Adder_2ndSurf || 5);
    if (inputs.mode === '2nd_Block') baseRate += parseFloat(data.Retail_Adder_Blockout || 8);

    // 2. Volume Discounts
    let discPct = 0;
    let i = 1;
    const tierLog = [];
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tPct = parseFloat(data[`Tier_${i}_Disc`] || 0);
        if (inputs.qty >= tQty) discPct = tPct;
        const discountedUnit = baseRate * (1 - tPct);
        tierLog.push({ q: tQty, pct: tPct, unit: discountedUnit });
        i++;
    }

    const appliedUnit = baseRate * (1 - discPct);
    const retailPrint = appliedUnit * totalSqFt;

    // 3. Finishings & Hardware
    let retailPaint = 0;
    if (inputs.hasPaint) { 
        retailPaint = (totalSqFt * parseFloat(data.Retail_Adder_Paint_SqFt || 20)) + parseFloat(data.Retail_Fee_Paint_Setup || 65); 
    }

    let retailPMS = 0;
    if (inputs.hasPMS) { 
        retailPMS = parseFloat(data.Retail_Fee_Paint_Setup || 65); 
    }

    let retailContour = 0;
    if (inputs.isContour) {
        retailContour = retailPrint * parseFloat(data.Retail_Adder_Contour_Pct || 0.25);
    }

    let retailStandoff = 0;
    if (inputs.hasStandoffs) {
        retailStandoff = (inputs.standoffQty * inputs.qty * parseFloat(data.Retail_Price_Standoff || 8));
    }

    let feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    let feeSetup = parseFloat(data.Retail_Fee_Setup || 25);

    // 4. Shop Minimums
    const grandTotalRaw = retailPrint + retailPaint + retailPMS + retailContour + retailStandoff + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 75);
    const isMinApplied = grandTotalRaw < minOrder;
    const grandTotal = isMinApplied ? minOrder : grandTotalRaw;

    return {
        unitPrice: grandTotal / inputs.qty,
        printTotal: retailPrint,
        paintTotal: retailPaint,
        pmsTotal: retailPMS,
        contourTotal: retailContour,
        standoffTotal: retailStandoff,
        feeDesign: feeDesign,
        feeSetup: feeSetup,
        grandTotal: grandTotal,
        isMinApplied: isMinApplied,
        minOrderValue: minOrder,
        tiers: tierLog
    };
}
