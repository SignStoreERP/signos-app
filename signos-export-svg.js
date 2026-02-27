/**
 * SignOS SVG Outlining Engine (v1.4 - Production Accuracy)
 * Syncs colors and coordinates with the live editor's "Physics."
 */

async function triggerSvgExport() {
    console.log("🛠️ Initializing SignOS Production Export...");
    
    try {
        const DPI = 72; // Standard 72 points per inch
        const w = parseFloat(document.getElementById('w').value) || 0;
        const h = parseFloat(document.getElementById('h').value) || 0;
        const githubBase = "https://raw.githubusercontent.com/SignStoreERP/signos-app/main/fonts/";

        if (w <= 0 || h <= 0 || !selectedMat) {
            alert("Please ensure dimensions and material are selected.");
            return;
        }

        // 1. DYNAMIC COLOR SYNC (Match runCalc exactly)
        const pmsCode = document.getElementById('pms-code')?.value.trim() || "";
        const isReverse = currentMode === 'reverse';
        let activePaintHex = "#FFFFFF"; 

        if (isReverse) {
            if (selectedPaint && selectedPaint.Code === 'CUSTOM') {
                activePaintHex = "#e2e8f0"; // Custom Match placeholder color
            } else if (selectedPaint) {
                activePaintHex = selectedPaint.Hex_Code;
            }
        }

        const substrateHex = selectedMat.Cap_Hex || "#DDDDDD";
        const textColor = currentMode === 'front' ? selectedMat.Core_Hex : activePaintHex;
        
        console.log(`🎨 Color Sync: Substrate[${substrateHex}] Text[${textColor}]`);

        // 2. LAYOUT VARIABLES
        const linesCount = parseInt(document.getElementById('lines-per-sign').value) || 1;
        const overflowMode = document.getElementById('overflow-mode').value;
        const gapInches = parseFloat(document.getElementById('line-spacing').value) || 0;
        const availableW = w - 0.5; // Padding buffer from editor
        const capRatio = 0.72; // Standard SignOS Typography Ratio

        let renderedData = [];
        let totalBlockHeight = 0;

        // 3. PRE-PROCESS LINES (Calculate scaling and block size)
        for (let i = 0; i < linesCount; i++) {
            const ls = lineSettings[i];
            const formattedText = formatLineCase(ls.text, ls.caseType);
            if (!formattedText) continue;

            let targetH = ls.height;
            const absoluteMax = SignOS_Canvas.calcMaxHeightForText(formattedText, ls.font, availableW);

            if (overflowMode === 'shrink' && targetH > absoluteMax) {
                targetH = Math.max(0.125, Math.floor(absoluteMax / 0.125) * 0.125);
            }

            const fontObj = systemFonts.find(f => f.CSS_Family === ls.font);
            if (!fontObj) {
                console.warn(`Font ${ls.font} not found. Using fallback.`);
                continue;
            }

            const fontUrl = githubBase + encodeURIComponent(fontObj.File_Name);
            const font = await new Promise((resolve, reject) => {
                opentype.load(fontUrl, (err, f) => err ? reject(err) : resolve(f));
            });

            // Convert cap-height (entered by user) to em-size (used by opentype.js)
            const fontSize = (targetH / capRatio) * DPI;
            
            renderedData.push({
                text: formattedText,
                font: font,
                hInches: targetH,
                fontSize: fontSize
            });

            totalBlockHeight += targetH;
        }

        totalBlockHeight += (renderedData.length - 1) * gapInches;
        
        // Vertical Centering Calculation
        let currentY = ((h - totalBlockHeight) / 2) * DPI; 

        // 4. GENERATE SVG PATHS
        let svgPaths = "";
        for (const line of renderedData) {
            // opentype.js renders from the baseline. 
            // We add the cap-height to currentY to reach the baseline.
            const baselineY = currentY + (line.hInches * DPI);

            const path = line.font.getPath(line.text, 0, 0, line.fontSize);
            const bbox = path.getBoundingBox();
            const textWidth = bbox.x2 - bbox.x1;
            
            // Horizontal Centering
            const centeredX = ((w * DPI) / 2) - (textWidth / 2);

            svgPaths += `  <path d="${path.toPathData()}" fill="${textColor}" transform="translate(${centeredX}, ${baselineY})" />\n`;
            
            // Increment Y for the next line
            currentY += (line.hInches + gapInches) * DPI;
            console.log(`✅ Outlined Line: "${line.text}"`);
        }

        // 5. ASSEMBLE & DOWNLOAD
        const svgHeader = `<svg width="${w}in" height="${h}in" viewBox="0 0 ${w * DPI} ${h * DPI}" xmlns="http://www.w3.org/2000/svg">`;
        const svgBackground = `<rect width="100%" height="100%" fill="${substrateHex}" />`;
        const fullSvg = `${svgHeader}\n${svgBackground}\n${svgPaths}\n</svg>`;

        downloadBlob(fullSvg, `SignOS_Production_${w}x${h}.svg`, 'image/svg+xml');
        console.log("🚀 Export Complete.");

    } catch (err) {
        console.error("❌ SVG Match Failed:", err);
        alert("Export failed. Check console for specific font or variable errors.");
    }
}

function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
