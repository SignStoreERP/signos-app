// retail_coro.js - Market Pricing Engine (Custom Coro - Strictly Backend Driven)
function calculateRetail(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const perimLF = ((inputs.w + inputs.h) * 2) / 12 * inputs.qty;
    const prefix = inputs.thickness === "4mm" ? "COR4" : "COR10";

    // 1. Dynamic Curve Logic
    let curveRate = 0; let curveMin = 0; let tierIndex = 1;
    while(data[`${prefix}_T${tierIndex}_Max`]) {
        const maxSqft = parseFloat(data[`${prefix}_T${tierIndex}_Max`]);
        if (sqft <= maxSqft) {
            curveRate = parseFloat(data[`${prefix}_T${tierIndex}_Rate`]);
            curveMin = parseFloat(data[`${prefix}_T${tierIndex}_Min`] || 0);
            break; 
        }
        tierIndex++;
    }

    // 2. Base & Sides
    let unitBase = Math.max(sqft * curveRate, curveMin);
    if (inputs.sides === 2) {
        const dsAdder = inputs.thickness === "4mm" ? parseFloat(data.Retail_Adder_DS_4mm || 2.50) : parseFloat(data.Retail_Adder_DS_10mm || 5.00);
        unitBase += (sqft * dsAdder);
    }

    // 3. Volume Discounts
    let discPct = 0; let i = 1; const tierLog = [];
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

    // 4. Hardware & Finishing Adders
    let stakesTotal = 0;
    if (inputs.stakeType === 'Std') stakesTotal = inputs.qty * parseFloat(data.Retail_Stake_Std || 2.50);
    if (inputs.stakeType === 'HD') stakesTotal = inputs.qty * parseFloat(data.Retail_Stake_HD || 4.00);

    let gromTotal = 0; let gromCount = 0;
    if (inputs.gromMode !== 'None') {
        if (inputs.gromMode === 'Corners') gromCount = 4 * inputs.qty;
        else if (inputs.gromMode === '24in') gromCount = Math.ceil(perimLF / 2);
        else if (inputs.gromMode === '12in') gromCount = Math.ceil(perimLF);
        if (gromCount < 4 * inputs.qty) gromCount = 4 * inputs.qty; // Minimum 4 per sign
        gromTotal = gromCount * parseFloat(data.Retail_Price_Grommet || 0.25);
    }

    let contourTotal = 0;
    if (inputs.isContour) contourTotal = printTotal * parseFloat(data.Retail_Adder_Contour_Pct || 0.25);

    let glossTotal = 0;
    if (inputs.isGloss) glossTotal = inputs.qty * parseFloat(data.Retail_Price_Gloss || 8.00);

    let feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    let feeSetup = parseFloat(data.Retail_Fee_Setup || 15);

    // 5. Min Order
    const grandTotalRaw = printTotal + stakesTotal + gromTotal + contourTotal + glossTotal + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const isMinApplied = grandTotalRaw < minOrder;
    const grandTotal = isMinApplied ? minOrder : grandTotalRaw;

    return {
        unitPrice: grandTotal / inputs.qty,
        printTotal, stakesTotal, gromTotal, contourTotal, glossTotal, feeDesign, feeSetup,
        grandTotal, isMinApplied, minOrderValue: minOrder, tiers: tierLog, gromCount
    };
}
