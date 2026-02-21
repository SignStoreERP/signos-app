/**
 * PURE PHYSICS ENGINE: Wraps & Wall Graphics (v1.0 - Dual Track)
 * Implements specific mapping for Automotive Cast and Interior Wall Calendered workflows.
 */

function calculateWrap(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    const isVehicle = (inputs.app === 'Vehicle');
    const matLabel = isVehicle ? "Cast (IJ180 + 8518 Lam)" : "Calendered (IJ35C + 210 Lam)";

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    const baseRate = isVehicle 
        ? parseFloat(data.Retail_Price_Vehicle_SqFt || 15) 
        : parseFloat(data.Retail_Price_Wall_SqFt || 10);
        
    const installRate = isVehicle
        ? parseFloat(data.Retail_Install_Vehicle_SqFt || 8)
        : parseFloat(data.Retail_Install_Wall_SqFt || 5);

    // Volume Tiers (Fleet Discounts)
    let discPct = 0;
    let currentBestTier = 0;
    let i = 1;
    const tierLog = [];
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tDisc = parseFloat(data[`Tier_${i}_Disc`] || 0);
        tierLog.push({ q: tQty, d: tDisc });
        if (inputs.qty >= tQty) currentBestTier = tDisc;
        i++;
    }
    discPct = currentBestTier;

    const retailPrint = (baseRate * (1 - discPct)) * totalSqFt;
    const retailInstall = inputs.hasInstall ? (installRate * totalSqFt) : 0;

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 85) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 25);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;

    const grandTotalRaw = retailPrint + retailInstall + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 150);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // UI Tier Log (For Simulator)
    const simTiers = tierLog.map(t => {
        const trPrint = (baseRate * (1 - t.d)) * (sqft * t.q);
        const trInst = inputs.hasInstall ? (installRate * (sqft * t.q)) : 0;
        const total = Math.max(trPrint + trInst + feeSetup + feeDesign, minOrder);
        return { q: t.q, base: baseRate * (1 - t.d), unit: total / t.q };
    });

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const wastePct = parseFloat(data.Waste_Factor || 1.25); // Higher waste for panel overlap

    // Material Costs (Print + Lam combined)
    const costVinylRaw = isVehicle ? parseFloat(data.Cost_Vin_Vehicle || 1.30) : parseFloat(data.Cost_Vin_Wall || 0.21);
    const costLamRaw = isVehicle ? parseFloat(data.Cost_Lam_Vehicle || 0.96) : parseFloat(data.Cost_Lam_Wall || 0.36);
        
    const costVinyl = totalSqFt * costVinylRaw * wastePct;
    const costLam = totalSqFt * costLamRaw * wastePct;
    const costInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16);

    // Labor & Machines
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateInstall = parseFloat(data.Rate_Install || 32);
    const rateMachPrint = parseFloat(data.Rate_Machine_Print || 5);

    // Setup
    const setupMins = parseFloat(data.Time_Setup_Job || 25);
    const costSetup = (setupMins / 60) * rateOp;

    // Print Run
    const speedPrint = parseFloat(data.Speed_Print_Roll || 150);
    const printHrs = totalSqFt / speedPrint;
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costPrintMach = printHrs * rateMachPrint;

    // Lam Run
    const speedLam = parseFloat(data.Speed_Lam_Roll || 300);
    const lamHrs = totalSqFt / speedLam;
    const costLamOp = lamHrs * rateShop; // 100% attendance required

    // Installation Labor
    let costInstallOp = 0;
    if (inputs.hasInstall) {
        const installSpeed = isVehicle ? parseFloat(data.Speed_Install_Vehicle || 10) : parseFloat(data.Speed_Install_Wall || 25);
        const installHrs = totalSqFt / installSpeed;
        costInstallOp = installHrs * rateInstall;
    }

    const subTotal = costVinyl + costLam + costInk + costSetup + costPrintOp + costPrintMach + costLamOp + costInstallOp;
    const riskFactor = parseFloat(data.Factor_Risk || 1.10); // 10% risk for wraps
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: (retailPrint + retailInstall) / inputs.qty,
            printTotal: retailPrint,
            installTotal: retailInstall,
            setupFee: feeSetup,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            tiers: simTiers,
            matLabel: matLabel
        },
        cost: {
            total: subTotal + riskBuffer, // Hard cost includes the high risk factor for wraps
            breakdown: {
                rawVinyl: costVinyl,
                rawLam: costLam,
                totalInk: costInk,
                costSetup: costSetup,
                costPrint: costPrintOp + costPrintMach,
                costLamRun: costLamOp,
                costInstall: costInstallOp,
                riskCost: riskBuffer,
                wastePct: (wastePct - 1) * 100,
                riskPct: (riskFactor - 1) * 100
            }
        },
        metrics: { margin: (grandTotal - (subTotal + riskBuffer)) / grandTotal }
    };
}

// ==========================================
// SIMULATOR CONFIGURATION SCHEMA
// ==========================================
window.WRAP_CONFIG = {
    tab: 'PROD_Vinyl_Wraps', // <-- Set to exact backend tab name
    engine: calculateWrap,
    controls: [
      { id: 'w', label: 'Width (in)', type: 'number', def: 120 },
      { id: 'h', label: 'Height (in)', type: 'number', def: 60 },
      { id: 'app', label: 'Application', type: 'select', opts: [{v:'Vehicle', t:'Vehicle (Cast)'}, {v:'Wall', t:'Wall (Calendered)'}] },
      { id: 'hasInstall', label: 'Include Install', type: 'toggle', def: true },
      { id: 'files', label: 'Files', type: 'number', def: 1 },
      { id: 'setupPerFile', label: 'Setup / File', type: 'toggle', def: false },
      { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    retails: [
      { heading: 'Print Rates ($/SqFt)', key: 'Retail_Price_Vehicle_SqFt', label: 'Cast Wrap ($)' },
      { key: 'Retail_Price_Wall_SqFt', label: 'Wall Wrap ($)' },
      { heading: 'Install Rates ($/SqFt)', key: 'Retail_Install_Vehicle_SqFt', label: 'Vehicle Install ($)' },
      { key: 'Retail_Install_Wall_SqFt', label: 'Wall Install ($)' },
      { heading: 'Volume Discounts', key: 'Tier_1_Qty', label: 'Tier 1 Trigger (Qty)' },
      { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' },
      { heading: 'Flat Fees', key: 'Retail_Fee_Setup', label: 'Setup Fee ($)' },
      { key: 'Retail_Fee_Design', label: 'Design Fee ($)' }
    ],
    costs: [
      { key: 'Cost_Vin_Vehicle', label: 'IJ180 ($/SqFt)' },
      { key: 'Cost_Lam_Vehicle', label: '8518 Lam ($/SqFt)' },
      { key: 'Cost_Vin_Wall', label: 'IJ35C ($/SqFt)' },
      { key: 'Cost_Lam_Wall', label: '210 Lam ($/SqFt)' },
      { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
      { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
      { key: 'Rate_Install', label: 'Installer ($/Hr)' },
      { key: 'Speed_Install_Vehicle', label: 'Veh Inst (SqFt/Hr)' },
      { key: 'Speed_Install_Wall', label: 'Wall Inst (SqFt/Hr)' },
      { key: 'Waste_Factor', label: 'Panel Waste (1.x)' },
      { key: 'Factor_Risk', label: 'Risk Buffer (1.x)' }
    ],
    
    renderReceipt: function(data, fmt) {
      let retailHTML = `
        <div>
          <h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
          <div class="space-y-1 text-xs text-gray-700">
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Printed Graphic (${data.retail.matLabel}):</span> <span>${fmt(data.retail.printTotal)}</span></div>
            ${data.retail.installTotal > 0 ? `<div class="flex justify-between text-indigo-700"><span>Installation Labor:</span> <span>${fmt(data.retail.installTotal)}</span></div>` : ''}
            <div class="flex justify-between"><span>Setup Fee:</span> <span>${fmt(data.retail.setupFee || 0)}</span></div>
            ${data.retail.designFee > 0 ? `<div class="flex justify-between text-purple-700"><span>Design Fee:</span> <span>${fmt(data.retail.designFee)}</span></div>` : ''}
            <div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Retail:</span> <span>${fmt(data.retail.grandTotal)}</span></div>
          </div>
        </div>
      `;
      let costHTML = `
        <div>
          <h4 class="text-[10px] font-bold text-red-800 uppercase mb-2 border-b border-red-200 pb-1">Physics Engine (Cost)</h4>
          <div class="space-y-1 text-xs text-gray-700">`;
      if (data.cost.breakdown) {
        const b = data.cost.breakdown;
        costHTML += `
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Vinyl Material:</span> <span>${fmt(b.rawVinyl)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Laminate Material:</span> <span>${fmt(b.rawLam)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Ink & Setup:</span> <span>${fmt(b.totalInk + b.costSetup)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Print & Lam Run:</span> <span>${fmt(b.costPrint + b.costLamRun)}</span></div>
            ${b.costInstall > 0 ? `<div class="flex justify-between text-indigo-700"><span class="border-b border-dotted border-indigo-400">Install Labor:</span> <span>${fmt(b.costInstall)}</span></div>` : ''}
            <div class="border-t border-gray-200 mt-2 pt-1"></div>
            <h4 class="text-[9px] font-bold text-gray-500 uppercase mb-1">Additives & Risk</h4>
            <div class="flex justify-between text-red-600"><span class="border-b border-dotted border-red-400">Panel Waste (${b.wastePct ? b.wastePct.toFixed(0) : 10}%):</span> <span>(Calculated Above)</span></div>
            <div class="flex justify-between text-orange-600"><span class="border-b border-dotted border-orange-400">Hard Risk Buffer (${b.riskPct ? b.riskPct.toFixed(0) : 5}%):</span> <span>(+ ${fmt(b.riskCost)})</span></div>
        `;
      }
      costHTML += `<div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div></div></div>`;
      return retailHTML + costHTML;
    }
};
