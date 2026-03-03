/**
 * ULTRA-SIMPLE RETAIL ENGINE: ADA Signs (v1.5)
 * Secure Market-Value Math. Returns zeroed costs to protect margins.
 */

function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;

    // 1/8" Core = Base Reverse Rate ($0.80) | 1/16" Core = Base Front Rate ($0.60)
    let baseRate = inputs.structure === '1/8' 
        ? parseFloat(data.Retail_Price_Base_Reverse || 0.80) 
        : parseFloat(data.Retail_Price_Base_Front || 0.60);

    // Tactile is standard in this version
    let tactileRate = parseFloat(data.Retail_Adder_Tactile || 0.60);
    
    // Backer Adders
    let backerRate = 0;
    if (inputs.backer && inputs.backer.includes('PVC')) backerRate = parseFloat(data.Retail_Adder_PVC_Backer || 0.40);
    if (inputs.backer && inputs.backer.includes('Acrylic')) backerRate = parseFloat(data.Retail_Adder_Acr_Backer || 0.60);

    let unitPrint = (baseRate + tactileRate + backerRate) * sqin;
    
    // Braille is standard (1 line assumed for base calculations)
    unitPrint += parseFloat(data.Retail_Adder_Braille_Line || 10.00);

    let retailTotal = unitPrint * inputs.qty;

    const minOrder = (inputs.backer !== 'None') 
        ? parseFloat(data.Retail_Min_Order_CNC || 75.00) 
        : parseFloat(data.Retail_Min_Order_Etch || 50.00);

    const grandTotal = Math.max(retailTotal, minOrder);

    return {
        retail: { 
            unitPrice: grandTotal / inputs.qty, 
            printTotal: retailTotal, 
            grandTotal: grandTotal, 
            isMinApplied: retailTotal < minOrder 
        },
        cost: { total: 0 } // Security block
    };
}

