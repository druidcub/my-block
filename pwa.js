(() => {
  'use strict';
  const status=document.getElementById('pwa-status'),button=document.getElementById('pwa-install');
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  let installPrompt=null;
  function instructions(){
    status.textContent=standalone()?'已從主畫面開啟。首次連網準備完成後，就能離線玩。':'Android：瀏覽器選單選「安裝應用程式」；iPhone / iPad：Safari 分享選單選「加入主畫面」，並開啟「作為網頁 App 開啟」（若有此選項）。';
  }
  instructions();
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(!standalone())button.classList.remove('hidden');});
  button.addEventListener('click',async()=>{
    if(!installPrompt)return;
    const prompt=installPrompt;installPrompt=null;button.classList.add('hidden');
    try{await prompt.prompt();await prompt.userChoice;}catch{instructions();}
  });
  window.addEventListener('appinstalled',()=>{installPrompt=null;button.classList.add('hidden');status.textContent='已加入主畫面！你可以用企鵝圖示開啟遊戲。';});
  if(!('serviceWorker' in navigator)||!['https:','http:'].includes(location.protocol)){
    status.textContent='安裝與離線功能請使用線上版；下載的本機檔案仍可直接遊玩。';return;
  }
  window.addEventListener('load',async()=>{
    try{
      const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
      const ready=()=>{status.textContent='已準備好離線遊玩。'+(standalone()?'':'可加入主畫面，從企鵝圖示開啟；安裝方式見下方。');};
      const waiting=()=>{status.textContent='新版已準備好，關閉所有遊戲視窗後再開啟即可更新；作品仍會保留。';};
      navigator.serviceWorker.ready.then(activeRegistration=>{if(activeRegistration.scope===registration.scope){if(registration.waiting)waiting();else ready();}});
      if(registration.waiting)waiting();
      const watch=worker=>{if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='activated')ready();else if(worker.state==='installed'&&navigator.serviceWorker.controller)waiting();});};
      watch(registration.installing);
      registration.addEventListener('updatefound',()=>watch(registration.installing));
    }catch{status.textContent='離線準備尚未完成，請保持連線後重新開啟。你仍可以在線上玩。';}
  });
})();
