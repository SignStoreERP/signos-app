/**
 * PURE PHYSICS ENGINE: Cut Vinyl Lettering (v4.0)
 * Dual-Ledger Arrays and explicit hand cutting.
 */
function calculateCutVinyl(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // --- 1. RETAIL ENGINE ---
    const ret = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let baseRate = parseFloat(data.Retail_Price_751 || 18.00);
    if (inputs.material === 'Vehicle') baseRate = parseFloat(data.Retail_Price_951 || 22);
    else if (inputs.material === 'Backlit_8500') baseRate = parseFloat(data.Retail_Price_8500 || 20);
    else if (inputs.material === 'Backlit_8800') baseRate = parseFloat(data.Retail_Price_8800 || 25);

    R(`Cut Vinyl (${inputs.material})`, baseRate * totalSqFt, `${totalSqFt.toFixed(1)} SF @ $${baseRate}`);
    
    if (inputs.complexity === 'Complex') R(`Complex Weeding Markup`, totalSqFt * parseFloat(data.Retail_Weed_Complex_Add || 5), `${totalSqFt.toFixed(1)} SF @ $5.00`);


    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 45);
    const grandTotal = Math.max(grandTotalRaw, minOrder);


    // --- 2. COST ENGINE ---
    const cst = [];
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    let costVinylRaw = parseFloat(data.Cost_Vinyl_751 || 0.95);
    if (inputs.material === 'Vehicle') costVinylRaw = parseFloat(data.Cost_Vinyl_951 || 1.25);
    else if (inputs.material === 'Backlit_8500') costVinylRaw = parseFloat(data.Cost_Vinyl_8500 || 1.25);
    else if (inputs.material === 'Backlit_8800') costVinylRaw = parseFloat(data.Cost_Vinyl_8800 || 1.60);

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

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.CUT_CONFIG = {
    tab: 'PROD_Cut_Vinyl', engine: calculateCutVinyl,
    controls: [
        { id: 'material', label: 'Material Series', type: 'select', opts: [{v:'751', t:'Oracal 751 (Flat)'}, {v:'951', t:'Oracal 951 (Vehicle)'}, {v:'8500', t:'Oracal 8500 (Backlit)'}, {v:'8800', t:'Oracal 8800 (Premium Trans)'}] },
        { id: 'complexity', label: 'Weeding Level', type: 'select', opts: [{v:'Standard', t:'Standard'}, {v:'Complex', t:'Complex'}] }
    ],
    retails: [ { key: 'Retail_Price_751', label: '751 Base Rate ($)' } ],
    costs: [ { key: 'Cost_Vinyl_751', label: '751 Vinyl ($)' }, { key: 'Cost_Transfer_Tape', label: 'Mask Tape ($)' } ]
};
