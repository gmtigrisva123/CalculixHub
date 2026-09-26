import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryState } from './feed';
/** Never let a late result from an old account/filter replace the current view. */
export function useLiveQuery<T>(key:string, empty:T, loader:()=>Promise<T>):QueryState<T>&{reload:()=>Promise<void>} {
 const current=useRef(key);current.current=key;
 const fallback=useRef({key,data:empty});if(fallback.current.key!==key)fallback.current={key,data:empty};
 const sequence=useRef(0);const alive=useRef(true);const emptyRef=useRef(empty);emptyRef.current=empty;
 const [state,setState]=useState<QueryState<T>&{key:string}>({key,data:empty,loading:true,error:null});
 const reload=useCallback(async()=>{
  const id=++sequence.current;
  try {const data=await loader();if(alive.current&&current.current===key&&id===sequence.current)setState({key,data,loading:false,error:null});}
  catch(e){if(alive.current&&current.current===key&&id===sequence.current)setState(prev=>({key,data:prev.key===key?prev.data:emptyRef.current,loading:false,error:e instanceof Error?e.message:'Could not load live data.'}));}
 },[key,loader]);
 useEffect(()=>{alive.current=true;void reload();const resume=()=>{if(document.visibilityState==='visible')void reload();};window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);return()=>{alive.current=false;sequence.current++;window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};},[reload]);
 return {...(state.key===key?state:{data:fallback.current.data,loading:true,error:null}),reload};
}
