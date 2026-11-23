export async function command(command:string){const r=await fetch('/api/cmd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,timeout:8})});if(!r.ok)throw Error(`MiniOS returned HTTP ${r.status}`);return (await r.json()).output as string}
export async function reset(){await fetch('/api/reset',{method:'POST'})}
