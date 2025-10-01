import { parseGenBankXML } from './XML Parser.js';
import { drawPlasmidMap } from './Circular Map View.js';

document.addEventListener('DOMContentLoaded', () => {
    const fileTitle = document.getElementById('file-title');
    const summaryGrid = document.getElementById('summary-grid');
    const featuresTbody = document.getElementById('features-tbody');
    const featureSearch = document.getElementById('feature-search');
    const featureSearchSubclass = document.getElementById('feature-search-subclass');
    const sequencePre = document.getElementById('sequence-pre');
    const referencesPre = document.getElementById('references-pre');
    const rawGbPre = document.getElementById('raw-genbank-pre');
    const copySeqBtn = document.getElementById('copy-seq-btn');
    const downloadGbBtn = document.getElementById('download-gb-btn');
    const downloadFastaBtn = document.getElementById('download-fasta-btn');
    const tabContainer = document.querySelector('.tab-nav');

    let rawGbData = '';
    let parsedTextData = {};

    async function main() {
        const params = new URLSearchParams(window.location.search);
        const uid = params.get('uid');
        if (!uid) {
            fileTitle.textContent = 'Error: No UID provided.';
            return;
        }

        try {
            // Fetch both text and XML data in parallel for efficiency
            const [gbText, xmlString] = await Promise.all([
                efetch(uid, 'gb', 'text'), // Fetches plain text for tables/text views
                efetch(uid, 'gb', 'xml')  // Fetches XML for the plasmid map
            ]);

            rawGbData = gbText; // Store raw text for searching and download

            // Process text data
            parsedTextData = parseGenBank(rawGbData);
            renderSummary(parsedTextData);
            renderFeaturesTable(parsedTextData.features);
            renderSequence(parsedTextData);
            referencesPre.textContent = parsedTextData.references;
            rawGbPre.textContent = rawGbData;
            
            // Process XML data
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "application/xml");
            const parsedXMLData = parseGenBankXML(xmlDoc);

            if (parsedXMLData && parsedXMLData.features.length > 0) {
                drawPlasmidMap(parsedXMLData);
            } else {
                document.getElementById('plasmid-map-container').textContent = 'No features available to draw a plasmid map.';
            }

            tabContainer.addEventListener('click', handleTabClick);
            featureSearch.addEventListener('input', handleFeatureSearch);
            featureSearchSubclass.addEventListener('input', handleFeatureSearch);
            copySeqBtn.addEventListener('click', () => handleCopySequence(parsedTextData.sequence));
            downloadGbBtn.addEventListener('click', () => downloadFile(uid, 'gb', rawGbData));
            downloadFastaBtn.addEventListener('click', () => {
                const fastaContent = `>${parsedTextData.accession} ${parsedTextData.definition}\n${parsedTextData.sequence}`;
                downloadFile(uid, 'fasta', fastaContent);
            });

        } catch (err) {
            console.error("Failed to load or parse GenBank file:", err);
            const container = document.querySelector('.viewer-container');
            container.innerHTML = `<h1>Error</h1><p>Could not load data for UID: ${uid}.</p><pre>${err.message}</pre>`;
        }
    }
    

    // Fetches data from NCBI. Can get text OR xml.
    async function efetch(id, rettype, retmode = 'text') {
        const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
        const url = `${baseUrl}efetch.fcgi?db=nuccore&id=${id}&rettype=${rettype}&retmode=${retmode}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Fetch error for ${retmode}: ${response.status}`);
            return await response.text();
        } catch (error) {
            throw new Error(`Could not fetch data for ID ${id}: ${error.message}`);
        }
    }

    // Text-based GenBank parser for summary, features table, etc.
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
        if (featuresStartIndex === -1) { return data; }
        const originStartIndex = gbText.indexOf('ORIGIN');
        let featuresText = originStartIndex > -1 ? gbText.substring(featuresStartIndex, originStartIndex) : gbText.substring(featuresStartIndex);
        const featureEntries = featuresText.trim().split(/\n\s{5}(?=\w)/);
        featureEntries.shift();
        featureEntries.forEach(entry => {
            const lines = entry.trim().split('\n');
            if (!lines[0]) return;
            const [type, location] = lines[0].trim().split(/\s+/);
            const qualifiers = lines.slice(1).map(l => l.trim().replace(/"/g, ''));
            let primaryDetail = '';
            const geneQualifier = qualifiers.find(q => q.startsWith('/gene='));
            const productQualifier = qualifiers.find(q => q.startsWith('/product='));
            if (geneQualifier) primaryDetail = geneQualifier.split('=')[1];
            else if (productQualifier) primaryDetail = productQualifier.split('=')[1];
            else primaryDetail = qualifiers[0] || 'no details';
            data.features.push({ type, location, details: primaryDetail });
        });
        if (data.sequence === '') data.sequence = 'Sequence data not available in this record.';
        return data;
    }

    // Your advanced fuzzy-search parser
    function ParserFeatures(fileContent, target_subclass = "", target_word = "") {
        const lines = fileContent.split(/\r?\n/);
        let in_feature_section = false;
        target_subclass = (target_subclass || "").trim().toUpperCase();
        const matches = [];
        let line_number = 1;
        let in_correct_subclass = !target_subclass;

        for (const line of lines) {
            if (line.startsWith("FEATURES")) in_feature_section = true;
            if (line.startsWith("ORIGIN")) break;

            if (target_subclass && in_feature_section) {
                const leftSlice = (line.slice(0, 21) || "").trim().toUpperCase();
                if (leftSlice) { // Only update subclass if there's a new feature type
                    const dist = levenshteinDistance(leftSlice, target_subclass);
                    in_correct_subclass = dist <= 2;
                }
            }
            
            if (in_correct_subclass) {
                const content = line.slice(21);
                const words = content.replace(/"/g, '').split(/[\s=,]+/);
                for (const word of words) {
                    if (!word) continue;
                    const dist = levenshteinDistance(word, target_word);
                    const limit = Math.sqrt(target_word.length);
                    if (dist <= limit) {
                        matches.push([line_number, line.trim(), word, target_word, dist]);
                        break; 
                    }
                }
            }
            line_number++;
        }
        return matches;
    }

    // Your Levenshtein distance function
    function levenshteinDistance(s1, s2) {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) costs[j] = j;
                else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }

    // Rendering functions
    function renderSummary(data) {
        summaryGrid.innerHTML = `
            <div class="summary-item"><strong>Definition</strong><span>${data.definition}</span></div>
            <div class="summary-item"><strong>Accession</strong><span>${data.accession}</span></div>
            <div class="summary-item"><strong>Organism</strong><span>${data.organism}</span></div>
            <div class="summary-item"><strong>Length</strong><span>${data.sequence.length.toLocaleString()} bp</span></div>
        `;
        fileTitle.textContent = data.definition;
        document.title = data.definition;
    }

    function renderFeaturesTable(features = []) {
        if (features.length < 1) {
            featuresTbody.innerHTML = `<tr><td colspan="3">No features could be parsed from this file.</td></tr>`;
            return;
        }
        featuresTbody.innerHTML = features.map(f => `
            <tr><td>${f.type}</td><td>${f.location}</td><td>${f.details}</td></tr>
        `).join('');
    }

    function renderSearchResults(matches = []) {
        if (matches.length === 0) {
            featuresTbody.innerHTML = `<tr><td colspan="3">No matches found for your query.</td></tr>`;
            return;
        }
        matches.sort((a, b) => a[4] - b[4]);
        featuresTbody.innerHTML = matches.map(match => `
            <tr><td>Line ${match[0]}</td><td colspan="2">${match[1]}</td></tr>
        `).join('');
    }

    function renderSequence(data) {
        const formattedSequence = data.sequence.replace(/(.{10})/g, "$1 ").replace(/(.{66})/g, "$1\n");
        sequencePre.textContent = formattedSequence;
    }
    
    // Event Handlers
    function handleTabClick(e) {
        const clickedTab = e.target.closest('.tab-btn');
        if (!clickedTab) return;
        document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
        clickedTab.classList.add('active');
        document.getElementById(clickedTab.dataset.tab).classList.add('active');
    }

    function handleFeatureSearch() {
        const query_searchword = featureSearch.value;
        const query_subclass = featureSearchSubclass.value;
        
        if (query_searchword.trim() === '' && query_subclass.trim() === '') {
            renderFeaturesTable(parsedTextData.features);
            return;
        }
        
        const searchArray = ParserFeatures(rawGbData, query_subclass, query_searchword);
        renderSearchResults(searchArray);
    }

    async function handleCopySequence(sequence) {
        if (!sequence) return;
        try {
            await navigator.clipboard.writeText(sequence);
            copySeqBtn.textContent = 'Copied!';
            setTimeout(() => { copySeqBtn.textContent = 'Copy'; }, 2000);
        } catch (err) {
            console.error('Failed to copy sequence: ', err);
        }
    }
    
    function downloadFile(id, format, content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${id}.${format}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    main();
});
