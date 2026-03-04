/**
 * PURE PHYSICS ENGINE: ADA Signs (v2.0)
 * Safely mapped to the PROD_Nameplates backend schema.
 */
function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;

    // 1. RETAIL ENGINE (MARKET VALUE)
    // Uses Nameplate variables as the base
    let baseRateSqIn = parseFloat(data.Retail_Price_Mattes_116 || 0.55);
    if (inputs.coreThick === '1/8') baseRateSqIn = parseFloat(data.Retail_Price_Ultra_18 || 0.85);

    let retailUnit = sqin * baseRateSqIn;

    // Tactile & Hardware Adders
    if (inputs.hasTactile) retailUnit += (sqin * 0.40); // Tactile & Braille
    if (inputs.backer === 'Black PVC' || inputs.backer === 'White PVC') retailUnit += (sqin * 0.15);
    else if (inputs.backer === 'Clear Acrylic') retailUnit += (sqin * 0.25);

    let subTotal = retailUnit * inputs.qty;
    subTotal += parseFloat(data.Retail_Fee_Setup || 15);

    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    let grandTotal = Math.max(subTotal, minOrder);

    return {
        retail: {
            unitPrice: retailUnit,
            grandTotal: grandTotal,
            isMinApplied: subTotal < minOrder
        }
    };
}
