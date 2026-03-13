/**
 * PURE PHYSICS ENGINE: Post & Panel Signs (v3.1)
 * Features: Narrow Panel Processing, Cut List Generation, Structural Collision Detection
 */

function calculatePostPanel(inputs, data) {
    const cst = [];
    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    const V = (k) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    const L = (label, total, formula, rB, cB, meta={}) => {
        if(total > 0) cst.push({label, total, formula, rB, cB, meta});
        return total;
    };

    // --- 1. CORE DIMENSIONS & POSTS ---
    const aboveGroundFt = inputs.aboveGrade / 12;
    const undergroundFt = inputs.belowGrade / 12;
    const totalPostFt = aboveGroundFt + undergroundFt;
    const totalPoleLF = totalPostFt * 2 * inputs.qty;

    const profileParts = inputs.postProfile.split('_');
    const postSizeInches = parseFloat(profileParts) || 3;
    const postWall = profileParts || '1/8"';

    const frameParts = inputs.frameMat.split('_');
    const fThick = parseFloat(frameParts) || 2; 

    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    // --- 2. MULTI-PANEL YIELD & FRAME PIECE TRACKING ---
    let totalPanelSqFt = 0;
    let totalFrameLF = 0;
    let totalFrameCuts = 0;
    let maxOverallW = inputs.postSpacing;
    let totalPanelH = 0;
    let frameCutDesc = [];

    inputs.panels.forEach((p, idx) => {
        let pSqFt = (p.w * p.h) / 144;
        let multDS = p.sides === 2 ? 2 : 1;
        totalPanelSqFt += (pSqFt * multDS);
        totalPanelH += p.h + (idx === 0 ? 0 : p.gap);

        let OD = inputs.postSpacing + (postSizeInches * 2);
        let pOverallW = p.mountStyle === 'Between' ? OD : p.w;
        if (pOverallW > maxOverallW) maxOverallW = pOverallW;

        let pW_Inside = p.mountStyle === 'Between' ? inputs.postSpacing : p.w;
        let isFlushSealed = p.mountStyle === 'Flush' && Math.abs(p.w - OD) < 0.01;

        let pLF = 0;
        let pCuts = 0;
        let pDesc = [];

        if (p.mountStyle === 'Between') {
            pLF += (pW_Inside * 2) / 12;
            pLF += (p.h * 2) / 12;
            pCuts += 4;
            pDesc.push(`(x2) ${pW_Inside}" Horizontals`, `(x2) ${p.h}" Verticals`);
        } else {
            if (isFlushSealed) {
                pLF += p.w / 12;
                pLF += inputs.postSpacing / 12;
                pCuts += 2;
                pDesc.push(`(x1) ${p.w}" Top`, `(x1) ${inputs.postSpacing}" Bot Center`);
            } else if (p.w <= inputs.postSpacing) {
                // If panel is narrower than the posts, the frame horizontally spans the posts entirely!
                pLF += (inputs.postSpacing * 2) / 12; 
                pLF += (p.h * 2) / 12; 
                pCuts += 4;
                pDesc.push(`(x2) ${inputs.postSpacing}" Horizontals`, `(x2) ${p.h}" Verticals`);
            } else {
                pLF += p.w / 12;
                pLF += (p.h * 2) / 12;
                pLF += inputs.postSpacing / 12;
                let wingW = (p.w - OD) / 2;
                pLF += (wingW * 2) / 12;
                pCuts += 6;
                pDesc.push(`(x1) ${p.w}" Top`, `(x2) ${p.h}" Verts`, `(x1) ${inputs.postSpacing}" Bot Center`, `(x2) ${wingW}" Bot Wings`);
            }
        }

        let fMult = (p.sides === 2 && p.mountStyle === 'Flush') ? 2 : 1;
        totalFrameLF += (pLF * fMult) * inputs.qty;
        totalFrameCuts += (pCuts * fMult) * inputs.qty;
        
        if (fMult === 2) pDesc.push(`[Qty x2 for Dual-Frame DS]`);
        frameCutDesc.push(`Panel ${idx+1}: ` + pDesc.join(', '));
    });

    const FALLBACK_METALS = {
        'Cost_Post_Aluminum_2_1/8': 4.28, 'Cost_Post_Aluminum_3_1/8': 6.56, 'Cost_Post_Aluminum_4_1/8': 8.84, 'Cost_Post_Aluminum_6_1/4': 26.22,
        'Cost_Post_Steel_3_1/8': 3.88, 'Cost_Post_Steel_3_3/16': 5.85, 'Cost_Post_Steel_4_3/16': 9.25, 'Cost_Post_Steel_6_3/16': 13.85, 'Cost_Post_Steel_6_1/4': 18.75, 'Cost_Post_Steel_8_3/16': 21.60, 'Cost_Post_Steel_8_1/4': 24.25, 'Cost_Post_Steel_10_1/4': 27.75, 'Cost_Post_Steel_12_1/4': 33.55,
        'Cost_Frame_AlumTube_2_1/8': 4.28, 'Cost_Frame_AlumTube_3_1/8': 6.56, 'Cost_Frame_AlumTube_4_1/8': 8.84, 'Cost_Frame_AlumTube_6_1/4': 26.22,
        'Cost_Frame_SteelTube_3_1/8': 3.88, 'Cost_Frame_SteelTube_3_3/16': 5.85, 'Cost_Frame_SteelTube_4_3/16': 9.25, 'Cost_Frame_SteelTube_6_3/16': 13.85, 'Cost_Frame_SteelTube_6_1/4': 18.75, 'Cost_Frame_SteelTube_8_3/16': 21.60, 'Cost_Frame_SteelTube_8_1/4': 24.25, 'Cost_Frame_SteelTube_10_1/4': 27.75, 'Cost_Frame_SteelTube_12_1/4': 33.55,
        'Cost_Frame_AlumAngle_1.5_1/8': 1.15, 'Cost_Frame_AlumAngle_2_1/8': 1.45, 'Cost_Frame_SteelAngle_1.5_1/8': 1.15, 'Cost_Frame_SteelAngle_2_1/8': 1.45, 'Cost_Frame_SteelAngle_2_3/16': 1.85, 'Cost_Frame_SteelAngle_2_1/4': 2.15
    };

    const postKey = `Cost_Post_${inputs.postType}_${inputs.postProfile}`;
    if(!data[postKey]) data[postKey] = FALLBACK_METALS[postKey] || 6.56;
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

    const frameKey = `Cost_Frame_${inputs.frameMat}`;
    if(!data[frameKey]) data[frameKey] = FALLBACK_METALS[frameKey] || 1.45;
    const frameCostLF = parseFloat(data[frameKey]);
    
    let frameRaw = totalFrameLF * frameCostLF;
    let frameTotal = frameRaw * wastePct;
    L(`Internal Frame (${inputs.frameMat.split('_')})`, frameTotal, `${totalFrameLF.toFixed(1)} LF * $${frameCostLF.toFixed(2)}/LF [${V(frameKey)}] * ${wastePct} Waste`, 'posts', 'struct_mat', { waste: frameTotal - frameRaw });

    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    let gatherMins = parseFloat(data.Time_Gather_Mats || 10) * inputs.qty;
    L(`Gather Materials`, (gatherMins / 60) * rateShop, `${gatherMins} Mins [${V('Time_Gather_Mats')}] * $${rateShop}/hr [${V('Rate_Shop_Labor')}]`, 'finish', 'struct_lab', { time: gatherMins });

    const isMiterPost = inputs.postType === 'Aluminum' && postSizeInches <= 4;
    const isMiterFrame = inputs.frameMat.includes('Alum') && fThick <= 4;
    const timeMiter = parseFloat(data.Time_Saw_Miter || 5);
    const timeBand = parseFloat(data.Time_Saw_Band || 10);
    
    const postSawMins = (2 * inputs.qty) * (isMiterPost ? timeMiter : timeBand);
    L(`Post Cuts (${isMiterPost ? "Miter Saw" : "Band Saw"})`, (postSawMins / 60) * rateShop, `${2 * inputs.qty} Cuts * ${(postSawMins/(2*inputs.qty))} Mins * $${rateShop}/hr [${V('Rate_Shop_Labor')}]`, 'finish', 'struct_lab', { time: postSawMins });

    const frameSawMins = totalFrameCuts * (isMiterFrame ? timeMiter : timeBand);
    L(`Frame Cuts (${isMiterFrame ? "Miter Saw" : "Band Saw"})`, (frameSawMins / 60) * rateShop, `${totalFrameCuts} Cuts * ${(isMiterFrame ? timeMiter : timeBand)} Mins * $${rateShop}/hr [${V('Rate_Shop_Labor')}]`, 'finish', 'struct_lab', { time: frameSawMins });

    const weldLocs = totalFrameCuts; 
    const timeWeldLoc = parseFloat(data.Time_Weld_Per_Loc || 1.5);
    const timeCleanLoc = parseFloat(data.Time_Clean_Weld_Loc || 0.33);
    L(`Tack Welding`, ((weldLocs * timeWeldLoc) / 60) * rateShop, `${weldLocs} Locs * ${timeWeldLoc} Mins [${V('Time_Weld_Per_Loc')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: weldLocs * timeWeldLoc });
    L(`Weld Cleaning & Grinding`, ((weldLocs * timeCleanLoc) / 60) * rateShop, `${weldLocs} Locs * ${timeCleanLoc} Mins [${V('Time_Clean_Weld_Loc')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: weldLocs * timeCleanLoc });

    const adhYield = parseFloat(data.Yield_Adhesive_Tube_LF || 10);
    const adhCost = parseFloat(data.Cost_Adhesive_Tube || 18.71);
    const cartridges = Math.ceil(totalFrameLF / adhYield);
    L(`Lord's Adhesive (Metal Glue)`, cartridges * adhCost, `${cartridges} Cartridges (Chunks of ${adhYield} LF [${V('Yield_Adhesive_Tube_LF')}]) * $${adhCost.toFixed(2)}/ea [${V('Cost_Adhesive_Tube')}]`, 'finish', 'struct_mat');

    let totalSides = 0;
    inputs.panels.forEach(p => { totalSides += p.sides * inputs.qty; });
    let adhMins = totalSides * parseFloat(data.Time_Adhesive_Per_Face || 7);
    L(`Adhesive Application`, (adhMins / 60) * rateShop, `${totalSides} Sides * ${parseFloat(data.Time_Adhesive_Per_Face || 7)} Mins/Face [${V('Time_Adhesive_Per_Face')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: adhMins });

    // --- 3. FACE SUBSTRATES ---
    const matCache = {};
    inputs.panels.forEach(p => {
        let subCost = 1.50, subKey = 'Cost_Stock_063_4x8';
        if (p.faceMat === '040 Alum') { subCost = parseFloat(data.Cost_Stock_040_4x8 || 84.44) / 32; subKey = 'Cost_Stock_040_4x8'; }
        else if (p.faceMat === '063 Alum') { subCost = parseFloat(data.Cost_Stock_063_4x8 || 98.12) / 32; subKey = 'Cost_Stock_063_4x8'; }
        else if (p.faceMat === '080 Alum') { subCost = parseFloat(data.Cost_Stock_080_4x8 || 124.57) / 32; subKey = 'Cost_Stock_080_4x8'; }
        else if (p.faceMat === '3mm ACM') { subCost = parseFloat(data.Cost_Stock_3mm_4x8 || 52.09) / 32; subKey = 'Cost_Stock_3mm_4x8'; }
        else if (p.faceMat === '6mm ACM') { subCost = parseFloat(data.Cost_Stock_6mm_4x8 || 72.10) / 32; subKey = 'Cost_Stock_6mm_4x8'; }

        let sqft = (p.w * p.h) / 144 * inputs.qty * (p.sides === 2 ? 2 : 1);
        if(!matCache[subKey]) matCache[subKey] = { name: p.faceMat, cost: subCost, sqft: 0, isCNC: false };
        matCache[subKey].sqft += sqft;
        if(p.isCNC) matCache[subKey].isCNC = true;
    });

    for(const [key, m] of Object.entries(matCache)) {
        let faceRaw = m.sqft * m.cost;
        let faceTotal = faceRaw * wastePct;
        L(`Face Substrate (${m.name})`, faceTotal, `${m.sqft.toFixed(1)} SF * $${m.cost.toFixed(2)}/SF [${V(key)}] * ${wastePct} Waste`, 'faces', 'struct_mat', { waste: faceTotal - faceRaw });
        
        if (m.isCNC) {
            let cncSetup = parseFloat(data.Time_Setup_CNC || 10) * inputs.qty;
            let cncRun = m.sqft * parseFloat(data.Time_CNC_Easy_SqFt || 1);
            L(`CNC Router Setup`, (cncSetup / 60) * parseFloat(data.Rate_CNC_Labor || 25), `${cncSetup} Mins Setup * $${parseFloat(data.Rate_CNC_Labor || 25)}/hr [${V('Rate_CNC_Labor')}]`, 'faces', 'struct_lab', { time: cncSetup });
            L(`CNC Machine Run`, (cncRun / 60) * parseFloat(data.Rate_Machine_CNC || 10), `${m.sqft.toFixed(1)} SF * ${parseFloat(data.Time_CNC_Easy_SqFt || 1)} Mins/SF * $${parseFloat(data.Rate_Machine_CNC || 10)}/hr [${V('Rate_Machine_CNC')}]`, 'faces', 'struct_lab', { time: cncRun });
        } else {
            let shearRun = (4 * inputs.qty) * parseFloat(data.Time_Shear_Cut || 0.35); 
            L(`Shear Per-Cut Run`, (shearRun / 60) * rateShop, `${4 * inputs.qty} Cuts * ${parseFloat(data.Time_Shear_Cut || 0.35)} Mins/Cut [${V('Time_Shear_Cut')}] * $${rateShop}/hr`, 'faces', 'struct_lab', { time: shearRun });
        }
    }

    // --- 4. GRAPHICS & PAINT ---
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const machPrint = parseFloat(data.Rate_Machine_Print || 5);
    
    let setupJob = parseFloat(data.Time_Setup_Job || 15) * inputs.qty;
    L(`Job Setup (File RIP)`, (setupJob / 60) * rateOp, `${setupJob} Mins [${V('Time_Setup_Job')}] * $${rateOp}/hr [${V('Rate_Operator')}]`, 'graphics', 'graphics', { time: setupJob });

    const vinylCost = parseFloat(data.Cost_Vin_Cast || 1.30);
    const inkCost = parseFloat(data.Cost_Ink_Latex || 0.16);

    let vinylRaw = totalPanelSqFt * vinylCost;
    let inkRaw = totalPanelSqFt * inkCost;
    
    L(`Cast Vinyl Media`, vinylRaw * wastePct, `${totalPanelSqFt.toFixed(1)} SF * $${vinylCost.toFixed(2)}/SF [${V('Cost_Vin_Cast')}] * ${wastePct} Waste`, 'graphics', 'graphics', { waste: (vinylRaw * wastePct) - vinylRaw });
    L(`Latex Ink`, inkRaw * wastePct, `${totalPanelSqFt.toFixed(1)} SF * $${inkCost.toFixed(2)}/SF [${V('Cost_Ink_Latex')}] * ${wastePct} Waste`, 'graphics', 'graphics', { waste: (inkRaw * wastePct) - inkRaw });

    let printHrs = (totalPanelSqFt / parseFloat(data.Speed_Print_Roll || 150));
    L(`Print Machine Run`, printHrs * machPrint, `${totalPanelSqFt.toFixed(1)} SF / ${parseFloat(data.Speed_Print_Roll || 150)} SF/hr [${V('Speed_Print_Roll')}] * $${machPrint}/hr [${V('Rate_Machine_Print')}]`, 'graphics', 'graphics', { time: printHrs * 60 });

    const postSurfaceArea = (postSizeInches / 12) * 4 * totalPoleLF;
    let totalPaintSqFt = postSurfaceArea;
    inputs.panels.forEach(p => {
        if(p.graphicMethod.includes('Paint')) totalPaintSqFt += ((p.w * p.h) / 144) * (p.sides === 2 ? 2 : 1) * inputs.qty;
    });

    if (totalPaintSqFt > postSurfaceArea) {
        const tapeCost = parseFloat(data.Cost_Transfer_Tape || 0.15);
        let tapeRaw = totalPanelSqFt * tapeCost;
        L(`Transfer Tape (Masking)`, tapeRaw * wastePct, `${totalPanelSqFt.toFixed(1)} SF * $${tapeCost.toFixed(2)}/SF [${V('Cost_Transfer_Tape')}] * ${wastePct} Waste`, 'graphics', 'graphics', { waste: (tapeRaw * wastePct) - tapeRaw });

        let weedMins = totalPanelSqFt * parseFloat(data.Time_Weed_Simple || 0.42);
        L(`Weeding Labor`, (weedMins / 60) * rateShop, `${totalPanelSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Weed_Simple || 0.42)} Mins/SF [${V('Time_Weed_Simple')}] * $${rateShop}/hr`, 'graphics', 'graphics', { time: weedMins });

        let maskMins = totalPanelSqFt * parseFloat(data.Time_Mask_SqFt || 0.17);
        L(`Masking Labor`, (maskMins / 60) * rateShop, `${totalPanelSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Mask_SqFt || 0.17)} Mins/SF [${V('Time_Mask_SqFt')}] * $${rateShop}/hr`, 'graphics', 'graphics', { time: maskMins });
    } else {
        const lamCost = parseFloat(data.Cost_Lam_Cast || 0.96);
        let lamRaw = totalPanelSqFt * lamCost;
        L(`Overlaminate Media`, lamRaw * wastePct, `${totalPanelSqFt.toFixed(1)} SF * $${lamCost.toFixed(2)}/SF [${V('Cost_Lam_Cast')}] * ${wastePct} Waste`, 'graphics', 'graphics', { waste: (lamRaw * wastePct) - lamRaw });

        let mountMins = totalPanelSqFt * parseFloat(data.Time_Mount_Flat_SqFt || 0.25);
        L(`Vinyl Mount Labor`, (mountMins / 60) * rateShop, `${totalPanelSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Mount_Flat_SqFt || 0.25)} Mins/SF [${V('Time_Mount_Flat_SqFt')}] * $${rateShop}/hr`, 'graphics', 'graphics', { time: mountMins });
    }

    const ratePaint = parseFloat(data.Rate_Paint_Labor || 30);
    const costPaintUnit = parseFloat(data.Cost_Paint_SqFt || 2.50);
    
    L(`Automotive Paint (Polyurethane)`, totalPaintSqFt * costPaintUnit * wastePct, `${totalPaintSqFt.toFixed(1)} SF * $${costPaintUnit.toFixed(2)}/SF [${V('Cost_Paint_SqFt')}] * ${wastePct} Waste`, 'finish', 'paint_mat', { waste: (totalPaintSqFt * costPaintUnit * wastePct) - (totalPaintSqFt * costPaintUnit) });

    let paintSetup = parseFloat(data.Time_Paint_Setup || 15) * inputs.qty;
    let paintPrep = totalPaintSqFt * parseFloat(data.Time_Paint_Prep_SqFt || 0.25);
    let paintPrime = totalPaintSqFt * parseFloat(data.Time_Paint_Primer_SqFt || 0.25);
    let paintFin = totalPaintSqFt * parseFloat(data.Time_Paint_Finish_SqFt || 0.75);
    
    L(`Paint Setup & Gun Clean`, (paintSetup / 60) * ratePaint, `${paintSetup} Mins [${V('Time_Paint_Setup')}] * $${ratePaint}/hr [${V('Rate_Paint_Labor')}]`, 'finish', 'paint_lab', { time: paintSetup });
    L(`Sanding & Prep`, (paintPrep / 60) * ratePaint, `${totalPaintSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Paint_Prep_SqFt || 0.25)} Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: paintPrep });
    L(`Primer Coat`, (paintPrime / 60) * ratePaint, `${totalPaintSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Paint_Primer_SqFt || 0.25)} Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: paintPrime });
    L(`Finish Coat (Color & Clear)`, (paintFin / 60) * ratePaint, `${totalPaintSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Paint_Finish_SqFt || 0.75)} Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: paintFin });

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
        panels: inputs.panels, postSpacing: inputs.postSpacing, post: postSizeInches, holeD: holeDiamInches,
        clearance: inputs.clearance, hasConcrete: inputs.hasConcrete,
        above: inputs.aboveGrade, under: inputs.belowGrade, totalPanelH: totalPanelH,
        overallW: maxOverallW, frameThick: fThick, cutList: frameCutDesc
    };

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: retBreakdown, lineItems: lineItems, isMinApplied: isMinApplied },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: targetMargin },
        geom: geometry,
        activeKeys: [postKey, frameKey]
    };
}
