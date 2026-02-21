/**
 * PURE PHYSICS ENGINE: Vinyl Banners (v10.0 - Dual Track)
 * Implements strict area curves for 13oz and extracts hemming/grommet BOM.
 */

function calculateBanner(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    
    const minDim = Math.min(inputs.w, inputs.h);
    const isOversize = minDim > parseFloat(data.Constraint_Max_Width_Inhouse || 62);

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    let baseRate = 0;
    let matLabel = "";
    
    if (inputs.material === '13oz') {
        matLabel = "13oz Scrim";
        if (minDim <= 12) {
            baseRate = parseFloat(data.BAN13_T1_Rate || 6.50);
        } else if (sqft < parseFloat(data.BAN13_T2_Max || 10)) {
            baseRate = parseFloat(data.BAN13_T2_Rate || 6.00);
        } else {
            baseRate = parseFloat(data.BAN13_T3_Rate || 5.00);
        }
    } else if (inputs.material === '15oz') {
        matLabel = "15oz Smooth Blockout";
        baseRate = parseFloat(data.Retail_Price_Base_15oz || 6.50);
    } else if (inputs.material === '18oz') {
        matLabel = "18oz Heavy Blockout";
        baseRate = parseFloat(data.Retail_Price_Base_18oz || 8.00);
    } else if (inputs.material === 'Mesh') {
        matLabel = "8oz Mesh";
        baseRate = parseFloat(data.Retail_Price_Base_Mesh || 7.00);
    }

    if (inputs.sides === 2) {
        baseRate += parseFloat(data.Retail_Adder_DS_SqFt || 3.00);
    }

    // Volume Tiers
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

    // Finishing Adders
    let retailPockets = 0;
    if (inputs.pockets) {
        const pocketLF = (inputs.w / 12) * 2; // Top & Bottom
        retailPockets = pocketLF * inputs.qty * parseFloat(data.Retail_Fin_PolePkt_LF || 3.00);
    }

    let retailSlits = 0;
    if (inputs.windSlits) {
        retailSlits = totalSqFt * parseFloat(data.Retail_Price_WindSlits_SqFt || 1.00);
    }

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 15);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;

    const grandTotalRaw = retailPrint + retailPockets + retailSlits + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // UI Tier Log (For Simulator)
    const simTiers = tierLog.map(t => {
        const trPrint = (baseRate * (1 - t.d)) * (sqft * t.q);
        const trPocket = inputs.pockets ? ((inputs.w/12)*2 * t.q * parseFloat(data.Retail_Fin_PolePkt_LF || 3)) : 0;
        const trSlits = inputs.windSlits ? ((sqft * t.q) * parseFloat(data.Retail_Price_WindSlits_SqFt || 1)) : 0;
        const total = Math.max(trPrint + trPocket + trSlits + feeSetup + feeDesign, minOrder);
        return { q: t.q, base: baseRate * (1 - t.d), unit: total / t.q };
    });


    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const prodW = inputs.hems ? inputs.w + 2 : inputs.w;
    const prodH = inputs.hems ? inputs.h + 2 : inputs.h;
    const prodSqFt = (prodW * prodH) / 144;
    const totalProdSqFt = prodSqFt * inputs.qty;

    let costVinylRaw = 0;
    if (inputs.material === '13oz') costVinylRaw = parseFloat(data.Cost_Media_13oz || 0.26);
    else if (inputs.material === '15oz') costVinylRaw = parseFloat(data.Cost_Media_15oz || 0.46);
    else if (inputs.material === '18oz') costVinylRaw = parseFloat(data.Cost_Media_18oz || 0.39);
    else costVinylRaw = parseFloat(data.Cost_Media_Mesh || 0.33);

    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const costMedia = totalProdSqFt * costVinylRaw * wastePct;
    const costInk = totalProdSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * inputs.sides;
    
    const perimLF = ((inputs.w + inputs.h) * 2) / 12 * inputs.qty;
    const costTape = inputs.hems ? (perimLF * parseFloat(data.Cost_Hem_Tape || 0.08)) * wastePct : 0;

    let costGrom = 0;
    let gromCount = 0;
    if (inputs.grommets) {
        gromCount = Math.ceil(perimLF / 2); // 1 grommet every 2 feet
        if (gromCount < 4 * inputs.qty) gromCount = 4 * inputs.qty; // Minimum 4 per banner
        costGrom = gromCount * parseFloat(data.Cost_Grommet || 0.13) * wastePct;
    }

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateMach = parseFloat(data.Rate_Machine_Print || 5);

    const setupMins = parseFloat(data.Time_Setup_Job || 15) + parseFloat(data.Time_Handling || 2);
    const costSetup = (setupMins / 60) * rateOp;

    const speed = parseFloat(data.Speed_Print_Roll || 150);
    const printHrs = totalProdSqFt / speed * inputs.sides;
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintOp = printHrs * rateOp * attnRatio;
    const costPrintMach = printHrs * rateMach;

    // Finishing Labor (Hemming, Grommeting, Hand Cutting)
    const hemMins = inputs.hems ? (perimLF * parseFloat(data.Time_Hem_LF || 0.5)) : 0;
    const gromMins = inputs.grommets ? (gromCount * parseFloat(data.Time_Grommet_Per || 1.0)) : 0;
    const slitMins = inputs.windSlits ? (totalSqFt * parseFloat(data.Time_WindSlits_SqFt || 0.1)) : 0;
    const pocketMins = inputs.pockets ? ((inputs.w/12)*2 * inputs.qty * parseFloat(data.Time_PolePkt_LF || 2)) : 0;
    const cutMins = perimLF * parseFloat(data.Time_Cut_Hand || 0.25);

    const finishHrs = (hemMins + gromMins + slitMins + pocketMins + cutMins) / 60;
    const costFinish = finishHrs * rateShop;

    const subTotal = costMedia + costInk + costTape + costGrom + costSetup + costPrintOp + costPrintMach + costFinish;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: (retailPrint + retailPockets + retailSlits) / inputs.qty,
            printTotal: retailPrint,
            pocketTotal: retailPockets,
            slitTotal: retailSlits,
            setupFee: feeSetup,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            isOversize: isOversize,
            tiers: simTiers,
            baseRate: baseRate,
            matLabel: matLabel
        },
        cost: {
            total: subTotal,
            breakdown: {
                rawMedia: costMedia,
                unitMedia: costVinylRaw,
                rawInk: costInk,
                rawTape: costTape,
                rawGrom: costGrom,
                costSetup: costSetup,
                costPrint: costPrintOp + costPrintMach,
                costFinish: costFinish,
                riskCost: riskBuffer,
                wastePct: (wastePct - 1) * 100,
                riskPct: (riskFactor - 1) * 100
            }
        },
        metrics: { margin: (grandTotal - subTotal) / grandTotal }
    };
}

// ==========================================
// SIMULATOR CONFIGURATION SCHEMA
// ==========================================
window.BANNER_CONFIG = {
    tab: 'PROD_Vinyl_Banners',
    engine: calculateBanner,
    controls: [
      { id: 'w', label: 'Width (in)', type: 'number', def: 72 },
      { id: 'h', label: 'Height (in)', type: 'number', def: 36 },
      { id: 'material', label: 'Material', type: 'select', opts: [{v:'13oz', t:'13oz Standard'}, {v:'15oz', t:'15oz Smooth'}, {v:'18oz', t:'18oz Blockout'}, {v:'Mesh', t:'8oz Mesh'}] },
      { id: 'sides', label: 'Sides', type: 'select', opts: [{v:1, t:'Single Sided'}, {v:2, t:'Double Sided'}] },
      { id: 'hems', label: 'Hem Edges', type: 'toggle', def: true },
      { id: 'grommets', label: 'Grommets', type: 'toggle', def: true },
      { id: 'pockets', label: 'Pole Pockets', type: 'toggle', def: false },
      { id: 'windSlits', label: 'Wind Slits', type: 'toggle', def: false },
      { id: 'files', label: 'Files', type: 'number', def: 1 },
      { id: 'setupPerFile', label: 'Setup / File', type: 'toggle', def: false },
      { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    dynamicUI: function(inputs) {
      if(inputs.material !== '18oz') inputs.sides = 1;
      return inputs;
    },
    retails: [
      { heading: '13oz Specific Tiers ($/SqFt)', key: 'BAN13_T1_Rate', label: '1ft Tall Rate' },
      { key: 'BAN13_T2_Rate', label: '<10 SqFt Rate' },
      { key: 'BAN13_T3_Rate', label: 'Base Rate (>10)' },
      { heading: 'Other Base Rates ($/SqFt)', key: 'Retail_Price_Base_15oz', label: '15oz Rate' },
      { key: 'Retail_Price_Base_18oz', label: '18oz Rate' },
      { key: 'Retail_Price_Base_Mesh', label: 'Mesh Rate' },
      { heading: 'Adders & Fees', key: 'Retail_Adder_DS_SqFt', label: 'Side 2 Adder ($/sf)' },
      { key: 'Retail_Fin_PolePkt_LF', label: 'Pole Pockets ($/lf)' },
      { key: 'Retail_Fee_Setup', label: 'Setup Fee ($)' },
      { heading: 'Volume Discounts', key: 'Tier_1_Qty', label: 'Tier 1 Trigger (Qty)' },
      { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' }
    ],
    costs: [
      { key: 'Cost_Media_13oz', label: '13oz Cost ($/sf)' },
      { key: 'Cost_Media_18oz', label: '18oz Cost ($/sf)' },
      { key: 'Cost_Grommet', label: 'Grommet ($/ea)' },
      { key: 'Cost_Hem_Tape', label: 'Hem Tape ($/lf)' },
      { key: 'Cost_Ink_Latex', label: 'Ink ($/sf)' },
      { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
      { key: 'Rate_Shop_Labor', label: 'Finishing ($/Hr)' },
      { key: 'Speed_Print_Roll', label: 'Print Spd (SqFt/hr)' },
      { key: 'Time_Setup_Job', label: 'File Setup (Mins)' },
      { key: 'Time_Handling', label: 'Handling (Mins)' },
      { key: 'Waste_Factor', label: 'Waste (1.x)' }
    ],
    
    renderReceipt: function(data, fmt) {
      let retailHTML = `
        <div>
          <h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
          <div class="space-y-1 text-xs text-gray-700">
            <div class="flex justify-between" title="Based on base material rate x sqft."><span class="cursor-help border-b border-dotted border-gray-400">Print Base (${data.retail.matLabel} @ ${fmt(data.retail.baseRate)}/sf):</span> <span>${fmt(data.retail.printTotal)}</span></div>
            ${data.retail.pocketTotal > 0 ? `<div class="flex justify-between text-blue-700"><span>Pole Pockets:</span> <span>${fmt(data.retail.pocketTotal)}</span></div>` : ''}
            ${data.retail.slitTotal > 0 ? `<div class="flex justify-between text-teal-700"><span>Wind Slits:</span> <span>${fmt(data.retail.slitTotal)}</span></div>` : ''}
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
            <div class="flex justify-between"><span class="cursor-help border-b border-dotted border-gray-400" title="Includes waste buffer on sqft.">Banner Media (${data.retail.matLabel} @ ${fmt(b.unitMedia)}/sf):</span> <span>${fmt(b.rawMedia)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Ink Cost:</span> <span>${fmt(b.rawInk)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Finishing Supplies (Tape & Grommets):</span> <span>${fmt(b.rawTape + b.rawGrom)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Setup Labor:</span> <span>${fmt(b.costSetup)}</span></div>
            <div class="flex justify-between"><span class="cursor-help border-b border-dotted border-gray-400" title="Factored at Operator Attention Ratio.">Plotter Run:</span> <span>${fmt(b.costPrint)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Hand Finishing Labor:</span> <span>${fmt(b.costFinish)}</span></div>
            <div class="border-t border-gray-200 mt-2 pt-1"></div>
            <h4 class="text-[9px] font-bold text-gray-500 uppercase mb-1">Additives & Risk</h4>
            <div class="flex justify-between text-red-600"><span class="border-b border-dotted border-red-400">Material Waste (${b.wastePct ? b.wastePct.toFixed(0) : 15}%):</span> <span>(Calculated Above)</span></div>
            <div class="flex justify-between text-orange-500 opacity-80"><span class="border-b border-dotted border-orange-300">Suggested Risk Buffer (${b.riskPct ? b.riskPct.toFixed(0) : 5}%):</span> <span>(+ ${fmt(b.riskCost)})</span></div>
        `;
      }
      costHTML += `<div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div></div></div>`;
      return retailHTML + costHTML;
    }
};
