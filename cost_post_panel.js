/**
 * PURE PHYSICS ENGINE: Post & Panel Signs (v7.0 - Architectural)
 * Features: True Cut-Piece Collision Detection, Miter vs Straight Math, Auto-Snapping.
 */

function calculatePostPanel(inputs, data) {
    const cst = [];

    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    
    const V = (k, fallback) => { 
        let val = data[k] !== undefined ? data[k] : fallback;
        if (!isNaN(val) && val % 1 !== 0) val = parseFloat(val).toFixed(2);
        return `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}=${val}]</span>`; 
    };
    
    const L = (label, total, formula, rB, cB, meta={}) => { 
        if(total > 0) cst.push({label, total, formula, rB, cB, meta}); 
        return total; 
    };

    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    // --- 1. CORE DIMENSIONS & CHASSIS ---
    const profileParts = inputs.postProfile.split('_');
    const postSizeInches = parseFloat(profileParts) || 3;
    
    let totalPanelH = 0;
    let maxOverallW = inputs.postSpacing + (postSizeInches * 2);

    const fParts = inputs.frameMat.split('_');
    const fThick = parseFloat(fParts[1]) || 2; 

    const physicalAboveGroundInches = inputs.aboveGrade - fThick; 
    const totalPostFt = (physicalAboveGroundInches + inputs.belowGrade) / 12;
    const totalPoleLF = totalPostFt * 2 * inputs.qty;

    const S_ID = inputs.postSpacing;
    const S_OD = S_ID + (2 * postSizeInches);

    // ==========================================
    // PHASE 1: CHASSIS MATERIALS
    // ==========================================
    const FALLBACK_METALS = {
        'Cost_Post_Aluminum_2_1/8': 4.28, 'Cost_Post_Aluminum_3_1/8': 6.56, 'Cost_Post_Aluminum_4_1/8': 8.84, 'Cost_Post_Aluminum_6_1/4': 26.22,
        'Cost_Post_Steel_3_1/8': 3.88, 'Cost_Post_Steel_3_3/16': 5.85, 'Cost_Post_Steel_4_3/16': 9.25, 'Cost_Post_Steel_6_3/16': 13.85, 'Cost_Post_Steel_6_1/4': 18.75, 'Cost_Post_Steel_8_3/16': 21.60, 'Cost_Post_Steel_8_1/4': 24.25, 'Cost_Post_Steel_10_1/4': 27.75, 'Cost_Post_Steel_12_1/4': 33.55,
        'Cost_Frame_AlumTube_2_1/8': 4.28, 'Cost_Frame_AlumTube_3_1/8': 6.56, 'Cost_Frame_AlumTube_4_1/8': 8.84, 'Cost_Frame_AlumTube_6_1/4': 26.22,
        'Cost_Frame_SteelTube_3_1/8': 3.88, 'Cost_Frame_SteelTube_3_3/16': 5.85, 'Cost_Frame_SteelTube_4_3/16': 9.25, 'Cost_Frame_SteelTube_6_3/16': 13.85, 'Cost_Frame_SteelTube_6_1/4': 18.75, 'Cost_Frame_SteelTube_8_3/16': 21.60, 'Cost_Frame_SteelTube_8_1/4': 24.25, 'Cost_Frame_SteelTube_10_1/4': 27.75, 'Cost_Frame_SteelTube_12_1/4': 33.55,
        'Cost_Frame_AlumAngle_1.5_1/8': 1.65, 'Cost_Frame_AlumAngle_2_1/8': 2.24,
        'Cost_Frame_SteelAngle_1.5_1/8': 1.20, 'Cost_Frame_SteelAngle_2_1/8': 1.45, 'Cost_Frame_SteelAngle_2_3/16': 2.20, 'Cost_Frame_SteelAngle_2_1/4': 2.95
    };

    const postKey = `Cost_Post_${inputs.postType}_${inputs.postProfile}`;
    if(!data[postKey]) data[postKey] = FALLBACK_METALS[postKey] || 6.50;
    let postCostLF = parseFloat(data[postKey]);
    
    let postStickLen = inputs.postType === 'Aluminum' ? 24 : 20;
    let postSticks = Math.ceil((totalPoleLF * wastePct) / postStickLen);

    L(`Structural Posts (${inputs.postType} ${postSizeInches}")`, (totalPoleLF * postCostLF) * wastePct, `${totalPoleLF.toFixed(1)} LF * $${postCostLF.toFixed(2)}/LF ${V(postKey, postCostLF)} * ${wastePct} Waste`, 'posts', 'metal_mat', { pull: `${postSticks}x ${postStickLen}' Sticks`, cut: `${2*inputs.qty}x @ ${(totalPostFt*12).toFixed(1)}"` });

    let baseCap = parseFloat(data.Cost_Post_Cap || 5.00);
    let capCost = baseCap * (postSizeInches / 3);
    L(`Post Caps (${postSizeInches}")`, 2 * inputs.qty * capCost, `${2 * inputs.qty} Caps * $${capCost.toFixed(2)}/ea`, 'posts', 'metal_mat');

    // ==========================================
    // PHASE 2: TRUE COLLISION & CUT MATH
    // ==========================================
    let totalFrameLF = 0, totalFaceSqFt = 0, frameCutsTotal = 0, weldLocs = 0, totalAdhMins = 0, paintSqFt = 0;
    let totalVMatCost = 0, totalInkCost = 0, totalLamCost = 0, totalTapeCost = 0;
    let minPrint = 0, minLam = 0, minPlot = 0, minWeed = 0, minMask = 0, minInstall = 0;
    let paintCups = 2; 
    let cutList = [];
    let hasClipping = false;

    const frameKey = `Cost_Frame_${inputs.frameMat}`;
    if(!data[frameKey]) data[frameKey] = FALLBACK_METALS[frameKey] || 2.50;
    const activeFrameCost = parseFloat(data[frameKey]);
    const isAngle = inputs.frameMat.includes('Angle');
    let maxSides = 1;
    inputs.panels.forEach(p => { if (p.sides === 2) maxSides = 2; });
    const frameMult = (maxSides === 2 && isAngle) ? 2 : 1;

    const pushCut = (label, qty, od, id, a1, a2) => {
        let finalQty = qty * frameMult * inputs.qty;
        cutList.push({ label, qty: finalQty, od, id, a1, a2 });
        totalFrameLF += (od * finalQty) / 12;
        frameCutsTotal += finalQty;
        weldLocs += finalQty; 
    };

    let baseVinyl = parseFloat(data.Cost_Vin_Cast || 1.30);
    let baseInk = parseFloat(data.Cost_Ink_Latex || 0.16);
    let baseLam = parseFloat(data.Cost_Lam_Cast || 0.96);
    let baseTape = parseFloat(data.Cost_Transfer_Tape || 0.15);
    let spdPrint = parseFloat(data.Speed_Print_Roll || 150);
    let spdLam = parseFloat(data.Speed_Lam_Roll || 300);
    let spdPlot = parseFloat(data.Speed_Cut_Graphtec || 50);

    inputs.panels.forEach((p, i) => {
        let pGap = i === 0 ? 0 : (p.gap || 0);
        totalPanelH += p.h + pGap;
        
        let W = p.w;
        let H = p.h;
        let isFlush = p.mountStyle === 'Flush';
        let shareTop = (i > 0 && p.gap === 0 && p.mountStyle === inputs.panels[i-1].mountStyle);

        // --- EXACT FRAME CUT CALCULATOR ---
        let sideOD = shareTop ? H - fThick : H;
        let sideID = shareTop ? H - (2 * fThick) : H - (2 * fThick);
        let sideA1 = shareTop ? 90 : 45;

        if (isFlush) {
            let overhang = (W - S_OD) / 2;
            
            // Physics Constraint: Tubing intersection clip guard
            if (overhang > 0 && overhang < fThick) {
                W = S_OD; p.w = W; overhang = 0; hasClipping = true;
            }
            maxOverallW = Math.max(maxOverallW, W);

            // True Structural Math 
            if (overhang === 0 && fThick === postSizeInches) {
                // Perfect matching OD allows posts to act as verticals
                if (!shareTop) pushCut(`P${i+1} Top Frame`, 1, S_ID, S_ID, 90, 90);
                pushCut(`P${i+1} Bottom Frame`, 1, S_ID, S_ID, 90, 90);
            } else {
                // Normal flush mount with continuous side rails
                if (!shareTop) pushCut(`P${i+1} Top Frame`, 1, W, W - (2*fThick), 45, 45);
                pushCut(`P${i+1} Side Frames`, 2, sideOD, sideID, sideA1, 45);
                
                if (overhang === 0) {
                    pushCut(`P${i+1} Bottom Center`, 1, S_ID, S_ID, 90, 90);
                } else {
                    // Split the bottom horizontal frame to prevent passing through the solid posts
                    pushCut(`P${i+1} Bottom Wings`, 2, overhang, overhang - fThick, 45, 90);
                    pushCut(`P${i+1} Bottom Center`, 1, S_ID, S_ID, 90, 90);
                }
            }
        } else {
            // Between Posts
            W = S_ID; p.w = W;
            if (!shareTop) pushCut(`P${i+1} Top Frame`, 1, W, W - (2*fThick), 45, 45);
            pushCut(`P${i+1} Bottom Frame`, 1, W, W - (2*fThick), 45, 45);
            pushCut(`P${i+1} Side Frames`, 2, sideOD, sideID, sideA1, 45);
        }

        // Internal Bracing
        let cantilever = (W - S_ID - (2 * postSizeInches)) / 2;
        if (cantilever < 0) cantilever = 0;
        
        let centerBraces = (S_ID > 48) ? Math.floor((S_ID - 1) / 48) : 0;
        let cantBraces = (cantilever > 48) ? Math.floor((cantilever - 1) / 48) : 0;
        let vBraces = centerBraces + (cantBraces * 2);
        if(p.mountStyle === 'Between') vBraces = (W > 48) ? Math.floor((W - 1) / 48) : 0;

        let hBraces = (H > 48) ? Math.floor((H - 1) / 48) : 0;
        
        if (vBraces > 0) pushCut(`P${i+1} Vert Braces`, vBraces, H - (2*fThick), H - (2*fThick), 90, 90);
        if (hBraces > 0) {
            let braceW = isFlush ? W : S_ID;
            pushCut(`P${i+1} Horiz Braces`, hBraces, braceW - (2*fThick), braceW - (2*fThick), 90, 90);
        }
        
        p.vBraces = vBraces; p.hBraces = hBraces;

        // --- SUBSTRATE & GRAPHICS MATH ---
        let pSqFt = (W * H) / 144;
        let multDS = p.sides === 2 ? 2 : 1;
        let faceSqFt = pSqFt * multDS;
        totalFaceSqFt += faceSqFt;

        let subCost = 1.50, subKey = 'Cost_Stock_063_4x8', physThick = 0.063;
        if (p.faceMat === '040 Alum') { subCost = parseFloat(data.Cost_Stock_040_4x8 || 84.44) / 32; subKey = 'Cost_Stock_040_4x8'; physThick = 0.040; }
        else if (p.faceMat === '063 Alum') { subCost = parseFloat(data.Cost_Stock_063_4x8 || 98.12) / 32; subKey = 'Cost_Stock_063_4x8'; physThick = 0.063; }
        else if (p.faceMat === '080 Alum') { subCost = parseFloat(data.Cost_Stock_080_4x8 || 124.57) / 32; subKey = 'Cost_Stock_080_4x8'; physThick = 0.080; }
        else if (p.faceMat === '3mm ACM') { subCost = parseFloat(data.Cost_Stock_3mm_4x8 || 52.09) / 32; subKey = 'Cost_Stock_3mm_4x8'; physThick = 0.118; }
        else if (p.faceMat === '6mm ACM') { subCost = parseFloat(data.Cost_Stock_6mm_4x8 || 72.10) / 32; subKey = 'Cost_Stock_6mm_4x8'; physThick = 0.236; }

        L(`Face Substrate: P${i+1} (${p.faceMat})`, (faceSqFt * inputs.qty * subCost) * wastePct, `${(faceSqFt * inputs.qty).toFixed(1)} SF * $${subCost.toFixed(2)}/SF ${V(subKey, subCost*32)} * ${wastePct} Waste`, 'faces', 'metal_mat', { pull: `${(faceSqFt * inputs.qty * wastePct).toFixed(1)} SF`, cut: `${multDS * inputs.qty}x @ ${W}" x ${H}"` });

        if (p.isCNC) {
            let cncRun = faceSqFt * inputs.qty * parseFloat(data.Time_CNC_Easy_SqFt || 1);
            L(`CNC Face Route Run: P${i+1}`, (cncRun / 60) * parseFloat(data.Rate_Machine_CNC || 10), `${(faceSqFt * inputs.qty).toFixed(1)} SF * ${V('Time_CNC_Easy_SqFt', 1)} M/SF * $10/hr`, 'faces', 'metal_lab', { time: cncRun });
        } else {
            let shearRun = (4 * multDS * inputs.qty) * parseFloat(data.Time_Shear_Cut || 0.35);
            L(`Shear Face Cuts: P${i+1}`, (shearRun / 60) * parseFloat(data.Rate_Shop_Labor || 20), `${4 * multDS * inputs.qty} Cuts * ${V('Time_Shear_Cut', 0.35)} Mins * $20/hr`, 'faces', 'metal_lab', { time: shearRun });
        }

        totalAdhMins += p.sides * inputs.qty * parseFloat(data.Time_Adhesive_Per_Face || 7);
        p.geomThick = physThick;

        let gColors = p.graphicColors || 1;
        let sfQty = faceSqFt * inputs.qty;

        if (p.graphicMethod === 'Overlay') {
            totalVMatCost += sfQty * baseVinyl;
            totalInkCost += sfQty * baseInk;
            totalLamCost += sfQty * baseLam;
            minPrint += (sfQty / spdPrint) * 60;
            minLam += (sfQty / spdLam) * 60;
            minInstall += sfQty * parseFloat(data.Time_Mount_Flat_SqFt || 0.25);
        } else if (p.graphicMethod === 'PrintOnPaint') {
            paintSqFt += sfQty;
            totalVMatCost += sfQty * baseVinyl;
            totalInkCost += sfQty * baseInk;
            totalLamCost += sfQty * baseLam;
            totalTapeCost += sfQty * baseTape;
            minPrint += (sfQty / spdPrint) * 60;
            minLam += (sfQty / spdLam) * 60;
            minPlot += (sfQty / spdPlot) * 60;
            minWeed += sfQty * parseFloat(data.Time_Weed_Simple || 0.42);
            minMask += sfQty * parseFloat(data.Time_Mask_SqFt || 0.17);
            minInstall += sfQty * parseFloat(data.Time_Mount_Flat_SqFt || 0.25);
        } else if (p.graphicMethod === 'CutOnPaint' || p.graphicMethod === 'PaintOnPaint') {
            paintSqFt += sfQty;
            totalVMatCost += sfQty * baseVinyl * gColors;
            totalTapeCost += sfQty * baseTape * gColors;
            minPlot += (sfQty * gColors / spdPlot) * 60;
            minWeed += sfQty * gColors * parseFloat(data.Time_Weed_Simple || 0.42);
            minMask += sfQty * gColors * parseFloat(data.Time_Mask_SqFt || 0.17);
            minInstall += sfQty * gColors * parseFloat(data.Time_Mount_Flat_SqFt || 0.25);
            if (p.graphicMethod === 'PaintOnPaint') {
                paintCups += gColors; 
                paintSqFt += (sfQty * gColors); 
            }
        }
    });

    let frameStickLen = inputs.frameMat.includes('Alum') ? 24 : 20;
    let frameSticks = Math.ceil((totalFrameLF * wastePct) / frameStickLen);

    L(`Internal Frame (${inputs.frameMat.replace(/_/g, ' ')})`, (totalFrameLF * activeFrameCost) * wastePct, `${totalFrameLF.toFixed(1)} LF * $${activeFrameCost.toFixed(2)}/LF ${V(frameKey, activeFrameCost)} * ${wastePct} Waste`, 'frame', 'metal_mat', { pull: `${frameSticks}x ${frameStickLen}' Sticks` });
    
    if (inputs.postType === 'Steel' && inputs.frameMat.includes('Alum')) {
        L(`Mechanical Fasteners (Alum/Steel)`, 15.00 * inputs.qty, `Dissimilar metal joining hardware (Fixed)`, 'frame', 'metal_mat');
    }

    // ==========================================
    // PHASE 3: METAL FABRICATION LABOR
    // ==========================================
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    L(`Gather Materials`, (parseFloat(data.Time_Gather_Mats || 10) / 60) * rateShop * inputs.qty, `${V('Time_Gather_Mats', 10)} Mins/Set * Qty * $${rateShop}/hr`, 'finish', 'metal_lab');

    const timeMiter = parseFloat(data.Time_Saw_Miter || 5);
    const timeBand = parseFloat(data.Time_Saw_Band || 10);
    const isMiterPost = inputs.postType === 'Aluminum' && postSizeInches <= 4;
    const isMiterFrame = inputs.frameMat.includes('Alum') && fThick <= 4;

    const postSawMins = 2 * inputs.qty * (isMiterPost ? timeMiter : timeBand);
    L(`Post Cuts (${isMiterPost ? "Miter" : "Band"} Saw)`, (postSawMins / 60) * rateShop, `Cuts * ${isMiterPost ? V('Time_Saw_Miter', 5) : V('Time_Saw_Band', 10)} Mins * $${rateShop}/hr`, 'finish', 'metal_lab', { time: postSawMins });

    const frameSawMins = frameCutsTotal * (isMiterFrame ? timeMiter : timeBand);
    L(`Frame Cuts (${isMiterFrame ? "Miter" : "Band"} Saw)`, (frameSawMins / 60) * rateShop, `${frameCutsTotal} Precise Cuts * ${isMiterFrame ? V('Time_Saw_Miter', 5) : V('Time_Saw_Band', 10)} Mins * $${rateShop}/hr`, 'finish', 'metal_lab', { time: frameSawMins });

    if (inputs.panels.some(p => p.isCNC)) {
        let cncSetup = parseFloat(data.Time_Setup_CNC || 10);
        L(`CNC Face Route Setup`, (cncSetup / 60) * parseFloat(data.Rate_CNC_Labor || 25), `${V('Time_Setup_CNC', 10)} Mins * $25/hr`, 'faces', 'metal_lab', { time: cncSetup });
    }

    const timeWeld = parseFloat(data.Time_Weld_Per_Loc || 1.5);
    const timeClean = parseFloat(data.Time_Clean_Weld_Loc || 0.33);
    L(`Welding & Joining`, ((weldLocs * timeWeld) / 60) * rateShop, `${weldLocs} Locs * ${V('Time_Weld_Per_Loc', 1.5)} Mins * $${rateShop}/hr`, 'finish', 'metal_lab', { time: weldLocs * timeWeld });
    L(`Weld Grinding/Cleaning`, ((weldLocs * timeClean) / 60) * rateShop, `${weldLocs} Locs * ${V('Time_Clean_Weld_Loc', 0.33)} Mins * $${rateShop}/hr`, 'finish', 'metal_lab', { time: weldLocs * timeClean });

    const adhYield = parseFloat(data.Yield_Adhesive_Tube_LF || 10);
    const adhCost = parseFloat(data.Cost_Adhesive_Tube || 18.71);
    const cartridges = Math.ceil(totalFrameLF / adhYield);
    L(`Lord's Adhesive`, cartridges * adhCost, `${cartridges} Cartridges * $${adhCost.toFixed(2)}/ea ${V('Cost_Adhesive_Tube', adhCost)}`, 'finish', 'metal_mat', { pull: `${cartridges} Tubes` });
    L(`Adhesive Application`, (totalAdhMins / 60) * rateShop, `Faces * ${V('Time_Adhesive_Per_Face', 7)} Mins * $${rateShop}/hr`, 'finish', 'metal_lab', { time: totalAdhMins });

    // ==========================================
    // PHASE 4: GRAPHICS MATERIALS & LABOR
    // ==========================================
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const ratePrintMach = parseFloat(data.Rate_Machine_Print || 5);
    const ratePlotMach = parseFloat(data.Rate_Machine_Cut || 5);

    if (totalVMatCost > 0) L(`Vinyl Print/Cut Media`, totalVMatCost * wastePct, `SqFt * $${baseVinyl}/SF ${V('Cost_Vin_Cast', baseVinyl)} * Waste`, 'graphics', 'graph_mat', { pull: `Roll Media` });
    if (totalLamCost > 0) L(`Overlaminate Media`, totalLamCost * wastePct, `SqFt * $${baseLam}/SF ${V('Cost_Lam_Cast', baseLam)} * Waste`, 'graphics', 'graph_mat');
    if (totalInkCost > 0) L(`Latex Ink`, totalInkCost * wastePct, `SqFt * $${baseInk}/SF ${V('Cost_Ink_Latex', baseInk)} * Waste`, 'graphics', 'graph_mat');
    if (totalTapeCost > 0) L(`Transfer Tape`, totalTapeCost * wastePct, `SqFt * $${baseTape}/SF ${V('Cost_Transfer_Tape', baseTape)} * Waste`, 'graphics', 'graph_mat');

    if (minPrint > 0) L(`File RIP & Prep`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`, 'graphics', 'graph_lab', { time: 15 });
    if (minPrint > 0) L(`Print Machine Run`, (minPrint / 60) * ratePrintMach, `${minPrint.toFixed(1)} Mins * $${ratePrintMach}/hr`, 'graphics', 'graph_lab', { time: minPrint });
    if (minLam > 0) L(`Laminator Run`, (minLam / 60) * rateShop, `${minLam.toFixed(1)} Mins * $${rateShop}/hr`, 'graphics', 'graph_lab', { time: minLam });
    if (minPlot > 0) L(`Plotter (Contour Cut)`, (minPlot / 60) * ratePlotMach, `${minPlot.toFixed(1)} Mins * $${ratePlotMach}/hr`, 'graphics', 'graph_lab', { time: minPlot });
    if (minWeed > 0) L(`Weeding Labor`, (minWeed / 60) * rateShop, `${minWeed.toFixed(1)} Mins * $${rateShop}/hr`, 'graphics', 'graph_lab', { time: minWeed });
    if (minMask > 0) L(`Masking Labor`, (minMask / 60) * rateShop, `${minMask.toFixed(1)} Mins * $${rateShop}/hr`, 'graphics', 'graph_lab', { time: minMask });
    if (minInstall > 0) L(`Vinyl Shop Installation`, (minInstall / 60) * rateShop, `${minInstall.toFixed(1)} Mins * $${rateShop}/hr`, 'graphics', 'graph_lab', { time: minInstall });

    // ==========================================
    // PHASE 5: PAINT MATERIALS & LABOR
    // ==========================================
    const postSurfaceArea = (postSizeInches / 12) * 4 * totalPoleLF;
    paintSqFt += postSurfaceArea;
    let sandMins = paintSqFt * parseFloat(data.Time_Sand_SqFt || 0.5);
    L(`Sanding / Paint Prep`, (sandMins / 60) * rateShop, `${paintSqFt.toFixed(1)} SF * ${V('Time_Sand_SqFt', 0.5)} Mins/SF * $${rateShop}/hr`, 'finish', 'metal_lab', { time: sandMins });

    const ratePaint = parseFloat(data.Rate_Paint_Labor || 30);
    const timeCupChg = parseFloat(data.Time_Paint_Cup_Change || 3);
    const costCup = parseFloat(data.Cost_Paint_Cup || 1.00);
    const cPaintSqFt = parseFloat(data.Cost_Paint_SqFt || 2.50);

    L(`Primer & Paint Material`, paintSqFt * cPaintSqFt, `${paintSqFt.toFixed(1)} SF * $${cPaintSqFt}/SF ${V('Cost_Paint_SqFt', cPaintSqFt)}`, 'finish', 'paint_mat');
    L(`Quick Change Cups`, paintCups * costCup, `${paintCups} Cups * $${costCup.toFixed(2)}/ea ${V('Cost_Paint_Cup', costCup)}`, 'finish', 'paint_mat');
    L(`Move Items / Surface Prep`, (parseFloat(data.Time_Paint_Move_Prep || 15) / 60) * ratePaint * inputs.qty, `${V('Time_Paint_Move_Prep', 15)} Mins Flat * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: 15 * inputs.qty });
    L(`Mix Paints`, (parseFloat(data.Time_Paint_Setup || 10) / 60) * ratePaint, `${V('Time_Paint_Setup', 10)} Mins Flat * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: 10 });
    L(`Gun Wash & Cup Changes`, ((paintCups * timeCupChg) / 60) * ratePaint, `${paintCups} Cups * ${V('Time_Paint_Cup_Change', 3)} Mins * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: paintCups * timeCupChg });
    
    let primeMins = paintSqFt * parseFloat(data.Time_Paint_Primer_SqFt || 0.104);
    L(`Spray Primer`, (primeMins / 60) * ratePaint, `${paintSqFt.toFixed(1)} SF * ${V('Time_Paint_Primer_SqFt', 0.104)} Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: primeMins });

    let finishMins = paintSqFt * parseFloat(data.Time_Paint_Finish_SqFt || 0.312);
    L(`Spray Finish Coats`, (finishMins / 60) * ratePaint, `${paintSqFt.toFixed(1)} SF * ${V('Time_Paint_Finish_SqFt', 0.312)} Mins/SF * $${ratePaint}/hr`, 'finish', 'paint_lab', { time: finishMins });

    // --- TOTALS & RETAIL EXHAUST ---
    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;

    let targetMargin = parseFloat(data.Target_Margin_Pct || 0.60);
    let grandTotalRaw = 0;

    if (data.Override_Retail_Total && parseFloat(data.Override_Retail_Total) > 0) {
        grandTotalRaw = parseFloat(data.Override_Retail_Total);
        targetMargin = (grandTotalRaw - totalCost) / grandTotalRaw; 
    } else {
        grandTotalRaw = totalCost / (1 - targetMargin);
    }
    
    const minOrder = parseFloat(data.Retail_Min_Order || 150);
    const grandTotal = Math.max(grandTotalRaw, minOrder);
    const isMinApplied = grandTotalRaw < minOrder;

    const bucketTotals = { posts: 0, frame: 0, faces: 0, graphics: 0, finish: 0 };
    const multiplier = grandTotalRaw / totalCost; 
    cst.forEach(i => { if(bucketTotals[i.rB] !== undefined) { bucketTotals[i.rB] += (i.total * riskFactor * multiplier); } });

    const lineItems = [
        { label: 'Structural Posts', unit: bucketTotals.posts },
        { label: 'Internal Frames', unit: bucketTotals.frame },
        { label: 'Faces & Substrates', unit: bucketTotals.faces },
        { label: 'Graphics & Print', unit: bucketTotals.graphics },
        { label: 'Assembly & Painting', unit: bucketTotals.finish }
    ];

    const retBreakdown = [
        { label: `Market Value (${(targetMargin*100).toFixed(1)}% Profit Margin)`, total: grandTotalRaw, formula: `Total Hard Cost / (1 - 0.${(targetMargin*100).toFixed(0)})` }
    ];
    if (isMinApplied) retBreakdown.push({ label: 'Shop Minimum Surcharge', total: minOrder - grandTotalRaw, formula: 'Minimum order difference' });

    let holeDiamInches = Math.max(6, postSizeInches * 3);
    const geometry = {
        postSpacing: S_ID, panels: inputs.panels,
        post: postSizeInches, holeD: holeDiamInches,
        clearance: inputs.clearance, above: inputs.aboveGrade, under: inputs.belowGrade,
        overallW: maxOverallW, frameThick: fThick, totalPanelH: totalPanelH, 
        hasClipping: hasClipping, cutList: cutList
    };

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: retBreakdown, lineItems: lineItems, isMinApplied: isMinApplied },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: targetMargin }, 
        geom: geometry,
        activeKeys: [postKey, frameKey]
    };
}

window.POSTPANEL_CONFIG = {
    tab: 'PROD_Post_Panel',
    engine: calculatePostPanel,
    retails: [
        { key: 'Target_Margin_Pct', label: 'Target Margin (0.x)' },
        { key: 'Override_Retail_Total', label: 'Override Total ($)' },
        { key: 'Retail_Min_Order', label: 'Shop Minimum ($)' }
    ],
    costs: [
        { heading: 'Labor & Machine Rates', key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Operator', label: 'Print Op ($/Hr)' },
        { key: 'Rate_Machine_Print', label: 'Print Mach ($/Hr)' },
        { key: 'Rate_Machine_Cut', label: 'Plotter Mach ($/Hr)' },
        { key: 'Rate_Paint_Labor', label: 'Paint Labor ($/Hr)' },
        { key: 'Rate_CNC_Labor', label: 'CNC Op ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'CNC Mach ($/Hr)' },

        { heading: 'Materials & Consumables', key: 'Cost_Post_Cap', label: 'Post Cap ($/Ea)' },
        { key: 'Cost_Adhesive_Tube', label: 'Adhesive ($/Tube)' },
        { key: 'Yield_Adhesive_Tube_LF', label: 'Adhesive Yld (LF)' },
        { key: 'Cost_Paint_SqFt', label: 'Paint Mat ($/SF)' },
        { key: 'Cost_Paint_Cup', label: 'Paint Cup ($/Ea)' },
        { key: 'Cost_Vin_Cast', label: 'Cast Vinyl ($/SqFt)' },
        { key: 'Cost_Lam_Cast', label: 'Cast Lam ($/SqFt)' },
        { key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },
        { key: 'Cost_Transfer_Tape', label: 'Transfer Tape ($/SqFt)' },

        { heading: 'Time Estimates (Speed & Setup)', key: 'Speed_Print_Roll', label: 'Print Speed (SF/Hr)' },
        { key: 'Speed_Lam_Roll', label: 'Lam Speed (SF/Hr)' },
        { key: 'Speed_Cut_Graphtec', label: 'Plotter Speed (SF/Hr)' },
        { key: 'Time_Setup_Job', label: 'File Setup (Mins)' },
        { key: 'Time_Gather_Mats', label: 'Gather Mats (Mins)' },
        { key: 'Time_Setup_CNC', label: 'CNC Setup (Mins)' },
        { key: 'Time_CNC_Easy_SqFt', label: 'CNC Easy (Mins/SF)' },

        { heading: 'Fabrication Time', key: 'Time_Saw_Miter', label: 'Miter Saw Cut (Mins/Ea)' },
        { key: 'Time_Saw_Band', label: 'Band Saw Cut (Mins/Ea)' },
        { key: 'Time_Shear_Cut', label: 'Shear Cut (Mins/Ea)' },
        { key: 'Time_Weld_Per_Loc', label: 'Weld (Mins/Loc)' },
        { key: 'Time_Clean_Weld_Loc', label: 'Grind (Mins/Loc)' },
        { key: 'Time_Adhesive_Per_Face', label: 'Apply Glue (Mins/Face)' },
        
        { heading: 'Graphics Time', key: 'Time_Mount_Flat_SqFt', label: 'Mount Vinyl (Mins/SF)' },
        { key: 'Time_Weed_Simple', label: 'Weed Simple (Mins/SF)' },
        { key: 'Time_Mask_SqFt', label: 'Masking (Mins/SF)' },
        
        { heading: 'Paint Time', key: 'Time_Sand_SqFt', label: 'Sanding (Mins/SF)' },
        { key: 'Time_Paint_Move_Prep', label: 'Move & Prep (Mins/Job)' },
        { key: 'Time_Paint_Setup', label: 'Mix Paint (Mins/Job)' },
        { key: 'Time_Paint_Cup_Change', label: 'Cup Change (Mins/Ea)' },
        { key: 'Time_Paint_Primer_SqFt', label: 'Prime Spray (Mins/SF)' },
        { key: 'Time_Paint_Finish_SqFt', label: 'Paint Finish (Mins/SF)' },

        { heading: 'Safety Buffers', key: 'Waste_Factor', label: 'Waste Buffer (1.x)' },
        { key: 'Factor_Risk', label: 'Risk Buffer (1.x)' }
    ]
};