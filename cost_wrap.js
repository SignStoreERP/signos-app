/**
 * PURE PHYSICS ENGINE: Vehicle Wraps (v6.0)
 * Dual-Ledger Arrays mapping panel-by-panel material loops.
 */
function calculateWrap(inputs, data) {
    const retWrap = parseFloat(data.Retail_Price_Vehicle_SqFt || 15);
    const retPerf = parseFloat(data.Retail_Price_Perf_SqFt || 12);
    const baseInstallRet = parseFloat(data.Retail_Price_Install_Simple || 5);
    const installRetRate = inputs.complexity === 'complex' ? (baseInstallRet * parseFloat(data.Retail_Mult_Complex || 2.5)) : baseInstallRet;

    let totalSqFt = 0, totalInstallSqFt = 0;

    // --- 1. RETAIL ENGINE ---
    const ret = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, formula}); return total; };

    inputs.panels.forEach(p => {
        const area = ((p.w * p.h) / 144) * (p.qty || 1) * inputs.qty;
        totalSqFt += area;
        let retailUnit = p.material === 'perf6040' ? retPerf : retWrap;
        
        if(p.included) {
            R(`Panel: ${p.label} (Included)`, 0, `Included in primary wrap`);
        } else {
            R(`Panel: ${p.label} [${p.material}]`, retailUnit * area, `${area.toFixed(1)} SF @ $${retailUnit}`);
            totalInstallSqFt += area;
        }
    });

    if (inputs.install === 'Yes') R(`Installation Labor`, totalInstallSqFt * installRetRate, `${totalInstallSqFt.toFixed(1)} SF @ $${installRetRate.toFixed(2)}`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 150);
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    if(grandTotal > grandTotalRaw) R(`Shop Minimum Adjustment`, grandTotal - grandTotalRaw, `Padding to reach $${minOrder}`);

    // --- 2. COST ENGINE ---
    const cst = [];
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    const waste = parseFloat(data.Waste_Factor || 1.25);
    let totalCostMat = 0;

    inputs.panels.forEach(p => {
        const area = ((p.w * p.h) / 144) * (p.qty || 1) * inputs.qty;
        let vCost = parseFloat(data.Cost_Vin_Vehicle || 1.30);
        let lCost = parseFloat(data.Cost_Lam_Vehicle || 0.96);
        if (p.material === 'perf6040') {
            vCost = parseFloat(data.Cost_Vinyl_Perf || 0.65);
            lCost = p.laminate !== 'No Lam' ? parseFloat(data.Cost_Lam_Perf || 0.25) : 0;
        }
        totalCostMat += ((vCost + lCost) * area * waste);
    });

    L(`Vehicle Media & Lam`, totalCostMat, `Total SF * Mat Cost * ${waste} Waste`);
    L(`Latex Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * waste, `${totalSqFt.toFixed(1)} SF * $0.16/SF * Waste`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateInstall = parseFloat(data.Rate_Install || 32);

    L(`File Prep & Rip`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);

    const printHrs = totalSqFt / parseFloat(data.Speed_Print_Roll || 150);
    L(`Print Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Printer Run`, printHrs * parseFloat(data.Rate_Machine_Print || 5), `${printHrs.toFixed(2)} Hrs * $5/hr`);

    let handCutMins = 0;
    inputs.panels.forEach(p => {
        const perimeterLF = ((p.w * 2) + (p.h * 2)) / 12;
        handCutMins += perimeterLF * (p.qty || 1) * inputs.qty * parseFloat(data.Time_Cut_Hand || 0.25);
    });
    L(`Hand Trimming (Panels)`, (handCutMins / 60) * rateShop, `Total Perimeters * 0.25 Mins/LF * $${rateShop}/hr`);

    if (inputs.install === 'Yes') {
        const installHrs = totalInstallSqFt / parseFloat(data.Speed_Install_Vehicle || 10);
        L(`Installation Labor`, installHrs * rateInstall, `${totalInstallSqFt.toFixed(1)} SF / 10 SF/hr * $${rateInstall}/hr`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.10);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.WRAP_CONFIG = {
    tab: 'PROD_Vinyl_Wraps', engine: calculateWrap,
    controls: [ { id: 'complexity', label: 'Curve Complexity', type: 'select', opts: [{v:'simple', t:'Simple Curves'}, {v:'complex', t:'Complex (Bumpers)'}] } ],
    retails: [ { key: 'Retail_Price_Vehicle_SqFt', label: 'Wrap Base ($/SF)' } ],
    costs: [ { key: 'Cost_Vin_Vehicle', label: 'Cast Vinyl ($)' }, { key: 'Rate_Install', label: 'Install Labor ($/Hr)' } ]
};
