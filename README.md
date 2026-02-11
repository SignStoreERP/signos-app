# SignOS: The "Serverless" Sign Shop ERP

**Status:** v3.2 (Stable)  
**Architecture:** Distributed "Waterfall" System  
**Backend:** Google Sheets + Apps Script (Private)  
**Frontend:** HTML5 + Tailwind CSS (Public/GitHub Pages)

---

## 📖 Overview

**SignOS** is a production management and quoting engine designed specifically for the physics of the sign industry. Unlike traditional ERPs that lock pricing logic inside compiled code, SignOS prioritizes **User Sovereignty**.

It utilizes a strict **Separation of Concerns**:
1.  **The Brain (Google Sheets):** Holds all proprietary logic, material costs, labor rates, and markup formulas.
2.  **The API (Apps Script):** A secure gatekeeper that fetches calculated values.
3.  **The Face (This Repo):** "Agnostic" HTML calculators that simply capture user input and display the backend's math.

**This architecture allows shop owners to update material costs, change margins, or adjust machine speeds instantly via a Spreadsheet without writing a single line of code.**

---

## 🚀 Live Application

This repository is hosted via **GitHub Pages**.  
**Access the App:** [https://signstoreerp.github.io/signos-app/](https://signstoreerp.github.io/signos-app/)

*(Note: Access requires a secure PIN authorized in the Master_Staff backend registry.)*

---

## 🏗 System Architecture

SignOS follows the **"Waterfall" Data Hierarchy**:

### Level 1: Master Data (The Source of Truth)
*Private Google Sheet*
*   Defines raw inputs: `Master_Materials`, `Master_Labor_Rates`, `Master_Machines_Fleet`.
*   *Example:* 4mm Coroplast = $11.99/sheet.

### Level 2: Product Logic (The Context Layer)
*Private Google Sheet*
*   Contextualizes raw data for specific products (`PROD_` tabs).
*   Calculates "Cost Basis" and "Retail Price" dynamically using VLOOKUPs.
*   *Example:* A Yard Sign uses 1/10th of a sheet + 5 minutes of labor.

### Level 3: The Frontend (This Repository)
*Public HTML Files*
*   **Dumb Interface:** Contains **zero** math or pricing logic.
*   **Dynamic:** On load, it asks the API: *"What is the current price of a Yard Sign?"*
*   **Secure:** Since no logic is hard-coded, reverse-engineering the business model from the source code is impossible.

---

## 📦 Modules & Calculators

This repository contains the following production modules:

### 🛡️ Rigid Signs
*   **Yard Signs (`YardSign_Calculator.html`):** Bulk logic triggers, stake bundling, and tiered discounts.
*   **Coroplast (`Coro_Calculator.html`):** Sheet-based logic for custom sizes (4mm/10mm) with "Direct Print" vs "Vinyl Mount" workflows.
*   **ACM / Metal (`ACM_Calculator.html`):** Smart logic allowing for CNC Routing setup and "Profit Guard" alerts.
*   **Acrylic (`Acrylic_Calculator.html`):** Advanced linear-print physics (handling 2nd surface, white ink modes, and paint booth labor).

### 🖨️ Roll Media (Wide Format)
*   **Vinyl Banners (`Banner_Calculator.html`):** Physics constraints for 62" print widths, hemming/grommet labor calculation.
*   **Decals (`Decal_Calculator.html`):** Toggles for simple vs. complex weeding and die-cut vs. kiss-cut logic.
*   **Vehicle Wraps (`Wrap_Calculator.html`):** Panel optimization logic and complex-curve installation estimators.
*   **Cut Vinyl (`CutVinyl_Calculator.html`):** Plotter physics and masking labor rates.

---

## ⚙️ Key Features

### 1. The "Make vs. Buy" Dashboard
Every calculator displays three distinct tabs:
*   **RETAIL:** The price the customer sees.
*   **IN-HOUSE:** The exact cost to manufacture (Materials + Labor + Overhead + Risk).
*   **VENDED:** The wholesale cost to outsource (e.g., Signs365), including shipping logic.

### 2. Profit Guard™
The interface proactively protects margins. If a user quotes a job where the **Net Profit is negative** on *both* In-House and Vended tabs, a pulsing **"LOSS ALERT"** banner blocks the user from proceeding.

### 3. Physics-Based Costing
*   **Linear Logic:** Roll printers calculate cost based on linear footage fed through the machine (accounting for 64" bed limits), not just square footage.
*   **Sheet Logic:** Rigid calculators determine how many full 4x8 boards must be pulled from inventory to fulfill the order.

---

## 🛠 Deployment & Updates

### To Update Pricing:
1.  Open the **SignOS Backend** Google Sheet.
2.  Navigate to the `PROD_` tab for the specific product (e.g., `PROD_Vinyl_Banners`).
3.  Change the value (e.g., update `Margin_Target` from `0.7` to `0.75`).
4.  **Done.** The HTML frontend updates instantly for all users on the next refresh.

### To Update the Application:
1.  Commit changes to the `.html` files in this repository.
2.  Push to `main`.
3.  GitHub Pages will automatically rebuild and deploy the live site.

---

## 🔐 Security

*   **Gateway (`Gateway.html`):** Acts as the primary entry point.
*   **Session Storage:** Validates user roles (`ADMIN`, `PROD`, `SALES`) against the `Master_Staff` backend sheet.
*   **Ad-Hoc IP Logging:** Client-side fetch logs access attempts to the secure `SYS_Access_Logs` sheet for audit trails.

---

*Copyright © 2023 SignStoreERP. All Production Logic Reserved.*

