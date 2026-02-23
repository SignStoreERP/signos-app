/**
 * PURE PHYSICS ENGINE: Interior Wall Wraps (v1.1)
 * Supports Window Perf storefront integration and dynamic panel tracking.
 */
function calculateWall(inputs, data) {
    // --- 1. RETAIL ENGINE ---
    const retWall = parseFloat(data.Retail_Price_Wall_SqFt || 10);
    const retPerf = parseFloat(data.Retail_Price_Perf_SqFt || 12);
    const retInstall = parseFloat(data.Retail_Install_Wall_SqFt || 3);
    
    let totalRetailPrint = 0;
    let totalSqFt = 0;
    let panelLogs = [];

    inputs.panels.forEach(p => {
        const sqft = (p.w * p.h) / 144;
        const area = sqft * inputs.qty;
        totalSqFt += area;

        const shortEdge = Math.min(p.w, p.h);
        const panelCount = shortEdge <= 52 ? 1 : Math.ceil((shortEdge - 1) / 51);

        let retailUnit = p.material === 'perf' ? retPerf : retWall;
        const rowRetail = retailUnit * area;
        totalRetailPrint += rowRetail;

        panelLogs.push({ 
            label: p.label || 'Wall Section', 
            material: p.material,
            w: p.w, h: p.h,
            sqft: area, 
            retail: rowRetail, 
            panels: panelCount
        });
    });

    const totalInstallRetail = totalSqFt * retInstall;

    let appliedPrintRetail = totalRetailPrint;
    let i = 1;
    const tierLog = [];
    while (data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tDisc = parseFloat(data[`Tier_${i}_Disc`] || 0);
        let discountedPrint = totalRetailPrint * (1 - tDisc);
        if (inputs.qty >= tQty) appliedPrintRetail = discountedPrint;
        tierLog.push({ q: tQty, base: totalRetailPrint, unit: discountedPrint, pct: tDisc });
        i++;
    }

    const feeDesign = inputs.incDesign ? (parseFloat(data.Retail_Fee_Design || 85) * inputs.files) : 0;
    const grandTotalRaw = appliedPrintRetail + totalInstallRetail + feeDesign;
    const minOrder = parseFloat(data.Retail_Min_Order || 150);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE ---
    const costVinWall = parseFloat(data.Cost_Vin_Wall || 0.59);
    const costLamWall = parseFloat(data.Cost_Lam_Wall || 0.36);
    const costVinPerf = parseFloat(data.Cost_Vinyl_Perf || 0.65);
    const costLamPerf = parseFloat(data.Cost_Lam_Perf || 0.25);
    const inkCost = parseFloat(data.Cost_Ink_Latex || 0.16);
    
    const waste = parseFloat(data.Waste_Factor || 1.25);
    const risk = parseFloat(data.Factor_Risk || 1.10);

    let totalCostMat = 0;
    inputs.panels.forEach(p => {
        const area = ((p.w * p.h) / 144) * inputs.qty;
        let matUnit = p.material === 'perf' ? (costVinPerf + costLamPerf) : (costVinWall + costLamWall);
        totalCostMat += (matUnit * area * waste);
    });

    const totalCostInk = totalSqFt * inkCost * waste;

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateInstall = parseFloat(data.Rate_Install || 32);
    const rateMach = parseFloat(data.Rate_Machine_Print || 5);
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);

    const speedPrint = parseFloat(data.Speed_Print_Roll || 150);
    const speedLam = parseFloat(data.Speed_Lam_Roll || 300);
    const speedInstall = parseFloat(data.Speed_Install_Wall || 25);

    const printHrs = totalSqFt / speedPrint;
    const lamHrs = totalSqFt / speedLam;
    const installHrs = totalSqFt / speedInstall;

    const costPrintOp = (printHrs + lamHrs) * rateOp * attnRatio;
    const costInstallLabor = installHrs * rateInstall;
    const costMach = (printHrs + lamHrs) * rateMach;

    const rawSubTotal = totalCostMat + totalCostInk + costPrintOp + costInstallLabor + costMach;
    const riskCost = rawSubTotal * (risk - 1);
    const totalCost = rawSubTotal + riskCost;

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: appliedPrintRetail,
            installTotal: totalInstallRetail,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            panels: panelLogs,
            tiers: tierLog
        },
        cost: {
            total: totalCost,
            breakdown: { materials: totalCostMat, ink: totalCostInk, printLabor: costPrintOp, installLabor: costInstallLabor, machine: costMach, risk: riskCost }
        }
    };
}
