/**
 * SignOS Export Module
 * Packages the current screen SVG for download.
 */
function downloadProductionSVG() {
    const svgEl = document.getElementById('live-production-preview');
    if (!svgEl) return alert("Build a sign first!");

    const w = parseFloat(document.getElementById('w').value);
    const h = parseFloat(document.getElementById('h').value);

    // Add production namespaces and physical units for Illustrator
    let svgData = svgEl.outerHTML;
    svgData = svgData.replace('<svg', `<svg width="${w}in" height="${h}in" xmlns="http://www.w3.org/2000/svg"`);

    const blob = new Blob([svgData], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SignOS_Build_${w}x${h}.svg`;
    a.click();
}
