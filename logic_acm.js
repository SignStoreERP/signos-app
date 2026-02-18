/**
 * PURE PHYSICS ENGINE: ACM Signs (v2.0)
 * Handles Pricing, Costing, and Stock Sheet Optimization.
 */
function calculateACM(inputs, data) {
    // --- 1. RETAIL ENGINE ---
    const sqFt = (inputs.w * inputs.h) / 144;
    const perimeter = ((inputs.w + inputs.h) * 2) / 12;
    const totalSqFt = sqFt * inputs.qty;

    // Base Price
    const baseRate = inputs.thickness === "6mm" 
        ? parseFloat(data.Retail_Price_6mm_Base || 16.50)
        : parseFloat(data.Retail_Price_3mm_Base || 14.00);

    const dsAdder = inputs.thickness === "6mm"
        ? parseFloat(data.Retail_Price_6mm_DS || 8.25)
        : parseFloat(data.Retail_Price_3mm_DS || 7.00);

    // Adders
    const lamRate = parseFloat(data.Retail_Price_Lam || 8.00);
    const roundRate = parseFloat(data.Retail_Price_Rounded || 5.00);
    const contourPct = parseFloat(data.Retail_Adder_Contour_Pct || 0.35);

    let unitRetail = baseRate * sqFt;
    if (inputs.sides === 2) unitRetail += (dsAdder * sqFt);
    if (inputs.lam !== "None") unitRetail += (lamRate * sqFt);
    
    // Shape Logic
    if (inputs.shape === "Rounded") unitRetail += roundRate;
    if (inputs.shape === "Contour") unitRetail = unitRetail * (1 + contourPct);

    // Fees
    const feeSetup = inputs.setupPerFile ? (parseFloat(data.Retail_Fee_Setup || 25) * inputs.files) : parseFloat(data.Retail_Fee_Setup || 25);
    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;

    const totalProduct = unitRetail * inputs.qty;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotalRaw = totalProduct + feeSetup + feeDesign;
    const grandTotal = Math.max(grandTotalRaw, minOrder + feeDesign); // Fee sits on top of min

    // --- 2. COST ENGINE (OPTIMIZATION) ---
    // Helper: Find best sheet yield
    const findBestStock = (w, h, qty, thick) => {
        const stocks = [
            { name: "4x8", w: 48, h: 96, cost: parseFloat(data[`Cost_Stock_${thick}_4x8`] || 52) },
            { name: "4x10", w: 48, h: 120, cost: parseFloat(data[`Cost_Stock_${thick}_4x10`] || 69) },
            { name: "5x10", w: 60, h: 120, cost: parseFloat(data[`Cost_Stock_${thick}_5x10`] || 75) }
        ];

        let best = { cost: Infinity, name: "N/A", sheets: 0 };

        stocks.forEach(stock => {
            // Simple area yield approximation for speed (Real nesting is complex)
            const sheetArea = (stock.w * stock.h);
            const partArea = (w * h);
            const yieldPer = Math.floor((sheetArea / partArea) * 0.85); // 85% efficiency buffer
            const sheetsNeeded = Math.ceil(qty / (yieldPer || 1));
            const totalStockCost = sheetsNeeded * stock.cost;

            if (totalStockCost < best.cost) {
                best = { cost: totalStockCost, name: stock.name, sheets: sheetsNeeded, unitCost: stock.cost };
            }
        });
        return best;
    };

    const optStock = findBestStock(inputs.w, inputs.h, inputs.qty, inputs.thickness);
    const waste = parseFloat(data.Waste_Factor || 1.2);
    const totalMatBoard = optStock.cost * waste;

    // Print & Lam Material
    const inkCost = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16);
    const lamCost = (inputs.lam !== "None") ? (totalSqFt * parseFloat(data.Cost_Lam_SqFt || 0.36)) : 0;
    const totalMat = totalMatBoard + inkCost + lamCost;

    // Labor
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateMach = parseFloat(data.Rate_Machine_Print || 45);
    const rateCNC = parseFloat(data.Rate_Machine_CNC || 35);
    
    // Time Standards
    const speedPrint = parseFloat(data.Speed_Print_LF || 25);
    const speedLam = parseFloat(data.Speed_Lam_Roll || 300);
    
    // Cutting Logic (Shear vs CNC)
    let cutTime = 0;
    let machineRate = 0;
    
    if (inputs.shape === "Square") {
        // Shear Logic
        const timeShear = parseFloat(data.Time_Shear_Base || 5) + (parseFloat(data.Time_Shear_Add || 3) * inputs.qty);
        cutTime = timeShear;
        machineRate = 0; // Hand tool
    } else {
        // CNC Logic
        const timeSetupCNC = parseFloat(data.Time_Setup_CNC || 10);
        const timeCut = parseFloat(data.Time_Cut_Contour || 8); 
        cutTime = timeSetupCNC + (timeCut * inputs.qty);
        machineRate = rateCNC;
    }

    const printTimeHrs = (inputs.h / 12 * inputs.qty) / speedPrint; // Linear logic
    const costLabor = ((printTimeHrs * 60) + cutTime) * (rateOp/60);
    const costMachine = (printTimeHrs * rateMach) + ((cutTime/60) * machineRate);

    const totalCost = totalMat + costLabor + costMachine;

    // --- 3. VENDED ENGINE (S365) ---
    // Keys: S365_3mm_SS_SqFt
    const vendKey = `S365_${inputs.thickness}_${inputs.sides===2?'DS':'SS'}_SqFt`;
    const vendRate = parseFloat(data[vendKey] || 7.20);
    
    let vendTotal = (totalSqFt * vendRate);
    
    // Adders
    if (inputs.shape === "Rounded") vendTotal += (inputs.qty * parseFloat(data.S365_Rounded_Fee || 5));
    if (inputs.shape === "Contour") vendTotal = vendTotal * (1 + parseFloat(data.S365_Contour_Pct || 0.1));
    if (inputs.lam === "Gloss") vendTotal += (inputs.qty * parseFloat(data.S365_Gloss_Rate || 4));

    // Shipping Logic (Dynamic Tiers)
    let shipCost = parseFloat(data.Ship_T1_Rate || 10);
    if (inputs.w > 24 || inputs.h > 24) shipCost = parseFloat(data.Ship_T2_Rate || 15);
    if (inputs.w > 36 || inputs.h > 36) shipCost = parseFloat(data.Ship_T3_Rate || 35);
    if (inputs.w > 46 || inputs.h > 46) shipCost = parseFloat(data.Ship_T4_Rate_Low || 50);
    if (totalSqFt > 100) shipCost = parseFloat(data.Ship_Freight_Cost || 199);

    const totalVended = vendTotal + shipCost;

    return {
        retail: {
            unitPrice: (totalProduct / inputs.qty),
            grandTotal: grandTotal,
            setupFee: feeSetup,
            designFee: feeDesign,
            isMinApplied: grandTotalRaw < (minOrder + feeDesign)
        },
        cost: {
            total: totalCost,
            unit: totalCost / inputs.qty,
            stock: optStock // Pass optimization data to UI
        },
        vended: {
            total: totalVended,
            unit: totalVended / inputs.qty,
            shipping: shipCost
        },
        metrics: {
            marginInHouse: (grandTotal - totalCost) / grandTotal,
            marginVended: (grandTotal - totalVended) / grandTotal
        }
    };
}
