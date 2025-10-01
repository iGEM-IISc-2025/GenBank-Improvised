document.addEventListener('DOMContentLoaded', () => {
    const fileTitle = document.getElementById('file-title');
    const summaryGrid = document.getElementById('summary-grid');
    const featuresTbody = document.getElementById('features-tbody');
    const featureSearch = document.getElementById('feature-search');
    const featureSearchSubclass = document.getElementById('feature-search-subclass');
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
            definition: gbText.match(/DEFINITION\s+(.*)/)?.[1] || 'n/a',
            accession: gbText.match(/ACCESSION\s+(.*)/)?.[1] || 'n/a',
            organism: gbText.match(/ORGANISM\s+([\s\S]*?)\n\w/m)?.[1].replace(/\s+/g, ' ') || 'n/a',
            sequence: (gbText.split('ORIGIN')[1] || '').replace(/[\d\s\/]/g, ''),
            features: [],
            references: (gbText.split('REFERENCE')[1] || '').split('FEATURES')[0] || 'no references found.'
        };

        const featuresStartIndex = gbText.indexOf('FEATURES');
        if (featuresStartIndex === -1) {
            return data; // No features section, return early
        }

        // Check if an ORIGIN tag exists to define the end of the features section
        const originStartIndex = gbText.indexOf('ORIGIN');
        let featuresText;

        if (originStartIndex > -1) {
            // If ORIGIN exists, get the text between FEATURES and ORIGIN
            featuresText = gbText.substring(featuresStartIndex, originStartIndex);
        } else {
            // If ORIGIN does not exist, get all text from FEATURES to the end of the file
            featuresText = gbText.substring(featuresStartIndex);
        }

        const featureEntries = featuresText.trim().split(/\n\s{5}(?=\w)/);
        featureEntries.shift(); // removes the 'location/qualifiers' header line

        featureEntries.forEach(entry => {
            const lines = entry.trim().split('\n');
            if (lines.length === 0 || !lines[0]) return; // Skip empty entries

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

        // If no sequence was found via ORIGIN, set a placeholder message
        if (data.sequence === '') {
            data.sequence = 'Sequence data is not available in this record.';
        }

        return data;
    }

    // function formatDataForPlasmid(genbankData) {
    //     const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    //     let colorIndex = 0;

    //     const plasmidFeatures = genbankData.features
    //         .map(feature => {
    //             const locationMatch = feature.location.match(/(\d+)\.\.(\d+)/);
    //             if (!locationMatch) return null;

    //             const start = parseInt(locationMatch[1], 10);
    //             const end = parseInt(locationMatch[2], 10);
    //             const direction = feature.location.includes('complement') ? -1 : 1;
                
    //             return {
    //                 start: start,
    //                 end: end,
    //                 direction: direction,
    //                 label: feature.details,
    //                 color: colorScale(colorIndex++)
    //             };
    //         })
    //         .filter(f => f !== null);

    //     return {
    //         name: genbankData.accession,
    //         length: genbankData.sequence.length,
    //         sequence: genbankData.sequence,
    //         features: plasmidFeatures
    //     };
    // }

    function levenshteinDistance(word1, word2) {
        const a = String(word1);
        const b = String(word2);
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
        // Split file content into lines
        const lines = fileContent.split(/\r?\n/);
        let in_Descrivtion_section = true;
        target_subclass = (target_subclass || "").trim().toUpperCase();
        const matches = [];
        let line_number = 1;
        let in_correct_subclass = true;
        let spaces_before = 10;
        let exit = false;

        for (let idx = 0; idx < lines.length && !exit; idx++) {
            let line = (lines[idx] || "").trim();

            // Check for start of FEATURES section
            if (line.startsWith("FEATURES")) {
                spaces_before = 21;
            }
            // Check for start of ORIGIN section
            if (line.startsWith("ORIGIN")) {
                in_Descrivtion_section = false;
                break;
            }

            // If subclass is empty and in description section
            if (target_subclass === "" && in_Descrivtion_section) {
                if (target_word === "" && line_number > 0) {
                    matches.push(["N/A", "N/A", "N/A", "N/A", "N/A"]);
                    exit = true;
                }
                const line_content = line.slice(spaces_before);
                if (line_content !== "") {
                    let word = line_content.replace(/^\/+/, "").replace(/"/g, "").replace(/=/g, " ");
                    // Similarity threshold
                    const a = Math.min(target_word.length, word.length);
                    const b = Math.pow(a, 1 / 2) * (1 - Math.pow(2, -a / 3));
                    let c = b + 1;
                    let l = [];
                    let short_word = word.length < target_word.length ? word : target_word;
                    let long_word = word.length < target_word.length ? target_word : word;
                    for (let i = 0; i <= long_word.length - short_word.length; i++) {
                        let ld = levenshteinDistance(short_word, long_word.slice(i, i + short_word.length));
                        if (ld <= b) l.push(ld);
                    }
                    if (l.length < 3 && l.length > 0) {
                        c = Math.min(...l);
                        matches.push([line_number, line, word, target_word, c]);
                    } else if (l.length >= 3) {
                        matches.push([line_number, line, word, target_word, c + 2]);
                    }
            }
            line_number++;
            continue;
        }

        // If subclass is not empty and in description section
        if (target_subclass !== "" && in_Descrivtion_section) {
        // Similarity threshold for subclass
        const leftSlice = line.slice(0, spaces_before).trim().toUpperCase();
        const a = Math.min(target_subclass.length, leftSlice.length);
        const b = 4 * (1 - Math.pow(2, -a / 3));
        if (levenshteinDistance(leftSlice, target_subclass) <= b) {
            in_correct_subclass = true;
        } else if (!/^\s*$/.test(line.slice(0, spaces_before))) {
            in_correct_subclass = false;
        }
        if (in_correct_subclass) {
            const line_content = line.slice(spaces_before);
            if (target_word === "" && line_number > 0) {
                matches.push(["N/A", "N/A", "N/A", "N/A", "N/A"]);
                exit = true;
            } else if (line_content !== "") {
                let word = line_content.replace(/^\/+/, "").replace(/"/g, "").replace(/=/g, " ");
                // Similarity threshold for word matching
                const a = Math.min(target_word.length, word.length);
                const b = Math.pow(a, 1 / 2) * (1 - Math.pow(2, -a / 3));
                let c = b + 1;
                let l = [];
                let short_word = word.length < target_word.length ? word : target_word;
                let long_word = word.length < target_word.length ? target_word : word;
                for (let i = 0; i <= long_word.length - short_word.length; i++) {
                    let ld = levenshteinDistance(short_word, long_word.slice(i, i + short_word.length));
                    if (ld <= b) l.push(ld);
                }
                if (l.length < 3 && l.length > 0) {
                    c = Math.min(...l);
                    matches.push([line_number, line, word, target_word, c]);
                } else if (l.length >= 3) {
                    matches.push([line_number, line, word, target_word, c + 2]);
                }
            }
        }
        }
            line_number++;
        }
        return matches;
    }
    
    function renderSummary() {
        summaryGrid.innerHTML = `
            <div class="summary-item"><strong>definition</strong><span>${parsedData.definition}</span></div>
            <div class="summary-item"><strong>accession</strong><span>${parsedData.accession}</span></div>
            <div class="summary-item"><strong>organism</strong><span>${parsedData.organism}</span></div>
            <div class="summary-item"><strong>length</strong><span>${parsedData.sequence.length.toLocaleString()} bp</span></div>
        `;
        fileTitle.textContent = parsedData.definition;
        document.title = parsedData.definition;
    }
    
    // Renders the clean, parsed feature list
    function renderFeaturesTable() {
        if (parsedData.features.length < 1) {
            featuresTbody.innerHTML = `<tr><td colspan="3">no features could be parsed from this file.</td></tr>`;
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

    // Renders the fuzzy search results from ParserFeatures function
    function renderSearchResults(matches = []) {
        if (matches.length === 0) {
            featuresTbody.innerHTML = `<tr><td colspan="3">No matches found for your query.</td></tr>`;
            return;
        }
        matches.sort((a, b) => a[4] - b[4]); // Sort by distance
        featuresTbody.innerHTML = matches.map(match => {
            const [lineNumber, lineContent] = match;
            return `
                <tr>
                    <td>Line ${lineNumber}</td>
                    <td colspan="2">${lineContent}</td>
                </tr>
            `;
        }).join('');
    }

    function renderSequence() {
        const formattedSequence = parsedData.sequence.replace(/(.{10})/g, "$1 ").replace(/(.{66})/g, "$1\n");
        sequencePre.textContent = formattedSequence;
    }
    
    function handleTabClick(e) {
        const clickedTab = e.target.closest('.tab-btn');
        if (!clickedTab) return;
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        clickedTab.classList.add('active');
        document.getElementById(clickedTab.dataset.tab).classList.add('active');
    }

    function handleFeatureSearch() {
        const query_searchword = featureSearch.value;
        const query_subclass = featureSearchSubclass.value;
        
        // If the main search bar is empty, show the original clean feature table
        if (query_searchword.trim() === '') {
            renderFeaturesTable();
            return;
        }
        
        const searchArray = ParserFeatures(rawGbData, query_subclass, query_searchword);
        console.log("Search Results:", searchArray);

        // Render the new fuzzy search results
        renderSearchResults(searchArray);
    }

    async function handleCopySequence() {
        try {
            await navigator.clipboard.writeText(parsedData.sequence);
            copySeqBtn.textContent = 'copied!';
            setTimeout(() => { copySeqBtn.textContent = 'copy'; }, 2000);
        } catch (err) {
            console.error('failed to copy sequence: ', err);
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
            fileTitle.textContent = 'error: no uid provided.';
            return;
        }

        try {
            rawGbData = await efetch(uid, 'gb');
            parsedData = parseGenBank(rawGbData);

            renderSummary();
            renderFeaturesTable(); // Initial render with the clean feature list
            renderSequence();
            referencesPre.textContent = parsedData.references;
            document.getElementById('raw-genbank-pre').textContent = rawGbData;

            // const plasmidDataForMap = formatDataForPlasmid(parsedData);
            // if (typeof drawPlasmidMap === 'function' && plasmidDataForMap.features.length > 0) {
            //     drawPlasmidMap(plasmidDataForMap);
            // } else {
            //     document.getElementById('plasmid-map-container').textContent = 'No features available to draw a plasmid map.';
            // }

            // Attach event listeners for both search inputs
            tabContainer.addEventListener('click', handleTabClick);
            featureSearch.addEventListener('input', handleFeatureSearch);
            featureSearchSubclass.addEventListener('input', handleFeatureSearch);
            copySeqBtn.addEventListener('click', handleCopySequence);
            downloadGbBtn.addEventListener('click', () => downloadFile(`${parsedData.accession}.gb`, rawGbData));
            downloadFastaBtn.addEventListener('click', () => {
                const fastaContent = `>${parsedData.accession} ${parsedData.definition}\n${parsedData.sequence}`;
                downloadFile(`${parsedData.accession}.fasta`, fastaContent);
            });

        } catch (err) {
            console.error("failed to load or parse genbank file:", err);
            document.body.innerHTML = `<h1>error</h1><p>could not load data for uid: ${uid}.</p><pre>${err.message}</pre>`;
        }
    }

    main();
});