/**
 * SignOS SVG Outlining Engine (v1.5 - Production Layered Version)
 * Fixes Typography Baseline Alignment and adds Named Layers for Illustrator.
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

        // 1. COLOR & METADATA SYNC
        const isReverse = currentMode === 'reverse';
        let activePaintHex = "#FFFFFF"; 
        if (isReverse && selectedPaint) {
            activePaintHex = (selectedPaint.Code === 'CUSTOM') ? "#e2e8f0" : selectedPaint.Hex_Code;
        }

        const substrateHex = selectedMat.Cap_Hex || "#DDDDDD";
        const textColor = currentMode === 'front' ? selectedMat.Core_Hex : activePaintHex;
        const layerName = currentMode === 'front' ? "FRONT_ENGRAVE" : "REVERSE_FILL";

        // 2. LAYOUT CALCULATIONS (Sync with Visual Editor)
        const linesCount = parseInt(document.getElementById('lines-per-sign').value) || 1;
        const overflowMode = document.getElementById('overflow-mode').value;
        const gapInches = parseFloat(document.getElementById('line-spacing').value) || 0;
        const availableW = w - 0.5; 
        const capRatio = 0.72; // SignOS Typography Standard

        let renderedData = [];
        let totalBlockHeight = 0;

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
            const fontUrl = githubBase + encodeURIComponent(fontObj.File_Name);
            const font = await new Promise((resolve, reject) => {
                opentype.load(fontUrl, (err, f) => err ? reject(err) : resolve(f));
            });

            // Physics Fix: Calculate Y-Correction based on the font's actual bounding box
            const fontSize = (targetH / capRatio) * DPI;
            renderedData.push({ text: formattedText, font: font, hInches: targetH, fontSize: fontSize, id: i+1 });
            totalBlockHeight += targetH;
        }

        totalBlockHeight += (renderedData.length - 1) * gapInches;
        let currentY = ((h - totalBlockHeight) / 2) * DPI; 

        // 3. GENERATE SVG WITH NAMED LAYERS
        let svgBody = `  <g id="SUBSTRATE" data-name="Substrate (${selectedMat.Item_Code})">
    <rect width="${w * DPI}" height="${h * DPI}" fill="${substrateHex}" />
  </g>\n\n`;

        svgBody += `  <g id="TEXT_OBJECTS" data-name="${layerName} (Color: ${textColor})">\n`;

        for (const line of renderedData) {
            const path = line.font.getPath(line.text, 0, 0, line.fontSize);
            const bbox = path.toBoundingBox();
            
            // X Centering
            const textWidth = bbox.x2 - bbox.x1;
            const centeredX = ((w * DPI) / 2) - (textWidth / 2);

            /** * BASELINE CORRECTION: 
             * opentype.js draws from the baseline (y=0). 
             * We must shift the text down by its own cap-height (line.hInches) 
             * and then subtract the 'descent' (space below baseline) to center perfectly.
             */
            const baselineY = currentY + (line.hInches * DPI) - (bbox.y2 - (line.hInches * DPI));

            svgBody += `    <path id="LINE_${line.id}" data-name="${line.text}" d="${path.toPathData()}" fill="${textColor}" transform="translate(${centeredX}, ${baselineY})" />\n`;
            
            currentY += (line.hInches + gapInches) * DPI;
        }
        svgBody += `  </g>`;

        // 4. ASSEMBLE FINAL FILE
        const svgHeader = `<svg width="${w}in" height="${h}in" viewBox="0 0 ${w * DPI} ${h * DPI}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
        const fullSvg = `${svgHeader}\n${svgBody}\n</svg>`;

        downloadBlob(fullSvg, `SignOS_${selectedMat.Item_Code}_${w}x${h}.svg`, 'image/svg+xml');
        console.log("🚀 Export Complete with Layers.");

    } catch (err) {
        console.error("❌ SVG Match Failed:", err);
    }
}

function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
