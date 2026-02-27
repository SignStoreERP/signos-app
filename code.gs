// ==========================================
// SignOS_DEV API v7.3.0 - Centralized Loader Update
// ==========================================

// MASTER 1: The Data Backend (READ/WRITE)
const DATA_SS_ID = "1E_3rK2Azo2Dql5YgyTR3nZQNlHKR_pvJ2ui5YmrmgOY";

// MASTER 2: The Log Backend (WRITE ONLY)
const LOG_SS_ID = "1CdWzQtH64kF6x5FIU9_KMBRHRBun0O70F7h228oPn8M";

// FOLDER IDS
const ARCHIVE_FOLDER_ID = "1IKajBC34p-El-Lz32P0OqWoXMjaGf9Nj";
const CONTEXT_FOLDER_ID = "1BtnKSEYbOzFz-yO13_IaKnifLAtlpLJP";
const BACKUP_FOLDER_ID = "137hLX294etbwgrT-bK2hUV0_Lr8iFi43";

/**
 * Main Web App Entry Point (Routing Engine)
 */
function doGet(e) {
  const params = e.parameter;

  // 1. LOGGING (Async)
  if (params.ip) logActivity(params);

  // --- ROUTING ---
  // 2. Auth & Core Tables
  if (params.req === "auth") return handleAuth(params.pin);
  if (params.req === "table") return fetchTable(params.tab);

  // 2b. Matrix Updates & Fetches
  if (params.req === "update_matrix") return updateMatrixValue(params);
  if (params.req === "view_module") return fetchProductWithMatrix(params.tab);
  if (params.req === "commit_matrix") return commitMatrixBatch(params);
  if (params.req === "bundle") return fetchProductBundle(params);

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

  // 5. System Utils & Version Control
  if (params.req === "ping") return ContentService.createTextOutput("pong");
  if (params.req === "sync_versions") return syncVersionsFromGitHub();

  // 6. NotebookLM Bridges
  if (params.req === "sync_codebase") return generateNotebookLMBridge();
  if (params.req === "sync_backend") return generateBackendContext();

  // 7. DEFAULT: Matrix Config Fetch
  return fetchProductWithMatrix(params.tab || "PROD_Yard_Signs");
}

function fetchProductBundle(p) {
  try {
    const payload = {};
    
    // 1. Get Base Config (Uses your new Override logic automatically)
    const configRes = fetchProductWithMatrix(p.tab);
    payload.config = JSON.parse(configRes.getContent());
    
    // 2. Get Dependent Tables
    payload.tables = {};
    if (p.refs) {
      const tables = p.refs.split(',');
      tables.forEach(tName => {
        const tableRes = fetchTable(tName.trim());
        const parsed = JSON.parse(tableRes.getContent());
        if (!parsed.error) {
          payload.tables[tName.trim()] = parsed;
        }
      });
    }
    
    return returnJSON({ status: "success", data: payload });
  } catch (e) {
    return returnJSON({ status: "error", message: e.toString() });
  }
}

// ==========================================
//  CORE DATA & AUTH FUNCTIONS
// ==========================================

function handleAuth(pin) {
  const sheet = SpreadsheetApp.openById(DATA_SS_ID).getSheetByName("Master_Staff");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][6]) === String(pin)) { // FIXED: Col G
      const isActive = (data[i][7] === true || String(data[i][7]).toUpperCase() === "TRUE"); // FIXED: Col H
      if (!isActive) return returnJSON({ status: "fail", message: "Account Disabled" });

      return returnJSON({
        status: "success",
        name: data[i][1], // First Name (Col B)
        role: data[i][5], // Access Role (Col F)
        permissions: {
          roadmap: data[i][8] || "None", // Col I
          backup: data[i][9] || "None"   // Col J
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

    const headers = values[0]; 
    const rows = values.slice(1);

    const result = rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        if (header && String(header).trim() !== "") obj[header] = row[index];
      });
      return obj;
    });

    return returnJSON(result);
  } catch (err) { return returnJSON({ error: err.toString() }); }
}

// ==========================================
//  MATRIX INTEGRATION ENGINE
// ==========================================

function fetchProductWithMatrix(tabName) {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  let config = {};

  // 1. Fetch Standard Product Data (With Override Fallback)
  try {
    const prodSheet = ss.getSheetByName(tabName);
    if (prodSheet) {
      // data is a 2D array: [row][column]
      const data = prodSheet.getDataRange().getValues();
      
      // Start at i=1 to skip the header row
      for (let i = 1; i < data.length; i++) {
        const keyName = data[i][0];       // Column A: Index 0
        const defaultVal = data[i][1];    // Column B: Index 1
        const overrideVal = data[i][2];   // Column C: Index 2
        
        // Ensure the key exists before assigning to config
        if (keyName) {
          // FALLBACK LOGIC: If override is not empty, use it. Otherwise, use default.
          if (overrideVal !== "" && overrideVal !== null) {
            config[keyName] = overrideVal;
          } else {
            config[keyName] = defaultVal;
          }
        }
      }
    }
  } catch(e) { 
    console.warn("Fetch failed for " + tabName + ": " + e); 
  }

  try {
    const matrixSheet = ss.getSheetByName("SYS_Cost_Matrix");
    const defSheet = ss.getSheetByName("REF_Cost_Definitions");
    if (matrixSheet && defSheet) {
      const mData = matrixSheet.getDataRange().getValues();
      const dData = defSheet.getDataRange().getValues();
      const productID = tabName.replace("_Signs", "").replace("_Calculator", "");

      const headers = mData[0];
      const colIdx = headers.findIndex(h => h === productID || h === tabName);

      if (colIdx > -1) {
        const defMap = {};
        for (let i = 1; i < dData.length; i++) {
          if(dData[i][0]) defMap[dData[i][0]] = dData[i][5]; // FIXED: Default Source Ref (Col F)
        }
        for (let r = 1; r < mData.length; r++) {
          const costKey = mData[r][0]; 
          const matrixVal = mData[r][colIdx];

          if (matrixVal === false || String(matrixVal).toUpperCase() === "FALSE") {
            config[costKey] = 0;
          } else if (matrixVal === true || String(matrixVal).toUpperCase() === "TRUE") {
            config[costKey] = defMap[costKey];
          } else if (matrixVal !== "" && !isNaN(parseFloat(matrixVal))) {
            config[costKey] = matrixVal;
          }
        }
      }
    }
  } catch(e) { console.warn("Matrix Logic Failed: " + e); }

  try {
    const blueSheet = ss.getSheetByName("Master_Retail_Blue_Sheet");
    if (blueSheet) {
      const bData = blueSheet.getDataRange().getValues();
      for (let i = 1; i < bData.length; i++) {
        const key = bData[i][0]; 
        if (key && typeof key === 'string') {
          config[`${key}_1`] = bData[i][5];  // FIXED: Price Qty 1 (Col F)
          config[`${key}_10`] = bData[i][6]; // FIXED: Price Qty 10+ (Col G)
        }
      }
    }
  } catch(e) { console.warn("Blue Sheet fetch failed: " + e); }

  return returnJSON(config);
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
    const cHeaders = cData[0];
    const history = [];

    for(let i=1; i<cData.length; i++) {
      if(String(cData[i][1]) === String(ticketId)) { // Parent_ID (Col B)
        let act = {};
        cHeaders.forEach((h, idx) => act[h] = cData[i][idx]);
        history.push(act);
      }
    }
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
        pSheet.getRange(i+1, 8).setValue(p.new_status); // Status is Col 8
        break;
      }
    }
  }
  return returnJSON({ status: "success" });
}

// ==========================================
//  ADMIN LOGS & ARCHIVING
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

    const data = sheet.getDataRange().getValues();
    return returnJSON({ status: "success", logs: data });
  } catch(e) { return returnJSON({ status: "error", message: e.toString() }); }
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
//  MATRIX BATCH ENGINE (Stage & Commit)
// ==========================================

function updateMatrixValue(p) {
  try {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("SYS_Cost_Matrix");
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowIds = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat();

    const colIndex = headers.indexOf(p.product_id);
    const rowIndex = rowIds.indexOf(p.cost_id);

    if (colIndex === -1 || rowIndex === -1) throw new Error("Invalid Coordinates");

    let val = p.value;
    if (val === 'TRUE') val = true;
    if (val === 'FALSE') val = false;

    sheet.getRange(rowIndex + 1, colIndex + 1).setValue(val);
    return returnJSON({ status: "success", new_value: val });
  } catch (e) { return returnJSON({ status: "error", message: e.toString() }); }
}

function commitMatrixBatch(p) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("SYS_Cost_Matrix");

    const currentData = sheet.getDataRange().getValues();
    const backupName = `BACKUP_Matrix_${Date.now()}.json`;
    const backupFolder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
    backupFolder.createFile(backupName, JSON.stringify(currentData), MimeType.PLAIN_TEXT);

    const updates = JSON.parse(p.payload);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const costIds = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat();
    let successCount = 0;

    updates.forEach(change => {
      const colIndex = headers.indexOf(change.product);
      const rowIndex = costIds.indexOf(change.cost);
      if (colIndex > -1 && rowIndex > -1) {
        let val = change.value;
        if (val === 'TRUE') val = true;
        if (val === 'FALSE') val = false;
        sheet.getRange(rowIndex + 1, colIndex + 1).setValue(val);
        successCount++;
      }
    });

    return returnJSON({ status: "success", count: successCount });
  } catch (e) { return returnJSON({ status: "error", message: e.toString() }); }
  finally { lock.releaseLock(); }
}

// ==========================================
//  NOTEBOOKLM BRIDGES (V2.0)
// ==========================================

function generateNotebookLMBridge() {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("SYS_Modules");
    const data = sheet.getDataRange().getValues();

    const repoOwner = "SignStoreERP";
    const repoName = "signos-app"; // NOTE: Change to 'signos-live' for the LIVE script

    const MAX_CHARS = 300000;
    let chunks = [];
    let currentContent = `# SIGNOS MASTER CODEBASE (PART 1)\n**Sync:** ${new Date().toString()}\n---\n\n`;
    let count = 0;
    let fetchedJS = new Set();

    for (let i = 1; i < data.length; i++) {
        // FIXED: Column B (Index 1) and Column C (Index 2)
        const name = data[i][4];      
        const fileName = data[i][5];  

        if (fileName && (fileName.toString().endsWith(".html") || fileName.toString().endsWith(".js"))) {
            try {
                const url = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${fileName}`;
                const content = UrlFetchApp.fetch(url).getContentText();
                const lang = fileName.endsWith('.js') ? 'javascript' : 'html';

                let block = `## ${name} (${fileName})\n\`\`\`${lang}\n${content}\n\`\`\`\n\n---\n\n`;

                if (currentContent.length + block.length > MAX_CHARS) {
                    chunks.push(currentContent);
                    currentContent = `# SIGNOS MASTER CODEBASE (PART ${chunks.length + 1})\n**Sync:** ${new Date().toString()}\n---\n\n`;
                }
                currentContent += block;
                count++;
                
                // DEPENDENCY SCANNER (Fetches matching .js files automatically)
                if (lang === 'html') {
                    const scriptRegex = /<script src="([^"]+\.js)"><\/script>/g;
                    let match;
                    while ((match = scriptRegex.exec(content)) !== null) {
                        const jsFileName = match[4]; // FIXED: Extracts the exact filename
                        if (!jsFileName.startsWith('http') && !fetchedJS.has(jsFileName)) {
                            fetchedJS.add(jsFileName);
                            try {
                                const jsUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${jsFileName}`;
                                const jsContent = UrlFetchApp.fetch(jsUrl).getContentText();
                                let jsBlock = `## Dependency (${jsFileName})\n> Parent: ${fileName}\n\n\`\`\`javascript\n${jsContent}\n\`\`\`\n\n---\n\n`;

                                if (currentContent.length + jsBlock.length > MAX_CHARS) {
                                    chunks.push(currentContent);
                                    currentContent = `# SIGNOS ERP - MASTER CODEBASE CONTEXT (PART ${chunks.length + 1})\n**Last Sync:** ${new Date().toString()}\n---\n\n`;
                                }
                                currentContent += jsBlock;
                                count++;
                            } catch(jsErr) {}
                        }
                    }
                }
            } catch (e) {}
        }
    }
    chunks.push(currentContent);

    const folder = DriveApp.getFolderById(CONTEXT_FOLDER_ID);
    const oldFiles = folder.getFiles();
    while(oldFiles.hasNext()) {
        const f = oldFiles.next();
        if(f.getName().startsWith("SignOS_DEV_Context") || f.getName().startsWith("SignOS_LIVE_Context")) f.setTrashed(true);
    }

    chunks.forEach((text, idx) => {
        folder.createFile(`SignOS_DEV_Context_Part_${idx + 1}.txt`, text, MimeType.PLAIN_TEXT);
    });

    return returnJSON({ status: "success", message: `Synced ${count} files across ${chunks.length} chunks.` });
}

function generateBackendContext() {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheets = ss.getSheets();
  let context = "SIGNOS ERP - BACKEND DATA CONTEXT\n\n";

  sheets.forEach(s => {
    const name = s.getName();
    if (name.includes("Log") || name.includes("Changelog")) return;
    const data = s.getDataRange().getValues();
    context += `\nTAB: ${name}\n`;
    data.slice(0, 50).forEach(row => context += `| ${row.join(" | ")} |\n`);
  });

  const folder = DriveApp.getFolderById(CONTEXT_FOLDER_ID);
  const fileName = "SignOS_DEV_Backend_Context.txt";
  const files = folder.getFilesByName(fileName);
  while (files.hasNext()) files.next().setTrashed(true);
  
  folder.createFile(fileName, context, MimeType.PLAIN_TEXT);
  return returnJSON({ status: "success", message: "Context Updated" });
}

// ==========================================
//  WEBHOOK & GITHUB V-CRAWLER
// ==========================================

function syncVersionsFromGitHub() {
  const ss = SpreadsheetApp.openById(DATA_SS_ID);
  const sheet = ss.getSheetByName("SYS_Modules");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const fileName = data[i][2]; // Col C
    if (fileName && fileName.toString().endsWith(".html")) {
      try {
        const url = `https://raw.githubusercontent.com/SignStoreERP/signos-app/main/${fileName}`;
        const html = UrlFetchApp.fetch(url).getContentText();
        const match = html.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);
        if (match && match[1]) sheet.getRange(i + 1, 6).setValue(match[1]); // Dev_Ver is Col F
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
    payload.commits.forEach(c => {
      logSheet.appendRow([new Date(c.timestamp), c.author.name, c.id.substring(0, 7), c.message, c.added.length+c.modified.length, c.url, "DEV"]);
    });
    syncVersionsFromGitHub();
    return returnJSON({ status: "success" });
  } catch(e) { return returnJSON({ status: "error" }); }
}

// ==========================================
//  UTILITIES & AUTOMATION
// ==========================================

function returnJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function logActivity(p) {
  try {
    const ss = SpreadsheetApp.openById(LOG_SS_ID);
    const sheet = ss.getSheetByName("SYS_Access_Logs");
    sheet.appendRow([new Date(), p.ip || "Unknown", p.user || "GUEST", p.role || "N/A", p.req, p.tab || "N/A", JSON.stringify(p)]);
  } catch (e) {}
}

function archiveDailyLogs() {
  try { processArchive(true); } catch(e) { console.error("Auto Archive Failed", e); }
}
