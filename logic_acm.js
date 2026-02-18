/**
 * PURE PHYSICS ENGINE: ACM Signs (v2.8.0)
 * Features: Unified Dashboard, Auto-Sizing Container, Engineering Grid.
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
    // UPDATED: Unified Dashboard (Hides HTML footer, draws everything in SVG)
    function generateSVG(layout, limitQty, stockName) {
        if (!layout) return "";
        
        // A. DOM MANIPULATION (The "Takeover")
        // We find the container and the existing HTML footer to seamlessly replace them.
        let boxW = 500, boxH = 300; // Defaults
        const container = document.getElementById('nest-container');
        if (container) {
            boxW = container.clientWidth || 500;
            boxH = container.clientHeight || 300;
            
            // Hide the default HTML footer to prevent overlap
            // We look for the absolute positioned div at the bottom
            const oldFooter = container.querySelector('.absolute.bottom-0');
            if (oldFooter) oldFooter.style.display = 'none';
        }

        // B. Dimensions
        const sw = layout.sheetW;
        const sh = layout.sheetH;
        
        // Footer Height: Fixed pixel height for the dashboard (approx 60px)
        const footerH = 60; 
        const canvasW = boxW;
        const canvasH = boxH;
        const viewH = canvasH - footerH; // Area available for drawing the sheet

        // C. Scaling (Fit Sheet into View Area)
        // We calculate the scale factor to fit the sheet within the view area (with padding)
        const pad = 20;
        const scaleX = (canvasW - (pad*2)) / sw;
        const scaleY = (viewH - (pad*2)) / sh;
        const scale = Math.min(scaleX, scaleY);
        
        // Center the sheet
        const drawW = sw * scale;
        const drawH = sh * scale;
        const offX = (canvasW - drawW) / 2;
        const offY = (viewH - drawH) / 2;

        // D. Styling (Engineering Blueprints)
        const style = {
            bgFill: "#ffffff",      // White Paper
            gridMajor: "#bfdbfe",   // Blue-200
            gridMinor: "#f0f9ff",   // Sky-50
            sheetFill: "#ffffff",   // White Sheet
            sheetStroke: "#334155", // Slate-700
            partFill: "rgba(37, 99, 235, 0.15)", // Blue-600 Light
            partStroke: "#2563eb",  // Blue-600
            footerBg: "#0f172a",    // Slate-900 (Unified Footer)
            textMain: "#f8fafc",    // Slate-50
            textAccent: "#38bdf8",  // Sky-400
            textDim: "#64748b"      // Slate-500
        };

        // E. Logic: Active Sheet Calculation
        const remainder = limitQty % layout.perSheet;
        const itemsOnActiveSheet = (remainder === 0) ? layout.perSheet : remainder;
        const fullSheets = (remainder === 0) ? (limitQty / layout.perSheet) : Math.floor(limitQty / layout.perSheet);
        const partialSheets = (remainder === 0) ? 0 : 1;
        const totalSheetsNeeded = Math.ceil(limitQty / layout.perSheet);
        
        const areaUsed = itemsOnActiveSheet * layout.partW * layout.partH;
        const wastePct = ((1 - (areaUsed / (sw * sh))) * 100).toFixed(0);

        // F. Generate Parts (Scaled)
        let rects = "";
        let count = 0;
        outerLoop:
        for (let r = 0; r < layout.rows; r++) {
            for (let c = 0; c < layout.cols; c++) {
                if (count >= itemsOnActiveSheet) break outerLoop;
                const px = c * layout.partW;
                const py = r * layout.partH;
                const label = `${layout.rotated ? inputs.h : inputs.w}x${layout.rotated ? inputs.w : inputs.h}`;
                const showLabel = (layout.partW * scale > 30 && layout.partH * scale > 15); // Dynamic label hiding

                rects += `<g transform="translate(${px}, ${py})">
                    <rect width="${layout.partW}" height="${layout.partH}" 
                          fill="${style.partFill}" 
                          stroke="${style.partStroke}" 
                          stroke-width="${1/scale}" />
                    ${showLabel ? 
                        `<text x="${layout.partW/2}" y="${layout.partH/2}" 
                               font-family="sans-serif" font-size="${12/scale}" 
                               fill="${style.partStroke}" text-anchor="middle" 
                               dominant-baseline="middle" font-weight="bold" opacity="0.9">${label}</text>` 
                    : ''}
                </g>`;
                count++;
            }
        }

        // G. Render Full Window SVG
        // Note: We use pixel-perfect viewBox based on the container size
        return `<svg viewBox="0 0 ${canvasW} ${canvasH}" preserveAspectRatio="xMidYMid meet" style="width:100%; height:100%; display:block; background-color: ${style.bgFill};">
            <defs>
                <pattern id="gridMinor" width="15" height="15" patternUnits="userSpaceOnUse">
                    <path d="M 15 0 L 0 0 0 15" fill="none" stroke="${style.gridMinor}" stroke-width="1"/>
                </pattern>
                <pattern id="gridMajor" width="150" height="150" patternUnits="userSpaceOnUse">
                    <rect width="150" height="150" fill="url(#gridMinor)" />
                    <path d="M 150 0 L 0 0 0 150" fill="none" stroke="${style.gridMajor}" stroke-width="1"/>
                </pattern>
            </defs>
            
            <rect width="${canvasW}" height="${canvasH}" fill="url(#gridMajor)" />
            
            <g transform="translate(${offX}, ${offY}) scale(${scale})">
                <rect x="${2/scale}" y="${2/scale}" width="${sw}" height="${sh}" fill="rgba(0,0,0,0.1)" />
                <rect width="${sw}" height="${sh}" fill="${style.sheetFill}" stroke="${style.sheetStroke}" stroke-width="${2/scale}" />
                ${rects}
            </g>
            
            <g transform="translate(0, ${viewH})">
                <rect width="${canvasW}" height="${footerH}" fill="${style.footerBg}" />
                
                <text x="15" y="22" font-family="sans-serif" font-size="14" fill="${style.textMain}" font-weight="bold">
                    STOCK: ${stockName}
                </text>
                <text x="${canvasW/2}" y="22" font-family="sans-serif" font-size="14" fill="${style.textAccent}" text-anchor="middle" font-weight="bold">
                    REQ: ${totalSheetsNeeded} SHEET${totalSheetsNeeded>1?'S':''} (${fullSheets} FULL / ${partialSheets} OPEN)
                </text>
                <text x="${canvasW-15}" y="22" font-family="sans-serif" font-size="14" fill="${style.textMain}" text-anchor="end" font-weight="bold">
                    WASTE: ${wastePct}%
                </text>
                
                <line x1="0" y1="38" x2="${canvasW}" y2="38" stroke="#334155" stroke-width="1" />
                <text x="${canvasW/2}" y="52" font-family="sans-serif" font-size="10" fill="${style.textDim}" text-anchor="middle" letter-spacing="0.5">
                    PRODUCTION SIMULATION: Analyzes material yield and cut paths to inform accurate costing.
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
