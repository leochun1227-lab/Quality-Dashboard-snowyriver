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

test('Created On defaults load the real amount grouping and reset Pending on a fresh snapshot', async () => {
  const a=app();
  assert.equal(a.run('approvedDateBasis'),'created');
  assert.equal(a.run('amountDateBasis'),'created');
  a.run('MONTHLY=[emptyMonth("2025-02"),emptyMonth("2026-09")];amountTicketRows=[{id:"a",claim:"Pre Delivery",created:"2025-02-03",decisionDate:"2026-09-12",amount:123}];renderWithPageLoading=()=>{};ensureCreatedAmounts()');
  await a.run('createdAmountsState.promise');
  assert.equal(a.run('approvedAmountReady()'),true);
  assert.equal(a.run('MONTHS_INDEX["2025-02"].createdAmountPre'),123);
  assert.equal(a.run('MONTHS_INDEX["2026-09"].createdAmountPre'),0);
  a.run('pendingState.rows=[{month:"2025-02",pendingPre:3}];resetPdvTrendSources()');
  assert.equal(a.run('pendingState.rows'),null);
  assert.equal(a.run('approvedAmountReady()'),false);
});
