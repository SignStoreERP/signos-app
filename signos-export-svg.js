/**
 * SignOS SVG Outlining Engine (v1.9 - Optical Geometry Method)
 * Focus: Absolute 1:1 Parity between Geometry and Sign Blank.
 */

async function triggerSvgExport() {
    console.log("🛠️ Starting Optical Geometry Export...");
    
    try {
        const DPI = 72; // Standard SVG points-per-inch
        const w = parseFloat(document.getElementById('w').value) || 0;
        const h = parseFloat(document.getElementById('h').value) || 0;
        const githubBase = "https://raw.githubusercontent.com/SignStoreERP/signos-app/main/fonts/";

        if (w <= 0 || h <= 0 || !selectedMat) {
            alert("Dimensions and Material required."); return;
        }

        // 1. SYNC COLORS & MODES
        const isReverse = currentMode === 'reverse';
        let activePaintHex = "#FFFFFF"; 
        if (isReverse && selectedPaint) {
            activePaintHex = (selectedPaint.Code === 'CUSTOM') ? "#e2e8f0" : selectedPaint.Hex_Code;
        }
        const substrateHex = selectedMat.Cap_Hex || "#DDDDDD";
        const textColor = currentMode === 'front' ? selectedMat.Core_Hex : activePaintHex;

        // 2. DATA AGGREGATION
        const linesCount = parseInt(document.getElementById('lines-per-sign').value) || 1;
        const gapPoints = (parseFloat(document.getElementById('line-spacing').value) || 0) * DPI;
        const availableW = w - 0.5;

        let processedLines = [];
        let totalInkHeight = 0;

        for (let i = 0; i < linesCount; i++) {
            const ls = lineSettings[i];
            const text = typeof formatLineCase === 'function' ? formatLineCase(ls.text, ls.caseType) : ls.text;
            if (!text || text.trim() === "") continue;

            const fontObj = systemFonts.find(f => f.CSS_Family === ls.font);
            const fontUrl = githubBase + encodeURIComponent(fontObj.File_Name);
            const font = await new Promise((resolve, reject) => {
                opentype.load(fontUrl, (err, f) => err ? reject(err) : resolve(f));
            });

            // Scale math: Mirroring SignOS "Cap Height" logic
            const targetH = ls.height * DPI;
            const fontScale = targetH / font.ascender;

            // Generate temporary path to measure real ink bounds
            const tempPath = font.getPath(text, 0, 0, font.unitsPerEm * (fontScale / (font.unitsPerEm / font.ascender)));
            const bbox = tempPath.getBoundingBox();
            
            processedLines.push({
                text: text,
                path: tempPath,
                bbox: bbox,
                lineH: targetH,
                id: i + 1
            });
            totalInkHeight += targetH;
        }

        if (processedLines.length === 0) return;
        totalInkHeight += (processedLines.length - 1) * gapPoints;

        // 3. GENERATE SVG
        let svgBody = `  <g id="SUBSTRATE" data-name="Substrate: ${selectedMat.Item_Code}">
    <rect width="${w * DPI}" height="${h * DPI}" fill="${substrateHex}" />
  </g>\n\n`;

        svgBody += `  <g id="PRODUCTION_ART" data-name="Engrave Color: ${textColor}">\n`;

        // THE PIVOT: We center the entire block vertically based on the Sign height
        let currentYOffset = ((h * DPI) - totalInkHeight) / 2;

        for (const line of processedLines) {
            const inkW = line.bbox.x2 - line.bbox.x1;
            const inkH = line.bbox.y2 - line.bbox.y1;
            
            // OPTICAL HORIZONTAL CENTER
            const x = ((w * DPI) / 2) - (inkW / 2) - line.bbox.x1;
            
            // OPTICAL VERTICAL ALIGNMENT
            // We align the top of the ink (y1) to our current offset
            const y = currentYOffset - line.bbox.y1;

            svgBody += `    <g id="LINE_${line.id}" data-name="${line.text}">
      <path d="${line.path.toPathData()}" 
            fill="${textColor}" 
            stroke="${textColor}" 
            stroke-width="0.01" 
            transform="translate(${x}, ${y})" />
    </g>\n`;

            currentYOffset += line.lineH + gapPoints;
        }
        svgBody += `  </g>`;

        const header = `<svg width="${w}in" height="${h}in" viewBox="0 0 ${w * DPI} ${h * DPI}" xmlns="http://www.w3.org/2000/svg">`;
        downloadBlob(`${header}\n${svgBody}\n</svg>`, `SignOS_PROD_${w}x${h}.svg`, 'image/svg+xml');
        
        console.log("🚀 Optical Parity Export Complete.");

    } catch (err) {
        console.error("❌ Export Failed:", err);
    }
}

function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
