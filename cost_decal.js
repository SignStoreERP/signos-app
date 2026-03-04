/**
 * PURE PHYSICS ENGINE: Decals & Stickers (v3.0)
 * Math Ledger upgrade, $50 Global Min, and Perimeter Hand Cut logic.
 */
function calculateDecal(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // --- 1. RETAIL ENGINE ---
    let baseRate = 0;
    if (inputs.material === 'Standard') baseRate = parseFloat(data.Retail_Price_Cal_SqFt || 8); 
    else if (inputs.material === 'Cast') baseRate = parseFloat(data.Retail_Price_Cast_SqFt || 14); 
    else if (inputs.material === 'Clear') baseRate = parseFloat(data.Retail_Price_Clear_SqFt || 10); 
    else if (inputs.material === 'Reflective') baseRate = parseFloat(data.Retail_Price_Reflective_SqFt || 15); 
    
    let retailPrint = baseRate * totalSqFt;
    let discPct = 0;
    if (inputs.qty >= (parseFloat(data.Tier_3_Qty) || 500)) discPct = parseFloat(data.Tier_3_Disc) || 0.20;
    else if (inputs.qty >= (parseFloat(data.Tier_2_Qty) || 100)) discPct = parseFloat(data.Tier_2_Disc) || 0.10;
    else if (inputs.qty >= (parseFloat(data.Tier_1_Qty) || 50)) discPct = parseFloat(data.Tier_1_Disc) || 0.05;
    retailPrint *= (1 - discPct);

    let retailWeed = inputs.complexity === 'Complex' ? totalSqFt * parseFloat(data.Retail_Weed_Complex || 2.50) : 0;
    const feeSetup = parseFloat(data.Retail_Fee_Setup || 15);

    // FIX: Using global Retail_Min_Order for $50
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotalRaw = retailPrint + retailWeed + feeSetup;
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE (MATH LEDGER) ---
    const bd = [];
    const L = (label, total, formula) => { if(total > 0) bd.push({label, total, formula}); return total; };

    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    let costVinylRaw = 0.21; // Standard
    if (inputs.material === 'Cast') costVinylRaw = parseFloat(data.Cost_Vin_Cast || 1.30);
    else if (inputs.material === 'Clear') costVinylRaw = parseFloat(data.Cost_Vin_Clear || 0.24);
    else if (inputs.material === 'Reflective') costVinylRaw = parseFloat(data.Cost_Vin_Reflective || 1.80);

    const rawVin = L(`Vinyl Media (${inputs.material})`, totalSqFt * costVinylRaw * wastePct, `${totalSqFt.toFixed(1)} SF * $${costVinylRaw}/SF * ${wastePct} Waste`);
    const costInk = L(`Latex Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16), `${totalSqFt.toFixed(1)} SF * $0.16/SF`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const costSetup = L(`Job Setup (File RIP)`, (parseFloat(data.Time_Setup_Job || 15) / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    
    const printHrs = totalSqFt / parseFloat(data.Speed_Print_Roll || 150);
    const costPrintOp = L(`Print Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    const costPrintMach = L(`Roll Printer Run`, printHrs * parseFloat(data.Rate_Machine_Print || 5), `${printHrs.toFixed(2)} Hrs * $5/hr`);

    const cutHrs = totalSqFt / parseFloat(data.Speed_Cut_Graphtec || 50);
    const costCutMach = L(`Plotter Run`, cutHrs * parseFloat(data.Rate_Machine_Cut || 5), `${cutHrs.toFixed(2)} Hrs * $5/hr`);
    const costCutOp = L(`Plotter Load Labor`, cutHrs * rateOp * 0.25, `${cutHrs.toFixed(2)} Hrs * $${rateOp}/hr * 25%`);

    const weedSpeed = inputs.complexity === 'Complex' ? parseFloat(data.Time_Weed_Complex || 8) : parseFloat(data.Time_Weed_Simple || 2);
    const costWeedOp = L(`Weeding Labor`, ((totalSqFt * weedSpeed) / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * ${weedSpeed} Mins/SF * $${rateShop}/hr`);

    // Hand Cut perimeters of roll media
    const perimeterLF = ((inputs.w * 2) + (inputs.h * 2)) / 12;
    const handMins = perimeterLF * inputs.qty * parseFloat(data.Time_Cut_Hand || 0.25);
    const costCutHand = L(`Hand Trimming (Roll Edge)`, (handMins / 60) * rateShop, `${(perimeterLF * inputs.qty).toFixed(1)} LF * 0.25 Mins/LF * $${rateShop}/hr`);

    const subTotal = rawVin + costInk + costSetup + costPrintOp + costPrintMach + costCutMach + costCutOp + costWeedOp + costCutHand;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, weedFee: retailWeed, setupFee: feeSetup, grandTotal: grandTotal },
        cost: { total: subTotal * riskFactor, breakdown: bd },
        metrics: { margin: (grandTotal - (subTotal * riskFactor)) / grandTotal }
    };
}

window.DECAL_CONFIG = {
    tab: 'PROD_Decals', engine: calculateDecal,
    controls: [
        { id: 'material', label: 'Material', type: 'select', opts: [{v:'Standard', t:'Standard Cal'}, {v:'Cast', t:'Premium Cast'}, {v:'Clear', t:'Clear'}, {v:'Translucent', t:'Translucent'}, {v:'Reflective', t:'Reflective'}] },
        { id: 'shape', label: 'Cut Type', type: 'select', opts: [{v:'Rectangle', t:'Square Cut'}, {v:'Contour', t:'Contour Cut'}] },
        { id: 'weeding', label: 'Weeding Level', type: 'select', opts: [{v:'Standard', t:'Standard'}, {v:'Complex', t:'Complex'}] },
        { id: 'masking', label: 'Apply Tape?', type: 'select', opts: [{v:'No', t:'No'}, {v:'Yes', t:'Yes'}] }
    ],
    retails: [ { key: 'Retail_Price_Cal_SqFt', label: 'Cal Base Rate ($)' } ],
    costs: [ { key: 'Cost_Vin_Cal', label: 'Cal Vinyl ($)' } ]
};

