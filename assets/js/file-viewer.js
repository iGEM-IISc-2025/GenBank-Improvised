document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT REFERENCES ---
    const fileTitle = document.getElementById('file-title');
    const summaryGrid = document.getElementById('summary-grid');
    const featuresTbody = document.getElementById('features-tbody');
    const featureSearch = document.getElementById('feature-search');
    const sequencePre = document.getElementById('sequence-pre');
    const referencesPre = document.getElementById('references-pre');
    const copySeqBtn = document.getElementById('copy-seq-btn');
    const downloadGbBtn = document.getElementById('download-gb-btn');
    const downloadFastaBtn = document.getElementById('download-fasta-btn');
    const tabContainer = document.querySelector('.tab-nav');

    let rawGbData = '';
    let parsedData = {};

    // --- NEW & IMPROVED PARSER ---
    function parseGenBank(gbText) {
        const data = {
            definition: gbText.match(/DEFINITION\s+(.*)/)?.[1] || 'N/A',
            accession: gbText.match(/ACCESSION\s+(.*)/)?.[1] || 'N/A',
            organism: gbText.match(/ORGANISM\s+([\s\S]*?)\n\w/m)?.[1].replace(/\s+/g, ' ') || 'N/A',
            sequence: (gbText.split('ORIGIN')[1] || '').replace(/[\d\s\/]/g, ''),
            features: [],
            references: (gbText.split('REFERENCE')[1] || '').split('FEATURES')[0] || 'No references found.'
        };

        // 1. Reliably find the features text block between 'FEATURES' and 'ORIGIN'
        const featuresStartIndex = gbText.indexOf('FEATURES');
        const originStartIndex = gbText.indexOf('ORIGIN');
        if (featuresStartIndex === -1 || originStartIndex === -1) {
            return data; // Return if sections are missing
        }
        const featuresText = gbText.substring(featuresStartIndex, originStartIndex);

        // 2. Split the block into individual feature entries
        const featureEntries = featuresText.trim().split(/\n\s{5}(?=\w)/);
        featureEntries.shift(); // Remove the "Location/Qualifiers" header line

        featureEntries.forEach(entry => {
            const lines = entry.trim().split('\n');
            const [type, location] = lines[0].trim().split(/\s+/);
            const qualifiers = lines.slice(1).map(l => l.trim().replace(/"/g, ''));

            // 3. Intelligently find the most important detail (gene or product)
            let primaryDetail = '';
            const geneQualifier = qualifiers.find(q => q.startsWith('/gene='));
            const productQualifier = qualifiers.find(q => q.startsWith('/product='));

            if (geneQualifier) {
                primaryDetail = geneQualifier.split('=')[1];
            } else if (productQualifier) {
                primaryDetail = productQualifier.split('=')[1];
            } else {
                primaryDetail = qualifiers[0] || 'No details'; // Fallback
            }

            data.features.push({
                type,
                location,
                details: primaryDetail
            });
        });

        return data;
    }

    // --- RENDER FUNCTIONS --- (No changes needed here)
    function renderSummary() {
        summaryGrid.innerHTML = `
            <div class="summary-item"><strong>Definition</strong><span id="summary-definition">${parsedData.definition}</span></div>
            <div class="summary-item"><strong>Accession</strong><span id="summary-accession">${parsedData.accession}</span></div>
            <div class="summary-item"><strong>Organism</strong><span id="summary-organism">${parsedData.organism}</span></div>
            <div class="summary-item"><strong>Length</strong><span>${parsedData.sequence.length.toLocaleString()} bp</span></div>
        `;
        fileTitle.textContent = parsedData.definition;
        document.title = parsedData.definition;
    }

    function renderFeaturesTable() {
        if (parsedData.features.length === 0) {
            featuresTbody.innerHTML = `<tr><td colspan="3">No features could be parsed from this file.</td></tr>`;
            return;
        }
        featuresTbody.innerHTML = parsedData.features.map(f => `
            <tr>
                <td>${f.type}</td>
                <td>${f.location}</td>
                <td>${f.details}</td>
            </tr>
        `).join('');
    }

    function renderSequence() {
        const formattedSequence = parsedData.sequence.replace(/(.{10})/g, "$1 ").replace(/(.{66})/g, "$1\n");
        sequencePre.textContent = formattedSequence;
    }
    
    // --- EVENT HANDLERS & MAIN LOGIC --- (No changes needed here)
    function handleTabClick(e) {
        const clickedTab = e.target.closest('.tab-btn');
        if (!clickedTab) return;

        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        clickedTab.classList.add('active');
        document.getElementById(clickedTab.dataset.tab).classList.add('active');
    }

    function handleFeatureSearch() {
        const query = featureSearch.value.toLowerCase();
        featuresTbody.querySelectorAll('tr').forEach(row => {
            const rowText = row.textContent.toLowerCase();
            row.style.display = rowText.includes(query) ? '' : 'none';
        });
    }

    async function handleCopySequence() {
        try {
            await navigator.clipboard.writeText(parsedData.sequence);
            copySeqBtn.textContent = 'Copied!';
            setTimeout(() => { copySeqBtn.textContent = 'Copy'; }, 2000);
        } catch (err) {
            console.error('Failed to copy sequence: ', err);
        }
    }
    
    function downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    async function main() {
        const params = new URLSearchParams(window.location.search);
        const uid = params.get('uid');
        if (!uid) {
            fileTitle.textContent = 'Error: No UID provided.';
            return;
        }

        try {
            rawGbData = await efetch(uid, 'gb');
            parsedData = parseGenBank(rawGbData);

            renderSummary();
            renderFeaturesTable();
            renderSequence();
            referencesPre.textContent = parsedData.references;
            document.getElementById('raw-genbank-pre').textContent = rawGbData;

            tabContainer.addEventListener('click', handleTabClick);
            featureSearch.addEventListener('input', handleFeatureSearch);
            copySeqBtn.addEventListener('click', handleCopySequence);
            downloadGbBtn.addEventListener('click', () => downloadFile(`${parsedData.accession}.gb`, rawGbData));
            downloadFastaBtn.addEventListener('click', () => {
                const fastaContent = `>${parsedData.accession} ${parsedData.definition}\n${parsedData.sequence}`;
                downloadFile(`${parsedData.accession}.fasta`, fastaContent);
            });

        } catch (err) {
            console.error("Failed to load or parse GenBank file:", err);
            document.body.innerHTML = `<h1>Error</h1><p>Could not load data for UID: ${uid}.</p><pre>${err.message}</pre>`;
        }
    }

    main();
});