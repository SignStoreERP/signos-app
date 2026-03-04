/**
 * PURE PHYSICS ENGINE: ADA Signs (v4.0)
 * Updated to map Macro Sign Types to granular manufacturing paths & point to PROD_ADA_Signs.
 */
function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    // --- 1. RETAIL ENGINE (MACRO PRICING) ---
    const threshold = parseFloat(data.ADA_SqIn_Break || 36);
    const isLarge = sqin >= threshold;
    let baseRateSqIn = 0;
    
    if (inputs.signType === 'Standard') baseRateSqIn = isLarge ? parseFloat(data.ADA_TypeA_Large || 1.80) : parseFloat(data.ADA_TypeA_Small || 2.10);
    else if (inputs.signType === 'Layered_PVC') baseRateSqIn = isLarge ? parseFloat(data.ADA_TypeB1_Large || 1.95) : parseFloat(data.ADA_TypeB1_Small || 2.25);
    else if (inputs.signType === 'Layered_Acrylic') baseRateSqIn = isLarge ? parseFloat(data.ADA_TypeB2_Large || 2.20) : parseFloat(data.ADA_TypeB2_Small || 2.50);
    else baseRateSqIn = 1.80;

    const retailPrint = (sqin * baseRateSqIn) * inputs.qty;
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(retailPrint + parseFloat(data.Retail_Fee_Setup || 15), minOrder);

    // --- 2. COST ENGINE (PHYSICS REVERSE-MAPPING) ---
    const bd = [];
    const L = (label, total, formula) => { if(total > 0) bd.push({label, total, formula}); return total; };

    // Reverse-map physical materials based on selected Type
    const coreThick = inputs.signType === 'Standard' ? '1/8' : '1/16';
    const backer = inputs.signType === 'Standard' ? 'None' : (inputs.signType === 'Layered_PVC' ? 'Black PVC' : 'Clear Acrylic');

    const sheetSqIn = 24 * 48;
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    const costBackground = coreThick === '1/8' ? parseFloat(data.Cost_Stock_18_ADA || 117)/sheetSqIn : parseFloat(data.Cost_Stock_116_ADA || 75)/sheetSqIn;
    L(`Core Material (${coreThick}")`, (totalSqin * costBackground) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${costBackground.toFixed(4)}/sqin) * ${wastePct} Waste`);
    
    const costApplique = parseFloat(data.Cost_Stock_132_Applique || 65)/sheetSqIn;
    L(`Tactile Applique (1/32")`, (totalSqin * costApplique) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${costApplique.toFixed(4)}/sqin) * Waste`);

    const costTape = parseFloat(data.Cost_ADA_Tape || 0.30) / 144;
    L(`3M Double Sided Tape`, (totalSqin * costTape) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${costTape.toFixed(4)}/sqin) * Waste`);

    const costBead = parseFloat(data.Cost_Raster_Bead || 0.05);
    L(`Raster Braille Beads`, (inputs.qty * 10 * costBead) * wastePct, `${inputs.qty} Signs * 10 Beads * $${costBead.toFixed(2)}`);

    if (backer !== 'None') {
        const pvcWhiteCost = parseFloat(data.Cost_Stock_3mm_4x8 || 29.09) / 4608; 
        let backerSqInCost = backer === 'Clear Acrylic' ? (parseFloat(data.Cost_Stock_14_4x8_C || 120) / 4608) : pvcWhiteCost;
        if (backer === 'Black PVC') backerSqInCost *= 1.25; 
        L(`Rigid Backer (${backer})`, (totalSqin * backerSqInCost) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${backerSqInCost.toFixed(4)}/sqin) * Waste`);
    }

    const opRate = parseFloat(data.Rate_Operator || 25);
    const shopRate = parseFloat(data.Rate_Shop_Labor || 20);
    const engraveRate = parseFloat(data.Rate_Machine_Engraver || 15);
    const cncRate = parseFloat(data.Rate_Machine_CNC || 10);

    L(`Engraver Prepress`, (10 / 60) * opRate, `10 Mins * $${opRate}/hr`);
    L(`Engraver Setup`, (parseFloat(data.Time_Engraver_Load_Per_Item || 2) * inputs.qty / 60) * opRate, `${inputs.qty} Signs * 2 Mins * $${opRate}/hr`);
    
    const runMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.5);
    L(`Engraver Run Time`, (runMins / 60) * engraveRate, `${runMins.toFixed(1)} Mins * $${engraveRate}/hr`);
    L(`Operator Attendance`, (runMins / 60) * opRate * parseFloat(data.Labor_Attendance_Ratio || 0.20), `${runMins.toFixed(1)} Mins * 20% Attn`);
    L(`Material Prep & Weeding`, ((totalSqin * 0.1) / 60) * shopRate, `0.1 Mins/sqin * $${shopRate}/hr`);

    if (backer !== 'None') {
        L(`CNC Prepress`, (15 / 60) * opRate, `15 Mins * $${opRate}/hr`);
        L(`CNC Setup`, (10 / 60) * opRate, `10 Mins * $${opRate}/hr`);
        const cncMins = totalSqin * parseFloat(data.Time_CNC_Easy_SqFt || 1) / 144;
        L(`CNC Run Time`, (cncMins / 60) * cncRate, `${cncMins.toFixed(2)} Mins * $${cncRate}/hr`);
    }

    let hardCostRaw = bd.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: bd },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.ADA_CONFIG = {
    tab: 'PROD_ADA_Signs',
    engine: calculateADA,
    controls: [
        { id: 'signType', label: 'ADA Sign Type', type: 'select', opts: [{v:'Standard', t:'Standard (1/8" Core)'}, {v:'Layered_PVC', t:'Layered (1/16" on PVC)'}, {v:'Layered_Acrylic', t:'Layered (1/16" on Acrylic)'}] }
    ],
    retails: [ 
        { key: 'ADA_TypeA_Small', label: 'Standard <36"' }, { key: 'ADA_TypeA_Large', label: 'Standard >=36"' },
        { key: 'ADA_TypeB1_Large', label: 'Layered PVC >=36"' }, { key: 'ADA_TypeB2_Large', label: 'Layered Acr >=36"' } 
    ],
    costs: [ { key: 'Cost_Stock_116_ADA', label: '1/16" Core ($/Sht)' }, { key: 'Cost_Stock_132_Applique', label: '1/32" Tactile' }, { key: 'Time_Engrave_SqIn', label: 'Engrave (Min/SqIn)' } ]
};
