/**
 * ULTRA-SIMPLE RETAIL ENGINE: Cut Vinyl Lettering
 * Pure SqFt Lookup + Weeding Adders
 */
function calculateCutVinyl(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    
    // 1. Material Base Rate Lookup
    let baseRate = 0;
    if (inputs.material === '651') baseRate = parseFloat(data.Retail_Price_Intermediate || data.Retail_Price_651_SqFt) || 12.00;
    else if (inputs.material === '751') baseRate = parseFloat(data.Retail_Price_751 || data.Retail_Price_751_SqFt) || 18.00;
    else if (inputs.material === '951') baseRate = parseFloat(data.Retail_Price_951) || 22.00;
    else if (inputs.material === '8500') baseRate = parseFloat(data.Retail_Price_8500) || 20.00;
    else if (inputs.material === '8800') baseRate = parseFloat(data.Retail_Price_8800) || 25.00;
    else if (inputs.material === 'Glass') baseRate = parseFloat(data.Retail_Price_Glass) || 25.00;
    else if (inputs.material === 'Specialty') baseRate = parseFloat(data.Retail_Price_Specialty) || 16.00;

    let unitPrint = baseRate * sqft;

    // 2. Weeding Adder (Flat rate per SqFt)
    if (inputs.weeding === 'Complex') {
        unitPrint += (parseFloat(data.Retail_Weed_Complex_Add) || 5.00) * sqft;
    }

    let retailPrint = unitPrint * inputs.qty;

    // 3. Volume Discounts (Tiers 1 & 2)
    let discPct = 0;
    const t2Qty = parseFloat(data.Tier_2_Qty) || 50;
    const t1Qty = parseFloat(data.Tier_1_Qty) || 10;

    if (inputs.qty >= t2Qty) {
        discPct = parseFloat(data.Tier_2_Disc) || 0.10;
    } else if (inputs.qty >= t1Qty) {
        discPct = parseFloat(data.Tier_1_Disc) || 0.05;
    }

    retailPrint *= (1 - discPct);

    // 4. Shop Minimum Guard
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
