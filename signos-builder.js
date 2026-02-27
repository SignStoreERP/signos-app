/**
 * SignOS Virtual Build Engine
 * Calculates physical geometry in inches before rendering.
 */
const SignOS_Builder = {
    async buildManifest(inputs, lines, systemFonts, githubBase) {
        const manifest = {
            width: inputs.w,
            height: inputs.h,
            substrateColor: inputs.mat.Cap_Hex || "#DDDDDD",
            textColor: (currentMode === 'front') ? inputs.mat.Core_Hex : (selectedPaint?.Hex_Code || "#FFFFFF"),
            objects: []
        };

        const gap = parseFloat(document.getElementById('line-spacing').value) || 0;
        let totalBlockHeight = 0;
        const lineData = [];

        // Pre-calculate line physics
        for (let ls of lines) {
            if (!ls.text) continue;
            const fontObj = systemFonts.find(f => f.CSS_Family === ls.font);
            const fontUrl = githubBase + encodeURIComponent(fontObj.File_Name);
            const font = await new Promise((res) => opentype.load(fontUrl, (err, f) => res(f)));
            
            // Mirror your overflow logic here to adjust ls.height if needed
            let h = ls.height; 
            
            lineData.push({ text: ls.text, font: font, h: h });
            totalBlockHeight += h;
        }
        totalBlockHeight += (lineData.length - 1) * gap;

        // Positioning Logic (Physical Center)
        let currentY = (inputs.h - totalBlockHeight) / 2;

        for (let ld of lineData) {
            // UnitsPerEm scaling to reach exact inch height
            const scale = ld.h / ld.font.ascender;
            const path = ld.font.getPath(ld.text, 0, 0, ld.font.unitsPerEm * scale);
            const bbox = path.getBoundingBox();
            
            const x = (inputs.w / 2) - ((bbox.x2 - bbox.x1) / 2) - bbox.x1;
            const y = currentY - bbox.y1; // Alignment to the mathematical top of ink

            manifest.objects.push({
                type: 'path',
                d: path.toPathData(),
                name: ld.text,
                x: x,
                y: y
            });

            currentY += ld.h + gap;
        }

        return manifest;
    }
};
