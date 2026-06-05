import React, { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface GraphNode {
  id: string;
  title: string;
  type: 'memo' | 'file';
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  onClose?: () => void;
}

const isFiniteCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

// 简单的力导向布局（不依赖 d3）
function forceLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number, iterations: number = 100) {
  const centerX = width / 2;
  const centerY = height / 2;

  // 初始化位置
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const radius = Math.min(width, height) * 0.3;
    node.x = centerX + radius * Math.cos(angle);
    node.y = centerY + radius * Math.sin(angle);
    node.vx = 0;
    node.vy = 0;
  });

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;

    // 斥力（所有节点对）
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const leftNode = nodes[i];
        const rightNode = nodes[j];
        if (!leftNode || !rightNode) continue;
        const dx = rightNode.x - leftNode.x;
        const dy = rightNode.y - leftNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 3000 * alpha / (dist * dist);
        const fx = dx / dist * force;
        const fy = dy / dist * force;
        leftNode.vx -= fx;
        leftNode.vy -= fy;
        rightNode.vx += fx;
        rightNode.vy += fy;
      }
    }

    // 引力（有边的节点对）
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    edges.forEach(e => {
      const source = nodeMap.get(e.source);
      const target = nodeMap.get(e.target);
      if (!source || !target) return;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 120) * 0.05 * alpha;
      const fx = dx / dist * force;
      const fy = dy / dist * force;
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    });

    // 向心力
    nodes.forEach(node => {
      node.vx += (centerX - node.x) * 0.01 * alpha;
      node.vy += (centerY - node.y) * 0.01 * alpha;
    });

    // 更新位置
    nodes.forEach(node => {
      node.vx *= 0.6; // 阻尼
      node.vy *= 0.6;
      node.x += node.vx;
      node.y += node.vy;
      // 边界约束
      node.x = Math.max(40, Math.min(width - 40, node.x));
      node.y = Math.max(40, Math.min(height - 40, node.y));
    });
  }
}

const KnowledgeGraph: React.FC<Props> = ({ nodes, edges, onNodeClick, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [layoutNodes, setLayoutNodes] = useState<GraphNode[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (nodes.length === 0) return;
    const limitedNodes = nodes.length > 500 ? nodes.slice(0, 500) : nodes;
    const width = svgRef.current?.clientWidth || 800;
    const height = svgRef.current?.clientHeight || 600;
    const layouted = limitedNodes.map(n => ({ ...n }));
    const iterations = Math.min(100, Math.max(20, Math.floor(5000 / limitedNodes.length)));
    forceLayout(layouted, edges, width, height, iterations);
    setLayoutNodes(layouted);
  }, [nodes, edges]);

  const getNodeColor = (type: string) => type === 'memo' ? '#0d9488' : '#6366f1';

  return (
    <div className="relative w-full h-full bg-gray-50/50 rounded-2xl border border-teal-900/5 overflow-hidden">
      {/* 工具栏 */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.2))} className="p-2 bg-white rounded-xl shadow-sm border hover:bg-gray-50">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-2 bg-white rounded-xl shadow-sm border hover:bg-gray-50">
          <ZoomOut size={14} />
        </button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-2 bg-white rounded-xl shadow-sm border hover:bg-gray-50">
          <Maximize2 size={14} />
        </button>
        {onClose && (
          <button onClick={onClose} className="p-2 bg-white rounded-xl shadow-sm border hover:bg-red-50 hover:text-red-500">
            <X size={14} />
          </button>
        )}
      </div>

      {/* 图例 */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-xl px-3 py-2 border text-2xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-teal-500"></span> 便签</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-indigo-500"></span> 文档</span>
        <span className="text-gray-400">{nodes.length} 个节点 · {edges.length} 条链接</span>
      </div>

      {nodes.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-gray-400">暂无知识图谱数据</p>
        </div>
      ) : (
        <svg ref={svgRef} className="w-full h-full" viewBox="0 0 800 600">
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 边 */}
            {edges.map((edge, i) => {
              const source = layoutNodes.find(n => n.id === edge.source);
              const target = layoutNodes.find(n => n.id === edge.target);
              if (
                !source || !target ||
                !isFiniteCoordinate(source.x) || !isFiniteCoordinate(source.y) ||
                !isFiniteCoordinate(target.x) || !isFiniteCoordinate(target.y)
              ) return null;
              const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;
              return (
                <line
                  key={i}
                  x1={source.x} y1={source.y}
                  x2={target.x} y2={target.y}
                  stroke={isHighlighted ? '#0d9488' : '#d1d5db'}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeOpacity={isHighlighted ? 0.8 : 0.6}
                />
              );
            })}

            {/* 节点 */}
            {layoutNodes.map(node => {
              const isConnectedToHovered = hoveredNode
                ? edges.some(e =>
                    (e.source === hoveredNode && e.target === node.id) ||
                    (e.target === hoveredNode && e.source === node.id)
                  ) || hoveredNode === node.id
                : false;
              const dimmed = hoveredNode && !isConnectedToHovered;
              if (!isFiniteCoordinate(node.x) || !isFiniteCoordinate(node.y)) return null;
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <circle
                    r={hoveredNode === node.id ? 16 : 12}
                    fill={getNodeColor(node.type)}
                    fillOpacity={dimmed ? 0.2 : 0.8}
                    stroke="white"
                    strokeWidth={2}
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => onNodeClick?.(node.id)}
                  />
                  <text
                    y={24}
                    textAnchor="middle"
                    className="text-2xs pointer-events-none"
                    fill={dimmed ? '#d1d5db' : '#1f2937'}
                    fontWeight="bold"
                  >
                    {node.title.length > 8 ? node.title.slice(0, 8) + '...' : node.title}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
};

export default KnowledgeGraph;
