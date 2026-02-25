/**
 * ULTRA-SIMPLE RETAIL ENGINE: Cut Vinyl Lettering
 * Pure SqFt Lookup (Material Only). Weeding & Masking do NOT add to price.
 */
function calculateCutVinyl(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    
    // 1. Material Base Rate Lookup (Hardcoded per Blue Sheet targets)
    let baseRate = 0;
    if (inputs.material === '651') baseRate = 8.00;
    else if (inputs.material === '751') baseRate = 10.00;
    else if (inputs.material === '951') baseRate = 12.00;
    else if (inputs.material === '8500') baseRate = 12.00;
    else if (inputs.material === '8800') baseRate = 15.00; // Kept proportional
    else if (inputs.material === 'Glass') baseRate = 15.00; // Kept proportional
    else if (inputs.material === 'Specialty') baseRate = 12.00; // Kept proportional

    let unitPrint = baseRate * sqft;
    let retailPrint = unitPrint * inputs.qty;

    // 2. Volume Discounts (Tiers 1 & 2)
    let discPct = 0;
    const t2Qty = parseFloat(data.Tier_2_Qty) || 50;
    const t1Qty = parseFloat(data.Tier_1_Qty) || 10;

    if (inputs.qty >= t2Qty) {
        discPct = parseFloat(data.Tier_2_Disc) || 0.10;
    } else if (inputs.qty >= t1Qty) {
        discPct = parseFloat(data.Tier_1_Disc) || 0.05;
    }

    retailPrint *= (1 - discPct);

    // 3. Shop Minimum Guard
    const minOrder = parseFloat(data.Retail_Min_Order) || 45;
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
