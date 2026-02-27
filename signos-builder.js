const SignOS_Builder = {
    async buildManifest(inputs, lines, systemFonts, githubBase) {
        const manifest = {
            width: inputs.w,
            height: inputs.h,
            substrateColor: inputs.mat.Cap_Hex || "#DDDDDD",
            textColor: (currentMode === 'front') ? inputs.mat.Core_Hex : (selectedPaint?.Hex_Code || "#FFFFFF"),
            objects: [],
            totalHeight: 0 // Tracked for overflow logic
        };

        const linesCount = parseInt(document.getElementById('lines-per-sign').value) || 1;
        const gap = parseFloat(document.getElementById('line-spacing').value) || 0;
        const lineData = [];

        for (let i = 0; i < linesCount; i++) {
            let ls = lines[i];
            let text = typeof formatLineCase === 'function' ? formatLineCase(ls.text, ls.caseType) : ls.text;
            if (!text) continue;

            const fontObj = systemFonts.find(f => f.CSS_Family === ls.font);
            const fontUrl = githubBase + encodeURIComponent(fontObj.File_Name);
            const font = await new Promise((res) => opentype.load(fontUrl, (err, f) => res(f)));
            
            let h = ls.height; 
            // Shrink logic
            const availableW = inputs.w - 0.5;
            const maxH = SignOS_Canvas.calcMaxHeightForText(text, ls.font, availableW);
            if (document.getElementById('overflow-mode').value === 'shrink' && h > maxH) {
                h = Math.max(0.125, Math.floor(maxH / 0.125) * 0.125);
            }

            lineData.push({ text: text, font: font, h: h });
            manifest.totalHeight += h;
        }
        
        if (lineData.length > 1) manifest.totalHeight += (lineData.length - 1) * gap;

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
