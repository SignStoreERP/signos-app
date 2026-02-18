/**
 * PURE PHYSICS ENGINE: ACM Signs (v2.6.3)
 * Features: Smart Nesting, Graph Paper Sandbox, and BoM Footer.
 */
function calculateACM(inputs, data) {
    // --- 1. RETAIL ENGINE ---
    const sqFt = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqFt * inputs.qty;

    // Pricing Factors
    const baseRate = inputs.thickness === "6mm" 
        ? parseFloat(data.Retail_Price_6mm_Base || 16.50) 
        : parseFloat(data.Retail_Price_3mm_Base || 14.00);

    const dsAdder = inputs.thickness === "6mm" 
        ? parseFloat(data.Retail_Price_6mm_DS || 8.25) 
        : parseFloat(data.Retail_Price_3mm_DS || 7.00);

    let retMaterial = baseRate * sqFt;
    if (inputs.sides === 2) retMaterial += (dsAdder * sqFt);

    const lamRate = parseFloat(data.Retail_Price_Lam || 8.00);
    const retLam = (inputs.lam !== "None") ? (lamRate * sqFt) : 0;

    let retFinish = 0;
    const roundRate = parseFloat(data.Retail_Price_Rounded || 5.00);
    const contourPct = parseFloat(data.Retail_Adder_Contour_Pct || 0.35);

    if (inputs.shape === "Contour") {
        retFinish = retMaterial * contourPct;
    } else if (inputs.rounded) {
        retFinish = roundRate;
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

    // --- 2. COST ENGINE (VISUAL NESTING) ---
    // UPDATED: "Sandbox" Style with Graph Grid & BoM Footer
    function generateSVG(layout, limitQty, stockName) {
        if (!layout) return "";
        
        // 1. Core Dimensions
        const sw = layout.sheetW;
        const sh = layout.sheetH;
        
        // 2. Sandbox Canvas Setup (Margins & Footer)
        // We add 5% padding around the sheet so it "floats" on the grid
        const pad = Math.max(sw, sh) * 0.05; 
        const footerH = Math.max(sh * 0.12, 10); // Dedicated footer area
        
        const canvasW = sw + (pad * 2);
        const canvasH = sh + (pad * 2) + footerH;

        // 3. Styling Configuration
        const style = {
            gridLine: "#e2e8f0",    // Light Gray Grid
            bgFill: "#f8fafc",      // Very Light Slate Background
            sheetFill: "#ffffff",   // White Sheet
            sheetStroke: "#94a3b8", // Slate-400 Border
            partFill: "rgba(59, 130, 246, 0.1)", // Blue Tint
            partStroke: "#3b82f6",  // Blue Line
            bomBg: "#1e293b",       // Dark Slate Footer
            bomText: "#ffffff"      // White Text
        };

        // 4. Generate Parts
        let rects = "";
        let count = 0;

        outerLoop:
        for (let r = 0; r < layout.rows; r++) {
            for (let c = 0; c < layout.cols; c++) {
                if (count >= limitQty) break outerLoop;

                const x = c * layout.partW;
                const y = r * layout.partH;
                const label = `${layout.rotated ? inputs.h : inputs.w}x${layout.rotated ? inputs.w : inputs.h}`;
                
                // Hide label if part is too small to read
                const showLabel = (layout.partW > 4 && layout.partH > 4);

                rects += `<g transform="translate(${x}, ${y})">
                    <rect width="${layout.partW}" height="${layout.partH}" 
                          fill="${style.partFill}" 
                          stroke="${style.partStroke}" 
                          stroke-width="0.1" />
                    ${showLabel ? 
                        `<text x="${layout.partW/2}" y="${layout.partH/2}" 
                               font-family="sans-serif" font-size="1.5" 
                               fill="${style.partStroke}" text-anchor="middle" 
                               dominant-baseline="middle" opacity="0.9" font-weight="bold">${label}</text>` 
                    : ''}
                </g>`;
                count++;
            }
        }

        // 5. Calculate BoM Data
        const totalSheets = Math.ceil(limitQty / layout.perSheet);
        const areaUsed = count * layout.partW * layout.partH; // Area used on THIS sheet
        const wastePct = ((1 - (areaUsed / (sw * sh))) * 100).toFixed(1);
        
        const bomText = `REQ: ${totalSheets} SHEET${totalSheets > 1 ? 'S' : ''} | STOCK: ${stockName} | WASTE: ${wastePct}%`;

        // 6. Return SVG
        return `<svg viewBox="0 0 ${canvasW} ${canvasH}" preserveAspectRatio="xMidYMid meet" style="width:100%; height:100%; display:block;">
            <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="${style.gridLine}" stroke-width="0.5"/>
                </pattern>
            </defs>
            
            <rect width="${canvasW}" height="${canvasH}" fill="${style.bgFill}" />
            <rect width="${canvasW}" height="${canvasH}" fill="url(#grid)" />
            
            <g transform="translate(${pad}, ${pad})">
                <rect width="${sw}" height="${sh}" fill="${style.sheetFill}" stroke="${style.sheetStroke}" stroke-width="0.5" />
                ${rects}
            </g>
            
            <g transform="translate(0, ${canvasH - footerH})">
                <rect width="${canvasW}" height="${footerH}" fill="${style.bomBg}" />
                <text x="${canvasW/2}" y="${footerH/2}" 
                      font-family="monospace" 
                      font-size="${footerH * 0.35}" 
                      fill="${style.bomText}" 
                      text-anchor="middle" 
                      dominant-baseline="middle" 
                      letter-spacing="1">
                      ${bomText}
                </text>
            </g>
        </svg>`;
    }

    function findBestStock(w, h, qty, thick) {
        const stocks = [
            { name: "4x8", sw: 48, sh: 96, cost: parseFloat(data[`Cost_Stock_${thick}_4x8`] || 52) },
            { name: "4x10", sw: 48, sh: 120, cost: parseFloat(data[`Cost_Stock_${thick}_4x10`] || 69) },
            { name: "5x10", sw: 60, sh: 120, cost: parseFloat(data[`Cost_Stock_${thick}_5x10`] || 75) }
        ];

        let best = { cost: Infinity, name: "N/A", sheets: 0, layout: null };

        stocks.forEach(stock => {
            // Rotation 1
            const colsA = Math.floor(stock.sw / w);
            const rowsA = Math.floor(stock.sh / h);
            const yieldA = colsA * rowsA;

            // Rotation 2
            const colsB = Math.floor(stock.sw / h);
            const rowsB = Math.floor(stock.sh / w);
            const yieldB = colsB * rowsB;

            const maxYield = Math.max(yieldA, yieldB);

            if (maxYield > 0) {
                const sheetsNeeded = Math.ceil(qty / maxYield);
                const totalRunCost = sheetsNeeded * stock.cost;

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
    }

    const optStock = findBestStock(inputs.w, inputs.h, inputs.qty, inputs.thickness);
    const maxLen = 120; const maxWid = 60;
    const isOversized = (Math.max(inputs.w, inputs.h) > maxLen || Math.min(inputs.w, inputs.h) > maxWid);
    if (isOversized) { optStock.name = "OVERSIZED"; optStock.cost = 0; }

    // Generate SVG with Quantity Limit & Stock Name
    optStock.svg = generateSVG(optStock.layout, inputs.qty, optStock.name);

    // Costing
    const waste = parseFloat(data.Waste_Factor || 1.2);
    const totalMatBoard = optStock.cost * waste;
    const inkCost = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16);
    const costLam = (inputs.lam !== "None") ? (totalSqFt * parseFloat(data.Cost_Lam_SqFt || 0.36)) : 0;

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

    const printTimeHrs = (inputs.h / 12 * inputs.qty) / parseFloat(data.Speed_Print_LF || 25);
    const costLabor = ((printTimeHrs * 60) + cutTime) * (rateOp/60);
    const costMachine = (printTimeHrs * rateMach) + ((cutTime/60) * machineRate);
    const totalCost = totalMatBoard + inkCost + costLam + costLabor + costMachine;

    // --- 3. VENDED ENGINE ---
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
