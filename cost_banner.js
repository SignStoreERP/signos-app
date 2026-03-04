/**
 * PURE PHYSICS ENGINE: Vinyl Banners (v12.0)
 * Dual-Ledger Arrays. Explicit Hems, Grommets, and Hand Cut perimeter logic.
 */
function calculateBanner(inputs, data) {
    const sqft = Math.ceil((inputs.w * inputs.h) / 144);
    const totalSqFt = sqft * inputs.qty;

    // --- 1. RETAIL ENGINE ---
    const ret = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, formula}); return total; };

    const is1ft = (inputs.w === 12 || inputs.h === 12);
    let baseRate = 0;
    if (inputs.material === '15oz') baseRate = parseFloat(data.Retail_Price_Base_15oz || 7.50);
    else if (inputs.material === '18oz') baseRate = parseFloat(data.Retail_Price_Base_18oz || 8.00);
    else if (inputs.material === 'Mesh') baseRate = parseFloat(data.Retail_Price_Base_Mesh || 7.00);
    else {
        if (is1ft) baseRate = parseFloat(data.BAN13_T1_Rate || 6.50);
        else if (sqft < 10) baseRate = parseFloat(data.BAN13_T2_Rate || 6.00);
        else baseRate = parseFloat(data.BAN13_T3_Rate || 5.00);
    }

    R(`Printed Banner (${inputs.material})`, baseRate * totalSqFt, `${totalSqFt} SF @ $${baseRate}`);
    if (inputs.sides === 2) R(`Double Sided Adder`, (parseFloat(data.Retail_Adder_DS_SqFt || 3.00) * totalSqFt), `${totalSqFt} SF @ $3.00`);

    if (inputs.pockets === 'Top') R(`Pole Pockets (Top)`, (inputs.w / 12) * parseFloat(data.Retail_Fin_PolePkt_LF || 3) * inputs.qty, `Top Pocket per LF`);
    else if (inputs.pockets === 'TopBottom') R(`Pole Pockets (T/B)`, ((inputs.w * 2) / 12) * parseFloat(data.Retail_Fin_PolePkt_LF || 3) * inputs.qty, `Top & Bot Pocket per LF`);

    if (inputs.windSlits === 'Yes') R(`Wind Slits`, (totalSqFt * parseFloat(data.Retail_Price_WindSlits_SqFt || 1)), `Wind Slit Adder per SF`);

    R(`File Setup Fee`, parseFloat(data.Retail_Fee_Setup || 15), `Flat Setup`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    if(grandTotal > grandTotalRaw) R(`Shop Minimum Adjustment`, grandTotal - grandTotalRaw, `Padding to reach $${minOrder}`);

    // --- 2. COST ENGINE ---
    const cst = [];
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const multDS = inputs.sides === 2 ? 2 : 1;

    let vinCostRate = 0.30;
    if(inputs.material === '15oz') vinCostRate = parseFloat(data.Cost_Media_15oz || 0.46);
    else if(inputs.material === '18oz') vinCostRate = parseFloat(data.Cost_Media_18oz || 0.39);
    else if(inputs.material === 'Mesh') vinCostRate = parseFloat(data.Cost_Media_Mesh || 0.33);
    else vinCostRate = parseFloat(data.Cost_Media_13oz || 0.25);

    L(`Banner Media (${inputs.material})`, totalSqFt * vinCostRate * wastePct, `${totalSqFt.toFixed(1)} SF * $${vinCostRate}/SF * Waste`);
    L(`Latex Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * wastePct * multDS, `${totalSqFt.toFixed(1)} SF * $0.16/SF * Waste * ${multDS} Sides`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);

    L(`Job Setup (File RIP)`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    L(`Material Handling`, (5 / 60) * rateOp * multDS, `5 Mins * $${rateOp}/hr * ${multDS} Sides`);

    const printHrs = (totalSqFt / parseFloat(data.Speed_Print_Roll || 150)) * multDS;
    L(`Print Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Printer Run`, printHrs * parseFloat(data.Rate_Machine_Print || 5), `${printHrs.toFixed(2)} Hrs * $5/hr`);

    // Finishing
    const perimeterLF = ((inputs.w * 2) + (inputs.h * 2)) / 12;
    L(`Hand Trimming (Perimeter)`, (perimeterLF * inputs.qty * parseFloat(data.Time_Cut_Hand || 0.25) / 60) * rateShop, `${(perimeterLF * inputs.qty).toFixed(1)} LF * 0.25 Mins/LF * $${rateShop}/hr`);

    if (inputs.hems) {
        L(`Hem Tape Material`, perimeterLF * inputs.qty * parseFloat(data.Cost_Hem_Tape || 0.08), `${(perimeterLF * inputs.qty).toFixed(1)} LF * $0.08/LF`);
        const hemMins = perimeterLF * inputs.qty * parseFloat(data.Time_Hem_LF || 0.5);
        L(`Hemming Labor`, (hemMins / 60) * rateShop, `${(perimeterLF * inputs.qty).toFixed(1)} LF * 0.5 Mins/LF * $${rateShop}/hr`);
    }

    if (inputs.grommets) {
        const gromCount = (perimeterLF / 2) * inputs.qty;
        L(`Nickel Grommets`, gromCount * parseFloat(data.Cost_Grommet || 0.13), `~${gromCount.toFixed(0)} Grommets * $0.13/Ea`);
        L(`Grommet Press Labor`, (gromCount * parseFloat(data.Time_Grommet_Per || 1) / 60) * rateShop, `${gromCount.toFixed(0)} Grommets * 1 Min/Ea * $${rateShop}/hr`);
    }

    if (inputs.windSlits === 'Yes') L(`Wind Slit Cutting`, ((totalSqFt * parseFloat(data.Time_WindSlits_SqFt || 0.1)) / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * 0.1 Mins/SF * $${rateShop}/hr`);

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.10);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.BANNER_CONFIG = {
    tab: 'PROD_Vinyl_Banners', engine: calculateBanner,
    controls: [
        { id: 'material', label: 'Material', type: 'select', opts: [{v:'13oz', t:'13oz Standard'}, {v:'15oz', t:'15oz Blockout'}, {v:'18oz', t:'18oz Heavy'}, {v:'Mesh', t:'8oz Mesh'}] },
        { id: 'sides', label: 'Sides', type: 'select', opts: [{v:1, t:'1-Sided'}, {v:2, t:'2-Sided'}] },
        { id: 'pockets', label: 'Pole Pockets', type: 'select', opts: [{v:'None', t:'None'}, {v:'Top', t:'Top'}, {v:'TopBottom', t:'Top & Bottom'}] },
        { id: 'windSlits', label: 'Wind Slits', type: 'select', opts: [{v:'No', t:'No'}, {v:'Yes', t:'Yes'}] },
        { id: 'hems', label: 'Include Hems', type: 'toggle', def: true },
        { id: 'grommets', label: 'Include Grommets', type: 'toggle', def: true }
    ],
    retails: [ { key: 'BAN13_T3_Rate', label: 'Base Rate ($)' } ],
    costs: [ { key: 'Cost_Media_13oz', label: '13oz Media ($)' } ]
};
