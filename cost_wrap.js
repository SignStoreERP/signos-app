/**
 * PURE PHYSICS ENGINE: Vehicle Wraps (v4.3)
 * Handles dynamic panel arrays, Line Item Qty, Window Perf inclusion, and seaming.
 */
function calculateWrap(inputs, data) {
    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    const retWrap = parseFloat(data.Retail_Price_Vehicle_SqFt || 15);
    const retPerf = parseFloat(data.Retail_Price_Perf_SqFt || 12);
    const retDecal = parseFloat(data.Retail_Price_Decal_SqFt || 14);

    let totalRetailPrint = 0;
    let totalSqFt = 0;
    let totalInstallSqFt = 0;
    let panelLogs = [];

    // Loop through dynamic panels
    inputs.panels.forEach(p => {
        const sqft = (p.w * p.h) / 144;
        const lineQty = p.qty || 1;
        const area = sqft * lineQty * inputs.qty; 
        totalSqFt += area;

        // Seam Math (52" Max with 1" Overlap)
        const shortEdge = Math.min(p.w, p.h);
        const panelCount = (shortEdge <= 52 ? 1 : Math.ceil((shortEdge - 1) / 51)) * lineQty;

        let retailUnit = 0;
        if (p.material === 'wrap') {
            retailUnit = retWrap;
            totalInstallSqFt += area;
        } else if (p.material === 'perf') {
            retailUnit = p.included ? 0 : retPerf;
            totalInstallSqFt += area;
        } else if (p.material === 'decal') {
            retailUnit = retDecal;
            totalInstallSqFt += area * 0.5; 
        }

        const rowRetail = retailUnit * area;
        totalRetailPrint += rowRetail;
        panelLogs.push({
            label: p.label || 'Section', material: p.material, qty: lineQty,
            w: p.w, h: p.h, sqft: area, retail: rowRetail, panels: panelCount, included: p.included
        });
    });

    const isComplex = inputs.complexity === 'complex';
    const baseInstallRet = parseFloat(data.Retail_Price_Install_Simple || 5);
    const complexMult = parseFloat(data.Retail_Mult_Complex || 2.5);
    const installRetRate = isComplex ? (baseInstallRet * complexMult) : baseInstallRet;

    let tierLog = [];
    let discPct = 0;
    let i = 1;
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tDisc = parseFloat(data[`Tier_${i}_Disc`] || 0);
        tierLog.push({ q: tQty, d: tDisc, unitBase: (totalRetailPrint * (1-tDisc)) / inputs.qty });
        if (inputs.qty >= tQty) discPct = tDisc;
        i++;
    }

    let appliedPrintRetail = totalRetailPrint * (1 - discPct);
    let totalInstallRetail = inputs.install === 'Yes' ? (totalInstallSqFt * installRetRate) : 0;
    const feeDesign = inputs.incDesign ? (parseFloat(data.Retail_Fee_Design || 85) * (inputs.files || 1)) : 0;
    const grandTotalRaw = appliedPrintRetail + totalInstallRetail + feeDesign;
    const minOrder = parseFloat(data.Retail_Min_Order || 150);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const costCast = parseFloat(data.Cost_Vin_Vehicle || 1.30);
    const costCastLam = parseFloat(data.Cost_Lam_Vehicle || 0.96);
    const costPerf = parseFloat(data.Cost_Vinyl_Perf || 0.65);
    const costPerfLam = parseFloat(data.Cost_Lam_Perf || 0.25);
    
    let totalCostMat = 0;
    const waste = parseFloat(data.Waste_Factor || 1.25);
    const inkCost = parseFloat(data.Cost_Ink_Latex || 0.16);

    inputs.panels.forEach(p => {
        const area = ((p.w * p.h) / 144) * (p.qty || 1) * inputs.qty;
        let matUnit = costCast + costCastLam;
        if (p.material === 'perf') matUnit = costPerf + costPerfLam;
        totalCostMat += (matUnit * area * waste);
    });

    const totalCostInk = totalSqFt * inkCost * waste;
    
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateInstall = parseFloat(data.Rate_Install || 32);
    const rateMach = parseFloat(data.Rate_Machine_Print || 5);
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    
    const speedPrint = parseFloat(data.Speed_Print_Roll || 150);
    const printHrs = totalSqFt / speedPrint;
    
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costMach = printHrs * rateMach;
    
    const speedInstall = parseFloat(data.Speed_Install_Vehicle || 10);
    const installHrs = totalInstallSqFt / speedInstall;
    const costInstallLabor = inputs.install === 'Yes' ? (installHrs * rateInstall) : 0;

    const riskFactor = parseFloat(data.Factor_Risk || 1.10);
    const subHardCost = totalCostMat + totalCostInk + costPrintOp + costMach + costInstallLabor;
    const totalCost = subHardCost * riskFactor;

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: appliedPrintRetail, installTotal: totalInstallRetail, designFee: feeDesign, grandTotal: grandTotal, displaySqFt: totalSqFt, isMinApplied: grandTotalRaw < minOrder, tiers: tierLog },
        cost: {
            total: totalCost,
            breakdown: { materials: totalCostMat, ink: totalCostInk, printLabor: costPrintOp, installLabor: costInstallLabor, machine: costMach, risk: totalCost - subHardCost, wastePct: (waste-1)*100, riskPct: (riskFactor-1)*100 }
        },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.WRAP_CONFIG = {
    tab: 'PROD_Vinyl_Wraps',
    engine: calculateWrap,
    controls: [
        { id: 'w', label: 'Simulated Width', type: 'number', def: 120 },
        { id: 'h', label: 'Simulated Height', type: 'number', def: 60 },
        { id: 'material', label: 'Material', type: 'select', opts: [{v:'wrap', t:'Cast Wrap'}, {v:'perf', t:'Window Perf'}, {v:'decal', t:'Spot Decal'}] },
        { id: 'complexity', label: 'Vehicle Type', type: 'select', opts: [{v:'simple', t:'Flat / Box Truck'}, {v:'complex', t:'Complex / Van'}] },
        { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    dynamicUI: function(inputs) {
        inputs.panels = [{ label: "Simulated Panel", qty: 1, w: inputs.w, h: inputs.h, material: inputs.material, included: false }];
        return inputs;
    },
    retails: [
        { heading: 'Market Base ($/SqFt)', key: 'Retail_Price_Wrap_SqFt', label: 'Wrap Cast Rate ($)' },
        { key: 'Retail_Price_Perf_SqFt', label: 'Window Perf Rate ($)' },
        { key: 'Retail_Price_Decal_SqFt', label: 'Spot Decal Rate ($)' },
        { heading: 'Installation Matrix', key: 'Retail_Price_Install_Simple', label: 'Base Install ($/SqFt)' },
        { key: 'Retail_Mult_Complex', label: 'Complex Curve Mult (1.x)' },
        { heading: 'Flat Fees', key: 'Retail_Fee_Design', label: 'Design Fee ($)' }
    ],
    costs: [
        { heading: 'Raw Materials', key: 'Cost_Vin_Vehicle', label: 'Cast Vinyl ($/SqFt)' },
        { key: 'Cost_Lam_Vehicle', label: 'Cast Lam ($/SqFt)' },
        { key: 'Cost_Vinyl_Perf', label: 'Perf Vinyl ($/SqFt)' },
        { key: 'Cost_Lam_Perf', label: 'Optic Clear Lam ($/SqFt)' },
        { key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },
        { heading: 'Labor & Speeds', key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Install', label: 'Installer ($/Hr)' },
        { key: 'Rate_Machine_Print', label: 'Printer Mach ($/Hr)' },
        { key: 'Speed_Print_Roll', label: 'Print Spd (SqFt/hr)' },
        { key: 'Speed_Install_Vehicle', label: 'Install Spd (SqFt/hr)' },
        { heading: 'Modifiers', key: 'Waste_Factor', label: 'Waste (1.x)' },
        { key: 'Factor_Risk', label: 'Risk (1.x)' },
        { key: 'Labor_Attendance_Ratio', label: 'Attn Ratio (0-1)' }
    ]
};

window.WRAP_CONFIG = {
    tab: 'PROD_Vinyl_Wraps',
    engine: calculateWrap,
    controls: [
        { id: 'material', label: 'Material', type: 'select', opts: [{v:'wrap', t:'Cast Wrap'}, {v:'perf6040', t:'Window Perf (60/40)'}] },
        { id: 'complexity', label: 'Vehicle Type', type: 'select', opts: [{v:'simple', t:'Flat / Box Truck'}, {v:'complex', t:'Complex / Van'}] }
    ],
    retails: [
        { key: 'Retail_Price_Vehicle_SqFt', label: 'Wrap Rate ($/sf)' },
        { key: 'Retail_Price_Perf_SqFt', label: 'Perf Rate ($/sf)' },
        { key: 'Retail_Install_Vehicle_SqFt', label: 'Base Install ($/sf)' }
    ],
    costs: [
        { key: 'Cost_Vin_Vehicle', label: 'Cast Vinyl ($/sf)' },
        { key: 'Cost_Lam_Vehicle', label: 'Cast Lam ($/sf)' },
        { key: 'Rate_Install', label: 'Installer ($/Hr)' }
    ]
};

