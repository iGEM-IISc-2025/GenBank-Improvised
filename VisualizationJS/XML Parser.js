/**
 * Parses a GenBank XML document to extract plasmid data.
 * @param {XMLDocument} xmlDoc - The parsed XML document.
 * @returns {object|null} An object with plasmid data or null if parsing fails.
 */
export function parseGenBankXML(xmlDoc) {
    const gbseq = xmlDoc.getElementsByTagName('GBSeq')[0];
    if (!gbseq) {
        alert("Could not find GBSeq tag. Is this a valid GenBank XML file?");
        return null;
    }

    const length = parseInt(gbseq.getElementsByTagName('GBSeq_length')[0].textContent, 10);
    const name = gbseq.getElementsByTagName('GBSeq_locus')[0].textContent;
    const sequence = gbseq.getElementsByTagName('GBSeq_sequence')[0].textContent.toUpperCase();
    const features = [];
    const featureTable = gbseq.getElementsByTagName('GBFeature');


    for (const feature of featureTable) {
        const key = feature.getElementsByTagName('GBFeature_key')[0].textContent;
        // We only care about features that mark a region, like CDS, gene, etc.
        if (key === 'source') continue;

        const location = feature.getElementsByTagName('GBFeature_location')[0].textContent;
        let direction = 1;
        let cleanLocation = location;

        if (location.startsWith('complement')) {
            direction = -1;
            cleanLocation = location.replace('complement(', '').replace(')', '');
        }

        const parts = cleanLocation.split('..');
        if (parts.length !== 2) continue; // Skip complex locations like 'join' for now

        const start = parseInt(parts[0].replace(/[^0-9]/g, ''), 10);
        const end = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);

        if (isNaN(start) || isNaN(end)) continue;

        let label = "unknown";
        const quals = feature.getElementsByTagName('GBQualifier');
        for(const qual of quals) {
            const name = qual.getElementsByTagName('GBQualifier_name')[0].textContent;
            if (['gene', 'product', 'note'].includes(name)) {
                label = qual.getElementsByTagName('GBQualifier_value')[0].textContent;
                break;
            }
        }

        const colDict = {
            'cds': "#1f77b4", // Blue
            'promoter': "#ff7f0e", // Orange
            'terminator': "#7f7f7f", //Grey
            'origin of replication': "#2ca02c", // Green
            'ori': "#2ca02c", // Green
            'antibiotic resistance': "#d62728", //Red
            'resistance': "#d62728", //Red
            'gene': "#9467bd" // Purple
        }
        let color = "White"
        let standard = true
        if (label.toLowerCase().includes('cds')){
            color = colDict['cds'];
        } else if (label.toLowerCase().includes('promoter')){
            color = colDict['promoter'];
        } else if (label.toLowerCase().includes('terminator')){
            color = colDict['terminator'];
        } else if (label.toLowerCase().includes('origin of replication') || label.toLowerCase().includes('ori')){
            color = colDict['origin of replication'];
        }else if(label.toLowerCase().includes('antibiotic resistance') || label.toLowerCase().includes('resistance') || label.toLowerCase().includes('ampicillin') || label.toLowerCase().includes('kanamycin') || label.toLowerCase().includes('chloramphenicol') || label.toLowerCase().includes('tetracycline')){
            color = colDict['antibiotic resistance'];
        } else if (label.toLowerCase().includes('gene')){
            color = colDict['gene'];
        }
        else {
            standard = false
            color = "#8c564b"; // Brown for non-standard features
        }
        features.push({
            type: key,
            start,
            end,
            direction,
            label,
            color,
            standard        
        });    
    }
    
    return { name, length, sequence, features };
}
