// ==========================================
// SignOS API v6.20 - (NotebookLM Bridge Added)
// ==========================================

// MASTER 1: The Data Backend (READ/WRITE)
const DATA_SS_ID = "1wiaj5rU5J2kv1SobfyysMFynDOsli4Nb6pDvIf3L9_Y";

// MASTER 2: The Log Backend (WRITE ONLY)
const LOG_SS_ID = "1LqSV-byNLOdu_GVyasvFmwyaW8TkyvW4F78u6_gaqzk";

// ARCHIVE: SignOS_Archives Folder
const ARCHIVE_FOLDER_ID = "18MBPWajHdF4TNQ0g8Iz1n1-GT3nBrMj4";

// CONTEXT: SignOS ERP Shared Folder (For NotebookLM)
const CONTEXT_FOLDER_ID = "1Hl5LtIhwt6p3zDeV52kok-8C61_ApXf7"; 

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
  if (params.req === "get_logs") return fetchLogs(params);
  if (params.req === "log_event") return ContentService.createTextOutput("Logged");

  // 5. System Utils
  if (params.req === "ping") return ContentService.createTextOutput("pong");
  if (params.req === "sync_versions") return syncVersionsFromGitHub();
  
  // 6. NOTEBOOKLM BRIDGE (New)
  if (params.req === "sync_master") return generateNotebookLMBridge();

  return ContentService.createTextOutput("SignOS API Online");
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

function handleAuth(pin) {
  const sheet = SpreadsheetApp.openById(DATA_SS_ID).getSheetByName("Master_Staff");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][6] == pin && data[i][7] === true) { // Col G=PIN, H=Active
      return json({
        status: "success",
        name: data[i][1], // First Name
        role: data[i][5], // Role
        permissions: {
          roadmap: data[i][8],
          backup: data[i][9]
        }
      });
    }
  }
  return json({ status: "error", message: "Invalid PIN" });
}

function fetchTable(tabName) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return json({ error: "Table not found" });

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    const result = rows.map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });

    return json(result);
  } catch (e) {
    return json({ error: e.toString() });
  }
}

// ==========================================
// ROADMAP & TICKETING
// ==========================================

function addRoadmapItem(p) {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Roadmap");
  
  const newId = "RMP_" + (Math.floor(Math.random() * 90000) + 10000);
  const timestamp = new Date();
  
  // ID, Timestamp, User, Category, Priority, Title, Description, Status, Target, Source, Context
  sheet.appendRow([
    newId, 
    timestamp, 
    p.user, 
    p.cat, 
    p.prio || "Med", 
    decodeURIComponent(p.title), 
    decodeURIComponent(p.desc), 
    "Pending", 
    p.target || "APP", 
    p.source || "User",
    p.context || "General"
  ]);
  
  return json({ status: "success", id: newId });
}

function getTicketDetails(id) {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Roadmap_Actions");
  const data = sheet.getDataRange().getValues();
  
  const actions = data.filter(r => r[1] === id).map(r => ({
    timestamp: r[2],
    user: r[3],
    type: r[4],
    details: r[5]
  }));
  
  return json(actions);
}

function addTicketAction(p) {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Roadmap_Actions");
  
  const actId = "ACT_" + Date.now();
  // Action_ID, Parent_ID, Timestamp, User, Type, Details
  sheet.appendRow([actId, p.parent_id, new Date(), p.user, p.type, decodeURIComponent(p.details)]);
  
  return json({ status: "success" });
}

// ==========================================
// LOGGING & ARCHIVES
// ==========================================

function logActivity(p) {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const sheet = ss.getSheetByName("SYS_Access_Logs");
    // Timestamp, IP, User, Role, Action, Target, Meta
    sheet.appendRow([
      new Date(),
      p.ip || "Unknown",
      p.user || "N/A",
      p.role || "N/A",
      p.req || "visit",
      p.tab || "N/A",
      JSON.stringify(p)
    ]);
  } catch (e) {
    console.log("Log Error: " + e.toString());
  }
}

function manualExport(pin) {
  // Validate Admin PIN again for security
  const auth = handleAuth(pin);
  const authObj = JSON.parse(auth.getContent());
  if (authObj.status !== "success") return json({ status: "error", message: "Unauthorized" });

  return archiveDailyLogs();
}

function archiveDailyLogs() {
  const ss = SpreadsheetApp.openById(LOG_SS_ID);
  const sheet = ss.getSheetByName("SYS_Access_Logs");
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return json({ status: "error", message: "No logs to archive" });

  // Create Text File
  const content = data.map(row => row.join(" | ")).join("\n");
  const fileName = "SignOS_Logs_" + Utilities.formatDate(new Date(), "EST", "yyyy-MM-dd_HHmm") + ".txt";
  
  const folder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID);
  const file = folder.createFile(fileName, content);
  
  // Clear Sheet (Keep Header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }

  return json({ 
    status: "success", 
    url: file.getUrl(), 
    rows_archived: data.length - 1 
  });
}

// ==========================================
// SYSTEM UTILITIES
// ==========================================

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function syncVersionsFromGitHub() {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Modules");
  const data = sheet.getDataRange().getValues();
  
  const repoOwner = "SignStoreERP";
  const devRepo = "signos-app";
  const liveRepo = "signos-live";
  
  Logger.log("Starting Sync...");
  
  for (let i = 1; i < data.length; i++) {
    const fileName = data[i][2]; 
    if (fileName && fileName.toString().endsWith(".html")) {
      
      // SYNC DEV
      try {
        const devUrl = `https://raw.githubusercontent.com/${repoOwner}/${devRepo}/main/${fileName}`;
        const devHtml = UrlFetchApp.fetch(devUrl).getContentText();
        const devMatch = devHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);
        if (devMatch && devMatch[1]) {
          sheet.getRange(i + 1, 5).setValue(devMatch[1]); // Col E
        }
      } catch (e) { Logger.log(`[DEV] Miss: ${fileName}`); }

      // SYNC LIVE
      try {
        const liveUrl = `https://raw.githubusercontent.com/${repoOwner}/${liveRepo}/main/${fileName}`;
        const liveHtml = UrlFetchApp.fetch(liveUrl).getContentText();
        const liveMatch = liveHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);
        if (liveMatch && liveMatch[1]) {
          sheet.getRange(i + 1, 4).setValue(liveMatch[1]); // Col D
        }
      } catch (e) { Logger.log(`[LIVE] Miss: ${fileName}`); }
    }
  }
  return json({ status: "success" });
}

/**
 * NOTEBOOKLM BRIDGE (v2.0)
 * Compiles the entire LIVE application into a single context file.
 * Updates the existing file instead of creating duplicates.
 * Targets: SignOS ERP Shared Folder
 */
function generateNotebookLMBridge() {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Modules");
  const data = sheet.getDataRange().getValues();
  
  let fullContent = "SIGNOS ERP - MASTER CODEBASE CONTEXT\n";
  fullContent += "Last Sync: " + new Date().toString() + "\n";
  fullContent += "========================================\n\n";

  const repoOwner = "SignStoreERP";
  // We prioritize DEV repo for the context bridge to capture latest changes
  const repoName = "signos-app"; 

  // 1. Compile the Code
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    const name = data[i][1]; // Display Name
    const fileName = data[i][2]; // File Link
    
    if (fileName && fileName.toString().endsWith(".html")) {
      try {
        const url = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${fileName}`;
        const html = UrlFetchApp.fetch(url).getContentText();
        
        fullContent += `--- MODULE START: ${name} (${fileName}) ---\n`;
        fullContent += html + "\n";
        fullContent += `--- MODULE END: ${fileName} ---\n\n`;
        count++;
      } catch (e) {
        fullContent += `[ERROR FETCHING ${fileName}]\n\n`;
      }
    }
  }

  // 2. Target Specific Folder
  const folder = DriveApp.getFolderById(CONTEXT_FOLDER_ID);
  const fileName = "SignOS_Master_Context.txt";
  const files = folder.getFilesByName(fileName);

  let fileUrl = "";

  // 3. Update or Create Logic
  if (files.hasNext()) {
    // UPDATE EXISTING
    const file = files.next();
    file.setContent(fullContent);
    fileUrl = file.getUrl();
  } else {
    // CREATE NEW
    const file = folder.createFile(fileName, fullContent, MimeType.PLAIN_TEXT);
    fileUrl = file.getUrl();
  }

  return ContentService.createTextOutput(JSON.stringify({ 
    status: "success", 
    message: `Compiled ${count} modules.`,
    url: fileUrl 
  })).setMimeType(ContentService.MimeType.JSON);
}

