import React,{useEffect,useState} from 'react';
import {useAuth} from '../contexts/AuthContext';
import {isPrivatePhoto,readPhotoBlob} from '../utils/privatePhotos';
import {auth} from '../firebase';

export default function ProgressPhoto({src,alt,...props}){
  const {currentUser}=useAuth();
  const uid=currentUser?.uid;
  const privatePhoto=isPrivatePhoto(src);
  const bucket=src?.bucket,path=src?.path;
  const key=privatePhoto?`${uid??''}/${src.bucket}/${src.path}`:null;
  const [result,setResult]=useState(null),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!privatePhoto||!uid)return;
    let active=true,url;
    readPhotoBlob({kind:'fitlog-private-photo',version:1,bucket,path}).then(blob=>{
      if(!active||auth.currentUser?.uid!==uid)return;
      url=URL.createObjectURL(blob);setResult({key,url});
    }).catch(error=>{
      // Codes only: never log object paths, download URLs, tokens or pupil data.
      console.warn('Fitlog photo read failed:',error?.code||'unknown');
      if(active&&auth.currentUser?.uid===uid)setResult({key,error:true});
    });
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[key,uid,privatePhoto,bucket,path,retry]);
  if(src&&typeof src==='object'&&!privatePhoto)return <span role="alert">Photo indisponible</span>;
  if(!privatePhoto)return <img src={src} alt={alt} {...props}/>;
  if(!uid)return <span>Connecte-toi pour consulter cette photo.</span>;
  if(result?.key!==key)return <span role="status">Chargement de la photo…</span>;
  if(result.error)return <span><span role="alert">Photo indisponible ou accès non autorisé.</span> <button type="button" onClick={()=>{setResult(null);setRetry(value=>value+1);}}>Réessayer</button></span>;
  return <img src={result.url} alt={alt} {...props}/>;
}
