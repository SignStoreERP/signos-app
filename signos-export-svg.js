/**
 * SignOS SVG Outlining Engine (Test v1.0)
 * Uses opentype.js to fetch TTF files from GitHub and render as vector paths.
 */

async function triggerSvgExport() {
    console.log("Starting SVG Export...");
    
    // 1. Setup Constants
    const DPI = 72; // Standard scale: 1 inch = 72 points/pixels
    const w = parseFloat(document.getElementById('w').value) || 0;
    const h = parseFloat(document.getElementById('h').value) || 0;
    const githubBase = "https://raw.githubusercontent.com/SignStoreERP/signos-app/main/fonts/";

    if (w <= 0 || h <= 0) {
        alert("Please enter valid dimensions first.");
        return;
    }

    // 2. Identify Colors
    // Pulling current UI selection for substrate and text
    const substrateHex = document.getElementById('preview-box')?.style.backgroundColor || "#DDDDDD";
    const textHex = document.getElementById('preview-text-1')?.style.color || "#000000";

    // 3. Initialize SVG String
    let svgContent = `<svg width="${w * DPI}" height="${h * DPI}" viewBox="0 0 ${w * DPI} ${h * DPI}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Add Substrate Background
    svgContent += `<rect width="100%" height="100%" fill="${substrateHex}" />`;

    // 4. Process Lines
    try {
        for (let i = 0; i < lineSettings.length; i++) {
            const line = lineSettings[i];
            const text = document.getElementById(`text-${i + 1}`)?.value;
            
            if (!text || text.trim() === "") continue;

            // Find Font File Name from systemFonts lookup
            const fontObj = systemFonts.find(f => f.CSS_Family === line.font);
            if (!fontObj) {
                console.error(`Font file not found for: ${line.font}`);
                continue;
            }

            const fontUrl = githubBase + fontObj.File_Name;
            
            // Load Font via opentype.js
            const font = await opentype.load(fontUrl);
            
            // Calculate Position & Size
            // Note: Simplistic centering for the test version
            const fontSize = line.height * DPI;
            const x = (w * DPI) / 2;
            const y = ((h * DPI) / (lineSettings.length + 1)) * (i + 1) + (fontSize / 3);

            // Generate Path (The "Outlining" Magic)
            const path = font.getPath(text, 0, 0, fontSize);
            const pathData = path.toPathData();

            // Measure text for centering
            const bbox = path.getBoundingBox();
            const textWidth = bbox.x2 - bbox.x1;
            const centeredX = x - (textWidth / 2);

            // Append Path to SVG
            svgContent += `<path d="${pathData}" fill="${textHex}" transform="translate(${centeredX}, ${y})" />`;
        }

        svgContent += `</svg>`;

        // 5. Trigger Download
        downloadBlob(svgContent, `SignOS_Production_${w}x${h}.svg`, 'image/svg+xml');

    } catch (err) {
        console.error("SVG Generation Failed:", err);
        alert("Error generating vector file. Check console for details.");
    }
}

function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
