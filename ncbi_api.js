const baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";

// getInfo and parseEsearchXml functions remain the same.
async function getInfo(reqString) {
  const urlEsearch = `${baseUrl}esearch.fcgi?db=nuccore&term=${reqString}`;
  try {
    const response = await fetch(urlEsearch);
    if (response.ok) {
      return await response.text();
    } else {
      throw new Error(`Esearch error, error code: ${response.status}`);
    }
  } catch (error) {
    throw new Error("Error fetching data from ESearch API: " + error.message);
  }
}

async function parseEsearchXml(xmlData) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, "application/xml");
    const idElements = xmlDoc.getElementsByTagName("Id");
    const ids = Array.from(idElements).map((el) => el.textContent);
    return ids;
  } catch (error) {
    throw new Error("Error parsing XML data: " + error.message);
  }
}

// MODIFIED: This function now accepts an array of IDs and returns an array of summary objects.
async function esummary(idArray) {
  // Join the array of IDs into a single comma-separated string for the API call
  const idString = idArray.join(",");
  const urlEsummary = `${baseUrl}esummary.fcgi?db=nuccore&id=${idString}&version=2.0`;

  try {
    const response = await fetch(urlEsummary);
    if (!response.ok) {
      throw new Error(`ESummary error, error code: ${response.status}`);
    }

    const xmlData = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, "application/xml");
    const docSummaries = xmlDoc.getElementsByTagName("DocumentSummary");

    // This array will hold all the summary objects
    const summaries = [];

    // Loop through each <DocumentSummary> tag in the response
    Array.from(docSummaries).forEach((docSummary) => {
      const summary = {
        // We add the Uid (the ID) to each summary object for later reference
        Uid: docSummary.getAttribute("uid"),
      };

      const tags = [
        "Title",
        "CreateDate",
        "UpdateDate",
        "Biomol",
        "MolType",
        "Length",
        "TaxId",
        "Organism",
        "Topology",
        "Genome",
        "SubType",
        "SubName",
      ];

      tags.forEach((tag) => {
        const element = docSummary.getElementsByTagName(tag)[0];
        if (element) {
          summary[tag] = element.textContent;
        }
      });
      summaries.push(summary);
    });

    return summaries;
  } catch (error) {
    throw new Error("Error fetching data from ESummary API: " + error.message);
  }
}

// efetch function remains the same, as it fetches details for one ID at a time.
async function efetch(id, efetchType) {
  let urlEfetch;

  if (efetchType === "fasta") {
    urlEfetch = `${baseUrl}efetch.fcgi?db=nuccore&id=${id}&rettype=fasta`;
  } else if (efetchType === "gb") {
    urlEfetch = `${baseUrl}efetch.fcgi?db=nuccore&id=${id}&rettype=gb`;
  } else if (efetchType === "gbseq") {
    urlEfetch = `${baseUrl}efetch.fcgi?db=nuccore&id=${id}&rettype=gb&retmode=xml`;
  } else {
    throw new Error("Invalid efetch type");
  }

  try {
    const response = await fetch(urlEfetch);
    if (response.ok) {
      return await response.text();
    } else {
      throw new Error(`Efetch error, error code: ${response.status}`);
    }
  } catch (error) {
    throw new Error("Error fetching data from EFetch API: " + error.message);
  }
}

// Expose functions globally for use in the browser
window.getInfo = getInfo;
window.parseEsearchXml = parseEsearchXml;
window.esummary = esummary;
window.efetch = efetch;
