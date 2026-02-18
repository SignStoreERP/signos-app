// ==========================================
// SignOS API v6.23 - Critical Array Fixes
// ==========================================

// MASTER 1: The Data Backend (READ/WRITE)
const DATA_SS_ID = "1wiaj5rU5J2kv1SobfyysMFynDOsli4Nb6pDvIf3L9_Y";

// MASTER 2: The Log Backend (WRITE ONLY)
const LOG_SS_ID = "1LqSV-byNLOdu_GVyasvFmwyaW8TkyvW4F78u6_gaqzk";

// ARCHIVE: SignOS_Archives Folder
const ARCHIVE_FOLDER_ID = "18MBPWajHdF4TNQ0g8Iz1n1-GT3nBrMj4";

// CONTEXT: SignOS Dev Folder
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
  if (params.req === "get_archive_index") return fetchArchiveIndex();
  if (params.req === "get_log_content") return fetchLogFile(params.file_id);
  if (params.req === "get_live_logs") return fetchLiveLogs();
  if (params.req === "log_event") return ContentService.createTextOutput("Logged");

  // 5. System Utils
  if (params.req === "ping") return ContentService.createTextOutput("pong");
  if (params.req === "sync_versions") return syncVersionsFromGitHub();
  
  // 6. NotebookLM Bridge
  if (params.req === "sync_codebase") return generateNotebookLMBridge();

  // 7. DEFAULT: Config Fetch
  return fetchConfig(params.tab || "PROD_Yard_Signs");
}

// ==========================================
//  CORE DATA FUNCTIONS
// ==========================================

function handleAuth(pin) {
  const sheet = SpreadsheetApp.openById(DATA_SS_ID).getSheetByName("Master_Staff");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][6]) === String(pin)) { // Col G
      const isActive = (data[i][7] === true || String(data[i][7]).toUpperCase() === "TRUE");
      if (!isActive) return returnJSON({ status: "fail", message: "Account Disabled" });

      return returnJSON({
        status: "success",
        name: data[i][1], 
        role: data[i][5], 
        permissions: {
          roadmap: data[i][8] || "None",
          backup: data[i][9] || "None"
        }
      });
    }
  }
  return returnJSON({ status: "fail", message: "Invalid PIN" });
}

function fetchTable(tabName) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return returnJSON({ error: `Tab '${tabName}' not found` });
    
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return returnJSON([]);
    
    // FIX v6.22: Select row 0 specifically for headers
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
  } catch (err) { return returnJSON({ error: err.toString() }); }
}

function fetchConfig(tabName) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return returnJSON({ error: `Tab '${tabName}' not found` });
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return returnJSON({});
    
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const config = {};
    
    data.forEach(row => {
      const key = row[0];
      const val = row[1];
      if (key && String(key).trim() !== "") config[key] = val;
    });
    
    return returnJSON(config);
  } catch (err) { return returnJSON({ error: err.toString() }); }
}

// ==========================================
//  ROADMAP & TICKETING
// ==========================================

function addRoadmapItem(p) {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Roadmap");
  const id = "RMP_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm");
  
  sheet.appendRow([
    id, new Date(), p.user, p.cat, p.prio || "Med",
    decodeURIComponent(p.title), decodeURIComponent(p.desc),
    "Pending", p.target || "APP", p.source || "User", p.context || "General"
  ]);
  return returnJSON({ status: "success", id: id });
}

function getTicketDetails(ticketId) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const pSheet = ss.getSheetByName("SYS_Roadmap");
    const cSheet = ss.getSheetByName("SYS_Roadmap_Actions");
    
    const pData = pSheet.getDataRange().getValues();
    // FIX v6.22: Select row 0 for headers
    const pHeaders = pData[0];
    let ticket = null;
    
    for(let i=1; i<pData.length; i++) {
      if(String(pData[i][0]) === String(ticketId)) {
        ticket = {};
        pHeaders.forEach((h, idx) => ticket[h] = pData[i][idx]);
        break;
      }
    }
    
    if(!ticket) return returnJSON({ status: "error", message: "Ticket not found" });
    
    const cData = cSheet.getDataRange().getValues();
    // FIX v6.22: Select row 0 for headers
    const cHeaders = cData[0];
    const history = [];
    
    for(let i=1; i<cData.length; i++) {
      if(String(cData[i][1]) === String(ticketId)) {
        let act = {};
        cHeaders.forEach((h, idx) => act[h] = cData[i][idx]);
        history.push(act);
      }
    }
    history.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    
    return returnJSON({ status: "success", ticket: ticket, history: history });
    
  } catch(e) { return returnJSON({ status: "error", message: e.toString() }); }
}

function addTicketAction(p) {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Roadmap_Actions");
  const actId = "ACT_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  
  sheet.appendRow([actId, p.id, new Date(), p.user, p.type, decodeURIComponent(p.msg)]);
  
  if(p.new_status) {
    const pSheet = ss.getSheetByName("SYS_Roadmap");
    const pData = pSheet.getDataRange().getValues();
    for(let i=1; i<pData.length; i++) {
      if(String(pData[i][0]) === String(p.id)) {
        pSheet.getRange(i+1, 8).setValue(p.new_status);
        break;
      }
    }
  }
  return returnJSON({ status: "success" });
}

// ==========================================
//  ARCHIVE & LOGGING
// ==========================================

function fetchArchiveIndex() {
  const ss = SpreadsheetApp.openById(LOG_SS_ID);
  const sheet = ss.getSheetByName("SYS_Archive_Index");
  if (!sheet) return returnJSON([]);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return returnJSON([]);
  
  const result = data.slice(1).map(r => {
    let fileId = null;
    if (r[2] && r[2].includes("/d/")) {
        const match = r[2].match(/\/d\/(.+?)\//);
        if(match) fileId = match[1];
    }
    return { date: r[0], name: r[1], url: r[2], count: r[3], type: r[4], file_id: fileId };
  }).reverse();
  return returnJSON(result);
}

function fetchLogFile(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    return returnJSON({ status: "success", content: file.getBlob().getDataAsString() });
  } catch(e) { return returnJSON({ status: "error", message: e.toString() }); }
}

function fetchLiveLogs() {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const sheet = ss.getSheetByName("SYS_Access_Logs");
    if (!sheet) return returnJSON({ status: "error", message: "Log sheet not found" });
    
    // RETURN RAW DATA (Fix for logic_viewer.js)
    // We return the entire grid (Array of Arrays) so the frontend can slice/map it by index.
    const data = sheet.getDataRange().getValues();
    
    return returnJSON({ status: "success", logs: data });
    
  } catch(e) { return returnJSON({ status: "error", message: e.toString() }); }
}

function logActivity(p) {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const sheet = ss.getSheetByName("SYS_Access_Logs");
    sheet.appendRow([new Date(), p.ip || "Unknown", p.user || "GUEST", p.role || "N/A", p.req, p.tab || "N/A", JSON.stringify(p)]);
  } catch (e) {}
}

function manualExport(pin) {
  const auth = handleAuth(pin);
  const authObj = JSON.parse(auth.getContent());
  if (authObj.status !== "success") return returnJSON({ status: "error", message: "Unauthorized" });
  
  return returnJSON(processArchive(false));
}

function processArchive(isDestructive) {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const logSheet = ss.getSheetByName("SYS_Access_Logs");
    const lastRow = logSheet.getLastRow();
    if (lastRow < 2) return { status: "skipped" };
    
    const data = logSheet.getRange(2, 1, lastRow - 1, logSheet.getLastColumn()).getValues();
    let content = "Timestamp | IP | User | Role | Action | Target | Meta\n=================================================\n";
    data.forEach(r => content += r.join(" | ") + "\n");
    
    const name = `SignOS_Log_${isDestructive ? 'AUTO' : 'MANUAL'}_${Date.now()}.txt`;
    const folder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID);
    const file = folder.createFile(name, content);
    
    const idxSheet = ss.getSheetByName("SYS_Archive_Index");
    idxSheet.appendRow([new Date(), name, file.getUrl(), data.length, isDestructive ? "AUTO" : "MANUAL"]);
    
    if (isDestructive) logSheet.deleteRows(2, lastRow - 1);
    
    return { status: "success", url: file.getUrl(), rows_archived: data.length };
  } catch(e) { return { status: "error", message: e.toString() }; }
}

// ==========================================
//  NOTEBOOKLM BRIDGE
// ==========================================

function generateNotebookLMBridge() {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Modules");
  const data = sheet.getDataRange().getValues();
  
  let fullContent = "# SIGNOS ERP - MASTER CODEBASE CONTEXT\n";
  fullContent += `**Last Sync:** ${new Date().toString()}\n`;
  fullContent += "---\n\n";

  const repoOwner = "SignStoreERP";
  const repoName = "signos-app"; 
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const name = data[i][1]; 
    const fileName = data[i][2]; 
    
    if (fileName && (fileName.toString().endsWith(".html") || fileName.toString().endsWith(".js"))) {
      try {
        const url = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${fileName}`;
        const content = UrlFetchApp.fetch(url).getContentText();
        const ext = fileName.split('.').pop();
        const lang = ext === 'js' ? 'javascript' : 'html';

        fullContent += `## ${name} (${fileName})\n> Source: ${url}\n\n`;
        fullContent += "```" + lang + "\n" + content + "\n```\n\n---\n\n";
        count++;
      } catch (e) {}
    }
  }
  
  const folder = DriveApp.getFolderById(CONTEXT_FOLDER_ID);
  const targetName = "SignOS_Master_Context.txt";
  const files = folder.getFilesByName(targetName);
  let fileUrl = "";

  if (files.hasNext()) {
    const file = files.next();
    file.setContent(fullContent);
    fileUrl = file.getUrl();
  } else {
    const file = folder.createFile(targetName, fullContent, MimeType.PLAIN_TEXT);
    fileUrl = file.getUrl();
  }
  
  return returnJSON({ status: "success", message: `Synced ${count} modules.`, url: fileUrl });
}

// ==========================================
//  UTILITIES & WEBHOOK
// ==========================================

function returnJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function syncVersionsFromGitHub() {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Modules");
  const data = sheet.getDataRange().getValues();
  
  const repoOwner = "SignStoreERP";
  const devRepo = "signos-app";
  const liveRepo = "signos-live";
  
  for (let i = 1; i < data.length; i++) {
    const fileName = data[i][2]; 
    if (fileName && fileName.toString().endsWith(".html")) {
      try {
        const devUrl = `https://raw.githubusercontent.com/${repoOwner}/${devRepo}/main/${fileName}`;
        const devHtml = UrlFetchApp.fetch(devUrl).getContentText();
        const devMatch = devHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);
        if (devMatch && devMatch[1]) {
          sheet.getRange(i + 1, 5).setValue(devMatch[1]); 
        }
      } catch (e) {}

      try {
        const liveUrl = `https://raw.githubusercontent.com/${repoOwner}/${liveRepo}/main/${fileName}`;
        const liveHtml = UrlFetchApp.fetch(liveUrl).getContentText();
        const liveMatch = liveHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);
        if (liveMatch && liveMatch[1]) {
          sheet.getRange(i + 1, 4).setValue(liveMatch[1]); 
        }
      } catch (e) {}
    }
  }
  return returnJSON({ status: "success" });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (!payload.commits) return returnJSON({status: "ignored"});
    
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const logSheet = ss.getSheetByName("SYS_Changelog");
    
    const repoName = payload.repository.name.toLowerCase();
    const envTag = (repoName.includes("live") || repoName.includes("prod")) ? "LIVE" : "DEV";

    payload.commits.forEach(c => {
      const ts = new Date(c.timestamp);
      logSheet.appendRow([ts, c.author.name, c.id.substring(0, 7), c.message, c.added.length+c.modified.length, c.url, envTag]);
    });
    
    syncVersionsFromGitHub(); 
    return returnJSON({ status: "success" });
  } catch(e) { return returnJSON({ status: "error" }); }
}

