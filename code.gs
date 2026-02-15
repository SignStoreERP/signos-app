// ==========================================
// SignOS API v5.6 (Roadmap & Ticketing)
// ==========================================

// MASTER 1: The Data Backend (READ/WRITE)
const DATA_SS_ID = "1wiaj5rU5J2kv1SobfyysMFynDOsli4Nb6pDvIf3L9_Y";

// MASTER 2: The Log Backend (WRITE ONLY)
const LOG_SS_ID = "1LqSV-byNLOdu_GVyasvFmwyaW8TkyvW4F78u6_gaqzk";

// ARCHIVE: SignOS_Archives Folder
const ARCHIVE_FOLDER_ID = "18MBPWajHdF4TNQ0g8Iz1n1-GT3nBrMj4";

function doGet(e) {
  const params = e.parameter;
 
  // 1. LOGGING (Async)
  if (params.ip) logActivity(params);

  // --- ROUTING ---
 
  // 2. Auth & Core Tables
  if (params.req === "auth") return handleAuth(params.pin);
  if (params.req === "table") return fetchTable(params.tab); // Reads Roadmap or Master Lists
 
  // 3. Roadmap / Ticketing (NEW)
  if (params.req === "add_roadmap") return addRoadmapItem(params); // Create New Ticket
  if (params.req === "get_ticket") return getTicketDetails(params.id); // Read Ticket Thread
  if (params.req === "add_action") return addTicketAction(params); // Add Comment/Update Status

  // 4. Archival & Logs (Admin)
  if (params.req === "manual_archive") return manualExport(params.pin);
  if (params.req === "get_archive_index") return fetchArchiveIndex();
  if (params.req === "get_log_content") return fetchLogFile(params.file_id);
 
  // Default: Config Fetch
  return fetchConfig(params.tab || "PROD_Yard_Signs");
}

// ==========================================
// ROADMAP TICKET LOGIC (NEW & FIXED)
// ==========================================

/**
 * WRITER: Create New Roadmap Item (v5.6 - Improved ID)
 */
function addRoadmapItem(p) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("SYS_Roadmap");
    if (!sheet) return returnJSON({ status: "error", message: "Tab 'SYS_Roadmap' not found" });

    const ts = new Date();
    const id = "RMP_" + Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyyMMdd_HHmm");

    sheet.appendRow([
      id,
      ts,
      p.user || "Guest",
      p.cat || "Feature",
      p.prio || "Med",
      p.title || "Untitled",
      p.desc || "",
      "Pending",
      p.target || "APP" // <--- NEW: Saves "APP" or "LIVE" to Column I
    ]);

    return returnJSON({ status: "success", id: id });

  } catch (e) { return returnJSON({ status: "error", message: e.toString() }); }
}

/**
 * READER: Fetches a single ticket AND its history log
 * (Restored missing function definition)
 */
function getTicketDetails(ticketId) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const parentSheet = ss.getSheetByName("SYS_Roadmap");
    const childSheet = ss.getSheetByName("SYS_Roadmap_Actions");
   
    if(!parentSheet || !childSheet) return returnJSON({ error: "Missing DB Tabs" });

    // 1. Get Parent Data
    const pData = parentSheet.getDataRange().getValues();
    const pHeaders = pData[0]; // Headers are row 0
    let parentObj = null;
   
    // Find the specific row by ID (Column A / Index 0)
    for(let i=1; i<pData.length; i++) {
      if(String(pData[i][0]) === String(ticketId)) {
        parentObj = {};
        pHeaders.forEach((h, idx) => parentObj[h] = pData[i][idx]);
        break;
      }
    }

    if(!parentObj) return returnJSON({ error: "Ticket not found" });

    // 2. Get Child Actions (Filter)
    const cData = childSheet.getDataRange().getValues();
    const cHeaders = cData[0]; // Headers are row 0
    const history = [];

    // Skip header, check Col B (Parent_ID is Index 1)
    for(let i=1; i<cData.length; i++) {
      if(String(cData[i][1]) === String(ticketId)) {
        let action = {};
        cHeaders.forEach((h, idx) => action[h] = cData[i][idx]);
        history.push(action);
      }
    }

    return returnJSON({ status: "success", ticket: parentObj, history: history });

  } catch(e) { return returnJSON({ error: e.toString() }); }
}

/**
 * WRITER: Add Ticket Action (v5.6 - Improved ID & Status Sync)
 */
function addTicketAction(p) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const actionSheet = ss.getSheetByName("SYS_Roadmap_Actions");
    const parentSheet = ss.getSheetByName("SYS_Roadmap");

    if(!actionSheet) return returnJSON({ status: "error", message: "Missing SYS_Roadmap_Actions" });

    const ts = new Date();
    // NEW ID FORMAT: ACT_YYYYMMDD_HHmmss (e.g., ACT_20260220_143005)
    const actionId = "ACT_" + Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");

    actionSheet.appendRow([
      actionId,
      p.id,
      ts,
      p.user || "System",
      p.type || "Comment",
      p.msg || ""
    ]);

    // Update Parent Status
    if(p.new_status && p.new_status !== "") {
      const pData = parentSheet.getDataRange().getValues();
      for(let i=1; i<pData.length; i++) {
        // Check Column A (Index 0)
        if(String(pData[i][0]) === String(p.id)) {
          // Column 8 is Status (Index 7)
          parentSheet.getRange(i+1, 8).setValue(p.new_status);
          break;
        }
      }
    }

    return returnJSON({ status: "success" });
  } catch(e) { return returnJSON({ status: "error", message: e.toString() }); }
}

// ==========================================
// CORE DATA FUNCTIONS (EXISTING)
// ==========================================

function fetchTable(tabName) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return returnJSON({ error: `Tab '${tabName}' not found` });
   
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return returnJSON([]);
   
    const headers = values[0]; // FIX: Explicitly grab first row
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
   
    // Config is always Col A (Key) and Col B (Value)
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const config = {};
    data.forEach(row => { const key = row[0]; const val = row[1]; if (key && key !== "") config[key] = val; });
   
    return returnJSON(config);
  } catch (err) { return returnJSON({ error: "System Error: " + err.toString() }); }
}

function handleAuth(pin) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("Master_Staff");
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
   
    // Locate columns dynamically
    const idx = {
      p: headers.findIndex(h => h.includes("pin")),
      n: headers.findIndex(h => h.includes("name") && !h.includes("last")),
      r: headers.findIndex(h => h.includes("role")),
      a: headers.findIndex(h => h.includes("active") || h.includes("status"))
    };

    if (idx.p === -1 || idx.n === -1) return returnJSON({status:"error", message:"Columns Missing"});
   
    for(let i=1; i<data.length; i++) {
      if(String(data[i][idx.p]).trim() === String(pin).trim()) {
        const isActive = idx.a === -1 || String(data[i][idx.a]).toUpperCase() === "TRUE";
        if(!isActive) return returnJSON({status:"fail", message:"Disabled"});
        return returnJSON({ status:"success", name:data[i][idx.n], role:data[i][idx.r]||"VIEW" });
      }
    }
    return returnJSON({status:"fail", message:"Invalid PIN"});
  } catch (e) { return returnJSON({status:"error", message:e.toString()}); }
}

// ==========================================
// ARCHIVE & LOGGING (ADMIN)
// ==========================================

function fetchArchiveIndex() {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const sheet = ss.getSheetByName("SYS_Archive_Index");
    if (!sheet) return returnJSON([]);
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return returnJSON([]);
   
    const rows = data.slice(1);
    const result = rows.map(r => {
      const url = r[2];
      let fileId = null;
      if (url) { const match = url.match(/\/d\/(.+?)\//); if (match) fileId = match[1]; else if (url.includes("id=")) fileId = url.split("id=")[1]; }
      return { date: r[0], name: r[1], url: url, count: r[3], type: r[4], file_id: fileId };
    }).reverse();
   
    return returnJSON(result);
  } catch (e) { return returnJSON({ error: e.toString() }); }
}

function fetchLogFile(fileId) {
  try {
    if (!fileId) return returnJSON({ status: "error", message: "No file ID provided" });
    const file = DriveApp.getFileById(fileId);
    const text = file.getBlob().getDataAsString();
    return returnJSON({ status: "success", content: text });
  } catch (e) { return returnJSON({ status: "error", message: e.toString() }); }
}

function logActivity(p) {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const sheet = ss.getSheetByName("SYS_Access_Logs");
    if (sheet) sheet.appendRow([new Date(), p.ip || "UNKNOWN", p.user || "GUEST", p.role || "N/A", p.req || "config_fetch", p.tab || "N/A", JSON.stringify(p)]);
  } catch (err) { console.error("Logging Failed:", err); }
}

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
    let indexSheet = ss.getSheetByName("SYS_Archive_Index");
   
    if (!indexSheet) {
      indexSheet = ss.insertSheet("SYS_Archive_Index");
      indexSheet.appendRow(["Archive_Date", "File_Name", "Drive_Link", "Row_Count", "Type"]);
    }
   
    const lastRow = logSheet.getLastRow();
    if (lastRow < 2) return { status: "skipped", message: "Log sheet is empty." };
   
    const data = logSheet.getRange(2, 1, lastRow - 1, logSheet.getLastColumn()).getValues();
    let fileContent = "Timestamp | IP_Address | User | Role | Action | Target | Meta_Data\n================================================================================\n";
   
    data.forEach(row => {
      const dateStr = Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      const cleanRow = [dateStr, row[1], row[2], row[3], row[4], row[5], row[6]].join(" | ");
      fileContent += cleanRow + "\n";
    });
   
    const dateStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HHmm");
    const prefix = isDestructive ? "AUTO_ARCHIVE" : "MANUAL_EXPORT";
    const fileName = `SignOS_Log_${prefix}_${dateStamp}.txt`;
   
    const folder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID);
    const file = folder.createFile(fileName, fileContent);
   
    indexSheet.appendRow([new Date(), fileName, file.getUrl(), data.length, prefix]);
   
    if (isDestructive) logSheet.deleteRows(2, lastRow - 1);
   
    return { status: "success", type: isDestructive ? "AUTO" : "MANUAL", rows_archived: data.length, url: file.getUrl() };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

// ==========================================
// HELPERS
// ==========================================

function returnJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// GITHUB WEBHOOK LISTENER (v3.0 - Auto-Versioning)
// ==========================================

function doPost(e) {
  try {
    const jsonString = e.postData.contents;
    const payload = JSON.parse(jsonString);
    
    // 1. Verify Payload
    if (!payload.commits) return returnJSON({status: "ignored"});

    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const logSheet = ss.getSheetByName("SYS_Changelog");
    const moduleSheet = ss.getSheetByName("SYS_Modules"); // [Source 415]
    const actionSheet = ss.getSheetByName("SYS_Roadmap_Actions");

    // 2. Detect Environment (Twin-Engine Logic)
    const repoName = payload.repository.name.toLowerCase();
    let envTag = "DEV"; 
    let verColIndex = 5; // Column E (Dev_Ver) is index 5 (1-based count in Sheets)
    
    if (repoName.includes("live") || repoName.includes("prod")) {
        envTag = "LIVE";
        verColIndex = 4; // Column D (Live_Ver)
    }

    const commits = payload.commits;

    commits.forEach(c => {
      const ts = new Date(c.timestamp);
      const msg = c.message;
      const author = c.author.name;
      const url = c.url;
      const hash = c.id.substring(0, 7);
      
      // Calculate total files changed
      const added = c.added || [];
      const modified = c.modified || [];
      const allFiles = [...added, ...modified];
      const fileCount = allFiles.length + (c.removed ? c.removed.length : 0);

      // --- 3. AUTO-VERSIONING ENGINE ---
      // We look at every HTML file modified in this commit
      allFiles.forEach(fileName => {
        if (fileName.endsWith(".html")) {
           try {
             // A. Construct Raw URL to fetch the file content
             // Note: Assumes public repo. If private, needs PAT.
             const rawUrl = `https://raw.githubusercontent.com/${payload.repository.full_name}/${payload.ref.split('/').pop()}/${fileName}`;
             const htmlContent = UrlFetchApp.fetch(rawUrl).getContentText();
             
             // B. Regex to find <title>... vX.X</title>
             // Matches: "Yard Sign Calculator v21.8" -> captures "v21.8"
             const verMatch = htmlContent.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);
             
             if (verMatch && verMatch[1]) {
               const newVersion = verMatch[1]; // e.g., "v21.8"
               
               // C. Update SYS_Modules
               const data = moduleSheet.getDataRange().getValues();
               // Loop rows to find matching file name (Column C / Index 2)
               for (let r = 1; r < data.length; r++) {
                 if (data[r][2] === fileName) {
                   // Update the specific cell (Row r+1, Column determined by Env)
                   moduleSheet.getRange(r + 1, verColIndex).setValue(newVersion);
                   break; // Stop looking for this file
                 }
               }
             }
           } catch (err) {
             console.error("Failed to parse version for " + fileName + ": " + err.toString());
           }
        }
      });

      // --- 4. LOGGING ---
      
      // Log to Master Changelog
      // Columns: Timestamp, Author, Hash, Message, Files, Link, Environment
      logSheet.appendRow([ts, author, hash, msg, fileCount, url, envTag]);

      // Roadmap Oversight (Link to Tickets)
      const ticketMatch = msg.match(/(RMP_[A-Za-z0-9_]+)/);
      if (ticketMatch && actionSheet) {
        const ticketId = ticketMatch;
        const actionId = "GIT_" + Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
        
        actionSheet.appendRow([
          actionId,
          ticketId,
          ts,
          `GitHub (${envTag})`, 
          "Code Commit", 
          `Commit by ${author}: ${msg} (${url})`
        ]);
      }
    });

    return returnJSON({ status: "success" });

  } catch (err) {
    return returnJSON({ status: "error", message: err.toString() });
  }
}

// ==========================================
// UTILITY: BACKFILL VERSIONS FROM GITHUB (FIXED v3)
// ==========================================

function syncVersionsFromGitHub() {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Modules");

  // Get all data (Rows are 0-indexed in JS)
  const data = sheet.getDataRange().getValues();

  // Repo Configuration
  const repoOwner = "SignStoreERP";
  const devRepo = "signos-app"; // Main Dev Repo
  const liveRepo = "signos-live"; // Production/Live Repo

  Logger.log("Starting Sync...");

  // Loop through rows (Start at 1 to skip Header)
  for (let i = 1; i < data.length; i++) {

    // --- FIX 1: Target Column C (Index 2) to match doPost logic ---
    const fileName = data[i][2]; 

    // Ensure we only check HTML files
    if (fileName && fileName.toString().endsWith(".html")) {

      // --- A. SYNC DEV VERSION (Column E / Index 5 / 1-based) ---
      try {
        // Construct URL for the "main" branch
        const devUrl = `https://raw.githubusercontent.com/${repoOwner}/${devRepo}/main/${fileName}`;
        const devHtml = UrlFetchApp.fetch(devUrl).getContentText();

        // Regex: Finds <title>... v21.8 ...</title>
        const devMatch = devHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);

        // --- FIX 2: Use index [1] for the capture group (was [2]) ---
        if (devMatch && devMatch[1]) {
          sheet.getRange(i + 1, 5).setValue(devMatch[1]);
          Logger.log(`[DEV] Updated ${fileName} to ${devMatch[1]}`);
        }
      } catch (e) {
        Logger.log(`[DEV] Skipped ${fileName}: File not found or request failed.`);
      }

      // --- B. SYNC LIVE VERSION (Column D / Index 4 / 1-based) ---
      try {
        const liveUrl = `https://raw.githubusercontent.com/${repoOwner}/${liveRepo}/main/${fileName}`;
        const liveHtml = UrlFetchApp.fetch(liveUrl).getContentText();
        
        const liveMatch = liveHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);

        // --- FIX 2: Use index [1] for the capture group (was [2]) ---
        if (liveMatch && liveMatch[1]) {
          sheet.getRange(i + 1, 4).setValue(liveMatch[1]);
          Logger.log(`[LIVE] Updated ${fileName} to ${liveMatch[1]}`);
        }
      } catch (e) {
        // Silent fail if file doesn't exist in Live yet
      }
    }
  }

  Logger.log("Sync Complete.");
}
