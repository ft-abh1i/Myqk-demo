import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { addDoc, collection, getFirestore, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyDbNDNI1a69VDZmLo7Se6LNGPLD6A8_MmE',
  authDomain: 'buyqk-rider.firebaseapp.com',
  projectId: 'buyqk-rider',
  storageBucket: 'buyqk-rider.firebasestorage.app',
  messagingSenderId: '61147606971',
  appId: '1:61147606971:web:d69dd4fcf5c0a0fea01e9e'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
let resolveAuth;
export const authReady = new Promise(resolve => { resolveAuth = resolve; });
onAuthStateChanged(auth, async user => {
  if (user) return resolveAuth(user);
  try { resolveAuth((await signInAnonymously(auth)).user); }
  catch (error) { console.error('Anonymous sign-in failed:', error); resolveAuth(null); }
});

const numberFromStorage = key => { const v=Number.parseFloat(localStorage.getItem(key)); return Number.isFinite(v)?v:null; };
const numberFromDataset = (el,key) => { const v=Number.parseFloat(el?.dataset?.[key]); return Number.isFinite(v)?v:0; };
function showError(message){const box=document.getElementById('checkoutError');if(box){box.textContent=message;box.classList.remove('hidden')}const toast=document.getElementById('toast');if(toast){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3000)}}
function clearError(){const box=document.getElementById('checkoutError');if(box){box.textContent='';box.classList.add('hidden')}}
function customer(){const name=document.getElementById('customerNameInput')?.value.trim()||'';const phone=document.getElementById('customerPhoneInput')?.value.replace(/\D/g,'')||'';if(name.length<2)throw new Error('Please enter the customer name.');if(!/^[6-9]\d{9}$/.test(phone))throw new Error('Enter a valid 10-digit mobile number.');localStorage.setItem('qkCustomerName',name);localStorage.setItem('qkCustomerPhone',phone);return{name,phone}}
function dropLocation(){const latitude=numberFromStorage('qkLatitude');const longitude=numberFromStorage('qkLongitude');const address=localStorage.getItem('qkLiveLocation')?.trim();if(latitude===null||longitude===null||!address)throw new Error('Select your delivery location before placing the order.');return{latitude,longitude,address}}
function cartSummary(){
  const cards=[...document.querySelectorAll('#cartBody [data-cart-product]')];
  if(!cards.length)throw new Error('Your cart is empty.');
  const first=cards[0];
  const storeId=first.dataset.storeId||'';const merchantId=first.dataset.merchantId||'';
  if(!storeId||!merchantId)throw new Error('Store information is missing. Reload and try again.');
  if(cards.some(c=>c.dataset.storeId!==storeId))throw new Error('One order can contain products from only one store.');
  const items=cards.map(card=>{const quantity=Number.parseInt(card.querySelector('.qty')?.textContent||'1',10)||1;const unitPrice=Number(card.dataset.unitPrice||0);return{productId:card.dataset.productId||'',name:card.querySelector('.product-name')?.textContent?.trim()||'Item',unit:card.querySelector('.product-unit')?.textContent?.trim()||'',quantity,unitPrice,lineTotal:unitPrice*quantity}});
  return {storeId,merchantId,storeName:first.dataset.storeName||'MyQK Store',storeAddress:first.dataset.storeAddress||'',storeLocation:{latitude:Number(first.dataset.storeLatitude),longitude:Number(first.dataset.storeLongitude)},items,itemCount:items.reduce((n,i)=>n+i.quantity,0)};
}

async function createOrder(){
  const user=await authReady;if(!user)throw new Error('Could not connect to Firebase. Please retry.');
  const cart=cartSummary();const c=customer();const drop=dropLocation();const footer=document.getElementById('cartFooter');
  return addDoc(collection(db,'orders'),{
    orderNumber:`QK${Date.now().toString().slice(-6)}`,
    customerId:user.uid,customerName:c.name,customerPhone:c.phone,
    merchantId:cart.merchantId,storeId:cart.storeId,storeName:cart.storeName,
    status:'pending_merchant',assignedRiderId:null,
    pickup:{name:cart.storeName,address:cart.storeAddress||`${cart.storeName} pickup`,location:cart.storeLocation},
    drop:{name:c.name,address:drop.address,location:{latitude:drop.latitude,longitude:drop.longitude}},
    items:cart.items,itemCount:cart.itemCount,paymentMode:'Cash on Delivery',
    subtotal:numberFromDataset(footer,'subtotal'),deliveryFee:numberFromDataset(footer,'deliveryFee'),platformFee:numberFromDataset(footer,'platformFee'),totalAmount:numberFromDataset(footer,'payable'),
    riderPayout:42,createdAt:serverTimestamp(),updatedAt:serverTimestamp()
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  const button=document.getElementById('checkoutBtn');if(!button)return;
  document.getElementById('customerNameInput').value=localStorage.getItem('qkCustomerName')||'';
  document.getElementById('customerPhoneInput').value=localStorage.getItem('qkCustomerPhone')||'';
  button.addEventListener('click',async event=>{
    event.preventDefault();event.stopImmediatePropagation();clearError();button.disabled=true;button.textContent='Placing order…';
    try{const ref=await createOrder();localStorage.setItem('qkLatestOrderId',ref.id);document.getElementById('cartOverlay')?.classList.remove('open');const toast=document.getElementById('toast');if(toast){toast.textContent='Order sent to merchant!';toast.classList.add('show')}setTimeout(()=>document.querySelector('[data-tab="track"]')?.click(),250)}
    catch(error){console.error(error);showError(error.message||'Could not place order. Try again.')}finally{button.disabled=false;button.textContent='Proceed to Buy'}
  },true);
});