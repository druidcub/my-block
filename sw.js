'use strict';
// Bump the version whenever a cached file changes. Install the whole release atomically.
const VERSION='2026-10-13-2';
const PREFIX='my-block:'+self.registration.scope+':';
const CACHE=PREFIX+VERSION;
const FILES=['index.html','style.css','game.js','penguin.js','audio.js','controller.js','touch.js','pwa.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png','LICENSE','THIRD_PARTY_NOTICES.md'];
const INDEX=new URL('index.html',self.registration.scope).href;
const ASSETS=new Set(FILES.map(file=>new URL(file,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil((async()=>{
  try{const cache=await caches.open(CACHE);await cache.addAll([...ASSETS].map(url=>new Request(url,{cache:'reload'})));}
  catch(error){await caches.delete(CACHE);throw error;}
  // Let existing game windows finish using their current release before updating.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url),scope=new URL(self.registration.scope);
  if(url.origin!==scope.origin)return;
  const clean=url.origin+url.pathname;
  const key=(clean===scope.href||clean===INDEX)?INDEX:clean;
  if(!ASSETS.has(key))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),saved=await cache.match(key);
    return saved||fetch(event.request);
  })());
});
