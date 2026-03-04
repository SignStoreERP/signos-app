/**
 * PURE PHYSICS ENGINE: Decals & Stickers (v2.1)
 * Expanded for Clear & Reflective Media
 */
function calculateDecal(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // --- 1. RETAIL ENGINE ---
    let baseRate = 0;
    let matLabel = "";
    if (inputs.material === 'Standard') { baseRate = parseFloat(data.Retail_Price_Cal_SqFt || 8); matLabel = "Standard Cal"; }
    else if (inputs.material === 'Cast') { baseRate = parseFloat(data.Retail_Price_Cast_SqFt || 14); matLabel = "Premium Cast"; }
    else if (inputs.material === 'Clear') { baseRate = parseFloat(data.Retail_Price_Clear_SqFt || 10); matLabel = "Clear Vinyl"; }
    else if (inputs.material === 'Reflective') { baseRate = parseFloat(data.Retail_Price_Reflective_SqFt || 15); matLabel = "Reflective"; }
    
    let retailPrint = baseRate * totalSqFt;

    let discPct = 0;
    if (inputs.qty >= (parseFloat(data.Tier_3_Qty) || 500)) discPct = parseFloat(data.Tier_3_Disc) || 0.20;
    else if (inputs.qty >= (parseFloat(data.Tier_2_Qty) || 100)) discPct = parseFloat(data.Tier_2_Disc) || 0.10;
    else if (inputs.qty >= (parseFloat(data.Tier_1_Qty) || 50)) discPct = parseFloat(data.Tier_1_Disc) || 0.05;

    retailPrint *= (1 - discPct);

    let retailWeed = 0;
    if (inputs.complexity === 'Complex') retailWeed = totalSqFt * parseFloat(data.Retail_Weed_Complex || 2.50);

    const feeSetup = inputs.setupPerFile ? parseFloat(data.Retail_Fee_Setup || 15) * inputs.files : parseFloat(data.Retail_Fee_Setup || 15);
    const minOrder = parseFloat(data.Retail_Min_Order || 35);
    const grandTotalRaw = retailPrint + retailWeed + feeSetup;
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE ---
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    
    let costVinylRaw = 0.21; // Standard
    if (inputs.material === 'Cast') costVinylRaw = parseFloat(data.Cost_Vin_Cast || 1.30);
    else if (inputs.material === 'Clear') costVinylRaw = parseFloat(data.Cost_Vin_Clear || 0.24);
    else if (inputs.material === 'Reflective') costVinylRaw = parseFloat(data.Cost_Vin_Reflective || 1.80);

    const costVinyl = totalSqFt * costVinylRaw * wastePct;
    const costInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    
    const costSetup = (parseFloat(data.Time_Setup_Job || 15) / 60) * rateOp;
    
    const printHrs = totalSqFt / parseFloat(data.Speed_Print_Roll || 150);
    const costPrintOp = printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintMach = printHrs * parseFloat(data.Rate_Machine_Print || 5);

    const cutHrs = totalSqFt / parseFloat(data.Speed_Cut_Graphtec || 50);
    const costCutMach = cutHrs * parseFloat(data.Rate_Machine_Cut || 5);
    const costCutOp = cutHrs * rateOp * 0.25;

    const weedSpeed = inputs.complexity === 'Complex' ? parseFloat(data.Time_Weed_Complex || 8) : parseFloat(data.Time_Weed_Simple || 2);
    const costWeedOp = ((totalSqFt * weedSpeed) / 60) * rateShop;

    const subTotal = costVinyl + costInk + costSetup + costPrintOp + costPrintMach + costCutMach + costCutOp + costWeedOp;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, weedFee: retailWeed, setupFee: feeSetup, grandTotal: grandTotal, isMinApplied: grandTotalRaw < minOrder },
        cost: { total: subTotal * riskFactor, breakdown: { rawVinyl: costVinyl, totalInk: costInk, costSetup: costSetup, costPrint: costPrintOp + costPrintMach, costCut: costCutMach + costCutOp, costWeed: costWeedOp, riskCost: subTotal * (riskFactor - 1) } },
        metrics: { margin: (grandTotal - (subTotal * riskFactor)) / grandTotal }
    };
}

window.DECAL_CONFIG = {
    tab: 'PROD_Decals',
    engine: calculateDecal,
    controls: [
        { id: 'w', label: 'Width (in)', type: 'number', def: 4 },
        { id: 'h', label: 'Height (in)', type: 'number', def: 4 },
        { id: 'material', label: 'Material', type: 'select', opts: [{v:'Standard', t:'Standard (Cal)'}, {v:'Cast', t:'Premium (Cast)'}, {v:'Clear', t:'Clear (Oracal 3640)'}, {v:'Reflective', t:'Reflective'}] },
        { id: 'complexity', label: 'Weeding', type: 'select', opts: [{v:'Simple', t:'Simple (Standard)'}, {v:'Complex', t:'Complex (Small/Serifs)'}] }
    ],
    retails: [
        { key: 'Retail_Price_Cal_SqFt', label: 'Std Rate ($/sf)' },
        { key: 'Retail_Price_Cast_SqFt', label: 'Cast Rate ($/sf)' },
        { key: 'Retail_Price_Clear_SqFt', label: 'Clear Rate ($/sf)' },
        { key: 'Retail_Price_Reflective_SqFt', label: 'Reflective Rate ($/sf)' }
    ],
    costs: [
        { key: 'Cost_Vin_Cal', label: 'Std Vinyl ($/sf)' },
        { key: 'Cost_Vin_Cast', label: 'Cast Vinyl ($/sf)' },
        { key: 'Cost_Vin_Clear', label: 'Clear Vinyl ($/sf)' },
        { key: 'Cost_Vin_Reflective', label: 'Reflective Vinyl ($/sf)' }
    ]
};
