import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  X, Undo2, Redo2, Download, ArrowUpRight, Circle, CaseSensitive,
  RectangleHorizontal, Minus, Pen, Hash, Highlighter, Eraser,
  Crop, ZoomIn, ZoomOut, Grid3x3, MousePointer2
} from 'lucide-react';

interface Point { x: number; y: number }

interface Annotation {
  type: 'blur' | 'arrow' | 'circle' | 'text' | 'rect' | 'line' | 'pen' | 'number' | 'highlight';
  x: number;
  y: number;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  text?: string;
  points?: Point[];
  number?: number;
  color?: string;
  lineWidth?: number;
}

interface ClipAnnotatorProps {
  imageData: string;
  onSave: (annotatedImageData: string) => void;
  onClose: () => void;
}

type Tool = 'select' | 'blur' | 'arrow' | 'circle' | 'text' | 'rect' | 'line' | 'pen' | 'number' | 'highlight' | 'eraser' | 'crop' | null;

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000'];
const LINE_WIDTHS = [2, 4, 8];

const ClipAnnotator: React.FC<ClipAnnotatorProps> = ({ imageData, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<Point>({ x: 0, y: 0 });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[]>([]);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputPos, setTextInputPos] = useState<Point>({ x: 0, y: 0 });
  const [textInputValue, setTextInputValue] = useState('');
  const [currentColor, setCurrentColor] = useState('#ef4444');
  const [currentLineWidth, setCurrentLineWidth] = useState(4);
  const [nextNumber, setNextNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [penPoints, setPenPoints] = useState<Point[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = imageData;
  }, [imageData]);

  const renderAnnotation = useCallback((ctx: CanvasRenderingContext2D, ann: Annotation) => {
    ctx.save();
    const color = ann.color || '#ef4444';
    const lw = ann.lineWidth || 4;

    if (ann.type === 'blur') {
      const x = Math.min(ann.x, ann.x + (ann.width || 0));
      const y = Math.min(ann.y, ann.y + (ann.height || 0));
      const w = Math.abs(ann.width || 0);
      const h = Math.abs(ann.height || 0);
      if (w > 0 && h > 0) {
        const imgData = ctx.getImageData(x, y, w, h);
        const pixelSize = 10;
        for (let py = 0; py < h; py += pixelSize) {
          for (let px = 0; px < w; px += pixelSize) {
            const i = (py * w + px) * 4;
            const r = imgData.data[i];
            const g = imgData.data[i + 1];
            const b = imgData.data[i + 2];
            for (let dy = 0; dy < pixelSize && py + dy < h; dy++) {
              for (let dx = 0; dx < pixelSize && px + dx < w; dx++) {
                const ni = ((py + dy) * w + (px + dx)) * 4;
                imgData.data[ni] = r!;
                imgData.data[ni + 1] = g!;
                imgData.data[ni + 2] = b!;
              }
            }
          }
        }
        ctx.putImageData(imgData, x, y);
      }
    } else if (ann.type === 'arrow') {
      const endX = ann.endX || ann.x;
      const endY = ann.endY || ann.y;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ann.x, ann.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      const angle = Math.atan2(endY - ann.y, endX - ann.x);
      const headLength = Math.max(12, lw * 4);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else if (ann.type === 'circle') {
      const centerX = (ann.x + (ann.endX || ann.x)) / 2;
      const centerY = (ann.y + (ann.endY || ann.y)) / 2;
      const radiusX = Math.abs((ann.endX || ann.x) - ann.x) / 2;
      const radiusY = Math.abs((ann.endY || ann.y) - ann.y) / 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (ann.type === 'text') {
      const fontSize = Math.max(16, lw * 5);
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      const metrics = ctx.measureText(ann.text || '');
      const pad = 4;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(ann.x - pad, ann.y - fontSize - pad, metrics.width + pad * 2, fontSize + pad * 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(ann.text || '', ann.x, ann.y);
    } else if (ann.type === 'rect') {
      const x = Math.min(ann.x, ann.endX || ann.x);
      const y = Math.min(ann.y, ann.endY || ann.y);
      const w = Math.abs((ann.endX || ann.x) - ann.x);
      const h = Math.abs((ann.endY || ann.y) - ann.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.strokeRect(x, y, w, h);
    } else if (ann.type === 'line') {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ann.x, ann.y);
      ctx.lineTo(ann.endX || ann.x, ann.endY || ann.y);
      ctx.stroke();
    } else if (ann.type === 'pen') {
      if (ann.points && ann.points.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(ann.points[0]!.x, ann.points[0]!.y);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i]!.x, ann.points[i]!.y);
        }
        ctx.stroke();
      }
    } else if (ann.type === 'number') {
      const fontSize = Math.max(20, lw * 6);
      const radius = fontSize * 0.7;
      ctx.beginPath();
      ctx.arc(ann.x, ann.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `bold ${fontSize * 0.8}px Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ann.number || 1), ann.x, ann.y);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    } else if (ann.type === 'highlight') {
      const x = Math.min(ann.x, ann.endX || ann.x);
      const y = Math.min(ann.y, ann.endY || ann.y);
      const w = Math.abs((ann.endX || ann.x) - ann.x);
      const h = Math.abs((ann.endY || ann.y) - ann.y);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }

    ctx.restore();
  }, []);

  const renderAll = useCallback((ctx: CanvasRenderingContext2D, img: HTMLImageElement, anns: Annotation[], tempAnn?: Annotation) => {
    ctx.drawImage(img, 0, 0);
    anns.forEach(ann => renderAnnotation(ctx, ann));
    if (tempAnn) renderAnnotation(ctx, tempAnn);
  }, [renderAnnotation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = image.width;
    canvas.height = image.height;
    renderAll(ctx, image, annotations);
  }, [image, annotations, renderAll]);

  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  const getAnnotationBounds = (ann: Annotation) => {
    if (ann.type === 'pen' && ann.points && ann.points.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      ann.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    if (ann.type === 'number') {
      const r = 20;
      return { x: ann.x - r, y: ann.y - r, w: r * 2, h: r * 2 };
    }
    if (ann.type === 'text') {
      return { x: ann.x - 10, y: ann.y - 30, w: (ann.text || '').length * 14 + 20, h: 40 };
    }
    if (ann.type === 'blur') {
      const x = Math.min(ann.x, ann.x + (ann.width || 0));
      const y = Math.min(ann.y, ann.y + (ann.height || 0));
      return { x, y, w: Math.abs(ann.width || 0), h: Math.abs(ann.height || 0) };
    }
    const x = Math.min(ann.x, ann.endX || ann.x);
    const y = Math.min(ann.y, ann.endY || ann.y);
    return { x, y, w: Math.abs((ann.endX || ann.x) - ann.x), h: Math.abs((ann.endY || ann.y) - ann.y) };
  };

  const hitTest = (pos: Point, ann: Annotation): boolean => {
    const margin = 10;
    const bounds = getAnnotationBounds(ann);
    return pos.x >= bounds.x - margin && pos.x <= bounds.x + bounds.w + margin &&
           pos.y >= bounds.y - margin && pos.y <= bounds.y + bounds.h + margin;
  };

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);

    if (tool === 'select') {
      for (let i = annotations.length - 1; i >= 0; i--) {
        if (hitTest(pos, annotations[i]!)) {
          const ann = annotations[i]!;
          const offsetX = pos.x - ann.x;
          const offsetY = pos.y - ann.y;
          setDraggingIdx(i);
          setDragOffset({ x: offsetX, y: offsetY });
          setIsDrawing(true);
          return;
        }
      }
      return;
    }

    if (tool === 'eraser') {
      for (let i = annotations.length - 1; i >= 0; i--) {
        if (hitTest(pos, annotations[i]!)) {
          setRedoStack(prev => [...prev, annotations[i]!]);
          setAnnotations(prev => prev.filter((_, idx) => idx !== i));
          break;
        }
      }
      return;
    }

    if (tool === 'number') {
      const newAnn: Annotation = {
        type: 'number', x: pos.x, y: pos.y,
        number: nextNumber, color: currentColor, lineWidth: currentLineWidth
      };
      setAnnotations(prev => [...prev, newAnn]);
      setRedoStack([]);
      setNextNumber(n => n + 1);
      return;
    }

    if (tool === 'text') {
      setTextInputPos(pos);
      setShowTextInput(true);
      setTextInputValue('');
      return;
    }

    if (!tool || tool === 'crop') return;
    setIsDrawing(true);
    setStartPos(pos);

    if (tool === 'pen') {
      setPenPoints([pos]);
    }
  }, [tool, annotations, nextNumber, currentColor, currentLineWidth, getMousePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pos = getMousePos(e);

    if (tool === 'select' && draggingIdx !== null) {
      const newX = pos.x - dragOffset.x;
      const newY = pos.y - dragOffset.y;
      setAnnotations(prev => prev.map((ann, idx) => {
        if (idx !== draggingIdx) return ann;
        const dx = newX - ann.x;
        const dy = newY - ann.y;
        const moved: Annotation = { ...ann, x: newX, y: newY };
        if (moved.endX != null) moved.endX = moved.endX + dx;
        if (moved.endY != null) moved.endY = moved.endY + dy;
        if (moved.points) moved.points = moved.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        return moved;
      }));
      return;
    }

    if (!tool) return;
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (tool === 'pen') {
      setPenPoints(prev => [...prev, pos]);
      const tempAnn: Annotation = {
        type: 'pen', x: 0, y: 0,
        points: [...penPoints, pos],
        color: currentColor, lineWidth: currentLineWidth
      };
      renderAll(ctx, image, annotations, tempAnn);
      return;
    }

    if (tool === 'crop') {
      const w = pos.x - startPos.x;
      const h = pos.y - startPos.y;
      setCropRect({
        x: w >= 0 ? startPos.x : pos.x,
        y: h >= 0 ? startPos.y : pos.y,
        w: Math.abs(w), h: Math.abs(h)
      });
      renderAll(ctx, image, annotations);
      if (Math.abs(w) > 5 && Math.abs(h) > 5) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        const cx = w >= 0 ? startPos.x : pos.x;
        const cy = h >= 0 ? startPos.y : pos.y;
        ctx.strokeRect(cx, cy, Math.abs(w), Math.abs(h));
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 0, canvas.width, cy);
        ctx.fillRect(0, cy, cx, Math.abs(h));
        ctx.fillRect(cx + Math.abs(w), cy, canvas.width - cx - Math.abs(w), Math.abs(h));
        ctx.fillRect(0, cy + Math.abs(h), canvas.width, canvas.height - cy - Math.abs(h));
        ctx.restore();
      }
      return;
    }

    let tempAnn: Annotation;
    if (tool === 'blur') {
      tempAnn = { type: 'blur', x: startPos.x, y: startPos.y, width: pos.x - startPos.x, height: pos.y - startPos.y };
    } else if (tool === 'highlight') {
      tempAnn = { type: 'highlight', x: startPos.x, y: startPos.y, endX: pos.x, endY: pos.y, color: currentColor };
    } else {
      tempAnn = {
        type: tool as 'arrow' | 'circle' | 'rect' | 'line',
        x: startPos.x, y: startPos.y, endX: pos.x, endY: pos.y,
        color: currentColor, lineWidth: currentLineWidth
      };
    }
    renderAll(ctx, image, annotations, tempAnn);
  }, [isDrawing, tool, startPos, annotations, image, penPoints, currentColor, currentLineWidth, getMousePos, renderAll]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (tool === 'select') {
      setDraggingIdx(null);
      setIsDrawing(false);
      return;
    }
    if (!tool) return;
    const pos = getMousePos(e);
    setIsDrawing(false);

    if (tool === 'pen') {
      if (penPoints.length > 1) {
        const newAnn: Annotation = {
          type: 'pen', x: 0, y: 0,
          points: [...penPoints],
          color: currentColor, lineWidth: currentLineWidth
        };
        setAnnotations(prev => [...prev, newAnn]);
        setRedoStack([]);
      }
      setPenPoints([]);
      return;
    }

    if (tool === 'crop') return;

    const newAnn: Annotation = tool === 'blur'
      ? { type: 'blur', x: startPos.x, y: startPos.y, width: pos.x - startPos.x, height: pos.y - startPos.y }
      : tool === 'highlight'
        ? { type: 'highlight', x: startPos.x, y: startPos.y, endX: pos.x, endY: pos.y, color: currentColor }
        : { type: tool as 'arrow' | 'circle' | 'rect' | 'line', x: startPos.x, y: startPos.y, endX: pos.x, endY: pos.y, color: currentColor, lineWidth: currentLineWidth };

    setAnnotations(prev => [...prev, newAnn]);
    setRedoStack([]);
  }, [isDrawing, tool, startPos, penPoints, currentColor, currentLineWidth, getMousePos]);

  const handleTextConfirm = useCallback(() => {
    if (!textInputValue.trim()) { setShowTextInput(false); return; }
    setAnnotations(prev => [...prev, {
      type: 'text', x: textInputPos.x, y: textInputPos.y,
      text: textInputValue.trim(), color: currentColor, lineWidth: currentLineWidth
    }]);
    setRedoStack([]);
    setShowTextInput(false);
    setTextInputValue('');
  }, [textInputValue, textInputPos, currentColor, currentLineWidth]);

  const handleUndo = () => {
    if (annotations.length === 0) return;
    const last = annotations[annotations.length - 1]!;
    setRedoStack(prev => [...prev, last]);
    setAnnotations(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1]!;
    setAnnotations(prev => [...prev, last]);
    setRedoStack(prev => prev.slice(0, -1));
  };

  const handleCropConfirm = () => {
    if (!cropRect || !image) return;
    const { x, y, w, h } = cropRect;
    if (w < 10 || h < 10) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
    annotations.forEach(ann => {
      ctx.save();
      const shifted: Annotation = {
        ...ann,
        x: ann.x - x,
        y: ann.y - y,
        ...(ann.endX != null ? { endX: ann.endX - x } : {}),
        ...(ann.endY != null ? { endY: ann.endY - y } : {}),
      };
      if (shifted.type === 'pen' && shifted.points) {
        shifted.points = shifted.points.map(p => ({ x: p.x - x, y: p.y - y }));
      }
      renderAnnotation(ctx, shifted);
      ctx.restore();
    });
    const newImg = new Image();
    newImg.onload = () => {
      setImage(newImg);
      setAnnotations([]);
      setRedoStack([]);
      setCropMode(false);
      setCropRect(null);
    };
    newImg.src = canvas.toDataURL('image/png');
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const handleZoomReset = () => setZoom(1);

  const toolGroups: { tools: { id: Tool; icon: React.ReactNode; label: string; activeClass: string }[] }[] = [
    {
      tools: [
        { id: 'select', icon: <MousePointer2 size={16} />, label: '选择/移动', activeClass: 'bg-teal-500 text-white' },
      ]
    },
    {
      tools: [
        { id: 'pen', icon: <Pen size={16} />, label: '画笔', activeClass: 'bg-rose-500 text-white' },
        { id: 'arrow', icon: <ArrowUpRight size={16} />, label: '箭头', activeClass: 'bg-rose-500 text-white' },
        { id: 'line', icon: <Minus size={16} />, label: '直线', activeClass: 'bg-purple-500 text-white' },
        { id: 'rect', icon: <RectangleHorizontal size={16} />, label: '矩形', activeClass: 'bg-blue-500 text-white' },
        { id: 'circle', icon: <Circle size={16} />, label: '椭圆', activeClass: 'bg-amber-500 text-white' },
        { id: 'highlight', icon: <Highlighter size={16} />, label: '高亮', activeClass: 'bg-yellow-500 text-white' },
      ]
    },
    {
      tools: [
        { id: 'text', icon: <CaseSensitive size={16} />, label: '文字', activeClass: 'bg-green-500 text-white' },
        { id: 'number', icon: <Hash size={16} />, label: '编号', activeClass: 'bg-indigo-500 text-white' },
      ]
    },
    {
      tools: [
        { id: 'blur', icon: <Grid3x3 size={16} />, label: '马赛克', activeClass: 'bg-gray-500 text-white' },
        { id: 'eraser', icon: <Eraser size={16} />, label: '橡皮擦', activeClass: 'bg-orange-500 text-white' },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col select-none">
      <div className="px-3 py-2 flex items-center justify-between bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">标注</span>
          {toolGroups.map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <div className="w-px h-5 bg-gray-700" />}
              <div className="flex items-center gap-0.5">
                {group.tools.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTool(t.id === tool ? null : t.id); setCropMode(false); }}
                    className={`p-1.5 rounded-md transition-colors text-xs ${tool === t.id ? t.activeClass : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`}
                    title={t.label}
                  >
                    {t.icon}
                  </button>
                ))}
              </div>
            </React.Fragment>
          ))}

          <div className="w-px h-5 bg-gray-700" />

          <div className="flex items-center gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setCurrentColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${currentColor === c ? 'border-white scale-110' : 'border-transparent hover:border-gray-500'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-gray-700" />

          <div className="flex items-center gap-1">
            {LINE_WIDTHS.map(lw => (
              <button
                key={lw}
                onClick={() => setCurrentLineWidth(lw)}
                className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${currentLineWidth === lw ? 'bg-gray-600' : 'hover:bg-gray-700'}`}
                title={`线宽 ${lw}px`}
              >
                <div className={`rounded-full bg-gray-300`} style={{ width: Math.min(lw, 6), height: Math.min(lw, 6) }} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={handleUndo} disabled={annotations.length === 0} className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-30" title="撤销">
            <Undo2 size={16} />
          </button>
          <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-30" title="重做">
            <Redo2 size={16} />
          </button>
          <div className="w-px h-5 bg-gray-700 mx-1" />
          <button onClick={() => { setCropMode(!cropMode); setTool(null); setCropRect(null); }} className={`p-1.5 rounded-md transition-colors ${cropMode ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`} title="裁剪">
            <Crop size={16} />
          </button>
          <button onClick={handleZoomOut} disabled={zoom <= 0.25} className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-30" title="缩小">
            <ZoomOut size={16} />
          </button>
          <span className="text-2xs text-gray-500 min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} disabled={zoom >= 3} className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-30" title="放大">
            <ZoomIn size={16} />
          </button>
          <button onClick={handleZoomReset} className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:bg-gray-700 text-2xs" title="重置缩放">1:1</button>
          <div className="w-px h-5 bg-gray-700 mx-1" />
          <button onClick={onClose} className="p-1.5 rounded-md bg-gray-800 text-gray-400 hover:bg-gray-700" title="关闭">
            <X size={16} />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center relative bg-gray-950">
        <canvas
          ref={canvasRef}
          onMouseDown={cropMode ? (e) => { const pos = getMousePos(e); setIsDrawing(true); setStartPos(pos); } : handleMouseDown}
          onMouseMove={cropMode ? handleMouseMove : handleMouseMove}
          onMouseUp={cropMode ? (e) => { setIsDrawing(false); } : handleMouseUp}
          onMouseLeave={() => setIsDrawing(false)}
          className={`${tool === 'select' ? 'cursor-default' : tool === 'eraser' ? 'cursor-pointer' : (tool || cropMode) ? 'cursor-crosshair' : 'cursor-default'}`}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            maxHeight: 'none',
            maxWidth: 'none'
          }}
        />

        {showTextInput && (
          <div
            className="absolute bg-white rounded-lg shadow-2xl p-2 flex items-center gap-2 border-2 border-green-500 z-10"
            style={{
              left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <input
              type="text"
              value={textInputValue}
              onChange={e => setTextInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleTextConfirm(); if (e.key === 'Escape') { setShowTextInput(false); setTextInputValue(''); } }}
              placeholder="输入标注文字..."
              className="px-2 py-1 text-sm outline-none min-w-[160px]"
              autoFocus
            />
            <button onClick={handleTextConfirm} className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">确定</button>
            <button onClick={() => { setShowTextInput(false); setTextInputValue(''); }} className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300">取消</button>
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-gray-900 border-t border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {tool && (
            <span className="text-2xs text-gray-500">
              {tool === 'select' ? '选择：点击标注后拖拽移动' :
               tool === 'pen' ? '画笔：拖拽绘制' :
               tool === 'arrow' ? '箭头：拖拽方向' :
               tool === 'line' ? '直线：拖拽起止' :
               tool === 'rect' ? '矩形：拖拽框选' :
               tool === 'circle' ? '椭圆：拖拽框选' :
               tool === 'highlight' ? '高亮：拖拽区域' :
               tool === 'text' ? '文字：点击放置' :
               tool === 'number' ? '编号：点击放置' :
               tool === 'blur' ? '马赛克：拖拽区域' :
               tool === 'eraser' ? '橡皮擦：点击删除' : ''}
            </span>
          )}
          {cropMode && cropRect && cropRect.w > 10 && cropRect.h > 10 && (
            <button onClick={handleCropConfirm} className="px-3 py-1 text-xs font-medium bg-cyan-500 text-white rounded-md hover:bg-cyan-600 transition-colors">
              确认裁剪
            </button>
          )}
          {cropMode && !cropRect && (
            <span className="text-2xs text-cyan-400">拖拽选择裁剪区域</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm font-medium text-gray-400 hover:text-white transition-colors">取消</button>
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors">
            <Download size={14} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClipAnnotator;
