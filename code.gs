// ==========================================
//  MATRIX INTEGRATION ENGINE (v7.1)
// ==========================================
function fetchProductWithMatrix(tabName) {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    let config = {};

    // 1. Fetch Standard Product Data (Legacy Support)
    try {
        const prodSheet = ss.getSheetByName(tabName);
        if (prodSheet) {
            const data = prodSheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                const key = data[i]; 
                const val = data[i][1]; 
                if (key) config[key] = val;
            }
        }
    } catch(e) { console.warn("Legacy fetch failed: " + e); }

    // 2. Fetch Matrix Overrides
    try {
        const matrixSheet = ss.getSheetByName("SYS_Cost_Matrix");
        const defSheet = ss.getSheetByName("REF_Cost_Definitions");
        if (matrixSheet && defSheet) {
            const mData = matrixSheet.getDataRange().getValues();
            const dData = defSheet.getDataRange().getValues();
            const productID = tabName.replace("_Signs", "").replace("_Calculator", "");
            const headers = mData; 
            const colIdx = headers.findIndex(h => h === productID || h === tabName);

            if (colIdx > -1) {
                const defMap = {};
                for (let i = 1; i < dData.length; i++) {
                    if(dData[i]) defMap[dData[i]] = dData[i][2];
                }
                for (let r = 1; r < mData.length; r++) {
                    const costKey = mData[r];     
                    const matrixVal = mData[r][colIdx]; 

                    if (matrixVal === false || String(matrixVal).toUpperCase() === "FALSE") {
                        config[costKey] = 0; 
                    } else if (matrixVal === true || String(matrixVal).toUpperCase() === "TRUE") {
                        config[costKey] = defMap[costKey]; 
                    } else if (matrixVal !== "" && !isNaN(parseFloat(matrixVal))) {
                        config[costKey] = matrixVal; 
                    }
                }
            }
        }
    } catch(e) { console.warn("Matrix Logic Failed: " + e); }

    // 3. Fetch Master_Retail_Blue_Sheet (Yield Bounding Box Injection)
    try {
        const blueSheet = ss.getSheetByName("Master_Retail_Blue_Sheet");
        if (blueSheet) {
            const bData = blueSheet.getDataRange().getValues();
            for (let i = 1; i < bData.length; i++) {
                const key = bData[i]; // Col A (Retail_Key)
                if (key && typeof key === 'string') {
                    config[`${key}_1`] = bData[i][2];  // Col F (Price_Qty_1)
                    config[`${key}_10`] = bData[i][3]; // Col G (Price_Qty_10_Plus)
                }
            }
        }
    } catch(e) { console.warn("Blue Sheet fetch failed: " + e); }

    return returnJSON(config);
}


--------------------------------------------------------------------------------

2. Update logic_coro.js
Replace your Coroplast JS with this version. It now actively searches all standard sizes and mathematically selects the smallest possible yielding envelope for whatever size the customer types in.
/**
 * PURE PHYSICS ENGINE: Custom Coroplast (v2.2)
 * Implements Yield-Based Bounding Box overriding.
 */
function calculateCoro(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    
    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    const reqShort = Math.min(inputs.w, inputs.h);
    const reqLong = Math.max(inputs.w, inputs.h);
    const sideStr = inputs.sides === 2 ? 'DS' : 'SS';
    const thickStr = inputs.thickness === '10mm' ? '10' : '4';
    
    let bestFitArea = Infinity;
    let bestP1 = null, bestP10 = null, bestLabel = "";

    // A. Bounding Box Search
    Object.keys(data).forEach(key => {
        if (key.startsWith(`RET_COR${thickStr}_`) && key.endsWith(`_${sideStr}_1`)) {
            const dimStr = key.split('_')[4]; 
            const stdShort = parseInt(dimStr.substring(0, 2), 10);
            const stdLong = parseInt(dimStr.substring(2), 10);
            const stdArea = stdShort * stdLong;

            if (reqShort <= stdShort && reqLong <= stdLong && stdArea < bestFitArea) {
                bestFitArea = stdArea;
                bestP1 = parseFloat(data[key]);
                bestP10 = parseFloat(data[key.replace('_1', '_10')]);
                bestLabel = `${stdShort}x${stdLong}`;
            }
        }
    });

    let retailPrint = 0;
    let baseSqFtRate = 0;
    const t1Qty = parseFloat(data.Tier_1_Qty || 10);
    const tierLog = [];

    if (bestP1 !== null) {
        // MATCH: Apply Yield Envelope Price
        const appliedBase = inputs.qty >= t1Qty ? bestP10 : bestP1;
        retailPrint = appliedBase * inputs.qty;
        baseSqFtRate = bestP1 / sqft; // For display math only
        
        tierLog.push(
            { q: 1, base: bestP1, unit: bestP1 },
            { q: t1Qty, base: bestP10, unit: bestP10 }
        );
    } else {
        // NO MATCH: Oversize / Fallback to Area Curves
        let minSignPrice = inputs.thickness === '10mm' ? 75 : 25;
        if (inputs.thickness === '10mm') {
            if (sqft <= 3.99) baseSqFtRate = 25.00;
            else if (sqft <= 15.99) baseSqFtRate = 21.00;
            else if (sqft <= 31.99) baseSqFtRate = 18.00;
            else baseSqFtRate = 15.00;
        } else {
            if (sqft <= 3.99) baseSqFtRate = 8.33;
            else if (sqft <= 15.99) baseSqFtRate = 7.00;
            else if (sqft <= 31.99) baseSqFtRate = 6.00;
            else baseSqFtRate = 5.00;
        }

        let signPrice = baseSqFtRate * sqft;
        if (signPrice < minSignPrice) signPrice = minSignPrice;
        if (inputs.sides === 2) signPrice *= 1.5;

        const discPct = inputs.qty >= t1Qty ? parseFloat(data.Tier_1_Disc || 0.05) : 0;
        const appliedBase = signPrice * (1 - discPct);
        retailPrint = appliedBase * inputs.qty;

        tierLog.push(
            { q: 1, base: signPrice, unit: signPrice },
            { q: t1Qty, base: signPrice * (1 - parseFloat(data.Tier_1_Disc || 0.05)), unit: signPrice * (1 - parseFloat(data.Tier_1_Disc || 0.05)) }
        );
    }

    // B. Finishing Fees
    let routerFee = 0;
    if (inputs.shape === 'CNC Simple') routerFee = parseFloat(data.Retail_Fee_Router_Easy || 30);
    if (inputs.shape === 'CNC Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard || 50);

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;

    const grandTotalRaw = retailPrint + routerFee + feeDesign + feeSetup;
    const minOrder = bestP1 !== null ? 0 : parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    tierLog.forEach(t => t.unit = (t.unit * t.q + routerFee) / t.q);

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const costSheet = inputs.thickness === '10mm' ? parseFloat(data.Cost_Stock_10mm_4x8 || 33.49) : parseFloat(data.Cost_Stock_4mm_4x8 || 8.40);
    const costPerSqFt = costSheet / 32;
    const wastePct = parseFloat(data.Waste_Factor || 1.10);
    const rawMat = costPerSqFt * totalSqFt;
    const wasteCost = rawMat * (wastePct - 1);
    const totalInk = totalSqFt * inputs.sides * parseFloat(data.Cost_Ink_Latex || 0.16);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateCNC = parseFloat(data.Rate_CNC_Labor || 25);
    const rateMachPrint = parseFloat(data.Rate_Machine_Flatbed || 45);
    const rateMachCNC = parseFloat(data.Rate_Machine_CNC || 35);

    let costCutSetup = 0, costCutLabor = 0, costCutMach = 0, runHrsCNC = 0;
    if (inputs.shape === 'Rectangle') {
        costCutSetup = (parseFloat(data.Time_Shear_Setup || 5) / 60) * rateOp;
        costCutLabor = ((inputs.qty * 2 * parseFloat(data.Time_Shear_Cut || 1)) / 60) * rateOp;
    } else {
        costCutSetup = (parseFloat(data.Time_Setup_CNC || 10) / 60) * rateCNC;
        const routeTimeSqFt = inputs.shape === 'CNC Complex' ? parseFloat(data.Time_CNC_Complex_SqFt || 2) : parseFloat(data.Time_CNC_Easy_SqFt || 1);
        runHrsCNC = (totalSqFt * routeTimeSqFt) / 60;
        costCutLabor = runHrsCNC * rateCNC;
        costCutMach = runHrsCNC * rateMachCNC;
    }

    const setupMinsPrint = parseFloat(data.Time_Setup_Job || 15) + parseFloat(data.Time_Handling || 4);
    const costSetupPrint = (setupMinsPrint / 60) * rateOp;
    const speedPrint = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const printHrs = ((inputs.h / 12) * inputs.qty / speedPrint) * inputs.sides;
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costPrintMach = printHrs * rateMachPrint;

    const subTotal = rawMat + wasteCost + totalInk + costSetupPrint + costPrintOp + costPrintMach + costCutSetup + costCutLabor + costCutMach;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: (retailPrint + routerFee) / inputs.qty,
            printTotal: retailPrint,
            routerFee: routerFee,
            setupFee: feeSetup,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            tiers: tierLog,
            yieldLabel: bestLabel ? `Yield Box: ${bestLabel}` : "Area Curve"
        },
        cost: {
            total: subTotal,
            breakdown: {
                rawBlanks: rawMat, wasteCost: wasteCost, wastePct: (wastePct - 1) * 100, totalInk: totalInk,
                costSetup: costSetupPrint + costCutSetup, costCut: costCutLabor + costCutMach, runHrs: printHrs + runHrsCNC,
                costMachine: costPrintMach + costCutMach, costOp: costPrintOp + costCutLabor, riskCost: riskBuffer, riskPct: (riskFactor - 1) * 100
            }
        },
        metrics: { margin: (grandTotal - subTotal) / grandTotal }
    };
}
