/**
 * PURE PHYSICS ENGINE: Decals & Stickers (v3.1)
 * Dual-Ledger Arrays and explicit perimeter hand cutting.
 */
function calculateDecal(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    const ret = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let baseRate = 0;
    if (inputs.material === 'Standard') baseRate = parseFloat(data.Retail_Price_Cal_SqFt || 8);
    else if (inputs.material === 'Cast') baseRate = parseFloat(data.Retail_Price_Cast_SqFt || 14);
    else if (inputs.material === 'Clear') baseRate = parseFloat(data.Retail_Price_Clear_SqFt || 10);
    else if (inputs.material === 'Reflective') baseRate = parseFloat(data.Retail_Price_Reflective_SqFt || 15);
    
    R(`Printed Vinyl (${inputs.material})`, baseRate * totalSqFt, `${totalSqFt.toFixed(1)} SF @ $${baseRate}`);

    if (inputs.shape === 'Contour') R(`Contour Cut Markup`, (baseRate * totalSqFt) * parseFloat(data.Retail_Cut_Contour_Add || 0.25), `25% Shape Surcharge`);
    if (inputs.complexity === 'Complex') R(`Complex Weeding`, totalSqFt * parseFloat(data.Retail_Weed_Complex || 2.5), `${totalSqFt.toFixed(1)} SF @ $2.50`);
    if (inputs.masking === 'Yes') R(`Pre-Mask Application`, totalSqFt * parseFloat(data.Retail_Adder_Mask_SqFt || 1), `${totalSqFt.toFixed(1)} SF @ $1.00`);
    

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 35);
    const grandTotal = Math.max(grandTotalRaw, minOrder);


    // --- COST ENGINE ---
    const cst = [];
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    let costVinylRaw = inputs.material === 'Cast' ? parseFloat(data.Cost_Vin_Cast || 1.30) : parseFloat(data.Cost_Vin_Cal || 0.21);

    L(`Vinyl Media (${inputs.material})`, totalSqFt * costVinylRaw * wastePct, `${totalSqFt.toFixed(1)} SF * $${costVinylRaw}/SF * ${wastePct} Waste`);
    L(`Latex Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16), `${totalSqFt.toFixed(1)} SF * $0.16/SF`);
    
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);

    L(`Job Setup (File RIP)`, (parseFloat(data.Time_Setup_Job || 15) / 60) * rateOp, `15 Mins * $${rateOp}/hr`);

    const printHrs = totalSqFt / parseFloat(data.Speed_Print_Roll || 150);
    L(`Print Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Roll Printer Run`, printHrs * parseFloat(data.Rate_Machine_Print || 5), `${printHrs.toFixed(2)} Hrs * $5/hr`);

    const cutHrs = totalSqFt / parseFloat(data.Speed_Cut_Graphtec || 50);
    L(`Plotter Run`, cutHrs * parseFloat(data.Rate_Machine_Cut || 5), `${cutHrs.toFixed(2)} Hrs * $5/hr`);
    L(`Plotter Load Labor`, cutHrs * rateOp * 0.25, `${cutHrs.toFixed(2)} Hrs * $${rateOp}/hr * 25%`);

    const weedSpeed = inputs.complexity === 'Complex' ? parseFloat(data.Time_Weed_Complex || 8) : parseFloat(data.Time_Weed_Simple || 2);
    L(`Weeding Labor`, ((totalSqFt * weedSpeed) / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * ${weedSpeed} Mins/SF * $${rateShop}/hr`);

    if(inputs.masking === 'Yes') {
        L(`Transfer Tape`, totalSqFt * parseFloat(data.Cost_Transfer_Tape || 0.15) * wastePct, `${totalSqFt.toFixed(1)} SF * $0.15/SF * Waste`);
        L(`Masking Labor`, ((totalSqFt * parseFloat(data.Time_Mask_SqFt || 1)) / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * 1 Min/SF * $${rateShop}/hr`);
    }

    const perimeterLF = ((inputs.w * 2) + (inputs.h * 2)) / 12;
    L(`Hand Trimming (Roll Edge)`, (perimeterLF * inputs.qty * parseFloat(data.Time_Cut_Hand || 0.25) / 60) * rateShop, `${(perimeterLF * inputs.qty).toFixed(1)} LF * 0.25 Mins/LF * $${rateShop}/hr`);

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.DECAL_CONFIG = {
    tab: 'PROD_Decals', engine: calculateDecal,
    controls: [
        { id: 'material', label: 'Material', type: 'select', opts: [{v:'Standard', t:'Standard Cal'}, {v:'Cast', t:'Premium Cast'}, {v:'Clear', t:'Clear'}, {v:'Reflective', t:'Reflective'}] },
        { id: 'shape', label: 'Cut Type', type: 'select', opts: [{v:'Rectangle', t:'Square Cut'}, {v:'Contour', t:'Contour Cut'}] },
        { id: 'weeding', label: 'Weeding Level', type: 'select', opts: [{v:'Standard', t:'Standard'}, {v:'Complex', t:'Complex'}] },
        { id: 'masking', label: 'Apply Tape?', type: 'select', opts: [{v:'No', t:'No'}, {v:'Yes', t:'Yes'}] }
    ],
    retails: [ { key: 'Retail_Price_Cal_SqFt', label: 'Cal Base Rate ($)' } ],
    costs: [ { key: 'Cost_Vin_Cal', label: 'Cal Vinyl ($)' }, { key: 'Time_Weed_Simple', label: 'Simple Weed (Mins/SF)' } ]
};
