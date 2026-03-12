/**
 * PURE PHYSICS ENGINE: Post & Panel Signs (v3.0 - STRICT MODE)
 * Features: ZERO Hardcoded Fallbacks. Granular Tasks & True Shop Times.
 */

function calculatePostPanel(inputs, data) {
    const cst = [];

    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    const V = (k) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    
    const L = (label, total, formula, rB, cB, meta={}) => { 
        if(total > 0) cst.push({label, total, formula, rB, cB, meta}); 
        return total; 
    };

    // --- 1. CORE DIMENSIONS & YIELD ---
    const panelSqFt = (inputs.w * inputs.h) / 144;
    const aboveGroundFt = inputs.aboveGrade / 12;
    const undergroundFt = inputs.belowGrade / 12;
    const totalPostFt = aboveGroundFt + undergroundFt;
    const totalPoleLF = totalPostFt * 2;

    const profileParts = inputs.postProfile.split('_');
    const postSizeInches = parseFloat(profileParts) || 3;
    const postWall = profileParts || '1/8"';

    let overallW = inputs.w;
    let postInset = 0;
    if (inputs.mountStyle === 'Between') {
        overallW = inputs.w + (postSizeInches * 2);
    } else {
        postInset = parseFloat(inputs.postInset) || 0;
    }

    // STRICT MODE: If missing, defaults to 1 (0% buffer) to avoid NaN crashes
    const wastePct = parseFloat(data.Waste_Factor) || 1;
    const riskFactor = parseFloat(data.Factor_Risk) || 1;

    // --- 2. POSTS & CONCRETE ---
    const postKey = `Cost_Post_${inputs.postType}_${inputs.postProfile}`;
    let postCostLF = parseFloat(data[postKey]) || 0;
    
    let postRaw = totalPoleLF * postCostLF;
    let postTotal = postRaw * wastePct;
    L(`Structural Posts (${inputs.postType} ${postSizeInches}" x ${postWall})`, postTotal, `${totalPoleLF.toFixed(1)} LF * $${postCostLF.toFixed(2)}/LF [${V(postKey)}] * Waste`, 'posts', 'struct_mat', { waste: postTotal - postRaw });

    let baseCap = parseFloat(data.Cost_Post_Cap) || 0;
    let capCost = baseCap * (postSizeInches / 3);
    L(`Post Caps (${postSizeInches}")`, 2 * capCost, `2 Caps * $${capCost.toFixed(2)}/ea (Scaled from ${V('Cost_Post_Cap')})`, 'posts', 'struct_mat');

    let holeDiamInches = Math.max(6, postSizeInches * 3);
    if (inputs.hasConcrete) {
        const footerHeightFt = undergroundFt * 0.66;
        const holeRadiusFt = (holeDiamInches / 2) / 12;
        const holeVolumeCuFt = Math.PI * Math.pow(holeRadiusFt, 2) * footerHeightFt;
        const concreteYield = parseFloat(data.Yield_Concrete_Bag_CuFt) || 1;
        const bagsNeeded = Math.ceil((holeVolumeCuFt * 2) / concreteYield);
        const bagCost = parseFloat(data.Cost_Concrete_Bag) || 0;
        L(`Concrete Tap Footers (80lb Bags)`, bagsNeeded * bagCost, `${bagsNeeded} Bags (${concreteYield} CuFt Yield [${V('Yield_Concrete_Bag_CuFt')}]) * $${bagCost.toFixed(2)}/bag [${V('Cost_Concrete_Bag')}]`, 'concrete', 'concrete');
    }

    // --- 3. INTERNAL SKELETON (FRAME & BRACING) ---
    const perimeterLF = ((inputs.w * 2) + (inputs.h * 2)) / 12;
    let braces = (inputs.w > 48 && inputs.h > 24) ? Math.floor((inputs.w - 1) / 48) : 0;
    const frameMult = (inputs.mountStyle === 'Flush' && inputs.sides === 2) ? 2 : 1;
    const totalFrameLF = (perimeterLF + (braces * (inputs.h / 12))) * frameMult;

    const frameKey = `Cost_Frame_${inputs.frameMat}`;
    const activeFrameCost = parseFloat(data[frameKey]) || 0;
    
    const fDesc = inputs.frameMat.replace(/_/g, ' ');
    const fParts = inputs.frameMat.split('_');
    const fThick = parseFloat(fParts) || 2; 

    let frameRaw = totalFrameLF * activeFrameCost;
    let frameTotal = frameRaw * wastePct;
    L(`Internal Skeleton (${fDesc})`, frameTotal, `${totalFrameLF.toFixed(1)} LF * $${activeFrameCost.toFixed(2)}/LF [${V(frameKey)}] * Waste`, 'frame', 'struct_mat', { waste: frameTotal - frameRaw });

    // --- 4. FABRICATION LABOR & ADHESIVE ---
    const rateShop = parseFloat(data.Rate_Shop_Labor) || 0;
    
    let gatherMins = parseFloat(data.Time_Gather_Mats) || 0;
    L(`Gather Materials`, (gatherMins / 60) * rateShop, `${gatherMins} Mins [${V('Time_Gather_Mats')}] * $${rateShop}/hr [${V('Rate_Shop_Labor')}]`, 'finish', 'struct_lab', { time: gatherMins });

    const isMiterPost = inputs.postType === 'Aluminum' && postSizeInches <= 4;
    const isMiterFrame = inputs.frameMat.includes('Alum') && fThick <= 4;
    
    const timeMiter = parseFloat(data.Time_Saw_Miter) || 0;
    const timeBand = parseFloat(data.Time_Saw_Band) || 0;
    
    const postSawMins = 2 * (isMiterPost ? timeMiter : timeBand);
    const postSawName = isMiterPost ? "Miter Saw" : "Band Saw";
    L(`Post Cuts (${postSawName})`, (postSawMins / 60) * rateShop, `2 Cuts * ${(postSawMins/2)} Mins * $${rateShop}/hr [${V('Rate_Shop_Labor')}]`, 'finish', 'struct_lab', { time: postSawMins });

    const frameCuts = (4 * frameMult) + (braces * frameMult);
    const frameSawMins = frameCuts * (isMiterFrame ? timeMiter : timeBand);
    const frameSawName = isMiterFrame ? "Miter Saw" : "Band Saw";
    L(`Frame Cuts (${frameSawName})`, (frameSawMins / 60) * rateShop, `${frameCuts} Cuts * ${(frameSawMins/frameCuts)} Mins * $${rateShop}/hr [${V('Rate_Shop_Labor')}]`, 'finish', 'struct_lab', { time: frameSawMins });

    const weldLocs = (4 + (braces * 2)) * frameMult;
    const timeWeldLoc = parseFloat(data.Time_Weld_Per_Loc) || 0;
    const timeCleanLoc = parseFloat(data.Time_Clean_Weld_Loc) || 0;
    
    L(`Tack Welding`, ((weldLocs * timeWeldLoc) / 60) * rateShop, `${weldLocs} Locs * ${timeWeldLoc} Mins [${V('Time_Weld_Per_Loc')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: weldLocs * timeWeldLoc });
    L(`Weld Cleaning & Grinding`, ((weldLocs * timeCleanLoc) / 60) * rateShop, `${weldLocs} Locs * ${timeCleanLoc} Mins [${V('Time_Clean_Weld_Loc')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: weldLocs * timeCleanLoc });

    const adhYield = parseFloat(data.Yield_Adhesive_Tube_LF) || 1;
    const adhCost = parseFloat(data.Cost_Adhesive_Tube) || 0;
    const cartridges = Math.ceil(totalFrameLF / adhYield);
    L(`Lord's Adhesive (Metal Glue)`, cartridges * adhCost, `${cartridges} Cartridges (${adhYield} LF [${V('Yield_Adhesive_Tube_LF')}]) * $${adhCost.toFixed(2)}/ea [${V('Cost_Adhesive_Tube')}]`, 'finish', 'struct_mat');

    let adhMins = inputs.sides * (parseFloat(data.Time_Adhesive_Per_Face) || 0);
    L(`Adhesive Application`, (adhMins / 60) * rateShop, `${inputs.sides} Sides * ${parseFloat(data.Time_Adhesive_Per_Face)||0} Mins/Face [${V('Time_Adhesive_Per_Face')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: adhMins });

    // --- 5. FACE SUBSTRATE ---
    const multDS = inputs.sides === 2 ? 2 : 1;
    let subCost = 0, physThick = 0.063, subKey = 'Cost_Stock_063_4x8';
    
    if (inputs.faceMat === '040 Alum') { subCost = parseFloat(data.Cost_Stock_040_4x8) || 0; subCost /= 32; physThick = 0.040; subKey = 'Cost_Stock_040_4x8'; }
    else if (inputs.faceMat === '063 Alum') { subCost = parseFloat(data.Cost_Stock_063_4x8) || 0; subCost /= 32; physThick = 0.063; subKey = 'Cost_Stock_063_4x8'; }
    else if (inputs.faceMat === '080 Alum') { subCost = parseFloat(data.Cost_Stock_080_4x8) || 0; subCost /= 32; physThick = 0.080; subKey = 'Cost_Stock_080_4x8'; }
    else if (inputs.faceMat === '3mm ACM') { subCost = parseFloat(data.Cost_Stock_3mm_4x8) || 0; subCost /= 32; physThick = 0.118; subKey = 'Cost_Stock_3mm_4x8'; }
    else if (inputs.faceMat === '6mm ACM') { subCost = parseFloat(data.Cost_Stock_6mm_4x8) || 0; subCost /= 32; physThick = 0.236; subKey = 'Cost_Stock_6mm_4x8'; }

    let faceRaw = panelSqFt * subCost * multDS;
    let faceTotal = faceRaw * wastePct;
    L(`Face Substrate (${inputs.faceMat})`, faceTotal, `${panelSqFt.toFixed(1)} SF * $${(subCost).toFixed(2)}/SF [${V(subKey)}] * ${multDS} Sides * Waste`, 'faces', 'struct_mat', { waste: faceTotal - faceRaw });

    if (inputs.isCNC) {
        let cncSetup = parseFloat(data.Time_Setup_CNC) || 0;
        let cncRun = panelSqFt * multDS * (parseFloat(data.Time_CNC_Easy_SqFt) || 0);
        L(`CNC Router Setup`, (cncSetup / 60) * (parseFloat(data.Rate_CNC_Labor) || 0), `${cncSetup} Mins Setup * $${parseFloat(data.Rate_CNC_Labor)||0}/hr [${V('Rate_CNC_Labor')}]`, 'faces', 'struct_lab', { time: cncSetup });
        L(`CNC Machine Run`, (cncRun / 60) * (parseFloat(data.Rate_Machine_CNC) || 0), `${panelSqFt.toFixed(1)} SF * ${parseFloat(data.Time_CNC_Easy_SqFt)||0} Mins/SF * $${parseFloat(data.Rate_Machine_CNC)||0}/hr [${V('Rate_Machine_CNC')}]`, 'faces', 'struct_lab', { time: cncRun });
    } else {
        let shearRun = (inputs.qty * 4 * multDS) * (parseFloat(data.Time_Shear_Cut) || 0);
        L(`Shear Per-Cut Run`, (shearRun / 60) * rateShop, `${inputs.qty * 4 * multDS} Cuts * ${parseFloat(data.Time_Shear_Cut)||0} Mins/Cut [${V('Time_Shear_Cut')}] * $${rateShop}/hr`, 'faces', 'struct_lab', { time: shearRun });
    }

    // --- 6. GRAPHICS & PAINT ---
    const rateOp = parseFloat(data.Rate_Operator) || 0;
    const machPrint = parseFloat(data.Rate_Machine_Print) || 0;
    const inkCost = parseFloat(data.Cost_Ink_Latex) || 0;
    
    let setupJob = parseFloat(data.Time_Setup_Job) || 0;
    L(`Job Setup (File RIP)`, (setupJob / 60) * rateOp, `${setupJob} Mins [${V('Time_Setup_Job')}] * $${rateOp}/hr [${V('Rate_Operator')}]`, 'graphics', 'graphics', { time: setupJob });

    if (inputs.paintFace) {
        const vinylCost = parseFloat(data.Cost_Vin_Cast) || 0;
        const tapeCost = parseFloat(data.Cost_Transfer_Tape) || 0;
        
        let graphRaw = panelSqFt * (vinylCost + inkCost) * multDS;
        L(`Contour Cut Vinyl & Ink`, graphRaw * wastePct, `SF * (Media + Ink) * Sides * Waste`, 'graphics', 'graphics', { waste: (graphRaw * wastePct) - graphRaw });
        
        let tapeRaw = panelSqFt * tapeCost * multDS;
        L(`Transfer Tape (Masking)`, tapeRaw * wastePct, `SF * Tape * Sides * Waste`, 'graphics', 'graphics', { waste: (tapeRaw * wastePct) - tapeRaw });

        let speedPrt = parseFloat(data.Speed_Print_Roll) || 1;
        let printHrs = (panelSqFt / speedPrt) * multDS;
        L(`Print Machine Run`, printHrs * machPrint, `(SF / ${speedPrt} SF/hr [${V('Speed_Print_Roll')}]) * $${machPrint}/hr [${V('Rate_Machine_Print')}]`, 'graphics', 'graphics', { time: printHrs * 60 });
        
        let weedMins = panelSqFt * multDS * (parseFloat(data.Time_Weed_Simple) || 0);
        L(`Weeding Labor`, (weedMins / 60) * rateShop, `${panelSqFt.toFixed(1)} SF * ${multDS} Sides * ${parseFloat(data.Time_Weed_Simple)||0} Mins/SF [${V('Time_Weed_Simple')}] * $${rateShop}/hr`, 'graphics', 'graphics', { time: weedMins });

        let maskMins = panelSqFt * multDS * (parseFloat(data.Time_Mask_SqFt) || 0);
        L(`Masking Labor`, (maskMins / 60) * rateShop, `${panelSqFt.toFixed(1)} SF * ${multDS} Sides * ${parseFloat(data.Time_Mask_SqFt)||0} Mins/SF [${V('Time_Mask_SqFt')}] * $${rateShop}/hr`, 'graphics', 'graphics', { time: maskMins });
    } else {
        const vinylCost = parseFloat(data.Cost_Vin_Cast) || 0;
        const lamCost = parseFloat(data.Cost_Lam_Cast) || 0;

        let flatRaw = panelSqFt * (vinylCost + inkCost) * multDS;
        L(`Printed Vinyl & Ink`, flatRaw * wastePct, `SF * (Media + Ink) * Sides * Waste`, 'graphics', 'graphics', { waste: (flatRaw * wastePct) - flatRaw });

        let lamRaw = panelSqFt * lamCost * multDS;
        L(`Overlaminate Media`, lamRaw * wastePct, `SF * Lam * Sides * Waste`, 'graphics', 'graphics', { waste: (lamRaw * wastePct) - lamRaw });

        let speedPrt = parseFloat(data.Speed_Print_Roll) || 1;
        let printHrs = (panelSqFt / speedPrt) * multDS;
        L(`Print Machine Run`, printHrs * machPrint, `(SF / ${speedPrt} SF/hr [${V('Speed_Print_Roll')}]) * $${machPrint}/hr [${V('Rate_Machine_Print')}]`, 'graphics', 'graphics', { time: printHrs * 60 });

        let mountMins = panelSqFt * multDS * (parseFloat(data.Time_Mount_Flat_SqFt) || 0);
        L(`Vinyl Mount Labor`, (mountMins / 60) * rateShop, `${panelSqFt.toFixed(1)} SF * ${multDS} Sides * ${parseFloat(data.Time_Mount_Flat_SqFt)||0} Mins/SF [${V('Time_Mount_Flat_SqFt')}] * $${rateShop}/hr`, 'graphics', 'graphics', { time: mountMins });
    }

    // --- 7. PAINTING THE STRUCTURE ---
    const postSurfaceArea = (postSizeInches / 12) * 4 * totalPoleLF;
    const paintSqFt = inputs.paintFace ? (panelSqFt * multDS) + postSurfaceArea : postSurfaceArea;
    const ratePaint = parseFloat(data.Rate_Paint_Labor) || 0;

    let sandMins = paintSqFt * (parseFloat(data.Time_Sand_SqFt) || 0);
    L(`Paint Prep & Sanding`, (sandMins / 60) * rateShop, `${paintSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Sand_SqFt)||0} Mins/SF [${V('Time_Sand_SqFt')}] * $${rateShop}/hr`, 'finish', 'struct_lab', { time: sandMins });

    let paintSetup = parseFloat(data.Time_Paint_Setup) || 0;
    L(`Paint Mix & Setup`, (paintSetup / 60) * ratePaint, `${paintSetup} Mins [${V('Time_Paint_Setup')}] * $${ratePaint}/hr [${V('Rate_Paint_Labor')}]`, 'finish', 'paint', { time: paintSetup });

    let primeMins = paintSqFt * (parseFloat(data.Time_Paint_Primer_SqFt) || 0);
    L(`Primer Spray Labor`, (primeMins / 60) * ratePaint, `${paintSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Paint_Primer_SqFt)||0} Mins/SF [${V('Time_Paint_Primer_SqFt')}] * $${ratePaint}/hr`, 'finish', 'paint', { time: primeMins });

    let finishMins = paintSqFt * (parseFloat(data.Time_Paint_Finish_SqFt) || 0);
    L(`Finish Coat Spray Labor`, (finishMins / 60) * ratePaint, `${paintSqFt.toFixed(1)} SF * ${parseFloat(data.Time_Paint_Finish_SqFt)||0} Mins/SF [${V('Time_Paint_Finish_SqFt')}] * $${ratePaint}/hr`, 'finish', 'paint', { time: finishMins });

    const costPaintSqFt = parseFloat(data.Cost_Paint_SqFt) || 0;
    L(`Paint Materials (Primer/Fin)`, paintSqFt * costPaintSqFt, `${paintSqFt.toFixed(1)} SF * $${costPaintSqFt.toFixed(2)}/SF [${V('Cost_Paint_SqFt')}]`, 'finish', 'paint');

    // --- TOTALS & RETAIL EXHAUST ---
    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;

    let targetMargin = parseFloat(data.Target_Margin_Pct) || 0;
    let grandTotalRaw = 0;

    if (data.Override_Retail_Total && parseFloat(data.Override_Retail_Total) > 0) {
        grandTotalRaw = parseFloat(data.Override_Retail_Total);
        targetMargin = (grandTotalRaw - totalCost) / grandTotalRaw; 
    } else {
        if(targetMargin >= 1) targetMargin = 0.99;
        grandTotalRaw = totalCost / (1 - targetMargin);
    }
    
    const minOrder = parseFloat(data.Retail_Min_Order) || 0;
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    const isMinApplied = grandTotalRaw < minOrder;

    const bucketTotals = { posts: 0, frame: 0, faces: 0, graphics: 0, finish: 0, concrete: 0 };
    const multiplier = totalCost > 0 ? (grandTotalRaw / totalCost) : 1; 
    cst.forEach(i => { if(bucketTotals[i.rB] !== undefined) { bucketTotals[i.rB] += (i.total * riskFactor * multiplier); } });

    const lineItems = [
        { label: 'Structural Posts', unit: bucketTotals.posts },
        { label: 'Internal Frame', unit: bucketTotals.frame },
        { label: 'Faces & Substrates', unit: bucketTotals.faces },
        { label: 'Graphics & Applications', unit: bucketTotals.graphics },
        { label: 'Assembly & Painting', unit: bucketTotals.finish },
        { label: 'Concrete Footings', unit: bucketTotals.concrete }
    ];

    const retBreakdown = [
        { label: `Market Value (${(targetMargin*100).toFixed(1)}% Profit Margin)`, total: grandTotalRaw, formula: `Total Hard Cost / (1 - ${(targetMargin).toFixed(2)})` }
    ];
    if (isMinApplied) retBreakdown.push({ label: 'Shop Minimum Surcharge', total: minOrder - grandTotalRaw, formula: 'Minimum order difference' });

    const geometry = {
        w: inputs.w, h: inputs.h, post: postSizeInches, holeD: holeDiamInches,
        clearance: inputs.clearance, mount: inputs.mountStyle, hasConcrete: inputs.hasConcrete,
        inset: postInset, above: inputs.aboveGrade, under: inputs.belowGrade,
        overallW: overallW, sides: inputs.sides, frameThick: fThick, faceThick: physThick, braces: braces
    };

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: retBreakdown, lineItems: lineItems, isMinApplied: isMinApplied },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: targetMargin }, 
        geom: geometry,
        activeKeys: [postKey, frameKey, subKey]
    };
}

// --- SANDBOX CONFIGURATION (GROUPED HEADERS) ---
// Notice the Target Margin and Override Total fields are removed from here because they now live directly in the Interactive UI component!
window.POSTPANEL_CONFIG = {
    tab: 'PROD_Post_Panel',
    engine: calculatePostPanel,
    retails: [
        { key: 'Retail_Min_Order', label: 'Shop Minimum ($)' }
    ],
    costs: [
        { heading: 'Labor & Machine Rates', key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Operator', label: 'Print Op ($/Hr)' },
        { key: 'Rate_Machine_Print', label: 'Print Mach ($/Hr)' },
        { key: 'Rate_Paint_Labor', label: 'Paint Labor ($/Hr)' },
        { key: 'Rate_CNC_Labor', label: 'CNC Op ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'CNC Mach ($/Hr)' },

        { heading: 'Materials & Consumables', key: 'Cost_Concrete_Bag', label: 'Concrete ($/Bag)' },
        { key: 'Yield_Concrete_Bag_CuFt', label: 'Concrete Yld (CuFt)' },
        { key: 'Cost_Post_Cap', label: 'Post Cap ($/Ea)' },
        { key: 'Cost_Adhesive_Tube', label: 'Adhesive ($/Tube)' },
        { key: 'Yield_Adhesive_Tube_LF', label: 'Adhesive Yld (LF)' },
        { key: 'Cost_Paint_SqFt', label: 'Paint Mat ($/SF)' },
        { key: 'Cost_Vin_Cast', label: 'Cast Vinyl ($/SqFt)' },
        { key: 'Cost_Lam_Cast', label: 'Cast Lam ($/SqFt)' },
        { key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },
        { key: 'Cost_Transfer_Tape', label: 'Transfer Tape ($/SqFt)' },

        { heading: 'Time Estimates (Speed & Setup)', key: 'Speed_Print_Roll', label: 'Print Speed (SF/Hr)' },
        { key: 'Time_Setup_Job', label: 'File Setup (Mins)' },
        { key: 'Time_Gather_Mats', label: 'Gather Mats (Mins)' },
        { key: 'Time_Setup_CNC', label: 'CNC Setup (Mins)' },
        { key: 'Time_CNC_Easy_SqFt', label: 'CNC Easy (Mins/SF)' },

        { heading: 'Fabrication & Finishing Time', key: 'Time_Saw_Miter', label: 'Miter Saw Cut (Mins/Ea)' },
        { key: 'Time_Saw_Band', label: 'Band Saw Cut (Mins/Ea)' },
        { key: 'Time_Shear_Cut', label: 'Shear Cut (Mins/Ea)' },
        { key: 'Time_Weld_Per_Loc', label: 'Weld (Mins/Loc)' },
        { key: 'Time_Clean_Weld_Loc', label: 'Grind (Mins/Loc)' },
        { key: 'Time_Adhesive_Per_Face', label: 'Apply Glue (Mins/Face)' },
        { key: 'Time_Mount_Flat_SqFt', label: 'Mount Vinyl (Mins/SF)' },
        { key: 'Time_Weed_Simple', label: 'Weed Simple (Mins/SF)' },
        { key: 'Time_Mask_SqFt', label: 'Masking (Mins/SF)' },
        { key: 'Time_Sand_SqFt', label: 'Sanding (Mins/SF)' },
        { key: 'Time_Paint_Setup', label: 'Paint Mix (Mins)' },
        { key: 'Time_Paint_Prep_SqFt', label: 'Paint Prep (Mins/SF)' },
        { key: 'Time_Paint_Primer_SqFt', label: 'Prime Spray (Mins/SF)' },
        { key: 'Time_Paint_Finish_SqFt', label: 'Paint Finish (Mins/SF)' },

        { heading: 'Safety Buffers', key: 'Waste_Factor', label: 'Waste Buffer (1.x)' },
        { key: 'Factor_Risk', label: 'Risk Buffer (1.x)' }
    ]
};