/**
 * PURE PHYSICS ENGINE: Interior Wall Wraps
 * Dual-Ledger Arrays with strict Window Perf logic constraint.
 */
function calculateWall(inputs, data) {
    let totalSqFt = 0, totalInstallSqFt = 0;
    
    const ret = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, formula}); return total; };

    inputs.panels.forEach(p => {
        const area = (p.w * p.h) / 144 * inputs.qty;
        totalSqFt += area;
        let retailUnit = p.material === 'smooth' ? parseFloat(data.Retail_Price_Wall_Smooth_SqFt || 10) : (p.material === 'textured' ? parseFloat(data.Retail_Price_Wall_Text_SqFt || 15) : parseFloat(data.Retail_Price_Perf_SqFt || 12));
        R(`Panel: ${p.label} [${p.material === 'smooth' ? 'Smooth' : (p.material === 'textured' ? 'Textured' : 'Window Perf')}]`, retailUnit * area, `${area.toFixed(1)} SF @ $${retailUnit}`);
        totalInstallSqFt += area;
    });

    if (inputs.install === 'Yes') {
        const installRate = parseFloat(data.Retail_Install_Wall_SqFt || 3);
        R(`Installation Labor`, totalInstallSqFt * installRate, `${totalInstallSqFt.toFixed(1)} SF @ $${installRate.toFixed(2)}`);
    }

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 150);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    const cst = [];
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    const wastePct = parseFloat(data.Waste_Factor || 1.25);
    let totalCostMat = 0;

    inputs.panels.forEach(p => {
        const area = ((p.w * p.h) / 144) * inputs.qty * wastePct;
        let vCost = p.material === 'smooth' ? parseFloat(data.Cost_Vin_Wall || 0.59) : (p.material === 'textured' ? parseFloat(data.Cost_Vin_Wall_Text || 1.14) : parseFloat(data.Cost_Vinyl_Perf || 0.65));
        let lCost = p.laminate !== 'No Lam' ? parseFloat(data.Cost_Lam_Wall || 0.36) : 0;
        totalCostMat += (vCost + lCost) * area;
    });

    L(`Wall Media & Lam`, totalCostMat, `Total SF * Mat Cost * ${wastePct} Waste`);
    L(`Latex Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * wastePct, `${totalSqFt.toFixed(1)} SF * $0.16/SF * Waste`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const instRate = parseFloat(data.Rate_Install || 32);

    L(`File Prep & Rip`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);

    const printHrs = totalSqFt / parseFloat(data.Speed_Print_Roll || 150);
    L(`Print Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Printer Run`, printHrs * parseFloat(data.Rate_Machine_Print || 5), `${printHrs.toFixed(2)} Hrs * $5/hr`);

    let handCutMins = 0;
    inputs.panels.forEach(p => {
        const perimeterLF = ((p.w * 2) + (p.h * 2)) / 12;
        handCutMins += perimeterLF * inputs.qty * parseFloat(data.Time_Cut_Hand || 0.25);
    });
    L(`Hand Trimming (Panels)`, (handCutMins / 60) * rateShop, `Total Perimeters * 0.25 Mins/LF * $${rateShop}/hr`);

    if (inputs.install === 'Yes') {
        const instHrs = totalInstallSqFt / parseFloat(data.Speed_Install_Wall || 25);
        L(`Installation Labor`, instHrs * instRate, `${totalInstallSqFt.toFixed(1)} SF / 25 SF/hr * $${instRate}/hr`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.10);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.WALL_CONFIG = {
    tab: 'PROD_Vinyl_Wraps', engine: calculateWall,
    controls: [ { id: 'install', label: 'Include Install', type: 'select', opts: [{v:'Yes', t:'Yes'}, {v:'No', t:'No'}] } ],
    retails: [ { key: 'Retail_Price_Wall_Smooth_SqFt', label: 'Smooth Wall Base ($/SF)' } ],
    costs: [ { key: 'Cost_Vin_Wall', label: 'Wall Vinyl ($)' }, { key: 'Rate_Install', label: 'Install Labor ($/Hr)' } ]
};

