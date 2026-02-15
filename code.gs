// ==========================================
// SignOS API v5.3 (Stable - Simplified Auth)
// ==========================================

// MASTER 1: The Data Backend (READ ONLY)
const DATA_SS_ID = "1wiaj5rU5J2kv1SobfyysMFynDOsli4Nb6pDvIf3L9_Y";

// MASTER 2: The Log Backend (WRITE ONLY)
const LOG_SS_ID = "1LqSV-byNLOdu_GVyasvFmwyaW8TkyvW4F78u6_gaqzk";

// ARCHIVE: SignOS_Archives Folder
const ARCHIVE_FOLDER_ID = "18MBPWajHdF4TNQ0g8Iz1n1-GT3nBrMj4";

function doGet(e) {
  const params = e.parameter;
  if (params.ip) logActivity(params);

  // ... existing routes ...
  if (params.req === "auth") return handleAuth(params.pin);
  if (params.req === "table") return fetchTable(params.tab); // This will read the Roadmap
  
  // NEW: Add Roadmap Item
  if (params.req === "add_roadmap") return addRoadmapItem(params);

  // ... existing routes ...
  if (params.req === "get_archive_index") return fetchArchiveIndex();
  if (params.req === "get_log_content") return fetchLogFile(params.file_id);
  
  return fetchConfig(params.tab || "PROD_Yard_Signs");
}

// --- NEW READER FUNCTIONS (For Admin Viewer) ---

/**
 * READER: Fetch list of archived files from SYS_Archive_Index
 */
function fetchArchiveIndex() {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const sheet = ss.getSheetByName("SYS_Archive_Index");
    if (!sheet) return returnJSON([]);
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return returnJSON([]); // Header only
    
    // Headers: Archive_Date, File_Name, Drive_Link, Row_Count, Type
    const rows = data.slice(1);
    
    // Map to JSON
    const result = rows.map(r => {
      const url = r[2]; // Column C is Drive_Link
      let fileId = null;
      
      // Extract ID from URL (Simple Regex)
      if (url) {
        const match = url.match(/\/d\/(.+?)\//);
        if (match) fileId = match[1];
        else if (url.includes("id=")) fileId = url.split("id=")[1];
      }

      return {
        date: r[0],
        name: r[1],
        url: url,
        count: r[3],
        type: r[4],
        file_id: fileId
      };
    }).reverse(); // Show newest files first

    return returnJSON(result);
  } catch (e) {
    return returnJSON({ error: e.toString() });
  }
}

/**
 * READER: Fetch text content of a specific log file
 */
function fetchLogFile(fileId) {
  try {
    if (!fileId) return returnJSON({ status: "error", message: "No file ID provided" });
    
    const file = DriveApp.getFileById(fileId);
    const text = file.getBlob().getDataAsString();
    
    return returnJSON({ status: "success", content: text });
  } catch (e) {
    return returnJSON({ status: "error", message: "Could not read file: " + e.toString() });
  }
}

// --- EXISTING CORE FUNCTIONS ---

function logActivity(p) {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const sheet = ss.getSheetByName("SYS_Access_Logs");
    if (sheet) {
      sheet.appendRow([new Date(), p.ip || "UNKNOWN", p.user || "GUEST", p.role || "N/A", p.req || "config_fetch", p.tab || "N/A", JSON.stringify(p)]);
    }
  } catch (err) { console.error("Logging Failed:", err); }
}

function archiveDailyLogs() { processArchive(true); }

function manualExport(pin) {
  const auth = handleAuth(pin);
  const authObj = JSON.parse(auth.getContent());
  if (authObj.status !== "success" || authObj.role !== "ADMIN") return returnJSON({ status: "error", message: "Unauthorized" });
  return returnJSON(processArchive(false));
}

function processArchive(isDestructive) {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const logSheet = ss.getSheetByName("SYS_Access_Logs");
    
    // Ensure Index Exists
    let indexSheet = ss.getSheetByName("SYS_Archive_Index");
    if (!indexSheet) {
      indexSheet = ss.insertSheet("SYS_Archive_Index");
      indexSheet.appendRow(["Archive_Date", "File_Name", "Drive_Link", "Row_Count", "Type"]);
    }

    const lastRow = logSheet.getLastRow();
    if (lastRow < 2) return { status: "skipped", message: "Log sheet is empty." };

    const data = logSheet.getRange(2, 1, lastRow - 1, logSheet.getLastColumn()).getValues();

    // Format File Content
    let fileContent = "Timestamp | IP_Address | User | Role | Action | Target | Meta_Data\n";
    fileContent += "================================================================================\n";

    data.forEach(row => {
      const dateStr = Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      const cleanRow = [dateStr, row[1], row[2], row[3], row[4], row[5], row[6]].join(" | ");
      fileContent += cleanRow + "\n";
    });

    // Save to Drive
    const dateStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HHmm");
    const prefix = isDestructive ? "AUTO_ARCHIVE" : "MANUAL_EXPORT";
    const fileName = `SignOS_Log_${prefix}_${dateStamp}.txt`;
    const folder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID);
    const file = folder.createFile(fileName, fileContent);

    // Log to Index
    indexSheet.appendRow([new Date(), fileName, file.getUrl(), data.length, prefix]);

    // Cleanup
    if (isDestructive) logSheet.deleteRows(2, lastRow - 1);

    return { status: "success", type: isDestructive ? "AUTO" : "MANUAL", rows_archived: data.length, url: file.getUrl() };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function fetchTable(tabName) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return returnJSON({ error: `Tab '${tabName}' not found` });

    const values = sheet.getDataRange().getValues();
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
  } catch (err) { return returnJSON({ error: "Table Error: " + err.toString() }); }
}

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
      const val = row[1]; // Column B
      if (key && key !== "") config[key] = val;
    });
    return returnJSON(config);
  } catch (err) { return returnJSON({ error: "System Error: " + err.toString() }); }
}

/**
 * READER: Authentication (SIMPLIFIED / FRAGILE VERSION)
 * - This logic scans broadly for columns containing "pin", "name", etc.
 * - It is less precise but more forgiving of data structure changes.
 */
function handleAuth(pin) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("Master_Staff");
    
    // Grab all data
    const data = sheet.getDataRange().getValues();
    
    // Scan the first row for headers that *contain* keywords
    // This is the "fragile" but easy part: if you have a column "Spindle Speed", it won't match "pin" hopefully.
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    
    const idx = {
      p: headers.findIndex(h => h.includes("pin")),
      n: headers.findIndex(h => h.includes("name") && !h.includes("last")), // Avoid "Last Name"
      r: headers.findIndex(h => h.includes("role")),
      a: headers.findIndex(h => h.includes("active") || h.includes("status"))
    };
    
    if (idx.p === -1 || idx.n === -1) return returnJSON({status:"error", message:"Columns Missing"});
    
    // Loop rows
    for(let i=1; i<data.length; i++) {
      if(String(data[i][idx.p]).trim() === String(pin).trim()) {
        
        // Check Active
        const isActive = idx.a === -1 || String(data[i][idx.a]).toUpperCase() === "TRUE";
        
        if(!isActive) return returnJSON({status:"fail", message:"Disabled"});
        
        return returnJSON({
            status:"success", 
            name:data[i][idx.n], 
            role:data[i][idx.r]||"VIEW"
        });
      }
    }
    return returnJSON({status:"fail", message:"Invalid PIN"});
  } catch (e) { return returnJSON({status:"error", message:e.toString()}); }
}

function returnJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


