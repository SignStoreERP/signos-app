/**
 * PURE PHYSICS ENGINE: Interior Wall Wraps (v3.0)
 * Upgraded to Educational Math Ledger format.
 */
function calculateWall(inputs, data) {
    let totalSqFt = 0, totalInstallSqFt = 0, totalRetailPrint = 0;

    inputs.panels.forEach(p => {
        const area = (p.w * p.h) / 144;
        totalSqFt += area;
        let retailUnit = p.material === 'smooth' ? parseFloat(data.Retail_Price_Wall_Smooth_SqFt || 10) : (p.material === 'textured' ? parseFloat(data.Retail_Price_Wall_Text_SqFt || 15) : parseFloat(data.Retail_Price_Perf_SqFt || 12));
        totalRetailPrint += (retailUnit * area);
        totalInstallSqFt += area;
    });

    const installRate = parseFloat(data.Retail_Install_Wall_SqFt || 3);
    const totalInstall = inputs.install === 'Yes' ? totalInstallSqFt * installRate : 0;
    const minOrder = parseFloat(data.Retail_Min_Order || 150);
    const grandTotal = Math.max(totalRetailPrint + totalInstall, minOrder);

    // --- COST ENGINE (MATH LEDGER) ---
    const bd = [];
    const L = (label, total, formula) => { if(total > 0) bd.push({label, total, formula}); return total; };

    const wastePct = parseFloat(data.Waste_Factor || 1.25);
    let totalCostMat = 0;
    
    inputs.panels.forEach(p => {
        const area = ((p.w * p.h) / 144) * wastePct;
        let vCost = p.material === 'smooth' ? parseFloat(data.Cost_Vin_Wall || 0.59) : (p.material === 'textured' ? parseFloat(data.Cost_Vin_Wall_Text || 1.14) : parseFloat(data.Cost_Vinyl_Perf || 0.65));
        let lCost = p.laminate !== 'No Lam' ? parseFloat(data.Cost_Lam_Wall || 0.36) : 0;
        totalCostMat += (vCost + lCost) * area;
    });

    L(`Wall Media & Lam`, totalCostMat, `(${totalSqFt.toFixed(1)} SF * Mat Cost) * ${wastePct} Waste`);
    L(`Latex Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * wastePct, `${totalSqFt.toFixed(1)} SF * $0.16/SF * Waste`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const instRate = parseFloat(data.Rate_Install || 32);

    L(`File Prep & Rip`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    const printHrs = totalSqFt / parseFloat(data.Speed_Print_Roll || 150);
    L(`Print Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Printer Run`, printHrs * parseFloat(data.Rate_Machine_Print || 5), `${printHrs.toFixed(2)} Hrs * $5/hr`);

    inputs.panels.forEach(p => {
        const perimeterLF = ((p.w * 2) + (p.h * 2)) / 12;
        const handMins = perimeterLF * parseFloat(data.Time_Cut_Hand || 0.25);
        L(`Hand Trimming [${p.label}]`, (handMins / 60) * rateShop, `${perimeterLF.toFixed(1)} LF * 0.25 Mins/LF * $${rateShop}/hr`);
    });

    if (inputs.install === 'Yes') {
        const instHrs = totalInstallSqFt / parseFloat(data.Speed_Install_Wall || 25);
        L(`Installation Labor`, instHrs * instRate, `${totalInstallSqFt.toFixed(1)} SF / 25 SF/hr * $${instRate}/hr`);
    }

    let hardCostRaw = bd.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.10);

    return {
        retail: { unitPrice: grandTotal, printTotal: totalRetailPrint, installTotal: totalInstall, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: bd },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}
