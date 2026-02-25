/**
 * ULTRA-SIMPLE RETAIL ENGINE: Decals & Stickers
 * Pure SqFt Lookup + Finishing Adders
 */
function calculateDecal(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    
    // 1. Material Base Rate Lookup
    let baseRate = 0;
    if (inputs.material === 'Cast') {
        baseRate = parseFloat(data.Retail_Price_Cast_SqFt) || 14.00;
    } else {
        baseRate = parseFloat(data.Retail_Price_Cal_SqFt) || 8.00;
    }

    let unitPrint = baseRate * sqft;

    // 2. Contour Cut Markup (+25% of Base Print)
    if (inputs.shape === 'Contour') {
        unitPrint *= (1 + (parseFloat(data.Retail_Cut_Contour_Add) || 0.25));
    }

    // 3. Weeding & Masking Adders (Flat rate per SqFt)
    if (inputs.weeding === 'Complex') {
        unitPrint += (parseFloat(data.Retail_Weed_Complex) || 2.50) * sqft;
    }
    
    if (inputs.masking === 'Yes') {
        unitPrint += (parseFloat(data.Retail_Adder_Mask_SqFt) || 1.00) * sqft;
    }

    let retailPrint = unitPrint * inputs.qty;

    // 4. Volume Discounts (Tiers 1, 2, 3)
    let discPct = 0;
    const t3Qty = parseFloat(data.Tier_3_Qty) || 500;
    const t2Qty = parseFloat(data.Tier_2_Qty) || 100;
    const t1Qty = parseFloat(data.Tier_1_Qty) || 50;

    if (inputs.qty >= t3Qty) {
        discPct = parseFloat(data.Tier_3_Disc) || 0.20;
    } else if (inputs.qty >= t2Qty) {
        discPct = parseFloat(data.Tier_2_Disc) || 0.10;
    } else if (inputs.qty >= t1Qty) {
        discPct = parseFloat(data.Tier_1_Disc) || 0.05;
    }

    retailPrint *= (1 - discPct);

    // 5. Shop Minimum Guard
    const minOrder = parseFloat(data.Retail_Min_Order) || 35;
    let grandTotal = Math.max(retailPrint, minOrder);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            grandTotal: grandTotal,
            isMinApplied: retailPrint < minOrder
        },
        cost: { total: 0 } 
    };
}
