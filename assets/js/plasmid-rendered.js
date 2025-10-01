function drawPlasmidMap(data) {
    const container = document.getElementById('plasmid-map-container');
    container.innerHTML = ''; // Clear previous map
    
    const width = 600;
    const height = 600;
    const radius = Math.min(width, height) / 2 - 120; // Increased margin for labels

    // 1. Create the main SVG element and set its size
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height);

    // 2. Create a single group element 'g' and move it to the center.
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
        .domain([0, data.length])
        .range([0, 2 * Math.PI]);

    data.features.sort((a, b) => a.start - b.start);
    const levels = [];
    data.features.forEach(feature => {
        let level = 0;
        // Find the first level where this feature doesn't overlap
        while (level < levels.length && levels[level].some(placedFeature => feature.start < placedFeature.end && feature.end > placedFeature.start)) {
            level++;
        }
        if (!levels[level]) {
            levels[level] = [];
        }
        levels[level].push(feature);
        feature.level = level;
    });

    // Draw all features as arcs
    const featureGroup = g.append("g");
    data.features.forEach(feature => {
        const startAngle = angleScale(feature.start);
        const endAngle = angleScale(feature.end);
        const level = feature.level || 0;
        const featureRadius = radius + 20 + (level * 25);

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
                .attr("transform", `translate(${featureRadius * Math.cos(arrowPoint - Math.PI / 2)}, ${featureRadius * Math.sin(arrowPoint - Math.PI / 2)}) rotate(${arrowPoint * 180 / Math.PI + 90* feature.direction} scale(2))`);
        }

        const midAngle = (startAngle + endAngle) / 2;
        const angularWidth = Math.abs(endAngle - startAngle);
        const labelText = feature.label.length > 20 ? feature.label.substring(0, 17) + '...' : feature.label;

        // Decide if label goes inside or outside based on arc length
        if (angularWidth * featureRadius > labelText.length * 5.5) { // Heuristic check
            // Place label inside arc, rotated with the arc
            const labelRadius = featureRadius;
            const [lx, ly] = [labelRadius * Math.cos(midAngle - Math.PI / 2), labelRadius * Math.sin(midAngle - Math.PI / 2)];

            featureGroup.append("text")
                .attr("x", lx)
                .attr("y", ly)
                .attr("dy", "0.35em")
                .text(labelText)
                .style("font-size", "9px")
                .style("fill", "white")
                .style("text-anchor", "middle")
                .attr("transform", `rotate(${(midAngle * 180 / Math.PI) - 90}, ${lx}, ${ly})`);

        } else {
            // Place label outside with a connecting line
            const labelStartRadius = featureRadius;
            const labelEndRadius = radius + 20 + (levels.length * 25) + 20;
            const [startX, startY] = [labelStartRadius * Math.cos(midAngle - Math.PI / 2), labelStartRadius * Math.sin(midAngle - Math.PI / 2)];
            const [endX, endY] = [labelEndRadius * Math.cos(midAngle - Math.PI / 2), labelEndRadius * Math.sin(midAngle - Math.PI / 2)];

            // Line
            featureGroup.append("line")
                .attr("x1", startX).attr("y1", startY)
                .attr("x2", endX).attr("y2", endY)
                .attr("stroke", "#666")
                .attr("stroke-width", 1);
            
            // Text
            featureGroup.append("text")
                .attr("x", endX + (endX > 0 ? 5 : -5))
                .attr("y", endY)
                .attr("dy", "0.35em")
                .text(labelText)
                .style("font-size", "10px")
                .style("text-anchor", endX > 0 ? "start" : "end");
        }
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
