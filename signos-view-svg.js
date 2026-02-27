/**
 * SignOS SVG Viewport
 * Renders the Build Manifest to the screen.
 */
function renderPhysicsToScreen(manifest) {
    const previewWrapper = document.getElementById('preview-wrapper');
    const DPI = 72; // Standard scale for browser SVG rendering

    // We replace the current HTML preview with a raw SVG element
    previewWrapper.innerHTML = `
        <svg id="live-production-preview" 
             viewBox="0 0 ${manifest.width * DPI} ${manifest.height * DPI}" 
             style="width: 100%; height: auto; background: ${manifest.substrateColor};">
            <g id="preview-art">
                ${manifest.objects.map(obj => `
                    <path d="${obj.d}" fill="${manifest.textColor}" transform="translate(${obj.x * DPI}, ${obj.y * DPI})" />
                `).join('')}
            </g>
        </svg>`;
}
