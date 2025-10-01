// Import your custom modules
import { parseGenBankXML } from './XML Parser.js';
import { drawPlasmidMap } from './Circular Map View.js';
import { displaySequenceView } from './Sequence Text View.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT REFERENCES ---
    const fileTitle = document.getElementById('file-title');
    const summaryGrid = document.getElementById('summary-grid');
    // We are no longer using the old features table
    const downloadGbBtn = document.getElementById('download-gb-btn');
    const downloadFastaBtn = document.getElementById('download-fasta-btn');

    // --- RENDER FUNCTION for the top summary card ---
    function renderSummary(plasmidData) {
        summaryGrid.innerHTML = `
            <div class="summary-item"><strong>Definition</strong><span>${plasmidData.name}</span></div>
            <div class="summary-item"><strong>Accession</strong><span>${plasmidData.name}</span></div>
            <div class="summary-item"><strong>Organism</strong><span>(See full file)</span></div>
            <div class="summary-item"><strong>Length</strong><span>${plasmidData.length.toLocaleString()} bp</span></div>
        `;
        fileTitle.textContent = plasmidData.name;
        document.title = plasmidData.name;
    }

    // --- MAIN LOGIC ---
    async function main() {
        const params = new URLSearchParams(window.location.search);
        const uid = params.get('uid');
        if (!uid) {
            fileTitle.textContent = 'Error: No UID provided.';
            return;
        }

        try {
            // 1. Fetch the data as an XML string
            const xmlString = await efetchXML(uid);

            // 2. Parse the XML string into a DOM object
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "application/xml");

            // 3. Use your XML parser to get the structured plasmid data
            const plasmidData = parseGenBankXML(xmlDoc);

            if (plasmidData) {
                // 4. Render all the components using your functions
                renderSummary(plasmidData);
                drawPlasmidMap(plasmidData);
                displaySequenceView(plasmidData);

                // Re-wire download buttons (they still need to fetch plain text)
                downloadGbBtn.addEventListener('click', () => downloadFile(uid, 'gb'));
                downloadFastaBtn.addEventListener('click', () => downloadFile(uid, 'fasta'));

            } else {
                 throw new Error("Failed to parse plasmid data from XML.");
            }

        } catch (err) {
            console.error("Failed to load or render plasmid:", err);
            document.body.innerHTML = `<h1>Error</h1><p>Could not load data for UID: ${uid}.</p><pre>${err.message}</pre>`;
        }
    }
    
    // --- HELPER FUNCTIONS ---
    // Fetches the GenBank record in XML format
    async function efetchXML(id) {
        const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
        const url = `${baseUrl}efetch.fcgi?db=nuccore&id=${id}&rettype=gb&retmode=xml`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`E-fetch XML error, status: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            throw new Error("Error fetching XML data from EFetch API: " + error.message);
        }
    }
    
    // Helper function for downloads (fetches plain text)
    async function downloadFile(id, format) {
        const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
        const url = `${baseUrl}efetch.fcgi?db=nuccore&id=${id}&rettype=${format}&retmode=text`;
        try {
            const response = await fetch(url);
            const data = await response.text();
            const blob = new Blob([data], { type: 'text/plain' });
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = `${id}.${format}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            alert(`Failed to download ${format} file.`);
        }
    }

    main();
});