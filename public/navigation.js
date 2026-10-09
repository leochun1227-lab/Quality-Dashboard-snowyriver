(() => {
  const current = location.pathname.split('/').pop() || 'index.html';
  const nav = document.createElement('nav');nav.className='site-nav';nav.setAttribute('aria-label','Dashboard pages');
  const links=document.createElement('div');links.className='site-links';nav.append(links);
  const brand=document.createElement('a');brand.href='index.html';brand.className='site-brand';brand.textContent='PDV · Quality';links.append(brand);
  const pages=[['index.html','Pre Delivery Overview'],['infieldpredelivery.html','Claim Trend Overview'],['parts.html','Top10 Failure Parts']];
  for(const [url,title] of pages){const a=document.createElement('a');a.href=url;a.textContent=title;if(current===url)a.setAttribute('aria-current','page');links.append(a);}
  const controls=document.querySelector('.overview-head,.toolbar');
  const levels=document.getElementById('level-switch');
  if(levels){nav.classList.add('with-level-switch');nav.append(levels);}
  if(controls){controls.classList.add('site-controls');nav.append(controls);}
  if(controls){const scope=document.createElement('span');scope.className='pdv-date-scope';scope.textContent='Created On ≥ 9 Sep 2026';scope.title='All three pages and exports include Claims created on or after 9 September 2026 (inclusive). September starts on the 9th.';controls.prepend(scope);}
  document.body.prepend(nav);
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
