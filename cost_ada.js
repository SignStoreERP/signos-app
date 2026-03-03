/**
 * PURE PHYSICS ENGINE: ADA & Multi-Layer Signs (v1.3)
 * Support for Visual-Only Directional Signs (Tactile Toggle Restored)
 */

function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    let baseRate = inputs.coreThick === '1/8' 
        ? parseFloat(data.Retail_Price_Base_Reverse || 0.80) 
        : parseFloat(data.Retail_Price_Base_Front || 0.60);

    let tactileRate = inputs.hasTactile ? parseFloat(data.Retail_Adder_Tactile || 0.60) : 0;
    
    let backerRate = 0;
    if (inputs.backer === 'PVC') backerRate = parseFloat(data.Retail_Adder_PVC_Backer || 0.40);
    if (inputs.backer === 'Acrylic') backerRate = parseFloat(data.Retail_Adder_Acr_Backer || 0.60);

    let unitPrint = (baseRate + tactileRate + backerRate) * sqin;
    
    const brailleLines = parseInt(inputs.brailleLines || 1);
    if (inputs.hasBraille && brailleLines > 0) {
        unitPrint += brailleLines * parseFloat(data.Retail_Adder_Braille_Line || 10.00);
    }

    let retailTotal = unitPrint * inputs.qty;
    const minOrder = inputs.backer !== 'None' ? parseFloat(data.Retail_Min_Order_CNC || 75.00) : parseFloat(data.Retail_Min_Order_Etch || 50.00);
    const grandTotal = Math.max(retailTotal, minOrder);

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const sheetArea2x4 = 1152; 
    const sheetArea4x8 = 4608; 

    let coreSheetCost = parseFloat(data.Cost_Sub_ADA_Core_18 || 70.00);
    if (inputs.coreThick === '1/16 Color') coreSheetCost = parseFloat(data.Cost_Sub_ADA_Core_116 || 50.00);
    if (inputs.coreThick === '1/16 Clear') coreSheetCost = parseFloat(data.Cost_Sub_ADA_Lens_116 || 45.00);

    const costCore = (coreSheetCost / sheetArea2x4) * totalSqin * wastePct;
    const costTactile = inputs.hasTactile ? ((parseFloat(data.Cost_Sub_Tactile || 85.25) / sheetArea2x4) * totalSqin * wastePct) : 0;
    
    let costBacker = 0;
    if (inputs.backer === 'PVC') costBacker = (parseFloat(data.Cost_Sub_PVC || 33.00) / sheetArea4x8) * totalSqin * wastePct;
    if (inputs.backer === 'Acrylic') costBacker = (parseFloat(data.Cost_Sub_Acrylic || 99.00) / sheetArea4x8) * totalSqin * wastePct;

    let tapeLayers = 0;
    if (inputs.backer !== 'None') tapeLayers++; 
    if (inputs.mounting === 'Foam Tape') tapeLayers++;

    const tapeLF = (totalSqin / 12) * tapeLayers;
    const costTape = tapeLF * parseFloat(data.Cost_Hem_Tape || 0.08) * wastePct;
    const costBraille = inputs.hasBraille ? (brailleLines * inputs.qty * parseFloat(data.Cost_Braille_Line_Fallback || 1.00)) : 0;
    const totalMats = costCore + costTactile + costBacker + costTape + costBraille;

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateCNC = parseFloat(data.Rate_CNC_Labor || 25);
    const rateMachEngrave = parseFloat(data.Rate_Machine_Engraver || 10);
    const rateMachCNC = parseFloat(data.Rate_Machine_CNC || 10);

    const engraveMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.31);
    const engraveSetupMins = parseFloat(data.Time_Preflight_Job || 15) + (inputs.qty * parseFloat(data.Time_Engraver_Load_Per_Item || 1));
    const costEngraveMach = (engraveMins / 60) * rateMachEngrave;
    const costEngraveOp = ((engraveMins + engraveSetupMins) / 60) * rateOp;

    const weedMins = inputs.hasTactile ? (totalSqin * parseFloat(data.Time_Weed_Tactile_SqIn || 0.10)) : 0;
    const assemblyMins = tapeLayers > 0 ? (totalSqin * tapeLayers * parseFloat(data.Time_Tape_Layer_SqIn || 0.05)) : 0;
    const costAssembly = ((weedMins + assemblyMins) / 60) * rateShop;

    let costCNCMach = 0; let costCNCOp = 0;
    if (inputs.backer !== 'None') {
        const cncMins = totalSqin * parseFloat(data.Time_CNC_Run_SqIn || 0.02);
        const cncSetup = parseFloat(data.Time_Preflight_CNC || 15);
        costCNCMach = (cncMins / 60) * rateMachCNC;
        costCNCOp = ((cncMins + cncSetup) / 60) * rateCNC;
    }

    const subTotal = totalMats + costEngraveMach + costEngraveOp + costAssembly + costCNCMach + costCNCOp;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);
    const totalCost = subTotal + riskBuffer;

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailTotal, grandTotal: grandTotal, isMinApplied: retailTotal < minOrder },
        cost: { total: totalCost, breakdown: { rawSubstrate: costCore + costTactile + costBacker, rawTape: costTape, rawBraille: costBraille, costEngrave: costEngraveMach + costEngraveOp, costAssembly: costAssembly, costCNC: costCNCMach + costCNCOp, riskCost: riskBuffer, wastePct: (wastePct - 1) * 100 } },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}
