function renderPhysicsToScreen(manifest, targetId) {
    const container = document.getElementById(targetId);
    if (!container) return;

    const DPI = 72;
    const containerW = document.getElementById('preview-wrapper').clientWidth || 400;
    const maxAllowedH = 160; 
    const scale = Math.min((containerW * 0.9) / manifest.width, maxAllowedH / manifest.height);

    container.style.width = `${manifest.width * scale}px`;
    container.style.height = `${manifest.height * scale}px`;

    container.innerHTML = `
        <svg id="live-production-preview" 
             width="100%" 
             height="100%"
             viewBox="0 0 ${manifest.width * DPI} ${manifest.height * DPI}" 
             xmlns="http://www.w3.org/2000/svg"
             style="background: ${manifest.substrateColor}; display: block;">
            <g id="preview-art">
                ${manifest.objects.map(obj => `
                    <path d="${obj.d}" fill="${manifest.textColor}" transform="translate(${obj.x * DPI}, ${obj.y * DPI})" />
                `).join('')}
            </g>
        </svg>`;
}
