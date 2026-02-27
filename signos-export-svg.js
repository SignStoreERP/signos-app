/**
 * SignOS SVG Outlining Engine (v1.8 - CAD Standard)
 * Option 3: Unit-Scale Wireframe Method
 */

async function triggerSvgExport() {
    console.log("🛠️ Initializing Option 3: CAD Wireframe Export...");
    
    try {
        const DPI = 72; // 1 inch = 72 user units
        const w = parseFloat(document.getElementById('w').value) || 0;
        const h = parseFloat(document.getElementById('h').value) || 0;
        const githubBase = "https://raw.githubusercontent.com/SignStoreERP/signos-app/main/fonts/";

        if (w <= 0 || h <= 0 || !selectedMat) {
            alert("Dimensions and Material selection required.");
            return;
        }

        // 1. COLORS & METADATA
        const isReverse = currentMode === 'reverse';
        let activePaintHex = "#FFFFFF"; 
        if (isReverse && selectedPaint) {
            activePaintHex = (selectedPaint.Code === 'CUSTOM') ? "#e2e8f0" : selectedPaint.Hex_Code;
        }

        const substrateHex = selectedMat.Cap_Hex || "#DDDDDD";
        const textColor = currentMode === 'front' ? selectedMat.Core_Hex : activePaintHex;
        const toolpathLayer = currentMode === 'front' ? "FRONT_ENGRAVE" : "REVERSE_FILL";

        // 2. PHYSICS PRE-CALCULATION
        const linesCount = parseInt(document.getElementById('lines-per-sign').value) || 1;
        const gapInches = parseFloat(document.getElementById('line-spacing').value) || 0;
        const availableW = w - 0.5; // SignOS editor standard padding

        let renderedLines = [];
        let totalContentHeightInches = 0;

        for (let i = 0; i < linesCount; i++) {
            const ls = lineSettings[i];
            const text = typeof formatLineCase === 'function' ? formatLineCase(ls.text, ls.caseType) : ls.text;
            if (!text || text.trim() === "") continue;

            // Load Font Data
            const fontObj = systemFonts.find(f => f.CSS_Family === ls.font);
            const fontUrl = githubBase + encodeURIComponent(fontObj.File_Name);
            const font = await new Promise((resolve, reject) => {
                opentype.load(fontUrl, (err, f) => err ? reject(err) : resolve(f));
            });

            // Calculate Overflow Height (Mirror Editor logic)
            let targetH = ls.height;
            const maxHForWidth = SignOS_Canvas.calcMaxHeightForText(text, ls.font, availableW);
            if (document.getElementById('overflow-mode').value === 'shrink' && targetH > maxHForWidth) {
                targetH = Math.max(0.125, Math.floor(maxHForWidth / 0.125) * 0.125);
            }

            // OPTION 3 MATH: Calculate Scale from Font Units
            // This ensures targetH = physical distance from Baseline to Top of Cap
            const fontScaleFactor = (targetH * DPI) / font.ascender;

            renderedLines.push({
                text: text,
                font: font,
                h: targetH,
                scale: fontScaleFactor,
                id: i + 1
            });

            totalContentHeightInches += targetH;
        }

        if (renderedLines.length === 0) return;

        // Add gaps to total height
        totalContentHeightInches += (renderedLines.length - 1) * gapInches;
        
        // 3. CONSTRUCT SVG
        let svgBody = `  <g id="SUBSTRATE" data-name="Material: ${selectedMat.Item_Code}">
    <rect width="${w * DPI}" height="${h * DPI}" fill="${substrateHex}" />
  </g>\n\n`;

        svgBody += `  <g id="PRODUCTION_ART" data-name="${toolpathLayer} (HEX: ${textColor})">\n`;

        // Center the entire block vertically
        let currentYInches = (h - totalContentHeightInches) / 2;

        for (const line of renderedLines) {
            // Generate Path at Font Units (Standard Size)
            const path = line.font.getPath(line.text, 0, 0, line.font.unitsPerEm);
            const bbox = path.getBoundingBox();
            
            // Horizontal Center Math
            const visualWidthUnits = (bbox.x2 - bbox.x1) * (line.scale / (line.font.unitsPerEm / line.font.ascender));
            const centeredX = ((w * DPI) / 2) - (visualWidthUnits / 2);

            // Precision Baseline Alignment
            const baselineY = (currentYInches + line.h) * DPI;

            // EXPORTING AS NAMED GROUP FOR ILLUSTRATOR
            svgBody += `    <g id="LINE_${line.id}" data-name="${line.text}">
      <path d="${path.toPathData()}" 
            fill="${textColor}" 
            stroke="${textColor}" 
            stroke-width="0.01" 
            transform="translate(${centeredX}, ${baselineY}) scale(${line.scale / (line.font.unitsPerEm / line.font.ascender)})" />
    </g>\n`;

            currentYInches += (line.h + gapInches);
        }
        svgBody += `  </g>`;

        // 4. GENERATE HEADER & BLOB
        const header = `<svg width="${w}in" height="${h}in" viewBox="0 0 ${w * DPI} ${h * DPI}" xmlns="http://www.w3.org/2000/svg">`;
        downloadBlob(`${header}\n${svgBody}\n</svg>`, `SignOS_PROD_${w}x${h}.svg`, 'image/svg+xml');
        
        console.log("🚀 CAD Standard Export Complete.");

    } catch (err) {
        console.error("❌ SVG Option 3 Failed:", err);
    }
}

function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
