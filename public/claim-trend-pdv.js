// Pre Delivery adaptation of the shared Warranty Pending charts.
let createdAmountsState={started:false,ready:false,error:false};
function resetPdvTrendSources(){
  createdAmountsState={started:false,ready:false,error:false};
  pendingState={started:false,rows:null,error:false,version:""};
  pendingAmountState={started:false,rows:null,error:false};
}
function ensureCreatedAmounts(){
  if(amountDateBasis!=="created"||createdAmountsState.started)return;
  const state=createdAmountsState;state.started=true;
  state.promise=ensureAmountTicketRowsLoaded().then(()=>{
    if(state!==createdAmountsState)return;
    MONTHLY=withCreatedAmountMonthly(MONTHLY);
    MONTHS_INDEX=Object.fromEntries(MONTHLY.map(row=>[row.month,row]));
    state.ready=true;renderWithPageLoading(false);
  }).catch(error=>{
    if(state!==createdAmountsState)return;
    state.error=true;console.warn('Created On amounts unavailable',error);renderWithPageLoading(false);
  });
}
function approvedAmountReady(){return amountDateBasis!=="created"||createdAmountsState.ready;}
function pendingPoint(month,amount=false){
  const state=amount?pendingAmountState:pendingState;
  if(state.rows===null)return {value:null,missing:0,known:0};
  const row=state.rows.find(row=>row.month===month)||{};
  if(!amount)return {value:Number(row.pendingPre||0),missing:0,known:0};
  const missing=Number(row.missingPre||0),known=Number(row.knownPre||0);
  return {value:missing&&!known?null:Number(row.amountPre||0),missing,known};
}
function pendingRows(rows,amount=false){
  return rows.map(row=>{const p=pendingPoint(row.month,amount);return {...row,
    total:amount&&!approvedAmountReady()?null:row.total,pending:p.value,missing:p.missing,known:p.known};});
}
function pendingTotal(rows,amount=false){
  if((amount?pendingAmountState:pendingState).rows===null)return '—';
  const missing=sumValueRows(rows,'missing'),known=sumValueRows(rows,'known');
  if(amount&&missing&&!known)return '—';
  return (amount?moneyNum:num)(sumValueRows(rows,'pending'))+(amount&&missing?' *':'');
}
function pendingLegend(amount=false){
  const state=amount?pendingAmountState:pendingState;
  return state.rows!==null?(amount?'Pending Quote':'Pending'):state.error||pendingState.error?'Pending unavailable · refresh to retry':'Pending loading…';
}
function pendingDescription(){
  return 'Pre Delivery only. Current open Claims awaiting approval, grouped by Created On; approved, closed, rejected and cancelled Claims are excluded. This is not a historical month-end balance.';
}
function showPendingLegend(id,items){
  setLegend(id,items);$(id).setAttribute('style','visibility:visible!important;display:flex!important');
  $(id).title=pendingDescription();
}
function updatePendingNote(rows){
  const note=$('amountPendingNote');note.hidden=false;
  const missing=sumValueRows(rows,'missing');
  note.textContent='Pending Quote: current open Pre Delivery Claims’ Claim Amount, grouped by Created On. Approved: SAP purchase order amount.'+
    (missing?` * Partial amount: ${num(missing)} Pending Claims have no Claim Amount.`:'')+
    (pendingAmountState.rows===null?(pendingAmountState.error||pendingState.error?' Pending amounts unavailable; refresh to retry.':' Loading Pending amounts…'):'')+
    (!approvedAmountReady()?(createdAmountsState.error?' Approved amounts unavailable; click Created On to retry.':' Loading Approved amounts by Created On…'):'');
}
function renderPendingApproved(approvedRows){
  loadPendingTickets();
  const rows=pendingRows(approvedRows);
  drawSingleLineChart('approvedChart',rows,'total',{color:'#16a34a',secondaryKey:'pending'});
  setTotals('approvedTotalsAll',[
    {label:'Approved · Pre Delivery',value:num(sumValueRows(rows))},
    {label:'Pending · Pre Delivery',value:pendingTotal(rows)}
  ]);
  showPendingLegend('approvedLegend',[
    {label:`Approved · ${approvedDateLabel()}`,color:'#16a34a'},
    {label:`${pendingLegend()} · Created On`,color:'#8b5cf6',dashed:true}
  ]);
  $('approvedChart').setAttribute('role','img');
  $('approvedChart').setAttribute('aria-label',`Pre Delivery. Approved by ${approvedDateLabel()}; Pending by Created On. `+rows.map(r=>`${r.month}: Approved ${r.total}, Pending ${r.pending??'unavailable'}`).join('; '));
}
function renderPendingAmounts(approvedRows){
  loadPendingAmounts();
  const rows=pendingRows(approvedRows,true);
  drawSingleLineChart('approvedAmountChart',rows,'total',{color:'#0f766e',yMax:niceCurrencyMax,pointFormatter:moneyK,secondaryKey:'pending',secondaryFormatter:(v,r)=>moneyNum(v)+(r.missing?'*':'')});
  setTotals('amountTotalsAll',[
    {label:'Approved · Pre Delivery',value:approvedAmountReady()?moneyNum(sumValueRows(rows)):'—'},
    {label:'Pending Quote · Pre Delivery',value:pendingTotal(rows,true)}
  ]);
  showPendingLegend('amountLegend',[
    {label:`Approved · ${amountDateLabel()}`,color:'#0f766e'},
    {label:`${pendingLegend(true)} · Created On`,color:'#8b5cf6',dashed:true}
  ]);
  updatePendingNote(rows);
  $('approvedAmountChart').setAttribute('role','img');
  $('approvedAmountChart').setAttribute('aria-label',`Pre Delivery. Approved by ${amountDateLabel()}; Pending Quote by Created On. `+rows.map(r=>`${r.month}: Approved ${r.total===null?'unavailable':moneyNum(r.total)}, Pending Quote ${r.pending===null?'unavailable':moneyNum(r.pending)}${r.missing?`, ${r.missing} missing amounts`:''}`).join('; '));
}
function renderPendingComparison(approvedRows,amountRows){
  loadPendingTickets();loadPendingAmounts();
  for(const [amount,input,canvas,legend,totals] of [[false,approvedRows,'approvedChart','approvedLegend','approvedTotalsAll'],[true,amountRows,'approvedAmountChart','amountLegend','amountTotalsAll']]){
    const rows=input.map(row=>{
      const a=pendingPoint(buildMonthKey(compareYearA,Number(row.month.slice(5))),amount);
      const b=pendingPoint(buildMonthKey(compareYearB,Number(row.month.slice(5))),amount);
      // Do not show future months as zero in the current year's Pending series.
      const visible=year=>buildMonthKey(year,Number(row.month.slice(5)))<=dataBounds().max;
      return {...row,year:'',firstValue:amount&&!approvedAmountReady()?null:row.firstValue,
        secondValue:amount&&!approvedAmountReady()?null:row.secondValue,
        pendingA:visible(compareYearA)?a.value:null,pendingB:visible(compareYearB)?b.value:null,
        missingA:a.missing,missingB:b.missing,knownA:a.known,knownB:b.known};
    });
    drawChart(canvas,rows,'firstValue','secondValue',{...(amount?{yMax:niceCurrencyMax,pointFormatter:moneyK}:{}),extraSeries:[
      {key:'pendingA',color:'#8b5cf6'},{key:'pendingB',color:'#db2777'}]});
    const summary=[];
    for(const [year,key,pending,suffix] of [[compareYearA,'firstValue','pendingA','A'],[compareYearB,'secondValue','pendingB','B']]){
      summary.push({label:`Approved ${year}`,value:amount&&!approvedAmountReady()?'—':(amount?moneyNum:num)(sumValueRows(rows,key))});
      summary.push({label:`${amount?'Pending Quote':'Pending'} ${year}`,value:pendingTotal(rows.map(r=>({pending:r[pending],missing:r['missing'+suffix],known:r['known'+suffix]})),amount)});
    }
    setTotals(totals,summary);
    showPendingLegend(legend,[{label:`Approved ${compareYearA}`,color:'#156082'},{label:`Approved ${compareYearB}`,color:'#e97132'},
      {label:`${pendingLegend(amount)} ${compareYearA} · Created On`,color:'#8b5cf6',dashed:true},
      {label:`${pendingLegend(amount)} ${compareYearB} · Created On`,color:'#db2777',dashed:true}]);
    $(canvas).setAttribute('role','img');
    $(canvas).setAttribute('aria-label',`Pre Delivery. Approved by ${amount?amountDateLabel():approvedDateLabel()}; Pending by Created On. `+rows.map(r=>`${r.label}: ${compareYearA} Approved ${r.firstValue??'unavailable'}, Pending ${r.pendingA??'unavailable'}; ${compareYearB} Approved ${r.secondValue??'unavailable'}, Pending ${r.pendingB??'unavailable'}`).join('; '));
    if(amount)updatePendingNote(rows.map(r=>({missing:r.missingA+r.missingB})));
  }
}
async function ensurePendingExport(){
  await loadPendingTickets();
  if(pendingState.rows===null)throw Error('Pending tickets unavailable. Refresh to retry.');
  await loadPendingAmounts();
  if(pendingAmountState.rows===null)throw Error('Pending quotes unavailable. Refresh to retry.');
}
function pendingExportSheets(){
  const included=month=>viewMode==='compare'?[compareYearA,compareYearB].includes(month.slice(0,4)):month>=activeStart&&month<=activeEnd;
  const rows=(pendingState.rows||[]).filter(row=>included(row.month)).map(row=>{
    const quote=pendingPoint(row.month,true);
    return [row.month,row.pendingPre,quote.value??'Unavailable',quote.known,quote.missing];
  });
  return [{name:'Pending Monthly',rows:[['Scope',pendingDescription()],['Quote source','Claim Amount; separate from Approved SAP amounts. Missing quotes are not zero.'],
    ['Status source updated',pendingState.version],[],['Created Month','Pending Pre Delivery Claims','Known Claim Amount subtotal','Quotes available','Quotes missing'],...rows]}];
}
