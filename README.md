# Pre Delivery dashboard

Standalone local website: `http://127.0.0.1:8876/`.

Run `./start-dashboard.ps1` to start the hidden loopback server. Website files are in `public/`.
The three navigation buttons open Pre Delivery Overview, the existing Claim Trend Overview,
and the approved Pre Delivery Top 10 page.

## Data and updates

All three pages and exports use the inclusive cutoff `Created On >= 2026-09-09`.
`pdv_scope.py` owns the fixed date; September contains only the 9th onward.
The publisher builds the Claim cohort from Firebase currentStatus, joins Issue records by
Ticket ID, and filters approved amount records to the same cohort before aggregation.
Approval-date grouping remains available within that cohort; it never brings in older-created Claims.
Overview and Claim Trend approved counts are reconciled before publication. Immutable Claim
and amount detail payloads power exports without fetching historical tickets into the browser.

The web pages read Firebase directly. They do not load local CSV or generated JSON files.
`python refresh.py` reads the existing warranty publications and publishes small, validated,
immutable summaries under `issueSubcategoryAnalysis/v1/c4cTickets_test/pdvDashboard` in the existing Firebase database.
It does not fetch SAP/C4C or invoke AI. `python install_daily_hook.py`
adds one step to the sibling warranty project's existing `run_daily_5pm_mandt800_rejection_filter.bat`.
The step runs only after the existing refresh and publication verification succeed.
A failure returns nonzero and retains the previous Firebase startup snapshot. No separate schedule is created.
The existing daily log records the result.

The overview and Top 10 include only approved Claims and their Issues, grouped by Claim Created On.
The overview has L2 / L3 buttons in the centre of the shared header. Each desktop view fills
the space below the summary without page or card scrolling. L2 presents every populated
Level 1 System with its Level 2 Components in aligned grid rows. L3 presents seven detailed
reference cards from the supplied QMS-WAR-003 Version 03 guide. Definitions, identification clues, examples and exclusions are static reference
text in classification-guide.js; counts and percentages come from Firebase. Other source labels
remain separate, with their leading components and counts, and are never remapped into the guide.
The L3 screen keeps an Other source categories panel visible. Alongside the L3 reasons,
it explicitly shows L1 Other (Z009) usage. Labour and 9997 cards are hidden at the user's request.
These counts use original Issue Position codes, not text matching against Labour Failure.
They are already included in the Issue total and overlap the L3 breakdown; never add both.
Count buttons open matching Issue details. The compact Firebase summary includes monthly
positionUsage and immutable detail rows retain the original position code at index 6.
All categories within the selected level are expanded without internal scrolling.
L2 uses cards in descending Issue order, left to right then top to bottom.
Orange headers and rank numbers distinguish the systems; L3 uses red headers and a dark blue
decision card. Systems with at least ten
components get wider cards and two-column lists, also in row-first descending order.
Short lists use narrower cards. Long names wrap and rows adapt to viewport or filter changes
without additional data requests or masonry backfilling that would change reading order.
Switching levels preserves the selected period and makes no additional data request.
Data definitions open in a dialog from the compact footer. Desktop layouts were checked at
1366 by 768 and 1920 by 1080; narrow mobile screens stack the content for readability.
Monthly charts live on Claim Trend.
Count buttons open optional Claim details; all three classification totals use the same denominator.
Approval uses Firebase currentStatus: the existing Warranty statuses plus a nonblank Claim Approved On.
Missing status records are explicitly excluded and counted. The source timestamps are shown under
Data & definitions. Claim Trend restricts its charts, totals and exports
to Pre Delivery. Its monthly Approved charts reuse the overview's Firebase
summary and follow the period/year controls. Existing trend metrics retain their date-basis controls.
All three pages place their title, filters and actions in the top navigation's right-hand area.
Claim Trend uses Tickets / Issues instead of year comparison. Tickets shows monthly approved
Claims above a single row of Tickets Created, Approved Tickets and Amount Claim charts.
Issues shows the monthly approved Issue trend and exports the selected period's Issue details.
Both desktop views adapt to the space below the shared header. Unapproved Tickets is removed from this view
and its export matching criteria. Smaller screens stack the cards to keep the labels readable.
`claim_trend_page.py` reapplies this layout whenever the daily update assembles the source page.
Level 1 / 2 / 3 use Issue Position / System Subcategory / Subcategory Reason; missing values remain Unclassified.
Shares use the full approved population, including Other and Unclassified. Top 10 excludes
Other, Unclassified, Labour and 9997 from the ranking, consistent with the existing page.

Green SAP production dates have not been connected to this dashboard. This does not establish
that production data is absent from Firebase. Produced and the 60-day production percentage
cannot yet be calculated; they are never represented as zero or inferred from Claim counts.

The publisher uses the existing warranty service account on the backend only; credentials are never
copied into web assets. Immutable approved Issue detail batches are published before the startup snapshot.
Browsers request the small Firebase summary first and fetch Issue details only on a click or export.
The last Firebase summary is cached in the browser; subsequent loads check a tiny generation key.
Failed network checks explicitly label saved data. Claim Trend also uses a Firebase summary node.

Raw export shards are cached under `.cache/`, which is not served and is ignored by Git. The browser
does not depend on that cache. Only local users can access the loopback web server. Website hosting
and repository publication are separate from publishing data to the existing Firebase database.

The local machine has no enabled task named `CTM V44 Daily 5PM Firebase Refresh`; the discovered
`run warranty 8.30pm` task is disabled. The hook is installed in the requested 5pm program and executes
whenever that program runs successfully. No existing task was enabled or rescheduled.

`python -m unittest -v test_refresh.py` validates approval rules, distinct Claim counting,
category totals, unknown approval status, missing categories and duplicate rejection.
