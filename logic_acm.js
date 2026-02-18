/**
 * PURE PHYSICS ENGINE: ACM Signs (v2.2)
 * Features: Smart Nesting, Max Dim Checks, and Sheet Optimization.
 */
function calculateACM(inputs, data) {
    // --- 1. VALIDATION & CONSTRAINTS ---
    const maxLen = 120;
    const maxWid = 60;
    const dim1 = Math.max(inputs.w, inputs.h);
    const dim2 = Math.min(inputs.w, inputs.h);
    
    // Check Physical Limits
    const isOversized = (dim1 > maxLen || dim2 > maxWid);

    // --- 2. RETAIL ENGINE ---
    const sqFt = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqFt * inputs.qty;

    // A. Material Base
    const baseRate = inputs.thickness === "6mm" 
        ? parseFloat(data.Retail_Price_6mm_Base || 16.50)
        : parseFloat(data.Retail_Price_3mm_Base || 14.00);
    
    const dsAdder = inputs.thickness === "6mm"
        ? parseFloat(data.Retail_Price_6mm_DS || 8.25)
        : parseFloat(data.Retail_Price_3mm_DS || 7.00);

    let retMaterial = baseRate * sqFt;
    if (inputs.sides === 2) retMaterial += (dsAdder * sqFt);

    // B. Laminate (Mandatory)
    const lamRate = parseFloat(data.Retail_Price_Lam || 8.00);
    const retLam = lamRate * sqFt;

    // C. Finishing (Shape)
    let retFinish = 0;
    const roundRate = parseFloat(data.Retail_Price_Rounded || 5.00);
    const contourPct = parseFloat(data.Retail_Adder_Contour_Pct || 0.35);

    if (inputs.shape === "Contour") {
        retFinish = retMaterial * contourPct; 
    } else {
        if (inputs.rounded) retFinish = roundRate;
    }

    const unitPrice = retMaterial + retLam + retFinish;
    const totalProduct = unitPrice * inputs.qty;

    // D. Fees
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 25);
    const feeDesignBase = parseFloat(data.Retail_Fee_Design || 45);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;
    
    let feeDesign = 0;
    if (inputs.incDesign) {
        feeDesign = inputs.designPerFile ? (feeDesignBase * inputs.files) : feeDesignBase;
    }

    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotalRaw = totalProduct + feeSetup + feeDesign;
    const grandTotal = Math.max(grandTotalRaw, minOrder + feeSetup + feeDesign); 

    // --- 3. COST ENGINE (OPTIMIZATION & NESTING) ---
    const findBestStock = (w, h, qty, thick) => {
        // Define Available Stock Sizes
        const stocks = [
            { name: "4x8", sw: 48, sh: 96, cost: parseFloat(data[`Cost_Stock_${thick}_4x8`] || 52) },
            { name: "4x10", sw: 48, sh: 120, cost: parseFloat(data[`Cost_Stock_${thick}_4x10`] || 69) },
            { name: "5x10", sw: 60, sh: 120, cost: parseFloat(data[`Cost_Stock_${thick}_5x10`] || 75) }
        ];

        let best = { cost: Infinity, name: "N/A", sheets: 0, yieldPerSheet: 0 };

        stocks.forEach(stock => {
            // Check Rotation 1 (W fits SW)
            const fit1_W = Math.floor(stock.sw / w);
            const fit1_H = Math.floor(stock.sh / h);
            const yield1 = fit1_W * fit1_H;

            // Check Rotation 2 (W fits SH)
            const fit2_W = Math.floor(stock.sw / h);
            const fit2_H = Math.floor(stock.sh / w);
            const yield2 = fit2_W * fit2_H;

            const maxYield = Math.max(yield1, yield2);

            if (maxYield > 0) {
                const sheetsNeeded = Math.ceil(qty / maxYield);
                const totalRunCost = sheetsNeeded * stock.cost;

                // Optimization: If cost is equal, prefer the smaller sheet (4x8)
                if (totalRunCost < best.cost) {
                    best = { cost: totalRunCost, name: stock.name, sheets: sheetsNeeded, yieldPerSheet: maxYield };
                }
            }
        });
        return best;
    };

    const optStock = findBestStock(inputs.w, inputs.h, inputs.qty, inputs.thickness);
    
    // If Oversized, force "Custom" cost logic
    if (isOversized) {
        optStock.name = "OVERSIZED";
        optStock.cost = 0; // Or handle as special case
    }

    const waste = parseFloat(data.Waste_Factor || 1.2);
    const totalMatBoard = optStock.cost * waste;

    const inkCost = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16);
    const lamCost = (inputs.lam !== "None") ? (totalSqFt * parseFloat(data.Cost_Lam_SqFt || 0.36)) : 0;
    
    // Labor
    const speedPrint = parseFloat(data.Speed_Print_LF || 25);
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateMach = parseFloat(data.Rate_Machine_Print || 45);
    const rateCNC = parseFloat(data.Rate_Machine_CNC || 35);

    let cutTime = 0; 
    let machineRate = 0;
    if (inputs.shape === "Contour") {
        // CNC Setup + Cut Time
        cutTime = parseFloat(data.Time_Setup_CNC || 10) + (parseFloat(data.Time_Cut_Contour || 8) * inputs.qty);
        machineRate = rateCNC;
    } else {
        // Shear Setup + Cut Time + Rounding
        const shearTime = parseFloat(data.Time_Shear_Base || 5) + (parseFloat(data.Time_Shear_Add || 3) * inputs.qty);
        const roundTime = inputs.rounded ? (parseFloat(data.Time_Round_Corn || 2) * inputs.qty) : 0;
        cutTime = shearTime + roundTime;
    }

    const printTimeHrs = (inputs.h / 12 * inputs.qty) / speedPrint;
    const costLabor = ((printTimeHrs * 60) + cutTime) * (rateOp/60);
    const costMachine = (printTimeHrs * rateMach) + ((cutTime/60) * machineRate);

    const totalCost = totalMatBoard + inkCost + lamCost + costLabor + costMachine;

    // --- 4. VENDED ENGINE (S365) ---
    const vendKey = `S365_${inputs.thickness}_${inputs.sides===2?'DS':'SS'}_SqFt`;
    const vendRate = parseFloat(data[vendKey] || 7.20);
    
    let vendTotal = (totalSqFt * vendRate);
    
    if (inputs.shape === "Contour") vendTotal = vendTotal * (1 + parseFloat(data.S365_Contour_Pct || 0.1));
    else if (inputs.rounded) vendTotal += (inputs.qty * parseFloat(data.S365_Rounded_Fee || 5));
    if (inputs.lam === "Gloss") vendTotal += (inputs.qty * parseFloat(data.S365_Gloss_Rate || 4));

    let shipCost = parseFloat(data.Ship_T1_Rate || 10);
    if (inputs.w > 24 || inputs.h > 24) shipCost = parseFloat(data.Ship_T2_Rate || 15);
    if (inputs.w > 36 || inputs.h > 36) shipCost = parseFloat(data.Ship_T3_Rate || 35);
    if (inputs.w > 46 || inputs.h > 46) shipCost = parseFloat(data.Ship_T4_Rate_Low || 50);
    if (totalSqFt > 100) shipCost = parseFloat(data.Ship_Freight_Cost || 199);

    return {
        retail: {
            unitPrice: unitPrice,
            grandTotal: grandTotal,
            breakdown: { material: retMaterial, laminate: retLam, finish: retFinish },
            fees: { setup: feeSetup, design: feeDesign },
            isMinApplied: grandTotalRaw < (minOrder + feeSetup + feeDesign),
            isOversized: isOversized
        },
        cost: {
            total: totalCost,
            unit: totalCost / inputs.qty,
            stock: optStock
        },
        vended: {
            total: vendTotal + shipCost,
            unit: (vendTotal + shipCost) / inputs.qty,
            shipping: shipCost
        },
        metrics: {
            marginInHouse: (grandTotal - totalCost) / grandTotal,
            marginVended: (grandTotal - (vendTotal + shipCost)) / grandTotal
        }
    };
}
