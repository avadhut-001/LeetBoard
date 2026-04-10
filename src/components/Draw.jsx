import React, { useRef, useState, useEffect, useCallback } from "react";
import { Code, Moon, Sun, ImagePlus, Download } from "lucide-react";
import {
  Hand, MousePointer2, Square, Diamond, Circle,
  ArrowRight, Minus, Pencil, Type, Image as ImageIcon,
  Eraser, Plus, Minus as MinusIcon,
  Undo2, Redo2, HelpCircle, Lock,
} from "lucide-react";

import { loadImage } from "./Imagecache";
import { screenToCanvas, hitHandle, hitImage, applyResize } from "./Canvashelpers";
import { redrawAll } from "./Redrawall";
import { drawShape } from "./Drawshape";

import ToolButton, { LabelButton } from "./ToolButton";
import LeetCodePanel from "./LeetCodePanel";
import CodeModal from "./CodeModal";
import CodesPanel from "./CodesPanel";

const BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "";
const ExcalidrawClone = () => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const fileInputRef = useRef(null);
  const loadInputRef = useRef(null);

  // ── save session ──────────────────────────────────────────────────────────
  const saveToBackend = async () => {
    const session = {
      shapes: shapesRef.current,
      codes,
      question: currentQuestion,
      offset,
      zoom,
      darkMode,
    };

    const BASE_URL =
      window.location.hostname === "localhost"
        ? "http://localhost:5000"
        : "";

    const res = await fetch(`${BASE_URL}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Save failed:", err);
      alert("❌ Save failed");
      return;
    }

    const data = await res.json();

    console.log("Saved ID:", data.id);


    const url = `${window.location.origin}/session/${data.id}`;
    navigator.clipboard.writeText(url);
    alert("Session saved! Link copied ✅");
  };

  const loadByQuestionId = async (qid) => {
    const res = await fetch(`${BASE_URL}/api/session/question/${qid}`);
    const session = await res.json();


    setCodes(session.codes);
    setCurrentQuestion(session.question);
    setOffset(session.offset || { x: 0, y: 0 });
    setZoom(session.zoom || 1);
    setDarkMode(session.darkMode || false);

    const imagesToLoad = session.shapes.filter(s => s.type === "image");

    let loaded = 0;

    const afterLoad = () => {
      shapesRef.current = session.shapes;
      repaint();
    };

    if (imagesToLoad.length === 0) {
      afterLoad();
      return;
    }

    imagesToLoad.forEach((s) => {
      loadImage(s.src, () => {
        loaded++;
        if (loaded === imagesToLoad.length) {
          afterLoad();
        }
      });
    });
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
        if (session.codes) setCodes(session.codes);

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

          if (session.question) setCurrentQuestion(session.question);

          setSelectedImg(-1);
          repaint();
        };

        if (imagesToLoad.length === 0) { afterLoad(); return; }

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

  const handleDoubleClick = (e) => {
    const pos = getCanvasPos(e);

    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      const s = shapesRef.current[i];

      if (s.type === "text") {
        const width = s.width || 100;
        const height = s.height || 20;

        if (
          pos.x >= s.x &&
          pos.x <= s.x + width &&
          pos.y >= s.y &&
          pos.y <= s.y + height
        ) {
          // 🔥 Open textarea for editing
          setTextBox({
            x: s.x,
            y: s.y,
            w: width,
            h: height,
          });

          setTextValue(s.text);

          // 🔥 REMOVE old text (important)
          shapesRef.current.splice(i, 1);

          repaint();
          return;
        }
      }
    }
  };

  const handleLoadByQid = async () => {
    if (!loadQid) return;
    try {
      const res = await fetch(`${BASE_URL}/api/session/question/${loadQid}`);
      if (!res.ok) { setLoadError("No data found for this question."); return; }
      window.location.href = `/session/${loadQid}`;
    } catch (err) {
      setLoadError("Something went wrong.");
    }
  };

  const [tool, setTool] = useState("pointer");
  const [color, setColor] = useState("#ffffff");
  const [eraserSize, setEraserSize] = useState(20);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panelOpen, setPanelOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [textBox, setTextBox] = useState(null);
  const [textValue, setTextValue] = useState("");

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
  const darkModeRef = useRef(true);

  const imgActionRef = useRef(null);

  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [timeComplexity, setTimeComplexity] = useState("");
  const [codeValue, setCodeValue] = useState("");
  const [codes, setCodes] = useState([]);
  const [selectedCodeIdx, setSelectedCodeIdx] = useState(-1);

  const [showLoadInput, setShowLoadInput] = useState(false);
  const [loadQid, setLoadQid] = useState("");
  const [loadError, setLoadError] = useState("");


  const [fontSize, setFontSize] = useState(18);
  // ── sync refs ──────────────────────────────────────────────────────────────
  useEffect(() => { offsetRef.current = offset; }, [offset]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => {
    darkModeRef.current = darkMode;

    // 🔥 auto switch pencil color
    setColor(darkMode ? "#ffffff" : "#1e1e1e");

    repaint();
  }, [darkMode]);
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

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith("/session/")) {
      const qid = path.split("/")[2];
      if (qid) loadByQuestionId(qid);
    }
  }, []);

  // ── repaint ────────────────────────────────────────────────────────────────
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;
    const filteredShapes = shapesRef.current.filter(s => {
      if (!currentQuestion) return true;
      return !s.questionId || s.questionId === currentQuestion?.id || s.questionId === currentQuestion;
    });

    redrawAll(canvas, ctxRef.current, filteredShapes,
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
          {
            type: "image",
            x: cx - w / 2,
            y: cy - h / 2,
            w,
            h,
            src: ev.target.result,
            questionId: currentQuestion?.id || currentQuestion // 🔥 ADD THIS
          },
        ];
        setSelectedImg(newIdx);
        repaint();
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── pointer down ──────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    const pos = getCanvasPos(e);

    if (tool === "hand") {
      panStartRef.current = { mx: e.clientX, my: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y };
      return;
    }

    if (tool === "pointer") {
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
      for (let i = shapesRef.current.length - 1; i >= 0; i--) {
        const s = shapesRef.current[i];

        // 🖼 IMAGE
        if (s.type === "image" && hitImage(s, pos)) {
          setSelectedImg(i);

          imgActionRef.current = {
            mode: "drag",
            shapeIdx: i,
            startPos: pos,
            origShape: { ...s },
          };
          return;
        }

        // 📝 TEXT
        if (s.type === "text") {
          const width = s.width || 100;
          const height = s.height || 20;

          if (
            pos.x >= s.x &&
            pos.x <= s.x + width &&
            pos.y >= s.y &&
            pos.y <= s.y + height
          ) {
            setSelectedImg(i); // reuse same selection

            imgActionRef.current = {
              mode: "drag",
              shapeIdx: i,
              startPos: pos,
              origShape: { ...s },
            };
            return;
          }
        }
      }
      setSelectedImg(-1);
      return;
    }

    setSelectedImg(-1);

    if (tool === "text") {
      currentShapeRef.current = { type: "textbox", x: pos.x, y: pos.y, w: 0, h: 0 };
      isDrawingRef.current = true;
      return;
    }

    if (tool === "pencil" || tool === "eraser") {
      currentShapeRef.current = { type: tool, color, lineWidth: 3, eraserSize, points: [pos] };
      isDrawingRef.current = true;
      return;
    }

    currentShapeRef.current = { type: tool, x: pos.x, y: pos.y, w: 0, h: 0, color, lineWidth: 3 };
    isDrawingRef.current = true;
  };

  // ── pointer move ──────────────────────────────────────────────────────────
  const onMouseMove = (e) => {
    if (tool === "hand" && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.mx;
      const dy = e.clientY - panStartRef.current.my;
      const newOffset = { x: panStartRef.current.ox + dx, y: panStartRef.current.oy + dy };
      offsetRef.current = newOffset;
      setOffset(newOffset);
      return;
    }

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
    // 🔥 ERASER FOR TEXT + IMAGE (ADD HERE)
    if (tool === "eraser") {
      const pos = getCanvasPos(e);

      saveHistory();

      shapesRef.current = shapesRef.current.filter((s) => {
        // 📝 TEXT
        if (s.type === "text") {
          return !(
            pos.x >= s.x &&
            pos.x <= s.x + (s.width || 100) &&
            pos.y >= s.y &&
            pos.y <= s.y + (s.height || 20)
          );
        }

        // 🖼 IMAGE
        if (s.type === "image") {
          return !(
            pos.x >= s.x &&
            pos.x <= s.x + s.w &&
            pos.y >= s.y &&
            pos.y <= s.y + s.h
          );
        }

        return true;
      });

      repaint();
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
        {
          type: "text",
          x: textBox.x,
          y: textBox.y,
          text: textValue,
          color,
          fontSize: fontSize,
        },
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
    if (tool === "pointer") return "default";
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

      {/* ── CODES PANEL ── */}
      <CodesPanel
        ui={ui}
        codes={codes}
        setCodes={setCodes}
        setSelectedCodeIdx={setSelectedCodeIdx}
        setTimeComplexity={setTimeComplexity}
        setCodeValue={setCodeValue}
        setShowCodeModal={setShowCodeModal}
      />

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
        {tool === "text" && (
          <div className="mt-4">
            <p className={`text-xs font-semibold ${ui.subText} mb-1 uppercase`}>
              Text Size
            </p>

            <input
              type="range"
              min="10"
              max="60"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full"
            />

            <p className={`text-xs ${ui.subText}`}>
              Size: {fontSize}px
            </p>
          </div>
        )}
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
        onDoubleClick={handleDoubleClick}
      />

      {/* ── CODE MODAL ── */}
      {showCodeModal && (
        <CodeModal
          ui={ui}
          timeComplexity={timeComplexity}
          setTimeComplexity={setTimeComplexity}
          codeValue={codeValue}
          setCodeValue={setCodeValue}
          selectedCodeIdx={selectedCodeIdx}
          setSelectedCodeIdx={setSelectedCodeIdx}
          codes={codes}
          setCodes={setCodes}
          setShowCodeModal={setShowCodeModal}
        />
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
            fontSize: fontSize * zoom, color: darkMode ? "#e0e0e0" : color,
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

      {/* ── HIDDEN INPUTS ── */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      <input ref={loadInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadSession} />

      {/* ── BOTTOM RIGHT ACTIONS ── */}
      <div className="absolute bottom-4 right-4 flex gap-2 items-center z-50">
        <div className={`flex ${ui.bg} rounded-lg border ${ui.border} shadow-sm ${ui.text}`}>
          <button onClick={undo} className={`p-2 ${ui.hover} rounded-l-lg`}><Undo2 size={16} /></button>
          <button onClick={redo} className={`p-2 ${ui.hover} rounded-r-lg`}><Redo2 size={16} /></button>
        </div>
        <LabelButton icon={<ImagePlus size={16} />} label="Upload Image" onClick={() => fileInputRef.current.click()} ui={ui} title="Upload image" />
        <LabelButton icon={<Code size={16} />} label="Upload Code" onClick={() => setShowCodeModal(true)} ui={ui} title="Add code" />
        <LabelButton icon={<Download size={16} />} label="Save" onClick={saveToBackend} ui={ui} title="Save session" />
        <LabelButton label="Load" onClick={() => setShowLoadInput(true)} ui={ui} />

        {showLoadInput && (
          <div className={`absolute bottom-16 right-4 ${ui.bg} border ${ui.border} rounded-lg p-3 shadow-md z-50`}>
            <input
              type="number"
              placeholder="Enter question number"
              value={loadQid}
              onChange={(e) => setLoadQid(e.target.value)}
              className={`px-2 py-1 border rounded-md text-sm ${ui.bg} ${ui.text}`}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={handleLoadByQid} className="px-2 py-1 bg-violet-500 text-white text-sm rounded">Load</button>
              <button onClick={() => { setShowLoadInput(false); setLoadError(""); }} className="px-2 py-1 text-sm border rounded">Cancel</button>
            </div>
            {loadError && <p className="text-red-500 text-xs mt-2">{loadError}</p>}
          </div>
        )}

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