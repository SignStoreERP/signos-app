# 🛠️ SignOS: The "Serverless" Sign Shop ERP

**Status:** v3.5 (Dev/Staging)  
**Architecture:** Distributed "Twin-Engine" System  
**Backend:** Google Sheets + Apps Script (The Brain)  
**Frontend:** HTML5 + Tailwind CSS (The Face)  

---

## 📖 Overview
SignOS is a production management and quoting engine designed specifically for the physics of the sign industry. Unlike traditional ERPs that lock pricing logic inside compiled code, SignOS prioritizes **User Sovereignty**.

It utilizes a strict **Separation of Concerns**:
1.  **The Brain (Google Sheets):** Holds all proprietary logic, material costs, labor rates, and markup formulas.
2.  **The API (Apps Script):** A secure gatekeeper that fetches calculated values and handles version control.
3.  **The Face (This Repo):** "Agnostic" HTML calculators that simply capture user input and display the backend's math.

---

## 🏗️ The "Twin-Engine" Workflow
We utilize a dual-deployment strategy to ensure stability while allowing rapid innovation.

### 1. Development Engine (`signos-app`)
*   **Role:** Experimental Sandbox & Staging.
*   **Behavior:** Code pushed here is automatically scanned by our **Version Crawler**. The system reads the `<title>` tag of HTML files and updates the `Dev_Ver` column in the backend instantly.
*   **Webhook Tag:** `[DEV]` in System History.

### 2. Production Engine (`signos-live`)
*   **Role:** Stable Client-Facing Portal.
*   **Behavior:** Only validated, bug-free modules are manually copied here. Pushing to this repo triggers the `[LIVE]` tag in the history logs and updates the `Live_Ver` column in the backend.

---

## 🏗 System Architecture: The Waterfall
SignOS follows a strictly hierarchical data flow:

### Level 1: Master Data (The Source of Truth)
*   *Private Google Sheet*
*   Defines raw inputs: `Master_Materials` (Cost per sheet), `Master_Labor_Rates` (Hourly wages), `Master_Machines_Fleet` (Print speeds).
*   *Example:* 4mm Coroplast = $11.99/sheet.

### Level 2: Product Logic (The Context Layer)
*   *Private Google Sheet (PROD_ Tabs)*
*   Contextualizes raw data for specific products. Calculates "Cost Basis" and "Retail Price" dynamically using VLOOKUPs.
*   *Example:* A Yard Sign uses 1/10th of a sheet + 5 minutes of labor + 5% risk buffer.

### Level 3: The API & Automation
*   *Google Apps Script (`Code.gs`)*
*   **The Listener:** A Webhook that logs every GitHub commit to `SYS_Changelog` in real-time.
*   **The Crawler:** Automatically syncs version numbers from HTML code to the Spreadsheet.

### Level 4: The Frontend (This Repo)
*   *Public HTML Files*
*   **Dumb Interface:** Contains **zero** math or pricing logic.
*   **Dynamic:** On load, it asks the API: *"What is the current price of a Yard Sign?"*

---

## 📦 Modules & Physics Engines
This repository contains the following production modules:

### 🛡️ Rigid Signs
*   **Yard Signs:** Features bulk logic triggers (Qty > 1100), stake bundling, and tiered fixed-price discounts.
*   **Coroplast:** Handles "Direct Print" vs "Vinyl Mount" workflows based on material thickness (4mm vs 10mm).
*   **ACM / Metal:** Smart logic for CNC Routing setup, separating "Shear Cut" labor from "Contour Cut" machine time.
*   **Acrylic:** Advanced linear-print physics (handling 2nd surface, white ink modes, and paint booth labor).

### 🖨️ Roll Media
*   **Vinyl Banners:** Physics constraints for 62" print widths, hemming/grommet labor calculation, and wind slit logic.
*   **Decals:** Toggles for simple vs. complex weeding and die-cut vs. kiss-cut logic.
*   **Vehicle Wraps:** Panel optimization logic (54" media overlap) and complex-curve installation estimators.
*   **Cut Vinyl:** Plotter physics and masking labor rates.

---

## ⚙️ Key Features

### 1. The "Make vs. Buy" Dashboard
Every calculator displays three distinct tabs:
*   **RETAIL:** The price the customer sees (Market Value).
*   **IN-HOUSE:** The exact cost to manufacture (Materials + Labor + Overhead + Risk).
*   **VENDED:** The wholesale cost to outsource (e.g., Signs365), including shipping logic.

### 2. Profit Guard™
The interface proactively protects margins. If a user quotes a job where the Net Profit is negative on *both* In-House and Vended tabs, a pulsing **"LOSS ALERT"** banner blocks the user from proceeding.

### 3. Physics-Based Costing
*   **Linear Logic:** Roll printers calculate cost based on linear footage fed through the machine (accounting for 64" bed limits), not just square footage.
*   **Sheet Logic:** Rigid calculators determine how many full 4x8 boards must be pulled from inventory to fulfill the order.

---

## 🛠 Deployment & Updates

### To Update Pricing:
1.  Open the SignOS Backend Google Sheet.
2.  Navigate to the `PROD_` tab (e.g., `PROD_Yard_Signs`).
3.  Change the value (e.g., update `Retail_Price_Sign_SS` from 12 to 15).
4.  *Done.* The HTML frontend updates instantly for all users on the next refresh.

### To Update the Application:
1.  Commit changes to the `.html` files in this repository.
2.  Push to `main`.
3.  The API will automatically log the change and update the version number in the Backend.

---
*Copyright © 2026 SignStoreERP. All Production Logic Reserved.*
