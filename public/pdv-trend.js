(() => {
  'use strict';
  let monthly, meta, metric='tickets',sourceState='checking', sourceDate='';
  let scope={viewMode:'single',activeStart:new Date().getFullYear()+'-01',activeEnd:new Date().getFullYear()+'-12',rangePreset:'year'};
  const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec'];
  const number=n=>Number(n).toLocaleString();
  const element=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  function months(start,end){
    const result=[];let [y,m]=start.split('-').map(Number);
    while(result.length<240){const key=y+'-'+String(m).padStart(2,'0');if(key>end)break;result.push(key);if(++m===13){m=1;y++;}}
    return result;
  }
  function chart(id,key){
    const target=document.getElementById(id);
    const end=scope.activeEnd;
    const keys=months(scope.activeStart<'2026-09'?'2026-09':scope.activeStart,end);
    const rows=keys.map(month=>({month,values:[monthly.get(month)?.[key]]}));
    const max=Math.max(1,...rows.flatMap(r=>r.values.map(v=>v||0)));
    target.replaceChildren();target.style.gridTemplateColumns=`repeat(${Math.max(1,rows.length)},minmax(0,1fr))`;
    target.style.minWidth=(rows.length>12?rows.length*48:0)+'px';
    rows.forEach(row=>{
      const col=element('div','month-column');
      const bars=element('span','month-bars');
      row.values.forEach((value,index)=>{
        const bar=element('i','');bar.style.height=((value||0)/max*100)+'%';
        bars.append(bar);
        const label=element('span','month-number',value===undefined?'':number(value));
        label.dataset.series=String(index);bars.append(label);
      });
      col.append(bars,element('span','month-name',names[Number(row.month.slice(5))-1]+(scope.activeStart.slice(0,4)!==end.slice(0,4)?' '+row.month.slice(2,4):'')));
      col.title=`${row.month}: ${row.values[0]??'No data'}`;
      target.append(col);
    });
    target.setAttribute('aria-label',`${key==='approvedClaims'?'Approved Claims':'Approved Issues / Defects'} · Pre Delivery · Created On. `+rows.map(r=>r.month+': '+r.values.map(v=>v===undefined?'No data':number(v)).join(' / ')).join('; '));
  }
  function render(next){
    if(next)scope=next;
    if(!monthly)return;
    chart('pdv-monthly-claims','approvedClaims');chart('pdv-monthly-issues','approvedIssues');
    const status=document.getElementById('pdv-monthly-status');
    status.replaceChildren();
    status.append(document.createTextNode(sourceState==='offline'?'Saved totals · Firebase unavailable':sourceState==='checking'?'Checking Firebase update…':'Approved Pre Delivery · Updated '+sourceDate));
    document.documentElement.dataset.pdvMonthlyReady='true';
  }
  function syncView(){
    const issues=metric==='issues';
    document.documentElement.dataset.trendMetric=metric;
    document.documentElement.dataset.claimView='single';
    document.getElementById('pdv-monthly-claims').closest('section').hidden=issues;
    document.getElementById('pdv-monthly-issues').closest('section').hidden=!issues;
    document.querySelector('.dashboardGrid').hidden=issues;
    for(const [id,active] of [['singleModeBtn',!issues],['compareModeBtn',issues]]){
      const button=document.getElementById(id);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    }
    document.getElementById('exportTicketsBtn').title=issues?'Export approved Issue details for the selected period':'Export Ticket details for the selected period';
  }
  function setView(value){metric=value;syncView();render();}
  async function exportIssues(){
    if(!monthly||!meta)return;
    const button=document.getElementById('exportTicketsBtn');button.disabled=true;
    const rows=[...monthly.values()].filter(row=>row.month>=scope.activeStart&&row.month<=scope.activeEnd);
    try{
      const details=(await Promise.all(rows.map(row=>window.PDVData.detail(meta.detailBase+row.month+'.json')))).flat().filter(r=>r[5]===true);
      if(details.length!==rows.reduce((sum,row)=>sum+row.approvedIssues,0))throw Error('Issue details differ from the summary. Refresh and retry.');
      await window.PDVExport([
        {name:'Scope',rows:[['Created On from (inclusive)','2026-09-09']]},
        {name:'Monthly Issues',rows:[['Month','Approved Issues','Approved Tickets'],...rows.map(r=>[r.month,r.approvedIssues,r.approvedClaims])]},
        {name:'Approved Issues',rows:[['Ticket','Issue','System','Component','Failure mode'],...details.map(r=>r.slice(0,5))]}
      ],`pdv-issues-${scope.activeStart}-to-${scope.activeEnd}.xlsx`);
    }catch(e){document.getElementById('pdv-monthly-status').textContent='Issue export unavailable: '+e.message;}
    finally{button.disabled=false;}
  }
  window.PDVTrend={render,syncView,setView,exportIssues};
  document.getElementById('singleModeBtn').onclick=()=>{setView('tickets');window.dispatchEvent(new Event('resize'));};
  document.getElementById('compareModeBtn').onclick=()=>setView('issues');
  syncView();
  // Reuse the overview summary and its small Firebase generation check.
  window.PDVData.load((data,snapshot,state)=>{
    meta=snapshot;
    monthly=new Map(data.monthly.map(row=>[row.month,row]));sourceState=state;
    sourceDate=new Date(meta.generatedAt).toLocaleString('en-AU',{dateStyle:'medium',timeStyle:'short'});
    render();
  }).catch(()=>{document.getElementById('pdv-monthly-status').textContent='Could not load approved monthly totals from Firebase. Please refresh to retry.';});
})();
