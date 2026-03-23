### 🛠️ SignOS: The "Serverless" Sign Shop ERP (Legacy Version)
**Status:** 🛑 DEPRECATED & MIGRATED
**New Architecture:** Vercel (UI) + Supabase PostgreSQL & Deno Edge Functions (Backend) [1-3]
**Historical Architecture:** Google Sheets API + Apps Script + HTML5/JS [4]
**New Repository:** [SignStoreERP/SignOS-v3-Supabase](https://github.com/SignStoreERP/SignOS-v3-Supabase) [5]

---

#### 📖 Historical Overview
This repository previously housed the **Development Sandbox (`signos-app`)** for the legacy version of the SignOS ERP [4].

SignOS was originally designed as a production management and quoting engine built strictly around the physics of the sign industry [4]. To maintain rapid development without traditional database overhead, this legacy version utilized a highly unconventional but effective "Serverless" architecture [4]:

*   **The Brain (Google Sheets):** Held all proprietary logic, material costs, labor rates, and markup formulas to act as the "Single Source of Truth" [6].
*   **The API (Apps Script):** A secure gatekeeper that fetched calculated values and handled version control [6].
*   **The Face (HTML/JS):** "Agnostic" HTML calculators that contained no pricing math. They simply captured user input and processed the backend's data locally [6].

#### 🏗️ The Legacy "Twin-Engine" Workflow
Because the backend relied on live Google Sheets, we utilized a strict "Twin-Engine" dual-deployment strategy to ensure the sales floor never experienced downtime [6].

1.  **The Sandbox (This Repo):** All experimental development, bug fixes, and feature integrations happened strictly within this repository [7].
2.  **The Storefront (`signos-live`):** Only after code was proven mathematically stable and bug-free via an administrative simulator was it manually cloned to the live repository [7].

#### 🧮 Dual-Track Logic (Physics vs. Retail)
The core innovation of this codebase was the **Separation of Calculation** [7]. The headless JS processed the API payload through two completely distinct mathematical engines simultaneously:

*   **Market Value (Retail Track):** Generated the customer-facing price based strictly on predefined market area curves and square footage, bypassing how the sign was physically built [8].
*   **Physics Engine (Cost Track):** Calculated exact real-world physics, tracking material yield (e.g., 4x8 sheets), machine run limits, and exact ink/labor usage to determine true net profit [8].

#### 🚀 Migration to SignOS v4.0 (Supabase)
As the system grew to support complex 3D rendering, SVG production file generation, and bulk ADA routing matrices, the Google Sheets API reached its operational limits [8].

The entire Level 1 (Master Materials/Labor), Level 1.5 (The Override Matrix), and Level 2 (Product Logic) data hierarchy has been normalized into a relational **PostgreSQL** schema [9]. The business logic contained in this repository's headless `.js` files has been migrated to modern **Deno/TypeScript Edge Functions** to enforce Row Level Security (RLS) and faster compute times [1, 2, 9].

*(Note: The legacy Apps Script API webhooks for this repository have been decommissioned. Any stray POST requests will now return a `DEPRECATED_SYSTEM` error blocker. If you are looking for the active SignOS ERP, please visit the new secure gateway at [https://signos-v3-supabase.vercel.app/](https://signos-v3-supabase.vercel.app/)).*