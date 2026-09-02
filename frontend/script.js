// AUTH is provided by auth-guard.js (loaded in <head>). Fallback if missing.
var AUTH = window.AUTH || { headers: function (x) { return x || {}; }, check: function (r) { return r; } };

// --------------- Common: Wallet/Top Bar ----------------
function refreshWalletUI(){
  fetch('/api/wallet', { headers: AUTH.headers() })
    .then(AUTH.check)
    .then(r=>r.json())
    .then(w=>{
      document.querySelectorAll('#topCoins,#plant-balance').forEach(el=>{
        if(!el) return;
        if(el.id==='topCoins') el.textContent = `${w.coins} EcoCoins`;
        if(el.id==='plant-balance') el.textContent = `Available Balance: ${w.coins} EcoCoins`;
      });
      const c=document.getElementById('w-current');   if(c) c.textContent=w.coins;
      const e=document.getElementById('w-earned');    if(e) e.textContent=w.totalEarned||0;
      const u=document.getElementById('w-redeemed');  if(u) u.textContent=w.totalRedeemed||0;
      const tx=document.getElementById('tx-list');
      if(tx){
        tx.innerHTML=(w.transactions||[]).slice(0,8).map(t=>`
          <div class="row">
            <div>${new Date(t.at).toLocaleDateString()} — ${t.note||t.type}</div>
            <div class="delta ${t.amount<0?'minus':'plus'}">
              ${t.amount<0?'-':'+'}${Math.abs(t.amount)} EcoCoins
            </div>
          </div>
        `).join('') || '<div class="kv">No transactions yet</div>';
      }
    })
    .catch(()=>{});
}
refreshWalletUI();

// --------------- Buy Page: render products --------------
const productsEl=document.getElementById('products');
if(productsEl){
  fetch('/api/products', { headers: AUTH.headers() })
    .then(AUTH.check)
    .then(r=>r.json())
    .then(list=>{
      const fb=[
        'https://www.sailsandcanvas.co.uk/wp-content/uploads/2022/01/Tote-Bag-Mix-Group.jpg',
        'https://images.unsplash.com/photo-1516542076529-1ea3854896e1',
        'https://images.unsplash.com/photo-1520614073990-dd602f8e3f68'
      ];
      productsEl.innerHTML=list.map((p,i)=>`
        <div class="card">
          <img class="card-img" src="${(p.imageUrl||fb[i%fb.length])+'?auto=format&fit=crop&w=900&q=60'}" alt="${p.name}">
          <div class="meta"><h3>${p.name}</h3><span class="tag">₹${p.price}</span></div>
          <div class="kv">${p.ecoImpact||''}</div>
          <button class="btn" onclick="buyProduct(${p.id||0}, ${p.price})">Buy Now</button>
        </div>
      `).join('');
    });
}

// Money purchase → reward coins based on price (1 coin per ₹10)
function buyProduct(productId, price){
  fetch('/api/buy', {
    method:'POST',
    headers: AUTH.headers({'Content-Type':'application/json'}),
    body: JSON.stringify({ productId, price })
  })
  .then(AUTH.check)
  .then(r=>r.json())
  .then(res=>{
    if(!res.success && res.message){ alert(res.message); return; }
    const earned = res.earned ?? 0;
    alert(`Purchased with money! +${earned} EcoCoins added.`);
    refreshWalletUI();
  })
  .catch(()=>alert('Purchase failed'));
}

// --------------- Sell Page: handle upload ---------------
const sellForm=document.getElementById('sellForm');
if(sellForm){
  sellForm.addEventListener('submit',e=>{
    e.preventDefault();
    const formData = new FormData(sellForm); // includes file
    fetch('/api/products',{
      method:'POST',
      headers: AUTH.headers(), // Authorization only; let the browser set the multipart boundary
      body: formData
    })
    .then(AUTH.check)
    .then(r=>r.json())
    .then(res=>{
      if(res.success){ alert('Product uploaded'); sellForm.reset(); }
      else{ alert(res.message||'Upload failed'); }
    })
    .catch(()=>alert('Upload failed'));
  });
}

// --------------- Plant Store: render & redeem -----------
const plantGrid=document.getElementById('plant-grid');
if(plantGrid){
  const plants=[
    {name:'Tulsi Plant',  cost:50,  img:'https://dukaan.b-cdn.net/700x700/webp/media/722bba29-89b6-48df-a17a-6c4a10fedb47.png'},
    {name:'Neem Sapling', cost:100, img:'https://nurserylive.com/cdn/shop/products/nurserylive-g-neem-tree-azadirachta-indica-plant_512x512.jpg?v=1634224777'},
    {name:'Aloe Vera Plant', cost:30, img:'https://unlimitedgreens.com/cdn/shop/products/Aloe-Vera-Website-Front.webp?v=1676457070'},
    {name:'Money Plant',   cost:40, img:'https://i0.wp.com/gachwala.in/wp-content/uploads/2022/06/IMAGE-1-15.webp?fit=1500%2C1500&ssl=1'},
    {name:'Snake Plant',   cost:60, img:'https://images.unsplash.com/photo-1501004318641-b39e6451bec6'},
    {name:'Bamboo Plant',  cost:80, img:'https://nurserylive.com/cdn/shop/products/nurserylive-plants-3-layer-lucky-bamboo-plant-in-a-bowl-with-pebbles-1-383367_512x683.jpg?v=1679748420'}
  ];
  plantGrid.innerHTML=plants.map(p=>`
    <div class="card">
      <img class="card-img" src="${p.img+'?auto=format&fit=crop&w=900&q=60'}" alt="${p.name}">
      <div class="meta"><h3>${p.name}</h3><span class="tag">${p.cost} Coins</span></div>
      <div class="kv">Healthy, easy‑care plant for home</div>
      <button class="btn" onclick="redeem('${p.name}', ${p.cost})">Redeem</button>
    </div>
  `).join('');
}

function redeem(plantName, plant_price){
  fetch('/api/redeem',{
    method:'POST',
    headers: AUTH.headers({'Content-Type':'application/json'}),
    body: JSON.stringify({ plantName, plant_price })
  })
  .then(AUTH.check)
  .then(r=>r.json())
  .then(res=>{
    if(!res.success && res.message){ alert(res.message); return; }
    alert('Redeemed!');
    refreshWalletUI();
  })
  .catch(()=>alert('Redeem failed'));
}
