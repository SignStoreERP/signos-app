/**
 * PURE PHYSICS ENGINE: ADA Etch Nameplates (v2.0 - Strict Reference)
 */

function calculateNameplate(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    let baseRateSqIn = 0;
    
    // Determine base retail rate from the selected material object
    if (inputs.mat.Series.includes('Mattes')) {
        baseRateSqIn = parseFloat(data.Retail_Price_Mattes_116 || 0.55);
    } else if (inputs.mat.Series.includes('Ultra') && inputs.mat.Thickness === '1/16"') {
        baseRateSqIn = parseFloat(data.Retail_Price_Ultra_116 || 0.65);
    } else {
        baseRateSqIn = parseFloat(data.Retail_Price_Ultra_18 || 0.85); // 1/8" Ultra
    }

    let unitPrint = baseRateSqIn * sqin;
    let retailPrint = unitPrint * inputs.qty;

    // Volume Discount
    const t1Qty = parseFloat(data.Tier_1_Qty || 10);
    if (inputs.qty >= t1Qty) {
        retailPrint *= (1 - parseFloat(data.Tier_1_Disc || 0.05));
    }

    const feeSetup = parseFloat(data.Retail_Fee_Setup || 15);
    const grandTotalRaw = retailPrint + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 35);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const wastePct = parseFloat(data.Waste_Factor || 1.20);
    
    // Exact Substrate Cost pulled from REF_Colors_Rowmark
    const costSheet = parseFloat(inputs.mat.Cost_Per_Sheet || 65.00);
    const costSubstrate = (totalSqin / 1152) * costSheet * wastePct; // 24x48 sheet = 1152 sqin

    // Labor Rates
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateEngraver = parseFloat(data.Rate_Machine_Engraver || 10);

    // Engraving Time
    const costPrepress = (parseFloat(data.Time_Preflight_Job || 10) / 60) * rateOp;
    const costLoad = ((inputs.qty * parseFloat(data.Time_Engraver_Load_Per_Item || 2)) / 60) * rateOp;
    
    const engraveMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.25);
    const costMachRun = (engraveMins / 60) * rateEngraver;

    // Paint Physics (Only applies if Reverse Engrave)
    let paintMatCost = 0;
    let costPaintLabor = 0;

    if (inputs.isReverse) {
        paintMatCost = totalSqin * parseFloat(data.Cost_Paint_SqIn || 0.01) * wastePct;
        const paintRunMins = parseFloat(data.Time_Paint_Setup || 15) + (totalSqin * parseFloat(data.Time_Paint_SqIn || 0.10));
        costPaintLabor = (paintRunMins / 60) * rateShop;
    }

    const subTotal = costSubstrate + costPrepress + costLoad + costMachRun + paintMatCost + costPaintLabor;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            setupFee: feeSetup,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder
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
