/**
 * ULTRA-SIMPLE RETAIL ENGINE: Vinyl Banners
 * Pure Area-Curve Lookup Math + Linear Finishing Adders
 */
function calculateBanner(inputs, data) {
    // "Round up to nearest whole number for sq ft" per Blue Sheet notes
    const sqft = Math.ceil((inputs.w * inputs.h) / 144); 
    const totalSqFt = sqft * inputs.qty;
    
    let baseRate = 0;
    let minSignPrice = 0;

    // 1. Material & Area Curve Lookup
    if (inputs.material === '13oz') {
        const is1ft = (inputs.w === 12 || inputs.h === 12);
        
        if (is1ft) {
            baseRate = parseFloat(data.BAN13_T1_Rate) || 6.5;
            minSignPrice = 25; 
        } else if (sqft <= (parseFloat(data.BAN13_T2_Max) || 9.99)) {
            baseRate = parseFloat(data.BAN13_T2_Rate) || 6;
            minSignPrice = 25; 
        } else {
            baseRate = parseFloat(data.BAN13_T3_Rate) || 5;
        }
    } else if (inputs.material === '15oz') {
        baseRate = parseFloat(data.Retail_Price_Base_15oz) || 6.5;
    } else if (inputs.material === '18oz') {
        baseRate = parseFloat(data.Retail_Price_Base_18oz) || 8;
    } else if (inputs.material === 'Mesh') {
        baseRate = parseFloat(data.Retail_Price_Base_Mesh) || 7;
    }

    let unitPrint = baseRate * sqft;
    if (unitPrint < minSignPrice) unitPrint = minSignPrice;

    // 2. Double Sided Adder
    if (inputs.sides === 2) {
        unitPrint += (parseFloat(data.Retail_Adder_DS_SqFt) || 3) * sqft;
    }

    let retailPrint = unitPrint * inputs.qty;

    // 3. Volume Discount (Tier 1 = 5+ Qty for Fleet Banners)
    const t1Qty = parseFloat(data.Tier_1_Qty) || 5;
    if (inputs.qty >= t1Qty) {
        retailPrint *= (1 - (parseFloat(data.Tier_1_Disc) || 0.05));
    }

    // 4. Finishing Adders (Linear Foot & SqFt Math)
    let finishingTotal = 0;

    // Pole Pockets (Assume long edge runs along the width)
    if (inputs.pockets === 'Top') {
        finishingTotal += (inputs.w / 12) * (parseFloat(data.Retail_Fin_PolePkt_LF) || 3) * inputs.qty;
    } else if (inputs.pockets === 'TopBottom') {
        finishingTotal += (inputs.w / 12) * 2 * (parseFloat(data.Retail_Fin_PolePkt_LF) || 3) * inputs.qty;
    }

    // Wind Slits
    if (inputs.windSlits === 'Yes') {
        finishingTotal += sqft * (parseFloat(data.Retail_Price_WindSlits_SqFt) || 1) * inputs.qty;
    }

    // 5. Shop Minimum Guard
    const minOrder = parseFloat(data.Retail_Min_Order) || 50;
    let grandTotalRaw = retailPrint + finishingTotal;
    let grandTotal = Math.max(grandTotalRaw, minOrder);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            finishingTotal: finishingTotal,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder
        },
        cost: { total: 0 } 
    };
}
