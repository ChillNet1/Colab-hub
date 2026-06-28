import React, { useRef, useState, useEffect } from "react";
import { 
  Pencil, 
  Square, 
  Circle, 
  Slash, 
  ArrowRight, 
  Eraser, 
  Type, 
  Undo2, 
  Redo2, 
  Trash2, 
  Lock
} from "lucide-react";
import { WhiteboardAction } from "../types";

interface WhiteboardProps {
  roomId: string;
  userId: string;
  userName: string;
  userColor: string;
  isLocked: boolean;
  isHost: boolean;
  whiteboardData: WhiteboardAction[];
  sendWsMessage: (msg: any) => void;
  // External listener for cursors
  activeCursors: { [userId: string]: { x: number; y: number; name: string; color: string; updatedAt: number } };
}

type DrawTool = "pencil" | "square" | "circle" | "line" | "arrow" | "eraser" | "text";

export default function Whiteboard({
  userId,
  userName,
  userColor,
  isLocked,
  isHost,
  whiteboardData,
  sendWsMessage,
  activeCursors
}: WhiteboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [tool, setTool] = useState<DrawTool>("pencil");
  const [color, setColor] = useState<string>(userColor);
  const [thickness, setThickness] = useState<number>(4);
  const [textInput, setTextInput] = useState<string>("");
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);

  // Undo/Redo stacks for local drawing tracking before broadcast
  const [undoStack, setUndoStack] = useState<WhiteboardAction[]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardAction[]>([]);

  // Local drawing states
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [currentPath, setCurrentPath] = useState<number[]>([]);

  // Canvas size state
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle auto-resizing based on parent container
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 400),
          height: Math.max(height, 350)
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Sync canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    redrawCanvas();
  }, [dimensions, whiteboardData]);

  // Main render routine for Canvas
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Render all elements in whiteboardData
    whiteboardData.forEach((action) => {
      ctx.strokeStyle = action.color;
      ctx.fillStyle = action.color;
      ctx.lineWidth = action.thickness;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (action.type === "draw" && action.points && action.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(action.points[0], action.points[1]);
        for (let i = 2; i < action.points.length; i += 2) {
          ctx.lineTo(action.points[i], action.points[i + 1]);
        }
        ctx.stroke();
      } else if (action.type === "shape" && action.startPoint && action.endPoint) {
        const sp = action.startPoint;
        const ep = action.endPoint;
        
        ctx.beginPath();
        if (action.shapeType === "line") {
          ctx.moveTo(sp.x, sp.y);
          ctx.lineTo(ep.x, ep.y);
          ctx.stroke();
        } else if (action.shapeType === "arrow") {
          // Draw Line
          ctx.moveTo(sp.x, sp.y);
          ctx.lineTo(ep.x, ep.y);
          ctx.stroke();
          
          // Draw Arrowhead
          const angle = Math.atan2(ep.y - sp.y, ep.x - sp.x);
          ctx.beginPath();
          ctx.moveTo(ep.x, ep.y);
          ctx.lineTo(ep.x - 15 * Math.cos(angle - Math.PI / 6), ep.y - 15 * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(ep.x - 15 * Math.cos(angle + Math.PI / 6), ep.y - 15 * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        } else if (action.shapeType === "square") {
          ctx.strokeRect(sp.x, sp.y, ep.x - sp.x, ep.y - sp.y);
        } else if (action.shapeType === "circle") {
          const radius = Math.sqrt(Math.pow(ep.x - sp.x, 2) + Math.pow(ep.y - sp.y, 2));
          ctx.arc(sp.x, sp.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else if (action.type === "text" && action.position && action.text) {
        ctx.font = `${action.thickness * 4 + 12}px Inter, sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(action.text, action.position.x, action.position.y);
      }
    });
  };

  const getMouseCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Support scaled rendering if CSS size differs slightly
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isLocked && !isHost) return;
    const coords = getMouseCoords(e);
    setIsDrawing(true);
    setStartPos(coords);

    if (tool === "pencil" || tool === "eraser") {
      setCurrentPath([coords.x, coords.y]);
    } else if (tool === "text") {
      setTextPos(coords);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getMouseCoords(e);

    // Broadcast local cursor position for multi-user visualization
    if (sendWsMessage) {
      sendWsMessage({
        type: "whiteboard_cursor",
        x: coords.x,
        y: coords.y,
        color
      });
    }

    if (!isDrawing || (isLocked && !isHost)) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Draw temporary preview on canvas for shapes
    if (tool === "pencil") {
      const newPath = [...currentPath, coords.x, coords.y];
      setCurrentPath(newPath);

      // Draw local line segment instantly
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(newPath[newPath.length - 4], newPath[newPath.length - 3]);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else if (tool === "eraser") {
      const newPath = [...currentPath, coords.x, coords.y];
      setCurrentPath(newPath);

      ctx.strokeStyle = "#121214"; // matches dark background or clear rect
      ctx.lineWidth = thickness * 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(newPath[newPath.length - 4], newPath[newPath.length - 3]);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else {
      // For shapes, redraw background + temporary shape outline
      redrawCanvas();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = thickness;
      ctx.lineCap = "round";

      ctx.beginPath();
      if (tool === "line") {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
      } else if (tool === "arrow") {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        
        const angle = Math.atan2(coords.y - startPos.y, coords.x - startPos.x);
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        ctx.lineTo(coords.x - 15 * Math.cos(angle - Math.PI / 6), coords.y - 15 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(coords.x - 15 * Math.cos(angle + Math.PI / 6), coords.y - 15 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (tool === "square") {
        ctx.strokeRect(startPos.x, startPos.y, coords.x - startPos.x, coords.y - startPos.y);
      } else if (tool === "circle") {
        const radius = Math.sqrt(Math.pow(coords.x - startPos.x, 2) + Math.pow(coords.y - startPos.y, 2));
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || (isLocked && !isHost)) return;
    setIsDrawing(false);
    const coords = getMouseCoords(e);

    let action: WhiteboardAction | null = null;

    if (tool === "pencil" && currentPath.length > 2) {
      action = {
        id: `draw-${Date.now()}-${Math.random()}`,
        type: "draw",
        userId,
        color,
        thickness,
        points: currentPath
      };
    } else if (tool === "eraser" && currentPath.length > 2) {
      action = {
        id: `erase-${Date.now()}-${Math.random()}`,
        type: "draw",
        userId,
        color: "#121214", // dark bg color
        thickness: thickness * 3,
        points: currentPath
      };
    } else if (["square", "circle", "line", "arrow"].includes(tool)) {
      action = {
        id: `shape-${Date.now()}-${Math.random()}`,
        type: "shape",
        userId,
        color,
        thickness,
        shapeType: tool as any,
        startPoint: startPos,
        endPoint: coords
      };
    }

    if (action) {
      setUndoStack((prev) => [...prev, action!]);
      setRedoStack([]); // reset redo on new action
      sendWsMessage({
        type: "whiteboard_draw",
        action
      });
    }

    setCurrentPath([]);
  };

  const handleAddText = () => {
    if (!textPos || !textInput.trim()) return;

    const action: WhiteboardAction = {
      id: `text-${Date.now()}-${Math.random()}`,
      type: "text",
      userId,
      color,
      thickness, // used for text font scale multiplier
      position: textPos,
      text: textInput
    };

    setUndoStack((prev) => [...prev, action]);
    sendWsMessage({
      type: "whiteboard_draw",
      action
    });

    setTextInput("");
    setTextPos(null);
  };

  const handleClear = () => {
    if (isLocked && !isHost) return;
    if (window.confirm("Очистить всю доску для совместной работы?")) {
      sendWsMessage({ type: "whiteboard_clear" });
    }
  };

  // Preset Colors
  const presetColors = [
    "#ffffff", // White
    "#3b82f6", // Blue
    "#10b981", // Green
    "#ef4444", // Red
    "#f59e0b", // Yellow
    "#ec4899", // Pink
    "#8b5cf6"  // Purple
  ];

  return (
    <div className="flex flex-col h-full bg-[#030712]/40 text-white overflow-hidden rounded-3xl border border-white/10 shadow-2xl relative glass-card">
      
      {/* Tool Header */}
      <div className="flex flex-wrap items-center justify-between p-3 gap-2 border-b border-white/10 bg-[#020617]/40 backdrop-blur-md z-10">
        <div className="flex items-center space-x-1.5">
          {/* Tool Buttons */}
          <button
            id="wb-pencil-btn"
            title="Карандаш"
            onClick={() => setTool("pencil")}
            className={`p-2 rounded-lg transition-all ${tool === "pencil" ? "bg-blue-600 text-white shadow-lg" : "hover:bg-white/5 text-gray-400"}`}
          >
            <Pencil size={18} />
          </button>
          
          <button
            id="wb-eraser-btn"
            title="Ластик"
            onClick={() => setTool("eraser")}
            className={`p-2 rounded-lg transition-all ${tool === "eraser" ? "bg-blue-600 text-white shadow-lg" : "hover:bg-white/5 text-gray-400"}`}
          >
            <Eraser size={18} />
          </button>

          <button
            id="wb-line-btn"
            title="Линия"
            onClick={() => setTool("line")}
            className={`p-2 rounded-lg transition-all ${tool === "line" ? "bg-blue-600 text-white shadow-lg" : "hover:bg-white/5 text-gray-400"}`}
          >
            <Slash size={18} className="rotate-45" />
          </button>

          <button
            id="wb-arrow-btn"
            title="Стрелка"
            onClick={() => setTool("arrow")}
            className={`p-2 rounded-lg transition-all ${tool === "arrow" ? "bg-blue-600 text-white shadow-lg" : "hover:bg-white/5 text-gray-400"}`}
          >
            <ArrowRight size={18} />
          </button>

          <button
            id="wb-rect-btn"
            title="Прямоугольник"
            onClick={() => setTool("square")}
            className={`p-2 rounded-lg transition-all ${tool === "square" ? "bg-blue-600 text-white shadow-lg" : "hover:bg-white/5 text-gray-400"}`}
          >
            <Square size={18} />
          </button>

          <button
            id="wb-circle-btn"
            title="Круг"
            onClick={() => setTool("circle")}
            className={`p-2 rounded-lg transition-all ${tool === "circle" ? "bg-blue-600 text-white shadow-lg" : "hover:bg-white/5 text-gray-400"}`}
          >
            <Circle size={18} />
          </button>

          <button
            id="wb-text-btn"
            title="Текст"
            onClick={() => setTool("text")}
            className={`p-2 rounded-lg transition-all ${tool === "text" ? "bg-blue-600 text-white shadow-lg" : "hover:bg-white/5 text-gray-400"}`}
          >
            <Type size={18} />
          </button>
        </div>

        {/* Thickness & Colors */}
        <div className="flex items-center space-x-4">
          {/* Thickness line */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400">Толщина:</span>
            <input
              id="wb-thickness-slider"
              type="range"
              min="1"
              max="20"
              value={thickness}
              onChange={(e) => setThickness(Number(e.target.value))}
              className="w-20 accent-blue-500 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
            />
            <span className="text-xs font-mono w-5">{thickness}px</span>
          </div>

          {/* Color Palettes */}
          <div className="flex items-center space-x-1">
            {presetColors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-5 h-5 rounded-full transition-all hover:scale-125 border ${color === c ? "border-blue-500 scale-110 shadow-md ring-2 ring-blue-500/20" : "border-transparent"}`}
              />
            ))}
            <input
              id="wb-custom-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-5 h-5 rounded-full border-0 p-0 cursor-pointer bg-transparent"
              title="Выбрать цвет"
            />
          </div>
        </div>

        {/* Operations (Clear, lock notifications) */}
        <div className="flex items-center space-x-1.5">
          <button
            id="wb-clear-btn"
            onClick={handleClear}
            disabled={isLocked && !isHost}
            className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
            title="Очистить доску"
          >
            <Trash2 size={18} />
          </button>
          
          {isLocked && (
            <div className="flex items-center text-xs text-rose-400 space-x-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20">
              <Lock size={12} />
              <span>Только чтение</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Drawing Area */}
      <div 
        ref={containerRef} 
        className="flex-grow w-full relative bg-[#030712] overflow-hidden"
        style={{ cursor: tool === "eraser" ? "cell" : tool === "text" ? "text" : "crosshair" }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsDrawing(false)}
          className="absolute inset-0 block bg-[#030712]"
        />

        {/* Floating Text Input Box */}
        {textPos && (
          <div 
            className="absolute p-2 bg-zinc-900 border border-white/10 rounded-lg shadow-xl flex items-center space-x-2 z-20"
            style={{ left: textPos.x, top: textPos.y }}
          >
            <input
              id="wb-text-field"
              type="text"
              autoFocus
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddText();
                if (e.key === "Escape") setTextPos(null);
              }}
              placeholder="Введите текст..."
              className="px-2 py-1 text-sm bg-black/40 border border-white/5 rounded outline-none w-48 text-white focus:border-blue-500"
            />
            <button
              id="wb-text-submit"
              onClick={handleAddText}
              className="px-2 py-1 bg-blue-600 text-xs rounded hover:bg-blue-500"
            >
              Добавить
            </button>
            <button
              id="wb-text-cancel"
              onClick={() => setTextPos(null)}
              className="px-2 py-1 bg-white/5 text-xs rounded hover:bg-white/10"
            >
              Отмена
            </button>
          </div>
        )}

        {/* Live Multi-User Cursor Indicators */}
        {Object.entries(activeCursors).map(([cUserId, cursor]) => {
          // Skip drawing self, or stale cursors (over 5 seconds without updates)
          if (cUserId === userId || Date.now() - cursor.updatedAt > 5000) return null;
          
          return (
            <div
              key={cUserId}
              className="absolute pointer-events-none transition-all duration-75 z-10"
              style={{
                left: cursor.x,
                top: cursor.y,
                transform: "translate(-5px, -5px)"
              }}
            >
              {/* Custom SVG cursor arrow */}
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 16 16" 
                fill="none" 
                className="drop-shadow-md"
              >
                <path 
                  d="M1.5 1.5L7.5 14.5L10 9L15.5 6.5L1.5 1.5Z" 
                  fill={cursor.color}
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              {/* Custom Name tag */}
              <div 
                style={{ backgroundColor: cursor.color }}
                className="ml-3.5 mt-2.5 px-2 py-0.5 rounded text-[10px] font-medium text-white shadow-lg whitespace-nowrap border border-white/10"
              >
                {cursor.name} рисует...
              </div>
            </div>
          );
        })}
      </div>

      {/* Info footer bar */}
      <div className="flex justify-between items-center bg-white/[0.02] border-t border-white/5 px-4 py-2 text-xs text-gray-500">
        <span>Инструмент: {tool.toUpperCase()}</span>
        <span>Все участники могут рисовать на этой доске в реальном времени.</span>
      </div>
    </div>
  );
}
