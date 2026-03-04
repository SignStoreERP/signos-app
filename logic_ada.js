/**
 * MACRO RETAIL ENGINE: ADA Signs (v4.0)
 * Uses predefined sign types to determine sqin rate based on size thresholds.
 * Absorbs Braille, Tactile, and Tape into the single square inch rate.
 */
function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const threshold = parseFloat(data.ADA_SqIn_Break || 36);
    const isLarge = sqin >= threshold;

    // 1. RETAIL ENGINE (MACRO PRICING)
    let baseRateSqIn = 0;
    
    if (inputs.signType === 'Standard') {
        baseRateSqIn = isLarge ? parseFloat(data.ADA_TypeA_Large || 1.80) : parseFloat(data.ADA_TypeA_Small || 2.10);
    } else if (inputs.signType === 'Layered_PVC') {
        baseRateSqIn = isLarge ? parseFloat(data.ADA_TypeB1_Large || 1.95) : parseFloat(data.ADA_TypeB1_Small || 2.25);
    } else if (inputs.signType === 'Layered_Acrylic') {
        baseRateSqIn = isLarge ? parseFloat(data.ADA_TypeB2_Large || 2.20) : parseFloat(data.ADA_TypeB2_Small || 2.50);
    } else {
        baseRateSqIn = 1.80; // Safety Fallback
    }

    let retailUnit = sqin * baseRateSqIn;
    let subTotal = retailUnit * inputs.qty;
    
    // Add file setup fee
    subTotal += parseFloat(data.Retail_Fee_Setup || 15);

    // 2. MINIMUM ORDER GUARD
    let minOrder = parseFloat(data.Retail_Min_Order || 50);
    let grandTotal = Math.max(subTotal, minOrder);

    return {
        retail: {
            unitPrice: retailUnit,
            grandTotal: grandTotal,
            isMinApplied: subTotal < minOrder
        },
        cost: { total: 0 }, 
        metrics: { margin: 0 }
    };
}
