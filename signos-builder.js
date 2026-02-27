// signos-builder.js (v3.3 Smart Typography)
const SignOS_Builder = {
    async buildManifest(inputs, lines, githubBase) {
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

        // 1. Fetch fonts directly using the dynamically constructed filename
        for (let ls of lines) {
            if (!ls.text) continue;
            
            const fontUrl = githubBase + encodeURIComponent(ls.fileName);
            const font = await new Promise((res) => opentype.load(fontUrl, (err, f) => res(f)));
            
            const scale = ls.height / font.ascender;
            const path = font.getPath(ls.text, 0, 0, font.unitsPerEm * scale);
            
            lineData.push({ text: ls.text, path: path });
        }

        if (lineData.length === 0) return manifest;

        // 2. Stack paths based on TRUE INK visual bounds
        let currentY = 0;
        let groupMinY = Infinity;
        let groupMaxY = -Infinity;

        lineData.forEach(ld => {
            const bbox = ld.path.getBoundingBox();
            const offsetY = currentY - bbox.y1; 
            ld.xOffset = (inputs.w / 2) - ((bbox.x2 - bbox.x1) / 2) - bbox.x1; 
            ld.yOffset = offsetY;
            
            const trueY1 = bbox.y1 + offsetY;
            const trueY2 = bbox.y2 + offsetY;
            
            if (trueY1 < groupMinY) groupMinY = trueY1;
            if (trueY2 > groupMaxY) groupMaxY = trueY2;
            
            currentY = trueY2 + gap; 
        });

        // 3. Absolute vertical center shift
        manifest.totalHeight = groupMaxY - groupMinY;
        const targetCenterY = inputs.h / 2;
        const currentCenterY = groupMinY + (manifest.totalHeight / 2);
        const finalShiftY = targetCenterY - currentCenterY;

        // 4. Build final manifest objects
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
