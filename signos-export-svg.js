/**
 * SignOS SVG Outlining Engine (v1.6 - Precision Alignment)
 * Fixes getBoundingBox error and syncs optical baseline with SignOS Physics.
 */

async function triggerSvgExport() {
    console.log("🛠️ Initializing Layered Production Export...");
    
    try {
        const DPI = 72; 
        const w = parseFloat(document.getElementById('w').value) || 0;
        const h = parseFloat(document.getElementById('h').value) || 0;
        const githubBase = "https://raw.githubusercontent.com/SignStoreERP/signos-app/main/fonts/";

        if (w <= 0 || h <= 0 || !selectedMat) {
            alert("Please ensure dimensions and material are selected.");
            return;
        }

        // 1. COLOR & LAYER METADATA
        const isReverse = currentMode === 'reverse';
        let activePaintHex = "#FFFFFF"; 
        if (isReverse && selectedPaint) {
            activePaintHex = (selectedPaint.Code === 'CUSTOM') ? "#e2e8f0" : selectedPaint.Hex_Code;
        }

        const substrateHex = selectedMat.Cap_Hex || "#DDDDDD";
        const textColor = currentMode === 'front' ? selectedMat.Core_Hex : activePaintHex;
        const layerName = currentMode === 'front' ? "FRONT_ENGRAVE" : "REVERSE_FILL";

        // 2. LAYOUT ENGINE (Sync with visual preview)
        const linesCount = parseInt(document.getElementById('lines-per-sign').value) || 1;
        const overflowMode = document.getElementById('overflow-mode').value;
        const gapInches = parseFloat(document.getElementById('line-spacing').value) || 0;
        const availableW = w - 0.5; 
        const capRatio = 0.72; // SignOS Typography Standard

        let renderedLines = [];
        let totalContentHeight = 0;

        for (let i = 0; i < linesCount; i++) {
            const ls = lineSettings[i];
            const formattedText = typeof formatLineCase === 'function' ? formatLineCase(ls.text, ls.caseType) : ls.text;
            if (!formattedText || formattedText.trim() === "") continue;

            let targetH = ls.height;
            const absoluteMax = SignOS_Canvas.calcMaxHeightForText(formattedText, ls.font, availableW);

            if (overflowMode === 'shrink' && targetH > absoluteMax) {
                targetH = Math.max(0.125, Math.floor(absoluteMax / 0.125) * 0.125);
            }

            const fontObj = systemFonts.find(f => f.CSS_Family === ls.font);
            const fontUrl = githubBase + encodeURIComponent(fontObj.File_Name);
            
            const font = await new Promise((resolve, reject) => {
                opentype.load(fontUrl, (err, f) => err ? reject(err) : resolve(f));
            });

            const fontSize = (targetH / capRatio) * DPI;
            renderedLines.push({ text: formattedText, font: font, hInches: targetH, fontSize: fontSize, id: i+1 });
            totalContentHeight += targetH;
        }

        if (renderedLines.length === 0) { alert("Enter some text first!"); return; }

        totalContentHeight += (renderedLines.length - 1) * gapInches;
        
        // Start Y = center the entire block vertically
        let currentY = ((h - totalContentHeight) / 2) * DPI; 

        // 3. GENERATE SVG STRUCTURE
        let svgBody = `  <g id="SUBSTRATE" data-name="Substrate: ${selectedMat.Item_Code}">
    <rect width="${w * DPI}" height="${h * DPI}" fill="${substrateHex}" />
  </g>\n\n`;

        svgBody += `  <g id="PRODUCTION_ART" data-name="${layerName} (Color: ${textColor})">\n`;

        for (const line of renderedLines) {
            // Get path data at 0,0 first to measure it
            const path = line.font.getPath(line.text, 0, 0, line.fontSize);
            const bbox = path.getBoundingBox(); // FIXED: Removed 'to' from method name
            
            // X Centering
            const textWidth = bbox.x2 - bbox.x1;
            const centeredX = ((w * DPI) / 2) - (textWidth / 2);

            /** * OPTICAL BASELINE FIX: 
             * In SVG, Y increases downward. To align the 'top' of the letters with our 
             * calculated currentY, we set the baseline to currentY + the distance from 
             * the font's baseline to its top (yMax).
             */
            const baselineY = currentY + (Math.abs(bbox.y1));

            svgBody += `    <path id="LINE_${line.id}" data-name="${line.text}" d="${path.toPathData()}" fill="${textColor}" transform="translate(${centeredX}, ${baselineY})" />\n`;
            
            // Advance Y for the next line
            currentY += (line.hInches + gapInches) * DPI;
            console.log(`✅ Outlined: "${line.text}" at Y:${baselineY.toFixed(2)}`);
        }
        svgBody += `  </g>`;

        // 4. DOWNLOAD BLOB
        const svgHeader = `<svg width="${w}in" height="${h}in" viewBox="0 0 ${w * DPI} ${h * DPI}" xmlns="http://www.w3.org/2000/svg">`;
        downloadBlob(`${svgHeader}\n${svgBody}\n</svg>`, `SignOS_PROD_${selectedMat.Item_Code}_${w}x${h}.svg`, 'image/svg+xml');

    } catch (err) {
        console.error("❌ SVG Export Failed:", err);
    }
}

function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
