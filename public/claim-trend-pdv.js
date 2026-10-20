// Pre Delivery adaptation of the shared Warranty Pending charts.
// Charts consume one complete result produced by the daily publisher.
const PDV_DAILY_TREND_PATH='issueSubcategoryAnalysis/v1/c4cTickets_test/pdvDashboard/historicalClaimTrendStartup';
const PDV_DAILY_TREND_CACHE_KEY='pdv-historical-daily:v1';
let publishedTrendSnapshot=null;
let createdAmountsState={ready:false};
function validPublishedTrend(snapshot){
  return snapshot?.schema==='claim-startup-v1'&&snapshot.publication==='pdv-daily-v1'
    &&/^[a-f0-9]{20}$/.test(snapshot.generation)&&snapshot.generatedAt&&snapshot.statusVersion
    &&Array.isArray(snapshot.monthly)&&snapshot.monthly.length>0
    &&snapshot.monthly.every(row=>Number.isFinite(row.createdAmountPre))
    &&Array.isArray(snapshot.pendingMonthly)&&Array.isArray(snapshot.pendingAmountMonthly);
}
function applyPublishedTrendSources(snapshot,mode){
  publishedTrendSnapshot=snapshot;
  createdAmountsState={ready:true};
  pendingState={started:true,rows:snapshot.pendingMonthly,error:false,version:snapshot.statusVersion,mode};
  pendingAmountState={started:true,rows:snapshot.pendingAmountMonthly,error:false};
}
// Retained renderer hooks are intentionally read-only: no raw feed downloads,
// aggregation, or separate Pending refresh can occur during a page visit.
function ensureCreatedAmounts(){}
function loadPendingTickets(){return Promise.resolve();}
function loadPendingAmounts(){return Promise.resolve();}
async function loadPublishedTrend(){
  const cache=window.WarrantyPageCache;
  let shown=null;
  const apply=(snapshot,mode)=>{
    if(!validPublishedTrend(snapshot))throw Error('Daily chart result is incomplete');
    const first=!shown;
    applyPublishedTrendSources(snapshot,mode);
    claimMonthlyReady=true;
    if(first)init({},true,snapshot.closedIndex,snapshot.monthly);
    else{
      MONTHLY=snapshot.monthly;
      MONTHS_INDEX=Object.fromEntries(MONTHLY.map(row=>[row.month,row]));
      CLAIM_CLOSED_INDEX=snapshot.closedIndex||{};
      amountTicketRows=null;amountTicketsById=new Map();
      RAW_TICKETS=[];rawTicketsLoaded=false;claimSourceVersionsPromise=null;
      syncAmountDateControls();renderWithPageLoading(false);
    }
    shown=snapshot;
    cache?.showBadge(snapshot.generatedAt,mode);
    if(first)finishInitialScroll();
  };
  try{
    const record=await cache?.getPageRecord(PDV_DAILY_TREND_CACHE_KEY);
    if(validPublishedTrend(record?.value))apply(record.value,'checking');
  }catch(error){console.warn('Saved daily chart result unavailable',error);}
  try{
    const generation=await readJson(`${PDV_DAILY_TREND_PATH}/generation`,4000);
    if(!generation)throw Error('Daily chart result has not been published');
    if(shown?.generation===generation){
      pendingState.mode='fresh';renderWithPageLoading(false);
      cache?.showBadge(shown.generatedAt,'cached');return;
    }
    const envelope=await readJson(`${PDV_DAILY_TREND_PATH}`,10000);
    const snapshot={...envelope,...(typeof envelope?.data==='string'?JSON.parse(envelope.data):{})};
    if(snapshot.generation!==generation)throw Error('Daily result changed while loading; refresh to retry');
    apply(snapshot,'fresh');
    void cache?.setPage(PDV_DAILY_TREND_CACHE_KEY,snapshot.generation,snapshot);
  }catch(error){
    console.warn('Daily chart result unavailable',error);
    if(shown){
      pendingState.mode='offline';renderWithPageLoading(false);
      cache?.showBadge(shown.generatedAt,'offline');
    }else{
      showError('Daily chart result is not available yet. Refresh after the daily update completes.');
      showPageLoading(false);
    }
  }
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
  const saved=pendingState.mode==='checking'?' · saved data, checking updates':pendingState.mode==='offline'?' · saved data, update unavailable':'';
  return state.rows!==null?(amount?'Pending Quote':'Pending')+saved:state.error||pendingState.error?'Pending unavailable · refresh to retry':'Pending loading…';
}
function pendingDescription(){
  return 'Pre Delivery only. Current open Claims awaiting approval, grouped by Created On; approved, closed, rejected and cancelled Claims are excluded. This is not a historical month-end balance.';
}
function showPendingLegend(id,items){
  $(id).innerHTML=items.map(item=>`<span><i style="background:${item.color}"></i>${item.label}</span>`).join('');
  $(id).setAttribute('style','visibility:visible!important;display:flex!important');
  $(id).title=pendingDescription().replace("Pre Delivery only. ", "");
}
function updatePendingNote(rows){
  const note=$('amountPendingNote');
  const missing=sumValueRows(rows,'missing');
  note.textContent=(missing?`* Partial amount: ${num(missing)} Pending Claims have no Claim Amount.`:'')+
    (pendingAmountState.rows===null?(pendingAmountState.error||pendingState.error?' Pending amounts unavailable; refresh to retry.':' Loading Pending amounts…'):'')+
    (!approvedAmountReady()?(createdAmountsState.error?' Approved amounts unavailable; click Created On to retry.':' Loading Approved amounts by Created On…'):'');
  note.hidden=!note.textContent.trim();
}
function drawPendingBarChart(canvasId,rows,series,opts={}){
  const canvas=$(canvasId);if(!canvas)return;
  const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;
  const w=Math.max(1,rect.width),h=Math.max(1,rect.height);
  canvas.width=w*dpr;canvas.height=h*dpr;
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  ctx.font='500 13px Segoe UI Variable,Aptos,Segoe UI,Arial';ctx.textAlign='center';
  if(!rows.length){ctx.fillStyle='#64748b';ctx.fillText('No monthly data found.',w/2,h/2);finishChartRender(canvas);return;}
  const valid=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value));
  const values=rows.flatMap(row=>series.map(item=>row[item.key])).filter(valid).map(Number);
  const max=Math.max(10,...values),min=Math.min(0,...values);
  const upper=opts.yMax?opts.yMax(max):Math.ceil(max/100)*100;
  const lower=min<0?-Math.abs(opts.yMax?opts.yMax(-min):Math.ceil(-min/100)*100):0;
  const left=28,top=44,bottom=68,plotW=w-left*2,plotH=Math.max(1,h-top-bottom);
  const y=value=>top+plotH*(upper-Number(value))/(upper-lower),baseline=y(0);
  const groupW=plotW/rows.length,gap=Math.min(8,groupW*.08);
  const barW=Math.min(24,(groupW*.76-gap*(series.length-1))/series.length);
  const clusterW=barW*series.length+gap*(series.length-1),labels=[];
  rows.forEach((row,i)=>{
    const center=left+groupW*(i+.5);
    series.forEach((item,index)=>{
      const value=row[item.key];if(!valid(value))return;
      const x=center-clusterW/2+index*(barW+gap),valueY=y(value);
      ctx.fillStyle=item.color;
      ctx.fillRect(x,Math.min(baseline,valueY),barW,Math.abs(baseline-valueY));
      const formatter=item.formatter||opts.pointFormatter||num;
      labels.push({text:formatter(value,row),x:x+barW/2,y:Math.min(baseline,valueY)-9});
    });
    ctx.fillStyle='#475569';ctx.fillText(row.label||monthShort(row.month),center,h-36);
  });
  // Keep the larger numbers readable when adjacent bars have similar values.
  const placed=[];ctx.fillStyle='#172033';
  labels.forEach(label=>{
    const half=ctx.measureText(label.text).width/2;
    const x=Math.max(half+3,Math.min(w-half-3,label.x));
    let textY=label.y;
    const overlaps=()=>placed.some(box=>x-half<box.right+3&&x+half>box.left-3&&textY-13<box.bottom+3&&textY>box.top-3);
    while(overlaps()&&textY>30)textY-=16;
    ctx.fillText(label.text,x,textY);
    placed.push({left:x-half,right:x+half,top:textY-13,bottom:textY});
  });
  ctx.fillStyle='#475569';
  if(opts.caption)ctx.fillText(opts.caption,w/2,h-10);
  else{
    let start=0;
    while(start<rows.length){
      const year=rows[start].month.slice(0,4);let end=start;
      while(end+1<rows.length&&rows[end+1].month.slice(0,4)===year)end++;
      ctx.fillText(year,left+groupW*(start+end+1)/2,h-10);start=end+1;
    }
  }
  finishChartRender(canvas);
}
function renderPendingApproved(approvedRows){
  loadPendingTickets();
  const rows=pendingRows(approvedRows);
  drawPendingBarChart('approvedChart',rows,[{key:'total',color:'#156082'},{key:'pending',color:'#e97132'}]);
  setTotals('approvedTotalsAll',[
    {label:'Approved',value:num(sumValueRows(rows))},
    {label:'Pending',value:pendingTotal(rows)}
  ]);
  showPendingLegend('approvedLegend',[
    {label:`Approved · ${approvedDateLabel()}`,color:'#156082'},
    {label:`${pendingLegend()} · Created On`,color:'#e97132'}
  ]);
  $('approvedChart').setAttribute('role','img');
  $('approvedChart').setAttribute('aria-label',`Approved by ${approvedDateLabel()}; Pending by Created On. `+rows.map(r=>`${r.month}: Approved ${r.total}, Pending ${r.pending??'unavailable'}`).join('; '));
}
function renderPendingAmounts(approvedRows){
  loadPendingAmounts();
  const rows=pendingRows(approvedRows,true);
  drawPendingBarChart('approvedAmountChart',rows,[{key:'total',color:'#156082'},
    {key:'pending',color:'#e97132',formatter:(v,r)=>moneyNum(v)+(r.missing?'*':'')}],{yMax:niceCurrencyMax,pointFormatter:moneyK});
  setTotals('amountTotalsAll',[
    {label:'Approved',value:approvedAmountReady()?moneyNum(sumValueRows(rows)):'—'},
    {label:'Pending Quote',value:pendingTotal(rows,true)}
  ]);
  showPendingLegend('amountLegend',[
    {label:`Approved · ${amountDateLabel()}`,color:'#156082'},
    {label:`${pendingLegend(true)} · Created On`,color:'#e97132'}
  ]);
  updatePendingNote(rows);
  $('approvedAmountChart').setAttribute('role','img');
  $('approvedAmountChart').setAttribute('aria-label',`Approved by ${amountDateLabel()}; Pending Quote by Created On. `+rows.map(r=>`${r.month}: Approved ${r.total===null?'unavailable':moneyNum(r.total)}, Pending Quote ${r.pending===null?'unavailable':moneyNum(r.pending)}${r.missing?`, ${r.missing} missing amounts`:''}`).join('; '));
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
    drawPendingBarChart(canvas,rows,[{key:'firstValue',color:'#156082'},{key:'pendingA',color:'#e97132'},
      {key:'secondValue',color:'#62a9c8'},{key:'pendingB',color:'#f4b183'}],{
      ...(amount?{yMax:niceCurrencyMax,pointFormatter:moneyK}:{}),caption:`${compareYearA} vs ${compareYearB}`});
    const summary=[];
    for(const [year,key,pending,suffix] of [[compareYearA,'firstValue','pendingA','A'],[compareYearB,'secondValue','pendingB','B']]){
      summary.push({label:`Approved ${year}`,value:amount&&!approvedAmountReady()?'—':(amount?moneyNum:num)(sumValueRows(rows,key))});
      summary.push({label:`${amount?'Pending Quote':'Pending'} ${year}`,value:pendingTotal(rows.map(r=>({pending:r[pending],missing:r['missing'+suffix],known:r['known'+suffix]})),amount)});
    }
    setTotals(totals,summary);
    showPendingLegend(legend,[{label:`Approved ${compareYearA}`,color:'#156082'},
      {label:`${pendingLegend(amount)} ${compareYearA} · Created On`,color:'#e97132'},
      {label:`Approved ${compareYearB}`,color:'#62a9c8'},
      {label:`${pendingLegend(amount)} ${compareYearB} · Created On`,color:'#f4b183'}]);
    $(canvas).setAttribute('role','img');
    $(canvas).setAttribute('aria-label',`Approved by ${amount?amountDateLabel():approvedDateLabel()}; Pending by Created On. `+rows.map(r=>`${r.label}: ${compareYearA} Approved ${r.firstValue??'unavailable'}, Pending ${r.pendingA??'unavailable'}; ${compareYearB} Approved ${r.secondValue??'unavailable'}, Pending ${r.pendingB??'unavailable'}`).join('; '));
    if(amount)updatePendingNote(rows.map(r=>({missing:r.missingA+r.missingB})));
  }
}
async function ensurePendingExport(){
  await loadPendingTickets();
  if(pendingState.rows===null||pendingState.error)throw Error('Pending tickets unavailable. Refresh to retry.');
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
