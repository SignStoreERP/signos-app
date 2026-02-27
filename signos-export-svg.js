/**
 * SignOS SVG Export Engine (v1.0)
 * Translates Canvas Physics state to Vector Path SVG (Outlined Text)
 * Dependency: opentype.js (https://opentype.js.org/)
 */

window.SignOS_Export = {
    // Cache for loaded opentype font objects to prevent redundant fetches
    fontCache: {},

    /**
     * Main Export Function
     * @param {Object} config - { width, height, lines, signData, fileName }
     */
    exportProductionSVG: async function(config) {
        const { width, height, lines, fileName } = config;
        
        // 1. Create the SVG Header (using inches as units)
        let svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
        svgContent += `<svg width="${width}in" height="${height}in" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">\n`;
        
        // 2. Background/Plate Boundary (Red stroke typically used for Cut lines in laser software)
        svgContent += `  <!-- Cut Path (Sign Perimeter) -->\n`;
        svgContent += `  <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#FF0000" stroke-width="0.01" />\n\n`;

        svgContent += `  <!-- Engrave Paths (Outlined Text) -->\n`;

        // 3. Process Lines
        for (const line of lines) {
            if (!line.text || line.text.trim() === "") continue;

            try {
                const pathData = await this._generateTextPath(line, width);
                if (pathData) {
                    svgContent += `  <path d="${pathData}" fill="black" />\n`;
                }
            } catch (err) {
                console.error("Error outlining line:", line.text, err);
            }
        }

        svgContent += `</svg>`;

        // 4. Trigger Download
        this._downloadFile(svgContent, fileName || `Production_${Date.now()}.svg`);
    },

    /**
     * Converts a single line of text into a SVG Path 'd' attribute
     */
    _generateTextPath: async function(line, availableWidth) {
        // Find font metadata from global systemFonts (loaded in main app)
        const fontMeta = window.systemFonts.find(f => f.CSS_Family === line.font);
        if (!fontMeta) throw new Error("Font metadata not found for " + line.font);

        const fontUrl = `https://raw.githubusercontent.com/SignStoreERP/signos-app/main/fonts/${fontMeta.File_Name}`;
        
        // Load font using opentype.js
        if (!this.fontCache[line.font]) {
            this.fontCache[line.font] = await opentype.load(fontUrl);
        }
        const font = this.fontCache[line.font];

        // Canvas units are usually px, but we are working in inches.
        // Opentype uses "Units Per Em". We need to map Font Size (Inches) to path scale.
        // fontSize in lineSettings is the target physical height in inches.
        const fontSizeInPoints = line.fontSize * 72; 
        
        // Align text (Center is default in your canvas)
        const textWidth = font.getAdvanceWidth(line.text, fontSizeInPoints) / 72;
        const xPos = (availableWidth / 2) - (textWidth / 2);
        
        // Y Position: Opentype draws from the baseline. 
        // We need to offset the center-aligned Y by roughly half the cap-height.
        const yPos = line.y; 

        const path = font.getPath(line.text, xPos, yPos, fontSizeInPoints);
        return path.toPathData(4); // 4 decimal places for precision
    },

    _downloadFile: function(content, fileName) {
        const blob = new Blob([content], { type: 'image/svg+xml' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
};
