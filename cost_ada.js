/**
 * PURE PHYSICS ENGINE: ADA Signs (v4.7)
 * Interactive String-Matcher Ledger. Custom Layer-Builder and Assembly Labor physics.
 */
function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    // HOVER ENGINE & TOOLTIP WRAPPERS
    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    const V = (k) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    const C = (k, val) => {
        let desc = window.ADA_CONFIG.constants.find(x => x.key === k)?.desc || "";
        return `<span class="hover-var text-emerald-600 border-b border-dotted border-emerald-400 cursor-help transition-all font-bold" data-var="${k}" title="${desc}">${val}</span>`;
    };

    // --- 1. RETAIL ENGINE (A LA CARTE LAYER BUILDUP) ---
    const ret = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let baseRateKey = inputs.coreThick === '1/8' ? 'Retail_Price_Ultra_18' : 'Retail_Price_Mattes_116';
    let baseRateSqIn = inputs.coreThick === '1/8' ? parseFloat(data.Retail_Price_Ultra_18 || 0.80) : parseFloat(data.Retail_Price_Mattes_116 || 0.60);
    R(`Base Core Layer (${inputs.coreThick}")`, (sqin * baseRateSqIn) * inputs.qty, `Qty * SqIn * ${V(baseRateKey)}`);

    if (inputs.hasTactile) {
        R(`Tactile Applique Layer`, (sqin * parseFloat(data.Retail_Adder_Tactile || 0.60)) * inputs.qty, `Qty * SqIn * ${V('Retail_Adder_Tactile')}`);
    }

    if (inputs.backer !== 'None') {
        let backerRetKey = inputs.backer === 'Clear Acrylic' ? 'Retail_Adder_Acr_Backer' : 'Retail_Adder_PVC_Backer';
        R(`Rigid Backer (${inputs.backer})`, (sqin * parseFloat(data[backerRetKey] || 0.40)) * inputs.qty, `Qty * SqIn * ${V(backerRetKey)}`);
    }

    let brailleFee = 0;
    if (inputs.hasBraille && inputs.brailleLines > 0) {
        brailleFee = inputs.brailleLines * parseFloat(data.Retail_Adder_Braille_Line || 10.00);
        R(`Raster Braille (Grade 2)`, brailleFee * inputs.qty, `Qty * Braille Lines * ${V('Retail_Adder_Braille_Line')}`);
    }

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    const isMinApplied = grandTotalRaw < minOrder;

    // --- 2. COST ENGINE ---
    const cst = [];
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    const sheetSqIn = 24 * 48; 
    const wastePct = parseFloat(data.Waste_Factor || 1.15);

    // Substrate Core
    let coreKey = inputs.coreThick === '1/8' ? 'Cost_Stock_18_ADA' : 'Cost_Stock_116_ADA';
    const costBackground = inputs.coreThick === '1/8' ? parseFloat(data.Cost_Stock_18_ADA || 70)/sheetSqIn : parseFloat(data.Cost_Stock_116_ADA || 50)/sheetSqIn;
    L(`ADA Core (${inputs.coreThick}")`, (totalSqin * costBackground) * wastePct, `(Total SqIn * ${V(coreKey)} / ${C('C_1152', '1152')}) * ${V('Waste_Factor')}`);

    // Tactile Layer
    if (inputs.hasTactile) {
        const costApplique = parseFloat(data.Cost_Stock_132_Applique || 55)/sheetSqIn;
        L(`Tactile Applique (1/32")`, (totalSqin * costApplique) * wastePct, `(Total SqIn * ${V('Cost_Stock_132_Applique')} / ${C('C_1152', '1152')}) * ${V('Waste_Factor')}`);
    }

    // Rigid Backer Layer
    if (inputs.backer !== 'None') {
        let backerCost = 0;
        let backerKey = '';
        if (inputs.backer === 'Clear Acrylic') {
            backerCost = parseFloat(data.Cost_Stock_14_4x8_C || 120.55) / 4608;
            backerKey = 'Cost_Stock_14_4x8_C';
        } else if (inputs.backer === 'White PVC') {
            backerCost = parseFloat(data.Cost_Stock_3mm_4x8_WW || 29.09) / 4608;
            backerKey = 'Cost_Stock_3mm_4x8_WW';
        } else {
            backerCost = parseFloat(data.Cost_Stock_3mm_4x8_BK || 32.53) / 4608;
            backerKey = 'Cost_Stock_3mm_4x8_BK';
        }
        L(`Rigid Backer Material`, (totalSqin * backerCost) * wastePct, `(Total SqIn * ${V(backerKey)} / ${C('C_4608', '4608')}) * ${V('Waste_Factor')}`);
    }

    // Raster Braille Beads
    if (inputs.hasBraille) {
        const costBead = parseFloat(data.Cost_Raster_Bead || 0.01);
        const totalBeads = inputs.qty * inputs.brailleLines * 10; 
        L(`Raster Braille Beads`, totalBeads * costBead * wastePct, `Total Beads * ${V('Cost_Raster_Bead')} * ${V('Waste_Factor')}`);
    }

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const shopRate = parseFloat(data.Rate_Shop_Labor || 20);
    
    // LAYER ASSEMBLY & TAPE LOGIC
    let tapeLayers = 0;
    if (inputs.hasTactile) tapeLayers++;
    if (inputs.backer !== 'None') tapeLayers++;
    if (inputs.mounting === 'Foam Tape') tapeLayers++; // Adds tape cost and 2 mins labor for applying the mount

    if (tapeLayers > 0) {
        const costTape = parseFloat(data.Cost_ADA_Tape || 0.30) / 144;
        L(`3M Tape (${tapeLayers}x Layers)`, (totalSqin * costTape * tapeLayers) * wastePct, `(Total SqIn * ${V('Cost_ADA_Tape')} / ${C('C_144', '144')} * ${tapeLayers} Lyr) * ${V('Waste_Factor')}`);
        
        const asmMins = inputs.qty * tapeLayers * 2; 
        L(`Layer Assembly Labor`, (asmMins / 60) * shopRate, `Qty * ${tapeLayers} Lyr * ${C('C_2', '2 Mins')} * ${V('Rate_Shop_Labor')}`);
    }

    // Engraving & Routing Logic
    const engraveRate = parseFloat(data.Rate_Machine_Engraver || 10);
    L(`Engraver Prepress`, (10 / 60) * rateOp, `10 Mins * ${V('Rate_Operator')}`);
    L(`Engraver Setup`, (parseFloat(data.Time_Engraver_Load_Per_Item || 1) * inputs.qty / 60) * rateOp, `Qty * ${V('Time_Engraver_Load_Per_Item')} * ${V('Rate_Operator')}`);
    
    const runMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.25);
    L(`Engraver Run Time`, (runMins / 60) * engraveRate, `Total SqIn * ${V('Time_Engrave_SqIn')} * ${V('Rate_Machine_Engraver')}`);
    L(`Operator Attendance`, (runMins / 60) * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `Engraver Run Time * ${V('Labor_Attendance_Ratio')} * ${V('Rate_Operator')}`);

    if (inputs.hasBraille) {
        L(`Braille Bead Insertion`, ((inputs.qty * inputs.brailleLines * 10) * 0.05 / 60) * shopRate, `Total Beads * ${C('C_005', '0.05 Mins')} * ${V('Rate_Shop_Labor')}`);
    }

    if (inputs.backer !== 'None') {
        const cncRate = parseFloat(data.Rate_Machine_CNC || 10);
        L(`CNC Prepress & Setup`, (25 / 60) * rateOp, `25 Mins * ${V('Rate_Operator')}`);
        
        const cncMins = totalSqin * parseFloat(data.Time_CNC_Easy_SqFt || 1) / 144;
        L(`CNC Run Time`, (cncMins / 60) * cncRate, `(Total SqIn / ${C('C_144', '144')}) * ${V('Time_CNC_Easy_SqFt')} * ${V('Rate_Machine_CNC')}`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret, isMinApplied: isMinApplied },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.ADA_CONFIG = {
    tab: 'PROD_ADA_Signs', engine: calculateADA,
    controls: [
        { id: 'coreThick', label: 'Core Thickness', type: 'select', opts: [{v:'1/16', t:'1/16"'}, {v:'1/8', t:'1/8"'}] },
        { id: 'backer', label: 'Rigid Backer', type: 'select', opts: [{v:'None', t:'None'}, {v:'Black PVC', t:'3mm Blk PVC'}, {v:'White PVC', t:'3mm Wht PVC'}, {v:'Clear Acrylic', t:'1/4" Clear Acr'}] },
        { id: 'hasTactile', label: 'Tactile Copy', type: 'toggle', def: true },
        { id: 'hasBraille', label: 'Raster Braille', type: 'toggle', def: true },
        { id: 'brailleLines', label: 'Braille Lines', type: 'number', def: 1 }
    ],
    retails: [ 
        { key: 'Retail_Price_Ultra_18', label: '1/8" Base ($/Sqin)' },
        { key: 'Retail_Price_Mattes_116', label: '1/16" Base ($/Sqin)' },
        { key: 'Retail_Adder_Tactile', label: 'Tactile Add ($/Sqin)' },
        { key: 'Retail_Adder_PVC_Backer', label: 'PVC Backer ($/Sqin)' },
        { key: 'Retail_Adder_Acr_Backer', label: 'Acr Backer ($/Sqin)' },
        { key: 'Retail_Adder_Braille_Line', label: 'Braille Add ($/Line)' },
        { key: 'Retail_Min_Order', label: 'Shop Minimum ($)' }
    ],
    costs: [ 
        { key: 'Cost_Stock_116_ADA', label: '1/16" Core ($/Sht)' }, 
        { key: 'Cost_Stock_18_ADA', label: '1/8" Core ($/Sht)' },
        { key: 'Cost_Stock_132_Applique', label: '1/32" Tactile ($/Sht)' },
        { key: 'Cost_Stock_3mm_4x8_BK', label: '3mm Blk PVC ($/Sht)' },
        { key: 'Cost_Stock_3mm_4x8_WW', label: '3mm Wht PVC ($/Sht)' },
        { key: 'Cost_Stock_14_4x8_C', label: '1/4" Clear ($/Sht)' },
        { key: 'Cost_ADA_Tape', label: '3M Tape ($/SqFt)' },
        { key: 'Cost_Raster_Bead', label: 'Raster Bead ($/Ea)' },
        { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Machine_Engraver', label: 'Engraver Mach ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'CNC Mach ($/Hr)' },
        { key: 'Time_Engraver_Load_Per_Item', label: 'Load/Unload (Mins)' },
        { key: 'Time_Engrave_SqIn', label: 'Engrave Spd (Min/Sqin)' },
        { key: 'Time_CNC_Easy_SqFt', label: 'CNC Spd (Min/SqFt)' },
        { key: 'Waste_Factor', label: 'Waste Buffer (1.x)' },
        { key: 'Factor_Risk', label: 'Risk Buffer (1.x)' },
        { key: 'Labor_Attendance_Ratio', label: 'Attn Ratio (0-1)' }
    ],
    constants: [
        { key: 'C_1152', val: '1152', label: '1152 (ADA Sheet)', desc: 'SqIn yield of a 24" x 48" half-sheet (Rowmark ADA Core/Tactile).' },
        { key: 'C_4608', val: '4608', label: '4608 (Full Sheet)', desc: 'SqIn yield of a full 4\' x 8\' sheet (PVC/Acrylic Backers).' },
        { key: 'C_144', val: '144', label: '144 (SqFt Base)', desc: 'SqIn per SqFt (Used for Tape / CNC conversions).' },
        { key: 'C_005', val: '0.05 Mins', label: '0.05 Mins', desc: 'Estimated shop labor time to manually insert a single Raster Braille Bead.' },
        { key: 'C_2', val: '2 Mins', label: '2 Mins', desc: 'Estimated shop labor time to align, tape, and press a single material layer.' }
    ]
};
