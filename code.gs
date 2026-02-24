// ==========================================
// SignOS_DEV API v7.2 - NEW Backend Data Extraction Bridge
// ==========================================

// MASTER 1: The Data Backend (READ/WRITE)
const DATA_SS_ID = "1E_3rK2Azo2Dql5YgyTR3nZQNlHKR_pvJ2ui5YmrmgOY";

// MASTER 2: The Log Backend (WRITE ONLY)
const LOG_SS_ID = "1CdWzQtH64kF6x5FIU9_KMBRHRBun0O70F7h228oPn8M";

// ARCHIVE: SignOS_Archives Folder
const ARCHIVE_FOLDER_ID = "1IKajBC34p-El-Lz32P0OqWoXMjaGf9Nj";

// CONTEXT: SignOS Dev Folder
const CONTEXT_FOLDER_ID = "1BtnKSEYbOzFz-yO13_IaKnifLAtlpLJP";

// CONTEXT: admin_cost_matrix.html BACKUP Folder
const BACKUP_FOLDER_ID = "137hLX294etbwgrT-bK2hUV0_Lr8iFi43";

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

    // 6. NotebookLM Bridges
    if (params.req === "sync_codebase") return generateNotebookLMBridge();
    if (params.req === "sync_backend") return generateBackendContext();

    // 7. DEFAULT: Matrix Config Fetch (Fallthrough)
    return fetchProductWithMatrix(params.tab || "PROD_Yard_Signs");
}

// ==========================================
//  CORE DATA FUNCTIONS
// ==========================================

function handleAuth(pin) {
    const sheet = SpreadsheetApp.openById(DATA_SS_ID).getSheetByName("Master_Staff");
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]) === String(pin)) { // Col G (Access_PIN)
            const isActive = (data[i][2] === true || String(data[i][2]).toUpperCase() === "TRUE");
            
            if (!isActive) return returnJSON({ status: "fail", message: "Account Disabled" });

            return returnJSON({
                status: "success",
                name: data[i][3],
                role: data[i][4],
                permissions: {
                    roadmap: data[i][5] || "None",
                    backup: data[i][6] || "None"
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

        const headers = values; 
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
            const key = row; // Col A
            const val = row[3]; // Col B
            if (key && String(key).trim() !== "") config[key] = val;
        });

        return returnJSON(config);
    } catch (err) { return returnJSON({ error: err.toString() }); }
}

// ==========================================
//  MATRIX INTEGRATION ENGINE (v7.1)
// ==========================================

function fetchProductWithMatrix(tabName) {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    let config = {};

    // 1. Fetch Standard Product Data (Legacy Support)
    try {
        const prodSheet = ss.getSheetByName(tabName);
        if (prodSheet) {
            const data = prodSheet.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                const key = data[i]; // Col A (Variable Name)
                const val = data[i][3]; // Col B (Value)
                if (key) config[key] = val;
            }
        }
    } catch(e) { console.warn("Legacy fetch failed: " + e); }

    // 2. Fetch Matrix Overrides
    try {
        const matrixSheet = ss.getSheetByName("SYS_Cost_Matrix");
        const defSheet = ss.getSheetByName("REF_Cost_Definitions");
        if (matrixSheet && defSheet) {
            const mData = matrixSheet.getDataRange().getValues();
            const dData = defSheet.getDataRange().getValues();
            const productID = tabName.replace("_Signs", "").replace("_Calculator", "");
            
            const headers = mData; 
            const colIdx = headers.findIndex(h => h === productID || h === tabName);

            if (colIdx > -1) {
                const defMap = {};
                for (let i = 1; i < dData.length; i++) {
                    if(dData[i] && dData[i]) defMap[dData[i]] = dData[i][4]; // Key: Col A, Value: Col F
                }
                for (let r = 1; r < mData.length; r++) {
                    const costKey = mData[r]; 
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

    // 3. Fetch Master_Retail_Blue_Sheet (Yield Bounding Box Injection)
    try {
        const blueSheet = ss.getSheetByName("Master_Retail_Blue_Sheet");
        if (blueSheet) {
            const bData = blueSheet.getDataRange().getValues();
            for (let i = 1; i < bData.length; i++) {
                const key = bData[i]; // Col A (Retail_Key)
                if (key && typeof key === 'string') {
                    config[`${key}_1`] = bData[i][4];  // Col F (Price_Qty_1)
                    config[`${key}_10`] = bData[i][1]; // Col G (Price_Qty_10_Plus)
                }
            }
        }
    } catch(e) { console.warn("Blue Sheet fetch failed: " + e); }

    return returnJSON(config);
}

// ==========================================
//  MATRIX BATCH ENGINE (Stage & Commit)
// ==========================================

function commitMatrixBatch(p) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000);
        const ss = SpreadsheetApp.openById(DATA_SS_ID);
        const sheet = ss.getSheetByName("SYS_Cost_Matrix");
        
        // 1. CREATE BACKUP
        const currentData = sheet.getDataRange().getValues();
        const backupName = `BACKUP_Matrix_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
        const backupFolder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
        backupFolder.createFile(backupName, JSON.stringify(currentData), MimeType.PLAIN_TEXT);

        // 2. PARSE & APPLY UPDATES
        const updates = JSON.parse(p.payload);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues();
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

        // 3. LOG ACTIVITY
        logActivity({
            user: p.user, action: "MATRIX_COMMIT", target: "SYS_Cost_Matrix",
            meta: `Batch Updated ${successCount} records. Backup: ${backupName}`, req: "commit_matrix"
        });

        return returnJSON({ status: "success", backup: backupName, count: successCount });
    } catch (e) {
        return returnJSON({ status: "error", message: e.toString() });
    } finally {
        lock.releaseLock();
    }
}

function updateMatrixValue(p) {
    try {
        const ss = SpreadsheetApp.openById(DATA_SS_ID);
        const sheet = ss.getSheetByName("SYS_Cost_Matrix");
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();

        const headers = sheet.getRange(1, 1, 1, lastCol).getValues();
        const rowIds = sheet.getRange(1, 1, lastRow, 1).getValues().flat();

        const colIndex = headers.indexOf(p.product_id);
        const rowIndex = rowIds.indexOf(p.cost_id);

        if (colIndex === -1 || rowIndex === -1) throw new Error("Invalid Product or Cost ID coordinates.");

        let val = p.value;
        if (val === 'TRUE') val = true;
        if (val === 'FALSE') val = false;

        sheet.getRange(rowIndex + 1, colIndex + 1).setValue(val);

        logActivity({ user: p.user, action: "MATRIX_UPDATE", target: `${p.product_id} -> ${p.cost_id}`, meta: `Changed to ${val}`, req: "update_matrix" });
        return returnJSON({ status: "success", new_value: val });
    } catch (e) { return returnJSON({ status: "error", message: e.toString() }); }
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
        const pHeaders = pData;
        let ticket = null;

        for(let i=1; i<pData.length; i++) {
            if(String(pData[i]) === String(ticketId)) {
                ticket = {};
                pHeaders.forEach((h, idx) => ticket[h] = pData[i][idx]);
                break;
            }
        }
        if(!ticket) return returnJSON({ status: "error", message: "Ticket not found" });

        const cData = cSheet.getDataRange().getValues();
        const cHeaders = cData;
        const history = [];

        for(let i=1; i<cData.length; i++) {
            if(String(cData[i][3]) === String(ticketId)) { // Col B is Parent_ID
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
            if(String(pData[i]) === String(p.id)) {
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
        if (r[7] && r[7].includes("/d/")) {
            const match = r[7].match(/\/d\/(.+?)\//);
            if(match) fileId = match[3];
        }
        return { date: r, name: r[3], url: r[7], count: r[8], type: r[9], file_id: fileId };
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
        const name = `SignOS_DEV_Log_${isDestructive ? 'AUTO' : 'MANUAL'}_${Date.now()}.txt`;
        const folder = DriveApp.getFolderById(ARCHIVE_FOLDER_ID);
        const file = folder.createFile(name, content);

        const idxSheet = ss.getSheetByName("SYS_Archive_Index");
        idxSheet.appendRow([new Date(), name, file.getUrl(), data.length, isDestructive ? "AUTO" : "MANUAL"]);

        if (isDestructive) logSheet.deleteRows(2, lastRow - 1);
        return { status: "success", url: file.getUrl(), rows_archived: data.length };
    } catch(e) { return { status: "error", message: e.toString() }; }
}

// ==========================================
//  NOTEBOOKLM BRIDGE (v2.0 - Auto-Chunking)
// ==========================================

function generateNotebookLMBridge() {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheet = ss.getSheetByName("SYS_Modules");
    const data = sheet.getDataRange().getValues();

    const repoOwner = "SignStoreERP";
    const repoName = "signos-app";

    let chunks = [];
    let currentContent = `# SIGNOS ERP - MASTER CODEBASE CONTEXT (PART 1)\n**Last Sync:** ${new Date().toString()}\n---\n\n`;
    
    // NotebookLM comfortable chunk size (~300kb / 50k words per file)
    const MAX_CHARS = 300000; 
    let count = 0;
    let fetchedJS = new Set();

    for (let i = 1; i < data.length; i++) {
        const name = data[i][3];      // Display Name
        const fileName = data[i][7];  // File Link

        if (fileName && (fileName.toString().endsWith(".html") || fileName.toString().endsWith(".js"))) {
            try {
                const url = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${fileName}`;
                const content = UrlFetchApp.fetch(url).getContentText();
                const ext = fileName.split('.').pop();
                const lang = ext === 'js' ? 'javascript' : 'html';

                let fileBlock = `## ${name} (${fileName})\n> Source: ${url}\n\n\`\`\`${lang}\n${content}\n\`\`\`\n\n---\n\n`;

                if (currentContent.length + fileBlock.length > MAX_CHARS) {
                    chunks.push(currentContent);
                    currentContent = `# SIGNOS ERP - MASTER CODEBASE CONTEXT (PART ${chunks.length + 1})\n**Last Sync:** ${new Date().toString()}\n---\n\n`;
                }
                currentContent += fileBlock;
                count++;

                // SCAN FOR JAVASCRIPT DEPENDENCIES
                if (lang === 'html') {
                    const scriptRegex = /<script src="([^"]+\.js)"><\/script>/g;
                    let match;
                    while ((match = scriptRegex.exec(content)) !== null) {
                        const jsFileName = match[3];
                        
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
                            } catch(jsErr) {
                                console.warn("Could not fetch dependency: " + jsFileName);
                            }
                        }
                    }
                }
            } catch (e) {}
        }
    }
    chunks.push(currentContent);

    const folder = DriveApp.getFolderById(CONTEXT_FOLDER_ID);

    // Clean up old context files so the folder doesn't get cluttered
    const oldFiles = folder.getFiles();
    while(oldFiles.hasNext()) {
        const f = oldFiles.next();
        if(f.getName().startsWith("SignOS_DEV_Context_Part_") || f.getName() === "SignOS_DEV_Context.txt") {
            f.setTrashed(true);
        }
    }

    chunks.forEach((chunkText, index) => {
        folder.createFile(`SignOS_DEV_Context_Part_${index + 1}.txt`, chunkText, MimeType.PLAIN_TEXT);
    });

    return returnJSON({ status: "success", message: `Synced ${count} files across ${chunks.length} chunks.`, url: folder.getUrl() });
}

// ==========================================
//  NOTEBOOKLM BACKEND DATA BRIDGE
// ==========================================

function generateBackendContext() {
    const ss = SpreadsheetApp.openById(DATA_SS_ID);
    const sheets = ss.getSheets();
    
    let content = "# SIGNOS ERP - BACKEND DATA CONTEXT\n";
    content += `**Last Sync:** ${new Date().toString()}\n`;
    content += `> Note: Automatically generated by the SignOS Data Bridge. Massive log tabs have been excluded to preserve AI token limits.\n---\n\n`;

    const excludeTabs = ["SYS_Changelog", "SYS_Roadmap", "SYS_Roadmap_Actions", "Master_Staff"];

    sheets.forEach(sheet => {
        const sheetName = sheet.getName();
        if (excludeTabs.includes(sheetName)) return;

        const data = sheet.getDataRange().getValues();
        if (data.length === 0 || (data.length === 1 && data.length === 1 && data === "")) return;

        content += `## TAB: ${sheetName}\n`;
        
        for (let r = 0; r < data.length; r++) {
            if (data[r].join("").trim() === "") continue;
            
            content += data[r].map(cell => {
                if (cell instanceof Date) return cell.toLocaleDateString();
                return String(cell).replace(/\n/g, ' ').trim(); 
            }).join(" | ") + "\n";
            
            if (r === 0) {
                content += data[r].map(() => "---").join(" | ") + "\n";
            }
        }
        content += "\n\n";
    });

    const folder = DriveApp.getFolderById(CONTEXT_FOLDER_ID);
    const targetName = "SignOS_DEV_Backend_Context.txt";
    const files = folder.getFilesByName(targetName);
    let fileUrl = "";

    if (files.hasNext()) {
        const file = files.next();
        file.setContent(content);
        fileUrl = file.getUrl();
    } else {
        const file = folder.createFile(targetName, content, MimeType.PLAIN_TEXT);
        fileUrl = file.getUrl();
    }

    return returnJSON({ status: "success", message: `Backend data synced.`, url: fileUrl });
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
        const fileName = data[i][7]; // Col C (File Link)

        if (fileName && fileName.toString().endsWith(".html")) {
            try {
                const devUrl = `https://raw.githubusercontent.com/${repoOwner}/${devRepo}/main/${fileName}`;
                const devHtml = UrlFetchApp.fetch(devUrl).getContentText();
                const devMatch = devHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);

                if (devMatch && devMatch[3]) {
                    sheet.getRange(i + 1, 6).setValue(devMatch[3]); // Dev is Col F
                }
            } catch (e) {}

            try {
                const liveUrl = `https://raw.githubusercontent.com/${repoOwner}/${liveRepo}/main/${fileName}`;
                const liveHtml = UrlFetchApp.fetch(liveUrl).getContentText();
                const liveMatch = liveHtml.match(/<title>.*?((?:v|V)\d+(?:\.\d+)*).*?<\/title>/);

                if (liveMatch && liveMatch[3]) {
                    sheet.getRange(i + 1, 5).setValue(liveMatch[3]); // Live is Col E
                }
            } catch (e) {}
        }
    }
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

// ==========================================
// AUTOMATION WRAPPERS (For Time-Driven Triggers)
// ==========================================

function archiveDailyLogs() {
    try {
        manualExport("502834"); // Simulated SUPER PIN for cron triggers
    } catch(e) { console.error("Auto Archive Failed", e); }
}
