import {create} from 'zustand';
import type {Process} from '../engine/types';
type State={activeModule:string;processes:Process[];console:string[];dark:boolean;evaluator:boolean;present:boolean;setModule:(v:string)=>void;log:(v:string)=>void;setProcesses:(v:Process[])=>void;toggleTheme:()=>void;};
export const useMiniOS=create<State>((set)=>({activeModule:'process',processes:[],console:['MiniOS kernel connection ready. Try “help” or load sample processes.'],dark:false,evaluator:false,present:false,setModule:(activeModule)=>set({activeModule}),log:(v)=>set(s=>({console:[...s.console.slice(-200),v]})),setProcesses:(processes)=>set({processes}),toggleTheme:()=>set(s=>({dark:!s.dark}))}));
