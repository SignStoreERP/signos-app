/**
 * ULTRA-SIMPLE RETAIL ENGINE: Cut Vinyl Lettering
 * Full Material Support. Weeding complexity does NOT add to retail price.
 */
function calculateCutVinyl(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    
    // 1. Material Base Rate Lookup
    let baseRate = 0;
    if (inputs.material === '651') baseRate = parseFloat(data.Retail_Price_Intermediate) || 12.00;
    else if (inputs.material === '751') baseRate = parseFloat(data.Retail_Price_751) || 18.00;
    else if (inputs.material === '951') baseRate = parseFloat(data.Retail_Price_951) || 22.00;
    else if (inputs.material === '8500') baseRate = parseFloat(data.Retail_Price_8500) || 20.00;
    else if (inputs.material === '8800') baseRate = parseFloat(data.Retail_Price_8800) || 25.00;
    else if (inputs.material === 'Glass') baseRate = parseFloat(data.Retail_Price_Glass) || 25.00;
    else if (inputs.material === 'Specialty') baseRate = parseFloat(data.Retail_Price_Specialty) || 16.00;
    else baseRate = parseFloat(data.Retail_Price_751) || 18.00; // Default

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

    // 3. Shop Minimum Guard (Weeding adds $0 to retail)
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
