// signos-builder.js (v3.2 True Ink Centering)
const SignOS_Builder = {
    async buildManifest(inputs, lines, systemFonts, githubBase) {
        const manifest = {
            width: inputs.w, 
            height: inputs.h,
            substrateColor: inputs.mat.Cap_Hex || "#DDDDDD",
            textColor: inputs.isReverse ? (inputs.paintHex || "#FFFFFF") : inputs.mat.Core_Hex,
            objects: [], 
            totalHeight: 0
        };

        const gap = inputs.gap || 0;
        const lineData = [];

        // 1. Fetch fonts and calculate raw vector paths
        for (let ls of lines) {
            if (!ls.text) continue;
            
            const fontObj = systemFonts.find(f => f.CSS_Family === ls.font) || systemFonts;
            const fontUrl = githubBase + encodeURIComponent(fontObj.File_Name);
            const font = await new Promise((res) => opentype.load(fontUrl, (err, f) => res(f)));
            
            // Convert requested physical inch height to font scaling ratio
            const scale = ls.height / font.ascender;
            const path = font.getPath(ls.text, 0, 0, font.unitsPerEm * scale);
            
            lineData.push({ text: ls.text, path: path });
        }

        if (lineData.length === 0) return manifest;

        // 2. Stack paths based on TRUE INK visual bounds (Ignoring typograhic descenders)
        let currentY = 0;
        let groupMinY = Infinity;
        let groupMaxY = -Infinity;

        lineData.forEach(ld => {
            const bbox = ld.path.getBoundingBox();
            
            // Align the absolute top of the ink to currentY
            const offsetY = currentY - bbox.y1; 
            
            // Center X exactly on ink width
            ld.xOffset = (inputs.w / 2) - ((bbox.x2 - bbox.x1) / 2) - bbox.x1; 
            ld.yOffset = offsetY;
            
            const trueY1 = bbox.y1 + offsetY;
            const trueY2 = bbox.y2 + offsetY;
            
            if (trueY1 < groupMinY) groupMinY = trueY1;
            if (trueY2 > groupMaxY) groupMaxY = trueY2;
            
            // The next line starts below the absolute bottom of this line's ink + the gap
            currentY = trueY2 + gap; 
        });

        // 3. Calculate absolute vertical center shift for the whole stacked group
        manifest.totalHeight = groupMaxY - groupMinY;
        const targetCenterY = inputs.h / 2;
        const currentCenterY = groupMinY + (manifest.totalHeight / 2);
        const finalShiftY = targetCenterY - currentCenterY;

        // 4. Build final manifest objects with translated coordinates
        lineData.forEach(ld => {
            manifest.objects.push({
                d: ld.path.toPathData(),
                name: ld.text,
                x: ld.xOffset, 
                y: ld.yOffset + finalShiftY
            });
        });

        return manifest;
    }
};