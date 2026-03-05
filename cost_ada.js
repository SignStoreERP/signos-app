/**
 * PURE PHYSICS ENGINE: ADA Signs (v4.0)
 * Dual Ledger format & Explicit Braille Beads Labor.
 */
function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    // --- 1. RETAIL ENGINE ---
    const ret = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, formula}); return total; };

    const threshold = parseFloat(data.ADA_SqIn_Break || 36);
    const isLarge = sqin >= threshold;
    let baseRateSqIn = 0;
    
    if (inputs.signType === 'Standard') baseRateSqIn = isLarge ? parseFloat(data.ADA_TypeA_Large || 1.80) : parseFloat(data.ADA_TypeA_Small || 2.10);
    else if (inputs.signType === 'Layered_PVC') baseRateSqIn = isLarge ? parseFloat(data.ADA_TypeB1_Large || 1.95) : parseFloat(data.ADA_TypeB1_Small || 2.25);
    else if (inputs.signType === 'Layered_Acrylic') baseRateSqIn = isLarge ? parseFloat(data.ADA_TypeB2_Large || 2.20) : parseFloat(data.ADA_TypeB2_Small || 2.50);
    else baseRateSqIn = 1.80;

    R(`ADA Sign Body`, (sqin * baseRateSqIn) * inputs.qty, `${inputs.qty} Signs @ ${sqin} sqin * $${baseRateSqIn}`);

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);


    // --- 2. COST ENGINE ---
    const cst = [];
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    const coreThick = inputs.signType === 'Standard' ? '1/8' : '1/16';
    const backer = inputs.signType === 'Standard' ? 'None' : (inputs.signType === 'Layered_PVC' ? 'Black PVC' : 'Clear Acrylic');
    const sheetSqIn = 24 * 48;
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    
    const costBackground = coreThick === '1/8' ? parseFloat(data.Cost_Stock_18_ADA || 117)/sheetSqIn : parseFloat(data.Cost_Stock_116_ADA || 75)/sheetSqIn;
    L(`Core Material (${coreThick}")`, (totalSqin * costBackground) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${costBackground.toFixed(4)}/sqin) * ${wastePct} Waste`);
    
    const costApplique = parseFloat(data.Cost_Stock_132_Applique || 65)/sheetSqIn;
    L(`Tactile Applique (1/32")`, (totalSqin * costApplique) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${costApplique.toFixed(4)}/sqin) * Waste`);

    const costTape = parseFloat(data.Cost_ADA_Tape || 0.30) / 144;
    L(`3M Double Sided Tape`, (totalSqin * costTape) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${costTape.toFixed(4)}/sqin) * Waste`);

    // Raster Beads Math
    const costBead = parseFloat(data.Cost_Raster_Bead || 0.05);
    const totalBeads = inputs.qty * 10; // Approx 10 per sign
    L(`Raster Braille Beads`, totalBeads * costBead * wastePct, `${totalBeads} Beads * $${costBead.toFixed(2)}`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const shopRate = parseFloat(data.Rate_Shop_Labor || 20);
    const engraveRate = parseFloat(data.Rate_Machine_Engraver || 15);
    
    L(`Engraver Prepress`, (10 / 60) * rateOp, `10 Mins * $${rateOp}/hr`);
    L(`Engraver Setup`, (parseFloat(data.Time_Engraver_Load_Per_Item || 2) * inputs.qty / 60) * rateOp, `${inputs.qty} Signs * 2 Mins * $${rateOp}/hr`);
    const runMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.5);
    L(`Engraver Run Time`, (runMins / 60) * engraveRate, `${runMins.toFixed(1)} Mins * $${engraveRate}/hr`);
    
    // Explicit Bead Insertion Labor (0.05 mins per bead)
    L(`Braille Bead Insertion`, (totalBeads * 0.05 / 60) * shopRate, `${totalBeads} Beads * 0.05 Mins * $${shopRate}/hr`);

    if (backer !== 'None') {
        const cncRate = parseFloat(data.Rate_Machine_CNC || 10);
        L(`CNC Prepress`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
        L(`CNC Setup`, (10 / 60) * rateOp, `10 Mins * $${rateOp}/hr`);
        const cncMins = totalSqin * parseFloat(data.Time_CNC_Easy_SqFt || 1) / 144;
        L(`CNC Run Time`, (cncMins / 60) * cncRate, `${cncMins.toFixed(2)} Mins * $${cncRate}/hr`);
    }

    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.05);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: ret },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}

window.ADA_CONFIG = {
    tab: 'PROD_ADA_Signs', engine: calculateADA,
    controls: [
        { id: 'signType', label: 'ADA Sign Type', type: 'select', opts: [{v:'Standard', t:'Standard (1/8" Core)'}, {v:'Layered_PVC', t:'Layered (1/16" on PVC)'}, {v:'Layered_Acrylic', t:'Layered (1/16" on Acrylic)'}] }
    ],
    retails: [ { key: 'ADA_TypeA_Large', label: 'Standard >=36"' } ],
    costs: [ { key: 'Cost_Stock_116_ADA', label: '1/16" Core ($/Sht)' }, { key: 'Time_Engrave_SqIn', label: 'Engrave (Min/SqIn)' } ]
};
