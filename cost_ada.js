/**
 * PURE PHYSICS ENGINE: ADA Signs (v6.2)
 * Square-Inch Tiered Curve Logic, Array Ledger, and Backend Volume Tiers.
 */
function calculateADA(inputs, data) {
    const sqin = inputs.w * inputs.h;
    const totalSqin = sqin * inputs.qty;

    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    const V = (k) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    const C = (k, val) => {
        let desc = window.ADA_CONFIG.constants.find(x => x.key === k)?.desc || "";
        return `<span class="hover-var text-emerald-600 border-b border-dotted border-emerald-400 cursor-help transition-all font-bold" data-var="${k}" title="${desc}">${val}</span>`;
    };

    // --- 1. RETAIL ENGINE (TIERED CURVE) ---
    const ret = [];
    const R = (label, total, formula) => { if(total !== 0) ret.push({label, total, formula}); return total; };

    // Determine Base Rate via Tiers
    let baseRate = parseFloat(data.ADA_T3_Rate || 1.35); // Default to highest tier (cheapest rate)
    if (sqin <= parseFloat(data.ADA_T1_Max || 25)) {
        baseRate = parseFloat(data.ADA_T1_Rate || 2.10);
    } else if (sqin <= parseFloat(data.ADA_T2_Max || 64)) {
        baseRate = parseFloat(data.ADA_T2_Rate || 1.80);
    } else if (data.ADA_T3_Max && sqin <= parseFloat(data.ADA_T3_Max)) {
        baseRate = parseFloat(data.ADA_T3_Rate || 1.35);
    }

    let physicalSignRetail = 0;
    physicalSignRetail += R(`Base ADA Sign`, (baseRate * sqin) * inputs.qty, `Qty * ${sqin.toFixed(1)} SqIn * $${baseRate.toFixed(2)}`);

    // Layer Loop (First Tactile and First Core are absorbed in the Base Price)
    let hasBaseTactile = false;
    let hasBaseCore = false;
    let totalBrailleLines = 0;
    let hasCNC = false;

    inputs.layers.forEach(layer => {
        if (layer.type === 'Tactile') {
            if (!hasBaseTactile) {
                hasBaseTactile = true; // Included in base
            } else {
                const addTac = parseFloat(data.Retail_Adder_Tactile || 0.60);
                physicalSignRetail += R(`Extra Tactile Layer`, (sqin * addTac) * inputs.qty, `Qty * SqIn * ${V('Retail_Adder_Tactile')}`);
            }
            if (layer.hasBraille) totalBrailleLines += (inputs.brailleLines || 1);
        }
        else if (layer.type.includes('Core')) {
            if (!hasBaseCore) {
                hasBaseCore = true; // Included in base
            } else {
                const addCore = parseFloat(data.Retail_Adder_116_Core || 0.10);
                physicalSignRetail += R(`Extra Core Substrate`, (sqin * addCore) * inputs.qty, `Qty * SqIn * ${V('Retail_Adder_116_Core')}`);
            }
        }
        else if (layer.type === '3mm PVC Backer') {
            const addPVC = parseFloat(data.Retail_Adder_PVC_Backer || 0.10);
            physicalSignRetail += R(`Rigid Backer (3mm PVC)`, (sqin * addPVC) * inputs.qty, `Qty * SqIn * ${V('Retail_Adder_PVC_Backer')}`);
            hasCNC = true;
        }
        else if (layer.type === '3/16" Clear Acrylic') {
            const addAcr = parseFloat(data.Retail_Adder_Acr_Backer || 0.15);
            physicalSignRetail += R(`Rigid Backer (3/16" Acrylic)`, (sqin * addAcr) * inputs.qty, `Qty * SqIn * ${V('Retail_Adder_Acr_Backer')}`);
            hasCNC = true;
        }
    });

    if (totalBrailleLines > 0) {
        if (totalBrailleLines > 1) {
            const extraLines = totalBrailleLines - 1;
            physicalSignRetail += R(`Extra Raster Braille Lines`, extraLines * inputs.qty * parseFloat(data.Retail_Adder_Braille_Line || 10.00), `Qty * Extra Lines * ${V('Retail_Adder_Braille_Line')}`);
        }
    }
    
    // --- DYNAMIC VOLUME DISCOUNTS ---
    let discPct = 0;
    let activeTierQty = 0;
    let i = 1;
    
    // Automatically loops through backend data looking for Tier_1, Tier_2, etc.
    while(data[`Tier_${i}_Qty`]) {
        const tQty = parseFloat(data[`Tier_${i}_Qty`]);
        const tDisc = parseFloat(data[`Tier_${i}_Disc`] || 0);
        if (inputs.qty >= tQty) {
            discPct = tDisc;
            activeTierQty = tQty;
        }
        i++;
    }

    if (discPct > 0) {
        R(`Volume Discount (${activeTierQty}+)`, -(physicalSignRetail * discPct), `-${(discPct * 100).toFixed(0)}% off Base Sign Elements`);
    }

    // Apply CNC Fee AFTER discounts
    if (hasCNC && inputs.bevel === 'Bevel') {
        const cncFee = parseFloat(data.Retail_Fee_Router_Easy || 30.00);
        R(`CNC Beveling / Shaping Fee`, cncFee, `Flat ${V('Retail_Fee_Router_Easy')}`);
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

    let solidLayerCount = 0;
    let hasEngraver = false;

    // COST: Iterate strictly in UI order
    inputs.layers.forEach(layer => {
        if (layer.type === 'Tactile') {
            const costApplique = parseFloat(data.Cost_Sub_Tactile || 55)/sheetSqIn;
            L(`Tactile Applique (1/32")`, (totalSqin * costApplique) * wastePct, `(Total SqIn * ${V('Cost_Sub_Tactile')} / ${C('C_1152', '1152')}) * ${V('Waste_Factor')}`);
            solidLayerCount++;
            hasEngraver = true;
        }
        else if (layer.type === '1/16" Core') {
            const costCore = parseFloat(data.Cost_Sub_ADA_Core_116 || 50)/sheetSqIn;
            L(`ADA Core (1/16")`, (totalSqin * costCore) * wastePct, `(Total SqIn * ${V('Cost_Sub_ADA_Core_116')} / ${C('C_1152', '1152')}) * ${V('Waste_Factor')}`);
            solidLayerCount++;
            hasEngraver = true;
        }
        else if (layer.type === '1/8" Core') {
            const costCore = parseFloat(data.Cost_Sub_ADA_Core_18 || 70)/sheetSqIn;
            L(`ADA Core (1/8")`, (totalSqin * costCore) * wastePct, `(Total SqIn * ${V('Cost_Sub_ADA_Core_18')} / ${C('C_1152', '1152')}) * ${V('Waste_Factor')}`);
            solidLayerCount++;
            hasEngraver = true;
        }
        else if (layer.type === '3mm PVC Backer') {
            const costPVC = parseFloat(data.Cost_Sub_PVC || 29.09) / 4608;
            L(`Rigid Backer (${layer.colorName} PVC)`, (totalSqin * costPVC) * wastePct, `(Total SqIn * ${V('Cost_Sub_PVC')} / ${C('C_4608', '4608')}) * ${V('Waste_Factor')}`);
            solidLayerCount++;
        }
        else if (layer.type === '3/16" Clear Acrylic') {
            const costAcr = parseFloat(data.Cost_Sub_Acrylic || 91.65) / 4608;
            L(`Rigid Backer (3/16" Acr)`, (totalSqin * costAcr) * wastePct, `(Total SqIn * ${V('Cost_Sub_Acrylic')} / ${C('C_4608', '4608')}) * ${V('Waste_Factor')}`);
            solidLayerCount++;
        }
    });

    if (totalBrailleLines > 0) {
        const costBead = parseFloat(data.Cost_Raster_Bead || 0.01);
        const totalBeads = inputs.qty * totalBrailleLines * 10; 
        L(`Raster Braille Beads`, totalBeads * costBead * wastePct, `Total Beads * ${V('Cost_Raster_Bead')} * ${V('Waste_Factor')}`);
    }

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const shopRate = parseFloat(data.Rate_Shop_Labor || 20);
    
    // TAPE & MOUNTING LOGIC
    let tapeLayers = solidLayerCount > 1 ? (solidLayerCount - 1) : 0;
    if (inputs.mounting === 'Foam Tape') tapeLayers++;

    if (tapeLayers > 0) {
        const costTape = parseFloat(data.Cost_Hem_Tape || 0.08) / 12; // LF tape converted
        L(`3M Tape / Foam (${tapeLayers}x Layers)`, (totalSqin * costTape * tapeLayers) * wastePct, `(Total SqIn * Tape Cost / ${C('C_144', '144')} * ${tapeLayers} Lyr) * ${V('Waste_Factor')}`);
        
        const asmMins = inputs.qty * tapeLayers * 2; 
        L(`Layer Assembly Labor`, (asmMins / 60) * shopRate, `Qty * ${tapeLayers} Lyr * ${C('C_2', '2 Mins')} * ${V('Rate_Shop_Labor')}`);
    }

    if (hasEngraver) {
        const engraveRate = parseFloat(data.Rate_Machine_Engraver || 10);
        L(`Engraver Prepress`, (parseFloat(data.Time_Preflight_Job || 15) / 60) * rateOp, `${V('Time_Preflight_Job')} Mins * ${V('Rate_Operator')}`);
        L(`Engraver Setup`, (parseFloat(data.Time_Engraver_Load_Per_Item || 2) * inputs.qty / 60) * rateOp, `Qty * ${V('Time_Engraver_Load_Per_Item')} * ${V('Rate_Operator')}`);
        
        const runMins = totalSqin * parseFloat(data.Time_Engrave_SqIn || 0.25);
        L(`Engraver Run Time`, (runMins / 60) * engraveRate, `Total SqIn * ${V('Time_Engrave_SqIn')} * ${V('Rate_Machine_Engraver')}`);
    }

    if (totalBrailleLines > 0) {
        L(`Braille Bead Insertion`, ((inputs.qty * totalBrailleLines * 10) * 0.05 / 60) * shopRate, `Total Beads * ${C('C_005', '0.05 Mins')} * ${V('Rate_Shop_Labor')}`);
    }

    if (hasCNC) {
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
        { id: 'w', label: 'Width', type: 'number', def: 8 },
        { id: 'h', label: 'Height', type: 'number', def: 8 },
        { id: 'brailleLines', label: 'Braille Lines', type: 'number', def: 1 }
    ],
    retails: [ 
        { key: 'ADA_T1_Rate', label: 'Tier 1 Rate ($)' },
        { key: 'ADA_T2_Rate', label: 'Tier 2 Rate ($)' },
        { key: 'ADA_T3_Rate', label: 'Tier 3 Rate ($)' },
        { key: 'Tier_1_Qty', label: 'Tier 1 Qty' },
        { key: 'Tier_1_Disc', label: 'Tier 1 Disc (%)' },
        { key: 'Retail_Adder_116_Core', label: 'Core Add ($/Sqin)' },
        { key: 'Retail_Adder_PVC_Backer', label: 'PVC Backer ($/Sqin)' },
        { key: 'Retail_Adder_Acr_Backer', label: 'Acr Backer ($/Sqin)' },
        { key: 'Retail_Min_Order', label: 'Shop Minimum ($)' }
    ],
    costs: [ 
        { key: 'Cost_Sub_ADA_Core_116', label: '1/16" Core ($/Sht)' }, 
        { key: 'Cost_Sub_ADA_Core_18', label: '1/8" Core ($/Sht)' },
        { key: 'Cost_Sub_Tactile', label: '1/32" Tactile ($/Sht)' },
        { key: 'Cost_Sub_PVC', label: '3mm PVC ($/Sht)' },
        { key: 'Cost_Sub_Acrylic', label: '3/16" Clear ($/Sht)' },
        { key: 'Cost_Raster_Bead', label: 'Raster Bead ($/Ea)' },
        { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Machine_Engraver', label: 'Engraver Mach ($/Hr)' },
        { key: 'Time_Preflight_Job', label: 'Setup / Preflight' },
        { key: 'Time_Engrave_SqIn', label: 'Engrave (Min/Sqin)' },
        { key: 'Waste_Factor', label: 'Waste Buffer (1.x)' },
        { key: 'Factor_Risk', label: 'Risk Buffer (1.x)' }
    ],
    constants: [
        { key: 'C_1152', val: '1152', label: '1152 (ADA Sheet)', desc: 'SqIn yield of a 24" x 48" half-sheet (Rowmark ADA Core/Tactile).' },
        { key: 'C_4608', val: '4608', label: '4608 (Full Sheet)', desc: 'SqIn yield of a full 4\' x 8\' sheet (PVC/Acrylic Backers).' },
        { key: 'C_144', val: '144', label: '144 (SqFt Base)', desc: 'SqIn per SqFt.' },
        { key: 'C_005', val: '0.05 Mins', label: '0.05 Mins', desc: 'Estimated shop labor time to manually insert a single Raster Braille Bead.' },
        { key: 'C_2', val: '2 Mins', label: '2 Mins', desc: 'Estimated shop labor time to align, tape, and press a single material layer.' }
    ]
};