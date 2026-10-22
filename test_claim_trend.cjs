const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, 'public/infieldpredelivery.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];

function app() {
  const document = {documentElement:{dataset:{}}, getElementById() {
    return {classList:{toggle(){}}, setAttribute(){}, style:{}};
  }};
  const context = vm.createContext({document,window:{},console});
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'public/claim-trend-ticket-metrics.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'public/claim-trend-pdv.js'), 'utf8'), context);
  vm.runInContext(script.slice(0, script.indexOf('\nsetupNav();')), context);
  return {context, run:code=>vm.runInContext(code,context), json:code=>JSON.parse(vm.runInContext(`JSON.stringify(${code})`,context))};
}

test('historical presets and custom ranges reach months before September 2026', () => {
  const a=app();
  a.run('var bounds={min:"2025-01",max:"2026-10",years:["2025","2026"]}');
  assert.deepEqual(a.json('presetMonthRange("all",bounds)'),{start:'2025-01',end:'2026-10'});
  assert.deepEqual(a.json('presetMonthRange("last12",bounds)'),{start:'2025-11',end:'2026-10'});
  assert.deepEqual(a.json('clampMonthRange("2026-08","2025-02",bounds)'),{start:'2025-02',end:'2026-08'});
});

test('historical chart and export include September 1-8 while retaining Pre Delivery scope', () => {
  const a=app();
  const ticket=(id,created,type='Pre Delivery')=>({TicketID:id,TicketTypeText:type,TicketStatus:'Y2',CreatedOn:created,ClaimApprovedOnDateTime:'2026-09-12',approvedAmount:20});
  a.context.tickets=[ticket('old','2025-02-03'),ticket('before','2026-09-08'),ticket('boundary','2026-09-09'),ticket('in','2026-09-08','In Field Warranty'),ticket('pdi','2026-09-08','PDI')];
  a.run('RAW_TICKETS=tickets; MONTHLY=buildMonthly({}); MONTHS_INDEX=Object.fromEntries(MONTHLY.map(r=>[r.month,r])); activeStart="2025-01";activeEnd="2026-10";');
  assert.equal(a.json('totalRowsForRange("createdIn","createdPre").find(r=>r.month==="2026-09").total'),2);
  assert.deepEqual(a.json('buildExportRowsForRange("2025-02","2025-02").map(r=>r.ticketId)'),['old']);
  a.run('approvedDateBasis="approved";amountDateBasis="approved"');
  assert.deepEqual(a.json('buildExportRowsForRange("2026-09","2026-09").map(r=>r.ticketId).sort()'),['before','boundary','old']);
  assert.equal(a.json('compareRowsForMetric("createdIn","createdPre","2026","2025")[1].secondValue'),1);
  a.run('approvedDateBasis="created";amountDateBasis="created"');
  assert.deepEqual(a.json('buildExportRowsForRange("2026-09","2026-09").map(r=>r.ticketId).sort()'),['before','boundary']);
});

test('Pending counts current open Pre Delivery only, removes approvals/closures and preserves historical months', () => {
  const a=app();
  const ticket=(id,extra={})=>({id,claimType:'Pre Delivery Warranty Claims',created:'2025-02-03',statusCode:'Z1',statusText:'New',...extra});
  a.context.tickets=[ticket('open'),ticket('open'),ticket('approved',{claimApprovedOn:'2026-09-10'}),ticket('closed',{resolvedOn:'2026-09-10'}),ticket('rejected',{statusText:'Rejected'}),ticket('cancelled',{statusText:'Cancelled'}),ticket('unknown',{statusCode:'UNKNOWN'}),ticket('in',{claimType:'In Field Warranty Claims'})];
  a.run('pendingState.rows=ClaimTrendTicketMetrics.pendingMonthly(tickets)');
  assert.equal(a.json('pendingPoint("2025-02").value'),1);
  a.context.tickets[0].statusCode='Y2';a.context.tickets[1].statusCode='Y2';
  a.run('pendingState.rows=ClaimTrendTicketMetrics.pendingMonthly(tickets)');
  assert.equal(a.json('pendingPoint("2025-02").value'),0);
});

test('Pending quotes keep missing amounts distinct from zero and exclude In Field from totals and export', () => {
  const a=app();
  a.context.tickets=[
    {id:'a',claimType:'Pre Delivery',created:'2025-02-01',statusCode:'Z1',quotedClaimAmount:100},
    {id:'b',claimType:'Pre Delivery',created:'2025-02-01',statusCode:'Z2',quotedClaimAmount:0},
    {id:'c',claimType:'Pre Delivery',created:'2025-02-01',statusCode:'Z3',quotedClaimAmount:''},
    {id:'d',claimType:'In Field Warranty',created:'2025-02-01',statusCode:'Z1',quotedClaimAmount:999},
    {id:'e',claimType:'Pre Delivery',created:'2025-03-01',statusCode:'Z1',quotedClaimAmount:''}
  ];
  a.run('pendingState.rows=ClaimTrendTicketMetrics.pendingMonthly(tickets);pendingAmountState.rows=ClaimTrendTicketMetrics.pendingAmountMonthly(tickets);activeStart="2025-02";activeEnd="2025-02"');
  assert.deepEqual(a.json('pendingPoint("2025-02",true)'),{value:100,missing:1,known:2});
  assert.deepEqual(a.json('pendingPoint("2025-03",true)'),{value:null,missing:1,known:0});
  assert.deepEqual(a.json('pendingExportSheets()[0].rows.slice(5)'),[['2025-02',3,100,2,1]]);
});

const dailySnapshot={schema:'claim-startup-v1',publication:'pdv-daily-v1',generation:'a'.repeat(20),
  cohortSchema:'claims-issues-v1',cohortBasis:'claim_created_on',issuePopulationComplete:true,
  cohortMonthly:[{month:'2026-10',totalClaims:9,approvedClaims:4,pendingClaims:5,totalIssues:20,approvedIssues:8,pendingIssues:12}],
  generatedAt:'2026-10-20',statusVersion:'status-version',sourceVersion:'["team","core","so"]',closedIndex:{},
  monthly:[{month:'2026-10',createdPre:9,approvedCreatedPre:4,createdAmountPre:77,approvedAmountPre:88}],
  pendingMonthly:[{month:'2026-10',pendingPre:5}],
  pendingAmountMonthly:[{month:'2026-10',amountPre:123,knownPre:4,missingPre:1}]};
function publishedApp(cached=null){
  const a=app(),requests=[],writes=[],renders=[];
  a.context.window.WarrantyPageCache={getPageRecord:async()=>cached?{value:cached}:null,
    setPage:async(key,version,value)=>writes.push({key,version,value}),showBadge(){}};
  a.context.sourceRead=async path=>{
    requests.push(path);
    if(path.endsWith('/generation'))return dailySnapshot.generation;
    if(path.endsWith('/historicalClaimTrendStartup'))return {...dailySnapshot,data:JSON.stringify(dailySnapshot)};
    throw Error('Unexpected detail download: '+path);
  };
  a.context.captureRender=()=>renders.push(a.run('pendingPoint("2026-10").value'));
  a.run('readJson=sourceRead; renderWithPageLoading=captureRender; init=(_view,_cached,_closed,monthly)=>{MONTHLY=monthly;MONTHS_INDEX=Object.fromEntries(monthly.map(r=>[r.month,r]));captureRender();};finishInitialScroll=()=>{};syncAmountDateControls=()=>{}');
  return {...a,requests,writes,renders};
}
test('first visit reads only the published daily result and all chart sources are ready together',async()=>{
  const a=publishedApp();
  await a.run('loadPublishedTrend()');
  assert.equal(a.requests.length,2);
  assert.equal(a.run('approvedAmountReady()'),true);
  assert.equal(a.run('MONTHS_INDEX["2026-10"].createdAmountPre'),77);
  assert.equal(a.run('pendingPoint("2026-10").value'),5);
  assert.equal(a.run('pendingPoint("2026-10",true).missing'),1);
  assert.deepEqual(a.renders,[5]);
  assert.equal(a.writes[0].version,dailySnapshot.generation);
  await a.run('loadPendingTickets();loadPendingAmounts();ensureCreatedAmounts();setAmountDateBasis("approved")');
  await a.run('setAmountDateBasis("created")');
  assert.equal(a.requests.length,2);
});
test('same daily generation reuses the complete published result without any detail requests',async()=>{
  const a=publishedApp(dailySnapshot);
  await a.run('loadPublishedTrend()');
  assert.equal(a.requests.length,1);
  assert.match(a.requests[0],/historicalClaimTrendStartup\/generation$/);
  assert.equal(a.run('pendingState.mode'),'fresh');
  assert.equal(a.writes.length,0);
});
test('new daily result replaces the entire prior result together',async()=>{
  const old={...dailySnapshot,generation:'b'.repeat(20),pendingMonthly:[{month:'2026-10',pendingPre:2}]};
  const a=publishedApp(old);
  await a.run('loadPublishedTrend()');
  assert.deepEqual(a.renders,[2,5]);
  assert.equal(a.run('publishedTrendSnapshot.generation'),dailySnapshot.generation);
});
test('offline retains the previous published result and never falls back to live calculation',async()=>{
  const a=publishedApp(dailySnapshot);
  a.context.sourceRead=async path=>{a.requests.push(path);throw Error('offline');};
  a.run('readJson=sourceRead');
  await a.run('loadPublishedTrend()');
  assert.equal(a.requests.length,1);
  assert.equal(a.run('pendingPoint("2026-10").value'),5);
  assert.equal(a.run('pendingState.mode'),'offline');
});
test('incomplete published data is rejected instead of displaying unknown amounts as zero',()=>{
  const a=app();a.context.snapshot={...dailySnapshot,pendingAmountMonthly:null};
  assert.equal(a.run('validPublishedTrend(snapshot)'),false);
});

test('monthly bars share a scale, preserve zero, and omit unknown or future values',()=>{
  const a=app(),bars=[],labels=[];
  const ctx={setTransform(){},clearRect(){},fillRect(x,y,w,h){bars.push({x,y,w,h,color:this.fillStyle});},
    fillText(text,x,y){labels.push({text,x,y});},measureText(text){return {width:String(text).length*7};}};
  const canvas={getBoundingClientRect:()=>({width:1000,height:265}),getContext:()=>ctx};
  a.context.document.getElementById=()=>canvas;
  a.context.devicePixelRatio=2;
  a.run('finishChartRender=()=>{}');
  a.run(`drawPendingBarChart('chart',[
    {month:'2026-01',total:100,pending:50},
    {month:'2026-02',total:null,pending:0},
    {month:'2026-03',total:null,pending:null}
  ],[{key:'total',color:'blue'},{key:'pending',color:'orange'}])`);
  assert.equal(bars.length,3);
  assert.equal(bars[0].h,2*bars[1].h);
  assert.equal(bars[0].y+bars[0].h,bars[1].y+bars[1].h);
  assert.equal(bars[0].x+bars[0].w,bars[1].x);
  assert.equal(bars[2].h,0);
  assert.deepEqual(labels.filter(item=>['100','50','0'].includes(item.text)).map(item=>item.text),['100','50','0']);
  assert.equal(canvas.width,2000);
});

test('Total is a line on the stacked Approved/Pending scale and breaks at unknown months',()=>{
  const a=app(),bars=[],points=[],segments=[];
  const ctx={setTransform(){},clearRect(){},fillRect(x,y,w,h){bars.push({x,y,w,h});},fillText(){},measureText(){return {width:15};},
    beginPath(){},moveTo(x,y){segments.push(['move',x,y]);},lineTo(x,y){segments.push(['line',x,y]);},stroke(){},setLineDash(){},arc(x,y){points.push({x,y});},fill(){}};
  a.context.document.getElementById=()=>({getBoundingClientRect:()=>({width:1000,height:265}),getContext:()=>ctx});
  a.context.devicePixelRatio=1;a.run('finishChartRender=()=>{}');
  a.run("drawPendingBarChart('chart',[{month:'2026-01',total:150,approved:100,pending:50},{month:'2026-02',total:null},{month:'2026-03',total:0},{month:'2026-04',total:80}],cohortSeries())");
  assert.equal(bars.length,2);
  assert.equal(bars[0].x,bars[1].x);
  assert.ok(Math.abs(bars[0].h-2*bars[1].h)<.001);
  assert.ok(Math.abs(bars[1].y+bars[1].h-bars[0].y)<.001);
  assert.equal(points[0].x,bars[0].x+bars[0].w/2);
  assert.equal(points[0].y,bars[1].y);
  assert.equal(points.length,3);
  assert.deepEqual(segments.map(s=>s[0]),['move','move','line']);
});

test('Issue cohorts distinguish unavailable from zero and omit future comparison months',()=>{
  const a=app();a.context.snapshot=dailySnapshot;
  a.run('applyPublishedTrendSources(snapshot,"fresh"); MONTHLY=snapshot.monthly;MONTHS_INDEX=Object.fromEntries(MONTHLY.map(r=>[r.month,r]));');
  assert.deepEqual(a.json('cohortPoint("2026-10","Issues")'),{total:20,approved:8,pending:12});
  assert.deepEqual(a.json('cohortPoint("2026-11","Issues")'),{total:null,approved:null,pending:null});
  a.context.partial={...dailySnapshot,issuePopulationComplete:false,cohortMonthly:[{...dailySnapshot.cohortMonthly[0],totalIssues:null,pendingIssues:null}]};
  a.run('applyPublishedTrendSources(partial,"fresh")');
  assert.equal(a.run('validPublishedTrend(partial)'),true);
  assert.deepEqual(a.json('cohortPoint("2026-10","Issues")'),{total:null,approved:8,pending:null});
  a.run('partial.cohortMonthly[0].totalIssues=0');
  assert.equal(a.run('validPublishedTrend(partial)'),false);
});
