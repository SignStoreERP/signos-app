// signos-builder.js (v4.0 - Architecture Unified & Braille Engine)

const SignOS_Builder = {
    
    // --- EXISTING BULK NAMEPLATES LOGIC ---
    async buildManifest(inputs, lines, githubBase) {
        const safeMatName = inputs.mat && inputs.mat.Item_Code ? `[${inputs.mat.Item_Code}]_${inputs.mat.Cap_Color}`.replace(/[^a-zA-Z0-9\[\]]/g, '_') : 'backer';
        const safePaintName = inputs.isReverse && inputs.paint ? `_Paint_${inputs.paint}`.replace(/[^a-zA-Z0-9\[\]]/g, '_') : '';

        const manifest = {
            w: inputs.w,
            h: inputs.h,
            matCode: inputs.mat ? inputs.mat.Item_Code : '',
            matName: inputs.mat ? inputs.mat.Cap_Color : '',
            paintName: inputs.paint || '',
            isReverse: inputs.isReverse || false,
            safeFileName: `${safeMatName}${safePaintName}`,
            objects: [],
            totalHeight: 0
        };

        let currentY = 0;
        const validLines = lines.filter(l => l.text.trim() !== "");

        for (let i = 0; i < validLines.length; i++) {
            const ld = validLines[i];
            const fontUrl = githubBase + encodeURIComponent(ld.fontFileName || ld.font);
            try {
                const font = await new Promise((res, rej) => opentype.load(fontUrl, (err, f) => err ? rej(err) : res(f)));
                const scale = ld.height / font.ascender;
                const fontSize = font.unitsPerEm * scale;
                const path = font.getPath(ld.text, 0, 0, fontSize);
                const bbox = path.getBoundingBox();

                const x = (inputs.w / 2) - ((bbox.x2 - bbox.x1) / 2) - bbox.x1;
                const y = currentY - bbox.y1;

                manifest.objects.push({ d: path.toPathData(5), name: ld.text, x: x, y: y });
                currentY += ld.height;
                if (i < validLines.length - 1) currentY += 0.125; // Default gap
            } catch(e) { console.error("Font load failed:", e); }
        }
        manifest.totalHeight = currentY;

        // Center all vertically
        const finalShiftY = (inputs.h - manifest.totalHeight) / 2;
        manifest.objects.forEach(obj => obj.y += finalShiftY);

        return manifest;
    },

    // --- NEW ADA & TACTILE LOGIC ---
    brailleMap: {
        'a':[1], 'b':[1, 2], 'c':[1, 3], 'd':[1, 3, 4], 'e':[1, 4],
        'f':[1-3], 'g':[1-4], 'h':[1, 2, 4], 'i':[2, 3], 'j':[2-4],
        'k':[1, 5], 'l':[1, 2, 5], 'm':[1, 3, 5], 'n':[1, 3-5], 'o':[1, 4, 5],
        'p':[1-3, 5], 'q':[1-5], 'r':[1, 2, 4, 5], 's':[2, 3, 5], 't':[2-5],
        'u':[1, 5, 6], 'v':[1, 2, 5, 6], 'w':[2-4, 6], 'x':[1, 3, 5, 6], 'y':[1, 3-6], 'z':[1, 4-6],
        ' ': [], '#':[3-6]
    },

    generateBraillePaths: function(text, startX, startY, align) {
        if (!text) return "";
        const DOT_PITCH = 0.100;
        const CELL_PITCH = 0.241;
        const DOT_RADIUS = 0.025;

        let str = text.toLowerCase();
        if (/\d/.test(str)) str = "#" + str;

        let totalWidth = str.length * CELL_PITCH;
        let cursorX = startX;
        if (align === 'center') cursorX = startX - (totalWidth / 2);
        if (align === 'right') cursorX = startX - totalWidth;

        let paths = "";
        for (let i = 0; i < str.length; i++) {
            let char = str[i];
            let dots = this.brailleMap[char] || [];

            if (char === '#') dots = this.brailleMap['#'];
            else if (/\d/.test(char)) {
                const numMap = ['j','a','b','c','d','e','f','g','h','i'];
                dots = this.brailleMap[numMap[parseInt(char)]] || [];
            }

            if(dots.includes(1)) paths += `<circle cx="${cursorX}" cy="${startY}" r="${DOT_RADIUS}" />`;
            if(dots.includes(2)) paths += `<circle cx="${cursorX}" cy="${startY + DOT_PITCH}" r="${DOT_RADIUS}" />`;
            if(dots.includes(3)) paths += `<circle cx="${cursorX}" cy="${startY + (DOT_PITCH*2)}" r="${DOT_RADIUS}" />`;
            if(dots.includes(4)) paths += `<circle cx="${cursorX + DOT_PITCH}" cy="${startY}" r="${DOT_RADIUS}" />`;
            if(dots.includes(5)) paths += `<circle cx="${cursorX + DOT_PITCH}" cy="${startY + DOT_PITCH}" r="${DOT_RADIUS}" />`;
            if(dots.includes(6)) paths += `<circle cx="${cursorX + DOT_PITCH}" cy="${startY + (DOT_PITCH*2)}" r="${DOT_RADIUS}" />`;

            cursorX += CELL_PITCH;
        }
        return paths;
    },

    async buildADAManifest(inputs, elements, githubBase) {
        const manifest = {
            w: inputs.w,
            h: inputs.h,
            coreHex: inputs.coreHex || '#000000',
            tactileHex: inputs.tactileHex || '#ffffff',
            backerHex: inputs.backerHex || 'none',
            coreDepth: inputs.coreDepth || 3,
            backerDepth: inputs.backerDepth || 6,
            radius: inputs.radius || 0,
            svgContent: ""
        };

        let svgContent = "";

        for (const el of elements) {
            if (el.type === 'picto') {
                let pX = (inputs.w / 2) - (el.size / 2);
                svgContent += `<svg x="${pX}" y="${el.y}" width="${el.size}" height="${el.size}" viewBox="${el.viewBox}" fill="currentColor"><path d="${el.svg}"/></svg>`;
            }
            else if (el.type === 'text') {
                if(!el.text) continue;
                try {
                    const fontUrl = githubBase + encodeURIComponent(el.fontFileName);
                    const font = await new Promise((res, rej) => opentype.load(fontUrl, (err, f) => err ? rej(err) : res(f)));

                    const rawPath = font.getPath(el.text, 0, 0, font.unitsPerEm);
                    const rawBbox = rawPath.getBoundingBox();
                    const rawHeight = rawBbox.y2 - rawBbox.y1;
                    const exactScale = el.fontSize / rawHeight;

                    const pathObj = font.getPath(el.text, 0, 0, font.unitsPerEm * exactScale);
                    const bbox = pathObj.getBoundingBox();

                    let alignX = inputs.w / 2;
                    if (el.align === 'left') alignX = 0.375;
                    if (el.align === 'right') alignX = inputs.w - 0.375;

                    if (el.align === 'center') alignX = alignX - ((bbox.x2 - bbox.x1) / 2) - bbox.x1;
                    if (el.align === 'right') alignX = alignX - (bbox.x2 - bbox.x1) - bbox.x1;
                    if (el.align === 'left') alignX = alignX - bbox.x1;

                    let alignY = el.y - bbox.y1;
                    svgContent += `<path d="${pathObj.toPathData(5)}" transform="translate(${alignX}, ${alignY})" fill="currentColor" />`;
                } catch(e) { console.error("Font load failed:", e); }
            }
            else if (el.type === 'braille') {
                let alignX = inputs.w / 2;
                if (el.align === 'left') alignX = 0.375;
                if (el.align === 'right') alignX = inputs.w - 0.375;

                svgContent += `<g fill="rgba(180, 180, 180, 0.35)" stroke="rgba(255, 255, 255, 0.7)" stroke-width="0.008">
                    ${this.generateBraillePaths(el.text, alignX, el.y, el.align)}
                </g>`;
            }
        }

        manifest.svgContent = svgContent;
        return manifest;
    }
};

2. signos-export-v2.js Update
Add this directly to the bottom of your existing signos-export-v2.js file.
// Append to the bottom of signos-export-v2.js
SignOS_Export_v2.exportADA = function(manifest) {
    if (!manifest || !manifest.svgContent) return alert("Manifest not ready!");

    let finalSVG = `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="${manifest.w}in" height="${manifest.h}in" viewBox="0 0 ${manifest.w} ${manifest.h}">
        <!-- Substrate Boundary -->
        <rect width="${manifest.w}" height="${manifest.h}" fill="${manifest.coreHex}" rx="${manifest.radius}" ry="${manifest.radius}" />
        <!-- Vector Tactile & Braille Paths -->
        <g fill="${manifest.tactileHex}">
            ${manifest.svgContent.replace(/currentColor/g, manifest.tactileHex)}
        </g>
    </svg>`;

    const blob = new Blob([finalSVG], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SignOS_PROD_ADA_${manifest.w}x${manifest.h}.svg`;
    a.click();
    URL.revokeObjectURL(url);
};

