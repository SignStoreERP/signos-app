// signos-view-svg.js (v3.0 Parallel Test)
function renderPhysicsToScreen(manifest, targetId) {
    const container = document.getElementById(targetId);
    if (!container) return;

    const DPI = 72; // Standard SVG Coordinate System
    const containerW = container.parentElement.clientWidth || 400;
    const maxAllowedH = 160;

    // Scale the 72DPI SVG down to fit the UI preview box
    const scale = Math.min((containerW * 0.9) / manifest.width, maxAllowedH / manifest.height);
    
    container.style.width = `${manifest.width * scale}px`;
    container.style.height = `${manifest.height * scale}px`;

    container.innerHTML = `
        <svg id="live-production-preview" width="100%" height="100%"
            viewBox="0 0 ${manifest.width * DPI} ${manifest.height * DPI}"
            xmlns="http://www.w3.org/2000/svg"
            style="background: ${manifest.substrateColor}; display: block;">
            <g id="preview-art">
                ${manifest.objects.map(obj => `
                    <path d="${obj.d}" fill="${manifest.textColor}"
                    transform="translate(${obj.x * DPI}, ${obj.y * DPI})" />
                `).join('')}
            </g>
        </svg>
    `;
}
