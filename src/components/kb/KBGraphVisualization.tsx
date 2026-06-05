import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Folder, FileText, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  name?: string;
  type?: string;
  nodeType?: string;
  fileType?: string;
  group?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  source: string;
  target: string;
  label?: string;
  linkType?: string;
  edgeType?: string;
  description?: string;
  relationId?: string;
}

interface KbGraphVisualizationProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick?: (node: any) => void;
}

interface TreeNode {
  node: GraphNode;
  children: TreeNode[];
  x: number;
  y: number;
  depth: number;
}

const NODE_W = 180;
const NODE_H = 40;
const LEVEL_GAP = 220;
const SIBLING_GAP = 8;
const PADDING_X = 80;
const PADDING_Y = 60;

function buildTree(nodes: GraphNode[], links: GraphLink[]): { roots: TreeNode[]; nodeMap: Map<string, TreeNode> } {
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();

  links.forEach(l => {
    if (!childrenMap.has(l.source)) childrenMap.set(l.source, []);
    childrenMap.get(l.source)!.push(l.target);
    parentMap.set(l.target, l.source);
  });

  const roots = nodes.filter(n => !parentMap.has(n.id));
  const finalRoots = roots.length > 0 ? roots : nodes.filter(n => n.nodeType === 'folder');
  if (finalRoots.length === 0 && nodes.length > 0) {
    const firstNode = nodes[0];
    if (firstNode) finalRoots.push(firstNode);
  }

  const treeNodeMap = new Map<string, TreeNode>();

  function createTreeNode(node: GraphNode, depth: number, visited: Set<string>): TreeNode | null {
    if (visited.has(node.id)) return null;
    if (treeNodeMap.has(node.id)) return treeNodeMap.get(node.id)!;

    const tn: TreeNode = { node, children: [], x: 0, y: 0, depth };
    treeNodeMap.set(node.id, tn);

    const childIds = childrenMap.get(node.id) || [];
    for (const childId of childIds) {
      const childNode = nodeMap.get(childId);
      if (!childNode) continue;
      const child = createTreeNode(childNode, depth + 1, new Set(visited).add(node.id));
      if (child) tn.children.push(child);
    }

    return tn;
  }

  const treeRoots: TreeNode[] = [];
  const visitedRoots = new Set<string>();
  for (const root of finalRoots) {
    if (visitedRoots.has(root.id)) continue;
    const tree = createTreeNode(root, 0, new Set());
    if (tree) {
      treeRoots.push(tree);
      const queue = [tree];
      while (queue.length > 0) {
        const current = queue.shift()!;
        visitedRoots.add(current.node.id);
        queue.push(...current.children);
      }
    }
  }

  for (const node of nodes) {
    if (!visitedRoots.has(node.id)) {
      const tree = createTreeNode(node, 0, new Set());
      if (tree) {
        treeRoots.push(tree);
        visitedRoots.add(node.id);
      }
    }
  }

  return { roots: treeRoots, nodeMap: treeNodeMap };
}

function layoutTree(roots: TreeNode[]): { width: number; height: number } {
  function computeHeight(node: TreeNode): number {
    if (node.children.length === 0) return NODE_H + SIBLING_GAP;
    const totalHeight = node.children.reduce((sum, child) => sum + computeHeight(child), 0);
    return Math.max(NODE_H + SIBLING_GAP, totalHeight);
  }

  function assignPositions(node: TreeNode, x: number, yStart: number) {
    node.x = x;
    const subtreeHeight = computeHeight(node);
    node.y = yStart + subtreeHeight / 2;

    let currentY = yStart;
    for (const child of node.children) {
      const childHeight = computeHeight(child);
      assignPositions(child, x + LEVEL_GAP, currentY);
      currentY += childHeight;
    }
  }

  let offsetY = PADDING_Y;
  for (const root of roots) {
    const h = computeHeight(root);
    assignPositions(root, PADDING_X, offsetY);
    offsetY += h + SIBLING_GAP * 4;
  }

  let maxX = 0, maxY = 0;
  for (const root of roots) {
    const queue = [root];
    while (queue.length > 0) {
      const current = queue.shift()!;
      maxX = Math.max(maxX, current.x + NODE_W);
      maxY = Math.max(maxY, current.y + NODE_H / 2);
      queue.push(...current.children);
    }
  }

  return { width: maxX + PADDING_X, height: maxY + PADDING_Y };
}

const edgeColors: Record<string, string> = {
  belongs: '#cbd5e1',
  parent: '#cbd5e1',
  related: '#14b8a6',
  references: '#3b82f6',
  depends_on: '#f59e0b',
  version_of: '#8b5cf6',
  mentions: '#ec4899',
};

const KbGraphVisualization: React.FC<KbGraphVisualizationProps> = ({ nodes, links, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 500 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { roots, nodeMap: treeNodeMap } = useMemo(
    () => buildTree(nodes, links),
    [nodes, links]
  );

  const { width, height } = useMemo(() => {
    if (roots.length === 0) return { width: 800, height: 500 };
    return layoutTree(roots);
  }, [roots]);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, tx: viewTransform.x, ty: viewTransform.y };

    const handleMove = (ev: MouseEvent) => {
      setViewTransform(prev => ({
        ...prev,
        x: panStart.current.tx + (ev.clientX - panStart.current.x),
        y: panStart.current.ty + (ev.clientY - panStart.current.y),
      }));
    };
    const handleUp = () => {
      isPanning.current = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [viewTransform]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setViewTransform(prev => ({
      ...prev,
      scale: Math.max(0.15, Math.min(4, prev.scale * delta)),
    }));
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Folder size={28} className="text-slate-300" />
        </div>
        <p className="text-sm text-slate-500 mb-1">暂无关联数据</p>
        <p className="text-xs text-slate-400">点击"添加关联"建立文件之间的关系</p>
      </div>
    );
  }

  const treeEdges: { source: TreeNode; target: TreeNode; edgeType: string }[] = [];
  function collectEdges(node: TreeNode) {
    for (const child of node.children) {
      const link = links.find(l => l.source === node.node.id && l.target === child.node.id);
      treeEdges.push({ source: node, target: child, edgeType: link?.edgeType || link?.linkType || 'belongs' });
      collectEdges(child);
    }
  }
  for (const root of roots) collectEdges(root);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox={`0 0 ${Math.max(width, containerSize.width)} ${Math.max(height, containerSize.height)}`}
        onMouseDown={handleSvgMouseDown}
        onWheel={handleWheel}
        style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
      >
        <defs>
          {/* Folder gradient */}
          <linearGradient id="folderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          {/* File gradient */}
          <linearGradient id="fileGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0fdfa" />
            <stop offset="100%" stopColor="#ccfbf1" />
          </linearGradient>
          {/* Shadow filter */}
          <filter id="nodeShadow" x="-10%" y="-10%" width="130%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.08" />
          </filter>
          <filter id="nodeShadowHover" x="-15%" y="-15%" width="140%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#6366f1" floodOpacity="0.15" />
          </filter>
        </defs>

        <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.scale})`}>
          {/* Tree edges */}
          {treeEdges.map((edge, i) => {
            const sx = edge.source.x + NODE_W;
            const sy = edge.source.y;
            const tx = edge.target.x;
            const ty = edge.target.y;
            const mx = sx + (tx - sx) / 2;
            const edgeColor = edgeColors[edge.edgeType] || '#cbd5e1';
            const isSemantic = !['belongs', 'parent'].includes(edge.edgeType);

            return (
              <path
                key={`tree-${i}`}
                d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`}
                fill="none"
                stroke={edgeColor}
                strokeWidth={isSemantic ? 2.5 : 1.5}
                opacity={isSemantic ? 0.6 : 0.35}
              />
            );
          })}

          {/* Nodes */}
          {[...treeNodeMap.values()].map((tn) => {
            const node = tn.node;
            const isFolder = node.nodeType === 'folder' || node.type === 'folder';
            const isHovered = hoveredNode === node.id;
            const w = isFolder ? NODE_W + 20 : NODE_W;
            const h = NODE_H;
            const rx = isFolder ? 10 : 8;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${tn.y - h / 2})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => onNodeClick?.(node)}
                style={{ cursor: 'pointer' }}
              >
                {/* Background */}
                <rect
                  x={0} y={0} width={w} height={h}
                  rx={rx}
                  fill={isFolder ? 'url(#folderGrad)' : 'url(#fileGrad)'}
                  stroke={isHovered ? (isFolder ? '#4f46e5' : '#0d9488') : (isFolder ? 'transparent' : '#e2e8f0')}
                  strokeWidth={isHovered ? 2 : 1}
                  filter={isHovered ? 'url(#nodeShadowHover)' : 'url(#nodeShadow)'}
                  style={{ transition: 'stroke 0.15s ease' }}
                />

                {/* Icon */}
                {isFolder ? (
                  <g transform="translate(12, 10)">
                    <rect x="0" y="2" width="20" height="16" rx="3" fill="white" opacity="0.25" />
                    <rect x="0" y="0" width="10" height="6" rx="2" fill="white" opacity="0.25" />
                  </g>
                ) : (
                  <g transform="translate(12, 10)">
                    <rect x="0" y="0" width="20" height="20" rx="4" fill="white" opacity="0.2" />
                    <text x="10" y="14" textAnchor="middle" fontSize="9" fill="white" fontWeight="600">
                      {(node.fileType || 'file').replace('.', '').substring(0, 3).toUpperCase()}
                    </text>
                  </g>
                )}

                {/* Label */}
                <text
                  x={isFolder ? 40 : 40}
                  y={h / 2 + 1}
                  fontSize={isFolder ? 12 : 11}
                  fill={isFolder ? 'white' : '#334155'}
                  fontWeight={isFolder ? '600' : '500'}
                  style={{ pointerEvents: 'none' }}
                >
                  {(node.label || node.name || '').length > 18
                    ? `${(node.label || node.name || '').substring(0, 18)}...`
                    : (node.label || node.name || '')}
                </text>

                {/* File count badge for folders */}
                {isFolder && (
                  <g transform={`translate(${w - 16}, ${h / 2 - 8})`}>
                    <circle r="8" fill="white" opacity="0.2" />
                    <text x="0" y="1" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">
                      {tn.children?.length || ''}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white rounded-lg shadow-lg border border-slate-200 p-1">
        <button
          onClick={() => setViewTransform(prev => ({ ...prev, scale: Math.min(4, prev.scale * 1.2) }))}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
          title="放大"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setViewTransform(prev => ({ ...prev, scale: Math.max(0.15, prev.scale * 0.8) }))}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
          title="缩小"
        >
          <ZoomOut size={16} />
        </button>
        <div className="w-px h-4 bg-slate-200" />
        <button
          onClick={() => setViewTransform({ x: 0, y: 0, scale: 1 })}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
          title="重置视图"
        >
          <RotateCcw size={16} />
        </button>
        <span className="text-xs text-slate-400 px-2 font-mono">
          {Math.round(viewTransform.scale * 100)}%
        </span>
      </div>
    </div>
  );
};

export default KbGraphVisualization;
