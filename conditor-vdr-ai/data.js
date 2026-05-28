// ============================================================
// Conditor VDR AI — Mock Data Layer
// Simulates a Virtual Data Room for an Indian D2C e-commerce startup.
// Target: "BharatKart Commerce Pvt. Ltd." — D2C Home & Living / Apparel
// Acquirer: Conditor Capital (Series A investor)
// ============================================================

const DEAL = {
  fund: "Conditor Capital",
  target: "BharatKart Commerce Pvt. Ltd.",
  cinNo: "U74999MH2020PTC345678",
  sector: "D2C E-commerce (India)",
  jurisdiction: "India (MCA / RoC Maharashtra)",
  dealStage: "Series A Due Diligence",
  reportingCurrency: "INR (₹)",
};

// ---- Folder tree (Google Drive style) -----------------------
const TREE = {
  id: "root",
  name: "BharatKart Commerce Pvt. Ltd. — Data Room",
  type: "folder",
  children: [
    {
      id: "f1", name: "Overview", type: "folder", children: [
        { id: "d1",  name: "Company Deck.pdf",              type: "doc", docType: "legal",     size: "4.2 MB", modified: "2026-04-10", pages: 38 },
        { id: "d2",  name: "Financial Model.xlsx",          type: "doc", docType: "financial", size: "340 KB", modified: "2026-04-15", pages: 1  },
        { id: "d3",  name: "Cap Table.xlsx",                type: "doc", docType: "captable",  size: "48 KB",  modified: "2026-04-12", pages: 1  },
        { id: "d4",  name: "Investor FAQ.pdf",              type: "doc", docType: "legal",     size: "620 KB", modified: "2026-04-08", pages: 14 },
        { id: "d5",  name: "Latest Investor Update.pdf",    type: "doc", docType: "legal",     size: "1.1 MB", modified: "2026-04-05", pages: 18 },
        { id: "d6",  name: "Key Business KPIs.xlsx",        type: "doc", docType: "financial", size: "92 KB",  modified: "2026-04-18", pages: 1  },
      ]
    },
    {
      id: "f2", name: "Company and Compliance", type: "folder", children: [
        {
          id: "f2a", name: "Corporate and Governance", type: "folder", children: [
            { id: "d7",  name: "Certificate of Incorporation.pdf",  type: "doc", docType: "legal", size: "180 KB", modified: "2020-09-14", pages: 2  },
            { id: "d8",  name: "PAN.pdf",                           type: "doc", docType: "legal", size: "40 KB",  modified: "2020-09-20", pages: 1  },
            { id: "d9",  name: "GST Certificate.pdf",               type: "doc", docType: "tax",   size: "55 KB",  modified: "2020-11-02", pages: 2  },
            { id: "d10", name: "MoA.pdf",                           type: "doc", docType: "legal", size: "290 KB", modified: "2020-09-14", pages: 22 },
            { id: "d11", name: "AoA.pdf",                           type: "doc", docType: "legal", size: "410 KB", modified: "2020-09-14", pages: 34 },
            { id: "d12", name: "Shareholding Structure.xlsx",       type: "doc", docType: "captable", size: "52 KB", modified: "2026-04-12", pages: 1 },
            { id: "d13", name: "Board Resolutions.pdf",             type: "doc", docType: "legal", size: "340 KB", modified: "2026-03-28", pages: 28 },
            { id: "d14", name: "Shareholder Resolutions.pdf",       type: "doc", docType: "legal", size: "220 KB", modified: "2026-03-28", pages: 16 },
            { id: "d15", name: "ROC Filings.pdf",                   type: "doc", docType: "legal", size: "880 KB", modified: "2025-11-30", pages: 64 },
            { id: "d16", name: "Compliance Calendar.xlsx",          type: "doc", docType: "legal", size: "44 KB",  modified: "2026-04-01", pages: 1  },
            { id: "d17", name: "Internal Approval Matrix.pdf",      type: "doc", docType: "legal", size: "160 KB", modified: "2026-02-14", pages: 8  },
          ]
        },
        {
          id: "f2b", name: "Legal and Compliance", type: "folder", children: [
            { id: "d18", name: "Business Licenses.pdf",              type: "doc", docType: "legal", size: "310 KB", modified: "2025-12-10", pages: 24 },
            { id: "d19", name: "Insurance Policies.pdf",             type: "doc", docType: "legal", size: "420 KB", modified: "2025-10-01", pages: 31 },
            { id: "d20", name: "Vendor Agreements.pdf",              type: "doc", docType: "legal", size: "740 KB", modified: "2026-01-15", pages: 58 },
            { id: "d21", name: "Warehouse Leases.pdf",               type: "doc", docType: "legal", size: "650 KB", modified: "2025-09-22", pages: 47 },
            { id: "d22", name: "Technology and SaaS Agreements.pdf", type: "doc", docType: "legal", size: "510 KB", modified: "2026-02-28", pages: 39 },
          ]
        },
      ]
    },
    {
      id: "f3", name: "Business and Operations", type: "folder", children: [
        {
          id: "f3a", name: "Business Overview", type: "folder", children: [
            { id: "d23", name: "Operational Workflow.pdf",     type: "doc", docType: "commercial", size: "2.1 MB", modified: "2026-03-14", pages: 26 },
            { id: "d24", name: "Supply Chain Overview.pdf",    type: "doc", docType: "commercial", size: "1.8 MB", modified: "2026-03-14", pages: 21 },
          ]
        },
        {
          id: "f3b", name: "Product Vendor and Operations", type: "folder", children: [
            {
              id: "f3b1", name: "Product and Catalog", type: "folder", children: [
                { id: "d25", name: "Product Categories.pdf",  type: "doc", docType: "commercial", size: "3.4 MB", modified: "2026-04-01", pages: 44 },
                { id: "d26", name: "Product Roadmap.pdf",     type: "doc", docType: "commercial", size: "1.6 MB", modified: "2026-04-01", pages: 18 },
              ]
            },
            {
              id: "f3b2", name: "Vendor and Procurement", type: "folder", children: [
                { id: "d27", name: "Vendor Partnerships.pdf", type: "doc", docType: "commercial", size: "920 KB", modified: "2026-02-20", pages: 36 },
              ]
            },
          ]
        },
        {
          id: "f3c", name: "Sales Growth and Analytics", type: "folder", children: [
            {
              id: "f3c1", name: "Revenue Analytics", type: "folder", children: [
                { id: "d28", name: "Revenue Analytics.xlsx",  type: "doc", docType: "financial", size: "180 KB", modified: "2026-04-18", pages: 1 },
              ]
            },
            {
              id: "f3c2", name: "Customer and Retention", type: "folder", children: [
                { id: "d29", name: "Customer Cohorts and Retention.xlsx", type: "doc", docType: "financial", size: "220 KB", modified: "2026-04-18", pages: 1 },
              ]
            },
          ]
        },
      ]
    },
    {
      id: "f4", name: "Financials", type: "folder", children: [
        {
          id: "f4a", name: "Latest", type: "folder", children: [
            { id: "d30", name: "Latest Monthly Financials.xlsx", type: "doc", docType: "financial", size: "96 KB",  modified: "2026-04-18", pages: 1 },
          ]
        },
        {
          id: "f4b", name: "Historical Financials", type: "folder", children: [
            { id: "d31", name: "PnL.xlsx",           type: "doc", docType: "financial", size: "110 KB", modified: "2026-04-10", pages: 1 },
            { id: "d32", name: "Balance Sheet.xlsx", type: "doc", docType: "financial", size: "88 KB",  modified: "2026-04-10", pages: 1 },
            { id: "d33", name: "Cash Flow.xlsx",     type: "doc", docType: "financial", size: "74 KB",  modified: "2026-04-10", pages: 1 },
          ]
        },
        {
          id: "f4c", name: "Tax Compliance and Banking", type: "folder", children: [
            {
              id: "f4c1", name: "Tax Filings", type: "folder", children: [
                { id: "d34", name: "GST Returns.pdf", type: "doc", docType: "tax", size: "640 KB", modified: "2026-01-20", pages: 48 },
                { id: "d35", name: "TDS Returns.pdf", type: "doc", docType: "tax", size: "380 KB", modified: "2026-01-20", pages: 28 },
              ]
            },
            {
              id: "f4c2", name: "Audit and Compliance", type: "folder", children: [
                { id: "d36", name: "Audit Reports.pdf", type: "doc", docType: "tax", size: "1.4 MB", modified: "2025-09-30", pages: 72 },
              ]
            },
          ]
        },
        {
          id: "f4d", name: "Unit Economics and Working Capital", type: "folder", children: [
            { id: "d37", name: "SKU Profitability.xlsx", type: "doc", docType: "financial", size: "130 KB", modified: "2026-04-15", pages: 1 },
          ]
        },
      ]
    },
    {
      id: "f5", name: "Fundraising", type: "folder", children: [
        {
          id: "f5a", name: "Fundraising History and Legal", type: "folder", children: [
            { id: "d38", name: "Previous Rounds.pdf", type: "doc", docType: "legal",    size: "480 KB", modified: "2025-06-10", pages: 34 },
            { id: "d39", name: "SHA.pdf",             type: "doc", docType: "legal",    size: "720 KB", modified: "2025-06-10", pages: 58 },
            { id: "d40", name: "SSA.pdf",             type: "doc", docType: "legal",    size: "840 KB", modified: "2025-06-10", pages: 66 },
          ]
        },
        {
          id: "f5b", name: "Investor Communication", type: "folder", children: [
            { id: "d41", name: "Investor Updates.pdf", type: "doc", docType: "legal", size: "2.8 MB", modified: "2026-04-05", pages: 72 },
          ]
        },
      ]
    },
    {
      id: "f6", name: "Archive", type: "folder", children: [
        { id: "d42", name: "Historical Documents.zip", type: "doc", docType: "legal", size: "18.4 MB", modified: "2025-01-15", pages: null },
      ]
    },
  ]
};

// ---- Rich document content (what the "AI" reads) ------------
const DOC_CONTENT = {
  d2: {
    title: "Financial Model (FY2022–FY2025E)",
    body: `BHARATKART COMMERCE PVT. LTD. — FINANCIAL MODEL
3-Year Actuals + FY2025E Projection (₹ Lakhs)

PROFIT & LOSS SUMMARY
                              FY2022    FY2023    FY2024    FY2025E
Net Revenue                    280       520       842      1,280
Cost of Goods Sold            (176)     (317)     (486)     (691)
Gross Profit                   104       203       356       589
Gross Margin %                37.1%     39.0%     42.3%     46.0%

Employee Costs                 (68)     (104)     (128)     (172)
Marketing & Advertising        (88)     (116)      (94)     (140)
Technology & Platform          (20)      (27)      (31)      (42)
G&A / Overheads                (70)      (84)      (47)      (87)
EBITDA                         (42)      (28)        56       148
EBITDA Margin %              -15.0%     -5.4%      6.6%     11.6%

Depreciation & Amortisation    (12)      (15)      (18)      (24)
EBIT                           (54)      (43)        38       124
Finance Costs / Interest        (8)      (11)      (12)      (14)
Profit Before Tax              (62)      (54)        26       110
Tax                              0         0        (9)      (36)
Profit After Tax (PAT)         (62)      (54)        17        74

KEY METRICS
GMV (₹ Lakhs)                  340       640      1,050     1,600
Returns & Cancellations %       18%       19%       20%       20%
Avg Order Value (₹)            890     1,020     1,240     1,380
Monthly Active Customers     2,800     5,400     9,200    14,500
CAC (₹)                        820       640       450       360
LTV (₹)                      1,200     1,680     2,200     3,100

CHANNEL MIX (% of Net Revenue)
Own Website / App (D2C)        28%       33%       38%       42%
Amazon                         40%       38%       35%       32%
Flipkart                       26%       23%       21%       20%
Others                          6%        6%        6%        6%

Note: FY2025E based on run-rate as at March 2026 plus seasonal Q4 uplift. Series A target: ₹1,500 Lakhs ARR by Dec 2026.`,
  },

  d3: {
    title: "Cap Table (April 2026)",
    body: `BHARATKART COMMERCE PVT. LTD. — CAPITALISATION TABLE (as at 12 Apr 2026)
Share class: Equity shares ₹10 face value. Total issued: 1,00,00,000 shares (1 Crore).

SHAREHOLDER                              SHARES       %
Rahul Sharma (Co-founder & CEO)       28,00,000    28.0%
Priya Mehta (Co-founder & CTO)        25,00,000    25.0%
Vikram Nair (Angel, 2021)              3,00,000     3.0%
Anita Reddy (Angel, 2021)              2,50,000     2.5%
Siddharth Joshi (Angel, 2021)          2,50,000     2.5%
Matrix Partners India (Seed, 2022)    20,00,000    20.0%
ESOP Pool (granted)                    9,00,000     9.0%
ESOP Pool (available — ungranted)      3,00,000     3.0%
Secondary reserved (Series A)          7,00,000     7.0%
TOTAL                              1,00,00,000   100.0%

Round History:
- Angel Round (Sep 2021): ₹1.2 Cr raised at ₹8 Cr pre-money. 8% dilution.
- Seed Round (Mar 2022): ₹5 Cr raised at ₹20 Cr pre-money. 20% dilution (Matrix Partners India lead).

Proposed Series A:
- Target raise: ₹20–25 Cr at ₹80–100 Cr pre-money valuation.
- Post-Series A founders combined: ~42% (diluted), ESOP pool to be topped up to 12%.

Anti-dilution: Matrix Partners India holds broad-based weighted average anti-dilution.
Drag-along: 51% shareholder vote. Tag-along: pro-rata rights for all shareholders.

Note: Co-founders retain majority voting control post-Series A.`,
  },

  d28: {
    title: "Revenue Analytics (FY2024 Full Year)",
    body: `BHARATKART COMMERCE PVT. LTD. — REVENUE ANALYTICS FY2024 (₹ Lakhs)

TOTAL GMV                              1,050
Returns & Cancellations                 (208)
Net Revenue                              842

BY CHANNEL
Own Website / App (D2C)                  320   38%
Marketplace — Amazon                     295   35%
Marketplace — Flipkart                   177   21%
Marketplace — Others (Meesho, Nykaa)      50    6%

BY CATEGORY
Home & Living                            378   44.9%
Apparel & Accessories                    252   29.9%
Electronics & Gadgets                    143   17.0%
Others / Multi-category bundles           69    8.2%

CUSTOMER METRICS
Total orders fulfilled                84,200
Avg Order Value — D2C                 ₹1,480
Avg Order Value — Marketplace         ₹1,120
New customers acquired                 18,600
Repeat customers (2+ orders/yr)         7,400   28.5% of active base

SEASONAL PATTERN
Q1 (Apr–Jun): 22% of annual revenue
Q2 (Jul–Sep): 21% of annual revenue
Q3 (Oct–Dec): 31% of annual revenue  ← peak (Diwali + year-end)
Q4 (Jan–Mar): 26% of annual revenue

Repeat Customer Revenue %: 31.4%
New Customer Revenue %: 68.6%
Avg Order Value (blended): ₹1,240

Note: D2C channel growing fastest (+44% YoY); marketplace commissions compress gross margin by ~8pp vs D2C.`,
  },

  d29: {
    title: "Customer Cohorts and Retention",
    body: `BHARATKART COMMERCE PVT. LTD. — CUSTOMER COHORT ANALYSIS (as at Apr 2026)

6-MONTH RETENTION BY COHORT
Acquisition Quarter    M0     M1     M2     M3     M4     M5     M6
Q1 FY2022 (Apr–Jun)   100%   38%    29%    24%    20%    18%    16%
Q2 FY2022             100%   40%    31%    25%    21%    19%    17%
Q3 FY2022 (peak)      100%   42%    33%    27%    23%    21%    19%
Q1 FY2024             100%   46%    37%    31%    27%    24%    22%
Q3 FY2024 (Diwali)    100%   51%    42%    36%    31%    —      —

Trend: retention improving ~2pp/cohort as loyalty programme matures.

UNIT ECONOMICS (FY2024 average)
CAC (blended)                        ₹450
LTV (projected 24-month)           ₹2,200
LTV:CAC ratio                         4.9x
Payback period                       5.8 months

CAC by channel:
- D2C (performance mktg)            ₹320
- Amazon sponsored ads              ₹510
- Flipkart ads                      ₹580
- Organic / referral                 ₹90

TOP CUSTOMER SEGMENTS (by order frequency)
Power buyers (≥6 orders/yr):         4.1% of base, 18% of revenue
Regular (3–5 orders/yr):            14.2% of base, 29% of revenue
Occasional (1–2 orders/yr):         81.7% of base, 53% of revenue

Flag: Top 10% of customers contribute 47% of total revenue — concentration risk.`,
  },

  d30: {
    title: "Latest Monthly Financials — March 2026",
    body: `BHARATKART COMMERCE PVT. LTD. — MANAGEMENT ACCOUNTS
Month: March 2026 | YTD: April 2025 – March 2026 (₹ Lakhs)

                              Mar 2026    YTD FY2026
Net Revenue                      118          1,120
Cost of Goods Sold               (65)          (609)
Gross Profit                      53            511
Gross Margin %                  44.9%          45.6%

Employee Costs                   (15)          (173)
Marketing & Advertising          (11)          (128)
Technology & Platform             (4)           (46)
G&A / Overheads                   (9)           (96)
EBITDA                            14             68
EBITDA Margin %                 11.9%           6.1%

Depreciation & Amortisation       (2)           (24)
EBIT                              12             44
Finance Costs / Interest          (1)           (14)
Profit Before Tax                 11             30
Tax                               (4)           (10)
Profit After Tax (PAT)             7             20

BALANCE SHEET SNAPSHOT (Mar 2026)
Cash & Bank                       82
Inventory                        148
Trade Receivables                 64
Total Current Assets             294
Fixed Assets (net)                76
Total Assets                     370

Accounts Payable                 (94)
Working Capital (net)            218

Note: March is seasonally strong (end of financial year, clearance sales). Annualised revenue run-rate ~₹1,416 Lakhs.`,
  },

  d31: {
    title: "Historical P&L (FY2022–FY2024)",
    body: `BHARATKART COMMERCE PVT. LTD. — PROFIT & LOSS (₹ Lakhs)
Prepared by management. FY2022 and FY2023 per audited accounts. FY2024 per audited accounts.

                              FY2022    FY2023    FY2024
Net Revenue                    280       520       842
Cost of Goods Sold            (176)     (317)     (486)
Gross Profit                   104       203       356
Gross Margin %                37.1%     39.0%     42.3%

Employee Costs                 (68)     (104)     (128)
Marketing & Advertising        (88)     (116)      (94)
Technology & Platform          (20)      (27)      (31)
G&A / Overheads                (70)      (84)      (47)
EBITDA                         (42)      (28)        56
EBITDA Margin %              -15.0%     -5.4%      6.6%

Depreciation & Amortisation    (12)      (15)      (18)
EBIT                           (54)      (43)        38
Finance Costs / Interest        (8)      (11)      (12)
Profit Before Tax              (62)      (54)        26
Tax                              0         0        (9)
Profit After Tax (PAT)         (62)      (54)        17

Note: FY2022–FY2023 losses funded by seed capital. First profitable year FY2024. EBITDA margin expected to expand to ~12% in FY2026 with revenue operating leverage.`,
  },

  d32: {
    title: "Balance Sheet (FY2024)",
    body: `BHARATKART COMMERCE PVT. LTD. — BALANCE SHEET (as at 31 Mar 2025, ₹ Lakhs)

ASSETS
Non-Current Assets
  Property, Plant & Equipment (net)      68
  Intangible assets (software/IP)         22
  Long-term deposits                      12
Total Non-Current Assets                 102

Current Assets
  Inventories                            138
  Trade receivables                       58
  Cash and bank balances                  74
  Prepayments & other current assets      18
Total Current Assets                     288

TOTAL ASSETS                             390

EQUITY & LIABILITIES
Equity
  Share capital (₹10 face value, 1 Cr shares)  100
  Securities premium                     498
  Retained earnings / (accumulated loss) (481)
Total Equity                             117

Non-Current Liabilities
  Term loan (HDFC Bank)                   80
  Deferred revenue                         8
Total Non-Current Liabilities             88

Current Liabilities
  Trade payables                         112
  Other current liabilities               48
  Short-term borrowings (NBFC WC line)    25
Total Current Liabilities                185

TOTAL EQUITY & LIABILITIES               390

Note: Accumulated losses reflect pre-profitability investment phase. Net debt: ₹31 Lakhs (cash ₹74L vs debt ₹105L).`,
  },

  d33: {
    title: "Cash Flow Statement (FY2024)",
    body: `BHARATKART COMMERCE PVT. LTD. — CASH FLOW STATEMENT FY2024 (₹ Lakhs)

Opening Cash Balance (Apr 2024)           62

OPERATING ACTIVITIES
EBITDA                                    56
Working Capital Movement                 (22)
  Inventory increase                     (18)
  Receivables increase                   (12)
  Payables increase                        8
Tax Paid                                  (8)
Net Cash from Operations                  26

INVESTING ACTIVITIES
Capex (tech infra + warehouse fit-out)   (22)
Long-term deposit (new warehouse)         (6)
Net Cash from Investing                  (28)

FINANCING ACTIVITIES
Equity Raised (Seed round top-up)          0
Term Loan Drawdown                        20
Term Loan Repayment                      (16)
Working Capital Line (net)                10
Net Cash from Financing                   14

Closing Cash Balance (Mar 2025)           74
Free Cash Flow (Ops - Capex)               4

Note: Cash generation turned positive in FY2024. WC line used seasonally for Q3 Diwali inventory build. Runway at current burn: 14+ months.`,
  },

  d37: {
    title: "SKU Profitability — Unit Economics (FY2024)",
    body: `BHARATKART COMMERCE PVT. LTD. — SKU PROFITABILITY ANALYSIS FY2024

WEIGHTED AVERAGE ACROSS TOP 50 SKUs (per unit sold)

                                       D2C      Marketplace   Blended
Avg Selling Price (ASP)              ₹1,480     ₹1,120       ₹1,240
Cost of Goods (COGS per unit)         ₹(720)     ₹(720)      ₹(720)
Gross Margin per unit                  ₹760       ₹400         ₹520
Gross Margin %                         51.4%      35.7%        42.0%

Fulfilment & Logistics cost           ₹(145)     ₹(145)      ₹(145)
Marketplace commission                  ₹—       ₹(168)       ₹(84)
Payment Gateway fees                   ₹(22)      ₹(14)       ₹(17)
Returns & Damage allowance             ₹(62)      ₹(84)       ₹(75)
Marketing / CAC (per unit)            ₹(320)     ₹(530)      ₹(450)
Contribution Margin per unit           ₹211      ₹(541)       ₹(251)

Wait — blended contribution margin below uses full-year amortised marketing:
CAC (per acquired customer)            ₹320       ₹540        ₹450
Avg orders per customer (LTM)            3.2        2.4          2.8
Effective CAC per order                ₹(100)     ₹(225)      ₹(161)

Adjusted Contribution Margin / unit    ₹311      ₹(316)       ₹(89)
Contribution Margin %                  21.0%     -28.2%        -7.2%

Breakeven volume D2C (monthly)        1,800 units at current fixed cost base

BY CATEGORY (blended)
Home & Living                CM% 14.2%    Gross Margin 44.1%
Apparel & Accessories        CM% -3.1%    Gross Margin 40.8%  ← below water on marketplace
Electronics & Gadgets        CM% -12.4%   Gross Margin 36.2%  ← loss-making on marketplace

Flag: Marketplace electronics and apparel categories are contribution-margin negative. Recommend restricting marketplace SKU mix or renegotiating platform fees.`,
  },
};

// ---- The Fund's Request List (Conditor's DD checklist) ------
const FUND_REQUEST_LIST = [
  { id: "r1",  item: "Certificate of Incorporation",            category: "Corporate"    },
  { id: "r2",  item: "MoA and AoA",                            category: "Corporate"    },
  { id: "r3",  item: "PAN and GST Certificate",                category: "Corporate"    },
  { id: "r4",  item: "ROC Filings (last 3 years)",             category: "Corporate"    },
  { id: "r5",  item: "Shareholding Structure / Cap Table",      category: "Corporate"    },
  { id: "r6",  item: "Board and Shareholder Resolutions",       category: "Corporate"    },
  { id: "r7",  item: "Company Deck / Investor Presentation",   category: "Business"     },
  { id: "r8",  item: "Financial Model (3-year projection)",    category: "Financial"    },
  { id: "r9",  item: "Latest Monthly Financials",              category: "Financial"    },
  { id: "r10", item: "Historical P&L (3 years)",               category: "Financial"    },
  { id: "r11", item: "Balance Sheet (latest audited)",         category: "Financial"    },
  { id: "r12", item: "Cash Flow Statement",                    category: "Financial"    },
  { id: "r13", item: "GST Returns (last 4 quarters)",          category: "Tax"          },
  { id: "r14", item: "TDS Returns (last 4 quarters)",          category: "Tax"          },
  { id: "r15", item: "Audit Reports (last 2 years)",           category: "Tax"          },
  { id: "r16", item: "SKU Profitability / Unit Economics",     category: "Financial"    },
  { id: "r17", item: "Revenue Analytics by Channel",          category: "Business"     },
  { id: "r18", item: "Customer Cohort and Retention Analysis", category: "Business"     },
  { id: "r19", item: "Vendor Partnerships (top 10)",           category: "Operations"   },
  { id: "r20", item: "Warehouse Lease Agreements",             category: "Legal"        },
  { id: "r21", item: "Technology and SaaS Agreements",         category: "Legal"        },
  { id: "r22", item: "Previous Round Documents (SHA, SSA)",   category: "Fundraising"  },
  { id: "r23", item: "Investor Updates (last 6 months)",       category: "Fundraising"  },
  { id: "r24", item: "Business Licenses and Permits",          category: "Legal"        },
  { id: "r25", item: "Key Business KPIs Dashboard",            category: "Business"     },
];

// Conditor's internal EBITDA template (retained for UK PE template)
const EBITDA_TEMPLATE_FIELDS = [
  "Revenue",
  "Gross Profit",
  "Operating Profit (EBIT)",
  "Add back: Depreciation",
  "Add back: Amortisation",
  "Reported EBITDA",
  "Add back: Exceptional / restructuring",
  "Add back: Owner discretionary",
  "Adjusted EBITDA",
];

// Pre-built template library for Financial Extract feature
const TEMPLATE_LIBRARY = [
  {
    id: "tpl_pnl_india",
    name: "P&L Summary (India)",
    description: "Revenue → Gross Profit → EBITDA → PAT",
    currency: "₹ Lakhs",
    fields: [
      "Net Revenue",
      "Cost of Goods Sold",
      "Gross Profit",
      "Gross Margin %",
      "Employee Costs",
      "Marketing & Advertising",
      "Technology & Platform",
      "G&A / Overheads",
      "EBITDA",
      "EBITDA Margin %",
      "Depreciation & Amortisation",
      "EBIT",
      "Finance Costs / Interest",
      "Profit Before Tax",
      "Tax",
      "Profit After Tax (PAT)",
    ],
  },
  {
    id: "tpl_ebitda_uk",
    name: "Adjusted EBITDA (UK PE)",
    description: "EBIT + add-backs bridge",
    currency: "£'000",
    fields: [
      "Revenue",
      "Gross Profit",
      "Operating Profit (EBIT)",
      "Add back: Depreciation",
      "Add back: Amortisation",
      "Reported EBITDA",
      "Add back: Exceptional / restructuring",
      "Add back: Owner discretionary",
      "Adjusted EBITDA",
    ],
  },
  {
    id: "tpl_unit_econ",
    name: "Unit Economics",
    description: "Per-SKU contribution margin analysis",
    currency: "₹",
    fields: [
      "Avg Selling Price (ASP)",
      "Cost of Goods (COGS per unit)",
      "Gross Margin per unit",
      "Gross Margin %",
      "Fulfilment & Logistics cost",
      "Marketing / CAC (per unit)",
      "Payment Gateway fees",
      "Returns & Damage allowance",
      "Contribution Margin per unit",
      "Contribution Margin %",
      "Breakeven volume (monthly)",
    ],
  },
  {
    id: "tpl_cashflow",
    name: "Cash Flow Bridge",
    description: "Operating / investing / financing flows",
    currency: "₹ Lakhs",
    fields: [
      "Opening Cash Balance",
      "EBITDA",
      "Working Capital Movement",
      "Tax Paid",
      "Net Cash from Operations",
      "Capex",
      "Acquisitions / Investments",
      "Net Cash from Investing",
      "Equity Raised",
      "Debt Drawdown / Repayment",
      "Net Cash from Financing",
      "Closing Cash Balance",
      "Free Cash Flow (Ops - Capex)",
    ],
  },
  {
    id: "tpl_rev_analytics",
    name: "Revenue Analytics",
    description: "Channel and category breakdown",
    currency: "₹ Lakhs",
    fields: [
      "Total GMV",
      "Returns & Cancellations",
      "Net Revenue",
      "Own Website / App (D2C)",
      "Marketplace — Amazon",
      "Marketplace — Flipkart",
      "Marketplace — Others",
      "Category: Home & Living",
      "Category: Apparel",
      "Category: Electronics",
      "Category: Others",
      "Repeat Customer Revenue %",
      "New Customer Revenue %",
      "Avg Order Value (AOV)",
    ],
  },
];

if (typeof module !== "undefined") {
  module.exports = { DEAL, TREE, DOC_CONTENT, FUND_REQUEST_LIST, EBITDA_TEMPLATE_FIELDS, TEMPLATE_LIBRARY };
}
