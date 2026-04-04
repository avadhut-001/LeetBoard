import React, { useRef, useState, useEffect, useCallback } from "react";
import LeetCodePanel from "../components/LeetCodePanel";
import ToolButton, { LabelButton } from "../components/ToolButton";
import { Code, Moon, Sun, ImagePlus, Download, Upload } from "lucide-react";
import {
  Hand, MousePointer2, Square, Diamond, Circle,
  ArrowRight, Minus, Pencil, Type, Image as ImageIcon,
  Eraser, Plus, Minus as MinusIcon,
  Undo2, Redo2, HelpCircle, Lock
} from "lucide-react";

// ─── image cache ─────────────────────────────────────────────────────────────
const imageCache = new Map();
const loadImage = (src, onReady) => {
  if (imageCache.has(src)) { onReady(imageCache.get(src)); return; }
  const img = new Image();
  img.onload = () => { imageCache.set(src, img); onReady(img); };
  img.src = src;
};

// ─── helpers ─────────────────────────────────────────────────────────────────
const screenToCanvas = (sx, sy, offset, zoom) => ({
  x: (sx - offset.x) / zoom,
  y: (sy - offset.y) / zoom,
});

// Returns which resize handle (0-7) the point hits, or -1
// Handles: 0=TL 1=TC 2=TR 3=ML 4=MR 5=BL 6=BC 7=BR
const HANDLE_SIZE = 8; // canvas units
const getHandles = (shape) => {
  const { x, y, w, h } = shape;
  return [
    { x: x, y: y }, // 0 TL
    { x: x + w / 2, y: y }, // 1 TC
    { x: x + w, y: y }, // 2 TR
    { x: x, y: y + h / 2 }, // 3 ML
    { x: x + w, y: y + h / 2 }, // 4 MR
    { x: x, y: y + h }, // 5 BL
    { x: x + w / 2, y: y + h }, // 6 BC
    { x: x + w, y: y + h }, // 7 BR
  ];
};

const hitHandle = (shape, pos, zoom) => {
  const hs = HANDLE_SIZE / zoom;
  const handles = getHandles(shape);
  for (let i = 0; i < handles.length; i++) {
    const h = handles[i];
    if (Math.abs(pos.x - h.x) <= hs && Math.abs(pos.y - h.y) <= hs) return i;
  }
  return -1;
};

const hitImage = (shape, pos) =>
  pos.x >= shape.x && pos.x <= shape.x + shape.w &&
  pos.y >= shape.y && pos.y <= shape.y + shape.h;

const HANDLE_CURSORS = [
  "nw-resize", "n-resize", "ne-resize",
  "w-resize", "e-resize",
  "sw-resize", "s-resize", "se-resize",
];

// ─── shape renderer ───────────────────────────────────────────────────────────
const drawShape = (ctx, shape) => {
  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.lineWidth ?? 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "source-over";

  switch (shape.type) {
    case "rect":
      ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      break;
    case "circle": {
      const r = Math.hypot(shape.w, shape.h);
      ctx.beginPath();
      ctx.arc(shape.x, shape.y, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "diamond": {
      const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, shape.y);
      ctx.lineTo(shape.x + shape.w, cy);
      ctx.lineTo(cx, shape.y + shape.h);
      ctx.lineTo(shape.x, cy);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "line":
      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.lineTo(shape.x + shape.w, shape.y + shape.h);
      ctx.stroke();
      break;
    case "arrow": {
      const ex = shape.x + shape.w, ey = shape.y + shape.h;
      const angle = Math.atan2(shape.h, shape.w);
      const hl = 14;
      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex - hl * Math.cos(angle - Math.PI / 6), ey - hl * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - hl * Math.cos(angle + Math.PI / 6), ey - hl * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      break;
    }
    case "pencil":
      if (!shape.points || shape.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      shape.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      break;
    case "eraser":
      if (!shape.points || shape.points.length < 2) break;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = shape.eraserSize ?? 20;
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      shape.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.restore();
      break;
    case "image":
      if (imageCache.has(shape.src))
        ctx.drawImage(imageCache.get(shape.src), shape.x, shape.y, shape.w, shape.h);
      break;
    case "text":
      ctx.fillStyle = shape.color;
      ctx.font = `${shape.fontSize ?? 18}px 'Segoe UI', sans-serif`;
      (shape.text ?? "").split("\n").forEach((line, i) =>
        ctx.fillText(line, shape.x, shape.y + (i + 1) * (shape.fontSize ?? 18) * 1.3)
      );
      break;
    case "code": {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#6965db";
      ctx.lineWidth = 2;

      // box
      ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
      ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);

      // text
      ctx.fillStyle = "#000";
      ctx.font = "14px sans-serif";

      const text = shape.time || "Code";
      ctx.fillText(text, shape.x + 8, shape.y + 20);
      break;
    }
    default: break;
  }
  ctx.restore();
};

// Draw selection box + handles around selected image
const drawSelection = (ctx, shape, zoom) => {
  ctx.save();
  ctx.strokeStyle = "#6965db";
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([4 / zoom, 3 / zoom]);
  ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
  ctx.setLineDash([]);

  const hs = HANDLE_SIZE / zoom;
  getHandles(shape).forEach(h => {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#6965db";
    ctx.lineWidth = 1.5 / zoom;
    ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
    ctx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
  });
  ctx.restore();
};

// ─── full redraw ──────────────────────────────────────────────────────────────
const redrawAll = (canvas, ctx, shapes, offset, zoom, darkMode, selectedIdx) => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (darkMode) { ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.restore();

  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, offset.x, offset.y);
  shapes.forEach((s, i) => {
    drawShape(ctx, s);
    if (s.type === "image" && i === selectedIdx) drawSelection(ctx, s, zoom);
  });
  ctx.restore();
};

// ─── component ───────────────────────────────────────────────────────────────
const ExcalidrawClone = () => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const fileInputRef = useRef(null);
  const loadInputRef = useRef(null);

  // ── save session ──────────────────────────────────────────────────────────
  const saveSession = () => {
    const exportShapes = shapesRef.current.map(s => ({ ...s }));

    const session = {
      version: 1,
      shapes: exportShapes,
      offset: offsetRef.current,
      zoom: zoomRef.current,
      darkMode: darkModeRef.current,

      codes: codes,
      question: currentQuestion,
    };

    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    let fileName = "drawing-session.json";

    if (currentQuestion) {
      const safeTitle = currentQuestion.title
        .replace(/[^\w\s]/gi, "")   // remove special chars
        .replace(/\s+/g, "-");      // spaces → dash

      fileName = `${currentQuestion.id}-${safeTitle}.json`;
    }

    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── load session ──────────────────────────────────────────────────────────
  const handleLoadSession = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const session = JSON.parse(ev.target.result);
        if (!session.shapes) throw new Error("Invalid file");
        if (session.codes) {
          setCodes(session.codes);
        }
        const imagesToLoad = session.shapes.filter(s => s.type === "image");

        let loaded = 0;
        const afterLoad = () => {
          shapesRef.current = session.shapes;
          historyRef.current = [[], [...session.shapes]];
          redoStackRef.current = [];

          const newOffset = session.offset ?? { x: 0, y: 0 };
          const newZoom = session.zoom ?? 1;

          offsetRef.current = newOffset;
          zoomRef.current = newZoom;

          setOffset(newOffset);
          setZoom(newZoom);

          if (session.darkMode !== undefined) {
            darkModeRef.current = session.darkMode;
            setDarkMode(session.darkMode);
          }

          // ✅ RESTORE QUESTION
          if (session.question) {
            setCurrentQuestion(session.question);
          }

          setSelectedImg(-1);
          repaint();
        };

        if (imagesToLoad.length === 0) {
          afterLoad();
          return;
        }

        imagesToLoad.forEach(s => {
          loadImage(s.src, () => {
            loaded++;
            if (loaded === imagesToLoad.length) afterLoad();
          });
        });

      } catch {
        alert("Could not load session — invalid file.");
      }
    };

    reader.readAsText(file);
    e.target.value = "";
  };

  const [tool, setTool] = useState("pointer");
  const [color, setColor] = useState("#1e1e1e");
  const [eraserSize, setEraserSize] = useState(20);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panelOpen, setPanelOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [textBox, setTextBox] = useState(null);
  const [textValue, setTextValue] = useState("");

  // Selected image index
  const [selectedImg, setSelectedImg] = useState(-1);
  const selectedImgRef = useRef(-1);

  const shapesRef = useRef([]);
  const historyRef = useRef([[]]);
  const redoStackRef = useRef([]);

  const isDrawingRef = useRef(false);
  const currentShapeRef = useRef(null);
  const panStartRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const darkModeRef = useRef(false);

  // Image interaction state
  const imgActionRef = useRef(null);
  // { mode: "drag"|"resize", shapeIdx, handleIdx,
  //   startPos, origShape }
  const [currentQuestion, setCurrentQuestion] = useState(null);

  const [showCodeModal, setShowCodeModal] = useState(false);
  const [timeComplexity, setTimeComplexity] = useState("");
  const [codeValue, setCodeValue] = useState("");

  const [codes, setCodes] = useState([]);
  const [selectedCodeIdx, setSelectedCodeIdx] = useState(-1);
  // ── sync refs ──────────────────────────────────────────────────────────────
  useEffect(() => { offsetRef.current = offset; }, [offset]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { darkModeRef.current = darkMode; repaint(); }, [darkMode]);
  useEffect(() => { selectedImgRef.current = selectedImg; }, [selectedImg]);

  // ── canvas init ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctxRef.current = canvas.getContext("2d");
    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      repaint();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── repaint ────────────────────────────────────────────────────────────────
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;
    redrawAll(canvas, ctxRef.current, shapesRef.current,
      offsetRef.current, zoomRef.current, darkModeRef.current, selectedImgRef.current);
  }, []);

  useEffect(() => { repaint(); }, [offset, zoom, repaint]);

  // ── history ────────────────────────────────────────────────────────────────
  const saveHistory = () => {
    historyRef.current.push([...shapesRef.current]);
    redoStackRef.current = [];
  };
  const undo = () => {
    if (historyRef.current.length <= 1) return;
    redoStackRef.current.push(historyRef.current.pop());
    shapesRef.current = [...historyRef.current[historyRef.current.length - 1]];
    repaint();
  };
  const redo = () => {
    if (!redoStackRef.current.length) return;
    const next = redoStackRef.current.pop();
    historyRef.current.push(next);
    shapesRef.current = [...next];
    repaint();
  };

  // ── canvas position helper ─────────────────────────────────────────────────
  const getCanvasPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return screenToCanvas(e.clientX - rect.left, e.clientY - rect.top,
      offsetRef.current, zoomRef.current);
  };

  // ── image upload ───────────────────────────────────────────────────────────
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      loadImage(ev.target.result, (img) => {
        const canvas = canvasRef.current;
        const cx = (canvas.width / 2 - offsetRef.current.x) / zoomRef.current;
        const cy = (canvas.height / 2 - offsetRef.current.y) / zoomRef.current;
        const maxW = 400;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = img.width * scale;
        const h = img.height * scale;
        saveHistory();
        const newIdx = shapesRef.current.length;
        shapesRef.current = [
          ...shapesRef.current,
          { type: "image", x: cx - w / 2, y: cy - h / 2, w, h, src: ev.target.result },
        ];
        setSelectedImg(newIdx);
        repaint();
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── apply resize delta from handle drag ───────────────────────────────────
  const applyResize = (orig, handleIdx, dx, dy) => {
    let { x, y, w, h } = orig;
    // handle index layout:
    // 0 TL  1 TC  2 TR
    // 3 ML        4 MR
    // 5 BL  6 BC  7 BR
    switch (handleIdx) {
      case 0: x += dx; y += dy; w -= dx; h -= dy; break; // TL
      case 1: y += dy; h -= dy; break; // TC
      case 2: y += dy; w += dx; h -= dy; break; // TR
      case 3: x += dx; w -= dx; break; // ML
      case 4: w += dx; break; // MR
      case 5: x += dx; w -= dx; h += dy; break; // BL
      case 6: h += dy; break; // BC
      case 7: w += dx; h += dy; break; // BR
    }
    // keep minimum size
    if (w < 10) { if ([0, 3, 5].includes(handleIdx)) x = orig.x + orig.w - 10; w = 10; }
    if (h < 10) { if ([0, 1, 2].includes(handleIdx)) y = orig.y + orig.h - 10; h = 10; }
    return { x, y, w, h };
  };

  // ── pointer down ──────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    const pos = getCanvasPos(e);

    // ── hand tool pan ──
    if (tool === "hand") {
      panStartRef.current = { mx: e.clientX, my: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y };
      return;
    }

    // ── pointer tool: check image interaction ──
    if (tool === "pointer") {
      // check selected image handles first
      const selIdx = selectedImgRef.current;
      if (selIdx !== -1 && shapesRef.current[selIdx]) {
        const shape = shapesRef.current[selIdx];
        const hIdx = hitHandle(shape, pos, zoomRef.current);
        if (hIdx !== -1) {
          imgActionRef.current = { mode: "resize", shapeIdx: selIdx, handleIdx: hIdx, startPos: pos, origShape: { ...shape } };
          return;
        }
        if (hitImage(shape, pos)) {
          imgActionRef.current = { mode: "drag", shapeIdx: selIdx, startPos: pos, origShape: { ...shape } };
          return;
        }
      }
      // check all images for click-to-select
      for (let i = shapesRef.current.length - 1; i >= 0; i--) {
        const s = shapesRef.current[i];
        if (s.type === "image" && hitImage(s, pos)) {
          setSelectedImg(i);
          imgActionRef.current = { mode: "drag", shapeIdx: i, startPos: pos, origShape: { ...s } };
          return;
        }
      }
      // clicked empty space — deselect
      setSelectedImg(-1);
      return;
    }

    // ── deselect image when using drawing tools ──
    setSelectedImg(-1);

    // ── text tool ──
    if (tool === "text") {
      currentShapeRef.current = { type: "textbox", x: pos.x, y: pos.y, w: 0, h: 0 };
      isDrawingRef.current = true;
      return;
    }

    // ── freehand tools ──
    if (tool === "pencil" || tool === "eraser") {
      currentShapeRef.current = { type: tool, color, lineWidth: 3, eraserSize, points: [pos] };
      isDrawingRef.current = true;
      return;
    }

    // ── shape tools ──
    currentShapeRef.current = { type: tool, x: pos.x, y: pos.y, w: 0, h: 0, color, lineWidth: 3 };
    isDrawingRef.current = true;
  };

  // ── pointer move ──────────────────────────────────────────────────────────
  const onMouseMove = (e) => {
    // pan
    if (tool === "hand" && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.mx;
      const dy = e.clientY - panStartRef.current.my;
      const newOffset = { x: panStartRef.current.ox + dx, y: panStartRef.current.oy + dy };
      offsetRef.current = newOffset;
      setOffset(newOffset);
      return;
    }

    // image drag / resize
    if (imgActionRef.current) {
      const pos = getCanvasPos(e);
      const { mode, shapeIdx, handleIdx, startPos, origShape } = imgActionRef.current;
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;
      const shapes = [...shapesRef.current];

      if (mode === "drag") {
        shapes[shapeIdx] = { ...origShape, x: origShape.x + dx, y: origShape.y + dy };
      } else {
        const resized = applyResize(origShape, handleIdx, dx, dy);
        shapes[shapeIdx] = { ...origShape, ...resized };
      }
      shapesRef.current = shapes;
      repaint();
      return;
    }

    if (!isDrawingRef.current || !currentShapeRef.current) return;

    const pos = getCanvasPos(e);
    const shape = currentShapeRef.current;

    if (shape.type === "pencil" || shape.type === "eraser") {
      shape.points = [...shape.points, pos];
    } else {
      shape.w = pos.x - shape.x;
      shape.h = pos.y - shape.y;
    }

    redrawAll(canvasRef.current, ctxRef.current, shapesRef.current,
      offsetRef.current, zoomRef.current, darkModeRef.current, selectedImgRef.current);

    if (shape.type !== "textbox") {
      ctxRef.current.save();
      ctxRef.current.setTransform(zoomRef.current, 0, 0, zoomRef.current, offsetRef.current.x, offsetRef.current.y);
      drawShape(ctxRef.current, shape);
      ctxRef.current.restore();
    } else {
      const ctx = ctxRef.current;
      ctx.save();
      ctx.setTransform(zoomRef.current, 0, 0, zoomRef.current, offsetRef.current.x, offsetRef.current.y);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#999";
      ctx.lineWidth = 1;
      ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      ctx.setLineDash([]);
      ctx.restore();
    }
  };

  // ── pointer up ────────────────────────────────────────────────────────────
  const onMouseUp = (e) => {
    if (tool === "hand") { panStartRef.current = null; return; }

    // finish image drag/resize
    if (imgActionRef.current) {
      saveHistory();
      imgActionRef.current = null;
      repaint();
      return;
    }

    if (!isDrawingRef.current || !currentShapeRef.current) return;
    isDrawingRef.current = false;

    const shape = currentShapeRef.current;
    currentShapeRef.current = null;

    if (shape.type === "textbox") {
      const pos = getCanvasPos(e);
      setTextBox({ x: shape.x, y: shape.y, w: pos.x - shape.x, h: pos.y - shape.y });
      setTextValue("");
      repaint();
      return;
    }

    if (shape.type !== "pencil" && shape.type !== "eraser") {
      if (Math.abs(shape.w) < 2 && Math.abs(shape.h) < 2) { repaint(); return; }
    }

    saveHistory();
    shapesRef.current = [...shapesRef.current, shape];
    repaint();
  };

  const commitText = () => {
    if (textValue.trim() && textBox) {
      saveHistory();
      shapesRef.current = [
        ...shapesRef.current,
        { type: "text", x: textBox.x, y: textBox.y, text: textValue, color, fontSize: 18 },
      ];
      repaint();
    }
    setTextBox(null);
    setTextValue("");
  };

  // ── zoom ──────────────────────────────────────────────────────────────────
  const applyZoom = (delta) => {
    const next = Math.min(5, Math.max(0.2, zoomRef.current + delta));
    zoomRef.current = next;
    setZoom(next);
  };
  const onWheel = (e) => { e.preventDefault(); applyZoom(e.deltaY > 0 ? -0.05 : 0.05); };

  // ── cursor ────────────────────────────────────────────────────────────────
  const getCanvasCursor = () => {
    if (tool === "hand") return panStartRef.current ? "grabbing" : "grab";
    if (tool === "eraser") return "cell";
    if (tool === "pointer") {
      const selIdx = selectedImgRef.current;
      if (selIdx !== -1 && shapesRef.current[selIdx]) {
        // Would need live mouse pos to determine — keep as pointer/move
      }
      return "default";
    }
    return "crosshair";
  };
  const cursor = getCanvasCursor();

  const textScreenPos = textBox ? {
    left: textBox.x * zoom + offset.x,
    top: textBox.y * zoom + offset.y,
    width: Math.abs(textBox.w) * zoom,
    height: Math.abs(textBox.h) * zoom,
  } : null;

  const ui = {
    bg: darkMode ? "bg-[#1e1e2e]" : "bg-white",
    border: darkMode ? "border-[#2e2e3e]" : "border-gray-200",
    text: darkMode ? "text-gray-100" : "text-gray-700",
    hover: darkMode ? "hover:bg-[#2e2e3e]" : "hover:bg-gray-100",
    activeBg: darkMode ? "bg-[#3a3a5c] text-violet-300" : "bg-[#e0dfff] text-[#6965db]",
    subText: darkMode ? "text-gray-400" : "text-gray-400",
  };

  return (
    <div className="relative h-screen w-full overflow-hidden select-none"
      style={{ background: darkMode ? "#1a1a2e" : "#f8f9fa", cursor, fontFamily: "sans-serif" }}>

      {/* ── TOOLBAR ── */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 ${ui.bg} p-1 border ${ui.border} rounded-xl shadow-md z-50`}>
        <ToolButton icon={<Lock size={18} />} ui={ui} />
        <div className={`w-px h-6 ${darkMode ? "bg-[#2e2e3e]" : "bg-gray-200"} mx-1`} />
        <ToolButton icon={<Hand size={18} />} active={tool === "hand"} onClick={() => setTool("hand")} ui={ui} />
        <ToolButton icon={<MousePointer2 size={18} />} active={tool === "pointer"} onClick={() => setTool("pointer")} ui={ui} />
        <ToolButton icon={<Square size={18} />} active={tool === "rect"} onClick={() => setTool("rect")} ui={ui} />
        <ToolButton icon={<Diamond size={18} />} active={tool === "diamond"} onClick={() => setTool("diamond")} ui={ui} />
        <ToolButton icon={<Circle size={18} />} active={tool === "circle"} onClick={() => setTool("circle")} ui={ui} />
        <ToolButton icon={<ArrowRight size={18} />} active={tool === "arrow"} onClick={() => setTool("arrow")} ui={ui} />
        <ToolButton icon={<Minus size={18} />} active={tool === "line"} onClick={() => setTool("line")} ui={ui} />
        <ToolButton icon={<Pencil size={18} />} active={tool === "pencil"} onClick={() => setTool("pencil")} ui={ui} />
        <ToolButton icon={<Type size={18} />} active={tool === "text"} onClick={() => setTool("text")} ui={ui} />
        <ToolButton icon={<ImageIcon size={18} />} ui={ui} />
        <ToolButton icon={<Eraser size={18} />} active={tool === "eraser"} onClick={() => setTool("eraser")} ui={ui} />
      </div>

      {/* ── DARK MODE TOGGLE ── */}
      <button onClick={() => setDarkMode(d => !d)}
        className={`absolute top-4 right-4 w-10 h-10 ${ui.bg} border ${ui.border} rounded-full shadow-md flex items-center justify-center ${ui.hover} ${ui.text} transition-colors z-50`}
        title={darkMode ? "Light mode" : "Dark mode"}>
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className={`absolute top-16 right-4 w-64 max-h-[300px] overflow-y-auto ${ui.bg} border ${ui.border} rounded-xl shadow-lg p-3 z-40`}>

        <p className={`text-xs font-semibold ${ui.subText} mb-2 uppercase tracking-wider`}>
          Saved Codes
        </p>

        {codes.length === 0 && (
          <p className="text-xs text-gray-400">No code saved</p>
        )}

        {codes.map((c, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between px-2 py-2 rounded-md mb-1 cursor-pointer ${ui.hover}`}
            onClick={() => {
              setSelectedCodeIdx(idx);
              setTimeComplexity(c.time);
              setCodeValue(c.code);
              setShowCodeModal(true);
            }}
          >
            <span className="text-sm truncate">
              {c.time || "No complexity"}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setCodes(prev => prev.filter((_, i) => i !== idx));
              }}
              className="text-red-400 text-xs px-2"
            >
              ✕
            </button>
          </div>
        ))}

      </div>

      {/* ── LEETCODE TOGGLE ── */}
      <button onClick={() => setPanelOpen(!panelOpen)}
        className={`absolute top-4 left-4 w-10 h-10 ${ui.bg} border ${ui.border} rounded-full shadow-md flex items-center justify-center ${ui.hover} ${ui.text} transition-colors z-50`}>
        <Code size={18} />
      </button>

      {/* ── LEFT PANEL ── */}
      <div className={`absolute top-24 left-4 w-56 ${ui.bg} border ${ui.border} rounded-xl shadow-lg p-4 z-40`}>
        <p className={`text-xs font-semibold ${ui.subText} mb-2 uppercase tracking-wider`}>Stroke</p>
        <div className="flex gap-2 flex-wrap">
          {["#1e1e1e", "#ffffff", "#e03131", "#2f9e41", "#1971c2", "#f08c00", "#9c36b5", "#f06595"].map(c => (
            <div key={c} onClick={() => setColor(c)}
              className="w-6 h-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
              style={{ backgroundColor: c, borderColor: color === c ? "#6965db" : "transparent" }} />
          ))}
        </div>
        {tool === "eraser" && (
          <div className="mt-4">
            <p className={`text-xs font-semibold ${ui.subText} mb-1 uppercase tracking-wider`}>Eraser Size</p>
            <input type="range" min="5" max="80" value={eraserSize}
              onChange={e => setEraserSize(Number(e.target.value))}
              className="w-full accent-[#6965db]" />
            <p className={`text-xs ${ui.subText} mt-1`}>Size: {eraserSize}px</p>
          </div>
        )}
        {selectedImg !== -1 && tool === "pointer" && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className={`text-xs font-semibold ${ui.subText} mb-2 uppercase tracking-wider`}>Image</p>
            <button
              onClick={() => {
                saveHistory();
                shapesRef.current = shapesRef.current.filter((_, i) => i !== selectedImg);
                setSelectedImg(-1);
                repaint();
              }}
              className="w-full text-xs px-2 py-1.5 bg-red-500/10 text-red-400 border border-red-400/20 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              Delete Image
            </button>
          </div>
        )}
      </div>

      {/* ── CANVAS ── */}
      <canvas ref={canvasRef} className="absolute top-0 left-0 touch-none"
        style={{ cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      />

      {showCodeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">

          <div className={`w-[500px] max-w-[90%] ${ui.bg} border ${ui.border} rounded-xl shadow-xl p-5`}>

            <h2 className="text-lg font-semibold mb-4">Add Solution Code</h2>

            {/* Time Complexity */}
            <div className="mb-3">
              <label className="text-sm mb-1 block">Time Complexity</label>
              <input
                type="text"
                placeholder="e.g. O(n log n)"
                value={timeComplexity}
                onChange={(e) => setTimeComplexity(e.target.value)}
                className={`w-full px-3 py-2 rounded-md border ${ui.border} ${ui.bg} ${ui.text}`}
              />
            </div>

            {/* Code */}
            <div className="mb-4">
              <label className="text-sm mb-1 block">Code</label>
              <textarea
                placeholder="// Write your solution here..."
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value)}
                className={`w-full h-40 px-3 py-2 rounded-md border ${ui.border} ${ui.bg} ${ui.text} font-mono text-sm`}
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCodeModal(false)}
                className="px-3 py-1.5 text-sm rounded-md border"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  if (!timeComplexity && !codeValue) return;

                  if (selectedCodeIdx !== -1) {
                    // update existing
                    const updated = [...codes];
                    updated[selectedCodeIdx] = {
                      time: timeComplexity,
                      code: codeValue,
                    };
                    setCodes(updated);
                  } else {
                    // add new
                    setCodes(prev => [
                      ...prev,
                      { time: timeComplexity, code: codeValue }
                    ]);
                  }

                  // reset
                  setSelectedCodeIdx(-1);
                  setTimeComplexity("");
                  setCodeValue("");
                  setShowCodeModal(false);
                }}
                className="px-3 py-1.5 text-sm rounded-md bg-violet-500 text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── TEXT OVERLAY ── */}
      {textBox && textScreenPos && (
        <textarea autoFocus value={textValue}
          onChange={e => setTextValue(e.target.value)}
          onBlur={commitText}
          onKeyDown={e => { if (e.key === "Escape") { setTextBox(null); setTextValue(""); } }}
          style={{
            position: "absolute",
            left: textScreenPos.left, top: textScreenPos.top,
            width: Math.max(textScreenPos.width, 80), height: Math.max(textScreenPos.height, 40),
            border: "1.5px dashed #6965db",
            background: darkMode ? "rgba(30,30,46,0.9)" : "rgba(255,255,255,0.85)",
            resize: "none", outline: "none", padding: "4px 6px",
            fontSize: 18 * zoom, color: darkMode ? "#e0e0e0" : color,
            borderRadius: 4, zIndex: 60,
          }}
        />
      )}

      {/* ── ZOOM ── */}
      <div className={`absolute bottom-4 left-4 flex gap-1 items-center ${ui.bg} px-2 py-1 rounded-lg border ${ui.border} shadow-sm z-50 ${ui.text}`}>
        <button onClick={() => applyZoom(-0.1)} className={`p-1.5 ${ui.hover} rounded-md`}><MinusIcon size={15} /></button>
        <span className="text-sm font-medium px-2 tabular-nums">{Math.round(zoom * 100)}%</span>
        <button onClick={() => applyZoom(0.1)} className={`p-1.5 ${ui.hover} rounded-md`}><Plus size={15} /></button>
      </div>

      {/* ── IMAGE UPLOAD (hidden input) ── */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      {/* ── SESSION LOAD (hidden input) ── */}
      <input ref={loadInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadSession} />

      {/* ── UNDO / REDO + UPLOAD + SAVE/LOAD ── */}
      <div className="absolute bottom-4 right-4 flex gap-2 items-center z-50">
        <div className={`flex ${ui.bg} rounded-lg border ${ui.border} shadow-sm ${ui.text}`}>
          <button onClick={undo} className={`p-2 ${ui.hover} rounded-l-lg`}><Undo2 size={16} /></button>
          <button onClick={redo} className={`p-2 ${ui.hover} rounded-r-lg`}><Redo2 size={16} /></button>
        </div>
        <LabelButton icon={<ImagePlus size={16} />} label="Upload Image" onClick={() => fileInputRef.current.click()} ui={ui} title="Upload image" />
        <LabelButton
          icon={<Code size={16} />}
          label="Upload Code"
          onClick={() => setShowCodeModal(true)}
          ui={ui}
          title="Add code"
        />
        <LabelButton icon={<Download size={16} />} label="Save" onClick={saveSession} ui={ui} title="Save session" />
        <LabelButton icon={<Upload size={16} />} label="Load" onClick={() => loadInputRef.current.click()} ui={ui} title="Load session" />
        <button className={`p-2 ${ui.bg} border ${ui.border} rounded-full shadow-sm ${ui.hover} ${ui.text}`}>
          <HelpCircle size={20} />
        </button>
      </div>

      <LeetCodePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onQuestionChange={setCurrentQuestion}
        restoredQuestion={currentQuestion}
      />
    </div>
  );
};

export default ExcalidrawClone;