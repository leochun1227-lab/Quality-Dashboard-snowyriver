"""Apply the standalone PDV view on every warranty page refresh."""
import re


def remove_div(page, element_id):
    start = page.index('<div id="' + element_id + '"')
    depth = 0
    for tag in re.finditer(r'</?div\b[^>]*>', page[start:]):
        depth += -1 if tag.group().startswith('</') else 1
        if depth == 0:
            return page[:start] + page[start + tag.end():]
    raise ValueError('Unclosed chart: ' + element_id)


def pdv_page(page):
    for prefix in ('newClaim', 'approved', 'amount', 'unapproved', 'claimClosed'):
        page = remove_div(page, prefix + 'SplitCard')
        page = remove_div(page, prefix + 'Totals')
    page = re.sub(r'<section class="panel" id="unapproved">[\s\S]*?</section>', '', page, count=1)
    page = page.replace('function syncUnapprovedDateControls(){', 'function syncUnapprovedDateControls(){\n  if(!$("unapproved"))return;')
    page = re.sub(r'^  \$\("unapproved(?:ClosedOn|CreatedOn)Btn"\)\.onclick=.*\n', '', page, flags=re.M)
    page = page.replace('["newclaim","approved","amount","unapproved"]', '["newclaim","approved","amount"]')
    page = page.replace('const unapproved=monthWithinRange(unapprovedGroupMonth,start,end)&&ticketUnapprovedClosedNow(ticket);', 'const unapproved=false;')
    page = page.replace(',"Unapproved Tickets Group By"', '').replace('      unapprovedDateLabel(),\n', '')
    page = page.replace('Created, Approved, Amount Claim, or Unapproved.', 'Created, Approved, or Amount Claim.')
    page = page.replace('_unapproved_by_${unapprovedDateBasis}', '')
    page = re.sub(r'<link rel="preload" href="outputs/claim_trend_startup.json"[^>]*>\n?', '', page)
    page = page.replace('fieldMode="all"', 'fieldMode="pre"')
    start = page.index('function fieldConfig(){')
    end = page.index('\nfunction syncFieldButtons', start)
    page = page[:start] + '''function fieldConfig(){
  return {mode:"pre",label:"Pre Delivery",shortLabel:"Pre Delivery",color:"#397eae",value:(r,_inKey,preKey)=>Number(r[preKey]||0)};
}
''' + page[end:]
    page = page.replace('total:Number(r[inKey]||0)+Number(r[preKey]||0)',
                        'total:Number(r[preKey]||0)')
    page = page.replace('All Fields', 'Pre Delivery')
    page = page.replace('<body class="charts-loading">', '<body class="charts-loading pdv-trend-page">')
    # Keep Warranty's historical filters, year comparison, data and export loaders.
    # Only the other PDV pages use the fixed 9 September creation-date cohort.
    page = page.replace('charts-loading pdv-trend-page', 'charts-loading pdv-trend-page historical-trend-page')
    page = page.replace('    fetchClaimStartup("outputs/claim_trend_startup.json"),\n', '')
    page = page.replace('$("fromMonth").focus();\n      return;',
                        '$("fromMonth").focus();\n      renderWithPageLoading(false);return;')
    # Reuse Warranty's Pending status/quote loaders and drawing primitives, but
    # replace its all-fields/split renderers with the Pre Delivery-only view.
    start = page.index('function renderPendingApproved(')
    end = page.index('function drawSingleLineChart(', start)
    page = page[:start] + page[end:]
    page = page.replace('</head>', '<script src="claim-trend-pdv.js"></script></head>')
    page = page.replace('if(pendingState.started)return;', 'if(pendingState.started)return pendingState.promise;')
    page = page.replace('if(pendingAmountState.started||!pendingState.tickets)return;',
                        'if(pendingAmountState.started||!pendingState.tickets)return pendingAmountState.promise;')
    page = page.replace('const state=pendingState;state.started=true;\n  (async()=>{',
                        'const state=pendingState;state.started=true;\n  return state.promise=(async()=>{')
    page = page.replace('const state=pendingAmountState;state.started=true;\n  (async()=>{',
                        'const state=pendingAmountState;state.started=true;\n  return state.promise=(async()=>{')
    page = page.replace('approvedDateBasis="approved"', 'approvedDateBasis="created"')
    page = page.replace('amountDateBasis="approved"', 'amountDateBasis="created"', 1)
    for button in ('approvedOnBtn', 'amountApprovedOnBtn'):
        page = page.replace(f'id="{button}" class="miniBtn active" type="button" aria-pressed="true"',
                            f'id="{button}" class="miniBtn" type="button" aria-pressed="false"')
    for button in ('approvedCreatedOnBtn', 'amountCreatedOnBtn'):
        page = page.replace(f'id="{button}" class="miniBtn" type="button" aria-pressed="false"',
                            f'id="{button}" class="miniBtn active" type="button" aria-pressed="true"')
    page = page.replace('amountTicketRows=null;amountTicketsById=new Map();amountDateBasis="approved";',
                        'amountTicketRows=null;amountTicketsById=new Map();')
    page = page.replace('    claimMonthlyReady=true;', '    resetPdvTrendSources();\n    claimMonthlyReady=true;')
    page = page.replace('function render(){', 'function render(){\n  ensureCreatedAmounts();', 1)
    page = page.replace('    return;\n  }\n  const rows=rowsForRange();',
                        '    renderPendingComparison(approvedRows,amountRows);\n    return;\n  }\n  const rows=rowsForRange();', 1)
    page = page.replace('async function setAmountDateBasis(basis){', '''async function setAmountDateBasis(basis){
  if(basis==="created"&&amountDateBasis==="created"&&createdAmountsState.error){
    createdAmountsState={started:false,ready:false,error:false};renderWithPageLoading(false);return;
  }''')
    # Missing Created On amounts must not render as a fabricated zero while loading.
    page = page.replace('  rows.forEach((r,i)=>{const px=x(i),py=y(r[key]);if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py)});',
                        '  let connected=false;\n  rows.forEach((r,i)=>{if(r[key]==null){connected=false;return;}const px=x(i),py=y(r[key]);if(connected)ctx.lineTo(px,py);else ctx.moveTo(px,py);connected=true;});')
    page = page.replace('  rows.forEach((r,i)=>{\n    const px=x(i),py=y(r[key]);',
                        '  rows.forEach((r,i)=>{\n    if(r[key]==null)return;\n    const px=x(i),py=y(r[key]);')
    # Export Pending separately so current open claims are never labelled Approved.
    page = page.replace('ensureRawTicketsLoaded(),ensureAmountTicketRowsLoaded()',
                        'ensureRawTicketsLoaded(),ensureAmountTicketRowsLoaded(),ensurePendingExport()')
    page = page.replace('{name:String(compareYearB),rows:exportDetailSheetRows(rowsB)}',
                        '{name:String(compareYearB),rows:exportDetailSheetRows(rowsB)},...pendingExportSheets()')
    page = page.replace('{name:"Tickets",rows:exportDetailSheetRows(rows)}',
                        '{name:"Tickets",rows:exportDetailSheetRows(rows)},...pendingExportSheets()')
    page = page.replace('Amount Including Tax is excluded.',
                        'Approved amounts use SAP amounts. Pending Claim Amount is reported separately in Pending Monthly.')
    return page
