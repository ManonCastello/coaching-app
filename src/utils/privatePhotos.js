import {getStorage,ref,uploadBytes,getBlob,connectStorageEmulator} from 'firebase/storage';
import {auth,db} from '../firebase';

export const privatePhotosEnabled=process.env.REACT_APP_PRIVATE_PHOTOS==='true';
export const photoBucket=process.env.REACT_APP_PRIVATE_PHOTO_BUCKET||'';
export const MAX_PHOTO_BYTES=2*1024*1024;
const pathPattern=/^progress\/[^/]+\/(initial|weekly)\/[a-f0-9-]{36}\.jpg$/;
let storage;
function photoStorage(){
  if(!photoBucket)throw new Error('Le stockage privé des photos n’est pas encore activé.');
  if(!storage){
    storage=getStorage(db.app,`gs://${photoBucket}`);
    if(process.env.NODE_ENV==='development'&&process.env.REACT_APP_FIREBASE_EMULATORS==='true')connectStorageEmulator(storage,'127.0.0.1',9199);
  }
  return storage;
}
export function isPrivatePhoto(value){
  return !!value&&typeof value==='object'&&value.kind==='fitlog-private-photo'&&value.version===1&&
    value.bucket===photoBucket&&pathPattern.test(value.path);
}
export function isSavedPhoto(value){
  return isPrivatePhoto(value)||(typeof value==='string'&&value.startsWith('https://res.cloudinary.com/dduaqnygn/image/upload/'));
}
export async function preparePhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file?.type)||file.size<=0||file.size>20*1024*1024)throw new Error('Choisis une photo JPEG, PNG ou WebP de moins de 20 Mo.');
  const url=URL.createObjectURL(file);
  try{
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Cette photo ne peut pas être ouverte. Essaie un autre fichier.'));img.src=url;});
    if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>100000000)throw new Error('Cette photo est trop grande. Choisis une version plus légère.');
    const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('Le navigateur ne peut pas préparer cette photo.');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    // Re-encoding drops the original file name and EXIF metadata (including GPS).
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));
    if(!blob||blob.size>MAX_PHOTO_BYTES)throw new Error('La photo reste trop lourde. Choisis une version plus légère.');
    return blob;
  }finally{URL.revokeObjectURL(url);}
}
export async function uploadPrivatePhoto(file,{clientId,category}){
  if(!privatePhotosEnabled)throw new Error('Le stockage privé des photos n’est pas encore activé.');
  const uid=auth.currentUser?.uid;
  if(!uid)throw new Error('Connecte-toi avant d’ajouter une photo.');
  if(!clientId||clientId.includes('/')||!['initial','weekly'].includes(category))throw new Error('Destination photo invalide.');
  const blob=await preparePhoto(file);
  if(auth.currentUser?.uid!==uid)throw new Error('Le compte connecté a changé. Réessaie depuis ton profil.');
  const path=`progress/${clientId}/${category}/${crypto.randomUUID()}.jpg`;
  await uploadBytes(ref(photoStorage(),path),blob,{contentType:'image/jpeg',cacheControl:'private, max-age=0, no-store',customMetadata:{ownerId:clientId}});
  if(auth.currentUser?.uid!==uid)throw new Error('Le compte connecté a changé.');
  // Persist an object reference, never a public or bearer download URL.
  return {kind:'fitlog-private-photo',version:1,bucket:photoBucket,path};
}
export async function readPhotoBlob(value){
  if(isPrivatePhoto(value)){
    if(!auth.currentUser)throw new Error('Connexion nécessaire pour consulter cette photo.');
    return getBlob(ref(photoStorage(),value.path),MAX_PHOTO_BYTES);
  }
  if(isSavedPhoto(value)){
    const response=await fetch(value,{referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error('Photo indisponible.');
    return response.blob();
  }
  throw new Error('Référence photo invalide.');
}
