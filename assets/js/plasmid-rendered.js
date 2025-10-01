function drawPlasmidMap(data) {
    const container = document.getElementById('plasmid-map-container');
    container.innerHTML = ''; // Clear previous map
    
    const width = 1000, height = 500;
    const radius = Math.min(width/2, height) / 2 - 80; // Increased margin for labels

    // 1. Create the main SVG element and set its size
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height);

    //    All other elements will be appended to this group.
    const g = svg.append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);


    // Plasmid backbone
    const arc = d3.arc()
        .innerRadius(radius)
        .outerRadius(radius)
        .startAngle(0)
        .endAngle(2 * Math.PI);

    g.append("path")
        .attr("d", arc)
        .attr("stroke", "#333") // Darker gray for backbone
        .attr("stroke-width", 3)
        .attr("fill", "none");
    
    // Scale for positioning features on the circle
    const angleScale = d3.scaleLinear()
        .domain([1, data.length])
        .range([0, 2 * Math.PI]);

    // Simple algorithm to prevent features from overlapping
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

    // Draw all features as arcs
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
            const arrow = d3.symbol().type(d3.symbolTriangle).size(64);

            featureGroup.append("path")
                .attr("d", arrow)
                .attr("fill", feature.color)
                .attr("transform", `translate(${featureRadius * Math.cos(arrowPoint - Math.PI / 2)}, ${featureRadius * Math.sin(arrowPoint - Math.PI / 2)}) rotate(${arrowPoint * 180 / Math.PI + 90 * feature.direction}) scale(2)`);
        }

        // Add text labels for features
        const midAngle = (startAngle + endAngle) / 2;
        const labelRadius = radius + 15 + (level * 25) + 22; // Push labels out slightly
        const [lx, ly] = [labelRadius * Math.cos(midAngle - Math.PI / 2), labelRadius * Math.sin(midAngle - Math.PI / 2)];
        
        featureGroup.append("text")
            .attr("x", lx)
            .attr("y", ly)
            .attr("dy", "0.35em")
            .text(feature.label)
            .style("font-size", "10px")
            .style("text-anchor", "middle");
    });
    
    // Add text in the center of the plasmid
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
        .text(`${data.length.toLocaleString()} bp`);

    // Append the final SVG to the container in the HTML
    container.appendChild(svg.node());
}