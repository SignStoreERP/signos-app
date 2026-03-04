/**
 * PURE PHYSICS ENGINE: Foam Core Boards (v3.0)
 * Dual-Ledger Arrays. Includes explicit Shear cutting.
 */
function calculateFoam(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const multDS = inputs.sides === 2 ? 2 : 1;

    // --- 1. RETAIL ENGINE ---
    const ret = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let baseSqFtRate = 0;
    if (sqft <= 3.99) baseSqFtRate = parseFloat(data.FOM3_T1_Rate || 8.33);
    else if (sqft <= 15.99) baseSqFtRate = parseFloat(data.FOM3_T2_Rate || 8);
    else if (sqft <= 31.99) baseSqFtRate = parseFloat(data.FOM3_T3_Rate || 7);
    else baseSqFtRate = parseFloat(data.FOM3_T4_Rate || 6);

    let retailPrint = baseSqFtRate * totalSqFt;
    R(`Base Print (3/16")`, retailPrint, `${totalSqFt.toFixed(1)} SF @ $${baseSqFtRate}`);

    if (inputs.sides === 2) R(`Double Sided Adder`, (totalSqFt * parseFloat(data.Retail_Adder_DS_Mult || 0.5) * baseSqFtRate), `+50% Side 2 Markup`);
    
    if (inputs.shape !== 'Rectangle') {
        const fee = inputs.shape === 'CNC Simple' ? parseFloat(data.Retail_Fee_Router_Easy || 30) : parseFloat(data.Retail_Fee_Router_Hard || 50);
        R(`CNC Router Fee`, fee, `Shape Routing Fee`);
    }

    R(`File Setup Fee`, parseFloat(data.Retail_Fee_Setup || 15), `Flat Setup`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    if(grandTotal > grandTotalRaw) R(`Shop Minimum Adjustment`, grandTotal - grandTotalRaw, `Padding to reach $${minOrder}`);

    // --- 2. COST ENGINE ---
    const cst = [];
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    const sheetCost = parseFloat(data.Cost_Stock_316_4x8 || 13.86);
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);

    const rawBlanks = L(`Foam Core (3/16")`, (totalSqFt / 32) * sheetCost, `(${totalSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);

    L(`Flatbed Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * multDS, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);
    L(`Job Setup (File RIP)`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    L(`Material Handling`, (parseFloat(data.Time_Handling || 5) * multDS / 60) * rateOp, `5 Mins * $${rateOp}/hr * ${multDS} Sides`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(data.Machine_Speed_LF_Hr || 18)) * multDS;
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(data.Rate_Machine_Flatbed || 10), `${printHrs.toFixed(2)} Hrs * $10/hr`);

    if (inputs.shape !== 'Rectangle') {
        const cutHrs = (totalSqFt * (inputs.shape === 'CNC Simple' ? 1 : 2)) / 60;
        L(`CNC Router Run`, cutHrs * parseFloat(data.Rate_Machine_CNC || 10), `${cutHrs.toFixed(2)} Hrs * $10/hr`);
        L(`CNC Op (Attn Ratio)`, cutHrs * parseFloat(data.Rate_CNC_Labor || 25), `${cutHrs.toFixed(2)} Hrs * $25/hr`);
    } else {
        const shearSetup = parseFloat(data.Time_Shear_Setup || 5);
        L(`Shear Machine Setup`, (shearSetup / 60) * rateShop, `${shearSetup} Mins * $${rateShop}/hr`);
        const shearCuts = inputs.qty * 4; 
        L(`Shear Per-Cut Run`, (shearCuts * parseFloat(data.Time_Shear_Cut || 1) / 60) * rateShop, `${shearCuts} Cuts * 1 Min * $${rateShop}/hr`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.FOAM_CONFIG = {
    tab: 'PROD_Foam_Signs', engine: calculateFoam,
    controls: [
        { id: 'thickness', label: 'Thickness', type: 'select', opts: [{v:'3/16', t:'3/16" Standard'}] },
        { id: 'sides', label: 'Sides', type: 'select', opts: [{v:1, t:'1-Sided'}, {v:2, t:'2-Sided'}] },
        { id: 'shape', label: 'Cut Type', type: 'select', opts: [{v:'Rectangle', t:'Square Cut'}, {v:'CNC Simple', t:'CNC Simple'}] }
    ],
    retails: [ { key: 'FOM3_T1_Rate', label: '3/16" Rate ($)' } ],
    costs: [ { key: 'Cost_Stock_316_4x8', label: '3/16" Sheet ($)' }, { key: 'Time_Shear_Setup', label: 'Shear Setup' }, { key: 'Time_Shear_Cut', label: 'Shear Cut' } ]
};
