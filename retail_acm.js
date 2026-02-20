/**
 * PURE PHYSICS ENGINE: ACM Signs (v3.0 - Dual Track)
 * Implements Qty Breaks, Shear vs CNC Physics, and Corner Rounding.
 */

function calculateACM(inputs, data) {
    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // Base Rate per SqFt
    let baseSqFtRate = inputs.thickness === '6mm' 
        ? parseFloat(data.Retail_ACM6_SqFt || 16.50) 
        : parseFloat(data.Retail_ACM3_SqFt || 14.00);

    // Black ACM 6mm Exception (Double Price per Blue Sheet)
    if (inputs.color === 'Black' && inputs.thickness === '6mm') {
        baseSqFtRate *= 2;
    }

    // 1-9 vs 10+ Tier Logic
    let discPct = 0;
    const t1Qty = parseFloat(data.Tier_1_Qty || 10);
    if (inputs.qty >= t1Qty) {
        discPct = parseFloat(data.Tier_1_Disc || 0.05); // e.g. 5% off for 10+
    }
    const activeRate = baseSqFtRate * (1 - discPct);
    
    let retailPrint = activeRate * totalSqFt;

    // Double Sided Adder
    if (inputs.sides === 2) {
        const dsAdder = inputs.thickness === '6mm' 
            ? parseFloat(data.Retail_Adder_DS_6mm || 8.25) 
            : parseFloat(data.Retail_Adder_DS_3mm || 7.00);
        retailPrint += (dsAdder * totalSqFt);
    }

    // Shape / CNC Fees
    let routerFee = 0;
    if (inputs.shape === 'CNC Simple') routerFee = parseFloat(data.Retail_Fee_CNC_Simple || 30);
    if (inputs.shape === 'CNC Complex') routerFee = parseFloat(data.Retail_Fee_CNC_Complex || 50);

    // Rounded Corners (Only applies to Rectangles)
    let roundedFee = 0;
    if (inputs.shape === 'Rectangle' && inputs.rounded) {
        const rSetup = parseFloat(data.Retail_Fee_Round_Setup || 5);
        const rPerCut = parseFloat(data.Retail_Price_Round_Corner || 1); // Per corner
        roundedFee = rSetup + (rPerCut * 4 * inputs.qty); // 4 corners per sign
    }

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetup = parseFloat(data.Retail_Fee_Setup || 15);

    const grandTotalRaw = retailPrint + routerFee + roundedFee + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // UI Tier Log
    const tierLog = [
        { q: 1, base: baseSqFtRate, unit: (baseSqFtRate * sqft) + (inputs.sides === 2 ? (inputs.thickness==='6mm'?8.25:7)*sqft : 0) },
        { q: t1Qty, base: baseSqFtRate * (1 - (data.Tier_1_Disc||0.05)), unit: (baseSqFtRate * (1 - (data.Tier_1_Disc||0.05)) * sqft) + (inputs.sides === 2 ? (inputs.thickness==='6mm'?8.25:7)*sqft : 0) }
    ];


    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    // Materials
    let sheetCost = inputs.thickness === '6mm' 
        ? parseFloat(data.Cost_Stock_6mm_4x8 || 72.10) 
        : parseFloat(data.Cost_Stock_3mm_4x8 || 52.09);
        
    const costPerSqFt = sheetCost / 32; // 4x8 sheet = 32 sqft
    const wastePct = parseFloat(data.Waste_Factor || 1.20);
    const rawMat = costPerSqFt * totalSqFt;
    const wasteCost = rawMat * (wastePct - 1);
    const totalMat = rawMat + wasteCost;

    const totalInk = totalSqFt * inputs.sides * parseFloat(data.Cost_Ink_Latex || 0.16);

    // Labor Rates
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateCNC = parseFloat(data.Rate_CNC_Labor || 45);
    const rateMachCNC = parseFloat(data.Rate_Machine_CNC || 35);
    const rateMachPrint = parseFloat(data.Rate_Machine_Flatbed || 45);

    let costCutSetup = 0;
    let costCutLabor = 0;
    let costCutMach = 0;
    let costRound = 0;
    let runHrsCNC = 0;

    // Cutting Physics
    if (inputs.shape === 'Rectangle') {
        // Shear Cut (2 cuts per sign)
        const shearSetupMins = parseFloat(data.Time_Shear_Setup || 5);
        const shearPerCut = parseFloat(data.Time_Shear_Cut || 1);
        costCutSetup = (shearSetupMins / 60) * rateOp;
        costCutLabor = ((inputs.qty * 2 * shearPerCut) / 60) * rateOp;

        // Rounding Physics (4 corners per sign)
        if (inputs.rounded) {
            const roundSetup = parseFloat(data.Time_Round_Setup || 5);
            const roundPerCut = parseFloat(data.Time_Round_Corner || 0.5);
            const totalRoundMins = roundSetup + (inputs.qty * 4 * roundPerCut);
            costRound = (totalRoundMins / 60) * rateOp;
        }
    } else {
        // CNC Router Physics
        const cncSetupMins = parseFloat(data.Time_Setup_CNC || 10);
        costCutSetup = (cncSetupMins / 60) * rateCNC;

        const routeTimeSqFt = inputs.shape === 'CNC Complex' 
            ? parseFloat(data.Time_CNC_Complex_SqFt || 2) 
            : parseFloat(data.Time_CNC_Easy_SqFt || 1);
        
        runHrsCNC = (totalSqFt * routeTimeSqFt) / 60;
        costCutLabor = runHrsCNC * rateCNC;
        costCutMach = runHrsCNC * rateMachCNC;
    }

    // Print Speed Physics
    const speedPrint = parseFloat(data.Machine_Speed_LF_Hr || 25); 
    const linearFeet = (inputs.h / 12) * inputs.qty; // Simplified feed length
    const printHrs = (linearFeet / speedPrint) * inputs.sides;
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costPrintMach = printHrs * rateMachPrint;

    // Totals & Risk Indicator
    const subTotal = totalMat + totalInk + costCutSetup + costCutLabor + costCutMach + costRound + costPrintOp + costPrintMach;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);
    
    // Risk is just an indicator
    const totalCost = subTotal;

    return {
        retail: {
            unitPrice: (retailPrint + routerFee + roundedFee) / inputs.qty,
            printTotal: retailPrint,
            routerFee: routerFee,
            roundedFee: roundedFee,
            setupFee: feeSetup,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            tiers: tierLog
        },
        cost: {
            total: totalCost,
            breakdown: {
                rawBlanks: rawMat,
                wasteCost: wasteCost,           
                wastePct: (wastePct - 1) * 100, 
                totalInk: totalInk,
                costSetup: costCutSetup,
                costCut: costCutLabor + costCutMach,
                costRound: costRound,
                runHrs: runHrsCNC + printHrs,
                costMachine: costPrintMach + costCutMach,
                costOp: costPrintOp + costCutLabor + costRound,
                riskCost: riskBuffer,           
                riskPct: (riskFactor - 1) * 100 
            }
        },
        metrics: {
            margin: (grandTotal - totalCost) / grandTotal
        }
    };
}
