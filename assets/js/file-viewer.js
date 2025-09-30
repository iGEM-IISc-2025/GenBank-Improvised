document.addEventListener('DOMContentLoaded', () => {
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

    function parseGenBank(gbText) {
        const data = {
            definition: gbText.match(/DEFINITION\s+(.*)/)?.[1] || 'N/A',
            accession: gbText.match(/ACCESSION\s+(.*)/)?.[1] || 'N/A',
            organism: gbText.match(/ORGANISM\s+([\s\S]*?)\n\w/m)?.[1].replace(/\s+/g, ' ') || 'N/A',
            sequence: (gbText.split('ORIGIN')[1] || '').replace(/[\d\s\/]/g, ''),
            features: [],
            references: (gbText.split('REFERENCE')[1] || '').split('FEATURES')[0] || 'No references found.'
        };
        const featuresStartIndex = gbText.indexOf('FEATURES');
        const originStartIndex = gbText.indexOf('ORIGIN');
        if (featuresStartIndex === -1 || originStartIndex === -1) { return data; }
        const featuresText = gbText.substring(featuresStartIndex, originStartIndex);
        const featureEntries = featuresText.trim().split(/\n\s{5}(?=\w)/);
        featureEntries.shift();
        featureEntries.forEach(entry => {
            const lines = entry.trim().split('\n');
            const [type, location] = lines[0].trim().split(/\s+/);
            const qualifiers = lines.slice(1).map(l => l.trim().replace(/"/g, ''));
            let primaryDetail = '';
            const geneQualifier = qualifiers.find(q => q.startsWith('/gene='));
            const productQualifier = qualifiers.find(q => q.startsWith('/product='));
            if (geneQualifier) {
                primaryDetail = geneQualifier.split('=')[1];
            } else if (productQualifier) {
                primaryDetail = productQualifier.split('=')[1];
            } else {
                primaryDetail = qualifiers[0] || 'no details';
            }
            data.features.push({ type, location, details: primaryDetail });
        });
        return data;
    }

    function levenshteinDistance(word1, word2) {
        const a = String(word1);
        const b = String(word2);
        const len_a = a.length;
        const len_b = b.length;
        if (len_a === 0) return len_b;
        if (len_b === 0) return len_a;

        const matrix = Array(len_b + 1).fill(null).map(() => Array(len_a + 1).fill(null));
        for (let i = 0; i <= len_a; i++) { matrix[0][i] = i; }
        for (let j = 0; j <= len_b; j++) { matrix[j][0] = j; }

        for (let j = 1; j <= len_b; j++) {
            for (let i = 1; i <= len_a; i++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,      // Deletion
                    matrix[j - 1][i] + 1,      // Insertion
                    matrix[j - 1][i - 1] + cost // Substitution
                );
            }
        }
        return matrix[len_b][len_a];
    }
    
    // Render Functions
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

    // This function can now render a specific list of features
    function renderFeaturesTable(featuresToRender = parsedData.features) {
        if (!featuresToRender || featuresToRender.length === 0) {
            featuresTbody.innerHTML = `<tr><td colspan="3">No features found.</td></tr>`;
            return;
        }
        featuresTbody.innerHTML = featuresToRender.map(f => `
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
    
    // handles what happens when a tab is clicked
    function handleTabClick(e) {
        const clickedTab = e.target.closest('.tab-btn');
        if (!clickedTab) return;

        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        clickedTab.classList.add('active');
        document.getElementById(clickedTab.dataset.tab).classList.add('active');
    }

    // handles filtering the features table when a user types in the search bar
    function handleFeatureSearch() {
        const query = featureSearch.value.toLowerCase().trim();

        // If the search bar is empty, show all features
        if (!query) {
            renderFeaturesTable(parsedData.features);
            return;
        }

        // Determine the "close enough" limit based on formula
        const limit = 4 * (1 - Math.pow(2, -query.length / 3));

        // Filter the already-parsed features based on the Levenshtein distance
        const matchedFeatures = parsedData.features.filter(feature => {
            const detailText = (feature.details || '').toLowerCase();
            const distance = levenshteinDistance(query, detailText);
            return distance <= limit;
        });

        // Re-render the table with only the matched features
        renderFeaturesTable(matchedFeatures);
    }

    // handles copying the sequence to the clipboard
    async function handleCopySequence() {
        try {
            await navigator.clipboard.writeText(parsedData.sequence);
            copySeqBtn.textContent = 'copied!';
            setTimeout(() => { copySeqBtn.textContent = 'copy'; }, 2000);
        } catch (err) {
            console.error('failed to copy sequence: ', err);
        }
    }
    
    // handles the logic for downloading a file
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


    function levenshteinDistance(word1, word2){
        a = String(word1);
        b = String(word2);

        const len_a = a.length;
        const len_b = b.length;

        const maxdist = len_a + len_b;

        const da = Object.create(null);

        const d = new Array(len_a + 2);

        for (let i = 0; i < len_a + 2; i++) d[i] = new Array(len_b + 2).fill(0);
        for (let i = 0; i < len_a + 2; i++) d[i][0] = maxdist;
        for (let j = 0; j < len_b + 2; j++) d[0][j] = maxdist;
        d[1][1] = 0;
        for (let i = 1; i < len_a + 2; i++) d[i][1] = i - 1;
        for (let j = 1; j < len_b + 2; j++) d[1][j] = j - 1;
        for (let i = 1; i <= len_a; i++) {
            let db = 0;
            for (let j = 1; j <= len_b; j++) {
            const i1 = da[b[j - 1]] || 0;
            const j1 = db;
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            if (cost === 0) db = j;
            d[i + 1][j + 1] = Math.min(
                d[i][j] + cost,
                d[i + 1][j] + 1,
                d[i][j + 1] + 1,
                d[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1)
            );
            }
            da[a[i - 1]] = i;
        }

        return d[len_a + 1][len_b + 1];
    }

    function ParserFeatures(fileContent, target_subclass = "", target_word = "") {
        const lines = fileContent.split(/\r?\n/);
        let in_feature = false;
        target_subclass = (target_subclass || "").trim().toUpperCase();
        const matches = [];
        let line_number = 0;
        let in_correct_subclass = true;

        for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx] || "";
            // Check for start/end of features section
            if (line.startsWith("FEATURES")) in_feature = true;
            else if (line.startsWith("ORIGIN")) in_feature = false;

            if (target_subclass === "") {
            const line_content = line.slice(21);
            let words = line_content.replace(/^\/+/, "").split("=");
            let words2 = words.length > 2 ? words[2].split(/\s+/) : [];
            words = words.concat(words2);
            for (let word of words) {
                word = word.replace(/^"+|"+$/g, "");
                const a = Math.max(target_word.length, word.length);
                const b = Math.pow(a, 1 / 2) * (1 - Math.pow(10, -a));
                const c = levenshteinDistance(target_word, word);
                if (c <= b) {
                matches.push([line_number, line.trim(), word, target_word, c]);
                }
            }
            line_number++;
            continue;
            }

            if (in_feature) {
            const leftSlice = (line.slice(0, 20) || "").trim().toUpperCase();
            const a = Math.min(target_subclass.length, leftSlice.length);
            const b = 4 * (1 - Math.pow(2, -a / 3));
            if (levenshteinDistance(leftSlice, target_subclass) <= b) in_correct_subclass = true;
            else if (!/^\s*$/.test(line.slice(0, 20))) in_correct_subclass = false;

            if (in_correct_subclass) {
                const line_content = line.slice(21);
                let newline = line_content.replace(/^\/+/, "");
                let words = newline.split("=");
                for (let word of words) {
                word = word.replace(/^"+|"+$/g, "");
                const a = Math.max(target_word.length, word.length);
                const b = Math.pow(a, 1 / 2) * (1 - Math.pow(10, -a));
                let c = levenshteinDistance(target_word, word);
                let l = [];
                for (let i = 0; i <= word.length - target_word.length; i++) {
                    let ld = levenshteinDistance(target_word, word.slice(i, i + target_word.length));
                    if (ld <= 2) l.push(ld);
                }
                if (l.length > 0) c = Math.min(...l);
                if (c <= b) {
                    matches.push([line_number, line.trim(), word, target_word, c]);
                }
                }
            }
            }
            line_number++;
        }
        return matches;
    }
    
    // the main function that runs when the page loads
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
            renderFeaturesTable(); // Initial render with all features
            renderSequence();
            referencesPre.textContent = parsedData.references;
            document.getElementById('raw-genbank-pre').textContent = rawGbData;

            // Attach all event listeners
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
