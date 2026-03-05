/**
 * PURE PHYSICS ENGINE: ADA Signs (v4.2)
 * Full Exhaustive Ledger format. Includes full Sandbox Arrays.
 */
function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    // --- 1. RETAIL ENGINE ---
    const ret = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, formula}); return total; };

    let baseRateSqIn = inputs.signType === 'Standard' ? parseFloat(data.Retail_Price_Ultra_18 || 0.85) : parseFloat(data.Retail_Price_Mattes_116 || 0.55);
    R(`Base Engraved Body`, (sqin * baseRateSqIn) * inputs.qty, `${inputs.qty}x Signs @ ${sqin} sqin * $${baseRateSqIn.toFixed(2)}`);

    if (inputs.hasTactile) {
        R(`Tactile Applique Adder`, (sqin * parseFloat(data.Retail_Adder_Tactile || 0.60)) * inputs.qty, `${inputs.qty}x Signs @ ${sqin} sqin * $0.60`);
    }

    if (inputs.signType === 'Layered_PVC') {
        R(`PVC Rigid Backer`, (sqin * parseFloat(data.Retail_Adder_PVC_Backer || 0.40)) * inputs.qty, `${inputs.qty}x Signs @ ${sqin} sqin * $0.40`);
    } else if (inputs.signType === 'Layered_Acrylic') {
        R(`Acrylic Rigid Backer`, (sqin * parseFloat(data.Retail_Adder_Acr_Backer || 0.60)) * inputs.qty, `${inputs.qty}x Signs @ ${sqin} sqin * $0.60`);
    }

    let brailleFee = 0;
    if (inputs.hasBraille && inputs.brailleLines > 0) {
        brailleFee = inputs.brailleLines * parseFloat(data.Retail_Adder_Braille_Line || 10.00);
        R(`Raster Braille (Grade 2)`, brailleFee * inputs.qty, `${inputs.qty}x Signs @ ${inputs.brailleLines} Lines * $10.00`);
    }

    let grandTotalRaw = ret.reduce((sum, i) => sum + i.total, 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE ---
    const cst = [];
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    const coreThick = inputs.signType === 'Standard' ? '1/8' : '1/16';
    const sheetSqIn = 24 * 48; // 1152
    const wastePct = parseFloat(data.Waste_Factor || 1.15);

    const costBackground = coreThick === '1/8' ? parseFloat(data.Cost_Stock_18_ADA || 117)/sheetSqIn : parseFloat(data.Cost_Stock_116_ADA || 75)/sheetSqIn;
    L(`ADA Core (${coreThick}")`, (totalSqin * costBackground) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${costBackground.toFixed(4)}/sqin) * ${wastePct} Waste`);

    if (inputs.hasTactile) {
        const costApplique = parseFloat(data.Cost_Stock_132_Applique || 65)/sheetSqIn;
        L(`Tactile Applique (1/32")`, (totalSqin * costApplique) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${costApplique.toFixed(4)}/sqin) * Waste`);
        const costTape = parseFloat(data.Cost_ADA_Tape || 0.30) / 144;
        L(`3M Double Sided Tape`, (totalSqin * costTape) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${costTape.toFixed(4)}/sqin) * Waste`);
    }

    if (inputs.hasBraille) {
        const costBead = parseFloat(data.Cost_Raster_Bead || 0.05);
        const totalBeads = inputs.qty * inputs.brailleLines * 10; // Approx 10 per line
        L(`Raster Braille Beads`, totalBeads * costBead * wastePct, `${totalBeads} Beads * $${costBead.toFixed(2)}`);
    }

    if (inputs.signType !== 'Standard') {
        let backerCost = 0;
        if (inputs.signType === 'Layered_Acrylic') {
            backerCost = parseFloat(data.Cost_Stock_14_4x8_C || 120) / 4608;
        } else {
            // Check UI input for Black vs White PVC
            if (inputs.backerColor === 'White PVC') {
                backerCost = parseFloat(data.Cost_Stock_3mm_4x8_WW || 29.09) / 4608;
            } else {
                backerCost = parseFloat(data.Cost_Stock_3mm_4x8_BK || 32.53) / 4608;
            }
        }
        L(`Rigid Backer Material`, (totalSqin * backerCost) * wastePct, `(${totalSqin.toFixed(1)} SqIn * $${backerCost.toFixed(4)}/sqin) * Waste`);
    }

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const shopRate = parseFloat(data.Rate_Shop_Labor || 20);
    const engraveRate = parseFloat(data.Rate_Machine_Engraver || 15);

    L(`Engraver Prepress`, (10 / 60) * rateOp, `10 Mins * $${rateOp}/hr`);
    L(`Engraver Setup`, (parseFloat(data.Time_Engraver_Load_Per_Item || 2) * inputs.qty / 60) * rateOp, `${inputs.qty} Signs * 2 Mins * $${rateOp}/hr`);
    
    const runMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.25);
    L(`Engraver Run Time`, (runMins / 60) * engraveRate, `${runMins.toFixed(1)} Mins * $${engraveRate}/hr`);
    L(`Operator Attendance`, (runMins / 60) * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${runMins.toFixed(1)} Mins * 10% Attn`);

    if (inputs.hasBraille) {
        L(`Braille Bead Insertion`, ((inputs.qty * inputs.brailleLines * 10) * 0.05 / 60) * shopRate, `Beads * 0.05 Mins * $${shopRate}/hr`);
    }

    if (inputs.signType !== 'Standard') {
        const cncRate = parseFloat(data.Rate_Machine_CNC || 10);
        L(`CNC Prepress & Setup`, (25 / 60) * rateOp, `25 Mins * $${rateOp}/hr`);
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
        { id: 'signType', label: 'Sign Type', type: 'select', opts: [{v:'Standard', t:'Standard (1/8" Core)'}, {v:'Layered_PVC', t:'Layered (1/16" on PVC)'}, {v:'Layered_Acrylic', t:'Layered (1/16" on Acrylic)'}] },
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
        { key: 'Cost_Stock_3mm_4x8_BK', label: '3mm PVC ($/Sht)' },
        { key: 'Cost_Stock_14_4x8_C', label: '1/4" Clear ($/Sht)' },
        { key: 'Cost_ADA_Tape', label: '3M Tape ($/SqFt)' },
        { key: 'Cost_Raster_Bead', label: 'Raster Bead ($/Ea)' },
        { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Machine_Engraver', label: 'Engraver Mach ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'CNC Mach ($/Hr)' },
        { key: 'Time_Engraver_Load_Per_Item', label: 'Load/Unload (Mins)' },
        { key: 'Time_Engrave_SqIn', label: 'Engrave Spd (Min/Sqin)' },
        { key: 'Waste_Factor', label: 'Waste Buffer (1.x)' },
        { key: 'Factor_Risk', label: 'Risk Buffer (1.x)' }
    ]
};

