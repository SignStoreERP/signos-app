/**
 * PURE PHYSICS ENGINE: Acrylic Signs (v5.2 - Dual Track)
 * Implements Direct Print (Flatbed) vs Vinyl Application (Roll + Plotter + Mounting) physics.
 * v5.2: Added missing 3/4" and 1" sheets, plus all Labor & Setup variables to the Simulator Config.
 */

function calculateAcrylic(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;

    // --- 1. RETAIL ENGINE (MARKET VALUE) ---
    let baseRate = 0;
    
    if (inputs.thickness === '0.25') {
        if (totalSqFt <= parseFloat(data.ACR_14_T1_Max || 10)) baseRate = parseFloat(data.ACR_14_T1_Rate || 40);
        else if (totalSqFt <= parseFloat(data.ACR_14_T2_Max || 20)) baseRate = parseFloat(data.ACR_14_T2_Rate || 35);
        else baseRate = parseFloat(data.ACR_14_T3_Rate || 30);
    } else if (inputs.thickness === '0.5') {
        if (totalSqFt <= parseFloat(data.ACR_12_T1_Max || 10)) baseRate = parseFloat(data.ACR_12_T1_Rate || 45);
        else baseRate = parseFloat(data.ACR_12_T2_Rate || 40);
    } else if (inputs.thickness === '0.75') {
        if (totalSqFt <= parseFloat(data.ACR_34_T1_Max || 10)) baseRate = parseFloat(data.ACR_34_T1_Rate || 55);
        else baseRate = parseFloat(data.ACR_34_T2_Rate || 50);
    } else {
        if (totalSqFt <= parseFloat(data.ACR_1IN_T1_Max || 10)) baseRate = parseFloat(data.ACR_1IN_T1_Rate || 60);
        else baseRate = parseFloat(data.ACR_1IN_T2_Rate || 55);
    }

    if (inputs.method === 'direct_white') baseRate += parseFloat(data.Retail_Adder_2ndSurf || 5);
    if (inputs.method === 'direct_3layer') baseRate += parseFloat(data.Retail_Adder_Blockout || 8);
    if (inputs.method === 'direct_5layer') baseRate += parseFloat(data.Retail_Adder_Blockout || 8) + 4; 

    let retailPrint = baseRate * totalSqFt;

    let paintFee = 0;
    if (inputs.paint) paintFee = parseFloat(data.Retail_Fee_Paint_Setup || 65) + (totalSqFt * parseFloat(data.Retail_Adder_Paint_SqFt || 20));

    let routerFee = 0;
    if (inputs.shape === 'Easy') routerFee = parseFloat(data.Retail_Fee_Router_Easy || 30);
    else if (inputs.shape === 'Complex') routerFee = parseFloat(data.Retail_Fee_Router_Hard || 50);

    let hwFee = 0;
    if (inputs.standoffs) hwFee = inputs.standoffQty * parseFloat(data.Retail_Price_Standoff || 8) * inputs.qty;

    const feeDesign = inputs.incDesign ? parseFloat(data.Retail_Fee_Design || 45) : 0;
    const feeSetupBase = parseFloat(data.Retail_Fee_Setup || 25);
    const feeSetup = inputs.setupPerFile ? (feeSetupBase * inputs.files) : feeSetupBase;

    const grandTotalRaw = retailPrint + paintFee + routerFee + hwFee + feeDesign + feeSetup;
    const minOrder = parseFloat(data.Retail_Min_Order || 75);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const sheetSqFt = 32; 
    const wastePct = parseFloat(data.Waste_Factor || 1.25);
    const attnRatio = parseFloat(data.Labor_Attendance_Ratio || 0.10);
    
    // Substrate Cost (Thickness AND Color Logic)
    let rawSheetCost = 0;
    if (inputs.thickness === '0.25') {
        rawSheetCost = inputs.color === 'Clear' ? parseFloat(data.Cost_Stock_14_4x8_C || 120.55) : parseFloat(data.Cost_Stock_14_4x8_W || 133.27);
    } else if (inputs.thickness === '0.5') {
        rawSheetCost = inputs.color === 'Clear' ? parseFloat(data.Cost_Stock_12_4x8_C || 264.71) : parseFloat(data.Cost_Stock_12_4x8_W || 289.31);
    } else if (inputs.thickness === '0.75') {
        rawSheetCost = inputs.color === 'Clear' ? parseFloat(data.Cost_Stock_34_4x8_C || 424.17) : parseFloat(data.Cost_Stock_34_4x8_W || 459.65);
    } else {
        rawSheetCost = inputs.color === 'Clear' ? parseFloat(data.Cost_Stock_1IN_4x8_C || 496.71) : parseFloat(data.Cost_Stock_1IN_4x8_W || 712.77);
    }
        
    const costSubstrate = (totalSqFt / sheetSqFt) * rawSheetCost * wastePct;

    // Rates
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateCNC = parseFloat(data.Rate_CNC_Labor || 25);
    const ratePaint = parseFloat(data.Rate_Paint_Labor || 30);
    
    const rateMachFB = parseFloat(data.Rate_Machine_Flatbed || 10);
    const rateMachCNC = parseFloat(data.Rate_Machine_CNC || 10);
    const rateMachRoll = parseFloat(data.Rate_Machine_Print || 5);
    const rateMachPlot = parseFloat(data.Rate_Machine_Cut || 5);

    // --- WORKFLOW ROUTING ---
    let costInk = 0;
    let costVinLam = 0;
    let costPrintLabor = 0;
    let costPrintMach = 0;
    let costMountLabor = 0;

    // A. DIRECT PRINT WORKFLOW (Flatbed)
    if (inputs.method.startsWith('direct')) {
        costInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16);
        let lfSpeed = parseFloat(data.Speed_Print_1st || 18);
        if (inputs.method === 'direct_white') lfSpeed = parseFloat(data.Speed_Print_White || 6);
        if (inputs.method === 'direct_3layer') lfSpeed = parseFloat(data.Speed_Print_3Layer || 3.1);
        if (inputs.method === 'direct_5layer') lfSpeed = parseFloat(data.Speed_Print_5Layer || 1.6);
        
        const printHrs = (totalSqFt / 2 / lfSpeed); // Assuming 24" nest
        costPrintLabor = printHrs * rateOp * attnRatio;
        costPrintMach = printHrs * rateMachFB;
    } 
    // B. PRINTED VINYL WORKFLOW (Roll + Lam + Mount)
    else if (inputs.method.startsWith('vinyl_print')) {
        const vinCost = parseFloat(data.Cost_Vin_Print || 0.21);
        const lamCost = parseFloat(data.Cost_Lam_SqFt || 0.36);
        costVinLam = totalSqFt * (vinCost + lamCost) * wastePct;
        costInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16);
        
        const rollHrs = totalSqFt / parseFloat(data.Speed_Print_Roll || 150);
        const lamHrs = totalSqFt / parseFloat(data.Speed_Lam_Roll || 300);
        
        costPrintLabor = (rollHrs * rateOp * attnRatio) + (lamHrs * rateShop);
        costPrintMach = rollHrs * rateMachRoll;
        
        const mountHrs = (totalSqFt / sheetSqFt) * (parseFloat(data.Time_Mount_4x8 || 15) / 60);
        costMountLabor = mountHrs * rateShop;
    }
    // C. CUT VINYL WORKFLOW (Plotter + Weed + Mask + Mount)
    else if (inputs.method.startsWith('vinyl_cut')) {
        const vinCost = inputs.method.includes('trn') ? parseFloat(data.Cost_Vin_Cut_Trn || 1.25) : parseFloat(data.Cost_Vin_Cut_Opq || 0.95);
        const tapeCost = parseFloat(data.Cost_Transfer_Tape || 0.15);
        costVinLam = totalSqFt * (vinCost + tapeCost) * wastePct;
        
        const plotHrs = totalSqFt / parseFloat(data.Speed_Cut_Graphtec || 50);
        const weedHrs = (totalSqFt * parseFloat(data.Time_Weed_Simple || 2)) / 60;
        const maskHrs = (totalSqFt * parseFloat(data.Time_Mask_SqFt || 1)) / 60;
        const mountHrs = (totalSqFt / sheetSqFt) * (parseFloat(data.Time_Mount_4x8 || 15) / 60);

        costPrintLabor = (weedHrs + maskHrs) * rateShop; 
        costPrintMach = plotHrs * rateMachPlot; 
        costMountLabor = mountHrs * rateShop;
    }

    // Prepress Common Setup
    const costPrepressPrint = (parseFloat(data.Time_Prepress_Print || 10) / 60) * rateOp;
    const costMachSetupPrint = (parseFloat(data.Time_Setup_Printer || 5) / 60) * rateOp;

    // Cutting Department (CNC)
    let costPrepressCNC = 0;
    let costMachSetupCNC = 0;
    let costCutMach = 0;
    let costCutLabor = 0;

    if (inputs.shape !== 'Rectangle') {
        costPrepressCNC = (parseFloat(data.Time_Prepress_CNC || 15) / 60) * rateCNC;
        costMachSetupCNC = (parseFloat(data.Time_Setup_CNC || 10) / 60) * rateCNC; 
        
        const runMinsSqFt = inputs.shape === 'Easy' ? parseFloat(data.Time_CNC_Easy_SqFt || 1) : parseFloat(data.Time_CNC_Complex_SqFt || 2);
        const cutHrs = (totalSqFt * runMinsSqFt) / 60;
        
        costCutMach = cutHrs * rateMachCNC;
        costCutLabor = cutHrs * rateCNC * attnRatio; 
    } else {
        costCutLabor = ((inputs.qty * 1) / 60) * rateShop;
    }

    // Paint Department
    let costPaintLabor = 0;
    let costPaintMat = 0;
    if (inputs.paint) {
        costPaintMat = totalSqFt * parseFloat(data.Cost_Paint_SqFt || 2.50);
        const pSetupHrs = parseFloat(data.Time_Paint_Setup || 20) / 60;
        const pRunHrs = (totalSqFt * parseFloat(data.Time_Paint_SqFt || 5)) / 60;
        costPaintLabor = (pSetupHrs + pRunHrs) * ratePaint;
    }

    const hwCost = inputs.standoffs ? (inputs.standoffQty * parseFloat(data.Cost_Standoff || 2.54) * inputs.qty) : 0;

    const subTotal = costSubstrate + costInk + costVinLam + costPrepressPrint + costMachSetupPrint + costPrintLabor + costPrintMach + costMountLabor + costPrepressCNC + costMachSetupCNC + costCutMach + costCutLabor + costPaintLabor + costPaintMat + hwCost;
    
    const riskFactor = parseFloat(data.Factor_Risk || 1.10); 
    const riskBuffer = subTotal * (riskFactor - 1);

    return {
        retail: {
            unitPrice: (retailPrint + routerFee + hwFee + paintFee) / inputs.qty,
            printTotal: retailPrint,
            routerFee: routerFee,
            paintTotal: paintFee,
            hwTotal: hwFee,
            setupFee: feeSetup,
            designFee: feeDesign,
            grandTotal: grandTotal,
            isMinApplied: grandTotalRaw < minOrder,
            baseRate: baseRate 
        },
        cost: {
            total: subTotal + riskBuffer,
            breakdown: {
                rawSubstrate: costSubstrate,
                rawInk: costInk,
                rawVinLam: costVinLam,
                costPrepressPrint: costPrepressPrint,
                costMachSetupPrint: costMachSetupPrint,
                costPrintLabor: costPrintLabor,
                costPrintMach: costPrintMach,
                costMountLabor: costMountLabor,
                costPrepressCNC: costPrepressCNC,
                costMachSetupCNC: costMachSetupCNC,
                costCutMach: costCutMach,
                costCutLabor: costCutLabor,
                costPaintLabor: costPaintLabor,
                costPaintMat: costPaintMat,
                costHardware: hwCost,
                riskCost: riskBuffer,
                wastePct: (wastePct - 1) * 100,
                riskPct: (riskFactor - 1) * 100
            }
        }
    };
}

// ==========================================
// SIMULATOR CONFIGURATION SCHEMA
// ==========================================
window.ACRYLIC_CONFIG = {
    tab: 'PROD_Acrylic_Signs',
    engine: calculateAcrylic,
    controls: [
      { id: 'w', label: 'Width (in)', type: 'number', def: 24 },
      { id: 'h', label: 'Height (in)', type: 'number', def: 18 },
      { id: 'thickness', label: 'Thickness', type: 'select', opts: [{v:'0.25', t:'1/4"'}, {v:'0.5', t:'1/2"'}, {v:'0.75', t:'3/4"'}, {v:'1', t:'1"'}] },
      { id: 'color', label: 'Acrylic Color', type: 'select', opts: [{v:'Clear', t:'Clear'}, {v:'White', t:'White'}, {v:'Black', t:'Black'}] },
      { id: 'surface', label: 'Surface', type: 'select', opts: [{v:'1', t:'1st Surface (Front)'}, {v:'2', t:'2nd Surface (Back)'}] },
      { id: 'method', label: 'Graphics Method', type: 'select', opts: [{v:'direct_color', t:'Direct (Color)'}, {v:'direct_white', t:'Direct (+Wht Flood)'}, {v:'direct_3layer', t:'Direct (3-Layer)'}, {v:'direct_5layer', t:'Direct (5-Layer)'}, {v:'vinyl_print_opq', t:'Print Vinyl (Opq)'}, {v:'vinyl_print_trn', t:'Print Vinyl (Trans)'}, {v:'vinyl_cut_opq', t:'Cut Vinyl (Opq)'}, {v:'vinyl_cut_trn', t:'Cut Vinyl (Trans)'}] },
      { id: 'shape', label: 'Cut Method', type: 'select', opts: [{v:'Rectangle', t:'Square / Saw'}, {v:'Easy', t:'CNC Simple'}, {v:'Complex', t:'CNC Complex'}] },
      { id: 'paint', label: 'Paint Background', type: 'toggle', def: false },
      { id: 'standoffs', label: 'Add Standoffs', type: 'toggle', def: false },
      { id: 'standoffQty', label: 'Standoff Qty', type: 'number', def: 4 },
      { id: 'files', label: 'Files', type: 'number', def: 1 },
      { id: 'setupPerFile', label: 'Setup / File', type: 'toggle', def: false }
    ],
    dynamicUI: function(inputs) {
        if (inputs.thickness !== '0.25' && inputs.color === 'Black') inputs.color = 'White';
        if (inputs.color !== 'Clear') inputs.surface = '1';
        return inputs;
    },
    retails: [
      { heading: '1/4" Area Curves', key: 'ACR_14_T1_Max', label: 'T1 Max SqFt', tooltip: 'FORMAT: 10' },
      { key: 'ACR_14_T1_Rate', label: 'T1 ($/sf)', tooltip: 'FORMAT: 40' },
      { key: 'ACR_14_T2_Max', label: 'T2 Max SqFt' },
      { key: 'ACR_14_T2_Rate', label: 'T2 ($/sf)' },
      { key: 'ACR_14_T3_Rate', label: 'T3 (>20sf)' },
      { heading: 'Multipliers & Adders', key: 'Retail_Adder_2ndSurf', label: 'Wht Ink Add ($/sf)' },
      { key: 'Retail_Adder_Blockout', label: 'Day/Night Add ($/sf)' },
      { key: 'Retail_Adder_Paint_SqFt', label: 'Paint Add ($/sf)' },
      { key: 'Retail_Fee_Paint_Setup', label: 'Paint Setup Fee' },
      { key: 'Retail_Fee_Router_Easy', label: 'CNC Easy Fee' },
      { key: 'Retail_Fee_Router_Hard', label: 'CNC Hard Fee' },
      { key: 'Retail_Price_Standoff', label: 'Standoff ($/ea)' }
    ],
    costs: [
      { heading: 'Acrylic Materials', key: 'Cost_Stock_14_4x8_C', label: '1/4" Clear ($)' },
      { key: 'Cost_Stock_14_4x8_W', label: '1/4" White ($)' },
      { key: 'Cost_Stock_12_4x8_C', label: '1/2" Clear ($)' },
      { key: 'Cost_Stock_12_4x8_W', label: '1/2" White ($)' },
      { key: 'Cost_Stock_34_4x8_C', label: '3/4" Clear ($)' },
      { key: 'Cost_Stock_34_4x8_W', label: '3/4" White ($)' },
      { key: 'Cost_Stock_1IN_4x8_C', label: '1" Clear ($)' },
      { key: 'Cost_Stock_1IN_4x8_W', label: '1" White ($)' },
      { heading: 'Vinyl/Ink Materials', key: 'Cost_Vin_Print', label: 'Print Vinyl ($/sf)' },
      { key: 'Cost_Lam_SqFt', label: 'Lam Film ($/sf)' },
      { key: 'Cost_Vin_Cut_Opq', label: 'Cut Vin Opq ($/sf)' },
      { key: 'Cost_Vin_Cut_Trn', label: 'Cut Vin Trans ($/sf)' },
      { key: 'Cost_Transfer_Tape', label: 'App Tape ($/sf)' },
      { heading: 'Machine Speeds', key: 'Speed_Print_1st', label: '1-Layer FB (LF/hr)' },
      { key: 'Speed_Print_White', label: '2-Layer FB (LF/hr)' },
      { key: 'Speed_Print_3Layer', label: '3-Layer FB (LF/hr)' },
      { key: 'Speed_Print_Roll', label: 'Roll Print (SF/hr)' },
      { key: 'Speed_Lam_Roll', label: 'Laminator (SF/hr)' },
      { key: 'Speed_Cut_Graphtec', label: 'Plotter (SF/hr)' },
      { heading: 'Labor Rates ($/Hr)', key: 'Rate_Operator', label: 'Print Op' },
      { key: 'Rate_Shop_Labor', label: 'Shop Labor' },
      { key: 'Rate_CNC_Labor', label: 'CNC Op' },
      { key: 'Rate_Paint_Labor', label: 'Paint Tech' },
      { heading: 'Labor & Setup (Mins)', key: 'Time_Prepress_Print', label: 'Print Prepress' },
      { key: 'Time_Setup_Printer', label: 'Machine Load' },
      { key: 'Time_Weed_Simple', label: 'Weed Simple (/SF)' },
      { key: 'Time_Weed_Complex', label: 'Weed Complex (/SF)' },
      { key: 'Time_Mask_SqFt', label: 'Masking (/SF)' },
      { key: 'Time_Mount_4x8', label: 'Mounting (/4x8)' },
      { key: 'Time_Prepress_CNC', label: 'CNC Prepress' },
      { key: 'Time_Setup_CNC', label: 'CNC Setup' },
      { heading: 'Overhead & Factors', key: 'Rate_Machine_Flatbed', label: 'Flatbed ($/Hr)' },
      { key: 'Rate_Machine_Print', label: 'Roll Prt ($/Hr)' },
      { key: 'Rate_Machine_Cut', label: 'Plotter ($/Hr)' },
      { key: 'Labor_Attendance_Ratio', label: 'Operator Attn (%)' },
      { key: 'Waste_Factor', label: 'Waste Buffer' }
    ],
    
    renderReceipt: function(data, fmt) {
      let retailHTML = `
        <div>
          <h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
          <div class="space-y-1 text-xs text-gray-700">
            <div class="flex justify-between" title="Based on Area Curves + Layer Adders."><span class="cursor-help border-b border-dotted border-gray-400">Acrylic Base w/ Graphics (Calculated @ ${fmt(data.retail.baseRate)}/sf):</span> <span>${fmt(data.retail.printTotal)}</span></div>
            ${data.retail.paintTotal > 0 ? `<div class="flex justify-between text-indigo-700"><span>Paint Setup & Area Rate:</span> <span>${fmt(data.retail.paintTotal)}</span></div>` : ''}
            ${data.retail.routerFee > 0 ? `<div class="flex justify-between text-orange-700"><span>CNC Routing Fee:</span> <span>${fmt(data.retail.routerFee)}</span></div>` : ''}
            ${data.retail.hwTotal > 0 ? `<div class="flex justify-between"><span>Hardware (Standoffs):</span> <span>${fmt(data.retail.hwTotal)}</span></div>` : ''}
            <div class="flex justify-between"><span>File Setup Fee:</span> <span>${fmt(data.retail.setupFee || 0)}</span></div>
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
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Acrylic Substrate:</span> <span>${fmt(b.rawSubstrate)}</span></div>
            ${b.rawVinLam > 0 ? `<div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Vinyl / Tape / Lam Media:</span> <span>${fmt(b.rawVinLam)}</span></div>` : ''}
            ${b.rawInk > 0 ? `<div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Printer Ink:</span> <span>${fmt(b.rawInk)}</span></div>` : ''}
            
            <div class="flex justify-between mt-1"><span class="border-b border-dotted border-gray-400">Graphics Prepress (RIP/Pathing):</span> <span>${fmt(b.costPrepressPrint)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Graphics Machine Load/Calibrate:</span> <span>${fmt(b.costMachSetupPrint)}</span></div>
            <div class="flex justify-between"><span class="border-b border-dotted border-gray-400">Graphics Run (Machine):</span> <span>${fmt(b.costPrintMach)}</span></div>
            <div class="flex justify-between"><span class="cursor-help border-b border-dotted border-gray-400" title="Factored at Operator Attention Ratio if Printer, or full manual time if Plotter/Weeding.">Graphics Run & Weed (Labor):</span> <span>${fmt(b.costPrintLabor)}</span></div>
            ${b.costMountLabor > 0 ? `<div class="flex justify-between text-indigo-800"><span class="border-b border-dotted border-indigo-300">Vinyl Mounting (Labor):</span> <span>${fmt(b.costMountLabor)}</span></div>` : ''}
            
            ${b.costPrepressCNC > 0 ? `<div class="flex justify-between text-orange-800 mt-1"><span class="border-b border-dotted border-orange-300">CNC Prepress (Toolpaths):</span> <span>${fmt(b.costPrepressCNC)}</span></div>` : ''}
            ${b.costMachSetupCNC > 0 ? `<div class="flex justify-between text-orange-800"><span class="border-b border-dotted border-orange-300">CNC Setup (Mount/Zero):</span> <span>${fmt(b.costMachSetupCNC)}</span></div>` : ''}
            ${b.costCutMach > 0 ? `<div class="flex justify-between text-orange-800"><span class="border-b border-dotted border-orange-300">Cutting Run (Machine):</span> <span>${fmt(b.costCutMach)}</span></div>` : ''}
            <div class="flex justify-between text-orange-800"><span class="border-b border-dotted border-orange-300">Cutting Run (Labor):</span> <span>${fmt(b.costCutLabor)}</span></div>
            
            ${b.costPaintLabor > 0 ? `<div class="flex justify-between text-purple-800 mt-1"><span class="border-b border-dotted border-purple-300">Paint Booth (Labor & Machine):</span> <span>${fmt(b.costPaintLabor)}</span></div>` : ''}
            ${b.costPaintMat > 0 ? `<div class="flex justify-between text-purple-800"><span class="border-b border-dotted border-purple-300">Automotive Paint (Material):</span> <span>${fmt(b.costPaintMat)}</span></div>` : ''}
            
            <div class="border-t border-gray-200 mt-2 pt-1"></div>
            <h4 class="text-[9px] font-bold text-gray-500 uppercase mb-1">Additives & Risk</h4>
            <div class="flex justify-between text-red-600"><span class="border-b border-dotted border-red-400">Material Waste (${b.wastePct ? b.wastePct.toFixed(0) : 25}%):</span> <span>(Calculated Above)</span></div>
            <div class="flex justify-between text-orange-500 opacity-80"><span class="border-b border-dotted border-orange-300">Suggested Risk Buffer (${b.riskPct ? b.riskPct.toFixed(0) : 10}%):</span> <span>(+ ${fmt(b.riskCost)})</span></div>
        `;
      }
      costHTML += `<div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div></div></div>`;
      return retailHTML + costHTML;
    }
};
