export type SimStep={label:string;why:string;state:Record<string,unknown>;output?:string};
export type Process={pid:number;name:string;burst:number;priority:number;arrival:number;state:string};
