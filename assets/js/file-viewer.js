document.addEventListener('DOMContentLoaded', () => {
    // Get references to the HTML elements
    const fileTitle = document.getElementById('file-title');
    const downloadBtn = document.getElementById('download-btn');
    const fileContent = document.getElementById('file-content');
    
    let fetchedData = ''; // Variable to store the raw file data for download

    // --- 1. Read parameters from the URL ---
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');
    const format = params.get('format');
    
    // --- 2. Fetch data from the API as soon as the page loads ---
    async function fetchAndDisplayFile() {
        if (!uid || !format) {
            fileTitle.textContent = 'Error';
            fileContent.textContent = 'Could not find UID or format in the URL. Please go back and try again.';
            return;
        }

        // Update title and page title
        const titleText = `Record: ${uid} | Format: ${format.toUpperCase()}`;
        fileTitle.textContent = titleText;
        document.title = titleText;

        try {
            // The 'efetch' function is available from your ncbi_api.js file
            const recordData = await efetch(uid, format);
            fetchedData = recordData; // Store data for the download button

            // Display the data in the <pre> tag
            fileContent.textContent = recordData;

            // Enable the download button
            downloadBtn.disabled = false;

        } catch (error) {
            console.error('Failed to fetch file content:', error);
            fileContent.textContent = `Error fetching data for UID ${uid}.\n\n${error.message}`;
        }
    }

    // --- 3. Set up the download button functionality ---
    downloadBtn.addEventListener('click', () => {
        if (!fetchedData) return;

        // Create a Blob (a file-like object) from the raw text data
        const blob = new Blob([fetchedData], { type: 'text/plain' });

        // Create a temporary URL for the Blob
        const url = URL.createObjectURL(blob);

        // Create a temporary link element to trigger the download
        const a = document.createElement('a');
        a.href = url;
        a.download = `${uid}.${format}.txt`; // e.g., AY266453.1.fasta.txt
        document.body.appendChild(a);
        a.click();

        // Clean up by removing the temporary link and URL
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Run the fetch function when the page loads
    fetchAndDisplayFile();
});