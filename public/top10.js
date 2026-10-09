(() => {
  'use strict';const $=id=>document.getElementById(id),num=n=>new Intl.NumberFormat('en-AU').format(n),el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};let data,exportRows=[];
  function months(){const old=$('month').value;$('month').replaceChildren(new Option('All months','all'));for(const r of data.monthly.filter(r=>r.month.startsWith($('year').value+'-')))$('month').append(new Option(new Date(r.month+'-01').toLocaleString('en-AU',{month:'short',timeZone:'UTC'}),r.month));$('month').value=[...$('month').options].some(o=>o.value===old)?old:'all';}
  function render(){
    const year=$('year').value,period=$('month').value==='all'?year:$('month').value,level=Number($('level').value),index=$('metric').value==='issues'?3:4;
    const rows=data.rankings.filter(r=>r[0].startsWith(period)&&r[1]===level),map=new Map();for(const r of rows)map.set(r[2],(map.get(r[2])||0)+r[index]);
    const monthly=data.monthly.filter(r=>r.month.startsWith(period)),total=monthly.reduce((n,r)=>n+r[index===3?'approvedIssues':'approvedClaims'],0),unknown=monthly.reduce((n,r)=>n+r.approvalUnknown,0);
    const top=[...map].filter(([name])=>!['other','others','unclassified','labour','labor','9997'].includes(name.toLowerCase())).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,10);
    $('status').textContent=`${num(total)} approved ${$('metric').value} · ${period}`+(unknown?` · ${num(unknown)} Claims with unknown approval excluded`:'');
    const target=$('top-grid');target.replaceChildren();exportRows=[['Category','Approved '+$('metric').value,'Share','Period','Level']];
    const monthKeys=data.monthly.filter(r=>r.month.startsWith(year+'-')).map(r=>r.month).sort();
    top.forEach(([name,n],rank)=>{
      const card=el('section','panel top-card'),heading=el('div','panel-heading');heading.append(el('h2','',`${rank+1}. ${name}`));card.append(heading);
      const stats=el('div','top-stats');stats.append(el('strong','',num(n)),el('span','muted',(total?(100*n/total).toFixed(1):'0.0')+'%'));card.append(stats);
      const values=monthKeys.map(m=>({month:m,count:data.rankings.filter(r=>r[0]===m&&r[1]===level&&r[2]===name).reduce((sum,r)=>sum+r[index],0)}));
      const max=Math.max(1,...values.map(r=>r.count)),chart=el('div','top-bars');chart.style.gridTemplateColumns=`repeat(${values.length},minmax(0,1fr))`;
      for(const [i,r] of values.entries()){const b=el('button','top-month'+(r.month===period?' selected':''));b.title=`${r.month} · ${num(r.count)} approved ${$('metric').value}`;b.setAttribute('aria-label',b.title);const track=el('span','top-track'),bar=el('i');bar.style.height=(r.count/max*100)+'%';track.append(bar);b.append(track,el('span','',String(Number(r.month.slice(5)))));b.onclick=()=>{$('month').value=period===r.month?'all':r.month;render();};chart.append(b);}card.append(chart);
      const footer=el('div','top-caption');footer.append(el('span','',new Date(monthKeys[0]+'-01').toLocaleString('en-AU',{month:'short',timeZone:'UTC'})+' '+year),el('span','',new Date(monthKeys.at(-1)+'-01').toLocaleString('en-AU',{month:'short'})+' '+year));card.append(footer);target.append(card);
      exportRows.push([name,n,total?(100*n/total).toFixed(1)+'%':'—',period,level]);
    });if(!top.length)target.append(el('p','empty','No approved Issues in this period.'));$('export').disabled=false;document.documentElement.dataset.top10ReadyMs=performance.now().toFixed(1);
  }
  async function load(){try{await window.PDVData.load((value,meta,mode)=>{data=value;const previous=$('year').value;const years=[...new Set(data.monthly.filter(r=>/^\d{4}-\d{2}$/.test(r.month)).map(r=>r.month.slice(0,4)))].sort().reverse();$('year').replaceChildren(...years.map(y=>new Option(y,y)));if(years.includes(previous))$('year').value=previous;months();render();$('updated').textContent='Updated '+new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'Australia/Sydney'}).format(new Date(data.generatedAt))+(mode==='offline'?' · Saved Firebase data':'');});}catch(e){$('status').textContent='Firebase data unavailable. '+e.message;}}

  $('year').onchange=()=>{months();render();};for(const id of ['month','metric','level'])$(id).onchange=render;
  $('export').onclick=async()=>{const rows=exportRows.map(r=>[...r]);$('export').disabled=true;try{await window.PDVExport([{name:'Scope',rows:[['Created On from (inclusive)','2026-09-09']]},{name:'Top 10',rows}],'pdv-approved-top10.xlsx');}catch(e){$('status').textContent='Export failed: '+e.message;}finally{$('export').disabled=false;}};
  load();document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});setInterval(()=>{if(!document.hidden)load();},300000);
})();
