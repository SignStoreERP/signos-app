/**
 * SignOS SVG Outlining Engine (v1.7 - Measure & Scale)
 * Synchronizes production paths with editor visuals using absolute bounding math.
 */

async function triggerSvgExport() {
    console.log("🛠️ Initializing Scaled Production Export...");
    
    try {
        const DPI = 72; // 1 unit = 1 point
        const w = parseFloat(document.getElementById('w').value) || 0;
        const h = parseFloat(document.getElementById('h').value) || 0;
        const githubBase = "https://raw.githubusercontent.com/SignStoreERP/signos-app/main/fonts/";

        if (w <= 0 || h <= 0 || !selectedMat) {
            alert("Please ensure dimensions and material are selected.");
            return;
        }

        // 1. SYNC COLORS & MODES
        const isReverse = currentMode === 'reverse';
        let activePaintHex = "#FFFFFF"; 
        if (isReverse && selectedPaint) {
            activePaintHex = (selectedPaint.Code === 'CUSTOM') ? "#e2e8f0" : selectedPaint.Hex_Code;
        }

        const substrateHex = selectedMat.Cap_Hex || "#DDDDDD";
        const textColor = currentMode === 'front' ? selectedMat.Core_Hex : activePaintHex;
        const layerName = currentMode === 'front' ? "FRONT_ENGRAVE" : "REVERSE_FILL";

        // 2. PRE-RENDER DATA (The Measure Step)
        const linesCount = parseInt(document.getElementById('lines-per-sign').value) || 1;
        const gapPoints = (parseFloat(document.getElementById('line-spacing').value) || 0) * DPI;
        
        let renderedLines = [];
        let totalBlockHeight = 0;

        for (let i = 0; i < linesCount; i++) {
            const ls = lineSettings[i];
            const formattedText = typeof formatLineCase === 'function' ? formatLineCase(ls.text, ls.caseType) : ls.text;
            if (!formattedText || formattedText.trim() === "") continue;

            const fontObj = systemFonts.find(f => f.CSS_Family === ls.font);
            const fontUrl = githubBase + encodeURIComponent(fontObj.File_Name);
            
            const font = await new Promise((resolve, reject) => {
                opentype.load(fontUrl, (err, f) => err ? reject(err) : resolve(f));
            });

            // Create a "Reference Path" at size 1000 to get pure proportions
            const refSize = 1000;
            const refPath = font.getPath(formattedText, 0, 0, refSize);
            const refBox = refPath.getBoundingBox();
            
            // Calculate actual height required (ignoring internal font leading)
            const targetHeightPoints = ls.height * DPI;
            const inkHeightRef = refBox.y2 - refBox.y1;
            const scaleFactor = targetHeightPoints / inkHeightRef;

            renderedLines.push({
                text: formattedText,
                path: refPath, // We will transform the path data
                bbox: refBox,
                scale: scaleFactor,
                targetH: targetHeightPoints,
                lineId: i + 1
            });

            totalBlockHeight += targetHeightPoints;
        }

        if (renderedLines.length === 0) { alert("Enter text first!"); return; }

        // Add gaps to the total block height
        totalBlockHeight += (renderedLines.length - 1) * gapPoints;

        // 3. GENERATE SVG STRUCTURE
        let svgBody = `  <g id="SUBSTRATE" data-name="Material: ${selectedMat.Item_Code}">
    <rect width="${w * DPI}" height="${h * DPI}" fill="${substrateHex}" />
  </g>\n\n`;

        svgBody += `  <g id="PRODUCTION_ART" data-name="${layerName} (Hex: ${textColor})">\n`;

        // Start drawing from the vertical center of the sign
        let currentY = ((h * DPI) - totalBlockHeight) / 2;

        for (const line of renderedLines) {
            // Horizontal centering math
            const textWidthPoints = (line.bbox.x2 - line.bbox.x1) * line.scale;
            const centeredX = ((w * DPI) / 2) - (textWidthPoints / 2);

            // Vertical positioning: 
            // opentype.js draws from baseline (0). We must offset by the distance 
            // from the top of the 'ink' to the baseline.
            const verticalOffsetToBaseline = Math.abs(line.bbox.y1) * line.scale;
            const finalY = currentY + verticalOffsetToBaseline;

            // Generate Path Data and wrap in a group for specific line naming
            const pathData = line.path.toPathData();
            
            svgBody += `    <g id="Line_${line.lineId}" data-name="${line.text}">
      <path d="${pathData}" 
            fill="${textColor}" 
            stroke="${textColor}" 
            stroke-width="0.1" 
            transform="translate(${centeredX}, ${finalY}) scale(${line.scale})" />
    </g>\n`;

            // Move Y down for next line
            currentY += line.targetH + gapPoints;
        }
        svgBody += `  </g>`;

        // 4. FINAL ASSEMBLY
        const svgHeader = `<svg width="${w}in" height="${h}in" viewBox="0 0 ${w * DPI} ${h * DPI}" xmlns="http://www.w3.org/2000/svg">`;
        downloadBlob(`${svgHeader}\n${svgBody}\n</svg>`, `SignOS_PROD_${w}x${h}.svg`, 'image/svg+xml');
        
        console.log("🚀 Scaled Export Complete.");

    } catch (err) {
        console.error("❌ SVG Scaling Failed:", err);
    }
}

function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
