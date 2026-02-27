/**
 * SignOS SVG Outlining Engine (v1.2 - Array-Driven Fix)
 */

async function triggerSvgExport() {
    console.log("🛠️ Starting SignOS Vector Export...");
    
    // 1. Setup Constants
    const DPI = 72; 
    const w = parseFloat(document.getElementById('w').value) || 0;
    const h = parseFloat(document.getElementById('h').value) || 0;
    const githubBase = "https://raw.githubusercontent.com/SignStoreERP/signos-app/main/fonts/";

    if (w <= 0 || h <= 0) {
        alert("Please enter valid dimensions first.");
        return;
    }

    // 2. Identify Colors from the UI
    const substrateHex = document.getElementById('preview-box')?.style.backgroundColor || "#DDDDDD";
    const textHex = document.getElementById('preview-text-1')?.style.color || "#000000";

    let svgHeader = `<svg width="${w * DPI}" height="${h * DPI}" viewBox="0 0 ${w * DPI} ${h * DPI}" xmlns="http://www.w3.org/2000/svg">`;
    let svgBackground = `<rect width="100%" height="100%" fill="${substrateHex}" />`;
    let svgPaths = "";

    try {
        // 3. Loop through the actual data array (lineSettings)
        for (let i = 0; i < lineSettings.length; i++) {
            const line = lineSettings[i];
            
            // Fix: Access text directly from the array synced by updateLineText()
            const textValue = line.text; 
            
            if (!textValue || textValue.trim() === "") {
                console.log(`Line ${i+1}: No text found, skipping.`);
                continue;
            }

            // Find Font File Name from your systemFonts lookup
            const fontObj = systemFonts.find(f => f.CSS_Family === line.font);
            if (!fontObj) {
                console.error(`Line ${i+1}: Font "${line.font}" not found in systemFonts.`);
                continue;
            }

            const encodedFile = encodeURIComponent(fontObj.File_Name);
            const fontUrl = githubBase + encodedFile;
            
            console.log(`📡 Fetching font for Line ${i+1}: ${fontUrl}`);

            // Load Font via opentype.js
            const font = await new Promise((resolve, reject) => {
                opentype.load(fontUrl, (err, font) => {
                    if (err) reject(err);
                    else resolve(font);
                });
            });

            // 4. Position & Scaling Math
            const fontSize = line.height * DPI;
            const xCenter = (w * DPI) / 2;
            
            // Vertical distribution based on total lines
            const verticalSpacing = (h * DPI) / (lineSettings.length + 1);
            const yPos = (verticalSpacing * (i + 1)) + (fontSize / 3);

            // Generate the outlined path
            const path = font.getPath(textValue, 0, 0, fontSize);
            const pathData = path.toPathData();

            // Center horizontally
            const bbox = path.getBoundingBox();
            const textWidth = bbox.x2 - bbox.x1;
            const centeredX = xCenter - (textWidth / 2);

            svgPaths += `  <path d="${pathData}" fill="${textHex}" transform="translate(${centeredX}, ${yPos})" />\n`;
            console.log(`✅ Path generated for Line ${i+1}: "${textValue}"`);
        }

        if (svgPaths === "") {
            alert("No text paths were generated. Make sure you have typed text into the lines.");
            return;
        }

        const fullSvg = `${svgHeader}\n${svgBackground}\n${svgPaths}\n</svg>`;
        downloadBlob(fullSvg, `SignOS_Production_${w}x${h}.svg`, 'image/svg+xml');

    } catch (err) {
        console.error("❌ SVG Generation Failed:", err);
        alert("Error loading fonts. Check console for 404 or CORS errors.");
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
