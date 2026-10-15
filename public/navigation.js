(() => {
  const current = location.pathname.split('/').pop() || 'index.html';
  const nav = document.createElement('header');nav.className='site-nav';
  const links=document.createElement('nav');links.className='site-sidebar';links.setAttribute('aria-label','Dashboard pages');
  const icon=paths=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${paths}</svg>`;
  const brand=document.createElement('a');brand.href='index.html';brand.className='site-brand';
  brand.innerHTML=`<span class="site-brand-mark">${icon('<path d="M4 5v14h16M8 16v-5m4 5V8m4 8v-3"/>')}</span><span><strong>After-Sales</strong><small>Service analytics</small></span>`;links.append(brand);
  const pages=[
    ['Workspace','index.html','Pre Delivery Overview','<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'],
    ['Tickets','infieldpredelivery.html','Claim Trend Overview','<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h7"/>'],
    ['Analysis','parts.html','Top10 Failure Parts','<path d="M4 7h16M7 7v10m10-10v10M5 17h14M9 11h6"/>']
  ];
  for(const [group,url,title,paths] of pages){
    const section=document.createElement('section');section.className='site-nav-section';
    const heading=document.createElement('h2');heading.textContent=group;section.append(heading);
    const a=document.createElement('a');a.href=url;a.className='site-nav-link';a.innerHTML=icon(paths);
    const label=document.createElement('span');label.textContent=title;a.append(label);
    if(current===url)a.setAttribute('aria-current','page');section.append(a);links.append(section);
  }
  const controls=document.querySelector('.overview-head,.toolbar');
  const levels=document.getElementById('level-switch');
  if(levels){nav.classList.add('with-level-switch');nav.append(levels);}
  if(controls){controls.classList.add('site-controls');nav.append(controls);}
  if(controls&&current!=='infieldpredelivery.html'){const scope=document.createElement('span');scope.className='pdv-date-scope';scope.textContent='Created On ≥ 9 Sep 2026';scope.title='This page and its exports include Claims created on or after 9 September 2026 (inclusive). September starts on the 9th.';controls.prepend(scope);}
  document.body.classList.add('with-site-sidebar');
  document.body.prepend(links,nav);
  const style=document.createElement('link');style.rel='stylesheet';style.href='navigation.css';document.head.append(style);
  let headerHeight=0;
  new ResizeObserver(()=>{
    const height=Math.ceil(nav.getBoundingClientRect().height);
    if(height===headerHeight)return;headerHeight=height;
    document.documentElement.style.setProperty('--site-header-height',height+'px');
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }).observe(nav);
  let exportLibrary;
  window.PDVExport=async(sheets,filename)=>{
    if(!window.FailurePartsExport){
      if(!exportLibrary)exportLibrary=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='parts-export.js';script.onload=resolve;script.onerror=()=>{exportLibrary=null;script.remove();reject(Error('Excel export could not be loaded'));};document.head.append(script);});
      await exportLibrary;
    }
    const blob=await window.FailurePartsExport.workbook(sheets),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
})();
