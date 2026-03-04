/**
 * PURE PHYSICS ENGINE: Acrylic Signs (v6.1)
 * Array Ledger output and strict string conversion for thickness math.
 */
function calculateAcrylic(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    let thk = String(inputs.thickness); // STRICT CONVERSION FIX

    if (thk === '1/4') thk = '0.25';
    if (thk === '1/2') thk = '0.5';
    if (thk === '3/4') thk = '0.75';
    if (thk === '1') thk = '1';

    // --- 1. RETAIL ENGINE ---
    const ret = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let baseRate = 0;
    if (thk === '0.25') baseRate = parseFloat(data.ACR_14_T1_Rate || 40);
    else if (thk === '0.5') baseRate = parseFloat(data.ACR_12_T1_Rate || 45);
    else if (thk === '0.75') baseRate = parseFloat(data.ACR_34_T1_Rate || 55);
    else if (thk === '1') baseRate = parseFloat(data.ACR_1IN_T1_Rate || 60);

    R(`Base Acrylic (${thk}")`, baseRate * totalSqFt, `${totalSqFt.toFixed(1)} SF @ $${baseRate}`);
    
    if (inputs.shape !== 'Rectangle') R(`CNC Router Fee`, parseFloat(data.Retail_Fee_Router_Easy || 30), `Shape Routing Fee`);
    R(`File Setup Fee`, parseFloat(data.Retail_Fee_Setup || 25), `Flat Setup`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 75);
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    if(grandTotal > grandTotalRaw) R(`Shop Minimum Adjustment`, grandTotal - grandTotalRaw, `Padding to reach $${minOrder}`);

    // --- 2. COST ENGINE ---
    const cst = [];
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    let thkKey = '14';
    if (thk === '0.5') thkKey = '12';
    if (thk === '0.75') thkKey = '34';
    if (thk === '1') thkKey = '1IN';
    const colorKey = inputs.color === 'Clear' ? 'C' : 'W';
    const sheetCost = parseFloat(data[`Cost_Stock_${thkKey}_4x8_${colorKey}`] || 120.55); // Fallback to avoid NaN

    const rawBlanks = L(`Acrylic Yield (${thk}" ${inputs.color})`, (totalSqFt / 32) * sheetCost, `(${totalSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    const wastePct = parseFloat(data.Waste_Factor || 1.25);
    L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);

    L(`Flatbed Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16), `${totalSqFt.toFixed(1)} SF * $0.16/SF`);
    const rateOp = parseFloat(data.Rate_Operator || 25);

    L(`Job Setup (File RIP)`, (parseFloat(data.Time_Setup_Job || 15) / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(data.Speed_Print_1st || 18));
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(data.Rate_Machine_Flatbed || 10), `${printHrs.toFixed(2)} Hrs * $10/hr`);
    L(`Load/Unload Printer`, (parseFloat(data.Time_Handling || 5) / 60) * rateOp, `5 Mins * $${rateOp}/hr`);

    if (inputs.shape !== 'Rectangle') {
        const cutHrs = (totalSqFt * 1) / 60; 
        L(`CNC Router Run`, cutHrs * parseFloat(data.Rate_Machine_CNC || 10), `${cutHrs.toFixed(2)} Hrs * $10/hr`);
        L(`CNC Op (Attn Ratio)`, cutHrs * parseFloat(data.Rate_CNC_Labor || 25), `${cutHrs.toFixed(2)} Hrs * $25/hr`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.10);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.ACRYLIC_CONFIG = {
    tab: 'PROD_Acrylic_Signs', engine: calculateAcrylic,
    controls: [
        { id: 'thickness', label: 'Thickness', type: 'select', opts: [{v:'0.25', t:'1/4"'}, {v:'0.5', t:'1/2"'}, {v:'0.75', t:'3/4"'}, {v:'1', t:'1"'}] },
        { id: 'color', label: 'Color', type: 'select', opts: [{v:'Clear', t:'Clear'}, {v:'White', t:'White'}] },
        { id: 'shape', label: 'Cut Type', type: 'select', opts: [{v:'Rectangle', t:'Square Cut'}, {v:'Easy', t:'CNC Simple'}] }
    ],
    retails: [ { key: 'ACR_14_T1_Rate', label: '1/4" Rate ($)' } ],
    costs: [ { key: 'Cost_Stock_14_4x8_C', label: '1/4" Clear ($)' }, { key: 'Speed_Print_1st', label: 'Print Spd (LF/hr)' } ]
};
