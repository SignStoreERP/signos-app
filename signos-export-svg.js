/**
 * SignOS SVG Outlining Engine (v1.1 - Debug Version)
 */

async function triggerSvgExport() {
    console.log("🛠️ Starting SignOS Vector Export...");
    
    const DPI = 72; 
    const w = parseFloat(document.getElementById('w').value) || 0;
    const h = parseFloat(document.getElementById('h').value) || 0;
    // Ensure this matches your ACTUAL repo path
    const githubBase = "https://raw.githubusercontent.com/SignStoreERP/signos-app/main/fonts/";

    if (w <= 0 || h <= 0) {
        alert("Please enter valid dimensions.");
        return;
    }

    const substrateHex = document.getElementById('preview-box')?.style.backgroundColor || "#DDDDDD";
    const textHex = document.getElementById('preview-text-1')?.style.color || "#000000";

    let svgHeader = `<svg width="${w * DPI}" height="${h * DPI}" viewBox="0 0 ${w * DPI} ${h * DPI}" xmlns="http://www.w3.org/2000/svg">`;
    let svgBackground = `<rect width="100%" height="100%" fill="${substrateHex}" />`;
    let svgPaths = "";

    try {
        // We use a promise-based loop to ensure the SVG doesn't "finish" early
        for (let i = 0; i < lineSettings.length; i++) {
            const line = lineSettings[i];
            const textInput = document.getElementById(`text-${i + 1}`);
            const textValue = textInput ? textInput.value : "";
            
            if (!textValue || textValue.trim() === "") continue;

            const fontObj = systemFonts.find(f => f.CSS_Family === line.font);
            if (!fontObj) {
                console.warn(`⚠️ Skipping Line ${i+1}: Font ${line.font} not in systemFonts.`);
                continue;
            }

            // CRITICAL FIX: Encode the filename to handle spaces/commas
            const encodedFile = encodeURIComponent(fontObj.File_Name);
            const fontUrl = githubBase + encodedFile;
            
            console.log(`📡 Fetching font: ${fontUrl}`);

            // Wrap opentype.load in a Promise
            const font = await new Promise((resolve, reject) => {
                opentype.load(fontUrl, (err, font) => {
                    if (err) reject(err);
                    else resolve(font);
                });
            });

            // Conversion Math
            const fontSize = line.height * DPI;
            const x = (w * DPI) / 2;
            
            // Adjust Y: opentype renders from the baseline. 
            // This math attempts to center the text block vertically.
            const verticalSpacing = (h * DPI) / (lineSettings.length + 1);
            const y = (verticalSpacing * (i + 1)) + (fontSize / 3);

            // Generate Path Data
            const path = font.getPath(textValue, 0, 0, fontSize);
            const pathData = path.toPathData();

            // Center the text horizontally
            const bbox = path.getBoundingBox();
            const textWidth = bbox.x2 - bbox.x1;
            const centeredX = x - (textWidth / 2);

            svgPaths += `  <path d="${pathData}" fill="${textHex}" transform="translate(${centeredX}, ${y})" />\n`;
            console.log(`✅ Path generated for: "${textValue}"`);
        }

        const fullSvg = `${svgHeader}\n${svgBackground}\n${svgPaths}\n</svg>`;
        
        if (svgPaths === "") {
            alert("SVG generated, but no text paths were created. Check console.");
        }

        downloadBlob(fullSvg, `Production_${w}x${h}.svg`, 'image/svg+xml');

    } catch (err) {
        console.error("❌ SVG Generation Failed:", err);
        alert("Error loading fonts from GitHub. See Console (F12) for CORS or 404 errors.");
    }
}

function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
