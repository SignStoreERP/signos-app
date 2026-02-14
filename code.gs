/**
 * SignOS API v4.1 (Fixed Auth)
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

    const headers = values[0];
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
 * FEATURE 3: Authentication (FIXED)
 * Checks Master_Staff for PIN match AND Active Status.
 */
function handleAuth(pinInput) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Master_Staff");
    
    if (!sheet) return returnJSON({ status: "error", message: "Master_Staff missing" });

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return returnJSON({ status: "fail", message: "No staff data" });

    // Fetch 8 columns (A through H)
    // A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7
    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    
    const cleanPin = String(pinInput).trim();
    let match = null;
    let accountDisabled = false;

    for (let i = 0; i < data.length; i++) {
      // FIX 1: Access_PIN is Column G (Index 6)
      const rowPin = String(data[i][6]).trim(); 
      
      if (rowPin === cleanPin) {
        // FIX 2: Is_Active is Column H (Index 7)
        const activeStatus = data[i][7];
        
        // Check for boolean TRUE or string "TRUE"
        if (activeStatus === true || String(activeStatus).toUpperCase() === "TRUE") {
          match = {
            status: "success",
            name: data[i][1], // FIX 3: First_Name is Col B (Index 1)
            role: data[i][5]  // FIX 4: Access_Role is Col F (Index 5)
          };
        } else {
          accountDisabled = true;
        }
        break; 
      }
    }

    if (match) {
      return returnJSON(match);
    } else if (accountDisabled) {
      return returnJSON({ status: "fail", message: "Account Disabled" });
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
