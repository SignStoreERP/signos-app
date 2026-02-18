/**
 * PURE PHYSICS ENGINE: ACM Signs (v2.6.4)
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
    // UPDATED: Cinema Mode (Forces Landscape Canvas & Fit-Text Footer)
    function generateSVG(layout, limitQty, stockName) {
        if (!layout) return "";
        
        // 1. Core Dimensions (Inches)
        const sw = layout.sheetW;
        const sh = layout.sheetH;
        
        // 2. Cinema Canvas Calculation
        // We force the canvas to be Landscape (4:3 ratio) so it fills the UI window better
        // instead of being a skinny tall strip.
        const targetAspect = 1.33; // 4:3 Ratio
        
        // Calculate the "Visual Box" needed to hold the sheet + margins
        const sheetVisualH = sh * 1.1; // Sheet + 10% vertical buffer
        const sheetVisualW = sw * 1.1; // Sheet + 10% horizontal buffer
        
        let canvasW, canvasH;

        // If the sheet is tall (Portrait), scale width to match target aspect
        if ((sheetVisualW / sheetVisualH) < targetAspect) {
            canvasH = sheetVisualH;
            canvasW = canvasH * targetAspect;
        } else {
            // If sheet is wide, use its width
            canvasW = sheetVisualW;
            canvasH = canvasW / targetAspect;
        }

        // 3. Footer Setup
        // Fixed ratio height for the footer relative to canvas (looks consistent)
        const footerH = canvasH * 0.15; 
        const totalH = canvasH + footerH; // Extend total height to include footer

        // Centering offsets for the sheet
        const offX = (canvasW - sw) / 2;
        const offY = (canvasH - sh) / 2;

        // 4. Styling
        const style = {
            gridLine: "#cbd5e1",    // Slate-300
            bgFill: "#f1f5f9",      // Slate-100 (Graph Paper)
            sheetFill: "#ffffff",   // White Sheet
            sheetStroke: "#64748b", // Slate-500
            partFill: "rgba(37, 99, 235, 0.1)", // Blue-600 with opacity
            partStroke: "#2563eb",  // Blue-600
            bomBg: "#1e293b",       // Slate-800 Footer
            bomText: "#ffffff"      // White Text
        };

        // 5. Generate Parts
        let rects = "";
        let count = 0;

        outerLoop:
        for (let r = 0; r < layout.rows; r++) {
            for (let c = 0; c < layout.cols; c++) {
                if (count >= limitQty) break outerLoop;

                const x = c * layout.partW;
                const y = r * layout.partH;
                const label = `${layout.rotated ? inputs.h : inputs.w}x${layout.rotated ? inputs.w : inputs.h}`;
                const showLabel = (layout.partW > 6 && layout.partH > 6);

                rects += `<g transform="translate(${x}, ${y})">
                    <rect width="${layout.partW}" height="${layout.partH}" 
                          fill="${style.partFill}" 
                          stroke="${style.partStroke}" 
                          stroke-width="0.2" />
                    ${showLabel ? 
                        `<text x="${layout.partW/2}" y="${layout.partH/2}" 
                               font-family="sans-serif" font-size="1.5" 
                               fill="${style.partStroke}" text-anchor="middle" 
                               dominant-baseline="middle" font-weight="bold" opacity="0.8">${label}</text>` 
                    : ''}
                </g>`;
                count++;
            }
        }

        // 6. BoM Data & Text Scaling
        const totalSheets = Math.ceil(limitQty / layout.perSheet);
        const areaUsed = count * layout.partW * layout.partH;
        const wastePct = ((1 - (areaUsed / (sw * sh))) * 100).toFixed(1);
        const bomText = `REQ: ${totalSheets} SHT | STOCK: ${stockName} | WASTE: ${wastePct}%`;

        // Calculate dynamic font size to ensure it fits inside the footer width
        // We limit it to max 45% of footer height, but shrink it if the canvas is narrow
        const charCount = bomText.length;
        const maxFontSize = footerH * 0.45;
        const fitFontSize = (canvasW * 0.9) / (charCount * 0.6); // Approximate width per char
        const finalFontSize = Math.min(maxFontSize, fitFontSize);

        // 7. Render
        return `<svg viewBox="0 0 ${canvasW} ${totalH}" preserveAspectRatio="xMidYMid meet" style="width:100%; height:100%; display:block; background-color: ${style.bgFill};">
            <defs>
                <pattern id="grid" width="12" height="12" patternUnits="userSpaceOnUse">
                    <path d="M 12 0 L 0 0 0 12" fill="none" stroke="${style.gridLine}" stroke-width="0.5"/>
                </pattern>
            </defs>
            
            <rect width="${canvasW}" height="${totalH}" fill="url(#grid)" />
            
            <g transform="translate(${offX}, ${offY})">
                <rect x="1" y="1" width="${sw}" height="${sh}" fill="rgba(0,0,0,0.2)" />
                <rect width="${sw}" height="${sh}" fill="${style.sheetFill}" stroke="${style.sheetStroke}" stroke-width="0.5" />
                ${rects}
            </g>
            
            <g transform="translate(0, ${canvasH})">
                <rect width="${canvasW}" height="${footerH}" fill="${style.bomBg}" />
                <text x="${canvasW/2}" y="${footerH/2}" 
                      font-family="monospace" 
                      font-size="${finalFontSize}" 
                      fill="${style.bomText}" 
                      text-anchor="middle" 
                      dominant-baseline="middle" 
                      letter-spacing="0.5">
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
