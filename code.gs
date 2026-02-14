// ==========================================
// SignOS API v5.2.2 (Dual Master + Archiver)
// ==========================================

// MASTER 1: The Data Backend (READ ONLY)
const DATA_SS_ID = "1wiaj5rU5J2kv1SobfyysMFynDOsli4Nb6pDvIf3L9_Y";

// MASTER 2: The Log Backend (WRITE ONLY)
const LOG_SS_ID = "1LqSV-byNLOdu_GVyasvFmwyaW8TkyvW4F78u6_gaqzk";

// ARCHIVE: SignOS_Archives Folder
const ARCHIVE_FOLDER_ID = "18MBPWajHdF4TNQ0g8Iz1n1-GT3nBrMj4";

function doGet(e) {
  const params = e.parameter;

  // 1. LOGGING INTERCEPTOR (Async)
  if (params.ip) {
    logActivity(params);
  }

  // 2. ROUTING
  if (params.req === "auth") return handleAuth(params.pin);
  if (params.req === "table") return fetchTable(params.tab);

  // NEW: Manual Archive Trigger (Non-Destructive)
  // Usage: ?req=manual_archive&pin=YOUR_ADMIN_PIN
  if (params.req === "manual_archive") return manualExport(params.pin);

  // Default: Config Request
  return fetchConfig(params.tab || "PROD_Yard_Signs");
}

/**
 * WRITER: Log Activity to SignOS_Logs
 */
function logActivity(p) {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const sheet = ss.getSheetByName("SYS_Access_Logs");
    if (sheet) {
      const ts = new Date();
      sheet.appendRow([
        ts,
        p.ip || "UNKNOWN",
        p.user || "GUEST",
        p.role || "N/A",
        p.req || "config_fetch",
        p.tab || "N/A",
        JSON.stringify(p)
      ]);
    }
  } catch (err) {
    console.error("Logging Failed:", err);
  }
}

/**
 * ARCHIVER (AUTOMATED): Unload Logs to Drive
 * - Runs via Nightly Trigger
 * - DELETES archived rows from the sheet to keep it fast
 */
function archiveDailyLogs() {
  processArchive(true); // true = delete rows after saving
}

/**
 * ARCHIVER (MANUAL): Export without deleting
 * - Triggered via URL for testing
 */
function manualExport(pin) {
  // 1. Security Check (Admin Only)
  const auth = handleAuth(pin);
  const authObj = JSON.parse(auth.getContent());

  if (authObj.status !== "success" || authObj.role !== "ADMIN") {
    return returnJSON({ status: "error", message: "Unauthorized: Admins Only" });
  }

  // 2. Run Archive (False = Do not delete rows)
  const result = processArchive(false);
  return returnJSON(result);
}

/**
 * CORE ARCHIVE LOGIC
 * Handles formatting and saving to Drive
 */
function processArchive(isDestructive) {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const logSheet = ss.getSheetByName("SYS_Access_Logs");

    // Check for Index Sheet
    let indexSheet = ss.getSheetByName("SYS_Archive_Index");
    if (!indexSheet) {
      indexSheet = ss.insertSheet("SYS_Archive_Index");
      indexSheet.appendRow(["Archive_Date", "File_Name", "Drive_Link", "Row_Count", "Type"]);
      indexSheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    }

    const lastRow = logSheet.getLastRow();

    // Safety: If no data (just header or empty), exit gracefully
    if (lastRow < 2) {
      return { status: "skipped", message: "Log sheet is empty." };
    }

    // Get Data
    const dataRange = logSheet.getRange(2, 1, lastRow - 1, logSheet.getLastColumn());
    const data = dataRange.getValues();

    // Format Text File (Pipe Delimited for readability)
    let fileContent = "Timestamp | IP_Address | User | Role | Action | Target | Meta_Data\n";
    fileContent += "================================================================================\n";

    data.forEach(row => {
      // Format the date to be readable
      const dateCell = new Date(row[0]);
      const dateStr = Utilities.formatDate(dateCell, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

      // Construct Row
      const cleanRow = [
        dateStr,
        row[1], // IP
        row[2], // User
        row[3], // Role
        row[4], // Action
        row[5], // Target
        row[6]  // Meta (JSON)
      ].join(" | ");

      fileContent += cleanRow + "\n";
    });

    // Create Filename
    const today = new Date();
    const dateStamp = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd_HHmm");
    const prefix = isDestructive ? "AUTO_ARCHIVE" : "MANUAL_EXPORT";
    const fileName = `SignOS_Log_${prefix}_${dateStamp}.txt`;

    // Save to Drive
    const folder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID);
    const file = folder.createFile(fileName, fileContent);

    // Log to Index
    indexSheet.appendRow([
      new Date(),
      fileName,
      file.getUrl(),
      data.length,
      prefix
    ]);

    // Clean Up (Only if Automated)
    if (isDestructive) {
      logSheet.deleteRows(2, lastRow - 1);
      return { status: "success", type: "AUTO", rows_archived: data.length, url: file.getUrl() };
    } else {
      return { status: "success", type: "MANUAL", rows_copied: data.length, url: file.getUrl() };
    }

  } catch (e) {
    console.error("Archive Failed:", e.toString());
    return { status: "error", message: e.toString() };
  }
}

/**
 * READER: Fetch Table Data
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
        if(header && String(header).trim() !== "") obj[header] = row[index];
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
 */
function fetchConfig(tabName) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return returnJSON({ error: "Tab '" + tabName + "' not found." });

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return returnJSON({});

    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const config = {};
    data.forEach(row => {
      const key = row[0];
      const val = row[1];
      if (key && key !== "") config[key] = val;
    });
    return returnJSON(config);
  } catch (err) {
    return returnJSON({ error: "System Error: " + err.toString() });
  }
}

/**
 * READER: Authentication (CORRECTED MATCHING)
 * - Fixed: Now correctly reads Row 1 for headers
 * - Fixed: Maps to "Access_PIN", "First_Name", "Access_Role", "Is_Active"
 */
function handleAuth(pinInput) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("Master_Staff");
    if (!sheet) return returnJSON({ status: "error", message: "Master_Staff missing" });
    
    // 1. Get All Data
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return returnJSON({ status: "fail", message: "No staff data" });

    // FIX: Look at data[0] (Row 1) for headers, not the whole array
    const headers = data[0].map(h => String(h).trim().toLowerCase()); 
    const rows = data.slice(1);

    // 2. Map Columns (Matches your Master_Staff headers exactly)
    const colIdx = {
      // Look for "pin" OR "access_pin"
      pin: headers.findIndex(h => h === "pin" || h === "access_pin"),
      // Look for "name" OR "first_name"
      name: headers.findIndex(h => h === "name" || h === "first_name" || h === "staff_name"),
      // Look for "role" OR "access_role"
      role: headers.findIndex(h => h === "role" || h === "access_role"),
      // Look for "active" OR "is_active"
      active: headers.findIndex(h => h === "active" || h === "is_active" || h === "status")
    };

    // Safety Check: If we can't find the PIN or Name column, stop.
    if (colIdx.pin === -1 || colIdx.name === -1) {
      return returnJSON({ 
        status: "error", 
        message: "CRITICAL: Columns 'Access_PIN' or 'First_Name' not found in Row 1 of Master_Staff." 
      });
    }

    const cleanPin = String(pinInput).trim();
    let match = null;
    let accountDisabled = false;

    // 3. Search Logic
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Get the PIN from the found column index
      const rowPin = String(row[colIdx.pin]).trim();

      if (rowPin === cleanPin) {
        // Check Active Status (Defaults to TRUE if column is missing)
        let isActive = true;
        if (colIdx.active !== -1) {
          const val = row[colIdx.active];
          // Handle checkbox (TRUE) or string "TRUE"
          isActive = (val === true || String(val).toUpperCase() === "TRUE");
        }

        if (isActive) {
          match = { 
            status: "success", 
            name: row[colIdx.name], 
            role: (colIdx.role !== -1) ? row[colIdx.role] : "VIEW" 
          };
        } else {
          accountDisabled = true;
        }
        break;
      }
    }

    if (match) return returnJSON(match);
    else if (accountDisabled) return returnJSON({ status: "fail", message: "Account Disabled" });
    else return returnJSON({ status: "fail", message: "Invalid PIN" });

  } catch (e) {
    return returnJSON({ status: "error", message: e.toString() });
  }
}

function returnJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
