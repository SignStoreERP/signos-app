/**
 * PURE PHYSICS ENGINE: Vinyl Banners (v10.5)
 * Uses Math.ceil() for Yield Bounding Boxes and dynamic fabrication constraints.
 */
function calculateBanner(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    
    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    // Yield Math: Round up to nearest foot
    const minFt = Math.ceil(Math.min(inputs.w, inputs.h) / 12);
    const maxFt = Math.ceil(Math.max(inputs.w, inputs.h) / 12);
    const wStr = minFt < 10 ? `0${minFt}` : `${minFt}`;
    const hStr = maxFt < 10 ? `0${maxFt}` : `${maxFt}`;
    const sideStr = inputs.sides === 2 ? 'DS' : 'SS';
    const blueKey = `RET_BAN_${wStr}${hStr}_${sideStr}`;

    let baseRate = 0;
    let matLabel = "13oz Scrim";
    let retailPrint = 0;
    let tierLog = [];

    // Bounding Box Lookup
    if (inputs.material === '13oz' && data[`${blueKey}_1`]) {
        // MATCH: Apply Yield Envelope
        const p1 = parseFloat(data[`${blueKey}_1`]);
        const p10 = parseFloat(data[`${blueKey}_10`]);
        const appliedBase = inputs.qty >= 10 ? p10 : p1;
        
        retailPrint = appliedBase * inputs.qty;
        baseRate = p1 / sqft; // For display purposes
        tierLog.push(
            { q: 1, base: baseRate, d: 0, unitBase: p1 },
            { q: 10, base: baseRate, d: 0, unitBase: p10 }
        );
    } else {
        // NO MATCH: Oversize / Special Material Fallback
        const minDim = Math.min(inputs.w, inputs.h);
        if (inputs.material === '13oz') {
            if (minDim <= 12) baseRate = parseFloat(data.BAN13_T1_Rate || 6.50);
            else if (sqft < parseFloat(data.BAN13_T2_Max || 10)) baseRate = parseFloat(data.BAN13_T2_Rate || 6.00);
            else baseRate = parseFloat(data.BAN13_T3_Rate || 5.00);
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

        if (inputs.sides === 2) baseRate += parseFloat(data.Retail_Adder_DS_SqFt || 3.00);

        let discPct = 0, currentBestTier = 0, i = 1;
        while(data[`Tier_${i}_Qty`]) {
            const tQty = parseFloat(data[`Tier_${i}_Qty`]);
            const tDisc = parseFloat(data[`Tier_${i}_Disc`] || 0);
            tierLog.push({ q: tQty, d: tDisc, unitBase: (baseRate * (1-tDisc)) * sqft });
            if (inputs.qty >= tQty) currentBestTier = tDisc;
            i++;
        }
        retailPrint = (baseRate * (1 - currentBestTier)) * totalSqFt;
    }

    // Finishing Adders
    let retailPockets = 0;
    if (inputs.pockets && inputs.pockets !== 'None') {
        retailPockets = ((inputs.w / 12) * 2) * inputs.qty * parseFloat(data.Retail_Fin_PolePkt_LF || 3.00);
    }
    
    let retailSlits = 0;
    if (inputs.windSlits) retailSlits = totalSqFt * parseFloat(data.Retail_Price_WindSlits_SqFt || 1.00);

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetup = inputs.setupPerFile ? (parseFloat(data.Retail_Fee_Setup || 15) * inputs.files) : parseFloat(data.Retail_Fee_Setup || 15);
    const grandTotalRaw = retailPrint + retailPockets + retailSlits + feeDesign + feeSetup;
    
    const minOrder = data[`${blueKey}_1`] ? 0 : parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // Format UI Tiers
    const simTiers = tierLog.map(t => {
        const trPrint = t.unitBase * t.q;
        const trPocket = (inputs.pockets && inputs.pockets !== 'None') ? ((inputs.w/12)*2 * t.q * parseFloat(data.Retail_Fin_PolePkt_LF || 3)) : 0;
        const trSlits = inputs.windSlits ? ((sqft * t.q) * parseFloat(data.Retail_Price_WindSlits_SqFt || 1)) : 0;
        const total = Math.max(trPrint + trPocket + trSlits + feeSetup + feeDesign, minOrder);
        return { q: t.q, base: baseRate * (1 - (t.d||0)), unit: total / t.q };
    });

    // ==========================================================
    // DYNAMIC CONSTRAINT & FABRICATION MATH (Phase 4.5)
    // ==========================================================
    
    // Extract physics constants from the backend payload
    const maxRollWidth = parseFloat(data.Printer_Max_Roll_Width || 64);
    const hemAllow = parseFloat(data.Allow_Hem_Inch || 1);
    const pktMult = parseFloat(data.Allow_PolePkt_Mult || 3.14);

    // 1. Calculate the dynamic maximum printable width
    let dynamicMaxWidth = maxRollWidth;
    if (inputs.hems) {
        dynamicMaxWidth -= (hemAllow * 2); // 1" on each side = 2" total media lost
    }
    
    if (inputs.pockets && inputs.pockets !== 'None') {
        const pocketSize = inputs.pocketSize || 2; 
        const pocketMediaLost = (pocketSize * pktMult) + (hemAllow * 2);
        dynamicMaxWidth -= pocketMediaLost; 
    }

    // Set the flag if the requested size exceeds dynamic limits
    const isOversize = Math.min(inputs.w, inputs.h) > dynamicMaxWidth;

    // 2. Grommet Fabrication Rules
    let perimLF = ((inputs.w + inputs.h) * 2) / 12 * inputs.qty;
    let grommetPerimLF = perimLF;
    
    if (inputs.pockets === 'TopBottom') {
        // Only the left and right vertical sides can receive grommets
        grommetPerimLF = (inputs.h * 2) / 12 * inputs.qty; 
    } else if (inputs.pockets === 'Top') {
        // Exclude the top edge from grommet calculations
        grommetPerimLF = (((inputs.h * 2) + inputs.w) / 12) * inputs.qty; 
    }

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const prodW = inputs.hems ? inputs.w + (hemAllow * 2) : inputs.w;
    const prodH = inputs.hems ? inputs.h + (hemAllow * 2) : inputs.h;
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
    
    const costTape = inputs.hems ? (perimLF * parseFloat(data.Cost_Hem_Tape || 0.08)) * wastePct : 0;

    let costGrom = 0, gromCount = 0;
    if (inputs.grommets) {
        gromCount = Math.max(Math.ceil(grommetPerimLF / 2), 4 * inputs.qty);
        costGrom = gromCount * parseFloat(data.Cost_Grommet || 0.13) * wastePct;
    }

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const costSetup = ((parseFloat(data.Time_Setup_Job || 15) + parseFloat(data.Time_Handling || 2)) / 60) * rateOp;

    const printHrs = totalProdSqFt / parseFloat(data.Speed_Print_Roll || 150) * inputs.sides;
    const costPrintOp = printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10);
    const costPrintMach = printHrs * parseFloat(data.Rate_Machine_Print || 5);

    const finishHrs = ((inputs.hems ? perimLF * 0.5 : 0) + (inputs.grommets ? gromCount * 1.0 : 0) + (inputs.windSlits ? totalSqFt * 0.1 : 0) + (inputs.pockets && inputs.pockets !== 'None' ? (inputs.w/12)*2 * inputs.qty * 2 : 0) + (perimLF * 0.25)) / 60;
    const costFinish = finishHrs * rateShop;

    const subTotal = costMedia + costInk + costTape + costGrom + costSetup + costPrintOp + costPrintMach + costFinish;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: {
            unitPrice: (retailPrint + retailPockets + retailSlits) / inputs.qty,
            printTotal: retailPrint, pocketTotal: retailPockets, slitTotal: retailSlits,
            setupFee: feeSetup, designFee: feeDesign, grandTotal: grandTotal, isMinApplied: grandTotalRaw < minOrder,
            isOversize: isOversize, tiers: simTiers, baseRate: baseRate, matLabel: matLabel, yieldLabel: data[`${blueKey}_1`] ? `Yield Box: ${minFt}'x${maxFt}'` : "Area Curve"
        },
        cost: { 
            total: subTotal * riskFactor, 
            breakdown: { rawMedia: costMedia, unitMedia: costVinylRaw, rawInk: costInk, rawTape: costTape, rawGrom: costGrom, costSetup: costSetup, costPrint: costPrintOp + costPrintMach, costFinish: costFinish, riskCost: subTotal * (riskFactor - 1), wastePct: (wastePct - 1) * 100, riskPct: (riskFactor - 1) * 100 } 
        },
        metrics: { margin: (grandTotal - (subTotal * riskFactor)) / grandTotal }
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
        { id: 'material', label: 'Material', type: 'select', opts: [{v:'13oz', t:'13oz Standard'}, {v:'15oz', t:'15oz Blockout'}, {v:'18oz', t:'18oz Heavy'}, {v:'Mesh', t:'8oz Mesh'}] },
        { id: 'sides', label: 'Print Sides', type: 'select', opts: [{v:1, t:'1-Sided'}, {v:2, t:'2-Sided'}] },
        { id: 'hems', label: 'Tape Hems', type: 'toggle', def: true },
        { id: 'grommets', label: 'Grommets', type: 'toggle', def: true },
        { id: 'pockets', label: 'Pole Pockets', type: 'select', opts: [{v:'None', t:'None'}, {v:'Top', t:'Top Only'}, {v:'TopBottom', t:'Top & Bottom'}] },
        { id: 'windSlits', label: 'Wind Slits', type: 'toggle', def: false },
        { id: 'files', label: 'Files', type: 'number', def: 1 },
        { id: 'setupPerFile', label: 'Setup / File', type: 'toggle', def: false },
        { id: 'incDesign', label: 'Design Fee', type: 'toggle', def: false }
    ],
    retails: [
        { heading: 'Material Tiers ($/SqFt)', key: 'BAN13_T1_Rate', label: '13oz Rate (1ft Tall)' },
        { key: 'BAN13_T2_Rate', label: '13oz Rate (<10sf)' },
        { key: 'BAN13_T3_Rate', label: '13oz Rate (>10sf)' },
        { key: 'Retail_Price_Base_15oz', label: '15oz Rate ($)' },
        { key: 'Retail_Price_Base_18oz', label: '18oz Rate ($)' },
        { key: 'Retail_Price_Base_Mesh', label: 'Mesh Rate ($)' },
        { heading: 'Adders & Finishings', key: 'Retail_Adder_DS_SqFt', label: 'Double Sided ($/sf)' },
        { key: 'Retail_Fin_PolePkt_LF', label: 'Pole Pocket ($/LF)' },
        { key: 'Retail_Price_WindSlits_SqFt', label: 'Wind Slits ($/sf)' },
        { heading: 'Volume Discounts', key: 'Tier_1_Qty', label: 'T1 Trigger (Qty)' },
        { key: 'Tier_1_Disc', label: 'T1 Discount (%)' }
    ],
    costs: [
        { heading: 'Roll Media', key: 'Cost_Media_13oz', label: '13oz Vinyl ($/sf)' },
        { key: 'Cost_Media_15oz', label: '15oz Blockout ($/sf)' },
        { key: 'Cost_Media_18oz', label: '18oz Heavy ($/sf)' },
        { key: 'Cost_Media_Mesh', label: '8oz Mesh ($/sf)' },
        { heading: 'Fabrication Math', key: 'Printer_Max_Roll_Width', label: 'Max Media Width' },
        { key: 'Allow_Hem_Inch', label: 'Hem Allowance (in)' },
        { key: 'Allow_PolePkt_Mult', label: 'Pkt Mult (Pi)' },
        { heading: 'Finishings & Ink', key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },
        { key: 'Cost_Grommet', label: 'Grommet ($/ea)' },
        { key: 'Cost_Hem_Tape', label: 'Hem Tape ($/LF)' },
        { heading: 'Machine Speeds & Time', key: 'Speed_Print_Roll', label: 'Print Spd (SqFt/hr)' },
        { key: 'Time_Setup_Job', label: 'Setup Job (Mins)' },
        { key: 'Time_Handling', label: 'Handling (Mins)' },
        { key: 'Time_Hem_LF', label: 'Hemming (Mins/LF)' },
        { key: 'Time_PolePkt_LF', label: 'Pockets (Mins/LF)' },
        { heading: 'Rates & Overhead', key: 'Rate_Operator', label: 'Print Op ($/Hr)' },
        { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Machine_Print', label: 'Printer Mach ($/Hr)' },
        { key: 'Labor_Attendance_Ratio', label: 'Attn Ratio (0-1)' },
        { key: 'Waste_Factor', label: 'Waste Buffer' }
    ],
    renderReceipt: function(data, fmt) {
        let retailHTML = `<div><h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
        <div class="space-y-1 text-xs text-gray-700">
        <div class="flex justify-between"><span>Base Print:</span> <span>${fmt(data.retail.printTotal)}</span></div>
        ${data.retail.pocketTotal > 0 ? `<div class="flex justify-between text-orange-700"><span>Pole Pockets:</span> <span>${fmt(data.retail.pocketTotal)}</span></div>` : ''}
        ${data.retail.slitTotal > 0 ? `<div class="flex justify-between text-teal-700"><span>Wind Slits:</span> <span>${fmt(data.retail.slitTotal)}</span></div>` : ''}
        <div class="flex justify-between"><span>Setup Fee:</span> <span>${fmt(data.retail.setupFee || 0)}</span></div>
        ${data.retail.designFee > 0 ? `<div class="flex justify-between text-purple-700"><span>Design Fee:</span> <span>${fmt(data.retail.designFee)}</span></div>` : ''}
        <div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Retail:</span> <span>${fmt(data.retail.grandTotal)}</span></div>
        </div></div>`;

        let costHTML = `<div class="mt-6"><h4 class="text-[10px] font-bold text-red-800 uppercase mb-2 border-b border-red-200 pb-1">Physics Engine (Cost)</h4>
        <div class="space-y-1 text-xs text-gray-700">`;

        if (data.cost.breakdown) {
            const b = data.cost.breakdown;
            costHTML += `
            <div class="flex justify-between"><span>Roll Material:</span> <span>${fmt(b.rawMedia)}</span></div>
            <div class="flex justify-between"><span>Ink:</span> <span>${fmt(b.rawInk)}</span></div>
            ${b.rawTape > 0 ? `<div class="flex justify-between"><span>Hem Tape:</span> <span>${fmt(b.rawTape)}</span></div>` : ''}
            ${b.rawGrom > 0 ? `<div class="flex justify-between"><span>Grommets:</span> <span>${fmt(b.rawGrom)}</span></div>` : ''}
            <div class="flex justify-between"><span>Setup Labor:</span> <span>${fmt(b.costSetup)}</span></div>
            <div class="flex justify-between"><span>Print Run:</span> <span>${fmt(b.costPrint)}</span></div>
            <div class="flex justify-between"><span>Finishing Labor:</span> <span>${fmt(b.costFinish)}</span></div>
            <div class="border-t border-gray-200 mt-2 pt-1"></div>
            <div class="flex justify-between text-red-600"><span>Material Waste (${b.wastePct ? b.wastePct.toFixed(0) : 15}%):</span> <span>(Calculated Above)</span></div>
            <div class="flex justify-between text-orange-500 opacity-80"><span>Suggested Risk Buffer (${b.riskPct ? b.riskPct.toFixed(0) : 5}%):</span> <span>(+ ${fmt(b.riskCost)})</span></div>`;
        }

        costHTML += `<div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div></div></div>`;
        return retailHTML + costHTML;
    }
};
