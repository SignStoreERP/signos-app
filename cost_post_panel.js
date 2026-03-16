/**
 * PURE PHYSICS ENGINE: Post & Panel Signs (v3.0)
 * Features: True Modular Multi-Panel Logic, Independent Frame Extrusions, Sandbox Map Configs
 */

function calculatePostPanel(inputs, data) {
    const cst = [];
    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    const V = (k) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    const L = (label, total, formula, rB, cB, meta={}) => {
        if(total > 0) cst.push({label, total, formula, rB, cB, meta});
        return total;
    };

    // --- 1. MULTI-PANEL AGGREGATION & SUBSTRATES ---
    let totalPanelH = 0;
    let totalSqFt = 0;
    let faceTotalCost = 0;
    let maxFaceThick = 0;
    let activeKeys = [];
    
    // Aggregating Fabrication Processes
    let cncRunMins = 0;
    let shearCuts = 0;
    let paintSqFt = 0;
    let printSqFt = 0;
    let stencilSqFt = 0;
    let vinylRaw = 0, inkRaw = 0, lamRaw = 0, tapeRaw = 0;
    let weedMins = 0, maskMins = 0, mountMins = 0;

    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    inputs.panels.forEach((p, idx) => {
        totalPanelH += p.h + (idx > 0 ? p.gap : 0);
        const pSqft = (p.w * p.h) / 144;
        const activeSqFt = pSqft * p.sides * inputs.qty;
        totalSqFt += pSqft;

        let subCost = 1.50, subKey = 'Cost_Stock_063_4x8', physThick = 0.063;
        if (p.faceMat === '040 Alum') { subCost = parseFloat(data.Cost_Stock_040_4x8 || 84.44) / 32; physThick = 0.040; subKey = 'Cost_Stock_040_4x8'; }
        else if (p.faceMat === '063 Alum') { subCost = parseFloat(data.Cost_Stock_063_4x8 || 98.12) / 32; physThick = 0.063; subKey = 'Cost_Stock_063_4x8'; }
        else if (p.faceMat === '080 Alum') { subCost = parseFloat(data.Cost_Stock_080_4x8 || 124.57) / 32; physThick = 0.080; subKey = 'Cost_Stock_080_4x8'; }
        else if (p.faceMat === '3mm ACM') { subCost = parseFloat(data.Cost_Stock_3mm_4x8 || 52.09) / 32; physThick = 0.118; subKey = 'Cost_Stock_3mm_4x8'; }
        else if (p.faceMat === '6mm ACM') { subCost = parseFloat(data.Cost_Stock_6mm_4x8 || 72.10) / 32; physThick = 0.236; subKey = 'Cost_Stock_6mm_4x8'; }

        if (!activeKeys.includes(subKey)) activeKeys.push(subKey);
        if (physThick > maxFaceThick) maxFaceThick = physThick;

        // Substrates & Cutting
        faceTotalCost += activeSqFt * subCost * wastePct;

        if (p.isCNC) {
            cncRunMins += activeSqFt * parseFloat(data.Time_CNC_Easy_SqFt || 1);
        } else {
            shearCuts += 4 * p.sides * inputs.qty; 
        }

        // Graphic Logic Routing
        const isPaintedFace = p.graphicMethod !== 'Overlay';
        const isPrinted = p.graphicMethod === 'Overlay' || p.graphicMethod === 'PrintOnPaint';
        const isPaintedGraphics = p.graphicMethod === 'PaintOnPaint';

        if (isPaintedFace) paintSqFt += activeSqFt;
        if (isPrinted) printSqFt += activeSqFt;
        
        const vinylCost = parseFloat(data.Cost_Vin_Cast || 1.30);
        if (p.graphicMethod === 'Overlay') {
            vinylRaw += activeSqFt * vinylCost;
            lamRaw += activeSqFt * parseFloat(data.Cost_Lam_Cast || 0.96);
            mountMins += activeSqFt * parseFloat(data.Time_Mount_Flat_SqFt || 0.25);
        } else {
            vinylRaw += activeSqFt * vinylCost;
            tapeRaw += activeSqFt * parseFloat(data.Cost_Transfer_Tape || 0.15);
            weedMins += activeSqFt * parseFloat(data.Time_Weed_Simple || 0.42);
            maskMins += activeSqFt * parseFloat(data.Time_Mask_SqFt || 0.17);
            if (isPaintedGraphics) stencilSqFt += activeSqFt;
        }
    });

    if (faceTotalCost > 0) L(`Face Substrates (Sum of Panels)`, faceTotalCost, `Combined SqFt * Sub Cost * Sides * ${wastePct} Waste`, 'faces', 'struct_mat');

    // --- 2. GROUND & VERTICAL POSITIONS ---
    let panelAboveInches = inputs.clearance + totalPanelH;
    let postAboveInches = panelAboveInches; 

    // CHAT PARSER FIX: Target array specifically with .at()
    const primaryMount = inputs.panels.at(0).mountStyle;
    if (primaryMount === 'Flush') {
        inputs.postOffset = 0; 
    } else if (inputs.allowOffset) {
        postAboveInches = panelAboveInches + inputs.postOffset;
    }

    let maxAboveInches = Math.max(panelAboveInches, postAboveInches);
    
    const aboveGroundFt = postAboveInches / 12; 
    const undergroundFt = inputs.belowGrade / 12;
    const totalPostFt = aboveGroundFt + undergroundFt;
    const totalPoleLF = totalPostFt * 2 * inputs.qty;

    const postSizeInches = parseFloat(inputs.postProfile) || 2; 

    let maxPanelW = Math.max(...inputs.panels.map(p => p.w));
    let OD = inputs.postSpacing + (postSizeInches * 2);
    let overallW = Math.max(maxPanelW, OD);

    // --- 3. PER-PANEL INTERNAL FRAMEWORK CHASSIS ---
    let fDesc = [];
    let totalFrameLF = 0;
    let totalFrameCuts = 0;
    let totalAdhMins = 0;
    let frameCostTotal = 0;

    const FALLBACK_METALS = {
        'Cost_Post_Aluminum_2_1/8': 4.28, 'Cost_Post_Aluminum_3_1/8': 6.56, 'Cost_Post_Aluminum_4_1/8': 8.84, 'Cost_Post_Aluminum_6_1/4': 26.22,
        'Cost_Post_Steel_3_1/8': 3.88, 'Cost_Post_Steel_3_3/16': 5.85, 'Cost_Post_Steel_4_3/16': 9.25, 'Cost_Post_Steel_6_3/16': 13.85, 'Cost_Post_Steel_6_1/4': 18.75, 'Cost_Post_Steel_8_3/16': 21.60, 'Cost_Post_Steel_8_1/4': 24.25, 'Cost_Post_Steel_10_1/4': 27.75, 'Cost_Post_Steel_12_1/4': 33.55,
        'Cost_Frame_AlumTube_2_1/8': 4.28, 'Cost_Frame_AlumTube_3_1/8': 6.56, 'Cost_Frame_AlumTube_4_1/8': 8.84, 'Cost_Frame_AlumTube_6_1/4': 26.22,
        'Cost_Frame_SteelTube_3_1/8': 3.88, 'Cost_Frame_SteelTube_3_3/16': 5.85, 'Cost_Frame_SteelTube_4_3/16': 9.25, 'Cost_Frame_SteelTube_6_3/16': 13.85, 'Cost_Frame_SteelTube_6_1/4': 18.75, 'Cost_Frame_SteelTube_8_3/16': 21.60, 'Cost_Frame_SteelTube_8_1/4': 24.25, 'Cost_Frame_SteelTube_10_1/4': 27.75, 'Cost_Frame_SteelTube_12_1/4': 33.55,
        'Cost_Frame_AlumAngle_1.5_1/8': 1.15, 'Cost_Frame_AlumAngle_2_1/8': 1.45, 'Cost_Frame_SteelAngle_1.5_1/8': 1.15, 'Cost_Frame_SteelAngle_2_1/8': 1.45, 'Cost_Frame_SteelAngle_2_3/16': 1.85, 'Cost_Frame_SteelAngle_2_1/4': 2.15
    };

    inputs.panels.forEach((p, idx) => {
        let fLF = 0;
        let fCuts = 0;
        const fThick = parseFloat(p.frameMat.split('_').at(1)) || 2;
        
        let frameHoriz = p.w; // Always tracking full panel width perimeter
        fLF += (frameHoriz * 2) / 12; 
        fCuts += 4;

        let frameVert = p.h - (fThick * 2);
        const numVerticalBraces = Math.max(0, Math.floor((inputs.postSpacing - 12) / 30)); 
        const totalVerts = 2 + numVerticalBraces;
        
        fLF += (frameVert * totalVerts) / 12; 
        fCuts += totalVerts * 2;

        if (numVerticalBraces > 0) fDesc.push(`Panel ${idx+1}: (x2) ${frameHoriz}" Horiz, (x${totalVerts}) ${frameVert}" Verts (${numVerticalBraces} internal brace)`);
        else fDesc.push(`Panel ${idx+1}: (x2) ${frameHoriz}" Horiz, (x2) ${frameVert}" Verts`);

        let fMult = (p.sides === 2 && p.mountStyle === 'Flush') ? 2 : 1;
        let pFrameLF = (fLF * fMult) * inputs.qty;
        totalFrameLF += pFrameLF;
        totalFrameCuts += (fCuts * fMult) * inputs.qty;
        totalAdhMins += p.sides * inputs.qty * parseFloat(data.Time_Adhesive_Per_Face || 7);

        const frameKey = `Cost_Frame_${p.frameMat}`;
        if(!data[frameKey]) data[frameKey] = FALLBACK_METALS[frameKey] || 1.45;
        if(!activeKeys.includes(frameKey)) activeKeys.push(frameKey);
        
        frameCostTotal += (pFrameLF * parseFloat(data[frameKey])) * wastePct;
    });

    if (frameCostTotal > 0) L(`Internal Frames (Sum of Panels)`, frameCostTotal, `Sum of individual Panel Framework LF * Unit Costs * Waste`, 'posts', 'struct_mat');

    // --- 4. POSTS & CONCRETE ---
    const postKey = `Cost_Post_${inputs.postType}_${inputs.postProfile}`;
    if(!data[postKey]) data[postKey] = FALLBACK_METALS[postKey] || 6.56;
    activeKeys.push(postKey);
    const postCostLF = parseFloat(data[postKey]);
    let postRaw = totalPoleLF * postCostLF;
    let postTotal = postRaw * wastePct;
    
    L(`Structural Posts (${inputs.postType} ${postSizeInches}")`, postTotal, `${totalPoleLF.toFixed(1)} LF * $${postCostLF.toFixed(2)}/LF [${V(postKey)}] * ${wastePct} Waste`, 'posts', 'struct_mat', { waste: postTotal - postRaw, cut: `${totalPostFt.toFixed(1)}' L (x${inputs.qty*2})` });

    let baseCap = parseFloat(data.Cost_Post_Cap || 5.00);
    let capCost = baseCap * (postSizeInches / 3);
    L(`Post Caps (${postSizeInches}")`, 2 * inputs.qty * capCost, `${2 * inputs.qty} Caps * $${capCost.toFixed(2)}/ea (Scaled from ${V('Cost_Post_Cap')})`, 'posts', 'struct_mat', { pull: `${2 * inputs.qty} Units` });

    let holeDiamInches = Math.max(6, postSizeInches * 3);
    if (inputs.hasConcrete) {
        const footerHeightFt = undergroundFt * 0.66;
        const holeRadiusFt = (holeDiamInches / 2) / 12;
        const holeVolumeCuFt = Math.PI * Math.pow(holeRadiusFt, 2) * footerHeightFt;
        const concreteYield = parseFloat(data.Yield_Concrete_Bag_CuFt || 0.6);
        const bagsNeeded = Math.ceil((holeVolumeCuFt * 2) / concreteYield) * inputs.qty;
        const bagCost = parseFloat(data.Cost_Concrete_Bag || 4.50);
        L(`Concrete Tap Footers (80lb Bags)`, bagsNeeded * bagCost, `${bagsNeeded} Bags (${concreteYield} CuFt Yield [${V('Yield_Concrete_Bag_CuFt')}]) * $${bagCost.toFixed(2)}/bag [${V('Cost_Concrete_Bag')}]`, 'concrete', 'concrete', { pull: `${bagsNeeded} Bags` });
    }

    // --- 5. FABRICATION LABOR & ADHESIVE ---
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    let gatherMins = parseFloat(data.Time_Gather_Mats || 10) * inputs.qty;
    L(`Gather Materials`, (gatherMins / 60) * rateShop, `${gatherMins} Mins [${V('Time_Gather_Mats')}] * $${rateShop}/hr [${V('Rate_Shop_Labor')}]`, 'finish', 'struct_lab', { time: gatherMins });

    const isMiterPost = inputs.postType === 'Aluminum' && postSizeInches <= 4;
    const timeMiter = parseFloat(data.Time_Saw_Miter || 5);
    const timeBand = parseFloat(data.Time_Saw_Band || 10);
    
    const postSawMins = (2 * inputs.qty) * (isMiterPost ? timeMiter : timeBand);
    L(`Post Cuts (${isMiterPost ? "Miter Saw" : "Band Saw"})`, (postSawMins / 60) * rateShop, `${2 * inputs.qty} Cuts * ${(postSawMins/(2*inputs.qty))} Mins * $${rateShop}/hr [${V('Rate_Shop_Labor')}]`, 'finish', 'struct_lab', { time: postSawMins });

    const frameSawMins = totalFrameCuts * timeMiter; 
    L(`Frame Cuts (Sum of Panels)`, (frameSawMins / 60) * rateShop, `${totalFrameCuts} Cuts * ${timeMiter} Mins * $${rateShop}/hr [${V('Rate_Shop_Labor')}]`, 'finish', 'struct_lab', { time: frameSawMins });

    const weldLocs = totalFrameCuts; 
    const timeWeldLoc = parseFloat(data.Time_Weld_Per_Loc || 1.5);
    const timeCleanLoc = parseFloat(data.Time_Clean_Weld_Loc || 0.33);
    L(`Tack Welding`, ((weldLocs * timeWeldLoc) / 60) * rateShop, `${weldLocs} Locs * ${timeWeldLoc} Mins [${V('Time_Weld_Per_Loc')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: weldLocs * timeWeldLoc });
    L(`Weld Cleaning & Grinding`, ((weldLocs * timeCleanLoc) / 60) * rateShop, `${weldLocs} Locs * ${timeCleanLoc} Mins [${V('Time_Clean_Weld_Loc')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: weldLocs * timeCleanLoc });

    const adhYield = parseFloat(data.Yield_Adhesive_Tube_LF || 10);
    const adhCost = parseFloat(data.Cost_Adhesive_Tube || 18.71);
    const cartridges = Math.ceil(totalFrameLF / adhYield);
    L(`Lord's Adhesive (Metal Glue)`, cartridges * adhCost, `${cartridges} Cartridges (Chunks of ${adhYield} LF [${V('Yield_Adhesive_Tube_LF')}]) * $${adhCost.toFixed(2)}/ea [${V('Cost_Adhesive_Tube')}]`, 'finish', 'struct_mat');

    L(`Adhesive Application`, (totalAdhMins / 60) * rateShop, `Calculated Faces * ${parseFloat(data.Time_Adhesive_Per_Face || 7)} Mins/Face [${V('Time_Adhesive_Per_Face')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: totalAdhMins });

    // CNC & Shear Operations
    if (cncRunMins > 0) {
        let cncSetup = parseFloat(data.Time_Setup_CNC || 10) * inputs.qty * inputs.panels.length;
        L(`CNC Router Setup`, (cncSetup / 60) * parseFloat(data.Rate_CNC_Labor || 25), `${cncSetup} Mins Setup * $${parseFloat(data.Rate_CNC_Labor || 25)}/hr [${V('Rate_CNC_Labor')}]`, 'faces', 'struct_lab', { time: cncSetup });
        L(`CNC Machine Run`, (cncRunMins / 60) * parseFloat(data.Rate_Machine_CNC || 10), `${totalSqFt.toFixed(1)} SF * ${parseFloat(data.Time_CNC_Easy_SqFt || 1)} Mins/SF * $${parseFloat(data.Rate_Machine_CNC || 10)}/hr [${V('Rate_Machine_CNC')}]`, 'faces', 'struct_lab', { time: cncRunMins });
    } 
    if (shearCuts > 0) {
        let shearRun = shearCuts * parseFloat(data.Time_Shear_Cut || 0.35); 
        L(`Shear Per-Cut Run`, (shearRun / 60) * rateShop, `${shearCuts} Cuts * ${parseFloat(data.Time_Shear_Cut || 0.35)} Mins/Cut [${V('Time_Shear_Cut')}] * $${rateShop}/hr`, 'faces', 'struct_lab', { time: shearRun });
    }

    // --- 6. GRAPHICS WORKFLOW BRANCHING ---
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const machPrint = parseFloat(data.Rate_Machine_Print || 5);
    
    let setupJob = parseFloat(data.Time_Setup_Job || 15) * inputs.qty;
    L(`Job Setup (File RIP)`, (setupJob / 60) * rateOp, `${setupJob} Mins [${V('Time_Setup_Job')}] * $${rateOp}/hr [${V('Rate_Operator')}]`, 'graphics', 'graphics', { time: setupJob });

    let hasPrints = printSqFt > 0;
    let hasCuts = tapeRaw > 0;

    if (hasPrints || hasCuts) {
        let vLabel = hasCuts ? (hasPrints ? 'Vinyl (Print & Cut)' : 'Vinyl (Plotter Cut or Paint Stencil)') : 'Vinyl (Print Media)';
        L(vLabel, vinylRaw * wastePct, `Accumulated Media SqFt * Cost/SF * ${wastePct} Waste`, 'graphics', 'graphics', { waste: (vinylRaw * wastePct) - vinylRaw });
    }

    if (hasPrints) {
        const inkCost = parseFloat(data.Cost_Ink_Latex || 0.16);
        let inkRawCost = printSqFt * inkCost;
        L(`Latex Ink`, inkRawCost * wastePct, `${printSqFt.toFixed(1)} SF * $${inkCost.toFixed(2)}/SF [${V('Cost_Ink_Latex')}] * ${wastePct} Waste`, 'graphics', 'graphics', { waste: (inkRawCost * wastePct) - inkRawCost });

        let printHrs = (printSqFt / parseFloat(data.Speed_Print_Roll || 150));
        L(`Print Machine Run`, printHrs * machPrint, `${printSqFt.toFixed(1)} SF / ${parseFloat(data.Speed_Print_Roll || 150)} SF/hr [${V('Speed_Print_Roll')}] * $${machPrint}/hr [${V('Rate_Machine_Print')}]`, 'graphics', 'graphics', { time: printHrs * 60 });
    }

    if (lamRaw > 0) {
        L(`Overlaminate Media`, lamRaw * wastePct, `Accumulated Lam SqFt * Cost/SF * ${wastePct} Waste`, 'graphics', 'graphics', { waste: (lamRaw * wastePct) - lamRaw });
        L(`Vinyl Mount Labor`, (mountMins / 60) * rateShop, `Accumulated Mount Mins * $${rateShop}/hr`, 'graphics', 'graphics', { time: mountMins });
    } 
    
    if (tapeRaw > 0) {
        L(`Transfer Tape (Masking)`, tapeRaw * wastePct, `Accumulated Tape SqFt * Cost/SF * ${wastePct} Waste`, 'graphics', 'graphics', { waste: (tapeRaw * wastePct) - tapeRaw });
        L(`Weeding Labor`, (weedMins / 60) * rateShop, `Accumulated Weeding Mins * $${rateShop}/hr`, 'graphics', 'graphics', { time: weedMins });
        L(`Masking Labor`, (maskMins / 60) * rateShop, `Accumulated Masking Mins * $${rateShop}/hr`, 'graphics', 'graphics', { time: maskMins });
    }

    // --- 7. PAINTING THE STRUCTURE & GRAPHICS ---
    const ratePaint = parseFloat(data.Rate_Paint_Labor || 30);
    const costPaintUnit = parseFloat(data.Cost_Paint_SqFt || 2.50);

    const postSurfaceArea = (postSizeInches / 12) * 4 * totalPoleLF;
    const structurePaintSqFt = paintSqFt + postSurfaceArea;
    
    L(`Automotive Paint (Polyurethane Base)`, structurePaintSqFt * costPaintUnit * wastePct, `${structurePaintSqFt.toFixed(1)} SF * $${costPaintUnit.toFixed(2)}/SF [${V('Cost_Paint_SqFt')}] * ${wastePct} Waste`, 'finish', 'paint_mat', { waste: (structurePaintSqFt * costPaintUnit * wastePct) - (structurePaintSqFt * costPaintUnit) });

    let basePaintSetup = parseFloat(data.Time_Paint_Setup || 15) * inputs.qty;
    let basePaintPrep = structurePaintSqFt * parseFloat(data.Time_Paint_Prep_SqFt || 0.25);
    let basePaintPrime = structurePaintSqFt * parseFloat(data.Time_Paint_Primer_SqFt || 0.25);
    let basePaintFin = structurePaintSqFt * parseFloat(data.Time_Paint_Finish_SqFt || 0.75);
    
    L(`Paint Setup & Gun Clean`, (basePaintSetup / 60) * ratePaint, `${basePaintSetup} Mins [${V('Time_Paint_Setup')}] * $${ratePaint}/hr [${V('Rate_Paint_Labor')}]`, 'finish', 'paint_lab', { time: basePaintSetup });
    L(`Sanding & Prep`, (basePaintPrep / 60) * ratePaint, `${structurePaintSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Paint_Prep_SqFt || 0.25)} Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: basePaintPrep });
    L(`Primer Coat`, (basePaintPrime / 60) * ratePaint, `${structurePaintSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Paint_Primer_SqFt || 0.25)} Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: basePaintPrime });
    L(`Finish Coat (Color & Clear)`, (basePaintFin / 60) * ratePaint, `${structurePaintSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Paint_Finish_SqFt || 0.75)} Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: basePaintFin });

    if (stencilSqFt > 0) {
        let graphicPaintSqFt = stencilSqFt * 0.5; // Assuming 50% physical fill for graphics text/shapes
        let graphicPaintSetup = parseFloat(data.Time_Paint_Setup || 15) * inputs.qty; 
        let graphicPaintFin = graphicPaintSqFt * parseFloat(data.Time_Paint_Finish_SqFt || 0.75);

        L(`Graphic Paint Setup & Gun Clean`, (graphicPaintSetup / 60) * ratePaint, `${graphicPaintSetup} Mins (Secondary Color) * $${ratePaint}/hr`, 'graphics', 'paint_lab', { time: graphicPaintSetup });
        L(`Graphic Paint Finish Coat`, (graphicPaintFin / 60) * ratePaint, `${graphicPaintSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Paint_Finish_SqFt || 0.75)} Mins/SF * $${ratePaint}/hr`, 'graphics', 'paint_lab', { time: graphicPaintFin });
        L(`Graphic Paint Material`, graphicPaintSqFt * costPaintUnit * wastePct, `${graphicPaintSqFt.toFixed(1)} SF * $${costPaintUnit.toFixed(2)}/SF * ${wastePct} Waste`, 'graphics', 'paint_mat');
    }

    // --- TOTALS & MARGINS ---
    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;
    const targetMargin = parseFloat(data.Target_Margin_Pct || 0.60);
    const overrideSales = parseFloat(data.Override_Retail_Total || 0);
    const minOrder = parseFloat(data.Retail_Min_Order || 150);

    let grandTotalRaw = overrideSales > 0 ? overrideSales : (totalCost / (1 - targetMargin));
    let grandTotal = Math.max(grandTotalRaw, minOrder);
    let isMinApplied = grandTotalRaw < minOrder;

    const lineItems = [
        { label: 'Structural Posts & Concrete', unit: cst.filter(i => i.cB === 'struct_mat' || i.cB === 'concrete').reduce((s,i)=>s+i.total,0) / inputs.qty },
        { label: 'Fabrication Labor', unit: cst.filter(i => i.cB === 'struct_lab').reduce((s,i)=>s+i.total,0) / inputs.qty },
        { label: 'Face Substrates', unit: cst.filter(i => i.cB === 'faces').reduce((s,i)=>s+i.total,0) / inputs.qty },
        { label: 'Graphics & Paint', unit: cst.filter(i => i.cB === 'graphics' || i.cB.includes('paint')).reduce((s,i)=>s+i.total,0) / inputs.qty },
        { label: `Risk Buffer (${((riskFactor-1)*100).toFixed(0)}%)`, unit: (totalCost - hardCostRaw) / inputs.qty }
    ];

    const retBreakdown = [
        { label: `Market Value (${(targetMargin*100).toFixed(1)}% Profit Margin)`, total: grandTotalRaw, formula: `Total Hard Cost / (1 - 0.${(targetMargin*100).toFixed(0)})` }
    ];
    if (isMinApplied) retBreakdown.push({ label: 'Shop Minimum Surcharge', total: minOrder - grandTotalRaw, formula: 'Minimum order difference' });

    const geometry = {
        postSpacing: inputs.postSpacing, cutList: fDesc, holeD: holeDiamInches,
        above: panelAboveInches, under: inputs.belowGrade, clearance: inputs.clearance, 
        postAbove: postAboveInches, maxAbove: maxAboveInches, totalPanelH: totalPanelH, panels: inputs.panels,
        overallW: overallW, hasConcrete: inputs.hasConcrete, post: postSizeInches
    };

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: retBreakdown, lineItems: lineItems, isMinApplied: isMinApplied },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: targetMargin },
        geom: geometry,
        activeKeys: activeKeys
    };
}

// Sandbox Config mapping
window.POSTPANEL_CONFIG = {
    tab: 'PROD_Post_Panel',
    engine: calculatePostPanel,
    retails: [
        { key: 'Target_Margin_Pct', label: 'Target Margin (%)' },
        { key: 'Retail_Min_Order', label: 'Shop Minimum ($)' },
        { key: 'Override_Retail_Total', label: 'Manual Price Override ($)' }
    ],
    costs: [
        { key: 'Cost_Stock_063_4x8', label: '.063 Alum Sheet ($)' },
        { key: 'Cost_Stock_040_4x8', label: '.040 Alum Sheet ($)' },
        { key: 'Cost_Stock_080_4x8', label: '.080 Alum Sheet ($)' },
        { key: 'Cost_Stock_3mm_4x8', label: '3mm ACM Sheet ($)' },
        { key: 'Cost_Stock_6mm_4x8', label: '6mm ACM Sheet ($)' },
        { key: 'Cost_Concrete_Bag', label: 'Concrete Bag ($)' },
        { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Operator', label: 'Operator Labor ($/Hr)' },
        { key: 'Rate_Paint_Labor', label: 'Paint Labor ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'CNC Machine ($/Hr)' },
        { key: 'Rate_CNC_Labor', label: 'CNC Operator ($/Hr)' },
        { key: 'Cost_Paint_SqFt', label: 'Paint & Finishes ($/SF)' },
        { key: 'Cost_Vin_Cast', label: 'Print Vinyl ($/SF)' },
        { key: 'Cost_Lam_Cast', label: 'Laminate ($/SF)' },
        { key: 'Waste_Factor', label: 'Waste Buffer (1.x)' },
        { key: 'Factor_Risk', label: 'Risk Buffer (1.x)' }
    ]
};