import { parseGenBankXML } from './XML Parser.js';
import { drawPlasmidMap } from './Circular Map View.js';
import { displaySequenceView } from './Sequence Text View.js';

document.addEventListener('DOMContentLoaded', function () {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    // --- File Handling ---
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    });
    function handleFile(file) {
        if (file && file.name.endsWith('.xml')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const xmlString = e.target.result;
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlString, "application/xml");
                const plasmidData = parseGenBankXML(xmlDoc);
                console.log(plasmidData)
                if(plasmidData) {
                    // Call the modular functions to render the views
                    drawPlasmidMap(plasmidData);
                    displaySequenceView(plasmidData);
                }
            };
            reader.readAsText(file);
        } else {
            alert('Please provide a valid .xml file.');
        }
    }
});
