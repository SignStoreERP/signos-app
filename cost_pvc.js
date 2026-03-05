/**
 * PURE PHYSICS ENGINE: PVC Signs (v3.0)
 * Dual-Ledger Arrays. Includes Explicit Laminate & Shear math.
 */
function calculatePVC(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const multDS = inputs.sides === 2 ? 2 : 1;

    // --- 1. RETAIL ENGINE ---
    const ret = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let baseSqFtRate = 0;
    if (inputs.thickness === '3mm') {
        if (sqft <= 2.99) baseSqFtRate = parseFloat(data.PVC3_T1_Rate || 44);
        else if (sqft <= 5.99) baseSqFtRate = parseFloat(data.PVC3_T2_Rate || 13.20);
        else if (sqft <= 11.99) baseSqFtRate = parseFloat(data.PVC3_T3_Rate || 8.40);
        else baseSqFtRate = parseFloat(data.PVC3_T4_Rate || 7.80);
    } else {
        if (sqft <= 2.99) baseSqFtRate = parseFloat(data.PVC6_T1_Rate || 44);
        else if (sqft <= 5.99) baseSqFtRate = parseFloat(data.PVC6_T2_Rate || 22);
        else if (sqft <= 11.99) baseSqFtRate = parseFloat(data.PVC6_T3_Rate || 14);
        else baseSqFtRate = parseFloat(data.PVC6_T4_Rate || 13);
    }

    let unitPrint = baseSqFtRate * totalSqFt;
    R(`Base Print (${inputs.thickness})`, unitPrint, `${totalSqFt.toFixed(1)} SF @ $${baseSqFtRate}`);

    if (inputs.sides === 2) R(`Double Sided Adder`, (totalSqFt * parseFloat(data.Retail_Adder_DS_Mult || 0.5) * baseSqFtRate), `+50% Side 2 Markup`);
    
    if (inputs.laminate === 'None') R(`No Laminate Deduction`, -(unitPrint * parseFloat(data.Retail_Lam_Deduct || 0.10)), `-10% Base Deduction`);
    
    if (inputs.shape !== 'Rectangle') {
        const fee = inputs.shape === 'CNC Simple' ? parseFloat(data.Retail_Fee_Router_Easy || 30) : parseFloat(data.Retail_Fee_Router_Hard || 50);
        R(`CNC Router Fee`, fee, `Shape Routing Fee`);
    }


    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);


    // --- 2. COST ENGINE ---
    const cst = [];
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    const sheetCost = inputs.thickness === '6mm' ? parseFloat(data.Cost_Stock_6mm_4x8 || 58.37) : parseFloat(data.Cost_Stock_3mm_4x8 || 29.09);
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);

    const rawBlanks = L(`PVC Substrate (${inputs.thickness})`, (totalSqFt / 32) * sheetCost, `(${totalSqFt.toFixed(1)} SF / 32) * $${sheetCost.toFixed(2)}/sht`);
    L(`Material Waste Buffer`, rawBlanks * (wastePct - 1), `Substrate Cost * ${(wastePct-1)*100}%`);

    L(`Flatbed Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * multDS, `${totalSqFt.toFixed(1)} SF * $0.16/SF * ${multDS} Sides`);
    L(`Job Setup (File RIP)`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    L(`Material Handling`, (parseFloat(data.Time_Handling || 5) * multDS / 60) * rateOp, `5 Mins * $${rateOp}/hr * ${multDS} Sides`);

    const printHrs = ((inputs.h / 12) * inputs.qty / parseFloat(data.Machine_Speed_LF_Hr || 18)) * multDS;
    L(`Flatbed Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Flatbed Machine Run`, printHrs * parseFloat(data.Rate_Machine_Flatbed || 10), `${printHrs.toFixed(2)} Hrs * $10/hr`);

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

window.PVC_CONFIG = {
    tab: 'PROD_PVC_Signs', engine: calculatePVC,
    controls: [
        { id: 'thickness', label: 'Thickness', type: 'select', opts: [{v:'3mm', t:'3mm Std'}, {v:'6mm', t:'6mm HD'}] },
        { id: 'sides', label: 'Sides', type: 'select', opts: [{v:1, t:'1-Sided'}, {v:2, t:'2-Sided'}] },
        { id: 'laminate', label: 'Laminate', type: 'select', opts: [{v:'None', t:'None'}, {v:'Gloss', t:'Gloss Lam'}, {v:'Matte', t:'Matte Lam'}] },
        { id: 'shape', label: 'Cut Type', type: 'select', opts: [{v:'Rectangle', t:'Square Cut'}, {v:'CNC Simple', t:'CNC Simple'}, {v:'CNC Complex', t:'CNC Complex'}] }
    ],
    retails: [ { key: 'PVC3_T1_Rate', label: '3mm Rate ($)' } ],
    costs: [ { key: 'Cost_Stock_3mm_4x8', label: '3mm Sheet ($)' }, { key: 'Cost_Lam_SqFt', label: 'Laminate ($/SF)' } ]
};
