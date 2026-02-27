/**
 * SignOS Virtual Build Engine (v2.1)
 * Restored: totalHeight tracking for UI overflow warnings.
 */
const SignOS_Builder = {
    async buildManifest(inputs, lines, systemFonts, githubBase) {
        const manifest = {
            width: inputs.w,
            height: inputs.h,
            substrateColor: inputs.mat.Cap_Hex || "#DDDDDD",
            textColor: (currentMode === 'front') ? inputs.mat.Core_Hex : (selectedPaint?.Hex_Code || "#FFFFFF"),
            objects: [],
            totalHeight: 0 // CRITICAL: Restored for warning logic
        };

        const gap = parseFloat(document.getElementById('line-spacing').value) || 0;
        const linesCount = parseInt(document.getElementById('lines-per-sign').value) || 1;
        const lineData = [];

        // 1. Calculate Individual Line Physics
        for (let i = 0; i < linesCount; i++) {
            let ls = lines[i];
            // Access global format function
            let text = typeof formatLineCase === 'function' ? formatLineCase(ls.text, ls.caseType) : ls.text;
            if (!text) continue;

            const fontObj = systemFonts.find(f => f.CSS_Family === ls.font);
            if (!fontObj) continue;

            const fontUrl = githubBase + encodeURIComponent(fontObj.File_Name);
            const font = await new Promise((res) => opentype.load(fontUrl, (err, f) => res(f)));
            if (!font) continue;

            let h = ls.height; 
            
            // Mirror Overflow Logic
            const availableW = inputs.w - 0.5;
            const maxH = SignOS_Canvas.calcMaxHeightForText(text, ls.font, availableW);
            if (document.getElementById('overflow-mode').value === 'shrink' && h > maxH) {
                h = Math.max(0.125, Math.floor(maxH / 0.125) * 0.125);
            }
            
            lineData.push({ text: text, font: font, h: h });
            manifest.totalHeight += h;
        }

        // Add gaps to the total block height
        if (lineData.length > 1) {
            manifest.totalHeight += (lineData.length - 1) * gap;
        }

        // 2. Positioning Logic (Centering)
        let currentY = (inputs.h - manifest.totalHeight) / 2;

        for (let ld of lineData) {
            const scale = ld.h / ld.font.ascender;
            const path = ld.font.getPath(ld.text, 0, 0, ld.font.unitsPerEm * scale);
            const bbox = path.getBoundingBox();
            
            const x = (inputs.w / 2) - ((bbox.x2 - bbox.x1) / 2) - bbox.x1;
            const y = currentY - bbox.y1;

            manifest.objects.push({
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
