// ==========================================
// SignOS API v6.17 - (formatDate fix)
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
  if (params.req === "table") return fetchTable(params.tab);

  // 3. Roadmap / Ticketing
  if (params.req === "add_roadmap") return addRoadmapItem(params);
  if (params.req === "get_ticket") return getTicketDetails(params.id);
  if (params.req === "add_action") return addTicketAction(params);

  // 4. Archival & Logs (Admin)
  if (params.req === "manual_archive") return manualExport(params.pin);
  if (params.req === "get_archive_index") return fetchArchiveIndex();
  if (params.req === "get_log_content") return fetchLogFile(params.file_id);

  // Default: Config Fetch
  return fetchConfig(params.tab || "PROD_Yard_Signs");
}

// ==========================================
// ROADMAP TICKET LOGIC
// ==========================================

function addRoadmapItem(p) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("SYS_Roadmap");
    if (!sheet) return returnJSON({ status: "error", message: "Tab 'SYS_Roadmap' not found" });

    const ts = new Date();
    // ID: RMP_YYYYMMDD_HHmm
    const id = "RMP_" + Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyyMMdd_HHmm");

    // Capture Context and Source
    const source = p.source || "User";
    const context = p.context || "General";

    sheet.appendRow([
      id,
      ts,
      p.user || "Guest",
      p.cat || "Feature",
      p.prio || "Med",
      p.title || "Untitled",
      p.desc || "",
      "Triage", // Default Status
      p.target || "APP",
      source,   // Col J
      context   // Col K
    ]);

    return returnJSON({ status: "success", id: id });
  } catch (e) { return returnJSON({ status: "error", message: e.toString() }); }
}

function getTicketDetails(ticketId) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const parentSheet = ss.getSheetByName("SYS_Roadmap");
    const childSheet = ss.getSheetByName("SYS_Roadmap_Actions");
   
    if(!parentSheet || !childSheet) return returnJSON({ error: "Missing DB Tabs" });

    const pData = parentSheet.getDataRange().getValues();
    const pHeaders = pData;
    let parentObj = null;

    // Target Column A (Index 0) specifically
    for(let i=1; i<pData.length; i++) {
      if(String(pData[i]) === String(ticketId)) {
        parentObj = {};
        pHeaders.forEach((h, idx) => parentObj[h] = pData[i][idx]);
        break;
      }
    }

    if(!parentObj) return returnJSON({ error: "Ticket not found" });

    const cData = childSheet.getDataRange().getValues();
    const cHeaders = cData;
    const history = [];

    // Action Sheet: Column B (Index 1) is Parent_ID
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

function addTicketAction(p) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const actionSheet = ss.getSheetByName("SYS_Roadmap_Actions");
    const parentSheet = ss.getSheetByName("SYS_Roadmap");

    if(!actionSheet) return returnJSON({ status: "error", message: "Missing SYS_Roadmap_Actions" });

    const ts = new Date();
    const actionId = "ACT_" + Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");

    actionSheet.appendRow([
      actionId,
      p.id,
      ts,
      p.user || "System",
      p.type || "Comment",
      p.msg || ""
    ]);

    // Update Status in Parent Sheet if provided
    if(p.new_status && p.new_status !== "") {
      const pData = parentSheet.getDataRange().getValues();
      for(let i=1; i<pData.length; i++) {
        if(String(pData[i]) === String(p.id)) {
          parentSheet.getRange(i+1, 8).setValue(p.new_status); // Col H (8) is Status
          break;
        }
      }
    }
    return returnJSON({ status: "success" });
  } catch(e) { return returnJSON({ status: "error", message: e.toString() }); }
}

// ==========================================
// CORE DATA FUNCTIONS
// ==========================================

function fetchTable(tabName) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return returnJSON({ error: `Tab '${tabName}' not found` });

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return returnJSON([]);

    // --- BUG FIX: Select ONLY the first row (Index 0) ---
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

    // Get Col A (Key) and Col B (Value)
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const config = {};
    
    data.forEach(row => { 
        // FIX: Explicitly target  for Key and [1] for Value
        const key = row[0]; 
        const val = row[1]; 
        if (key && String(key).trim() !== "") config[key] = val; 
    });

    return returnJSON(config);
  } catch (err) { return returnJSON({ error: "System Error: " + err.toString() }); }
}


function handleAuth(pin) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("Master_Staff");
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());

    // 1. Map Columns Dynamically
    const idx = {
      n: headers.indexOf("first_name"),
      r: headers.indexOf("access_role"),
      p: headers.indexOf("access_pin"),
      active: headers.indexOf("is_active"),
      roadmap: headers.indexOf("roadmap_access"), // NEW
      backup: headers.indexOf("backup_access")    // NEW
    };

    // 2. Find User
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.p]) === String(pin)) {
       
        // Check Active Status
        const isActive = (data[i][idx.active] === true || String(data[i][idx.active]).toUpperCase() === "TRUE");
        if (!isActive) return returnJSON({ status: "fail", message: "Account Disabled" });

        // 3. Return User Data WITH Permissions
        return returnJSON({
          status: "success",
          name: data[i][idx.n],
          role: data[i][idx.r] || "VIEW",
          permissions: {
            roadmap: data[i][idx.roadmap] || "None",
            backup: data[i][idx.backup] || "None"
          }
        });
      }
    }

    return returnJSON({ status: "fail", message: "Invalid PIN" });

  } catch (e) {
    return returnJSON({ status: "error", message: e.toString() });
  }
}

// ==========================================
// ARCHIVE & LOGGING
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
      if (url) {
        const match = url.match(/\/d\/(.+?)\//);
        if (match) fileId = match[1];
        else if (url.includes("id=")) fileId = url.split("id=")[1];
      }
      return { date: r, name: r[1], url: url, count: r[3], type: r[4], file_id: fileId };
    }).reverse();

    return returnJSON(result);
  } catch (e) { return returnJSON({ error: e.toString() }); }
}

function fetchLogFile(fileId) {
  try {
    if (!fileId) return returnJSON({ status: "error", message: "No file ID provided" });
    const file = DriveApp.getFileById(fileId);
    return returnJSON({ status: "success", content: file.getBlob().getDataAsString() });
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

  // CHECK 1: PIN Validity
  if (authObj.status !== "success") return returnJSON({ status: "error", message: "Invalid PIN" });

  // CHECK 2: Granular Permission
  const backupAccess = (authObj.permissions && authObj.permissions.backup) ? authObj.permissions.backup : "None";
 
  if (backupAccess !== "Run" && backupAccess !== "Full") {
      return returnJSON({ status: "error", message: "Access Denied: Backup Permissions Required" });
  }

  return returnJSON(processArchive(false));
}

// === WRAPPER FOR TIME-DRIVEN TRIGGER ===
function archiveDailyLogs() {
  console.log("Starting Auto-Archive...");
  return processArchive(true); // true = Destructive
}
// ===========================================

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
      // Change 'row' to 'row[0]'
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

function returnJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// GITHUB WEBHOOK & AUTO-VERSIONING
// ==========================================

function doPost(e) {
  try {
    const jsonString = e.postData.contents;
    const payload = JSON.parse(jsonString);

    if (!payload.commits) return returnJSON({status: "ignored"});

    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const logSheet = ss.getSheetByName("SYS_Changelog");
    const moduleSheet = ss.getSheetByName("SYS_Modules");
    const actionSheet = ss.getSheetByName("SYS_Roadmap_Actions");

    // Detect Environment
    const repoName = payload.repository.name.toLowerCase();
    let envTag = "DEV";
    let verColIndex = 5; // Column E (Dev_Ver)

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
      const added = c.added || [];
      const modified = c.modified || [];
      const allFiles = [...added, ...modified];
      const fileCount = allFiles.length + (c.removed ? c.removed.length : 0);

      // AUTO-VERSIONING
      allFiles.forEach(fileName => {
        if (fileName.endsWith(".html")) {
          try {
            const rawUrl = `https://raw.githubusercontent.com/${payload.repository.full_name}/${payload.ref.split('/').pop()}/${fileName}`;
            const htmlContent = UrlFetchApp.fetch(rawUrl).getContentText();
            const verMatch = htmlContent.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);

            if (verMatch && verMatch[1]) {
              const newVersion = verMatch[1];
              const data = moduleSheet.getDataRange().getValues();
              for (let r = 1; r < data.length; r++) {
                // Check Column C (Index 2) for filename
                if (data[r][2] === fileName) {
                  moduleSheet.getRange(r + 1, verColIndex).setValue(newVersion);
                  break;
                }
              }
            }
          } catch (err) { console.error("Failed to parse version for " + fileName + ": " + err.toString()); }
        }
      });

      // LOGGING
      logSheet.appendRow([ts, author, hash, msg, fileCount, url, envTag]);

      // ROADMAP LINKING
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
  } catch (err) { return returnJSON({ status: "error", message: err.toString() }); }
}

// UTILITY: BACKFILL VERSIONS FROM GITHUB
function syncVersionsFromGitHub() {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Modules");
  const data = sheet.getDataRange().getValues();
  const repoOwner = "SignStoreERP";
  const devRepo = "signos-app";
  const liveRepo = "signos-live";

  Logger.log("Starting Sync...");

  for (let i = 1; i < data.length; i++) {
    const fileName = data[i][2]; // Fixed: Column C is Index 2

    if (fileName && fileName.toString().endsWith(".html")) {
      // SYNC DEV
      try {
        const devUrl = `https://raw.githubusercontent.com/${repoOwner}/${devRepo}/main/${fileName}`;
        const devHtml = UrlFetchApp.fetch(devUrl).getContentText();
        const devMatch = devHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);
        if (devMatch && devMatch[1]) {
          sheet.getRange(i + 1, 5).setValue(devMatch[1]); // Col E
          Logger.log(`[DEV] Updated ${fileName} to ${devMatch[1]}`);
        }
      } catch (e) { Logger.log(`[DEV] Miss: ${fileName}`); }

      // SYNC LIVE
      try {
        const liveUrl = `https://raw.githubusercontent.com/${repoOwner}/${liveRepo}/main/${fileName}`;
        const liveHtml = UrlFetchApp.fetch(liveUrl).getContentText();
        const liveMatch = liveHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);
        if (liveMatch && liveMatch[1]) {
          sheet.getRange(i + 1, 4).setValue(liveMatch[1]); // Col D
          Logger.log(`[LIVE] Updated ${fileName} to ${liveMatch[1]}`);
        }
      } catch (e) { Logger.log(`[LIVE] Miss: ${fileName}`); }
    }
  }
  Logger.log("Sync Complete.");
}


