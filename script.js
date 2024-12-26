document.addEventListener("DOMContentLoaded", function () {

  // Reference to the spinner container
  const spinnerContainer = document.getElementById("spinner-container");

  // Ensure the spinner is hidden on page load
  if (!spinnerContainer.classList.contains("hidden")) {
    spinnerContainer.classList.add("hidden");
  }

  // Function to show the spinner
  function showSpinner() {
    spinnerContainer.classList.remove("hidden");
  }

  // Function to hide the spinner
  function hideSpinner() {
    spinnerContainer.classList.add("hidden");
  }



  // ---- Utility Functions ----

  /**
   * Resets visibility of all dropdown containers on page load or when fetchType changes.
   */
  function resetVisibility() {
    const containers = document.querySelectorAll('.dropdown-container');
    containers.forEach(container => container.classList.add('hidden'));
  }

  /**
   * Clears the search text input when called.
   */
  function clearSearchText() {
    document.getElementById("searchText").value = "";
  }

    /**
     * Flattens a nested object into an array of paths and values.
     * @param {Object} obj - The nested object to flatten.
     * @param {string} parentPath - The current path being processed.
     * @returns {Array} - An array of flattened paths and values.
     */
    function flattenObject(obj, parentPath = "") {
      let result = [];
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = parentPath ? `${parentPath} > ${key}` : key;

        if (Array.isArray(value)) {
          result.push({ path: currentPath, values: value });
        } else if (typeof value === "object" && value !== null) {
          result = result.concat(flattenObject(value, currentPath));
        }
      }

      if (Object.keys(obj).length === 0) {
        result.push({ path: parentPath, values: ["No data available"] });
      }

      return result;
    }

    /**
     * Renders the flattened data into HTML elements.
     * @param {Array} flattenedData - An array of paths and values.
     * @returns {HTMLElement} - The container element with rendered data.
     */
    function renderFlattenedData(flattenedData) {
      const container = document.createElement("div");

      flattenedData.forEach(({ path, values }) => {
        const section = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = path;
        section.appendChild(summary);

        // Values as a list
        const list = document.createElement("ol");
        if (values.length === 0) {
          const listItem = document.createElement("li");
          listItem.textContent = "No items available";
          list.appendChild(listItem);
        } else {
          values.forEach(value => {
            const listItem = document.createElement("li");
            listItem.textContent = value;
            list.appendChild(listItem);
          });
        }

        section.appendChild(list);
        container.appendChild(section);
      });

      return container;
    }

  // ---- Configuration ----

  // Map fetchType values to their corresponding visible containers
  const fetchTypeConfig = {
    banding: ['bandingContainer'],
    level: ['bandingContainer', 'levelContainer'],
    unit: ['bandingContainer', 'levelContainer', 'unitContainer'],
    passage: ['bandingContainer', 'levelContainer', 'unitContainer', 'passageContainer'],
  };

  // ---- Event Listeners ----

  // Event listener: Handles fetchType changes to show appropriate dropdowns
  document.getElementById("fetchType").addEventListener("change", function () {
    const fetchType = this.value;

    resetVisibility();

    if (fetchTypeConfig[fetchType]) {
      fetchTypeConfig[fetchType].forEach(id => {
        document.getElementById(id).classList.remove('hidden');
      });
    }
  });

  // Event listeners: Clears search text when category or fetchType changes
  ['category', 'fetchType'].forEach(id => {
    document.getElementById(id).addEventListener("change", clearSearchText);
  });

  // Event listener: Resets dropdowns and clears fetchType and category when typing in searchText
  document.getElementById("searchText").addEventListener("input", function () {
    document.getElementById("category").value = "";
    document.getElementById("fetchType").value = "";
    resetVisibility();
  });

  // Event listener: Handles form submission
  document.getElementById("wordForm").addEventListener("submit", async function (e) {
    e.preventDefault(); // Prevent default form submission

    showSpinner(); // Show the spinner at the start of the submission



    // Elements and variables for handling results
    const searchText = document.getElementById("searchText").value.trim();
    const searchMessage = document.getElementById("searchMessage");
    const matchCount = document.getElementById("matchCount");
    const searchWord = document.getElementById("searchWord");
    const resultContainer = document.getElementById("result");
    const params = new URLSearchParams();

    let isTextSearch = false; // Flag to indicate text-based search

    // Reset result container and hide message
    resultContainer.innerHTML = "";
    searchMessage.classList.add("hidden");

    // Append appropriate search parameters to the URL based on the input type (text search or dropdown selection)
    if (searchText) {
      params.append("text", searchText);
      isTextSearch = true;
    } else {
      const fetchType = document.getElementById("fetchType").value;

      if (fetchType) {
        params.append("category", document.getElementById("category").value || "");
        params.append("banding", document.getElementById("banding").value || "");

        if (["level", "unit", "passage"].includes(fetchType)) {
          params.append("level", document.getElementById("level").value || "");
        }
        if (["unit", "passage"].includes(fetchType)) {
          params.append("unit", document.getElementById("unit").value || "");
        }
        if (fetchType === "passage") {
          params.append("passage", document.getElementById("passage").value || "");
        }
      }
    }

    // Append client IP to the request URL
    // this is needed to enforce rate limiting and 
    // prevent abuse, avoiding excessive requests that could overwhelm the Google Sheets backend.
    params.append("clientIP", clientIP);

    
    // Fetch data and handle results
    try {
      const response = await fetch(`https://script.google.com/macros/s/AKfycbwwRp7bTxcf-H4parNfokCbDqnHB6w4IFNw3OSuupBjJfxq6X32he_ayvT4hqXYke6G/exec?${params}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();

      if (data.groupedData) {
        if (isTextSearch) {
          matchCount.textContent = data.count || 0;
          searchWord.textContent = searchText || "";
          searchMessage.classList.remove("hidden");
        }

        const flattenedData = flattenObject(data.groupedData);
        const htmlContent = renderFlattenedData(flattenedData);
        resultContainer.appendChild(htmlContent);
      } else {
        resultContainer.innerText = "No words found.";
      }
    } catch (error) {
      resultContainer.innerText = `Error: ${error.message}`;
    } finally {
      hideSpinner(); // Hide spinner
    }
  });

  // ---- Client IP Fetch ----
  // this is needed to enforce rate limiting and 
  // prevent abuse, avoiding excessive requests that could overwhelm the Google Sheets backend.

  let clientIP = "unknown";

  (async function fetchClientIP() {
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      clientIP = data.ip;
    } catch {
      clientIP = "unknown";
    }
  })();
});
