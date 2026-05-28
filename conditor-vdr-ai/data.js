// ============================================================
// Conditor VDR AI — Mock Data Layer
// Simulates a Google Drive Virtual Data Room for a UK PE deal.
// Target: "Meridian Facilities Group Ltd" — UK B2B services rollup
// Acquirer: Conditor Capital LLP (UK lower-mid-market PE)
// ============================================================

const DEAL = {
  fund: "Conditor Capital LLP",
  target: "Meridian Pvt. Ltd.",
  companiesHouseNo: "08842197",
  sector: "B2B Facilities Management (UK)",
  jurisdiction: "England & Wales",
  dealStage: "Confirmatory Due Diligence",
  reportingCurrency: "GBP (£)",
};

// ---- Folder tree (Google Drive style) -----------------------
// type: folder | doc ; docType drives icon + summariser behaviour
const TREE = {
  id: "root",
  name: "Meridian Pvt. Ltd. — Data Room",
  type: "folder",
  children: [
    {
      id: "f1", name: "01. Corporate & Legal", type: "folder", children: [
        { id: "d1", name: "Certificate of Incorporation.pdf", type: "doc", docType: "legal", size: "120 KB", modified: "2025-11-02", pages: 2 },
        { id: "d2", name: "Articles of Association.pdf", type: "doc", docType: "legal", size: "340 KB", modified: "2025-10-28", pages: 24 },
        { id: "d3", name: "Statutory Registers (Members & Directors).pdf", type: "doc", docType: "legal", size: "210 KB", modified: "2025-11-10", pages: 18 },
        { id: "d4", name: "Cap Table — Nov 2025.xlsx", type: "doc", docType: "captable", size: "44 KB", modified: "2025-11-15", pages: 1 },
        { id: "d5", name: "Companies House Filing History.pdf", type: "doc", docType: "legal", size: "88 KB", modified: "2025-11-12", pages: 6 },
      ]
    },
    {
      id: "f2", name: "02. Financial Information", type: "folder", children: [
        { id: "d6", name: "Audited Accounts FY2023.pdf", type: "doc", docType: "financial", size: "1.2 MB", modified: "2024-03-30", pages: 38 },
        { id: "d7", name: "Audited Accounts FY2024.pdf", type: "doc", docType: "financial", size: "1.3 MB", modified: "2025-03-28", pages: 41 },
        { id: "d8", name: "Management Accounts — YTD Oct 2025.xlsx", type: "doc", docType: "financial", size: "96 KB", modified: "2025-11-08", pages: 1 },
        { id: "d9", name: "FY2026 Budget & Forecast.xlsx", type: "doc", docType: "financial", size: "120 KB", modified: "2025-11-01", pages: 1 },
        { id: "d10", name: "Aged Debtors & Creditors.xlsx", type: "doc", docType: "financial", size: "52 KB", modified: "2025-11-09", pages: 1 },
      ]
    },
    {
      id: "f3", name: "03. Commercial", type: "folder", children: [
        { id: "d11", name: "Top 20 Customer Contracts (summary).pdf", type: "doc", docType: "commercial", size: "640 KB", modified: "2025-10-30", pages: 22 },
        { id: "d12", name: "Customer Concentration Analysis.xlsx", type: "doc", docType: "commercial", size: "38 KB", modified: "2025-11-05", pages: 1 },
        { id: "d13", name: "Pipeline & CRM Export.xlsx", type: "doc", docType: "commercial", size: "210 KB", modified: "2025-11-11", pages: 1 },
      ]
    },
    {
      id: "f4", name: "04. HR & Pensions", type: "folder", children: [
        { id: "d14", name: "Employee Census & Org Chart.xlsx", type: "doc", docType: "hr", size: "72 KB", modified: "2025-11-06", pages: 1 },
        { id: "d15", name: "Key Employee Service Agreements.pdf", type: "doc", docType: "legal", size: "420 KB", modified: "2025-10-22", pages: 31 },
        { id: "d16", name: "Pension Scheme Summary (Auto-Enrolment).pdf", type: "doc", docType: "hr", size: "180 KB", modified: "2025-10-18", pages: 9 },
      ]
    },
    {
      id: "f5", name: "05. Tax", type: "folder", children: [
        { id: "d17", name: "Corporation Tax Computations FY2024.pdf", type: "doc", docType: "tax", size: "260 KB", modified: "2025-04-15", pages: 14 },
        { id: "d18", name: "VAT Returns (Last 4 Quarters).pdf", type: "doc", docType: "tax", size: "150 KB", modified: "2025-10-31", pages: 8 },
      ]
    },
    {
      id: "f6", name: "06. Material Contracts", type: "folder", children: [
        { id: "d19", name: "Property Leases (3 sites).pdf", type: "doc", docType: "legal", size: "880 KB", modified: "2025-09-30", pages: 64 },
        { id: "d20", name: "Bank Facility Agreement.pdf", type: "doc", docType: "legal", size: "540 KB", modified: "2025-08-12", pages: 47 },
        { id: "d21", name: "Insurance Policies Schedule.pdf", type: "doc", docType: "legal", size: "190 KB", modified: "2025-10-01", pages: 11 },
      ]
    },
  ]
};

// ---- Rich document content (what the "AI" reads) ------------
// Realistic enough to summarise, extract financials, and flag issues.
const DOC_CONTENT = {
  d4: {
    title: "Cap Table — Nov 2025",
    body: `MERIDIAN FACILITIES GROUP LTD — CAPITALISATION TABLE (as at 15 Nov 2025)
Share class: Ordinary £0.01 shares. Total issued: 1,000,000 shares.

Shareholder                         Shares      %        
J. Hartley (Founder/CEO)            520,000     52.0%
S. Okafor (COO)                     180,000     18.0%
Marlow Ventures LP                  220,000     22.0%
EMI Option Pool (granted)            60,000      6.0%
Employee SIP (allocated)             20,000      2.0%
TOTAL                             1,000,000    100.0%

Note: Marlow Ventures holds a 1x non-participating liquidation preference.
Drag-along threshold: 75%. Founder lock-in expires Mar 2026.`,
  },
  d6: {
    title: "Audited Accounts FY2023",
    body: `MERIDIAN FACILITIES GROUP LTD — STATUTORY ACCOUNTS, YEAR ENDED 31 DEC 2023
Prepared under FRS 102. Auditor: Pennington Audit LLP. Opinion: Unqualified.

PROFIT & LOSS (£'000)
Revenue                              18,420
Cost of sales                       (11,950)
Gross profit                          6,470
Administrative expenses              (4,210)
Operating profit                      2,260
Depreciation (within admin)             610
Amortisation (within admin)             140
Finance costs                          (320)
Profit before tax                     1,940
Tax                                    (470)
Profit for the year                   1,470

BALANCE SHEET (£'000)
Fixed assets                          3,180
Debtors                               4,020
Cash                                  1,250
Creditors (<1yr)                     (3,640)
Bank loan (>1yr)                     (2,800)
Net assets                            2,010

Headcount (avg): 214. Three operating sites: Birmingham, Leeds, Reading.`,
  },
  d7: {
    title: "Audited Accounts FY2024",
    body: `MERIDIAN FACILITIES GROUP LTD — STATUTORY ACCOUNTS, YEAR ENDED 31 DEC 2024
Prepared under FRS 102. Auditor: Pennington Audit LLP. Opinion: Unqualified.

PROFIT & LOSS (£'000)
Revenue                              21,860
Cost of sales                       (13,720)
Gross profit                          8,140
Administrative expenses              (4,990)
Operating profit                      3,150
Depreciation (within admin)             720
Amortisation (within admin)             160
Finance costs                          (410)
Profit before tax                     2,740
Tax                                    (685)
Profit for the year                   2,055

BALANCE SHEET (£'000)
Fixed assets                          3,540
Debtors                               4,760
Cash                                  1,910
Creditors (<1yr)                     (4,120)
Bank loan (>1yr)                     (2,400)
Net assets                            3,690

Exceptional item: £180k restructuring cost in admin expenses (Leeds site consolidation).
Headcount (avg): 231.`,
  },
  d8: {
    title: "Management Accounts — YTD Oct 2025",
    body: `MERIDIAN FACILITIES GROUP LTD — MANAGEMENT ACCOUNTS, 10 MONTHS TO 31 OCT 2025
(Unaudited, management prepared)

P&L (£'000)
Revenue                              19,340
Cost of sales                       (11,800)
Gross profit                          7,540
Administrative expenses              (4,310)
Operating profit                      3,230
Depreciation                            640
Amortisation                            140
Finance costs                          (360)
Profit before tax                     2,870

Annualised revenue run-rate ≈ £23,200k.
Note: Management add-back of £95k owner's discretionary expenses identified.`,
  },
  d9: {
    title: "FY2026 Budget & Forecast",
    body: `MERIDIAN FACILITIES GROUP LTD — FY2026 BUDGET
Revenue                              25,500  (+14% vs FY25 run-rate)
Gross margin %                          39.5%
Operating profit                      3,720
EBITDA (management calc)              4,640
Key assumptions: 2 new national contracts (£2.1m combined), 3% price increase,
Reading site at full utilisation. No further restructuring assumed.`,
  },
  d10: {
    title: "Aged Debtors & Creditors",
    body: `AGED DEBTORS (£'000) as at 31 Oct 2025
Current      2,140
30 days        980
60 days        420
90+ days       510   <-- includes £310k from single customer (Brookfield NHS Trust)
Total        4,050

AGED CREDITORS (£'000)
Current      1,980
30 days        720
60+ days       180
Total        2,880

Note: 90+ debtor balance has grown from £210k (Jun) to £510k (Oct).`,
  },
  d11: {
    title: "Top 20 Customer Contracts (summary)",
    body: `MERIDIAN — TOP CUSTOMER CONTRACT SUMMARY
1. Brookfield NHS Trust — £3.2m/yr — expires Aug 2026 — CHANGE OF CONTROL clause present (consent required).
2. Aldermore Retail Group — £2.4m/yr — rolling 12-month — auto-renews.
3. Greater Manchester Council — £1.9m/yr — expires Dec 2027 — public tender re-bid required at expiry.
4. Hargreave Logistics — £1.1m/yr — expires Jun 2026.
5–20: remaining contracts total £9.8m/yr, average tenure 2.4 yrs.

Note: Contracts 1 and 4 both expire within 12 months of completion.
Brookfield NHS change-of-control consent is a key conditions-precedent item.`,
  },
  d12: {
    title: "Customer Concentration Analysis",
    body: `CUSTOMER CONCENTRATION (FY2024 revenue basis)
Top 1 customer (Brookfield NHS):   14.6%
Top 5 customers:                    41.0%
Top 10 customers:                   58.0%
Remaining (long tail):              42.0%
Customer count (active): 187.
Flag: Top-1 concentration above Conditor's 12% internal screening threshold.`,
  },
  d14: {
    title: "Employee Census & Org Chart",
    body: `EMPLOYEE CENSUS (as at 31 Oct 2025)
Total headcount: 238 (FTE 224).
By function: Operations 181, Sales 22, Finance 12, HR 6, Mgmt 17.
By site: Birmingham 96, Leeds 71, Reading 71.
Avg tenure: 4.2 yrs. Voluntary attrition (LTM): 18% (Ops driven).
Key persons: CEO J. Hartley, COO S. Okafor, FD R. Patel.
Note: FD R. Patel does NOT have a signed service agreement on file.`,
  },
  d16: {
    title: "Pension Scheme Summary (Auto-Enrolment)",
    body: `PENSION ARRANGEMENTS
Type: Defined Contribution (auto-enrolment, NEST provider).
Employer contribution: 3% (statutory minimum). No legacy DB scheme.
All eligible jobholders enrolled. No outstanding contribution arrears.
Low risk. No deficit exposure.`,
  },
  d19: {
    title: "Property Leases (3 sites)",
    body: `PROPERTY LEASES
1. Birmingham (HQ + depot): 10-yr FRI lease, expires 2031, rent £210k/yr, break clause 2027.
2. Leeds depot: 5-yr lease, expires Jul 2026, rent £96k/yr — NO renewal option, landlord redevelopment notice received.
3. Reading depot: 7-yr lease, expires 2029, rent £140k/yr.
Flag: Leeds lease expiry within 8 months + redevelopment notice = operational continuity risk.`,
  },
  d20: {
    title: "Bank Facility Agreement",
    body: `BANK FACILITY — NatWest Commercial
Term loan: £2.4m outstanding, amortising, matures 2028, rate SONIA + 3.1%.
Covenants: Net debt/EBITDA <= 2.5x (tested quarterly); interest cover >= 4.0x.
CHANGE OF CONTROL: facility becomes immediately repayable on change of control unless lender consent obtained.
Security: debenture over company assets.
Flag: Change-of-control triggers mandatory prepayment — refinancing required at completion.`,
  },
  d15: {
    title: "Key Employee Service Agreements",
    body: `KEY EMPLOYEE SERVICE AGREEMENTS ON FILE
- J. Hartley (CEO): 12-month notice, 12-month non-compete. Signed.
- S. Okafor (COO): 6-month notice, 6-month non-compete. Signed.
- (FD R. Patel): NOT PRESENT in this bundle.
Garden leave provisions standard.`,
  },
};

// ---- The Fund's Request List (Conditor's DD checklist) ------
// Used by the "Document Request Reconciliation" feature.
const FUND_REQUEST_LIST = [
  { id: "r1", item: "Certificate of Incorporation", category: "Legal" },
  { id: "r2", item: "Articles of Association", category: "Legal" },
  { id: "r3", item: "Statutory Registers", category: "Legal" },
  { id: "r4", item: "Cap Table", category: "Legal" },
  { id: "r5", item: "Audited Accounts (last 3 years)", category: "Financial" },
  { id: "r6", item: "Management Accounts (YTD)", category: "Financial" },
  { id: "r7", item: "Budget / Forecast", category: "Financial" },
  { id: "r8", item: "Aged Debtors & Creditors", category: "Financial" },
  { id: "r9", item: "Top Customer Contracts", category: "Commercial" },
  { id: "r10", item: "Customer Concentration Analysis", category: "Commercial" },
  { id: "r11", item: "Employee Census & Org Chart", category: "HR" },
  { id: "r12", item: "Key Employee Service Agreements", category: "HR" },
  { id: "r13", item: "Pension Scheme Summary", category: "HR" },
  { id: "r14", item: "Corporation Tax Computations", category: "Tax" },
  { id: "r15", item: "VAT Returns", category: "Tax" },
  { id: "r16", item: "Property Leases", category: "Legal" },
  { id: "r17", item: "Bank Facility Agreement", category: "Legal" },
  { id: "r18", item: "Insurance Policies", category: "Legal" },
  { id: "r19", item: "Environmental / H&S Compliance Reports", category: "Legal" },
  { id: "r20", item: "Intellectual Property Register", category: "Commercial" },
];

// Conditor's internal EBITDA template (feature 4)
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

if (typeof module !== "undefined") {
  module.exports = { DEAL, TREE, DOC_CONTENT, FUND_REQUEST_LIST, EBITDA_TEMPLATE_FIELDS };
}
