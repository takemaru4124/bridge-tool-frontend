import { useState, useRef, useEffect } from "react";

const LAYER_STYLE = {
  "D-TTL-LINE":  { stroke: "#334155", strokeWidth: 1.5 },
  "構造物":       { stroke: "#334155", strokeWidth: 1   },
  "D-STR":       { stroke: "#64748b", strokeWidth: 0.8 },
  "D-STR-STR1":  { stroke: "#64748b", strokeWidth: 0.8 },
  "損傷スケッチ":  { stroke: "#dc2626", strokeWidth: 1   },
  "M-STR-HTXT":  { stroke: "#1d4ed8", strokeWidth: 0.8 },
  "写真番号":     { stroke: "#059669", strokeWidth: 0.8 },
  "視点タイトル": { stroke: "#334155", strokeWidth: 1   },
};

const TEXT_COLOR = {
  "M-STR-HTXT":  "#1d4ed8",
  "写真番号":     "#059669",
  "視点タイトル": "#1e3a5f",
};

function DxfSvg({ box }) {
  const containerRef = useRef(null);
  const state = useRef({ dragging: false, lastX: 0, lastY: 0, panX: 0, panY: 0, scale: 1, lastDist: null });
  const [, forceUpdate] = useState(0);

  const W = box.xmax - box.xmin;
  const H = box.ymax - box.ymin;
  const PAD = 20;
  const svgW = W + PAD * 2;
  const svgH = H + PAD * 2;

  const toSvgX = (x) => x - box.xmin + PAD;
  const toSvgY = (y) => box.ymax - y + PAD;

  // ホイールズーム（non-passive）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      state.current.scale = Math.min(Math.max(state.current.scale * factor, 0.1), 20);
      forceUpdate(n => n + 1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // タッチイベント（non-passive）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        state.current.dragging = true;
        state.current.lastX = e.touches[0].clientX;
        state.current.lastY = e.touches[0].clientY;
        state.current.lastDist = null;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        state.current.lastDist = Math.sqrt(dx * dx + dy * dy);
        state.current.dragging = false;
      }
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && state.current.dragging) {
        state.current.panX += e.touches[0].clientX - state.current.lastX;
        state.current.panY += e.touches[0].clientY - state.current.lastY;
        state.current.lastX = e.touches[0].clientX;
        state.current.lastY = e.touches[0].clientY;
        forceUpdate(n => n + 1);
      } else if (e.touches.length === 2 && state.current.lastDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        state.current.scale = Math.min(Math.max(state.current.scale * (dist / state.current.lastDist), 0.1), 20);
        state.current.lastDist = dist;
        forceUpdate(n => n + 1);
      }
    };
    const onTouchEnd = () => { state.current.dragging = false; state.current.lastDist = null; };
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // マウスドラッグ（windowに登録）
  useEffect(() => {
    const onMove = (e) => {
      if (!state.current.dragging) return;
      state.current.panX += e.clientX - state.current.lastX;
      state.current.panY += e.clientY - state.current.lastY;
      state.current.lastX = e.clientX;
      state.current.lastY = e.clientY;
      forceUpdate(n => n + 1);
    };
    const onUp = () => { state.current.dragging = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const onMouseDown = (e) => {
    state.current.dragging = true;
    state.current.lastX = e.clientX;
    state.current.lastY = e.clientY;
  };

  const { panX, panY, scale } = state.current;

  const renderEntity = (ent, i) => {
    const ls = LAYER_STYLE[ent.layer] || { stroke: "#94a3b8", strokeWidth: 0.8 };
    const tc = TEXT_COLOR[ent.layer] || "#334155";
    if (ent.type === "line") {
      return <line key={i} x1={toSvgX(ent.x1)} y1={toSvgY(ent.y1)} x2={toSvgX(ent.x2)} y2={toSvgY(ent.y2)} stroke={ls.stroke} strokeWidth={ls.strokeWidth} />;
    }
    if (ent.type === "polyline") {
      const pts = ent.points.map(p => `${toSvgX(p[0])},${toSvgY(p[1])}`).join(" ");
      return ent.closed
        ? <polygon key={i} points={pts} stroke={ls.stroke} strokeWidth={ls.strokeWidth} fill="none" />
        : <polyline key={i} points={pts} stroke={ls.stroke} strokeWidth={ls.strokeWidth} fill="none" />;
    }
    if (ent.type === "circle") {
      return <circle key={i} cx={toSvgX(ent.cx)} cy={toSvgY(ent.cy)} r={ent.r} stroke={ls.stroke} strokeWidth={ls.strokeWidth} fill="none" />;
    }
    if (ent.type === "leader") {
      const pts = ent.points.map(p => `${toSvgX(p[0])},${toSvgY(p[1])}`).join(" ");
      return <polyline key={i} points={pts} stroke={ls.stroke} strokeWidth={ls.strokeWidth} fill="none" />;
    }
    if (ent.type === "text") {
      const fs = Math.max(ent.height * 0.9, 4);
      return (
        <text key={i} x={toSvgX(ent.x)} y={toSvgY(ent.y)} fontSize={fs} fill={tc} fontFamily="sans-serif">
          {ent.text.split(/\\P|\n/).map((l, j) => (
            <tspan key={j} x={toSvgX(ent.x)} dy={j === 0 ? 0 : fs * 1.2}>{l}</tspan>
          ))}
        </text>
      );
    }
    return null;
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", background: "#fff", cursor: state.current.dragging ? "grabbing" : "grab", userSelect: "none" }}
    >
      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: "block" }}>
        <g transform={`translate(${panX},${panY}) scale(${scale})`}>
          {box.entities.map((ent, i) => renderEntity(ent, i))}
        </g>
      </svg>
    </div>
  );
}

export default function DxfEdit({ dxfData }) {
  const renderData = dxfData?.render_data;
  const [activeSpan, setActiveSpan] = useState(1);
  const [activeView, setActiveView] = useState(null);

  if (!renderData || renderData.length === 0) {
    return <div style={{ color: "#94a3b8", fontSize: 14, padding: 16 }}>STEP1でDXFを取り込んでください。</div>;
  }

  const spans = [...new Set(renderData.map(r => r.span_no))].sort();
  const boxes = renderData.filter(r => r.span_no === activeSpan);

  // 径間切替時に視点を先頭にリセット
  const handleSpanChange = (s) => {
    setActiveSpan(s);
    setActiveView(null);
  };

  const views = boxes.map(b => b.title);
  const currentView = activeView ?? views[0];
  const currentBox = boxes.find(b => b.title === currentView);

  return (
    <div>
      {/* 径間タブ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {spans.map(s => (
          <button key={s} onClick={() => handleSpanChange(s)} style={{
            padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: activeSpan === s ? "#1e3a5f" : "#e2e8f0",
            color: activeSpan === s ? "#fff" : "#334155",
          }}>
            第{s}径間
          </button>
        ))}
      </div>

      {/* 視点タイトルタブ */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap", borderBottom: "2px solid #e2e8f0", paddingBottom: 0 }}>
        {views.map(v => (
          <button key={v} onClick={() => setActiveView(v)} style={{
            padding: "6px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: "none", borderBottom: currentView === v ? "2px solid #1e3a5f" : "2px solid transparent",
            color: currentView === v ? "#1e3a5f" : "#94a3b8",
            marginBottom: -2,
          }}>
            {v}
          </button>
        ))}
      </div>

      {/* SVG表示 */}
      {currentBox && <DxfSvg box={currentBox} />}
    </div>
  );
}
