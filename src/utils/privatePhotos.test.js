jest.mock('../firebase',()=>({auth:{currentUser:{uid:'pupil'}},db:{app:{}}}));
jest.mock('firebase/storage',()=>({getStorage:jest.fn(()=>({})),ref:jest.fn((_,path)=>path),uploadBytes:jest.fn(),getBlob:jest.fn(),connectStorageEmulator:jest.fn()}));
let photos,auth,storage;
beforeEach(()=>{
 jest.resetModules();process.env.REACT_APP_PRIVATE_PHOTOS='true';process.env.REACT_APP_PRIVATE_PHOTO_BUCKET='private-test-bucket';
 photos=require('./privatePhotos');auth=require('../firebase').auth;storage=require('firebase/storage');
});
afterAll(()=>{delete process.env.REACT_APP_PRIVATE_PHOTOS;delete process.env.REACT_APP_PRIVATE_PHOTO_BUCKET;});
const descriptor={kind:'fitlog-private-photo',version:1,bucket:'private-test-bucket',path:'progress/pupil/initial/12345678-1234-4234-8234-123456789abc.jpg'};
test('accepts references in the configured bucket and existing Cloudinary photos, never local previews or arbitrary buckets',()=>{
 expect(photos.isSavedPhoto(descriptor)).toBe(true);
 expect(photos.isSavedPhoto('https://res.cloudinary.com/dduaqnygn/image/upload/v1/old.jpg')).toBe(true);
 for(const value of [{...descriptor,bucket:'backup-bucket'},{...descriptor,path:'../../secret'},'data:image/jpeg;base64,AAAA','blob:preview','https://other.invalid/photo.jpg'])expect(photos.isSavedPhoto(value)).toBe(false);
});
test('private reads use authenticated SDK bytes with a size bound and never create a download URL',async()=>{
 storage.getBlob.mockResolvedValue(new Blob(['test']));
 await photos.readPhotoBlob(descriptor);
 expect(storage.getBlob).toHaveBeenCalledWith(descriptor.path,2*1024*1024);
 auth.currentUser=null;
 await expect(photos.readPhotoBlob(descriptor)).rejects.toThrow('Connexion');
});
test('rejects unsupported or oversized input before opening the image',async()=>{
 await expect(photos.preparePhoto({type:'image/svg+xml',size:12})).rejects.toThrow('JPEG');
 await expect(photos.preparePhoto({type:'image/jpeg',size:21*1024*1024})).rejects.toThrow('20 Mo');
 expect(storage.uploadBytes).not.toHaveBeenCalled();
});
test('requires a session and valid destination before any upload',async()=>{
 await expect(photos.uploadPrivatePhoto({}, {clientId:'pupil/other',category:'initial'})).rejects.toThrow('Destination');
 auth.currentUser=null;
 await expect(photos.uploadPrivatePhoto({}, {clientId:'pupil',category:'initial'})).rejects.toThrow('Connecte');
 expect(storage.uploadBytes).not.toHaveBeenCalled();
});
test('reencodes an image at bounded dimensions and uploads an opaque reference without its original name',async()=>{
 const originalImage=global.Image;
 const prepared=new Blob(['jpeg'],{type:'image/jpeg'});
 const context={fillRect:jest.fn(),drawImage:jest.fn()};
 const canvas={getContext:()=>context,toBlob:jest.fn(callback=>callback(prepared))};
 const createElement=jest.spyOn(document,'createElement').mockReturnValue(canvas);
 URL.createObjectURL=jest.fn(()=> 'blob:test-input');URL.revokeObjectURL=jest.fn();
 global.Image=class{naturalWidth=2500;naturalHeight=2000;set src(value){Promise.resolve().then(()=>this.onload());}};
 Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> '12345678-1234-4234-8234-123456789abc'}});
 try{
  const result=await photos.uploadPrivatePhoto(new File(['input'],'personal-name-gps.jpg',{type:'image/jpeg'}),{clientId:'pupil',category:'initial'});
  expect(canvas.width).toBe(1600);expect(canvas.height).toBe(1280);
  expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function),'image/jpeg',0.82);
  expect(result).toEqual(descriptor);
  expect(storage.uploadBytes).toHaveBeenCalledWith(descriptor.path,prepared,{contentType:'image/jpeg',cacheControl:'private, max-age=0, no-store',customMetadata:{ownerId:'pupil'}});
  expect(JSON.stringify(storage.uploadBytes.mock.calls)).not.toContain('personal-name');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-input');
 }finally{global.Image=originalImage;createElement.mockRestore();}
});
