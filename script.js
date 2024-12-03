document.addEventListener("DOMContentLoaded", function () {
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
   * Recursively renders hierarchical data into a structured HTML list.
   * @param {Object} data - The hierarchical data to render.
   * @returns {HTMLElement} - The HTML element representing the rendered data.
   */
  function renderHierarchy(data) {
    const container = document.createElement("ul");
    container.classList.add("result-list");

    Object.entries(data).forEach(([key, value]) => {
      const listItem = document.createElement("li");
      listItem.classList.add("result-item");
      listItem.innerHTML = `<span class="result-key">${key}:</span>`;

      if (typeof value === "object" && !Array.isArray(value)) {
        const nestedList = renderHierarchy(value);
        listItem.appendChild(nestedList);
      } else if (Array.isArray(value)) {
        const arrayContent = document.createElement("span");
        arrayContent.classList.add("result-array");
        arrayContent.innerHTML = value
          .map(item => `<span class="array-item">${item}</span>`)
          .join('<span class="separator"> | </span>');
        listItem.appendChild(arrayContent);
      }

      container.appendChild(listItem);
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

        resultContainer.appendChild(renderHierarchy(data.groupedData));
      } else {
        resultContainer.innerText = "No words found.";
      }
    } catch (error) {
      resultContainer.innerText = `Error: ${error.message}`;
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
