/**
 * PURE PHYSICS ENGINE: Post & Panel Signs (v4.2)
 * Features: 5x10 Aluminum Exclusivity, Unconditional Paint Math, Strict Backend References.
 */

function calculatePostPanel(inputs, data) {
    const cst = [];
    const warnings = [];
    
    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    
    const V = (k) => {
        let val = data[k] !== undefined ? data[k] : "SYS";
        if (!isNaN(val) && val !== "SYS") {
            val = (k.includes('Cost') || k.includes('Rate') || k.includes('Retail')) ? "$" + parseFloat(val).toFixed(2) : val;
        }
        return `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">${k} [${val}]</span>`;
    };

    const L = (label, total, formula, rB, cB) => { if(total > 0) cst.push({label, total, formula, rB, cB}); return total; };

    const riskFactor = parseFloat(data.Factor_Risk || 1.05);
    const rollWaste = parseFloat(data.Waste_Factor || 1.15);
    const rigidWaste = parseFloat(data.Waste_Factor_Rigid || 1.10); 
    const multDS = inputs.sides === 2 ? 2 : 1;

    // --- STRUCTURAL FLAGS ---
    const isAngleFrame = inputs.frameMat.includes('Angle');
    const isFlushDS = inputs.mountStyle === 'Flush' && inputs.sides === 2;
    const needsSkin = isFlushDS && isAngleFrame; 

    // --- 1. POSTS & CONCRETE ---
    const aboveGroundFt = inputs.aboveGrade / 12;
    const undergroundFt = inputs.belowGrade / 12;
    const singlePostLenIn = (aboveGroundFt + undergroundFt) * 12;
    
    let postSizeInches = 2;
    let postArea = 0;
    
    let rawWoodHardCost = 0;
    let fixedWoodRetail = 0;
    
    if (inputs.postType === 'Wood') {
        postSizeInches = 3.5; 
        const isPainted = inputs.postProfile.includes('Painted');
        
        let len = 8;
        if (singlePostLenIn > 96) len = 10;
        if (singlePostLenIn > 120) len = 12;
        if (singlePostLenIn > 144) len = 16;
        if (singlePostLenIn > 192) warnings.push(`Wood post (${(singlePostLenIn/12).toFixed(1)}') exceeds standard 16ft length. Splicing required.`);
        
        let fallbackCost = {8: 10.48, 10: 14.98, 12: 18.08, 16: 24.28}[len];
        const cKey = `Cost_Wood_${len}_Nat`;
        let woodCost = parseFloat(data[cKey]) || fallbackCost;
        
        let woodCostEa = woodCost;
        rawWoodHardCost = L(`4x4 Wood Posts (${len}' Natural)`, 2 * woodCost, `(x2) ${len}' Posts * ${V(cKey)} = $${woodCostEa.toFixed(2)} ea`, 'posts', 'struct_mat');
        
        postArea = (3.5 / 12) * 4 * (len * 2); 
        
        let fallbackRet = isPainted ? {8: 75, 10: 85, 12: 105, 16: 125}[len] : {8: 50, 10: 55, 12: 65, 16: 75}[len];
        const retKey = isPainted ? `Retail_Wood_${len}_Pnt` : `Retail_Wood_${len}_Nat`;
        let targetRetail = parseFloat(data[retKey]) || fallbackRet;
        fixedWoodRetail = targetRetail * 2; 
        
    } else {
        const parentLenFt = inputs.postType === 'Aluminum' ? parseFloat(data.Stock_Length_Alum_FT || 24) : parseFloat(data.Stock_Length_Steel_FT || 20);
        if (singlePostLenIn > (parentLenFt * 12)) warnings.push(`Structural Post (${(singlePostLenIn/12).toFixed(1)}') exceeds standard ${parentLenFt}' stock length. Splicing required.`);

        const billedPostLF = Math.ceil(singlePostLenIn / 12); 
        const totalPostBilledLF = billedPostLF * 2; 

        const profileParts = inputs.postProfile.split('_');
        postSizeInches = parseFloat(profileParts);
        const postWall = profileParts;

        const FALLBACK_METALS = {
            'Cost_Post_Aluminum_2_1/8': 4.28, 'Cost_Post_Aluminum_3_1/8': 6.56, 'Cost_Post_Aluminum_4_1/8': 8.84, 'Cost_Post_Aluminum_6_1/4': 26.22,
            'Cost_Post_Steel_3_1/8': 3.88, 'Cost_Post_Steel_3_3/16': 5.85, 'Cost_Post_Steel_4_3/16': 9.25, 'Cost_Post_Steel_6_3/16': 13.85, 'Cost_Post_Steel_6_1/4': 18.75, 'Cost_Post_Steel_8_3/16': 21.60, 'Cost_Post_Steel_8_1/4': 24.25, 'Cost_Post_Steel_10_1/4': 27.75, 'Cost_Post_Steel_12_1/4': 33.55
        };

        const postKey = `Cost_Post_${inputs.postType}_${inputs.postProfile}`;
        let postCostLF = parseFloat(data[postKey]) || FALLBACK_METALS[postKey] || 6.50;
        
        let postCostEa = billedPostLF * postCostLF;
        L(`Structural Posts (${inputs.postType} ${postSizeInches}" x ${postWall}")`, totalPostBilledLF * postCostLF, `(x2) ${billedPostLF}' Posts * ${V(postKey)} = $${postCostEa.toFixed(2)} ea = $${(totalPostBilledLF * postCostLF).toFixed(2)} total`, 'posts', 'struct_mat');
        
        let baseCapCost = parseFloat(data.Cost_Post_Cap || 6.00);
        let capCost = baseCapCost * (postSizeInches / 3); 
        
        if (!needsSkin) {
            L(`Post Caps (${postSizeInches}")`, 2 * capCost, `(x2) Caps * (${V('Cost_Post_Cap')} Base / 3 * ${postSizeInches}") = $${capCost.toFixed(2)} ea`, 'posts', 'struct_mat');
        }
        
        postArea = (postSizeInches / 12) * 4 * (singlePostLenIn/12 * 2); 
    }

    let holeDiamInches = postSizeInches * 3;
    if (holeDiamInches < 6) holeDiamInches = 6; 
    
    if (inputs.incConcrete) {
        const footerHeightFt = undergroundFt * 0.66;
        const holeRadiusFt = (holeDiamInches / 2) / 12;
        const holeVolumeCuFt = Math.PI * Math.pow(holeRadiusFt, 2) * footerHeightFt;
        const concreteYield = parseFloat(data.Yield_Concrete_Bag_CuFt || 0.6);
        const bagsNeeded = Math.ceil((holeVolumeCuFt * 2) / concreteYield); 
        const bagCost = parseFloat(data.Cost_Concrete_Bag || 4.50); 
        L(`Concrete Tap Footers (80lb Bags)`, bagsNeeded * bagCost, `${bagsNeeded} Bags (${V('Yield_Concrete_Bag_CuFt')} yield) * ${V('Cost_Concrete_Bag')}`, 'concrete', 'concrete');
    }

    // --- 2. INTERNAL SKELETON OR BRACKETS ---
    const rateShop = parseFloat(data.Rate_Shop_Labor || 150);
    const timeSawCut = parseFloat(data.Time_Saw_Cut || 10);
    let frameThickOut = 2;
    let frameDescOut = "";
    let bracketArea = 0;
    let bracesCount = 0;

    let frameW = inputs.useCustomFrame ? inputs.customFrameW : inputs.w;
    let frameH = inputs.useCustomFrame ? inputs.customFrameH : inputs.h;

    const FALLBACK_METALS = {
        'Cost_Frame_AlumTube_2_1/8': 4.28, 'Cost_Frame_AlumTube_3_1/8': 6.56, 'Cost_Frame_AlumTube_4_1/8': 8.84, 'Cost_Frame_AlumTube_6_1/4': 26.22,
        'Cost_Frame_SteelTube_3_1/8': 3.88, 'Cost_Frame_SteelTube_3_3/16': 5.85, 'Cost_Frame_SteelTube_4_3/16': 9.25, 'Cost_Frame_SteelTube_6_3/16': 13.85, 'Cost_Frame_SteelTube_6_1/4': 18.75, 'Cost_Frame_SteelTube_8_3/16': 21.60, 'Cost_Frame_SteelTube_8_1/4': 24.25, 'Cost_Frame_SteelTube_10_1/4': 27.75, 'Cost_Frame_SteelTube_12_1/4': 33.55,
        'Cost_Frame_AlumAngle_1.5_1/8': 1.65, 'Cost_Frame_AlumAngle_2_1/8': 2.24,
        'Cost_Frame_SteelAngle_1.5_1/8': 1.20, 'Cost_Frame_SteelAngle_2_1/8': 1.45, 'Cost_Frame_SteelAngle_2_3/16': 2.20, 'Cost_Frame_SteelAngle_2_1/4': 2.95
    };

    if (inputs.frameMat === 'Brackets') {
        const bMatParts = inputs.bracketMat.split('_');
        frameThickOut = parseFloat(bMatParts) || 1.5;
        frameDescOut = inputs.bracketMat.replace(/_/g, ' ') + " Brackets";
        
        const bKey = `Cost_Frame_${inputs.bracketMat}`;
        const angleCost = parseFloat(data[bKey]) || FALLBACK_METALS[bKey] || 1.65;
        
        const bLen = inputs.bracketLen;
        const bQty = inputs.bracketQty;
        const exactBracketLF = bQty * (bLen/12);

        L(`Angle Brackets (${frameThickOut}" ${bLen}" long)`, exactBracketLF * angleCost, `${bQty} Brackets = ${exactBracketLF.toFixed(1)} LF * ${V(bKey)}`, 'frame', 'struct_mat');
        
        const sawMins = bQty * timeSawCut;
        L(`Bracket Saw Cuts [${(sawMins/60).toFixed(2)} Hrs]`, (sawMins / 60) * rateShop, `${bQty} Cuts * ${V('Time_Saw_Cut')} Mins * ${V('Rate_Shop_Labor')}`, 'metal_fab', 'struct_lab');
        
        bracketArea = bQty * (((frameThickOut + frameThickOut) * 2 * bLen) / 144);

    } else {
        const frameMult = (isAngleFrame && inputs.sides === 2) ? 2 : 1; 
        bracesCount = frameH > 24 ? Math.floor(frameW / 48) : 0;
        
        const horizChunksLF = Math.ceil(frameW / 12);
        const vertChunksLF = Math.ceil(frameH / 12);
        const braceChunksLF = Math.ceil(frameH / 12);
        
        const totalFrameBilledLF = ((horizChunksLF * 2) + (vertChunksLF * 2) + (bracesCount * braceChunksLF)) * frameMult;
        const exactFrameLF = (((frameW * 2) + (frameH * 2)) / 12 * frameMult) + (bracesCount * (frameH / 12) * frameMult); 
        
        const frameKey = `Cost_Frame_${inputs.frameMat}`;
        const activeFrameCost = parseFloat(data[frameKey]) || FALLBACK_METALS[frameKey] || 1.45; 
        
        const frameParts = inputs.frameMat.split('_');
        frameThickOut = parseFloat(frameParts) || 2;
        frameDescOut = inputs.frameMat.replace(/_/g, ' ');

        L(`Internal Skeleton (${frameDescOut})`, totalFrameBilledLF * activeFrameCost, `${totalFrameBilledLF} Total Chunks (LF) * ${V(frameKey)}`, 'frame', 'struct_mat');

        const totalCuts = 2 + (4 * frameMult) + (bracesCount * frameMult);
        const sawMins = totalCuts * timeSawCut;
        L(`Saw Cuts & Setup [${(sawMins/60).toFixed(2)} Hrs]`, (sawMins / 60) * rateShop, `${totalCuts} Cuts * ${V('Time_Saw_Cut')} Mins * ${V('Rate_Shop_Labor')}`, 'metal_fab', 'struct_lab');
        
        const timeWeld = parseFloat(data.Time_Weld_LF || 1);
        const weldMins = exactFrameLF * timeWeld;
        L(`Tack Welding [${(weldMins/60).toFixed(2)} Hrs]`, (weldMins / 60) * rateShop, `${exactFrameLF.toFixed(1)} LF * ${V('Time_Weld_LF')} Mins/LF * ${V('Rate_Shop_Labor')}`, 'metal_fab', 'struct_lab');
        
        const timeGrind = parseFloat(data.Time_Grind_LF || 1);
        const grindMins = exactFrameLF * timeGrind;
        L(`Weld Grinding [${(grindMins/60).toFixed(2)} Hrs]`, (grindMins / 60) * rateShop, `${exactFrameLF.toFixed(1)} LF * ${V('Time_Grind_LF')} Mins/LF * ${V('Rate_Shop_Labor')}`, 'metal_fab', 'struct_lab');

        const adhYield = parseFloat(data.Yield_Adhesive_Tube_LF || 10);
        const adhCost = parseFloat(data.Cost_Adhesive_Tube || 18.71);
        const cartridges = Math.ceil(exactFrameLF / adhYield);
        L(`Lord's Adhesive (Metal Glue)`, cartridges * adhCost, `${cartridges} Cartridges (${V('Yield_Adhesive_Tube_LF')} LF/ea) * ${V('Cost_Adhesive_Tube')}`, 'metal_fab', 'struct_mat');
        
        const timeAdh = parseFloat(data.Time_Adhesive_LF || 0.5);
        const adhMins = exactFrameLF * timeAdh;
        L(`Adhesive Application [${(adhMins/60).toFixed(2)} Hrs]`, (adhMins / 60) * rateShop, `${exactFrameLF.toFixed(1)} LF * ${V('Time_Adhesive_LF')} Mins/LF * ${V('Rate_Shop_Labor')}`, 'metal_fab', 'struct_lab');
    }

    // --- 3. FACE SUBSTRATE & SKINS (ALUMINUM IS ALWAYS 5x10) ---
    const faceBilledW = Math.ceil(inputs.w / 12); 
    const faceBilledH = Math.ceil(inputs.h / 12); 
    const faceBilledSqFt = faceBilledW * faceBilledH;

    let subCost = 1.50;
    let physThick = 0.063; 
    let subKey = 'Cost_Stock_063_5x10';
    let yieldSqFt = 50; 
    
    // Aluminum sheets are forced to 5x10 (50 sqft yield)
    if (inputs.faceMat === '040 Alum') { subCost = parseFloat(data.Cost_Stock_040_5x10 || 122.65) / 50; physThick = 0.040; subKey = 'Cost_Stock_040_5x10'; yieldSqFt = 50; }
    else if (inputs.faceMat === '063 Alum') { subCost = parseFloat(data.Cost_Stock_063_5x10 || 153.32) / 50; physThick = 0.063; subKey = 'Cost_Stock_063_5x10'; yieldSqFt = 50; }
    else if (inputs.faceMat === '080 Alum') { subCost = parseFloat(data.Cost_Stock_080_5x10 || 194.63) / 50; physThick = 0.080; subKey = 'Cost_Stock_080_5x10'; yieldSqFt = 50; }
    else if (inputs.faceMat === '3mm ACM') { subCost = parseFloat(data.Cost_Stock_3mm_4x8 || 52.09) / 32; physThick = 0.118; subKey = 'Cost_Stock_3mm_4x8'; yieldSqFt = 32; }
    else if (inputs.faceMat === '6mm ACM') { subCost = parseFloat(data.Cost_Stock_6mm_4x8 || 72.10) / 32; physThick = 0.236; subKey = 'Cost_Stock_6mm_4x8'; yieldSqFt = 32; }

    L(`Face Substrate (${inputs.faceMat})`, (faceBilledSqFt * subCost * multDS) * rigidWaste, `Yield ${faceBilledSqFt} SF * (${V(subKey)} / ${yieldSqFt} sf) * ${multDS} Sides * ${V('Waste_Factor_Rigid')}`, 'faces', 'struct_mat');
    
    let skinSqFt = 0;
    if (needsSkin) {
        let topSkinSqin = inputs.w * postSizeInches;
        let botSkinSqin = Math.max(0, inputs.w - (postSizeInches * 2)) * postSizeInches;
        skinSqFt = (topSkinSqin + botSkinSqin) / 144;
        let sheet5x10Cost = parseFloat(data.Cost_Stock_063_5x10 || 153.32);
        L(`Top/Bottom Skins (.063 Alum 5x10)`, skinSqFt * (sheet5x10Cost / 50) * rigidWaste, `(${skinSqFt.toFixed(1)} SF / 50 SF Yield) * ${V('Cost_Stock_063_5x10')} * ${V('Waste_Factor_Rigid')}`, 'faces', 'struct_mat');
    }

    // --- 4. CUTTING & ROUTING PHYSICS ---
    const rateOp = parseFloat(data.Rate_Operator || 150);
    const panelSqFtExact = (inputs.w * inputs.h) / 144;

    let routerRetailFee = 0;
    if (inputs.cutMethod === 'CNC Simple' || inputs.cutMethod === 'CNC Complex') {
        const rateCNC = parseFloat(data.Rate_Machine_CNC || 10);
        const routeTimeSqFt = inputs.cutMethod === 'CNC Complex' ? parseFloat(data.Time_CNC_Complex_SqFt || 2) : parseFloat(data.Time_CNC_Easy_SqFt || 1);
        
        L(`CNC Prepress [0.25 Hrs]`, (15 / 60) * rateOp, `15 Mins * ${V('Rate_Operator')}`, 'metal_fab', 'struct_lab');
        
        const cncMins = panelSqFtExact * multDS * routeTimeSqFt;
        L(`CNC Router Run [${(cncMins/60).toFixed(2)} Hrs]`, (cncMins / 60) * rateCNC, `${(panelSqFtExact*multDS).toFixed(1)} SF * ${routeTimeSqFt} Mins/SF * ${V('Rate_Machine_CNC')}`, 'metal_fab', 'struct_lab');
        
        routerRetailFee = inputs.cutMethod === 'CNC Complex' ? parseFloat(data.Retail_Fee_Router_Hard || 50) : parseFloat(data.Retail_Fee_Router_Easy || 30);
    } else {
        const shearSetup = parseFloat(data.Time_Shear_Setup || 5);
        let shearCuts = multDS * 4;
        if (needsSkin) shearCuts += 4; 
        
        const shearMins = shearSetup + shearCuts;
        L(`Shear Setup & Cut [${(shearMins/60).toFixed(2)} Hrs]`, (shearMins / 60) * rateShop, `${V('Time_Shear_Setup')} Mins + ${shearCuts} Cuts * ${V('Rate_Shop_Labor')}`, 'metal_fab', 'struct_lab');
    }

    // --- 5. GRAPHICS (ROLL MEDIA WASTE) ---
    const machPrint = parseFloat(data.Rate_Machine_Print || 5);
    
    const vinylCost = parseFloat(data.Cost_Vin_Cast || 1.30);
    const lamCost = parseFloat(data.Cost_Lam_Cast || 0.96);
    const inkCost = parseFloat(data.Cost_Ink_Latex || 0.16);
    
    L(`Job Setup (File RIP) [0.25 Hrs]`, (parseFloat(data.Time_Setup_Job || 15) / 60) * rateOp, `${V('Time_Setup_Job')} Mins * ${V('Rate_Operator')}`, 'graphics', 'graphics');
    L(`Printed Vinyl & Lam`, (panelSqFtExact * (vinylCost + lamCost + inkCost) * multDS) * rollWaste, `${panelSqFtExact.toFixed(1)} SF * (${V('Cost_Vin_Cast')} + ${V('Cost_Lam_Cast')} + ${V('Cost_Ink_Latex')}) * ${multDS} Sides * ${V('Waste_Factor')}`, 'graphics', 'graphics');
    
    const speedPrint = parseFloat(data.Speed_Print_Roll || 150);
    const printHrs = (panelSqFtExact / speedPrint) * multDS;
    L(`Print Machine Run [${printHrs.toFixed(2)} Hrs]`, printHrs * machPrint, `(${panelSqFtExact.toFixed(1)} SF / ${V('Speed_Print_Roll')} SF/Hr = ${printHrs.toFixed(2)} Hrs) * ${V('Rate_Machine_Print')}`, 'graphics', 'graphics');
    
    const timeMount = parseFloat(data.Time_Mount_SqFt || 2);
    const mountMins = panelSqFtExact * timeMount * multDS;
    L(`Vinyl Mount Labor [${(mountMins/60).toFixed(2)} Hrs]`, (mountMins / 60) * rateShop, `${panelSqFtExact.toFixed(1)} SF * ${V('Time_Mount_SqFt')} Mins/SF * ${multDS} Sides * ${V('Rate_Shop_Labor')}`, 'graphics', 'graphics');

    // --- 6. UNCONDITIONAL PAINTING & SANDING ---
    const panelArea = panelSqFtExact * multDS;
    let paintSqFt = panelArea + postArea + bracketArea + skinSqFt;
    
    const ratePaint = parseFloat(data.Rate_Paint_Labor || 150); 
    const costPaintMat = parseFloat(data.Cost_Paint_SqFt || 1.44);
    const overspray = parseFloat(data.Waste_Paint_Factor || 1.30);
    
    const timeSand = parseFloat(data.Time_Sand_SqFt || 1);
    const sandMins = paintSqFt * timeSand;
    L(`Sanding / Paint Prep [${(sandMins/60).toFixed(2)} Hrs]`, (sandMins / 60) * rateShop, `${paintSqFt.toFixed(1)} SF * ${V('Time_Sand_SqFt')} Mins/SF * ${V('Rate_Shop_Labor')}`, 'paint', 'struct_lab');
    
    const timePaintSetup = parseFloat(data.Time_Paint_Setup || 20);
    L(`Paint Mix & Setup [${(timePaintSetup/60).toFixed(2)} Hrs]`, (timePaintSetup / 60) * ratePaint, `${V('Time_Paint_Setup')} Mins * ${V('Rate_Paint_Labor')}`, 'paint', 'paint');
    
    const timePrimer = parseFloat(data.Time_Paint_Primer_SqFt || 1);
    const primerMins = paintSqFt * timePrimer;
    L(`Primer Application [${(primerMins/60).toFixed(2)} Hrs]`, (primerMins / 60) * ratePaint, `${paintSqFt.toFixed(1)} SF * ${V('Time_Paint_Primer_SqFt')} Mins/SF * ${V('Rate_Paint_Labor')}`, 'paint', 'paint');

    const timeFinish = parseFloat(data.Time_Paint_Finish_SqFt || 1);
    const finishMins = paintSqFt * timeFinish;
    L(`Finish Coat Application [${(finishMins/60).toFixed(2)} Hrs]`, (finishMins / 60) * ratePaint, `${paintSqFt.toFixed(1)} SF * ${V('Time_Paint_Finish_SqFt')} Mins/SF * ${V('Rate_Paint_Labor')}`, 'paint', 'paint');

    L(`Paint Materials (w/ Overspray)`, paintSqFt * costPaintMat * overspray, `${paintSqFt.toFixed(1)} SF * ${V('Cost_Paint_SqFt')} * ${V('Waste_Paint_Factor')}`, 'paint', 'paint');

    // --- 7. TOTALS & RETAIL BUCKETS ---
    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;

    const targetMargin = 0.60; 
    const markupMultiplier = 1 / (1 - targetMargin); 
    let grandTotalRaw = totalCost * markupMultiplier;
    
    let woodRetailOverride = 0;
    if (inputs.postType === 'Wood') {
        let totalPaintCost = cst.filter(i => i.cB === 'paint').reduce((sum, i) => sum + i.total, 0);
        let woodPaintRatio = paintSqFt > 0 ? (postArea / paintSqFt) : 0;
        let woodPaintHardCost = totalPaintCost * woodPaintRatio;
        
        let calculatedWoodRetail = (rawWoodHardCost + woodPaintHardCost) * riskFactor * markupMultiplier;
        woodRetailOverride = fixedWoodRetail - calculatedWoodRetail;
        
        grandTotalRaw += woodRetailOverride; 
    }

    const minOrder = parseFloat(data.Retail_Min_Order || 150);
    const isMinApplied = grandTotalRaw < minOrder;
    const grandTotal = Math.max(grandTotalRaw, minOrder) + routerRetailFee;

    const bucketTotals = { posts: 0, frame: 0, faces: 0, metal_fab: 0, paint: 0, graphics: 0, concrete: 0 };
    cst.forEach(i => { if(bucketTotals[i.rB] !== undefined) { bucketTotals[i.rB] += (i.total * riskFactor * markupMultiplier); } });
    
    if (inputs.postType === 'Wood') bucketTotals.posts += woodRetailOverride;

    const lineItems = [
        { label: 'Structural Posts', unit: bucketTotals.posts },
        { label: 'Internal Frame / Brackets', unit: bucketTotals.frame },
        { label: 'Faces', unit: bucketTotals.faces },
        { label: 'Metal Fab', unit: bucketTotals.metal_fab },
        { label: 'Graphics', unit: bucketTotals.graphics },
        { label: 'Paint & Finish', unit: bucketTotals.paint }
    ];
    
    if (inputs.incConcrete) lineItems.push({ label: 'Concrete', unit: bucketTotals.concrete });
    if (routerRetailFee > 0) lineItems.push({ label: 'CNC Routing Tax', unit: routerRetailFee });

    const retBreakdown = [
        { label: 'Market Value (60% Margin Target)', total: (totalCost * markupMultiplier), formula: `Total Hard Cost / (1 - 0.60)` }
    ];
    
    if (woodRetailOverride !== 0) retBreakdown.push({ label: 'Wood Post Retail Override', total: woodRetailOverride, formula: 'Fixed Target Retail - Calculated Margin' });
    if (isMinApplied) retBreakdown.push({ label: 'Shop Minimum Surcharge', total: minOrder - grandTotalRaw, formula: 'Minimum order difference' });
    if (routerRetailFee > 0) retBreakdown.push({ label: 'CNC Routing Surcharge', total: routerRetailFee, formula: 'Flat Cut Method Fee' });

    let overallW_Out = inputs.w;
    let postInset_Out = parseFloat(inputs.postInset) || 0;
    if (inputs.mountStyle === 'Between') overallW_Out = inputs.w + (postSizeInches * 2);

    const geometry = {
        w: inputs.w, h: inputs.h, post: postSizeInches, holeD: holeDiamInches,
        clearance: inputs.clearance, mount: inputs.mountStyle,
        inset: postInset_Out, above: inputs.aboveGrade, under: inputs.belowGrade,
        overallW: overallW_Out, sides: inputs.sides, frameThick: frameThickOut, faceThick: physThick,
        incConcrete: inputs.incConcrete,
        isBracket: inputs.frameMat === 'Brackets',
        bracketQty: inputs.bracketQty,
        bracketLen: inputs.bracketLen,
        frameW: frameW,
        frameH: frameH,
        braces: bracesCount
    };

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: retBreakdown, lineItems: lineItems, isMinApplied: isMinApplied },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: (grandTotal - totalCost) / grandTotal },
        geom: geometry,
        warnings: warnings
    };
}

// --- SANDBOX CONFIGURATION ---
window.POSTPANEL_CONFIG = {
    tab: 'PROD_Post_Panel',
    engine: calculatePostPanel,
    retails: [
        { key: 'Retail_Min_Order', label: 'Shop Minimum ($)' },
        { key: 'Retail_Fee_Router_Easy', label: 'CNC Easy Fee ($)' },
        { key: 'Retail_Fee_Router_Hard', label: 'CNC Hard Fee ($)' }
    ],
    costs: [
        { heading: 'Active Extrusion Stock', key: 'Cost_Post_Aluminum_3_1/8', label: '3" Alum Post 1/8" ($/LF)' },
        { key: 'Cost_Post_Aluminum_4_1/8', label: '4" Alum Post 1/8" ($/LF)' },
        { key: 'Cost_Post_Steel_3_1/8', label: '3" Steel Post 1/8" ($/LF)' },
        { key: 'Cost_Frame_AlumAngle_2_1/8', label: '2" Alum Angle ($/LF)' },
        { key: 'Cost_Frame_SteelAngle_2_1/8', label: '2" Steel Angle ($/LF)' },
        { key: 'Stock_Length_Alum_FT', label: 'Alum Stock (FT)' },
        { key: 'Stock_Length_Steel_FT', label: 'Steel Stock (FT)' },

        { heading: 'Structure & Substrates', key: 'Cost_Stock_040_5x10', label: '.040 Alum 5x10 ($/Sht)' },
        { key: 'Cost_Stock_063_5x10', label: '.063 Alum 5x10 ($/Sht)' },
        { key: 'Cost_Stock_080_5x10', label: '.080 Alum 5x10 ($/Sht)' },
        { key: 'Cost_Stock_3mm_4x8', label: '3mm ACM ($/Sht)' },
        { key: 'Cost_Stock_6mm_4x8', label: '6mm ACM ($/Sht)' },
        { key: 'Cost_Wood_8_Nat', label: '8ft Wood Nat ($/Ea)' },
        { key: 'Cost_Post_Cap', label: 'Hardware Cap Cost ($)' },
        { key: 'Cost_Adhesive_Tube', label: 'Adhesive ($/Tube)' },
        { key: 'Yield_Adhesive_Tube_LF', label: 'Adhesive Yld (LF)' },

        { heading: 'Concrete & Footers', key: 'Cost_Concrete_Bag', label: 'Concrete ($/Bag)' },
        { key: 'Yield_Concrete_Bag_CuFt', label: 'Concrete Yld (CuFt)' },

        { heading: 'Graphics & Print', key: 'Cost_Vin_Cast', label: 'Cast Vinyl ($/SqFt)' },
        { key: 'Cost_Lam_Cast', label: 'Cast Lam ($/SqFt)' },
        { key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },

        { heading: 'Paint & Finishes', key: 'Cost_Paint_SqFt', label: 'Paint Mat ($/SF)' },
        { key: 'Waste_Paint_Factor', label: 'Paint Overspray (1.x)' },

        { heading: 'Labor & Overhead ($/Hr)', key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Operator', label: 'Print Operator ($/Hr)' },
        { key: 'Rate_Machine_Print', label: 'Print Mach ($/Hr)' },
        { key: 'Rate_Machine_CNC', label: 'Router Mach ($/Hr)' },
        { key: 'Rate_Paint_Labor', label: 'Paint Labor ($/Hr)' },

        { heading: 'Process Times', key: 'Speed_Print_Roll', label: 'Print Speed (SF/Hr)' },
        { key: 'Time_Setup_Job', label: 'File Setup (Mins)' },
        { key: 'Time_Saw_Cut', label: 'Saw Cut (Mins/Ea)' },
        { key: 'Time_Weld_LF', label: 'Weld (Mins/LF)' },
        { key: 'Time_Grind_LF', label: 'Grind (Mins/LF)' },
        { key: 'Time_Adhesive_LF', label: 'Apply Glue (Mins/LF)' },
        { key: 'Time_Mount_SqFt', label: 'Mount Vinyl (Mins/SF)' },
        { key: 'Time_Sand_SqFt', label: 'Sanding (Mins/SF)' },
        { key: 'Time_Paint_Setup', label: 'Paint Mix (Mins)' },
        { key: 'Time_Paint_Primer_SqFt', label: 'Primer Spray (Mins/SF)' },
        { key: 'Time_Paint_Finish_SqFt', label: 'Finish Spray (Mins/SF)' },
        { key: 'Time_Shear_Setup', label: 'Shear Setup (Mins)' },
        { key: 'Time_CNC_Easy_SqFt', label: 'CNC Easy (Mins/SF)' },
        { key: 'Time_CNC_Complex_SqFt', label: 'CNC Hard (Mins/SF)' },

        { heading: 'Modifiers', key: 'Waste_Factor', label: 'Roll Waste Buffer' },
        { key: 'Waste_Factor_Rigid', label: 'Sheet Waste Buffer' },
        { key: 'Factor_Risk', label: 'Risk Buffer (1.x)' }
    ]
};