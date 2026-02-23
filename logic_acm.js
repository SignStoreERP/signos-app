/**
 * PURE PHYSICS ENGINE: ACM Signs (v3.3 - Dual Track)
 * Implements strict Area Curve loop fixing the "T1 Overcharge" bug.
 */

function calculateACM(inputs, data) {
    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const prefix = inputs.thickness === '6mm' ? 'ACM6' : 'ACM3';

    // A. Dynamic Area Curve Loop (Fixed)
    let baseSqFtRate = inputs.thickness === '6mm' ? 16.50 : 14.00; // Fallbacks
    let signMinPrice = 0;
    let t = 1;

    while (data[`${prefix}_T${t}_Max`]) {
        if (sqft <= parseFloat(data[`${prefix}_T${t}_Max`])) {
            baseSqFtRate = parseFloat(data[`${prefix}_T${t}_Rate`]);
            signMinPrice = parseFloat(data[`${prefix}_T${t}_Min`] || 0);
            break;
        }
        t++;
    }

    // B. Calculate Base Sign Price
    let baseUnitPrice = baseSqFtRate * sqft;
    if (baseUnitPrice < signMinPrice) baseUnitPrice = signMinPrice;

    // C. Modifiers (Black, Double Sided)
    const dsMult = parseFloat(data.Retail_Adder_DS_Mult || 0.5); // 50% adder
    const blkMult = parseFloat(data.Retail_Adder_Black_Mult || 2); // 100% adder for 6mm

    if (inputs.sides === 2) baseUnitPrice += (baseUnitPrice * dsMult);
    if (inputs.color === 'Black' && inputs.thickness === '6mm') baseUnitPrice *= blkMult;

    // D. Router / Cutting Fees
    const isCNC = inputs.shape !== 'Rectangle';
    let routerFee = 0;
    if (isCNC) {
        const easyFee = parseFloat(data.Retail_Fee_Router_Easy || 30);
        const hardFee = parseFloat(data.Retail_Fee_Router_Hard || 50);
        routerFee = inputs.shape === 'Easy' ? easyFee : hardFee;
    }

    // E. Quantity Discounts
    let appliedBase = baseUnitPrice;
    let i = 1;
    const tierLog = [];
    while (data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tDisc = parseFloat(data[`Tier_${i}_Disc`] || 0);

        let discountedUnit = baseUnitPrice * (1 - tDisc);
        if (inputs.qty >= tQty) appliedBase = discountedUnit;

        tierLog.push({ q: tQty, base: baseUnitPrice, unit: discountedUnit, pct: tDisc });
        i++;
    }

    const retailPrint = appliedBase * inputs.qty;

    // F. Fees & Minimums
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15);
    const feeDesignBase = parseFloat(data.Retail_Fee_Design || 45);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;
    const feeDesign = inputs.incDesign ? (feeDesignBase * inputs.files) : 0;

    const grandTotalRaw = retailPrint + routerFee + feeSetup + feeDesign;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const wasteFactor = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);

    // A. Material Yield
    const stockSheets = inputs.thickness === '6mm'
        ? [
            {name: "4x8", w: 48, h: 96, cost: parseFloat(data.Cost_Stock_6mm_4x8 || 72.10)},
            {name: "5x10", w: 60, h: 120, cost: parseFloat(data.Cost_Stock_6mm_5x10 || 132.39)}
          ]
        : [
            {name: "4x8", w: 48, h: 96, cost: parseFloat(data.Cost_Stock_3mm_4x8 || 52.09)},
            {name: "4x10", w: 48, h: 120, cost: parseFloat(data.Cost_Stock_3mm_4x10 || 69.44)},
            {name: "5x10", w: 60, h: 120, cost: parseFloat(data.Cost_Stock_3mm_5x10 || 75.75)}
          ];

    // Simplistic yield calculation for headless (area based)
    const signArea = inputs.w * inputs.h;
    const totalAreaCalc = signArea * inputs.qty;
    let bestStock = stockSheets;
    let lowestCost = Infinity;

    stockSheets.forEach(sheet => {
        const sheetArea = sheet.w * sheet.h;
        const sheetsNeeded = Math.ceil((totalAreaCalc * wasteFactor) / sheetArea);
        const totalBoardCost = sheetsNeeded * sheet.cost;
        if (totalBoardCost < lowestCost) {
            lowestCost = totalBoardCost;
            bestStock = sheet;
        }
    });

    const rawMat = lowestCost;
    const wasteCost = rawMat - (rawMat / wasteFactor);
    const wastePct = wasteFactor;

    // B. Ink Cost (Always double if DS)
    const inkSqFt = parseFloat(data.Cost_Ink_Latex || 0.16);
    const printSqFt = totalSqFt * inputs.sides;
    const totalInk = printSqFt * inkSqFt;

    // C. Print Times & Labor
    const speedLF = parseFloat(data.Machine_Speed_LF_Hr || 25);
    const ratePrintMach = parseFloat(data.Rate_Machine_Flatbed || 10);
    const rateOp = parseFloat(data.Rate_Operator || 25);

    const linearFeet = totalSqFt / 4; // Approx feed width
    const printHrs = linearFeet / speedLF;
    const costPrintMach = printHrs * ratePrintMach;
    const costPrintOp = printHrs * rateOp * attnRatio;

    // D. Cutting & Finishing (Shear vs CNC vs Round)
    let costCutSetup = 0;
    let costCutLabor = 0;
    let costCutMach = 0;
    let costRound = 0;
    let runHrsCNC = 0;

    if (!isCNC) {
        // Shear Cutting
        const shearSetupMins = parseFloat(data.Time_Shear_Setup || 5);
        const shearCutMins = parseFloat(data.Time_Shear_Cut || 1);
        costCutSetup = (shearSetupMins / 60) * rateOp;
        costCutLabor = ((shearCutMins * inputs.qty) / 60) * rateOp;

        // Round Corners (Manual)
        if (inputs.rounded) {
            const roundSetup = parseFloat(data.Time_Round_Setup || 5);
            const roundCorner = parseFloat(data.Time_Round_Corner || 0.5);
            const totalRoundHrs = (roundSetup + (roundCorner * 4 * inputs.qty)) / 60;
            costRound = totalRoundHrs * rateOp;
        }
    } else {
        // CNC Routing
        const rateCNC = parseFloat(data.Rate_CNC_Labor || 25);
        const rateMachCNC = parseFloat(data.Rate_Machine_CNC || 10);
        const cncSetup = parseFloat(data.Time_Setup_CNC || 10);
        const cncSpeed = inputs.shape === 'Easy'
            ? parseFloat(data.Time_CNC_Easy_SqFt || 1)
            : parseFloat(data.Time_CNC_Complex_SqFt || 2);

        runHrsCNC = (cncSpeed * totalSqFt) / 60;
        costCutSetup = (cncSetup / 60) * rateCNC;
        costCutMach = runHrsCNC * rateMachCNC;
        costCutLabor = runHrsCNC * rateCNC * attnRatio;
    }

    // E. Totals
    const rawSubTotal = rawMat + totalInk + costPrintMach + costPrintOp + costCutSetup + costCutLabor + costCutMach + costRound;
    const riskBuffer = rawSubTotal * (riskFactor - 1);
    const subTotal = rawSubTotal + riskBuffer;

    return {
        retail: {
            unitPrice: appliedBase,
            printTotal: retailPrint,
            routerFee: routerFee,
            setupFee: feeSetup,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            minOrderValue: minOrder,
            tiers: tierLog
        },
        cost: {
            total: subTotal,
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
        metrics: { margin: (grandTotal - subTotal) / grandTotal }
    };
}

// ==========================================
// SIMULATOR CONFIGURATION SCHEMA
// ==========================================
window.ACM_CONFIG = {
    tab: 'PROD_ACM_Signs',
    engine: calculateACM,
    controls: [
        { id: 'w', label: 'Width', type: 'number', def: 24 },
        { id: 'h', label: 'Height', type: 'number', def: 18 },
        { id: 'thickness', label: 'Material', type: 'select', opts: [{v:'3mm', t:'3mm Std'}, {v:'6mm', t:'6mm HD'}] },
        { id: 'sides', label: 'Sides', type: 'select', opts: [{v:1, t:'1-Sided'}, {v:2, t:'2-Sided'}] },
        { id: 'color', label: 'Color', type: 'select', opts: [{v:'White', t:'White'}, {v:'Black', t:'Black'}] },
        { id: 'shape', label: 'Cut Type', type: 'select', opts: [{v:'Rectangle', t:'Shear Cut'}, {v:'Easy', t:'CNC Simple'}, {v:'Complex', t:'CNC Complex'}] },
        { id: 'rounded', label: 'Rounded Corners (Shear Only)', type: 'toggle', def: false },
        { id: 'setupPerFile', label: 'Setup Per File', type: 'toggle', def: false },
        { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    retails: [
        { heading: 'Market Base ($/SqFt)', key: 'ACM3_T1_Rate', label: '3mm Rate ($)' },
        { key: 'ACM6_T1_Rate', label: '6mm Rate ($)' },
        { heading: 'Volume Discounts', key: 'Tier_1_Qty', label: 'Tier 1 Trigger (Qty)' },
        { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' },
        { heading: 'Router Constraints', key: 'Retail_Fee_Router_Easy', label: 'CNC Easy Fee ($)' },
        { key: 'Retail_Fee_Router_Hard', label: 'CNC Hard Fee ($)' },
        { heading: 'Flat Fees', key: 'Retail_Fee_Setup', label: 'Setup Fee ($)' },
        { key: 'Retail_Fee_Design', label: 'Design Fee ($)' }
    ],
    costs: [
        { key: 'Cost_Stock_3mm_4x8', label: '3mm 4x8 Sheet ($)' },
        { key: 'Cost_Stock_6mm_4x8', label: '6mm 4x8 Sheet ($)' },
        { key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },
        { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_CNC_Labor', label: 'CNC Operator ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'Router Mach ($/Hr)' },
        { key: 'Rate_Machine_Flatbed', label: 'Printer Mach ($/Hr)' },
        { key: 'Machine_Speed_LF_Hr', label: 'Print Spd (LF/hr)' },
        { key: 'Time_Shear_Setup', label: 'Shear Setup (Mins)' },
        { key: 'Time_Shear_Cut', label: 'Shear Cut (Mins/Ea)' },
        { key: 'Time_Round_Setup', label: 'Corner Setup (Mins)' },
        { key: 'Time_Round_Corner', label: 'Cut Corner (Mins/Ea)' },
        { key: 'Time_Setup_CNC', label: 'CNC Setup (Mins)' },
        { key: 'Time_CNC_Easy_SqFt', label: 'CNC Easy (Mins/SqFt)' },
        { key: 'Time_CNC_Complex_SqFt', label: 'CNC Complex (Mins/SqFt)' },
        { key: 'Waste_Factor', label: 'Waste (1.x)' },
        { key: 'Factor_Risk', label: 'Risk (1.x)' },
        { key: 'Labor_Attendance_Ratio', label: 'Attn Ratio (0-1)' }
    ],
    dynamicUI: function(inputs) {
        const roundedEl = document.getElementById('cfg-rounded');
        if (roundedEl) {
            const roundedToggleWrap = roundedEl.closest('div').parentElement;
            if (inputs.shape !== 'Rectangle') {
                roundedToggleWrap.style.opacity = '0.3';
                roundedToggleWrap.style.pointerEvents = 'none';
                inputs.rounded = false;
                roundedEl.checked = false;
            } else {
                roundedToggleWrap.style.opacity = '1';
                roundedToggleWrap.style.pointerEvents = 'auto';
            }
        }
        return inputs;
    },
    renderReceipt: function(data, fmt) {
        let retailHTML = `
            <div>
                <h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
                <div class="space-y-1 text-xs text-gray-700">
                    <div class="flex justify-between"><span>Base Print:</span> <span>${fmt(data.retail.printTotal)}</span></div>
                    ${data.retail.routerFee > 0 ? `<div class="flex justify-between text-orange-600"><span>CNC Router Fee:</span> <span>${fmt(data.retail.routerFee)}</span></div>` : ''}
                    <div class="flex justify-between"><span>Job Setup:</span> <span>${fmt(data.retail.setupFee)}</span></div>
                    ${data.retail.designFee > 0 ? `<div class="flex justify-between text-purple-700"><span>Design Fee:</span> <span>${fmt(data.retail.designFee)}</span></div>` : ''}
                    <div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Retail:</span> <span>${fmt(data.retail.grandTotal)}</span></div>
                </div>
            </div>
        `;

        let costHTML = `
            <div class="mt-6">
                <h4 class="text-[10px] font-bold text-red-800 uppercase mb-2 border-b border-red-200 pb-1">Physics Engine (Cost)</h4>
                <div class="space-y-1 text-xs text-gray-700">
                    <h4 class="text-[9px] font-bold text-gray-500 uppercase mb-1 mt-2">Materials</h4>
                    <div class="flex justify-between"><span>Substrate (Raw Sheets):</span> <span>${fmt(data.cost.breakdown.rawBlanks)}</span></div>
                    <div class="flex justify-between"><span>Total Ink:</span> <span>${fmt(data.cost.breakdown.totalInk)}</span></div>
                    
                    <div class="border-t border-gray-200 mt-2 pt-1"></div>
                    <h4 class="text-[9px] font-bold text-gray-500 uppercase mb-1">Labor & Time</h4>
                    <div class="flex justify-between"><span>File/Machine Setup:</span> <span>${fmt(data.cost.breakdown.costSetup)}</span></div>
                    <div class="flex justify-between"><span>Cutting & Finishing:</span> <span>${fmt(data.cost.breakdown.costCut)}</span></div>
                    ${data.cost.breakdown.costRound > 0 ? `<div class="flex justify-between"><span>Corner Rounding:</span> <span>${fmt(data.cost.breakdown.costRound)}</span></div>` : ''}
                    <div class="flex justify-between" title="Total hours the substrate sits on the printer/router bed."><span class="cursor-help border-b border-dotted border-gray-400">Machine Run (${data.cost.breakdown.runHrs ? data.cost.breakdown.runHrs.toFixed(2) : 0}h):</span> <span>${fmt(data.cost.breakdown.costMachine)}</span></div>
                    <div class="flex justify-between" title="Operator labor adjusted by the Attendance Ratio."><span class="cursor-help border-b border-dotted border-gray-400">Operator (Attn Ratio):</span> <span>${fmt(data.cost.breakdown.costOp)}</span></div>

                    <div class="border-t border-gray-200 mt-2 pt-1"></div>
                    <h4 class="text-[9px] font-bold text-gray-500 uppercase mb-1">Additives & Risk</h4>
                    <div class="flex justify-between text-red-600" title="Physical material expected to be lost to drops or cuts. This IS added to your total cost."><span class="cursor-help border-b border-dotted border-red-400">Material Waste (${data.cost.breakdown.wastePct ? data.cost.breakdown.wastePct.toFixed(0) : 10}%):</span> <span>+ ${fmt(data.cost.breakdown.wasteCost)}</span></div>
                    <div class="flex justify-between text-orange-500 opacity-80" title="Suggested financial buffer for mistakes. This is an INDICATOR ONLY and is NOT added to your hard cost."><span class="cursor-help border-b border-dotted border-orange-300">Suggested Risk Buffer (${data.cost.breakdown.riskPct ? data.cost.breakdown.riskPct.toFixed(0) : 5}%):</span> <span>(+ ${fmt(data.cost.breakdown.riskCost)})</span></div>
                    
                    <div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div>
                </div>
            </div>
        `;
        return retailHTML + costHTML;
    }
};
