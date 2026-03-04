/**
 * PURE PHYSICS ENGINE: Vehicle Wraps (v5.0)
 * Perf/Wrap logic unification. Perf now shares identical labor/print physics as cast wraps.
 */
function calculateWrap(inputs, data) {
    const retWrap = parseFloat(data.Retail_Price_Vehicle_SqFt || 15);
    const retPerf = parseFloat(data.Retail_Price_Perf_SqFt || 12);
    let totalRetailPrint = 0, totalSqFt = 0, totalInstallSqFt = 0;

    inputs.panels.forEach(p => {
        const sqft = (p.w * p.h) / 144;
        const area = sqft * (p.qty || 1) * inputs.qty; 
        totalSqFt += area;

        let retailUnit = p.material === 'perf6040' ? retPerf : retWrap;
        if(p.included) retailUnit = 0; // Excluded if bundled in larger wrap

        totalRetailPrint += (retailUnit * area);
        totalInstallSqFt += area;
    });

    const isComplex = inputs.complexity === 'complex';
    const baseInstallRet = parseFloat(data.Retail_Price_Install_Simple || 5);
    const installRetRate = isComplex ? (baseInstallRet * parseFloat(data.Retail_Mult_Complex || 2.5)) : baseInstallRet;

    let totalInstallRetail = inputs.install === 'Yes' ? (totalInstallSqFt * installRetRate) : 0;
    const minOrder = parseFloat(data.Retail_Min_Order || 150);
    const grandTotal = Math.max(totalRetailPrint + totalInstallRetail, minOrder);

    // --- 2. COST ENGINE (MATH LEDGER) ---
    const bd = [];
    const L = (label, total, formula) => { if(total > 0) bd.push({label, total, formula}); return total; };

    const waste = parseFloat(data.Waste_Factor || 1.25);
    let totalCostMat = 0;
    
    // Distinct material costs ONLY. Labor is unified below.
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

    L(`Vehicle Media & Lam`, totalCostMat, `(${totalSqFt.toFixed(1)} SF * Mat Cost) * ${waste} Waste`);
    L(`Latex Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * waste, `${totalSqFt.toFixed(1)} SF * $0.16/SF * Waste`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateInstall = parseFloat(data.Rate_Install || 32);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    
    // UNIFIED PRINT/LABOR PHYSICS
    L(`File Prep & Rip`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    const printHrs = totalSqFt / parseFloat(data.Speed_Print_Roll || 150);
    L(`Print Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Printer Run`, printHrs * parseFloat(data.Rate_Machine_Print || 5), `${printHrs.toFixed(2)} Hrs * $5/hr`);
    
    // Hand Cut Panel Separation
    inputs.panels.forEach(p => {
        const perimeterLF = ((p.w * 2) + (p.h * 2)) / 12;
        const handMins = perimeterLF * (p.qty || 1) * inputs.qty * parseFloat(data.Time_Cut_Hand || 0.25);
        L(`Hand Trimming [${p.label}]`, (handMins / 60) * rateShop, `${(perimeterLF * inputs.qty).toFixed(1)} LF * 0.25 Mins/LF * $${rateShop}/hr`);
    });

    // UNIFIED INSTALL PHYSICS
    if (inputs.install === 'Yes') {
        const installHrs = totalInstallSqFt / parseFloat(data.Speed_Install_Vehicle || 10);
        L(`Installation Labor`, installHrs * rateInstall, `${totalInstallSqFt.toFixed(1)} SF / 10 SF/hr * $${rateInstall}/hr`);
    }

    let hardCostRaw = bd.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.10);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: totalRetailPrint, installTotal: totalInstallRetail, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: bd },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}
