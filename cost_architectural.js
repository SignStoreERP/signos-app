/**
 * PURE PHYSICS ENGINE: A La Carte ADA Builder (v3.0 - CAD Model)
 * Processes independent X/Y layers, dynamic bounds, and nested text elements.
 */
function calculateArchitectural(inputs, data) {
    const qty = parseFloat(inputs.qty) || 1;
    const layers = inputs.layers || [];

    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    const V = (k) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    const C = (k, val) => `<span class="hover-var text-emerald-600 border-b border-dotted border-emerald-400 cursor-help transition-all font-bold" data-var="${k}">${val}</span>`;

    const ret = [];
    const cst = [];
    const R = (label, total, formula) => { if(total > 0) ret.push({label, total, unit: total/qty, formula}); return total; };
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, unit: total/qty, formula}); return total; };

    // Global Rates
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const shopRate = parseFloat(data.Rate_Shop_Labor || 20);
    const engraveRate = parseFloat(data.Rate_Machine_Engraver || 10);
    const cncRate = parseFloat(data.Rate_Machine_CNC || 10);
    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    // Dictionaries
    const matDict = {
        '1/32 Tactile': { ret: parseFloat(data.Retail_Adder_Tactile || 0.60), cost: parseFloat(data.Cost_Sub_Tactile || 55), yield: 1152, isCNC: false },
        '1/16 Core': { ret: parseFloat(data.Retail_Price_Mattes_116 || 0.55), cost: parseFloat(data.Cost_Sub_ADA_Core_116 || 50), yield: 1152, isCNC: false },
        '1/8 Core': { ret: parseFloat(data.Retail_Price_Ultra_18 || 0.85), cost: parseFloat(data.Cost_Sub_ADA_Core_18 || 70), yield: 1152, isCNC: false },
        '3mm PVC': { ret: parseFloat(data.Retail_Adder_PVC_Backer || 0.40), cost: parseFloat(data.Cost_Sub_PVC || 29.09), yield: 4608, isCNC: true },
        '3/16 Acrylic': { ret: parseFloat(data.Retail_Adder_Acr_Backer || 0.60), cost: parseFloat(data.Cost_Sub_Acrylic || 91.65), yield: 4608, isCNC: true }
    };

    let totalSqinEngrave = 0;
    let totalSqinCNC = 0;
    let maxLayerSqIn = 0;
    let totalBrailleDots = 0;

    // --- 1. RETAIL & MATERIAL COST LOOPS ---
    layers.forEach((layer, i) => {
        let sqin = layer.w * layer.h;
        let totalSqin = sqin * qty;
        if (sqin > maxLayerSqIn) maxLayerSqIn = sqin;

        let mat = matDict[layer.type];
        if (mat) {
            // Retail
            R(`L${i+1}: ${layer.type} (${layer.w}x${layer.h}")`, totalSqin * mat.ret, `Total SqIn * $${mat.ret.toFixed(2)}/sqin`);
            
            // Cost
            let yieldKey = mat.yield === 1152 ? 'C_1152' : 'C_4608';
            L(`L${i+1} Material (${layer.colorName})`, (totalSqin * (mat.cost / mat.yield)) * wastePct, `(SqIn * Cost / ${C(yieldKey, mat.yield)}) * Waste`);
            
            if (mat.isCNC) totalSqinCNC += totalSqin;
            else totalSqinEngrave += totalSqin;
        }

        // Nested Elements (Tactile/Braille)
        if (layer.type === '1/32 Tactile' && layer.elements) {
            layer.elements.forEach(elem => {
                if (elem.type === 'braille') {
                    let chars = elem.text.length;
                    let dots = chars * 4; // Approx average dots per cell
                    totalBrailleDots += dots * qty;
                    R(`Braille Block: "${elem.text}"`, qty * parseFloat(data.Retail_Adder_Braille_Line || 10), `Qty * Braille Line Retail`);
                }
            });
        }
    });

    // --- 2. HARDWARE & ASSEMBLY ---
    if (inputs.hardware === 'Foam Tape' && maxLayerSqIn > 0) {
        const tapeCostLF = parseFloat(data.Cost_Hem_Tape || 0.08);
        const tapeLayers = Math.max(1, layers.length - 1); // Tape layers together, plus tape to wall
        L(`3M Foam Tape Mount`, ((maxLayerSqIn / 144) * tapeCostLF * tapeLayers) * wastePct, `(Max SqFt * ${V('Cost_Hem_Tape')}) * ${tapeLayers} Lyr * Waste`);
        L(`Assembly / Taping Labor`, (qty * tapeLayers * 2 / 60) * shopRate, `Qty * ${tapeLayers} Layers * ${C('C_2', '2 Mins')} * $${shopRate}/hr`);
    }

    if (totalBrailleDots > 0) {
        L(`Braille Beads (${totalBrailleDots} dots)`, totalBrailleDots * parseFloat(data.Cost_Raster_Bead || 0.01) * wastePct, `Total Dots * ${V('Cost_Raster_Bead')} * Waste`);
        L(`Braille Insertion Labor`, (totalBrailleDots * 0.05 / 60) * shopRate, `Total Dots * ${C('C_005', '0.05 Mins')} * $${shopRate}/hr`);
    }

    // --- 3. MACHINE RUNS ---
    if (totalSqinEngrave > 0) {
        L(`Engraver Prepress`, (parseFloat(data.Time_Preflight_Job || 15) / 60) * rateOp, `${V('Time_Preflight_Job')} Mins * $${rateOp}/hr`);
        L(`Engraver Setup`, (parseFloat(data.Time_Engraver_Load_Per_Item || 2) * qty / 60) * rateOp, `Qty * ${V('Time_Engraver_Load_Per_Item')} Mins * $${rateOp}/hr`);
        L(`Engraver Run Time`, ((totalSqinEngrave * parseFloat(data.Time_Engrave_SqIn || 0.25)) / 60) * engraveRate, `Total SqIn * ${V('Time_Engrave_SqIn')} Mins * $${engraveRate}/hr`);
    }

    if (totalSqinCNC > 0) {
        L(`CNC Router Run`, ((totalSqinCNC * parseFloat(data.Time_CNC_Easy_SqFt || 1) / 144) / 60) * cncRate, `Total SqFt * ${V('Time_CNC_Easy_SqFt')} Mins * $${cncRate}/hr`);
        L(`CNC Operator`, ((totalSqinCNC * parseFloat(data.Time_CNC_Easy_SqFt || 1) / 144) / 60) * rateOp, `Total SqFt * ${V('Time_CNC_Easy_SqFt')} Mins * $${rateOp}/hr`);
    }

    let hardCost = cst.reduce((sum, i) => sum + i.total, 0);
    let rawRetail = ret.reduce((sum, i) => sum + i.total, 0);
    let minOrder = parseFloat(data.Retail_Min_Order || 50);
    let grandTotal = Math.max(rawRetail, minOrder);

    return {
        retail: { unitPrice: grandTotal / qty, grandTotal: grandTotal, breakdown: ret, isMinApplied: rawRetail < minOrder },
        cost: { total: hardCost * riskFactor, breakdown: cst },
        metrics: { margin: (grandTotal - (hardCost * riskFactor)) / grandTotal }
    };
}

window.ARCH_CONFIG = {
    tab: 'PROD_ADA_Signs',
    engine: calculateArchitectural,
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
        { key: 'Cost_Sub_ADA_Core_116', label: '1/16" Core ($/Sht)' },
        { key: 'Cost_Sub_ADA_Core_18', label: '1/8" Core ($/Sht)' },
        { key: 'Cost_Sub_Tactile', label: '1/32" Tactile ($/Sht)' },
        { key: 'Cost_Sub_PVC', label: '3mm PVC ($/Sht)' },
        { key: 'Cost_Sub_Acrylic', label: '3/16" Clear ($/Sht)' },
        { key: 'Cost_Raster_Bead', label: 'Raster Bead ($/Ea)' },
        { key: 'Rate_Operator', label: 'Operator ($/Hr)' },
        { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Machine_Engraver', label: 'Engraver Mach ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'CNC Mach ($/Hr)' },
        { key: 'Time_Preflight_Job', label: 'Setup / Preflight' },
        { key: 'Time_Engrave_SqIn', label: 'Engrave (Min/Sqin)' },
        { key: 'Time_CNC_Easy_SqFt', label: 'CNC (Min/SqFt)' },
        { key: 'Waste_Factor', label: 'Waste Buffer (1.x)' },
        { key: 'Factor_Risk', label: 'Risk Buffer (1.x)' }
    ]
};