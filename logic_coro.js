/**
 * ULTRA-SIMPLE RETAIL ENGINE: Custom Coroplast
 * Pure Area-Curve Lookup Math + No Setup or Design Fees
 */
function calculateCoro(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const thk = inputs.thickness;

    let baseRate = 0;
    let minSignPrice = 0;

    // 1. Fixed Area Curve Lookup
    if (thk === '4mm') {
        if (sqft <= (parseFloat(data.COR4_T1_Max) || 3.99)) {
            baseRate = parseFloat(data.COR4_T1_Rate) || 8.33;
            minSignPrice = parseFloat(data.COR4_T1_Min) || 25;
        } else if (sqft <= (parseFloat(data.COR4_T2_Max) || 15.99)) {
            baseRate = parseFloat(data.COR4_T2_Rate) || 7;
        } else if (sqft <= (parseFloat(data.COR4_T3_Max) || 31.99)) {
            baseRate = parseFloat(data.COR4_T3_Rate) || 6;
        } else {
            baseRate = parseFloat(data.COR4_T4_Rate) || 5;
        }
    } else {
        if (sqft <= (parseFloat(data.COR10_T1_Max) || 3.99)) {
            baseRate = parseFloat(data.COR10_T1_Rate) || 25;
            minSignPrice = parseFloat(data.COR10_T1_Min) || 75;
        } else if (sqft <= (parseFloat(data.COR10_T2_Max) || 15.99)) {
            baseRate = parseFloat(data.COR10_T2_Rate) || 21;
        } else if (sqft <= (parseFloat(data.COR10_T3_Max) || 31.99)) {
            baseRate = parseFloat(data.COR10_T3_Rate) || 18;
        } else {
            baseRate = parseFloat(data.COR10_T4_Rate) || 15;
        }
    }

    // Apply strict minimum per-sign price (prevents a 1x1 sign being $2)
    let unitPrint = baseRate * sqft;
    if (unitPrint < minSignPrice) unitPrint = minSignPrice;

    // 2. Double Sided Adder
    if (inputs.sides === 2) {
        const dsAdder = thk === '4mm' ? (parseFloat(data.Retail_Adder_DS_4mm) || 2.5) : (parseFloat(data.Retail_Adder_DS_10mm) || 5);
        unitPrint += (dsAdder * sqft);
    }

    // 3. Contour Cut Markup (e.g. 25% addition)
    if (inputs.shape === 'Contour') {
        unitPrint *= (1 + (parseFloat(data.Retail_Adder_Contour_Pct) || 0.25));
    }

    let retailPrint = unitPrint * inputs.qty;

    // 4. Volume Discount (10+ Qty Break)
    const t1Qty = parseFloat(data.Tier_1_Qty) || 10;
    if (inputs.qty >= t1Qty) {
        const discPct = parseFloat(data.Tier_1_Disc) || 0.05;
        retailPrint *= (1 - discPct);
    }

    // 5. Hardware (Stakes & Grommets)
    let stakeTotal = 0;
    if (inputs.stakes === 'Standard') stakeTotal = inputs.qty * (parseFloat(data.Retail_Stake_Std) || 2.5);
    if (inputs.stakes === 'HeavyDuty') stakeTotal = inputs.qty * (parseFloat(data.Retail_Stake_HD) || 4);

    let grommetTotal = 0;
    if (inputs.grommets > 0) {
        grommetTotal = inputs.grommets * inputs.qty * (parseFloat(data.Retail_Price_Grommet) || 0.25);
    }

    // 6. Shop Minimum Guard
    const minOrder = parseFloat(data.Retail_Min_Order) || 50;
    let grandTotalRaw = retailPrint + stakeTotal + grommetTotal;
    let grandTotal = Math.max(grandTotalRaw, minOrder);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            stakeTotal: stakeTotal,
            grommetTotal: grommetTotal,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder
        },
        cost: { total: 0 } 
    };
}
