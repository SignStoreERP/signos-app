/**
 * PURE PHYSICS ENGINE: ADA Signs (v3.0)
 * Upgraded to Educational Math Ledger format. Granular Engraver vs CNC tracking.
 */
function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    // --- 1. RETAIL ENGINE ---
    let baseRateSqIn = inputs.coreThick === '1/8' ? parseFloat(data.Retail_Price_Ultra_18 || 0.85) : parseFloat(data.Retail_Price_Mattes_116 || 0.55);
    if (inputs.hasTactile) baseRateSqIn += parseFloat(data.Retail_Adder_Tactile || 0.15);

    let retailUnit = sqin * baseRateSqIn;
    if (inputs.backer === 'Black PVC' || inputs.backer === 'White PVC') retailUnit += (sqin * parseFloat(data.Retail_Adder_PVC_Backer || 0.15));
    else if (inputs.backer === 'Clear Acrylic') retailUnit += (sqin * parseFloat(data.Retail_Adder_Acr_Backer || 0.25));

    let brailleFee = 0;
    if (inputs.hasBraille && inputs.brailleLines > 0) {
        brailleFee = inputs.brailleLines * parseFloat(data.Retail_Adder_Braille_Line || 10.00);
        retailUnit += brailleFee;
    }

    const retailPrint = retailUnit * inputs.qty;
    const minOrder = parseFloat(data.Retail_Min_Order || 35);
    const grandTotal = Math.max(retailPrint, minOrder);

    // --- 2. COST ENGINE (MATH LEDGER) ---
    const bd = [];
    const L = (label, total, formula) => { if(total > 0) bd.push({label, total, formula}); return total; };

    const sheetSqIn = 24 * 48;
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    const costBackground = inputs.coreThick === '1/8' ? parseFloat(data.Cost_Stock_18_ADA || 117)/sheetSqIn : parseFloat(data.Cost_Stock_116_ADA || 75)/sheetSqIn;
    L(`Background Material (${inputs.coreThick}")`, (totalSqin * costBackground) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${costBackground.toFixed(4)}/sqin) * ${wastePct} Waste`);
    
    if (inputs.hasTactile) {
        const costApplique = parseFloat(data.Cost_Stock_132_Applique || 65)/sheetSqIn;
        L(`Tactile Material (1/32")`, (totalSqin * costApplique) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${costApplique.toFixed(4)}/sqin) * Waste`);
    }

    const costTape = parseFloat(data.Cost_ADA_Tape || 0.30) / 144;
    L(`3M Double Sided Tape`, (totalSqin * costTape) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${costTape.toFixed(4)}/sqin) * Waste`);

    if (inputs.hasBraille) {
        const costBead = parseFloat(data.Cost_Raster_Bead || 0.05);
        L(`Raster Braille Beads`, (inputs.qty * inputs.brailleLines * 10 * costBead) * wastePct, `${inputs.qty} Signs * ${inputs.brailleLines} Lines * 10 Beads * $${costBead.toFixed(2)}`);
    }

    if (inputs.backer !== 'None') {
        const pvcWhiteCost = parseFloat(data.Cost_Stock_3mm_4x8 || 29.09) / 4608; 
        let backerSqInCost = inputs.backer === 'Clear Acrylic' ? (parseFloat(data.Cost_Stock_14_4x8_C || 120) / 4608) : pvcWhiteCost;
        if (inputs.backer === 'Black PVC') backerSqInCost *= 1.25; // Apply a 25% premium cost to Black PVC vs White
        L(`Rigid Backer (${inputs.backer})`, (totalSqin * backerSqInCost) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${backerSqInCost.toFixed(4)}/sqin) * Waste`);
    }

    // Labor Mapping (Exploded)
    const opRate = parseFloat(data.Rate_Operator || 25);
    const shopRate = parseFloat(data.Rate_Shop_Labor || 20);
    const engraveRate = parseFloat(data.Rate_Machine_Engraver || 15);
    const cncRate = parseFloat(data.Rate_Machine_CNC || 10);

    // Engraver Track
    L(`Engraver Prepress`, (10 / 60) * opRate, `10 Mins * $${opRate}/hr`);
    L(`Engraver Setup`, (parseFloat(data.Time_Engraver_Load_Per_Item || 2) * inputs.qty / 60) * opRate, `${inputs.qty} Signs * 2 Mins * $${opRate}/hr`);
    
    const runMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.5);
    L(`Engraver Run Time`, (runMins / 60) * engraveRate, `${runMins.toFixed(1)} Mins * $${engraveRate}/hr`);
    L(`Operator Attendance`, (runMins / 60) * opRate * parseFloat(data.Labor_Attendance_Ratio || 0.20), `${runMins.toFixed(1)} Mins * 20% Attn`);
    
    if(inputs.hasTactile) L(`Material Prep & Weeding`, ((totalSqin * 0.1) / 60) * shopRate, `0.1 Mins/sqin * $${shopRate}/hr`);

    // CNC Track (Only if Backer exists)
    if (inputs.backer !== 'None') {
        L(`CNC Prepress`, (15 / 60) * opRate, `15 Mins * $${opRate}/hr`);
        L(`CNC Setup`, (10 / 60) * opRate, `10 Mins * $${opRate}/hr`);
        const cncMins = totalSqin * parseFloat(data.Time_CNC_Easy_SqFt || 1) / 144;
        L(`CNC Run Time`, (cncMins / 60) * cncRate, `${cncMins.toFixed(2)} Mins * $${cncRate}/hr`);
    }

    let hardCostRaw = bd.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, brailleFee: brailleFee, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: bd },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.ADA_CONFIG = {
    tab: 'PROD_Nameplates', engine: calculateADA,
    controls: [
        { id: 'coreThick', label: 'Background Material', type: 'select', opts: [{v:'1/16', t:'1/16" ADA Core'}, {v:'1/8', t:'1/8" ADA Core'}] },
        { id: 'backer', label: 'Rigid Backer', type: 'select', opts: [{v:'None', t:'None'}, {v:'Black PVC', t:'3mm Blk PVC'}, {v:'White PVC', t:'3mm Wht PVC'}, {v:'Clear Acrylic', t:'3/16" Clr Acr'}] },
        { id: 'hasTactile', label: 'Tactile', type: 'toggle', def: true },
        { id: 'hasBraille', label: 'Raster Braille', type: 'toggle', def: true },
        { id: 'brailleLines', label: 'Braille Lines', type: 'number', def: 1 }
    ],
    retails: [ { key: 'Retail_Price_Mattes_116', label: '1/16" Base' }, { key: 'Retail_Adder_Tactile', label: 'Tactile Adder' } ],
    costs: [ { key: 'Cost_Stock_116_ADA', label: '1/16" Core ($/Sht)' }, { key: 'Cost_Stock_132_Applique', label: '1/32" Tactile' }, { key: 'Time_Engrave_SqIn', label: 'Engrave (Min/SqIn)' } ]
};

