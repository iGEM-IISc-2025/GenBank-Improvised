/**
 * Draws the circular plasmid map using D3.js.
 * @param {object} data - The plasmid data object from the parser.
 */
export function drawPlasmidMap(data) {
    const container = document.getElementById('plasmid-map-container');
    container.innerHTML = ''; // Clear previous map
    
    const width = 500, height = 500;
    const radius = Math.min(width, height) / 2 - 50;
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
    const g = svg.append("g")
        .attr("transform",  `translate(${width / 2}, ${height / 2})`);

    // Plasmid backbone
    const arc = d3.arc()
        .innerRadius(radius)
        .outerRadius(radius)
        .startAngle(0)
        .endAngle(2 * Math.PI);

    g.append("path")
        .attr("d", arc)
        .attr("stroke", "black")
        .attr("stroke-width", 2)
        .attr("fill", "none");
    
    // Scale for positioning features
    const angleScale = d3.scaleLinear()
        .domain([1, data.length])
        .range([0, 2 * Math.PI]);

    // Feature levels for overlap handling
    data.features.sort((a, b) => a.start - b.start);
    const levels = [];
    data.features.forEach(feature => {
        let level = 0;
        while (true) {
            const lastFeatureOnLevel = levels[level] ? levels[level][levels[level].length - 1] : null;
            if (!lastFeatureOnLevel || feature.start > lastFeatureOnLevel.end) {
                if (!levels[level]) levels[level] = [];
                levels[level].push(feature);
                feature.level = level;
                break;
            }
            level++;
        }
    });

    // Draw features
    const featureGroup = g.append("g");
    data.features.forEach(feature => {
        const startAngle = angleScale(feature.start);
        const endAngle = angleScale(feature.end);
        const level = feature.level || 0;
        const featureRadius = radius + 15 + (level * 25);

        const featureArc = d3.arc()
            .innerRadius(featureRadius - 8)
            .outerRadius(featureRadius + 8)
            .startAngle(startAngle)
            .endAngle(endAngle);

        featureGroup.append("path")
            .attr("d", featureArc)
            .attr("fill", feature.color);

        // Add arrowhead for direction
        if (feature.direction !== 0) {
            const arrowPoint = feature.direction === 1 ? endAngle : startAngle;
            
            const arrow = d3.symbol()
                .type(d3.symbolTriangle)
                .size(64);

            featureGroup.append("path")
                .attr("d", arrow)
                .attr("fill", feature.color)
                .attr("transform", `translate(${ (featureRadius) * Math.cos(arrowPoint - Math.PI / 2)}, ${ (featureRadius) * Math.sin(arrowPoint - Math.PI / 2)}) rotate(${arrowPoint * 180 / Math.PI + 90*feature.direction}) scale(2)`);
        }

        // Feature labels
        const midAngle = (startAngle + endAngle) / 2;
        const labelRadius = radius + 15 + (level * 25) + 20;
        const [lx, ly] = [labelRadius * Math.cos(midAngle - Math.PI / 2), labelRadius * Math.sin(midAngle - Math.PI / 2)];
        
        featureGroup.append("text")
            .attr("x", lx)
            .attr("y", ly)
            .attr("dy", "0.35em")
            .text(feature.label.length > 15 ? feature.label.substring(0,12) + '...': feature.label) // Truncate long labels
            .style("font-size", "10px")
            .style("text-anchor", "middle");
    });
    
    // Center text
    g.append("text")
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .attr("y", -10) 
        .text(data.name);
    
    g.append("text")
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .attr("y", 10)
        .text(`${data.length} bp`);

    container.appendChild(svg.node());
    console.log("Plasmid Map drawn in Circular Map View.js")
}
