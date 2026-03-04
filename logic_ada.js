/**
 * ULTRA-SIMPLE RETAIL ENGINE: ADA Signs (v2.1)
 * Safely mapped with fallbacks to the PROD_Nameplates backend schema.
 */
function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;

    // 1. RETAIL ENGINE (MARKET VALUE)
    // Uses Nameplate variables as the fallback base if ADA keys are missing
    let baseRateSqIn = parseFloat(data.Retail_Price_Base_Front || data.Retail_Price_Mattes_116 || 0.55);
    
    if (inputs.coreThick === '1/8') {
        baseRateSqIn = parseFloat(data.Retail_Price_Base_Reverse || data.Retail_Price_Ultra_18 || 0.85);
    }

    let retailUnit = sqin * baseRateSqIn;

    // Tactile & Hardware Adders
    if (inputs.hasTactile) retailUnit += (sqin * parseFloat(data.Retail_Adder_Tactile || 0.40));
    
    if (inputs.backer === 'Black PVC' || inputs.backer === 'White PVC') {
        retailUnit += (sqin * parseFloat(data.Retail_Adder_PVC_Backer || 0.15));
    } else if (inputs.backer === 'Clear Acrylic') {
        retailUnit += (sqin * parseFloat(data.Retail_Adder_Acr_Backer || 0.25));
    }

    // Braille Adder
    if (inputs.hasBraille && inputs.brailleLines > 0) {
        retailUnit += (inputs.brailleLines * parseFloat(data.Retail_Adder_Braille_Line || 10.00));
    }

    let subTotal = retailUnit * inputs.qty;
    subTotal += parseFloat(data.Retail_Fee_Setup || 15);

    // Min Order Fallbacks (CNC vs Etch vs Nameplates Global)
    let minOrder = parseFloat(data.Retail_Min_Order || 50);
    if (inputs.backer !== 'None' && data.Retail_Min_Order_CNC) {
        minOrder = parseFloat(data.Retail_Min_Order_CNC);
    } else if (data.Retail_Min_Order_Etch) {
        minOrder = parseFloat(data.Retail_Min_Order_Etch);
    }

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
