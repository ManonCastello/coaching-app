import React from 'react';
import {createRoot} from 'react-dom/client';
import {act as legacyAct} from 'react-dom/test-utils';
import ProgressPhoto from './ProgressPhoto';
import {readPhotoBlob} from '../utils/privatePhotos';
import {auth} from '../firebase';
jest.mock('../firebase',()=>({auth:{currentUser:{uid:'pupil'}}}));
jest.mock('../contexts/AuthContext',()=>({useAuth:()=>({currentUser:require('../firebase').auth.currentUser})}));
jest.mock('../utils/privatePhotos',()=>({isPrivatePhoto:value=>value?.kind==='fitlog-private-photo',readPhotoBlob:jest.fn()}));
const act=React.act||legacyAct;
const photo={kind:'fitlog-private-photo',bucket:'test',path:'progress/pupil/initial/a.jpg'};
let root,container;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');root=createRoot(container);auth.currentUser={uid:'pupil'};jest.clearAllMocks();URL.createObjectURL=jest.fn(()=> 'blob:private-photo');URL.revokeObjectURL=jest.fn();});
afterEach(()=>act(()=>root.unmount()));
test('authenticated photo appears only after the SDK read and is released on unmount',async()=>{
 readPhotoBlob.mockResolvedValue(new Blob(['photo']));
 await act(async()=>root.render(<ProgressPhoto src={photo} alt="Face"/>));
 expect(container.querySelector('img').src).toBe('blob:private-photo');
 await act(async()=>root.render(null));
 expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-photo');
});
test('a delayed response from a previous account cannot display its photo',async()=>{
 let finish;readPhotoBlob.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 await act(async()=>root.render(<ProgressPhoto src={photo} alt="Face"/>));
 auth.currentUser=null;
 await act(async()=>root.render(<ProgressPhoto src={photo} alt="Face"/>));
 await act(async()=>finish(new Blob(['private'])));
 expect(container.querySelector('img')).toBeNull();
 expect(URL.createObjectURL).not.toHaveBeenCalled();
});
test('changing accounts hides and revokes the previous image before the new read completes',async()=>{
 readPhotoBlob.mockResolvedValueOnce(new Blob(['old'])).mockReturnValue(new Promise(()=>{}));
 await act(async()=>root.render(<ProgressPhoto src={photo} alt="Face"/>));
 auth.currentUser={uid:'other'};
 await act(async()=>root.render(<ProgressPhoto src={photo} alt="Face"/>));
 expect(container.querySelector('img')).toBeNull();
 expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-photo');
});
test('a denied read shows an explicit error instead of a public URL fallback',async()=>{
 readPhotoBlob.mockRejectedValue(new Error('denied'));
 await act(async()=>root.render(<ProgressPhoto src={photo} alt="Face"/>));
 expect(container.querySelector('[role="alert"]').textContent).toContain('accès');
 expect(container.querySelector('img')).toBeNull();
});
test('legacy photos remain readable without requesting private storage',async()=>{
 await act(async()=>root.render(<ProgressPhoto src="https://res.cloudinary.com/dduaqnygn/image/upload/old.jpg" alt="Face"/>));
 expect(container.querySelector('img')).not.toBeNull();
 expect(readPhotoBlob).not.toHaveBeenCalled();
});
