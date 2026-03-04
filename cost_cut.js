/**
 * PURE PHYSICS ENGINE: Cut Vinyl Lettering (v3.0)
 * Upgraded to Educational Math Ledger format.
 */
function calculateCutVinyl(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // --- 1. RETAIL ENGINE ---
    let baseRate = parseFloat(data.Retail_Price_751 || 18.00);
    let costVinylRaw = parseFloat(data.Cost_Vinyl_751 || 0.95);
    
    if (inputs.material === 'Vehicle') { baseRate = parseFloat(data.Retail_Price_951 || 22); costVinylRaw = parseFloat(data.Cost_Vinyl_951 || 1.25); }
    else if (inputs.material === 'Backlit_8500') { baseRate = parseFloat(data.Retail_Price_8500 || 20); costVinylRaw = parseFloat(data.Cost_Vinyl_8500 || 1.25); }
    else if (inputs.material === 'Backlit_8800') { baseRate = parseFloat(data.Retail_Price_8800 || 25); costVinylRaw = parseFloat(data.Cost_Vinyl_8800 || 1.60); }

    let retailPrint = baseRate * totalSqFt;
    if (inputs.complexity === 'Complex') retailPrint += (totalSqFt * parseFloat(data.Retail_Weed_Complex_Add || 5));

    const feeSetup = parseFloat(data.Retail_Fee_Setup || 15);
    const minOrder = parseFloat(data.Retail_Min_Order || 45);
    const grandTotal = Math.max(retailPrint + feeSetup, minOrder);

    // --- 2. COST ENGINE (MATH LEDGER) ---
    const bd = [];
    const L = (label, total, formula) => { if(total > 0) bd.push({label, total, formula}); return total; };

    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    L(`Plotter Vinyl (${inputs.material})`, totalSqFt * costVinylRaw * wastePct, `${totalSqFt.toFixed(1)} SF * $${costVinylRaw}/SF * ${wastePct} Waste`);
    L(`Transfer Tape (Pre-Mask)`, totalSqFt * parseFloat(data.Cost_Transfer_Tape || 0.15) * wastePct, `${totalSqFt.toFixed(1)} SF * $0.15/SF * Waste`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);

    L(`Job Setup (File Pathing)`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);

    const cutHrs = totalSqFt / parseFloat(data.Speed_Cut_Graphtec || 50);
    L(`Plotter Run`, cutHrs * parseFloat(data.Rate_Machine_Cut || 5), `${cutHrs.toFixed(2)} Hrs * $5/hr`);
    L(`Plotter Load Labor`, cutHrs * rateOp * 0.25, `${cutHrs.toFixed(2)} Hrs * $${rateOp}/hr * 25%`);

    const weedSpeed = inputs.complexity === 'Complex' ? parseFloat(data.Time_Weed_Complex || 8) : parseFloat(data.Time_Weed_Simple || 2);
    L(`Weeding Labor`, ((totalSqFt * weedSpeed) / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * ${weedSpeed} Mins/SF * $${rateShop}/hr`);

    L(`Masking Labor`, ((totalSqFt * parseFloat(data.Time_Mask_SqFt || 1)) / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * 1 Min/SF * $${rateShop}/hr`);

    const perimeterLF = ((inputs.w * 2) + (inputs.h * 2)) / 12;
    L(`Hand Trimming (Perimeter)`, (perimeterLF * inputs.qty * parseFloat(data.Time_Cut_Hand || 0.25) / 60) * rateShop, `${(perimeterLF * inputs.qty).toFixed(1)} LF * 0.25 Mins/LF * $${rateShop}/hr`);

    let hardCostRaw = bd.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, setupFee: feeSetup, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: bd },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}
