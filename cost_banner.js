/**
 * PURE PHYSICS ENGINE: Vinyl Banners (v11.0)
 * Math Ledger integration and explicit Hem/Grommet labor lines.
 */
function calculateBanner(inputs, data) {
    const sqft = Math.ceil((inputs.w * inputs.h) / 144);
    const totalSqFt = sqft * inputs.qty;

    // --- 1. RETAIL ENGINE ---
    const is1ft = (inputs.w === 12 || inputs.h === 12);
    let baseRate = 0;

    if (inputs.material === '15oz') baseRate = parseFloat(data.Retail_Price_Base_15oz || 7.50);
    else if (inputs.material === '18oz') baseRate = parseFloat(data.Retail_Price_Base_18oz || 8.00);
    else if (inputs.material === 'Mesh') baseRate = parseFloat(data.Retail_Price_Base_Mesh || 7.00);
    else {
        if (is1ft) baseRate = parseFloat(data.BAN13_T1_Rate || 6.50);
        else if (sqft < 10) baseRate = parseFloat(data.BAN13_T2_Rate || 6.00);
        else baseRate = parseFloat(data.BAN13_T3_Rate || 5.00);
    }

    let retailPrint = baseRate * totalSqFt;
    if (inputs.sides === 2) retailPrint += (parseFloat(data.Retail_Adder_DS_SqFt || 3.00) * totalSqFt);

    let pktFee = 0;
    if (inputs.pockets === 'Top') pktFee = (inputs.w / 12) * parseFloat(data.Retail_Fin_PolePkt_LF || 3) * inputs.qty;
    else if (inputs.pockets === 'TopBottom') pktFee = ((inputs.w * 2) / 12) * parseFloat(data.Retail_Fin_PolePkt_LF || 3) * inputs.qty;

    let windFee = inputs.windSlits === 'Yes' ? (totalSqFt * parseFloat(data.Retail_Price_WindSlits_SqFt || 1)) : 0;
    const feeSetup = parseFloat(data.Retail_Fee_Setup || 15);
    
    const minOrder = parseFloat(data.Retail_Min_Order || 50);
    const grandTotalRaw = retailPrint + pktFee + windFee + feeSetup;
    const grandTotal = Math.max(grandTotalRaw, minOrder);

    // --- 2. COST ENGINE (MATH LEDGER) ---
    const bd = [];
    const L = (label, total, formula) => { if(total > 0) bd.push({label, total, formula}); return total; };

    const wastePct = parseFloat(data.Waste_Factor || 1.15);
    const multDS = inputs.sides === 2 ? 2 : 1;
    
    let vinCostRate = 0.30;
    if(inputs.material === '15oz') vinCostRate = parseFloat(data.Cost_Media_15oz || 0.46);
    else if(inputs.material === '18oz') vinCostRate = parseFloat(data.Cost_Media_18oz || 0.39);
    else if(inputs.material === 'Mesh') vinCostRate = parseFloat(data.Cost_Media_Mesh || 0.33);
    else vinCostRate = parseFloat(data.Cost_Media_13oz || 0.25);

    L(`Banner Media (${inputs.material})`, totalSqFt * vinCostRate * wastePct, `${totalSqFt.toFixed(1)} SF * $${vinCostRate}/SF * Waste`);
    L(`Latex Ink`, totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * wastePct * multDS, `${totalSqFt.toFixed(1)} SF * $0.16/SF * Waste * ${multDS} Sides`);

    const rateOp = parseFloat(data.Rate_Operator || 25);
    const rateShop = parseFloat(data.Rate_Shop_Labor || 20);

    L(`Job Setup (File RIP)`, (15 / 60) * rateOp, `15 Mins * $${rateOp}/hr`);
    L(`Material Handling`, (5 / 60) * rateOp * multDS, `5 Mins * $${rateOp}/hr * ${multDS} Sides`);

    const printHrs = (totalSqFt / parseFloat(data.Speed_Print_Roll || 150)) * multDS;
    L(`Print Op (Attn Ratio)`, printHrs * rateOp * parseFloat(data.Labor_Attendance_Ratio || 0.10), `${printHrs.toFixed(2)} Hrs * $${rateOp}/hr * 10%`);
    L(`Printer Run`, printHrs * parseFloat(data.Rate_Machine_Print || 5), `${printHrs.toFixed(2)} Hrs * $5/hr`);

    // Finishing Math
    const perimeterLF = ((inputs.w * 2) + (inputs.h * 2)) / 12;
    L(`Hand Trimming (Perimeter)`, (perimeterLF * inputs.qty * parseFloat(data.Time_Cut_Hand || 0.25) / 60) * rateShop, `${(perimeterLF * inputs.qty).toFixed(1)} LF * 0.25 Mins/LF * $${rateShop}/hr`);

    if (inputs.hems) {
        const tapeCost = perimeterLF * inputs.qty * parseFloat(data.Cost_Hem_Tape || 0.08);
        L(`Hem Tape Material`, tapeCost, `${(perimeterLF * inputs.qty).toFixed(1)} LF * $0.08/LF`);
        const hemMins = perimeterLF * inputs.qty * parseFloat(data.Time_Hem_LF || 0.5);
        L(`Hemming Labor`, (hemMins / 60) * rateShop, `${(perimeterLF * inputs.qty).toFixed(1)} LF * 0.5 Mins/LF * $${rateShop}/hr`);
    }

    if (inputs.grommets) {
        const gromCount = (perimeterLF / 2) * inputs.qty; // Approx 1 every 2ft
        L(`Nickel Grommets`, gromCount * parseFloat(data.Cost_Grommet || 0.13), `~${gromCount.toFixed(0)} Grommets * $0.13/Ea`);
        L(`Grommet Press Labor`, (gromCount * parseFloat(data.Time_Grommet_Per || 1) / 60) * rateShop, `${gromCount.toFixed(0)} Grommets * 1 Min/Ea * $${rateShop}/hr`);
    }

    if (inputs.windSlits === 'Yes') {
        const slitMins = totalSqFt * parseFloat(data.Time_WindSlits_SqFt || 0.1);
        L(`Wind Slit Cutting`, (slitMins / 60) * rateShop, `${totalSqFt.toFixed(1)} SF * 0.1 Mins/SF * $${rateShop}/hr`);
    }

    let hardCostRaw = bd.reduce((sum, i) => sum + i.total, 0);
    const totalCost = hardCostRaw * parseFloat(data.Factor_Risk || 1.10);

    return {
        retail: { unitPrice: grandTotal / inputs.qty, printTotal: retailPrint, setupFee: feeSetup, grandTotal: grandTotal },
        cost: { total: totalCost, breakdown: bd },
        metrics: { margin: (grandTotal - totalCost) / grandTotal }
    };
}
// window.BANNER_CONFIG remains identical, just remove renderReceipt
