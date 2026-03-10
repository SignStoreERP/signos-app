/**
 * PURE PHYSICS ENGINE: Post & Panel Signs (v1.2)
 * Features: 2D Shop Drawing Geometry, Structural Mount Math, Frame Profiles.
 */

function calculatePostPanel(inputs, data) {
    const cst = [];
    
    const getDesc = (k) => data['META_NOTE_' + k] || "System parameter.";
    const V = (k) => `<span class="hover-var text-blue-600 border-b border-dotted border-blue-400 cursor-help transition-all" data-var="${k}" title="${getDesc(k)}">[${k}]</span>`;
    const L = (label, total, formula) => { if(total > 0) cst.push({label, total, formula}); return total; };

    // --- 1. CORE DIMENSIONS & YIELD ---
    const panelSqFt = (inputs.w * inputs.h) / 144;
    const clearanceFt = inputs.clearance / 12; 
    const panelHeightFt = inputs.h / 12;
    
    const aboveGroundFt = clearanceFt + panelHeightFt;
    const minUndergroundFt = aboveGroundFt * 0.20;
    const standardUndergroundFt = aboveGroundFt / 3;
    const undergroundFt = Math.max(standardUndergroundFt, minUndergroundFt);
    
    const totalPostFt = aboveGroundFt + undergroundFt;
    const totalPoleLF = totalPostFt * 2; 
    const postSizeInches = parseFloat(inputs.postSize);

    // Calculate Overall Width based on Mounting Style
    let overallW = inputs.w;
    let postInset = 0;
    if (inputs.mountStyle === 'Between') {
        overallW = inputs.w + (postSizeInches * 2);
    } else {
        postInset = parseFloat(inputs.postInset) || 0;
    }

    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const riskFactor = parseFloat(data.Factor_Risk || 1.05);

    // --- 2. POSTS & CONCRETE ---
    let postCostLF = 0;
    if (inputs.postType === 'Aluminum') postCostLF = postSizeInches === 4 ? 8.40 : (postSizeInches === 6 ? 13.00 : 6.95);
    else if (inputs.postType === 'Steel') postCostLF = postSizeInches === 3 ? 18.00 : (postSizeInches === 4 ? 23.00 : 35.00);
    
    L(`Structural Posts (${inputs.postType} ${inputs.postSize}")`, totalPoleLF * postCostLF * wastePct, `${totalPoleLF.toFixed(1)} LF * $${postCostLF.toFixed(2)}/LF * ${V('Waste_Factor')}`);
    
    let capCost = inputs.postSize === '4' ? 8.00 : (inputs.postSize === '6' ? 10.00 : 5.00);
    L(`Post Caps (${inputs.postSize}")`, 2 * capCost, `2 Caps * $${capCost.toFixed(2)}/ea`);

    const holeRadiusFt = ((postSizeInches * 3) / 2) / 12;
    const holeVolumeCuFt = Math.PI * Math.pow(holeRadiusFt, 2) * undergroundFt;
    const bagsNeeded = Math.ceil((holeVolumeCuFt * 2) / 0.6); 
    const bagCost = 12.00; 
    
    L(`Concrete (80lb Bags)`, bagsNeeded * bagCost, `${bagsNeeded} Bags (0.6 cu ft yield) * $${bagCost.toFixed(2)}/ea`);

    // --- 3. INTERNAL SKELETON (FRAME & BRACING) ---
    const perimeterLF = ((inputs.w * 2) + (inputs.h * 2)) / 12;
    let braces = inputs.h > 24 ? Math.floor(inputs.w / 48) : 0;
    const totalFrameLF = perimeterLF + (braces * panelHeightFt);
    
    // Evaluate selected frame material costs
    let frameCostLF = 1.45; // Default 2" Angle
    let frameDesc = '2" Steel Angle';
    if (inputs.frameMat === 'Angle15') { frameCostLF = 1.20; frameDesc = '1.5" Steel Angle'; }
    if (inputs.frameMat === 'Tube10') { frameCostLF = 1.40; frameDesc = '1" Steel Sq. Tube'; }
    if (inputs.frameMat === 'Tube20') { frameCostLF = 2.50; frameDesc = '2" Steel Sq. Tube'; }

    L(`Internal Skeleton (${frameDesc})`, totalFrameLF * frameCostLF * wastePct, `${totalFrameLF.toFixed(1)} LF * $${frameCostLF.toFixed(2)}/LF * ${V('Waste_Factor')}`);

    // --- 4. FABRICATION LABOR & ADHESIVE ---
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);
    
    const totalCuts = 2 + 4 + braces;
    L(`Saw Cuts & Setup`, (totalCuts * 10 / 60) * rateShop, `${totalCuts} Cuts * 10 Mins * ${V('Rate_Shop_Labor')}`);
    L(`Tack Welding`, (totalFrameLF * 1 / 60) * rateShop, `${totalFrameLF.toFixed(1)} LF * 1 Min/LF * ${V('Rate_Shop_Labor')}`);
    L(`Weld Grinding`, (totalFrameLF * 1 / 60) * rateShop, `${totalFrameLF.toFixed(1)} LF * 1 Min/LF * ${V('Rate_Shop_Labor')}`);

    const cartridges = Math.ceil(totalFrameLF / 10);
    L(`Lord's Adhesive (Metal Glue)`, cartridges * 18.71, `${cartridges} Cartridges (1 per 10 LF) * $18.71/ea`);
    L(`Adhesive Application`, (totalFrameLF * 0.5 / 60) * rateShop, `${totalFrameLF.toFixed(1)} LF * 0.5 Mins/LF * ${V('Rate_Shop_Labor')}`);

    // --- 5. PRINTING & VINYL MOUNTING ---
    const multDS = inputs.sides === 2 ? 2 : 1;
    const rateOp = parseFloat(data.Rate_Operator || 25);
    const machPrint = parseFloat(data.Rate_Machine_Print || 5);

    let subCost = 1.50;
    if (inputs.faceMat === '040 Alum') subCost = 84.44 / 40;
    else if (inputs.faceMat === '063 Alum') subCost = 98.12 / 32;
    else if (inputs.faceMat === '080 Alum') subCost = 124.57 / 32;
    else if (inputs.faceMat === '3mm ACM') subCost = 52.09 / 32;
    else if (inputs.faceMat === '6mm ACM') subCost = 72.10 / 32;

    L(`Face Substrate (${inputs.faceMat})`, (panelSqFt * subCost * multDS) * wastePct, `${panelSqFt.toFixed(1)} SF * $${subCost.toFixed(2)}/SF * ${multDS} Sides`);
    
    const vinylCost = parseFloat(data.Cost_Vin_Cast || 1.30);
    const lamCost = parseFloat(data.Cost_Lam_Cast || 0.96);
    const inkCost = parseFloat(data.Cost_Ink_Latex || 0.16);
    
    L(`Printed Vinyl & Lam`, (panelSqFt * (vinylCost + lamCost + inkCost) * multDS) * wastePct, `${panelSqFt.toFixed(1)} SF * Media/Ink/Lam * ${multDS} Sides`);
    
    const printHrs = (panelSqFt / 150) * multDS;
    L(`Print Machine Run`, printHrs * machPrint, `${printHrs.toFixed(2)} Hrs * ${V('Rate_Machine_Print')}`);
    L(`Vinyl Mount Labor`, ((panelSqFt * 2 / 60) * rateShop) * multDS, `${panelSqFt.toFixed(1)} SF * 2 Mins/SF * ${multDS} Sides`);

    // --- 6. PAINTING ---
    const postSurfaceArea = (postSizeInches / 12) * 4 * totalPoleLF;
    const paintSqFt = (panelSqFt * multDS) + postSurfaceArea;
    const ratePaint = parseFloat(data.Rate_Paint_Labor || 30);
    
    L(`Sanding / Paint Prep`, (paintSqFt * 1 / 60) * rateShop, `${paintSqFt.toFixed(1)} Total SF * 1 Min/SF * ${V('Rate_Shop_Labor')}`);
    L(`Paint Mix & Setup`, (20 / 60) * ratePaint, `20 Mins * $${ratePaint}/hr`);
    L(`Painting Labor`, (paintSqFt * 5 / 60) * ratePaint, `${paintSqFt.toFixed(1)} SF * 5 Mins/SF * $${ratePaint}/hr`);
    L(`Paint Materials`, paintSqFt * 2.50, `${paintSqFt.toFixed(1)} SF * $2.50/SF`);

    // --- 7. TOTALS & COST-PLUS ---
    let hardCostRaw = cst.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * riskFactor;

    // TARGET 60% MARGIN
    const targetMargin = 0.60; 
    const markupMultiplier = 1 / (1 - targetMargin); 
    const grandTotalRaw = totalCost * markupMultiplier;
    
    const minOrder = parseFloat(data.Retail_Min_Order || 150);
    const isMinApplied = grandTotalRaw < minOrder;
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    const retBreakdown = [
        { label: 'Market Value (60% Margin Target)', total: grandTotalRaw, formula: `Total Hard Cost / (1 - 0.60)` }
    ];

    if (isMinApplied) retBreakdown.push({ label: 'Shop Minimum Surcharge', total: minOrder - grandTotalRaw, formula: 'Minimum order difference' });

    // Pack geometry details for the 2D Viewers
    const geometry = {
        w: inputs.w,
        h: inputs.h,
        post: postSizeInches,
        clearance: inputs.clearance,
        mount: inputs.mountStyle,
        inset: postInset,
        above: aboveGroundFt * 12,
        under: undergroundFt * 12,
        overallW: overallWidth
    };

    return {
        retail: { unitPrice: grandTotal / inputs.qty, grandTotal: grandTotal, breakdown: retBreakdown, isMinApplied: isMinApplied },
        cost: { total: totalCost, breakdown: cst },
        metrics: { margin: targetMargin },
        geom: geometry
    };
}

// --- SANDBOX CONFIGURATION ---
window.POSTPANEL_CONFIG = {
    tab: 'PROD_Post_Panel',
    engine: calculatePostPanel,
    retails: [
        { key: 'Retail_Min_Order', label: 'Shop Minimum ($)' }
    ],
    costs: [
        { key: 'Rate_Shop_Labor', label: 'Shop Labor ($/Hr)' },
        { key: 'Rate_Operator', label: 'Print Operator ($/Hr)' },
        { key: 'Rate_Machine_Print', label: 'Printer Mach ($/Hr)' },
        { key: 'Cost_Vin_Cast', label: 'Cast Vinyl ($/SqFt)' },
        { key: 'Cost_Lam_Cast', label: 'Cast Lam ($/SqFt)' },
        { key: 'Cost_Ink_Latex', label: 'Latex Ink ($/SqFt)' },
        { key: 'Waste_Factor', label: 'Waste Buffer (1.x)' },
        { key: 'Factor_Risk', label: 'Risk Buffer (1.x)' }
    ]
};