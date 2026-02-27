// signos-builder.js (v3.0 Parallel Test)
const SignOS_Builder = {
    async buildManifest(inputs, lines, systemFonts, githubBase) {
        const manifest = {
            width: inputs.w, 
            height: inputs.h,
            substrateColor: inputs.mat.Cap_Hex || "#DDDDDD",
            textColor: (inputs.isReverse) ? (inputs.paintHex || "#FFFFFF") : inputs.mat.Core_Hex,
            objects: [], 
            totalHeight: 0
        };

        const gap = inputs.gap || 0;
        const lineData = [];

        // Fetch font data and calculate scale based on ASCENDER units
        for (let ls of lines) {
            if (!ls.text) continue;
            
            const fontObj = systemFonts.find(f => f.CSS_Family === ls.font);
            const fontUrl = githubBase + encodeURIComponent(fontObj.File_Name);
            
            // Load the TTF file natively as geometry data
            const font = await new Promise((res) => opentype.load(fontUrl, (err, f) => res(f)));
            
            lineData.push({ text: ls.text, font: font, h: ls.height });
            manifest.totalHeight += ls.height;
        }

        if (lineData.length > 1) manifest.totalHeight += (lineData.length - 1) * gap;

        // Visual Geometry Centering Logic
        let currentY = (inputs.h - manifest.totalHeight) / 2;

        for (let ld of lineData) {
            // Scaling: font.ascender is the key to matching physical inch height
            const scale = ld.h / ld.font.ascender;
            const path = ld.font.getPath(ld.text, 0, 0, ld.font.unitsPerEm * scale);
            const bbox = path.getBoundingBox();

            // X-Center based on actual Ink Bounds, not character width
            const x = (inputs.w / 2) - ((bbox.x2 - bbox.x1) / 2) - bbox.x1;
            
            // Y-Center: Mathematical alignment to top of ink
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
