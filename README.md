# Pre Delivery dashboard

Standalone local website: `http://127.0.0.1:8876/`.

Run `./start-dashboard.ps1` to start the hidden loopback server. Website files are in `public/`.
The shared left sidebar groups the three navigation buttons and opens Pre Delivery Overview, the existing Claim Trend Overview,
and the approved Pre Delivery Top 10 page.

## Data and updates

Pre Delivery Overview and Top10 Failure Parts (including their exports) use the inclusive cutoff `Created On >= 2026-09-09`.
Claim Trend Overview alone uses the original Warranty historical data from January 2025,
with This Year, Last 12 Months, All Time, custom month ranges and Year Compare.
Its charts and exports remain Pre Delivery only and have no 9 September creation-date cutoff.
`pdv_scope.py` owns the fixed date; September contains only the 9th onward.
The publisher builds the Claim cohort from Firebase currentStatus, joins Issue records by
Ticket ID, and filters approved amount records to the same cohort before aggregation.
Approval-date grouping remains available within that cohort; it never brings in older-created Claims.
Overview and the scoped PDV Claim snapshot are reconciled before publication. Historical Claim Trend uses a separate daily result built from Warranty's historical summary, current statuses and SAP amount rows. The scoped PDV publication retains immutable Claim and amount details. Historical Claim Trend loads ticket details only for exports; its charts and date-basis switches read the daily result.

The web pages read Firebase directly. They do not load local CSV or generated JSON files.
`python refresh.py` reads the existing warranty publications and publishes small, validated,
immutable summaries under `issueSubcategoryAnalysis/v1/c4cTickets_test/pdvDashboard` in the existing Firebase database.
It does not fetch SAP/C4C or invoke AI. `python install_daily_hook.py`
installs the updater into `warranty/pdv_dashboard/` and adds or upgrades one step in the
existing `run_daily_5pm_mandt800_rejection_filter.bat`. The daily batch calls
`%~dp0run_pdv_dashboard_update.bat`, which finds scripts, credentials and category definitions
relative to that Warranty folder. No username, drive letter, current working directory or
sibling ozz-dashboard folder is required on the Planning computer. It runs in `--publish-only`
mode, so Planning does not need the standalone website files or browser server.
The step runs only after the existing refresh and publication verification succeed.
A failure returns nonzero and retains the previous Firebase startup snapshot. No separate schedule is created.
The existing daily log records the result.

`run_pdv_dashboard_update.bat --check` verifies local paths and Python dependencies without
network access or publishing. Missing files fail explicitly in the daily log. This check does
not validate Firebase credentials, network connectivity or the Planning scheduled task.
The installer preserves a backup of the old daily batch under `pdv_dashboard/backups/` and
can be run repeatedly without adding duplicate hooks. Copy the updated Warranty folder
to Planning, or use `dist/pdv-planning-update.zip`: extract its `pdv_update_install` folder
inside Planning's existing Warranty folder and run `install_on_planning.cmd` once.
The installer patches Planning's own batch instead of replacing its other update steps.
`python build_planning_package.py` rebuilds that package from the current updater files;
no credentials, source data, cache or website assets are included.

The overview and Top 10 include only approved Claims and their Issues, grouped by Claim Created On.
The overview has L2 / L3 buttons in the shared header beside the left sidebar.
Cards remain expanded; the page can scroll vertically when the available space is too small. L2 presents every populated
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
to Pre Delivery. It reads the published historical daily result and retains its date-basis controls.
All three pages place their title, filters and actions above the content, beside the shared left sidebar.
Claim Trend restores the Warranty Trend / Year Compare controls, with Approved On / Created On grouping.
Approved Tickets and Amount Claim default to Created On. The daily publisher groups approved amounts
by their original creation month; missing/loading amounts are not displayed as zero.
Both charts show paired monthly bars: Approved in blue and current Pending Pre Delivery Claims
by Created On in orange. Year Compare shows an Approved/Pending pair for each year using lighter
colors for the second year. Tickets Created retains its existing chart.
Pending excludes approved, resolved, closed, rejected and cancelled tickets; this is the current
open population grouped by creation month, not historical month-end backlog. Pending quotes use
the same Claim Amount fields and status rules as Warranty, and identify missing quotes separately
from real zero values. Approved amounts retain their SAP source. Year Compare shows Pending for
each year, and Excel exports include a separate Pending Monthly sheet.
`claim_trend_snapshot.py` builds all chart series during the existing daily update. It reads Pending
counts and quotes from the same completed status generation and includes both approved amount date bases.
The complete result is stored under `pdvDashboard/historicalGenerations/<generation>` before
`pdvDashboard/historicalClaimTrendStartup` is advanced. Source versions are checked again before publication;
a failed build retains the prior result. `python refresh.py --publish-only --dry-run` validates without publishing.
Page visits and date-basis switches never fetch the status feed or recalculate amounts. The browser may
reuse the exact prior published result while checking its small generation key. If a new daily generation
exists, the page replaces all chart sources together. Offline visits show the saved daily result with a label.
`claim-trend-pdv.js` adapts the Warranty renderers to the Pre Delivery-only view on page rebuilds.
Its three charts show Tickets Created, Approved Tickets and Amount Claim. Unapproved Tickets remains excluded.
The cutoff-only monthly Issue summary is not loaded on this historical page.
`claim_trend_page.py` preserves this behavior whenever the daily update assembles the source page.
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

`node test_claim_trend.cjs` validates historical month selection, year comparisons and Pre Delivery exports across the old cutoff.
