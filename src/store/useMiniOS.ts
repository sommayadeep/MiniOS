import {create} from 'zustand';
import type {Process} from '../engine/types';
type State={activeModule:string;processes:Process[];console:string[];evaluator:boolean;present:boolean;setModule:(v:string)=>void;log:(v:string)=>void;setProcesses:(v:Process[])=>void;};
export const useMiniOS=create<State>((set)=>({activeModule:'process',processes:[],console:['MiniOS kernel connection ready. Try “help” or load sample processes.'],evaluator:false,present:false,setModule:(activeModule)=>set({activeModule}),log:(v)=>set(s=>({console:[...s.console.slice(-200),v]})),setProcesses:(processes)=>set({processes})}));
