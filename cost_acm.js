// cost_acm.js - Physics & BOM Engine (ACM Signs)
function calculateCost(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    const waste = parseFloat(data.Waste_Factor || 1.20);

    // 1. Stock Yield Optimization Engine
    const stocks = inputs.thickness === "3mm" ? [
        { id: "4x8", w: 48, h: 96, cost: parseFloat(data.Cost_Stock_3mm_4x8 || 52) },
        { id: "4x10", w: 48, h: 120, cost: parseFloat(data.Cost_Stock_3mm_4x10 || 69) },
        { id: "5x10", w: 60, h: 120, cost: parseFloat(data.Cost_Stock_3mm_5x10 || 75) }
    ] : [
        { id: "4x8", w: 48, h: 96, cost: parseFloat(data.Cost_Stock_6mm_4x8 || 72) },
        { id: "5x10", w: 60, h: 120, cost: parseFloat(data.Cost_Stock_6mm_5x10 || 132) }
    ];

    let bestStock = { id: "Oversized", cost: Infinity, sheets: 0 };
    stocks.forEach(stk => {
        const effW = stk.w - 1; // 0.5" margin all around
        const effH = stk.h - 1;
        const fit1 = Math.floor(effW / inputs.w) * Math.floor(effH / inputs.h);
        const fit2 = Math.floor(effW / inputs.h) * Math.floor(effH / inputs.w);
        const yieldPerSheet = Math.max(fit1, fit2);

        if (yieldPerSheet > 0) {
            const sheets = Math.ceil(inputs.qty / yieldPerSheet);
            const totalCost = sheets * stk.cost;
            if (totalCost < bestStock.cost) {
                bestStock = { id: stk.id, cost: totalCost, sheets: sheets };
            }
        }
    });

    const costMat = bestStock.cost * waste;

    // 2. Ink & Laminate
    // Note: Force-using Latex for Rigid as per shop rules (R1000)
    const costInk = totalSqFt * parseFloat(data.Cost_Ink_Latex || 0.16) * inputs.sides;
    const costLam = totalSqFt * parseFloat(data.Cost_Lam_SqFt || 0.36) * waste;

    // 3. R1000 Print Physics (Linear Feed)
    const bedW = 64;
    let fitPerRow = 0; let feedLen = 0;
    const fit1 = Math.floor(bedW / inputs.w); const fit2 = Math.floor(bedW / inputs.h);
    if (fit1 > 0 && fit1 >= fit2) { fitPerRow = fit1; feedLen = inputs.h; }
    else if (fit2 > 0) { fitPerRow = fit2; feedLen = inputs.w; }
    
    const totalFeedInches = Math.ceil(inputs.qty / (fitPerRow || 1)) * feedLen;
    const printHrs = ((totalFeedInches / 12) / parseFloat(data.Speed_Print_LF || 25)) * inputs.sides;
    const costPrintMach = printHrs * parseFloat(data.Rate_Machine_Flatbed || 45);

    // 4. Cutting Labor (Shear vs CNC)
    let costCutMach = 0;
    let cutHrs = 0;
    if (inputs.shape === 'Rectangle') {
        // Shop Labor (Shear)
        cutHrs = (parseFloat(data.Time_Shear_Base || 5) + (inputs.qty * parseFloat(data.Time_Shear_Add || 3))) / 60;
    } else {
        // CNC Router
        const timePerUnit = inputs.shape === 'Easy' ? 3 : 8; // Mins
        cutHrs = (inputs.qty * timePerUnit) / 60;
        costCutMach = cutHrs * parseFloat(data.Rate_Machine_CNC || 35);
    }

    // 5. General Labor
    const opHrs = printHrs + cutHrs + (parseFloat(data.Time_Handling || 5) / 60);
    const costOp = opHrs * parseFloat(data.Rate_Operator || 25);
    
    const setupHrs = parseFloat(data.Time_Setup_Job || 10) / 60;
    const costSetup = setupHrs * parseFloat(data.Rate_Operator || 25);

    const totalCost = costMat + costInk + costLam + costPrintMach + costCutMach + costOp + costSetup;

    return {
        bom: { stock: bestStock, sheets: bestStock.sheets, inkSqFt: totalSqFt },
        time: { printHrs, cutHrs, setupHrs },
        financials: { total: totalCost }
    };
}
