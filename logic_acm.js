/**
 * PURE PHYSICS ENGINE: ACM Signs (v2.3)
 * Features: Smart Nesting, visual SVG generation, and Sheet Optimization.
 */
function calculateACM(inputs, data) {
    // --- 1. VALIDATION ---
    const maxLen = 120;
    const maxWid = 60;
    const dim1 = Math.max(inputs.w, inputs.h);
    const dim2 = Math.min(inputs.w, inputs.h);
    const isOversized = (dim1 > maxLen || dim2 > maxWid);

    // --- 2. RETAIL ENGINE ---
    const sqFt = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqFt * inputs.qty;

    // Material & Adders
    const baseRate = inputs.thickness === "6mm" 
        ? parseFloat(data.Retail_Price_6mm_Base || 16.50)
        : parseFloat(data.Retail_Price_3mm_Base || 14.00);
    
    const dsAdder = inputs.thickness === "6mm"
        ? parseFloat(data.Retail_Price_6mm_DS || 8.25)
        : parseFloat(data.Retail_Price_3mm_DS || 7.00);

    let retMaterial = baseRate * sqFt;
    if (inputs.sides === 2) retMaterial += (dsAdder * sqFt);

    const lamRate = parseFloat(data.Retail_Price_Lam || 8.00);
    const retLam = lamRate * sqFt;

    let retFinish = 0;
    if (inputs.shape === "Contour") {
        retFinish = retMaterial * parseFloat(data.Retail_Adder_Contour_Pct || 0.35); 
    } else if (inputs.rounded) {
        retFinish = parseFloat(data.Retail_Price_Rounded || 5.00);
    }

    const unitPrice = retMaterial + retLam + retFinish;
    const totalProduct = unitPrice * inputs.qty;

    // Fees
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 25);
    const feeDesignBase = parseFloat(data.Retail_Fee_Design || 45);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;
    const feeDesign = inputs.incDesign ? (inputs.designPerFile ? (feeDesignBase * inputs.files) : feeDesignBase) : 0;

    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotalRaw = totalProduct + feeSetup + feeDesign;
    const grandTotal = Math.max(grandTotalRaw, minOrder + feeSetup + feeDesign); 

    // --- 3. COST ENGINE (VISUAL NESTING) ---
    const findBestStock = (w, h, qty, thick) => {
        const stocks = [
            { name: "4x8", sw: 48, sh: 96, cost: parseFloat(data[`Cost_Stock_${thick}_4x8`] || 52) },
            { name: "4x10", sw: 48, sh: 120, cost: parseFloat(data[`Cost_Stock_${thick}_4x10`] || 69) },
            { name: "5x10", sw: 60, sh: 120, cost: parseFloat(data[`Cost_Stock_${thick}_5x10`] || 75) }
        ];

        let best = { cost: Infinity, name: "N/A", sheets: 0, layout: null };

        stocks.forEach(stock => {
            // Option A: No Rotation
            const colsA = Math.floor(stock.sw / w);
            const rowsA = Math.floor(stock.sh / h);
            const yieldA = colsA * rowsA;

            // Option B: Rotated 90 deg
            const colsB = Math.floor(stock.sw / h);
            const rowsB = Math.floor(stock.sh / w);
            const yieldB = colsB * rowsB;

            const maxYield = Math.max(yieldA, yieldB);

            if (maxYield > 0) {
                const sheetsNeeded = Math.ceil(qty / maxYield);
                const totalRunCost = sheetsNeeded * stock.cost;

                // Optimization: Prefer Lower Cost -> Smaller Sheet -> Higher Yield
                if (totalRunCost < best.cost) {
                    const isRotated = yieldB > yieldA;
                    best = { 
                        cost: totalRunCost, 
                        name: stock.name, 
                        sheets: sheetsNeeded, 
                        layout: {
                            sheetW: stock.sw,
                            sheetH: stock.sh,
                            partW: isRotated ? h : w,
                            partH: isRotated ? w : h,
                            cols: isRotated ? colsB : colsA,
                            rows: isRotated ? rowsB : rowsA,
                            perSheet: maxYield,
                            rotated: isRotated
                        }
                    };
                }
            }
        });
        return best;
    };

    // GENERATE SVG VECTOR
    const renderSVG = (layout) => {
        if (!layout) return "";
        const scale = 4; // Display scale
        const sw = layout.sheetW;
        const sh = layout.sheetH;
        
        let rects = "";
        let count = 0;
        
        // Draw Grid
        for (let r = 0; r < layout.rows; r++) {
            for (let c = 0; c < layout.cols; c++) {
                const x = c * layout.partW;
                const y = r * layout.partH;
                const isRotated = layout.rotated;
                const label = `${isRotated ? inputs.h : inputs.w}x${isRotated ? inputs.w : inputs.h}`;
                
                rects += `<g transform="translate(${x}, ${y})">
                    <rect width="${layout.partW}" height="${layout.partH}" fill="#3b82f6" stroke="white" stroke-width="0.5" opacity="0.9" />
                    <text x="${layout.partW/2}" y="${layout.partH/2}" font-family="sans-serif" font-size="2" fill="white" text-anchor="middle" dominant-baseline="middle">${label}</text>
                </g>`;
                count++;
            }
        }

        // Remaining space styling
        return `<svg viewBox="0 0 ${sw} ${sh}" class="w-full h-full bg-gray-200 border border-gray-400">
            ${rects}
            <text x="2" y="${sh-2}" font-size="3" fill="#666">${sw}" x ${sh}" Master Sheet (${layout.perSheet} up)</text>
        </svg>`;
    };

    const optStock = findBestStock(inputs.w, inputs.h, inputs.qty, inputs.thickness);
    if (isOversized) { optStock.name = "OVERSIZED"; optStock.cost = 0; }
    
    // Attach SVG to result
    optStock.svg = renderSVG(optStock.layout);

    // Costing Math
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
        cutTime = parseFloat(data.Time_Setup_CNC || 10) + (parseFloat(data.Time_Cut_Contour || 8) * inputs.qty);
        machineRate = rateCNC;
    } else {
        const shearTime = parseFloat(data.Time_Shear_Base || 5) + (parseFloat(data.Time_Shear_Add || 3) * inputs.qty);
        const roundTime = inputs.rounded ? (parseFloat(data.Time_Round_Corn || 2) * inputs.qty) : 0;
        cutTime = shearTime + roundTime;
    }

    const printTimeHrs = (inputs.h / 12 * inputs.qty) / speedPrint;
    const costLabor = ((printTimeHrs * 60) + cutTime) * (rateOp/60);
    const costMachine = (printTimeHrs * rateMach) + ((cutTime/60) * machineRate);
    const totalCost = totalMatBoard + inkCost + lamCost + costLabor + costMachine;

    // Vended
    const vendKey = `S365_${inputs.thickness}_${inputs.sides===2?'DS':'SS'}_SqFt`;
    const vendRate = parseFloat(data[vendKey] || 7.20);
    let vendTotal = (totalSqFt * vendRate);
    if (inputs.shape === "Contour") vendTotal *= (1 + parseFloat(data.S365_Contour_Pct || 0.1));
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
