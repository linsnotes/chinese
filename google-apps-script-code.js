// Replace with your Google Sheet IDs
const dataSheetId = ""; // Input your Data sheetID
const logSheetId = ""; // Input your Log sheetID


// main function to return json data -------------------------------------
function doGet(e) {
  // Rate Limit Configuration
  const MAX_REQUESTS = 10; // Determines how many requests a client can make before being blocked.
  const TIME_WINDOW = 60000; // Time window in milliseconds (1 minute). Specifies how long the cache key (and the request count) is retained.
  const cache = CacheService.getScriptCache();

  // Extract client IP
  const clientIP = e.parameter.clientIP || "unknown";
  const cacheKey = `rate-limit-${clientIP}`;
  const requestCount = parseInt(cache.get(cacheKey)) || 0;

  if (requestCount >= MAX_REQUESTS) {
    // Log rate limit exceeded <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    const log = {
      date: formatDate(new Date()),
      logMessage: "Rate limit exceeded",
      filters: formatFilters(e.parameter)
    };
    appendLog(log, logSheetId); //<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<


    return ContentService.createTextOutput(
      JSON.stringify({
        error: "Rate limit exceeded. Please try again later.",
        status: 429
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  cache.put(cacheKey, (requestCount + 1).toString(), TIME_WINDOW / 1000);

  // Access the data sheet
  const spreadsheet = SpreadsheetApp.openById(dataSheetId);
  const sheet = spreadsheet.getSheetByName("data");

  if (!sheet) {
    // Log missing sheet error <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    const log = {
      date: formatDate(new Date()),
      logMessage: "Sheet 'data' not found",
      filters: formatFilters(e.parameter)
    };
    appendLog(log, logSheetId); //<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  
    return ContentService.createTextOutput(
      JSON.stringify({ error: "Sheet 'data' not found" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // Retrieve all data from the data sheet
  const values = sheet.getDataRange().getValues();

  // Extract client query parameters
  const text = e.parameter.text || null; 
  const category = e.parameter.category || null;
  const banding = e.parameter.banding || null;
  const level = e.parameter.level || null;
  const unit = e.parameter.unit || null;
  const passage = e.parameter.passage || null;

  // Check if the "text" parameter is provided
  if (text) { //--------------------if Input Text is not empty ------------run this logi -------------else skip-----
  // Column F is the 6th column (index 5, as indexes start at 0)
  const columnIndex = 5;

  // Filter rows for partial matches in column F
  const matchingRows = values.filter((row, index) => {
    if (index === 0) return false; // Skip the header row
    return row[columnIndex].includes(text); // Check if column F contains the text (partial match)
  });

  // If matching rows are found, build the groupedData structure --------------------------Found match------------
  if (matchingRows.length > 0) {
    const groupedData = {};

    // Iterate through all matching rows
    matchingRows.forEach(row => {
      const [cat, band, lvl, un, pas, wordList] = row; // Destructure the row values

      // Build the hierarchical structure
      if (!groupedData[cat]) {
        groupedData[cat] = {};
      }

      if (!groupedData[cat][band]) {
        groupedData[cat][band] = {};
      }

      if (!groupedData[cat][band][lvl]) {
        groupedData[cat][band][lvl] = {};
      }

      if (!groupedData[cat][band][lvl][un]) {
        groupedData[cat][band][lvl][un] = {};
      }

      if (!groupedData[cat][band][lvl][un][pas]) {
        groupedData[cat][band][lvl][un][pas] = wordList
          .split(", ") // Split the word list into an array
          .map(word => word.trim()); // Remove extra spaces from each word
      }
    });

    // Log success for matching rows <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    const log = {
        date: formatDate(new Date()),
        logMessage: `Request successful: ${matchingRows.length} matches found for text "${text}"`,
        filters: formatFilters(e.parameter)
    };
    appendLog(log, logSheetId); //<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    // Return the groupedData for the matching rows
    return ContentService.createTextOutput(
      JSON.stringify({
        groupedData,
        found: true,
        count: matchingRows.length,
        text
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } else { //----------------------no match-------------------------------------------------------------

    // Log no matches found <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    const log = {
      date: formatDate(new Date()),
      logMessage: `No matches found for text "${text}"`,
      filters: formatFilters(e.parameter)
    };
    appendLog(log, logSheetId); //<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    // If no rows match, return an empty groupedData object with a message
    return ContentService.createTextOutput(
      JSON.stringify({
        groupedData: {}, // No matches
        found: false,
        count: 0,
        text // The searched text
      })
    ).setMimeType(ContentService.MimeType.JSON);
    }
  } // logic of "text" parameter is provided ended here


  // Filter data based on parameters ----------------another logic for Filter data --------------------
  const filteredData = values.filter((row, index) => {
    if (index === 0) return false; // Skip header row
    return (
      (!category || row[0] === category) &&
      (!banding || row[1] === banding) &&
      (!level || row[2].toString() === level) &&
      (!unit || row[3] === unit) &&
      (!passage || row[4] === passage)
    );
  });
  
  // Group data hierarchically in json format
  const groupedData = {};

  filteredData.forEach(row => {
    const [cat, band, lvl, un, pas, wordList] = row;

    // Initialize category if not exists
    if (!groupedData[cat]) {
      groupedData[cat] = {};
    }

    // Initialize banding if not exists
    if (!groupedData[cat][band]) {
      groupedData[cat][band] = {};
    }

    // Initialize level if not exists
    if (!groupedData[cat][band][lvl]) {
      groupedData[cat][band][lvl] = {};
    }

    // Initialize unit if not exists
    if (!groupedData[cat][band][lvl][un]) {
      groupedData[cat][band][lvl][un] = {};
    }

    // Add passage and word list
    if (!groupedData[cat][band][lvl][un][pas]) {
      groupedData[cat][band][lvl][un][pas] = wordList
        .split(", ")
        .map(word => word.trim());
    }
  }); // Group data hierarchically in json format done ----------------------------------------------------



  // If no data matches, provide a clear response
  if (filteredData.length === 0) { // --------only run when no match data ------------which is unlikely-----

    // Log no data matches the filters <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    const log = {
      date: formatDate(new Date()),
      logMessage: "No data matches the provided filters",
      filters: formatFilters(e.parameter)
    };
    appendLog(log, logSheetId); //<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    return ContentService.createTextOutput(
      JSON.stringify({
        groupedData: {},
        filters: {
          category,
          banding,
          level,
          unit,
          passage
        },
        count: 0,
        message: "No data matches the provided filters."
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } // -----------------only run when no match data ------------which is unlikely--------


  // Log success for filtered data <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  const log = {
    date: formatDate(new Date()),
    logMessage: `Request successful: ${filteredData.length} entries found for the provided filters`,
    filters: formatFilters(e.parameter)
  };
  appendLog(log, logSheetId); // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<


  // Return the grouped data as JSON ----------------matched data --------------------------
  return ContentService.createTextOutput(
    JSON.stringify({
      groupedData,
      filters: {
        category,
        banding,
        level,
        unit,
        passage
      },
      count: filteredData.length
    })
  ).setMimeType(ContentService.MimeType.JSON);
  // -----------------------------------------------matched data ---------------------------
}
// End of main function to return json data -------------------------------------



// logging function ------------------------------------------------------------------------
function appendLog(log, logSheetId) {
  const logSpreadsheet = SpreadsheetApp.openById(logSheetId);
  const logSheet = logSpreadsheet.getSheets()[0];

  // Add headers if the sheet is empty
  if (logSheet.getLastRow() === 0) {
    logSheet.appendRow(["Date", "Log Message", "Filters"]);
  }

  // Append log entry
  logSheet.appendRow([log.date, log.logMessage, log.filters]);
}
// End of logging function ------------------------------------------------------------------



// format Date function ---------------------------------------------------------------------
function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const MMM = date.toLocaleString("en-US", { month: "short" }); // Get abbreviated month name
  const yyyy = date.getFullYear();
  const HH = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${dd} ${MMM} ${yyyy} ${HH}:${mm}:${ss}`;
}
// End of format Date function ---------------------------------------------------------------



// format Filter function --------------------------------------------------------------------
function formatFilters(params) {
  const filters = {
    category: params.category || "",
    banding: params.banding || "",
    level: params.level || "",
    unit: params.unit || "",
    passage: params.passage || ""
  };
  return JSON.stringify(filters);
}
// End of format Filter function --------------------------------------------------------------


