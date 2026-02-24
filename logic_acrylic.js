/**
 * ULTRA-SIMPLE RETAIL ENGINE: Acrylic Signs
 * Fixed Decimal Matching + Dynamic CNC Routing Fees
 */
function calculateAcrylic(inputs, data) {
    const sqft = (inputs.w * inputs.h) / 144;
    const totalSqFt = sqft * inputs.qty;
    let baseSqFtRate = 0;

    const thick = String(inputs.thickness);

    // 1. Fixed Matching Logic (Accepts fractions or decimals)
    if (thick.includes('1/4') || thick.includes('0.25') || thick.includes('.25')) {
        if (totalSqFt <= (parseFloat(data.ACR_14_T1_Max) || 0)) {
            baseSqFtRate = parseFloat(data.ACR_14_T1_Rate) || 0;
        } else if (totalSqFt <= (parseFloat(data.ACR_14_T2_Max) || 0)) {
            baseSqFtRate = parseFloat(data.ACR_14_T2_Rate) || 0;
        } else {
            baseSqFtRate = parseFloat(data.ACR_14_T3_Rate) || 0;
        }
    } 
    else if (thick.includes('1/2') || thick.includes('0.5') || thick.includes('.5')) {
        if (totalSqFt <= (parseFloat(data.ACR_12_T1_Max) || 0)) {
            baseSqFtRate = parseFloat(data.ACR_12_T1_Rate) || 0;
        } else {
            baseSqFtRate = parseFloat(data.ACR_12_T2_Rate) || 0;
        }
    } 
    else if (thick.includes('3/4') || thick.includes('0.75') || thick.includes('.75')) {
        if (totalSqFt <= (parseFloat(data.ACR_34_T1_Max) || 0)) {
            baseSqFtRate = parseFloat(data.ACR_34_T1_Rate) || 0;
        } else {
            baseSqFtRate = parseFloat(data.ACR_34_T2_Rate) || 0;
        }
    } 
    else if (thick.includes('1') || thick.includes('1.0')) {
        if (totalSqFt <= (parseFloat(data.ACR_1IN_T1_Max) || 0)) {
            baseSqFtRate = parseFloat(data.ACR_1IN_T1_Rate) || 0;
        } else {
            baseSqFtRate = parseFloat(data.ACR_1IN_T2_Rate) || 0;
        }
    }

    const retailPrint = baseSqFtRate * totalSqFt;

    // 2. Dynamic CNC Router Logic (Pulls strictly from Sheet)
    let routerFee = 0;
    if (inputs.shape === 'CNC Simple') {
        routerFee = parseFloat(data.Retail_Fee_Router_Easy) || 0;
    } else if (inputs.shape === 'CNC Complex') {
        routerFee = parseFloat(data.Retail_Fee_Router_Hard) || 0;
    }

    const setupFee = parseFloat(data.Retail_Fee_Setup) || 0;
    const minOrder = parseFloat(data.Retail_Min_Order) || 0;
    
    let grandTotal = retailPrint + setupFee + routerFee;
    grandTotal = Math.max(grandTotal, minOrder);

    return {
        retail: {
            unitPrice: grandTotal / inputs.qty,
            printTotal: retailPrint,
            setupFee: setupFee,
            routerFee: routerFee, // Added for UI display
            grandTotal: grandTotal,
            isMinApplied: (retailPrint + setupFee + routerFee) < minOrder
        },
        cost: { total: 0 } 
    };
}
Step 2: Add the Dropdown & Restrict the Color in HTML
To support this new logic, you need to add the Cutting Method dropdown to your Calculator_Acrylic.html file, and a quick script to disable the Black color option.
1. Add the Shape Dropdown to your HTML layout: Paste this right alongside your other dropdowns (like Width/Height/Thickness):
<div class="flex flex-col">
    <label class="text-xs font-bold text-gray-500 uppercase mb-1">Cutting Method</label>
    <select id="shape" class="w-full border border-gray-300 rounded p-2 text-sm bg-gray-50" onchange="runCalc()">
        <option value="Rectangle">Standard (Square/Rectangle)</option>
        <option value="CNC Simple">CNC (Simple Shape)</option>
        <option value="CNC Complex">CNC (Complex Shape)</option>
    </select>
</div>
2. Make sure your inputs object grabs the new shape! Inside your runCalc() function, add the shape input so the engine can see it:
const inputs = {
    // ... your other inputs ...
    shape: document.getElementById('shape') ? document.getElementById('shape').value : 'Rectangle'
};
3. The UI Constraint Script (Lock Black to 0.25") Paste this exact script at the bottom of your <script> tag inside Calculator_Acrylic.html, right below the window.onload section. It actively watches the thickness menu and disables the "Black" option if anything other than 1/4" is selected.
document.getElementById('thickness').addEventListener('change', function(e) {
    const colorDropdown = document.getElementById('color');
    if (!colorDropdown) return;

    // Check if the selected thickness contains 1/4 or 0.25
    const isQuarterInch = e.target.value.includes('1/4') || e.target.value.includes('0.25');
    
    // Loop through color options and disable 'Black' if not 1/4"
    for (let i = 0; i < colorDropdown.options.length; i++) {
        if (colorDropdown.options[i].value === 'Black') {
            colorDropdown.options[i].disabled = !isQuarterInch;
        }
    }
    
    // If Black was selected and they changed thickness, bump them back to White
    if (!isQuarterInch && colorDropdown.value === 'Black') {
        colorDropdown.value = 'White'; 
    }
    
    runCalc(); // Auto-recalculate the price
});
