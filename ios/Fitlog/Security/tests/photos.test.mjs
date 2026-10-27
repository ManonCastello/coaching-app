import {before,after,test} from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc} from 'firebase/firestore';
import {ref,uploadBytes,getBytes,listAll,deleteObject,updateMetadata} from 'firebase/storage';
let env;
const bytes=new Uint8Array([255,216,255,217]); // Synthetic bytes only; no personal photo.
const metadata={contentType:'image/jpeg',cacheControl:'private, max-age=0, no-store',customMetadata:{ownerId:'photo-pupil'}};
const storage=uid=>uid?env.authenticatedContext(uid).storage():env.unauthenticatedContext().storage();
const path=()=>`progress/photo-pupil/initial/${randomUUID()}.jpg`;
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-fitlog-security',
  firestore:{host:'127.0.0.1',port:8188,rules:readFileSync(new URL('../firestore-validation.rules',import.meta.url),'utf8')},
  storage:{host:'127.0.0.1',port:9199,rules:readFileSync(new URL('../storage-private-photos.rules',import.meta.url),'utf8')}});
 await env.withSecurityRulesDisabled(async context=>{
  await setDoc(doc(context.firestore(),'coaches/photo-coach'),{role:'coach'});
  await setDoc(doc(context.firestore(),'coaches/photo-other-coach'),{role:'coach'});
  await setDoc(doc(context.firestore(),'coaches/photo-false-coach'),{role:'student'});
  await setDoc(doc(context.firestore(),'clients/photo-pupil'),{coachIds:['photo-coach','photo-false-coach']});
 });
});
after(()=>env.cleanup());
test('owner and exact assigned coach can read, anonymous and unrelated accounts cannot',async()=>{
 const name=path();await assertSucceeds(uploadBytes(ref(storage('photo-pupil'),name),bytes,metadata));
 for(const uid of ['photo-pupil','photo-coach'])await assertSucceeds(getBytes(ref(storage(uid),name)));
 for(const uid of [null,'photo-other-pupil','photo-other-coach','photo-false-coach'])await assertFails(getBytes(ref(storage(uid),name)));
});
test('removing the assignment revokes the next authenticated photo read',async()=>{
 const name=path();await assertSucceeds(uploadBytes(ref(storage('photo-pupil'),name),bytes,metadata));
 await assertSucceeds(getBytes(ref(storage('photo-coach'),name)));
 await env.withSecurityRulesDisabled(context=>updateDoc(doc(context.firestore(),'clients/photo-pupil'),{coachIds:[]}));
 try{await assertFails(getBytes(ref(storage('photo-coach'),name)));}
 finally{await env.withSecurityRulesDisabled(context=>updateDoc(doc(context.firestore(),'clients/photo-pupil'),{coachIds:['photo-coach','photo-false-coach']}));}
});
test('new uploads reject unrelated users, extra metadata, wrong type, size and names',async()=>{
 await assertFails(uploadBytes(ref(storage('photo-other-coach'),path()),bytes,metadata));
 await assertFails(uploadBytes(ref(storage(null),path()),bytes,metadata));
 for(const patch of [{contentType:'image/svg+xml'},{customMetadata:{ownerId:'other'}},{customMetadata:{ownerId:'photo-pupil',publicUrl:'forbidden-extra-field'}}])await assertFails(uploadBytes(ref(storage('photo-pupil'),path()),bytes,{...metadata,...patch}));
 await assertFails(uploadBytes(ref(storage('photo-pupil'),path()),new Uint8Array(2*1024*1024+1),metadata));
 await assertFails(uploadBytes(ref(storage('photo-pupil'),'progress/photo-pupil/initial/firstname-lastname.jpg'),bytes,metadata));
 await assertFails(uploadBytes(ref(storage('photo-pupil'),`progress/photo-pupil/other/${randomUUID()}.jpg`),bytes,metadata));
 await assertSucceeds(uploadBytes(ref(storage('photo-coach'),path()),bytes,metadata));
});
test('directory listing, replacement, token metadata changes, and deletion remain forbidden',async()=>{
 const name=path(),photo=ref(storage('photo-pupil'),name);
 await assertSucceeds(uploadBytes(photo,bytes,metadata));
 for(const uid of ['photo-pupil','photo-coach']){
  const file=ref(storage(uid),name);
  await assertFails(listAll(ref(storage(uid),'progress/photo-pupil/initial')));
  await assertFails(uploadBytes(file,bytes,metadata));
  await assertFails(updateMetadata(file,{customMetadata:{firebaseStorageDownloadTokens:'leak'}}));
  await assertFails(deleteObject(file));
 }
});
