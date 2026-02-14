// ==========================================
// SignOS API v5.0 (Dual Master Architecture)
// ==========================================

// MASTER 1: The Data Backend (READ ONLY)
// Connects to 'SignOS_Backend' for Pricing, Staff, and Configs
const DATA_SS_ID = "1wiaj5rU5J2kv1SobfyysMFynDOsli4Nb6pDvIf3L9_Y";

// MASTER 2: The Log Backend (WRITE ONLY)
// Connects to 'SignOS_Logs' for writing access logs
const LOG_SS_ID = "1LqSV-byNLOdu_GVyasvFmwyaW8TkyvW4F78u6_gaqzk";

function doGet(e) {
  const params = e.parameter;

  // ----------------------------------------
  // LOGGING INTERCEPTOR (Write to Log Master)
  // ----------------------------------------
  // We log asynchronously so we don't slow down the fetch significantly.
  // We check if 'ip' exists to verify it's a valid request worth logging.
  if (params.ip) {
    logActivity(params);
  }

  // ----------------------------------------
  // ROUTING (Read from Data Master)
  // ----------------------------------------

  // 1. Auth Request (Gateway)
  // Usage: ?req=auth&pin=123456
  if (params.req === "auth") {
    return handleAuth(params.pin);
  }

  // 2. Table Request (Menu/Cart)
  // Usage: ?req=table&tab=SYS_Modules
  if (params.req === "table") {
    return fetchTable(params.tab);
  }

  // 3. Default: Config Request (Calculators)
  // Usage: ?tab=PROD_Yard_Signs
  return fetchConfig(params.tab || "PROD_Yard_Signs");
}

/**
 * WRITER: Log Activity to SignOS_Logs
 * Appends: [Timestamp, IP, ReqType, Tab/Target, RawParams]
 */
function logActivity(p) {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    // Ensure this tab exists in your SignOS_Logs sheet!
    const sheet = ss.getSheetByName("SYS_Access_Logs");
   
    if (sheet) {
      const ts = new Date();
      // Log structure: Time, IP, User (if avail), Role (if avail), Action, Target, Meta
      // We map the incoming params to these columns carefully
      const user = p.user || "GUEST";
      const role = p.role || "N/A";
      const action = p.req || "config_fetch"; // Default action
      const target = p.tab || "N/A";
     
      sheet.appendRow([
        ts,
        p.ip || "UNKNOWN",
        user,
        role,
        action,
        target,
        JSON.stringify(p) // Meta column stores everything else
      ]);
    }
  } catch (err) {
    // Fail silently. We do NOT want to break the user's login
    // just because the log sheet is busy or the ID is wrong.
    console.error("Logging Failed:", err);
  }
}

/**
 * READER: Fetch Table Data
 * targeted at DATA_SS_ID (SignOS_Backend)
 */
function fetchTable(tabName) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return returnJSON({ error: `Tab '${tabName}' not found` });

    const range = sheet.getDataRange();
    const values = range.getValues();

    if (values.length < 2) return returnJSON([]);

    const headers = values[0];
    const rows = values.slice(1);

    const result = rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
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
 * READER: Fetch Config
 * targeted at DATA_SS_ID (SignOS_Backend)
 */
function fetchConfig(tabName) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName(tabName);

    if (!sheet) {
      return returnJSON({ error: "Tab '" + tabName + "' not found." });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return returnJSON({});

    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const config = {};

    data.forEach(row => {
      const key = row[0];  
      const value = row[1];

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
 * READER: Authentication
 * targeted at DATA_SS_ID (SignOS_Backend)
 */
function handleAuth(pinInput) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("Master_Staff");

    if (!sheet) return returnJSON({ status: "error", message: "Master_Staff missing" });

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return returnJSON({ status: "fail", message: "No staff data" });

    // Fetch 8 columns (A through H)
    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

    const cleanPin = String(pinInput).trim();
    let match = null;
    let accountDisabled = false;

    for (let i = 0; i < data.length; i++) {
      // Access_PIN is Column G (Index 6)
      const rowPin = String(data[i][6]).trim();

      if (rowPin === cleanPin) {
        // Is_Active is Column H (Index 7)
        const activeStatus = data[i][7];

        if (activeStatus === true || String(activeStatus).toUpperCase() === "TRUE") {
          match = {
            status: "success",
            name: data[i][1], // First_Name (Index 1)
            role: data[i][5]  // Access_Role (Index 5)
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
 */
function returnJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


