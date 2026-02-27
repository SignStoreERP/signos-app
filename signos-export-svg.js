/**
 * SignOS SVG Outlining Engine (v1.3 - Production Match)
 * Syncs coordinates and colors with the visual editor.
 */

async function triggerSvgExport() {
    console.log("🛠️ Syncing Vector Data with Editor...");
    
    const DPI = 72; // 1 unit = 1 point (72 points per inch)
    const w = parseFloat(document.getElementById('w').value) || 0;
    const h = parseFloat(document.getElementById('h').value) || 0;
    const githubBase = "https://raw.githubusercontent.com/SignStoreERP/signos-app/main/fonts/";

    if (w <= 0 || h <= 0) {
        alert("Please enter valid dimensions.");
        return;
    }

    // 1. DYNAMIC COLOR PULL
    // Pulls the actual hex values assigned during the "Step 1" and "Step 2" selections
    const substrateHex = document.getElementById('preview-box')?.style.backgroundColor || "#DDDDDD";
    const textHex = document.getElementById('preview-text-1')?.style.color || "#000000";

    let svgPaths = "";

    try {
        // 2. LINE PROCESSING
        for (let i = 0; i < lineSettings.length; i++) {
            const line = lineSettings[i];
            const textValue = line.text; 
            
            if (!textValue || textValue.trim() === "") continue;

            // Find Font Mapping
            const fontObj = systemFonts.find(f => f.CSS_Family === line.font);
            if (!fontObj) {
                console.error(`Line ${i+1}: Font mapping failed for "${line.font}"`);
                continue;
            }

            const fontUrl = githubBase + encodeURIComponent(fontObj.File_Name);
            
            // Fetch raw font data
            const font = await new Promise((resolve, reject) => {
                opentype.load(fontUrl, (err, font) => {
                    if (err) reject(err);
                    else resolve(font);
                });
            });

            // 3. THE "PHYSICS" MATCH
            const fontSize = line.height * DPI;
            const canvasW = w * DPI;
            const canvasH = h * DPI;

            // Vertical gap logic to match signos-canvas.js
            const gap = (parseFloat(document.getElementById('line-gap')?.value) || 0.125) * DPI;
            const totalTextHeight = lineSettings.reduce((sum, l) => sum + (l.height * DPI), 0);
            const totalGaps = (lineSettings.length - 1) * gap;
            const blockHeight = totalTextHeight + totalGaps;

            // Calculate starting Y (top of the text block, centered vertically)
            const startY = (canvasH - blockHeight) / 2;
            
            // Calculate specific Y for this line
            let currentOffset = 0;
            for (let j = 0; j < i; j++) {
                currentOffset += (lineSettings[j].height * DPI) + gap;
            }
            
            // opentype.js renders from the baseline, so we add the font height
            const yPos = startY + currentOffset + fontSize;

            // 4. GENERATE OUTLINES
            const path = font.getPath(textValue, 0, 0, fontSize);
            const pathData = path.toPathData();

            // Precise Horizontal Centering
            const bbox = path.getBoundingBox();
            const textWidth = bbox.x2 - bbox.x1;
            const centeredX = (canvasW / 2) - (textWidth / 2);

            svgPaths += `  \n`;
            svgPaths += `  <path d="${pathData}" fill="${textHex}" transform="translate(${centeredX}, ${yPos})" />\n`;
        }

        // 5. ASSEMBLE FINAL FILE
        const svgHeader = `<svg width="${w}in" height="${h}in" viewBox="0 0 ${w * DPI} ${h * DPI}" xmlns="http://www.w3.org/2000/svg">`;
        const svgBackground = `<rect width="100%" height="100%" fill="${substrateHex}" />`;
        const fullSvg = `${svgHeader}\n${svgBackground}\n${svgPaths}\n</svg>`;

        downloadBlob(fullSvg, `SignOS_OUTLINED_${w}x${h}.svg`, 'image/svg+xml');

    } catch (err) {
        console.error("❌ SVG Match Failed:", err);
        alert("Font loading error. Ensure your GitHub raw links are accessible.");
    }
}

function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
