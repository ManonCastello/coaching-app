import React from 'react';
import {createRoot} from 'react-dom/client';
import {act as legacyAct} from 'react-dom/test-utils';
import {onAuthStateChanged} from 'firebase/auth';
import {getDocFromServer} from 'firebase/firestore';
import {auth} from '../firebase';
import {AuthProvider,useAuth} from './AuthContext';
jest.mock('../firebase',()=>({auth:{currentUser:null},db:{}}));
jest.mock('firebase/auth',()=>({onAuthStateChanged:jest.fn(),signInWithEmailAndPassword:jest.fn(),signOut:jest.fn()}));
jest.mock('firebase/firestore',()=>({doc:jest.fn(),getDocFromServer:jest.fn()}));
const act=React.act||legacyAct;
let container,root,listener;
function Probe(){const {currentUser,userRole}=useAuth();return <p>{currentUser?.uid??'signed-out'}:{userRole??'none'}</p>;}
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;jest.clearAllMocks();auth.currentUser=null;container=document.createElement('div');root=createRoot(container);onAuthStateChanged.mockImplementation((_,callback)=>{listener=callback;return()=>{};});});
afterEach(()=>act(()=>root.unmount()));
test('a late coach response cannot restore a session after signout',async()=>{
 let resolve;getDocFromServer.mockImplementation(()=>new Promise(done=>{resolve=done;}));
 await act(async()=>root.render(<AuthProvider><Probe/></AuthProvider>));
 auth.currentUser={uid:'old-coach'};
 let pending;await act(async()=>{pending=listener(auth.currentUser);});
 auth.currentUser=null;await act(async()=>listener(null));
 await act(async()=>{resolve({exists:()=>true,data:()=>({role:'coach'})});await pending;});
 expect(container.textContent).toContain('signed-out:none');expect(container.textContent).not.toContain('old-coach');
});
test('a role lookup failure offers retry instead of a blank screen or inferred privileges',async()=>{
 getDocFromServer.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({exists:()=>true,data:()=>({role:'coach'})});
 await act(async()=>root.render(<AuthProvider><Probe/></AuthProvider>));
 auth.currentUser={uid:'owner'};await act(async()=>listener(auth.currentUser));
 expect(container.textContent).toContain('Tes accès n’ont pas pu être vérifiés');
 await act(async()=>container.querySelector('button').click());
 await act(async()=>listener(auth.currentUser));
 expect(container.textContent).toContain('owner:coach');
});
test('an existing role document without exact coach role never grants coach UI access',async()=>{
 getDocFromServer.mockResolvedValue({exists:()=>true,data:()=>({role:'client'})});
 await act(async()=>root.render(<AuthProvider><Probe/></AuthProvider>));
 auth.currentUser={uid:'pupil'};await act(async()=>listener(auth.currentUser));
 expect(container.textContent).toContain('pupil:client');
});
