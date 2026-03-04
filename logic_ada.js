/**
 * ULTRA-SIMPLE RETAIL ENGINE: ADA Signs (v2.2)
 * Safely mapped with fallbacks to the PROD_Nameplates backend schema. Setup fee removed.
 */
function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;

    // 1. RETAIL ENGINE (MARKET VALUE)
    let baseRateSqIn = parseFloat(data.Retail_Price_Base_Front || data.Retail_Price_Mattes_116 || 0.55);
    
    if (inputs.coreThick === '1/8') {
        baseRateSqIn = parseFloat(data.Retail_Price_Base_Reverse || data.Retail_Price_Ultra_18 || 0.85);
    }
    
    let retailUnit = sqin * baseRateSqIn;
    
    if (inputs.hasTactile) retailUnit += (sqin * parseFloat(data.Retail_Adder_Tactile || 0.15));
    if (inputs.backer === 'Black PVC' || inputs.backer === 'White PVC') retailUnit += (sqin * parseFloat(data.Retail_Adder_PVC_Backer || 0.15));
    else if (inputs.backer === 'Clear Acrylic') retailUnit += (sqin * parseFloat(data.Retail_Adder_Acr_Backer || 0.25));

    let brailleFee = 0;
    if (inputs.hasBraille && inputs.brailleLines > 0) {
        brailleFee = inputs.brailleLines * parseFloat(data.Retail_Adder_Braille_Line || 10.00);
        retailUnit += brailleFee;
    }

    let subTotal = retailUnit * inputs.qty;

    // 2. MINIMUM ORDER GUARD
    let minOrder = parseFloat(data.Retail_Min_Order || 35);
    if (data.Retail_Min_Order_Etch) minOrder = parseFloat(data.Retail_Min_Order_Etch);
    let grandTotal = Math.max(subTotal, minOrder);

    return {
        retail: {
            unitPrice: retailUnit,
            grandTotal: grandTotal,
            isMinApplied: subTotal < minOrder
        },
        cost: { total: 0 }, // Stubbed out to keep the frontend headless and fast
        metrics: { margin: 0 }
    };
}
