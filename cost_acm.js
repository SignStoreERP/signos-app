/**
 * PURE PHYSICS ENGINE: ACM Signs (v5.0)
 * Dual-Ledger Output. Includes requested Laminate logic & Shear cuts.
 */
function calculateACM(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const multDS = inputs.sides === 2 ? 2 : 1;

    // --- 1. RETAIL ENGINE ---
    const ret = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let baseRate = inputs.thickness === '6mm' ? parseFloat(data.ACM6_T1_Rate || 16.50) : parseFloat(data.ACM3_T1_Rate || 14.00);
    R(`Base Print (${inputs.thickness})`, baseRate * totalSqFt, `${totalSqFt.toFixed(1)} SF @ $${baseRate}`);

    if (inputs.sides === 2) R(`Double Sided Adder`, (totalSqFt * parseFloat(data.Retail_Adder_DS_Mult || 0.5) * baseRate), `+50% Side 2 Markup`);
    
    if (inputs.laminate && inputs.laminate !== 'None') {
        const lamAdder = parseFloat(data.Retail_Price_Gloss || 8);
        R(`Laminate Finish`, (lamAdder * sqft) * inputs.qty, `${inputs.qty}x Lam @ $${lamAdder}/sf`);
    }

    if (inputs.shape !== 'Rectangle') {
        const fee = inputs.shape === 'CNC Simple' ? parseFloat(data.Retail_Fee_Router_Easy || 30) : parseFloat(data.Retail_Fee_Router_Hard || 50);
        R(`CNC Router Fee`, fee, `Shape Routing Fee`);
    }

    R(`File Setup Fee`, parseFloat(data.Retail_Fee_Setup || 15), `Flat Fee`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    if(grandTotal > grandTotalRaw) R(`Shop Minimum Adjustment`, grandTotal - grandTotalRaw, `Padding to reach $${minOrder}`);

    // --- 2. COST ENGINE ---
    const cst = [];
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    const sheetCost = inputs.thickness === '6mm' ? parseFloat(data.Cost_Stock_6mm_4x8 || 72.10) : parseFloat(data.Cost_Stock_3mm_4x8 || 52.09);
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    const rawBlanks = L(`ACM Panel (${inputs.thickness})`, (totalSqFt / 32) * sheetCost, `(${totalSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);

    L(`Job Setup (File RIP)`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    L(`Flatbed Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * multDS, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);
    
    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(data.Machine_Speed_LF_Hr || 25)) * multDS;
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(data.Rate_Machine_Flatbed || 10), `${printHrs.toFixed(2)} Hrs * $10/hr`);
    L(`Load/Unload Printer`, (parseFloat(data.Time_Handling || 5) * multDS / 60) * rateOp, `5 Mins * $${rateOp}/hr * ${multDS} Sides`);

    // Laminator Math
    if (inputs.laminate && inputs.laminate !== 'None') {
        const lamCost = totalSqFt * parseFloat(data.Cost_Lam_SqFt || 0.36) * multDS;
        L(`Laminate Media`, lamCost * wastePct, `${totalSqFt.toFixed(1)} SF * $0.36/SF * Waste`);
        const lamHrs = totalSqFt / parseFloat(data.Speed_Lam_Roll || 300) * multDS;
        L(`Laminator Op (100% Attn)`, lamHrs * rateShop, `${lamHrs.toFixed(2)} Hrs * $${rateShop}/hr * 100%`);
        L(`Laminator Machine Run`, lamHrs * parseFloat(data.Rate_Machine_Lam || 5), `${lamHrs.toFixed(2)} Hrs * $5/hr`);
        L(`Load/Unload Laminator`, (parseFloat(data.Time_Handling || 5) * multDS / 60) * rateShop, `Handling Mins * ${multDS} Sides`);
    }

    if (inputs.shape !== 'Rectangle') {
        const cutHrs = (totalSqFt * (inputs.shape === 'CNC Simple' ? 1 : 2)) / 60;
        L(`CNC Router Run`, cutHrs * parseFloat(data.Rate_Machine_CNC || 10), `${cutHrs.toFixed(2)} Hrs * $10/hr`);
        L(`CNC Op (Attn Ratio)`, cutHrs * parseFloat(data.Rate_CNC_Labor || 25), `${cutHrs.toFixed(2)} Hrs * $25/hr`);
        L(`Load/Unload Router`, (parseFloat(data.Time_Handling || 5) / 60) * rateOp, `5 Mins * $${rateOp}/hr`);
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

window.ACM_CONFIG = {
    tab: 'PROD_ACM_Signs', engine: calculateACM,
    controls: [
        { id: 'thickness', label: 'Thickness', type: 'select', opts: [{v:'3mm', t:'3mm Std'}, {v:'6mm', t:'6mm HD'}] },
        { id: 'sides', label: 'Sides', type: 'select', opts: [{v:1, t:'1-Sided'}, {v:2, t:'2-Sided'}] },
        { id: 'laminate', label: 'Laminate', type: 'select', opts: [{v:'None', t:'None'}, {v:'Standard', t:'Standard Lam'}] },
        { id: 'shape', label: 'Cut Type', type: 'select', opts: [{v:'Rectangle', t:'Square Cut'}, {v:'CNC Simple', t:'CNC Simple'}, {v:'CNC Complex', t:'CNC Complex'}] }
    ],
    retails: [ { key: 'ACM3_T1_Rate', label: '3mm Rate ($)' }, { key: 'Retail_Fee_Router_Easy', label: 'CNC Easy Fee ($)' } ],
    costs: [ { key: 'Cost_Stock_3mm_4x8', label: '3mm Sheet ($)' }, { key: 'Time_Shear_Setup', label: 'Shear Setup' }, { key: 'Time_Shear_Cut', label: 'Shear Cut' } ]
};
