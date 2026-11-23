import { useMemo } from 'react';
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type Props = { module: string; activeStep: string; processNames: string[] };

export function FlowMap({ module, activeStep, processNames }: Props) {
  const nodes = useMemo<Node[]>(() => {
    const labels = module === 'process' ? ['New', 'Ready', 'Running', 'Waiting', 'Terminated']
      : module === 'cpu' ? ['Arrivals', 'Ready queue', 'CPU', 'Completed']
      : module === 'memory' ? ['Free holes', 'Fit policy', 'Allocated block']
      : module === 'sync' ? ['Producer', 'Bounded buffer', 'Consumer']
      : module === 'paging' ? ['Reference', 'Frames', 'Hit / Fault'] : ['Head', 'Request queue', 'Seek order'];
    const width = 170; const gap = 44; const startX = 24;
    return labels.map((label, i) => ({
      id: `${i}`, position: { x: startX + i * (width + gap), y: i % 2 ? 88 : 28 },
      data: { label: `${label}${i === 0 && processNames.length ? ` · ${processNames.slice(0,2).join(', ')}` : ''}${activeStep && i === labels.length - 1 ? ` · ${activeStep}` : ''}` },
      type: 'default',
      style: { width, padding: '12px', border: '1px solid var(--edge)', borderRadius: '10px', background: 'var(--panel)', color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 12 },
    }));
  }, [module, activeStep, processNames]);
  const edges = useMemo<Edge[]>(() => nodes.slice(0,-1).map((node, i) => ({
    id: `${node.id}-${nodes[i+1].id}`, source: node.id, target: nodes[i+1].id,
    animated: i === nodes.length - 2,
    style: { stroke: 'var(--signal)', strokeWidth: 1.5 },
  })), [nodes]);
  return <div className="visual-flow-map flow-wrap visual-flow" aria-label="Movable simulation flowchart">
    <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: .18 }} minZoom={.35} maxZoom={1.6} nodesDraggable nodesConnectable={false} elementsSelectable zoomOnScroll panOnScroll={false}>
      <Background color="var(--edge)" gap={20}/><Controls showInteractive={false}/><MiniMap pannable zoomable nodeColor="var(--signal)"/>
    </ReactFlow>
  </div>;
}
