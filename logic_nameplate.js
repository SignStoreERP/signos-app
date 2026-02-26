/**
 * PURE PHYSICS ENGINE: ADA Etch Nameplates (v1.0 - Sandbox)
 * Handles Front Engrave (Mattes) vs Reverse Engrave (Ultra-Mattes + Paint)
 */

function calculateNameplate(inputs, data) {
    // Math Basics
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    const baseRetailRate = parseFloat(data.Retail_Price_SqIn_Base || 0.50);
    const reverseAdderRate = parseFloat(data.Retail_Adder_Reverse_SqIn || 0.20);
    
    let unitPrint = baseRetailRate * sqin;
    
    if (inputs.style === 'Reverse') {
        unitPrint += (reverseAdderRate * sqin);
    }
    
    let retailPrint = unitPrint * inputs.qty;

    const minOrder = parseFloat(data.Retail_Min_Order || 35.00);
    const grandTotal = Math.max(retailPrint, minOrder);

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const wastePct = parseFloat(data.Waste_Factor || 1.20);
    
    // Substrate Cost (24x48 sheet = 1152 sq in)
    const costSheet = inputs.style === 'Reverse' 
        ? parseFloat(data.Cost_Sheet_Reverse || 85.00) 
        : parseFloat(data.Cost_Sheet_Standard || 65.00);
    
    const costSubstrate = (totalSqin / 1152) * costSheet * wastePct;

    // Labor Rates
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateEngraver = parseFloat(data.Rate_Machine_Engraver || 10);

    // Engraving Time & Labor
    const prepressMins = parseFloat(data.Time_Preflight_Job || 10);
    const loadMins = inputs.qty * parseFloat(data.Time_Engraver_Load_Per_Item || 2);
    const engraveMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.25);
    
    const costPrepress = (prepressMins / 60) * rateOp;
    const costLoad = (loadMins / 60) * rateOp;
    const costMachRun = (engraveMins / 60) * rateEngraver;

    // Paint Physics (Only applies if Reverse Engrave)
    let paintMatCost = 0;
    let costPaintLabor = 0;

    if (inputs.style === 'Reverse') {
        paintMatCost = totalSqin * parseFloat(data.Cost_Paint_SqIn || 0.01) * wastePct;
        
        const paintSetupMins = parseFloat(data.Time_Paint_Setup || 15);
        const paintRunMins = totalSqin * parseFloat(data.Time_Paint_SqIn || 0.10);
        
        costPaintLabor = ((paintSetupMins + paintRunMins) / 60) * rateShop;
    }

    const subTotal = costSubstrate + costPrepress + costLoad + costMachRun + paintMatCost + costPaintLabor;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            grandTotal: grandTotal,
            isMinApplied: retailPrint < minOrder
        },
        cost: {
            total: subTotal + riskBuffer,
            breakdown: {
                rawSubstrate: costSubstrate,
                rawPaint: paintMatCost,
                costPrepress: costPrepress,
                costHandling: costLoad,
                costMachine: costMachRun,
                costPaintLabor: costPaintLabor,
                runHrs: (engraveMins / 60),
                wastePct: (wastePct - 1) * 100,
                riskCost: riskBuffer
            }
        },
        metrics: { margin: (grandTotal - (subTotal + riskBuffer)) / grandTotal }
    };
}
