/**
 * PURE PHYSICS ENGINE: Interior Wall Wraps (v2.2)
 * Cleaned for global Install toggle architecture.
 */
function calculateWall(inputs, data) {
    if (!inputs.panels || inputs.panels.length === 0) return null;

    let totalSqFt = 0;
    let totalInstallSqFt = 0;
    let totalRetailPrint = 0;

    const retSmooth = parseFloat(data.Retail_Price_Wall_Smooth_SqFt || 10);
    const retText = parseFloat(data.Retail_Price_Wall_Text_SqFt || 15);
    const retPerf = parseFloat(data.Retail_Price_Perf_SqFt || 12);

    inputs.panels.forEach(p => {
        const area = (p.w * p.h) / 144;
        totalSqFt += area;

        let retailUnit = 0;
        if (p.material === 'smooth') { retailUnit = retSmooth; totalInstallSqFt += area; } 
        else if (p.material === 'textured') { retailUnit = retText; totalInstallSqFt += area; } 
        else if (p.material.startsWith('perf')) { retailUnit = p.included ? 0 : retPerf; totalInstallSqFt += area; }

        totalRetailPrint += (retailUnit * area);
    });

    const installRate = parseFloat(data.Retail_Install_Wall_SqFt || 3);
    const totalInstall = inputs.install === 'Yes' ? totalInstallSqFt * installRate : 0;
    
    let subTotal = totalRetailPrint + totalInstall;
    let minOrder = parseFloat(data.Retail_Min_Order || 150);
    let grandTotal = Math.max(subTotal, minOrder);

    // --- COST ENGINE ---
    const costVinSmooth = parseFloat(data.Cost_Vin_Wall || 0.59);
    const costVinText = parseFloat(data.Cost_Vin_Wall_Text || 1.14);
    const costVinPerf = parseFloat(data.Cost_Vinyl_Perf || 0.65);
    const costLamStd = parseFloat(data.Cost_Lam_Wall || 0.36);
    
    let totalCostMat = 0;
    const wastePct = parseFloat(data.Waste_Factor || 1.25);
    const riskFactor = parseFloat(data.Factor_Risk || 1.10);
    
    inputs.panels.forEach(p => {
        const area = ((p.w * p.h) / 144) * wastePct;
        let vCost = p.material === 'smooth' ? costVinSmooth : (p.material === 'textured' ? costVinText : costVinPerf);
        let lCost = p.laminate !== 'No Lam' ? costLamStd : 0;
        totalCostMat += (vCost + lCost) * area;
    });

    const totalCostInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * wastePct;
    const opRate = parseFloat(data.Rate_Operator || 25);
    const machRate = parseFloat(data.Rate_Machine_Print || 5);
    const instRate = parseFloat(data.Rate_Install || 32);

    const speedPrint = parseFloat(data.Speed_Print_Roll || 150);
    const printHrs = totalSqFt / speedPrint;
    
    const costPrintOp = printHrs * opRate * parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costMach = printHrs * machRate;
    
    const instSpeed = parseFloat(data.Speed_Install_Wall || 25);
    const instHrs = totalInstallSqFt / instSpeed;
    const costInstallLabor = inputs.install === 'Yes' ? (instHrs * instRate) : 0;

    const subHardCost = totalCostMat + totalCostInk + costPrintOp + costMach + costInstallLabor;
    const totalCost = subHardCost * riskFactor;

    return {
        retail: { printTotal: totalRetailPrint, installTotal: totalInstall, grandTotal: grandTotal, isMinApplied: subTotal < minOrder, displaySqFt: totalSqFt },
        cost: { total: totalCost, breakdown: { rawVinylAndLam: totalCostMat, totalInk: totalCostInk, costPrintLabor: costPrintOp, installLabor: costInstallLabor, costMachineRun: costMach, riskBuffer: totalCost - subHardCost } },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.WALL_CONFIG = {
    tab: 'PROD_Wall_Wraps',
    engine: calculateWall,
    controls: [
        { id: 'w', label: 'Simulated Width', type: 'number', def: 120 },
        { id: 'h', label: 'Simulated Height', type: 'number', def: 96 },
        { id: 'material', label: 'Material', type: 'select', opts: [{v:'smooth', t:'Smooth Wall'}, {v:'textured', t:'Textured Wall'}, {v:'perf6040', t:'Window Perf'}] }
    ],
    dynamicUI: function(inputs) {
        inputs.panels = [{ label: "Simulated Panel", qty: 1, w: inputs.w, h: inputs.h, material: inputs.material, included: false }];
        return inputs;
    },
    retails: [
        { key: 'Retail_Price_Wall_Smooth_SqFt', label: 'Smooth Rate ($)' },
        { key: 'Retail_Price_Wall_Text_SqFt', label: 'Textured Rate ($)' },
        { key: 'Retail_Install_Wall_SqFt', label: 'Base Install ($/SqFt)' }
    ],
    costs: [
        { key: 'Cost_Vin_Wall', label: 'Smooth Vin ($/SqFt)' },
        { key: 'Cost_Vin_Wall_Text', label: 'Textured Vin ($/SqFt)' },
        { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Install', label: 'Installer ($/Hr)' }
    ]
};
