/**
 * ULTRA-SIMPLE RETAIL ENGINE: Acrylic Signs
 * Bypasses all physics/costs. Strictly uses fixed Retail Tiers from the Google Sheet.
 */
function calculateAcrylic(inputs, data) {
    // 1. Calculate Square Footage
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    let baseSqFtRate = 0;

    // 2. Apply Fixed Pricing Tiers based strictly on Backend Variables
    if (inputs.thickness.includes('1/4')) {
        if (totalSqFt <= (parseFloat(data.ACR_14_T1_Max) || 0)) {
            baseSqFtRate = parseFloat(data.ACR_14_T1_Rate) || 0;
        } else if (totalSqFt <= (parseFloat(data.ACR_14_T2_Max) || 0)) {
            baseSqFtRate = parseFloat(data.ACR_14_T2_Rate) || 0;
        } else {
            baseSqFtRate = parseFloat(data.ACR_14_T3_Rate) || 0;
        }
    } 
    else if (inputs.thickness.includes('1/2')) {
        if (totalSqFt <= (parseFloat(data.ACR_12_T1_Max) || 0)) {
            baseSqFtRate = parseFloat(data.ACR_12_T1_Rate) || 0;
        } else {
            baseSqFtRate = parseFloat(data.ACR_12_T2_Rate) || 0;
        }
    } 
    else if (inputs.thickness.includes('3/4')) {
        if (totalSqFt <= (parseFloat(data.ACR_34_T1_Max) || 0)) {
            baseSqFtRate = parseFloat(data.ACR_34_T1_Rate) || 0;
        } else {
            baseSqFtRate = parseFloat(data.ACR_34_T2_Rate) || 0;
        }
    } 
    else if (inputs.thickness.includes('1')) {
        if (totalSqFt <= (parseFloat(data.ACR_1IN_T1_Max) || 0)) {
            baseSqFtRate = parseFloat(data.ACR_1IN_T1_Rate) || 0;
        } else {
            baseSqFtRate = parseFloat(data.ACR_1IN_T2_Rate) || 0;
        }
    }

    // 3. Calculate Retail
    const retailPrint = baseSqFtRate * totalSqFt;
    const setupFee = parseFloat(data.Retail_Fee_Setup) || 0;
    const minOrder = parseFloat(data.Retail_Min_Order) || 0;
    
    let grandTotal = retailPrint + setupFee;
    grandTotal = Math.max(grandTotal, minOrder);

    // 4. Return Output to HTML
    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            setupFee: setupFee,
            grandTotal: grandTotal,
            isMinApplied: (retailPrint + setupFee) < minOrder
        },
        cost: { total: 0 } // Cost Engine Disabled for Simplicity
    };
}
