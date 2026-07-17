import { db } from './customer-firebase.js';
import { collection, getDocs, orderBy, query, where } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const state = { stores: [], activeStoreId: null, activeCategory: 'all', activeTab: 'darkstore', search: '', cart: {}, quantities: {} };
const categories = [['all','All Stores'],['grocery','Grocery'],['medical-pharmacy','Medical & Pharmacy'],['fruits-vegetables','Fruits & Vegetables'],['restaurant-cafe','Restaurant & Cafe'],['bakery','Bakery'],['dairy','Dairy'],['electronics','Electronics'],['stationery','Stationery']];
const navTabs = [['darkstore','Dark Store','⌂'],['orders','Orders','▤'],['track','Track','⌖'],['profile','Profile','○']];

function slug(value=''){return String(value).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function money(v){return `₹${Math.round(Number(v)||0)}`}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}
function empty(icon,title,sub){return `<div class="view empty-state"><div class="emoji">${icon}</div><div class="title">${title}</div><div class="sub">${sub}</div></div>`}
function iconFor(store){return ({grocery:'🛒','medical-pharmacy':'✚','fruits-vegetables':'🥬','restaurant-cafe':'🍽️',bakery:'🥐',dairy:'🥛',electronics:'⌁',stationery:'✎'})[slug(store.category)]||'QK'}

async function loadCatalog(){
  $('appMain').innerHTML=empty('QK','Loading nearby stores','Fetching live merchant catalog…');
  try{
    const storeSnap=await getDocs(query(collection(db,'stores'),where('isOpen','==',true)));
    const stores=await Promise.all(storeSnap.docs.map(async d=>{
      const data=d.data();
      const productSnap=await getDocs(query(collection(db,'stores',d.id,'products'),orderBy('createdAt','desc'))).catch(()=>getDocs(collection(db,'stores',d.id,'products')));
      const products=productSnap.docs.map(p=>({id:p.id,...p.data()})).filter(p=>p.isActive!==false&&p.isAvailable!==false&&Number(p.stockQuantity||0)>0).map(p=>({
        id:p.id,name:p.name||'Product',unit:p.unit||'',price:Number(p.sellingPrice??p.price??0),mrp:Number(p.mrp||0)||null,stock:Number(p.stockQuantity||0),category:p.category||'',brand:p.brand||'',imageUrl:p.imageUrl||''
      }));
      return {id:d.id,merchantId:data.merchantId||'',name:data.name||'MyQK Store',category:data.category||'Other',desc:data.description||'Local store on MyQK',rating:Number(data.rating||0),address:data.address?.fullAddress||data.address||'',location:data.location||null,deliveryTime:data.deliveryTime||'20–35 mins',products};
    }));
    state.stores=stores.filter(s=>s.products.length);
    renderCategories();renderMain();
  }catch(error){console.error(error);$('appMain').innerHTML=empty('!','Stores could not load','Check Firebase rules and try again.');toast('Live catalog load nahi hua.');}
}

function renderCategories(){const el=$('categoryNav');el.innerHTML=categories.map(([id,label])=>`<button class="chip ${state.activeCategory===id?'active':''}" data-category="${id}" type="button">${label}</button>`).join('')}
function filteredStores(){let list=state.stores;if(state.activeCategory!=='all')list=list.filter(s=>slug(s.category)===state.activeCategory);return list}
function storeCard(s){return `<button class="store-card" data-store="${s.id}" type="button"><span class="store-thumb">${iconFor(s)}</span><span class="store-info"><span class="store-name">${escapeHtml(s.name)}</span><span class="store-desc">${escapeHtml(s.desc)}</span><span class="store-meta"><span class="store-time">${escapeHtml(s.deliveryTime)}</span><span class="store-rating">★ ${s.rating? s.rating.toFixed(1):'New'}</span></span></span></button>`}
function productCard(p,store){const q=state.quantities[`${store.id}:${p.id}`]||1;return `<article class="product-card" data-product="${p.id}" data-store-id="${store.id}"><div class="product-thumb">${p.imageUrl?`<img src="${escapeHtml(p.imageUrl)}" alt="">`:'▣'}</div><div class="product-info"><div class="product-name">${escapeHtml(p.name)}</div><div class="product-unit">${escapeHtml(p.unit)}</div><div class="product-price">${money(p.price)}${p.mrp>p.price?`<span class="strike">${money(p.mrp)}</span>`:''}</div></div><div class="product-actions"><div class="stepper"><button class="quantity-minus" type="button">−</button><span class="qty">${q}</span><button class="quantity-plus" type="button">+</button></div><div class="action-row"><button class="action-btn add-btn" type="button">Add</button><button class="action-btn buy-btn" type="button">Buy Now</button></div></div></article>`}
function renderMain(){if(state.activeTab!=='darkstore')return;if(state.search.trim())return renderSearch();if(state.activeStoreId)return renderProducts();const list=filteredStores();$('appMain').innerHTML=list.length?`<div class="view"><h2 class="section-title">Stores near you</h2><div class="store-list">${list.map(storeCard).join('')}</div></div>`:empty('⌂','No live stores yet','Merchant stores will appear here after products are added.')}
function renderProducts(){const store=state.stores.find(s=>s.id===state.activeStoreId);if(!store){state.activeStoreId=null;return renderMain()}$('appMain').innerHTML=`<div class="view"><div class="store-banner"><button class="round-back" id="storeBack" type="button">‹</button><div class="banner-icon">${iconFor(store)}</div><div><div class="banner-name">${escapeHtml(store.name)}</div><div class="banner-meta">${escapeHtml(store.deliveryTime)} · ${store.rating?`★ ${store.rating.toFixed(1)}`:'New store'}</div></div></div><div class="product-list">${store.products.map(p=>productCard(p,store)).join('')}</div></div>`}
function renderSearch(){const q=state.search.trim().toLowerCase();const stores=state.stores.filter(s=>`${s.name} ${s.desc} ${s.category}`.toLowerCase().includes(q));const products=[];state.stores.forEach(s=>s.products.forEach(p=>{if(`${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q))products.push({s,p})}));$('appMain').innerHTML=stores.length||products.length?`<div class="view">${stores.length?`<h2 class="section-title">Stores</h2><div class="store-list">${stores.map(storeCard).join('')}</div>`:''}${products.length?`<h2 class="section-title" style="margin-top:20px">Products</h2><div class="product-list">${products.map(x=>productCard(x.p,x.s)).join('')}</div>`:''}</div>`:empty('⌕','No results','Try another product or store name.')}
function cartKey(storeId,productId){return `${storeId}:${productId}`}
function addToCart(store,product,qty){const existingStores=new Set(Object.values(state.cart).map(x=>x.store.id));if(existingStores.size&&!existingStores.has(store.id)){toast('Ek order me ek hi store ke products add kar sakte ho.');return false}const key=cartKey(store.id,product.id);state.cart[key]=state.cart[key]?{...state.cart[key],quantity:Math.min(product.stock,state.cart[key].quantity+qty)}:{store,product,quantity:Math.min(product.stock,qty)};updateBadge();return true}
function updateBadge(){const count=Object.values(state.cart).reduce((n,x)=>n+x.quantity,0);$('cartBadge').textContent=count;$('cartBadge').classList.toggle('show',count>0)}
function renderCart(){const items=Object.values(state.cart);$('cartFooter').style.display=items.length?'':'none';if(!items.length){$('cartBody').innerHTML=empty('🛒','Your cart is empty','Add products from a merchant store.');return}$('cartBody').innerHTML=`<div class="product-list">${items.map(({store,product,quantity})=>`<article class="product-card" data-cart-product="${cartKey(store.id,product.id)}" data-store-id="${store.id}" data-merchant-id="${store.merchantId}" data-store-name="${escapeHtml(store.name)}" data-store-address="${escapeHtml(store.address)}" data-store-latitude="${store.location?.latitude??''}" data-store-longitude="${store.location?.longitude??''}" data-product-id="${product.id}" data-unit-price="${product.price}"><div class="product-thumb">▣</div><div class="product-info"><div class="product-name">${escapeHtml(product.name)}</div><div class="product-unit">${escapeHtml(product.unit)}</div><span class="product-store-tag">${escapeHtml(store.name)}</span><div class="product-price">${money(product.price*quantity)}</div></div><div class="product-actions"><div class="stepper"><button class="cart-minus" type="button">−</button><span class="qty">${quantity}</span><button class="cart-plus" type="button">+</button></div></div></article>`).join('')}</div>`;$('cartTotal').textContent=money(items.reduce((n,x)=>n+x.product.price*x.quantity,0))}
function openCart(){renderCart();$('cartOverlay').classList.add('open')}
function renderNav(){$('bottomNav').innerHTML=navTabs.map(([id,label,icon])=>`<button class="nav-item ${state.activeTab===id?'active':''}" data-tab="${id}" type="button"><span>${icon}</span><span class="nav-label">${label}</span><span class="nav-dot"></span></button>`).join('')}
function switchTab(tab){state.activeTab=tab;renderNav();$('searchWrap').style.display=tab==='darkstore'?'':'none';$('categoryNav').style.display=tab==='darkstore'&&!state.search?'':'none';if(tab==='darkstore')renderMain();else if(tab==='profile')$('appMain').innerHTML=empty('○','Customer profile','Your account and saved details appear here.');else $('appMain').innerHTML=empty(tab==='orders'?'▤':'⌖',tab==='orders'?'No orders yet':'Nothing to track',tab==='orders'?'Your order history will appear here.':'Your active delivery will appear here.')}

function hasSavedLocation(){
  const latitude=Number.parseFloat(localStorage.getItem('qkLatitude'));
  const longitude=Number.parseFloat(localStorage.getItem('qkLongitude'));
  const address=localStorage.getItem('qkLiveLocation')?.trim();
  return Number.isFinite(latitude)&&Number.isFinite(longitude)&&Boolean(address);
}

function openLocationSheet(){
  $('locationSheet').classList.add('show');
  $('allowLocationBtn').classList.remove('hidden');
  $('allowLocationBtn').disabled=false;
  $('allowLocationBtn').textContent='Give location access';
  $('manualAddressBox').classList.add('hidden');
  $('detectedLocationBox').classList.add('hidden');
  $('locationStatus').textContent='Tap Give location access to detect your area.';
}

async function reverseGeocode(latitude,longitude){
  try{
    const url=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`;
    const response=await fetch(url,{headers:{'Accept':'application/json'}});
    if(!response.ok)throw new Error(`Reverse geocoding failed: ${response.status}`);
    const data=await response.json();
    const a=data.address||{};
    const parts=[a.road||a.pedestrian||a.neighbourhood||a.suburb,a.city||a.town||a.village||a.county,a.state,a.postcode].filter(Boolean);
    return parts.join(', ')||data.display_name||`${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
  }catch(error){
    console.warn('Reverse geocoding failed:',error);
    return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
  }
}

function requestCustomerLocation(){
  $('locationSheet').classList.add('show');
  $('allowLocationBtn').disabled=true;
  $('allowLocationBtn').textContent='Detecting location…';
  $('locationStatus').textContent='Detecting your current location…';
  if(!navigator.geolocation){
    $('manualAddressBox').classList.remove('hidden');
    $('locationStatus').textContent='Location is not supported. Please enter your address manually.';
    $('allowLocationBtn').disabled=false;
    $('allowLocationBtn').textContent='Give location access';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async position=>{
      const {latitude,longitude}=position.coords;
      localStorage.setItem('qkLatitude',String(latitude));
      localStorage.setItem('qkLongitude',String(longitude));
      $('allowLocationBtn').classList.add('hidden');
      $('detectedLocationBox').classList.remove('hidden');
      $('detectedLocationText').textContent='Finding address…';
      $('manualAddressBox').classList.remove('hidden');
      $('locationStatus').textContent='Location detected. Add your exact delivery address.';
      const detectedAddress=await reverseGeocode(latitude,longitude);
      $('detectedLocationText').textContent=detectedAddress;
      localStorage.setItem('qkDetectedLocation',detectedAddress);
    },
    error=>{
      console.warn('Location request failed:',error);
      $('manualAddressBox').classList.remove('hidden');
      $('locationStatus').textContent='Location permission was not granted. Enter your address manually or try again.';
      $('allowLocationBtn').disabled=false;
      $('allowLocationBtn').textContent='Try location access again';
      toast('Location permission required.');
    },
    {enableHighAccuracy:true,timeout:12000,maximumAge:60000}
  );
}

document.addEventListener('click',e=>{const category=e.target.closest('[data-category]');if(category){state.activeCategory=category.dataset.category;state.activeStoreId=null;renderCategories();renderMain();return}const storeEl=e.target.closest('[data-store]');if(storeEl){state.activeStoreId=storeEl.dataset.store;state.search='';$('searchInput').value='';renderMain();return}if(e.target.closest('#storeBack')){state.activeStoreId=null;renderMain();return}const card=e.target.closest('[data-product][data-store-id]');if(card){const store=state.stores.find(s=>s.id===card.dataset.storeId);const product=store?.products.find(p=>p.id===card.dataset.product);if(!product)return;const key=cartKey(store.id,product.id);if(e.target.closest('.quantity-minus')){state.quantities[key]=Math.max(1,(state.quantities[key]||1)-1);card.querySelector('.qty').textContent=state.quantities[key]}if(e.target.closest('.quantity-plus')){state.quantities[key]=Math.min(product.stock,(state.quantities[key]||1)+1);card.querySelector('.qty').textContent=state.quantities[key]}if(e.target.closest('.add-btn,.buy-btn')){const qty=state.quantities[key]||1;if(addToCart(store,product,qty)){state.quantities[key]=1;card.querySelector('.qty').textContent='1';toast(`${qty} × ${product.name} added`);if(e.target.closest('.buy-btn'))openCart()}}return}const cartCard=e.target.closest('[data-cart-product]');if(cartCard){const key=cartCard.dataset.cartProduct;if(e.target.closest('.cart-minus')){state.cart[key].quantity--;if(state.cart[key].quantity<=0)delete state.cart[key];updateBadge();renderCart()}if(e.target.closest('.cart-plus')){state.cart[key].quantity=Math.min(state.cart[key].product.stock,state.cart[key].quantity+1);updateBadge();renderCart()}return}const tab=e.target.closest('[data-tab]');if(tab)switchTab(tab.dataset.tab)});

document.addEventListener('DOMContentLoaded',()=>{
  $('searchInput').addEventListener('input',e=>{state.search=e.target.value;$('searchClear').classList.toggle('show',!!state.search);$('categoryNav').style.display=state.search?'none':'';renderMain()});
  $('searchClear').addEventListener('click',()=>{state.search='';$('searchInput').value='';$('searchClear').classList.remove('show');$('categoryNav').style.display='';renderMain()});
  $('cartBtn').addEventListener('click',openCart);$('cartClose').addEventListener('click',()=>$('cartOverlay').classList.remove('open'));
  $('locationBtn').addEventListener('click',openLocationSheet);
  $('locationClose').addEventListener('click',()=>{if(hasSavedLocation())$('locationSheet').classList.remove('show');else toast('Delivery location select karna required hai.');});
  $('allowLocationBtn').addEventListener('click',requestCustomerLocation);
  $('saveAddressBtn').addEventListener('click',()=>{const exactAddress=[$('houseInput').value,$('streetInput').value].filter(Boolean).join(', ');if(!exactAddress)return toast('Exact address add karo.');const detected=localStorage.getItem('qkDetectedLocation')?.trim();const fullAddress=[exactAddress,detected].filter(Boolean).join(', ');localStorage.setItem('qkLiveLocation',fullAddress);$('locationAddress').textContent=fullAddress;$('locationSheet').classList.remove('show')});
  const savedAddress=localStorage.getItem('qkLiveLocation')?.trim();
  if(savedAddress)$('locationAddress').textContent=savedAddress;
  renderCategories();renderNav();loadCatalog();
  if(!hasSavedLocation())setTimeout(openLocationSheet,250);
});