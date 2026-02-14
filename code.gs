/**
 * SignOS API v4.0
 * Supports: Key-Value Configs, Table Data, and Authentication
 */

function doGet(e) {
  const params = e.parameter;
  
  // 1. Auth Request (Gateway)
  // Usage: ?req=auth&pin=123456
  if (params.req === "auth") {
    return handleAuth(params.pin);
  }

  // 2. Table Request (New Feature for Menu/Cart)
  // Usage: ?req=table&tab=SYS_Modules
  if (params.req === "table") {
    return fetchTable(params.tab);
  }

  // 3. Default: Config Request (Calculators)
  // Usage: ?tab=PROD_Yard_Signs
  // Fallback to Yard Signs if no tab specified
  return fetchConfig(params.tab || "PROD_Yard_Signs");
}

/**
 * FEATURE 1: Fetch Table Data (New)
 * Reads a sheet as a database table. Row 1 = Headers.
 * Returns: Array of Objects [{header: value}, ...]
 */
function fetchTable(tabName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return returnJSON({ error: `Tab '${tabName}' not found` });

    // Get all data
    const range = sheet.getDataRange();
    const values = range.getValues();

    if (values.length < 2) return returnJSON([]); // Empty or header only

    // *** FIX IS HERE: Select ONLY the first row (Index 0) as headers ***
    const headers = values; 
    const rows = values.slice(1); // Rest are data

    // Map rows to objects based on headers
    const result = rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        // Only include if header is not empty string
        if(header && String(header).trim() !== "") {
          obj[header] = row[index];
        }
      });
      return obj;
    });

    return returnJSON(result);

  } catch (err) {
    return returnJSON({ error: "Table Error: " + err.toString() });
  }
}

/**
 * FEATURE 2: Fetch Config (Standard)
 * Reads Columns A & B as Key-Value pairs.
 * Returns: Single Object { Key: Value }
 */
function fetchConfig(tabName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(tabName);
    
    if (!sheet) {
      return returnJSON({ error: "Tab '" + tabName + "' not found." });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return returnJSON({});

    // Fetch only columns A (Key) and B (Value) starting at Row 2
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const config = {};

    data.forEach(row => {
      const key = row [0];   // Column A
      const value = row[1]; // Column B
      
      // Safety check for empty keys
      if (key && key !== "") {
        config[key] = value;
      }
    });

    return returnJSON(config);

  } catch (err) {
    return returnJSON({ error: "System Error: " + err.toString() });
  }
}

/**
 * FEATURE 3: Authentication
 * Checks Master_Staff for PIN match.
 */
function handleAuth(pinInput) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Master_Staff");
    
    if (!sheet) return returnJSON({ status: "error", message: "Master_Staff missing" });

    // Fetch Columns A through G (7 cols)
    const lastRow = sheet.getLastRow();
    // Safety check if sheet is empty
    if (lastRow < 2) return returnJSON({ status: "fail", message: "No staff data" });

    const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    
    const cleanPin = String(pinInput).trim();
    let match = null;

    for (let i = 0; i < data.length; i++) {
      // CORRECTED INDICES based on Source 5:
      // Col A : Staff_ID
      // Col B [1]: First_Name
      // Col C [2]: Last_Name
      // Col D [3]: Title
      // Col E [4]: Dept_ID
      // Col F [5]: Access_Role
      // Col G [6]: Access_PIN

      const rowPin = String(data[i][6]).trim(); // Changed from [2] to [6]
      
      if (rowPin === cleanPin) {
        match = {
          status: "success",
          name: data[i][1], // First Name (Col B)
          role: data[i][5]  // Access Role (Col F) - Changed from [3]
        };
        break;
      }
    }

    if (match) {
      return returnJSON(match);
    } else {
      return returnJSON({ status: "fail", message: "Invalid PIN" });
    }

  } catch (e) {
    return returnJSON({ status: "error", message: e.toString() });
  }
}

/**
 * UTILITY: JSON Formatter
 * Adds standard headers for CORS and content type.
 */
function returnJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
