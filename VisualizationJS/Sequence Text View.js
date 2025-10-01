/**
 * Renders the DNA sequence and its features in a text-based view.
 * @param {object} data - The plasmid data object from the parser.
 */

export function displaySequenceView(data) {
  const container = document.getElementById('sequence-view-container');
  container.innerHTML = '';

  const charsPerLine = 80;
  const charSize = { width: 8.4, height: 32 }; // Increased line height for spacing

  // Draw sequence lines
  for (let i = 0; i < data.length; i += charsPerLine) {
    const lineDiv = document.createElement('div');
    lineDiv.className = 'sequence-line';
    lineDiv.style.height = `${charSize.height}px`;
    lineDiv.style.lineHeight = `${charSize.height}px`;
    const numberSpan = document.createElement('span');
    numberSpan.className = 'line-number';
    numberSpan.textContent = i + 1;
    const chunkSpan = document.createElement('span');
    chunkSpan.className = 'sequence-chunk';
    chunkSpan.textContent = data.sequence.substring(i, i + charsPerLine);
    lineDiv.appendChild(numberSpan);
    lineDiv.appendChild(chunkSpan);
    container.appendChild(lineDiv);
  }

  // Draw feature annotations and labels
  data.features.forEach(feature => {
    const start_bp = feature.start - 1;
    const end_bp = feature.end - 1;
    const startYIndex = Math.floor(start_bp / charsPerLine);
    const startXIndex = start_bp % charsPerLine;
    const endYIndex = Math.floor(end_bp / charsPerLine);
    const endXIndex = end_bp % charsPerLine;

    // Draw the label inside the feature region
    const labelDiv = document.createElement('div');
    labelDiv.className = 'feature-label';
    labelDiv.textContent = feature.label;
    labelDiv.style.color = 'black'; // Force label color to black
    labelDiv.style.top = `${(startYIndex + endYIndex) / 2 * charSize.height}px`; // Midpoint vertically
    labelDiv.style.left = `${60 + ((startXIndex + endXIndex) / 2 * charSize.width)}px`; // Midpoint horizontally
    container.appendChild(labelDiv);

    // Draw the highlight annotation for each line the feature spans
    for (let y = startYIndex; y <= endYIndex; y++) {
      const annotationDiv = document.createElement('div');
      annotationDiv.className = 'feature-annotation';
      const lineStartChar = (y === startYIndex) ? startXIndex : 0;
      const lineEndChar = (y === endYIndex) ? endXIndex : charsPerLine - 1;
      annotationDiv.style.top = `${(y +1)* charSize.height + 16}px`;
      annotationDiv.style.left = `${60 + (lineStartChar * charSize.width)}px`;
      annotationDiv.style.width = `${(lineEndChar - lineStartChar + 1) * charSize.width}px`;
      annotationDiv.style.backgroundColor = feature.color;
      annotationDiv.style.opacity = '0.3';
      container.appendChild(annotationDiv);
    }
  });
}
