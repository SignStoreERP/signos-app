/**
 * PURE PHYSICS ENGINE: ADA Signs (v1.5)
 * Full Bill of Materials and Admin Simulator Schema
 */

function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    // --- 1. RETAIL ENGINE (Identical to logic_ada.js for accurate margin testing) ---
    let baseRate = inputs.structure === '1/8' 
        ? parseFloat(data.Retail_Price_Base_Reverse || 0.80) 
        : parseFloat(data.Retail_Price_Base_Front || 0.60);

    let tactileRate = parseFloat(data.Retail_Adder_Tactile || 0.60);
    
    let backerRate = 0;
    if (inputs.backer.includes('PVC')) backerRate = parseFloat(data.Retail_Adder_PVC_Backer || 0.40);
    if (inputs.backer.includes('Acrylic')) backerRate = parseFloat(data.Retail_Adder_Acr_Backer || 0.60);

    let unitPrint = (baseRate + tactileRate + backerRate) * sqin;
    unitPrint += parseFloat(data.Retail_Adder_Braille_Line || 10.00);

    let retailTotal = unitPrint * inputs.qty;
    const minOrder = inputs.backer !== 'None' ? parseFloat(data.Retail_Min_Order_CNC || 75.00) : parseFloat(data.Retail_Min_Order_Etch || 50.00);
    const grandTotal = Math.max(retailTotal, minOrder);

    // --- 2. COST ENGINE (PHYSICS & BOM) ---
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const sheetArea2x4 = 1152; 
    const sheetArea4x8 = 4608; 

    let coreSheetCost = inputs.structure === '1/8' 
        ? parseFloat(data.Cost_Sub_ADA_Core_18 || 70.00)
        : parseFloat(data.Cost_Sub_ADA_Core_116 || 50.00);

    const costCore = (coreSheetCost / sheetArea2x4) * totalSqin * wastePct;
    const costTactile = (parseFloat(data.Cost_Sub_Tactile || 85.25) / sheetArea2x4) * totalSqin * wastePct;
    
    let costBacker = 0;
    if (inputs.backer.includes('PVC')) costBacker = (parseFloat(data.Cost_Sub_PVC || 33.00) / sheetArea4x8) * totalSqin * wastePct;
    if (inputs.backer.includes('Acrylic')) costBacker = (parseFloat(data.Cost_Sub_Acrylic || 99.00) / sheetArea4x8) * totalSqin * wastePct;

    let tapeLayers = 0;
    if (inputs.backer !== 'None') tapeLayers++; 
    if (inputs.mounting === 'Foam Tape') tapeLayers++;

    const tapeLF = (totalSqin / 12) * tapeLayers;
    const costTape = tapeLF * parseFloat(data.Cost_Hem_Tape || 0.08) * wastePct;
    const costBraille = inputs.qty * parseFloat(data.Cost_Braille_Line_Fallback || 1.00);
    
    const totalMats = costCore + costTactile + costBacker + costTape + costBraille;

    // Labor & Machining
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    const rateCNC = parseFloat(data.Rate_CNC_Labor || 25);
    const rateMachEngrave = parseFloat(data.Rate_Machine_Engraver || 10);
    const rateMachCNC = parseFloat(data.Rate_Machine_CNC || 10);

    const engraveMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.31);
    const engraveSetupMins = parseFloat(data.Time_Preflight_Job || 15) + (inputs.qty * parseFloat(data.Time_Engraver_Load_Per_Item || 1));
    const costEngraveMach = (engraveMins / 60) * rateMachEngrave;
    const costEngraveOp = ((engraveMins + engraveSetupMins) / 60) * rateOp;

    const weedMins = totalSqin * parseFloat(data.Time_Weed_Tactile_SqIn || 0.10);
    const assemblyMins = tapeLayers > 0 ? (totalSqin * tapeLayers * parseFloat(data.Time_Tape_Layer_SqIn || 0.05)) : 0;
    const costAssembly = ((weedMins + assemblyMins) / 60) * rateShop;

    let costCNCMach = 0; let costCNCOp = 0;
    if (inputs.backer !== 'None') {
        const cncMins = totalSqin * parseFloat(data.Time_CNC_Run_SqIn || 0.02);
        const cncSetup = parseFloat(data.Time_Preflight_CNC || 15);
        costCNCMach = (cncMins / 60) * rateMachCNC;
        costCNCOp = ((cncMins + cncSetup) / 60) * rateCNC;
    }

    const subTotal = totalMats + costEngraveMach + costEngraveOp + costAssembly + costCNCMach + costCNCOp;
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const riskBuffer = subTotal * (riskFactor - 1);
    const totalCost = subTotal + riskBuffer;

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailTotal, grandTotal: grandTotal, isMinApplied: retailTotal < minOrder },
        cost: { total: totalCost, breakdown: { rawSubstrate: costCore + costTactile + costBacker, rawTape: costTape, rawBraille: costBraille, costEngrave: costEngraveMach + costEngraveOp, costAssembly: costAssembly, costCNC: costCNCMach + costCNCOp, riskCost: riskBuffer, wastePct: (wastePct - 1) * 100 } },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

// ==========================================
// ADMIN SIMULATOR CONFIGURATION SCHEMA
// ==========================================

window.ADA_CONFIG = {
    tab: 'PROD_ADA_Signs',
    engine: calculateADA,
    controls: [
        { id: 'w', label: 'Width (in)', type: 'number', def: 8 },
        { id: 'h', label: 'Height (in)', type: 'number', def: 8 },
        { id: 'structure', label: 'Structure', type: 'select', opts: [{v:'1/8', t:'1/8" Core'}, {v:'1/16', t:'1/16" + Backer'}] },
        { id: 'backer', label: 'Rigid Backer', type: 'select', opts: [{v:'None', t:'None'}, {v:'White PVC', t:'White PVC'}, {v:'Clear Acrylic', t:'Clear Acrylic'}] },
        { id: 'mounting', label: 'Mounting', type: 'select', opts: [{v:'Foam Tape', t:'Foam Tape'}, {v:'None', t:'None'}] }
    ],
    retails: [
        { heading: 'Layer Pricing ($/SqIn)', key: 'Retail_Price_Base_Front', label: 'Front Core ($)' },
        { key: 'Retail_Price_Base_Reverse', label: 'Reverse Core ($)' },
        { key: 'Retail_Adder_Tactile', label: 'Tactile Add ($)' },
        { key: 'Retail_Adder_PVC_Backer', label: 'PVC Backer Add ($)' },
        { key: 'Retail_Adder_Acr_Backer', label: 'Acrylic Backer Add ($)' },
        { key: 'Retail_Adder_Braille_Line', label: 'Braille Per Line ($)' },
        { heading: 'Process Minimums', key: 'Retail_Min_Order_Etch', label: 'Engraver Min ($)' },
        { key: 'Retail_Min_Order_CNC', label: 'CNC Min ($)' }
    ],
    costs: [
        { heading: 'Material Costs', key: 'Cost_Sub_ADA_Core_18', label: '1/8" Core ($/Sht)' },
        { key: 'Cost_Sub_ADA_Core_116', label: '1/16" Core ($/Sht)' },
        { key: 'Cost_Sub_Tactile', label: 'Tactile App ($/Sht)' },
        { key: 'Cost_Sub_PVC', label: 'PVC (4x8) ($)' },
        { key: 'Cost_Sub_Acrylic', label: 'Acrylic (4x8) ($)' },
        { key: 'Cost_Hem_Tape', label: 'Adhesive Tape ($/LF)' },
        { key: 'Cost_Braille_Line_Fallback', label: 'Braille Cost/Line ($)' },
        { heading: 'Speeds & Times', key: 'Time_Engrave_SqIn', label: 'Engrave Run (Mins/sqin)' },
        { key: 'Time_Weed_Tactile_SqIn', label: 'Weed Tactile (Mins/sqin)' },
        { key: 'Time_Tape_Layer_SqIn', label: 'Tape Assembly (Mins/sqin)' },
        { key: 'Time_CNC_Run_SqIn', label: 'CNC Backer (Mins/sqin)' },
        { heading: 'Overhead', key: 'Rate_Operator', label: 'Machine Op ($/Hr)' },
        { key: 'Rate_Shop_Labor', label: 'Shop Hands ($/Hr)' },
        { key: 'Rate_CNC_Labor', label: 'CNC Op ($/Hr)' },
        { key: 'Waste_Factor', label: 'Waste Buffer (1.x)' }
    ],
    renderReceipt: function(data, fmt) {
        let retailHTML = `<div><h4 class="text-[10px] font-bold text-blue-800 uppercase mb-2 border-b border-blue-200 pb-1">Market Engine (Retail)</h4>
        <div class="space-y-1 text-xs text-gray-700">
        <div class="flex justify-between"><span>Base Sign + Adders:</span> <span>${fmt(data.retail.printTotal)}</span></div>
        <div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Retail:</span> <span>${fmt(data.retail.grandTotal)}</span></div>
        </div></div>`;
        
        let costHTML = `<div class="mt-6"><h4 class="text-[10px] font-bold text-red-800 uppercase mb-2 border-b border-red-200 pb-1">Physics Engine (Cost)</h4>
        <div class="space-y-1 text-xs text-gray-700">`;
        if (data.cost.breakdown) {
            const b = data.cost.breakdown;
            costHTML += `<div class="flex justify-between"><span>Raw Substrates:</span> <span>${fmt(b.rawSubstrate)}</span></div>
            <div class="flex justify-between"><span>Tape & Braille Beads:</span> <span>${fmt(b.rawTape + b.rawBraille)}</span></div>
            <div class="flex justify-between mt-1"><span class="border-b border-dotted border-gray-400">Engraver Run & Setup:</span> <span>${fmt(b.costEngrave)}</span></div>
            <div class="flex justify-between text-blue-700"><span class="border-b border-dotted border-blue-300">Weed & Assembly Labor:</span> <span>${fmt(b.costAssembly)}</span></div>
            ${b.costCNC > 0 ? `<div class="flex justify-between text-orange-700 mt-1"><span class="border-b border-dotted border-orange-300">CNC Backer Routing:</span> <span>${fmt(b.costCNC)}</span></div>` : ''}
            <div class="border-t border-gray-200 mt-2 pt-1"></div>
            <div class="flex justify-between text-red-600"><span>Material Waste (${b.wastePct ? b.wastePct.toFixed(0) : 15}%):</span> <span>(Calculated Above)</span></div>
            <div class="flex justify-between text-orange-500 opacity-80"><span>Suggested Risk Buffer:</span> <span>(+ ${fmt(b.riskCost)})</span></div>`;
        }
        costHTML += `<div class="flex justify-between font-black text-gray-900 border-t border-gray-300 pt-1 mt-1"><span>Total Hard Cost:</span> <span>${fmt(data.cost.total)}</span></div></div></div>`;
        return retailHTML + costHTML;
    }
};

