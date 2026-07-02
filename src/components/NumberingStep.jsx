// src/components/NumberingStep.jsx
// STEP3: 採番設定
import { useState } from "react";
import { applyNumbering, applyNonNumbering } from "../utils/numbering";

export default function NumberingStep({ damages, dxfSpans, rule, photoLabel, spanStartNums, nonStartNums, nonPhotos, viewOrder, memoTemplates, onMemoTemplatesChange, onRuleChange, onPhotoLabelChange, onSpanStartNumsChange, onNonStartNumsChange, onViewOrderChange, onUpdate, onUpdateNonPhotos }) {
  const [applied, setApplied] = useState(false);

  const spans = dxfSpans ? dxfSpans.map(s => s.span_no) : [];

  // 視点順変更ハンドラ
  const moveView = (idx, dir) => {
    const arr = [...viewOrder];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    onViewOrderChange(arr);
  };

  const handleDragStart = (e, idx) => {
    e.dataTransfer.setData("text/plain", String(idx));
  };

  const handleDrop = (e, toIdx) => {
    e.preventDefault();
    const fromIdx = parseInt(e.dataTransfer.getData("text/plain"));
    if (fromIdx === toIdx) return;
    const arr = [...viewOrder];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    onViewOrderChange(arr);
  };

  const handleApply = async () => {
    const targets = damages ? damages.filter(d => !d.isExtra && !d.isNote) : [];
    if (targets.length === 0) { alert("採番対象の損傷データがありません。STEP6でDXFを取り込んでください。"); return; }
    const updated = applyNumbering(targets, rule, viewOrder, spanStartNums, photoLabel);
    // isExtra・isNoteはそのまま保持して結合
    const extras = (damages || []).filter(d => d.isExtra || d.isNote);
    const result = [...updated, ...extras];
    try {
      await onUpdate(result);
      // NON写真も採番＋メモ自動入力
      if (onUpdateNonPhotos && (nonPhotos || []).length > 0) {
        const numberedNon = applyNonNumbering(nonPhotos, nonStartNums || {}, photoLabel);
        const withMemo = numberedNon.map(n => ({
          ...n,
          memo: n.memo && n.memo.trim() ? n.memo : (n.elements || []).join(","),
        }));
        await onUpdateNonPhotos(withMemo);
      }
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    } catch (e) {
      alert("保存に失敗しました: " + (e?.message || e));
    }
  };

  return (
    <div>
      {/* 採番ルール */}
      <div style={s.section}>
        <h4 style={s.sectionTitle}>採番ルールを選択</h4>
        <div style={s.ruleGrid}>
          {[
            { val: 1, label: "ルール１：部材順", desc: "全体を通じて部材順で採番。例）Mg→Cr→Ds→Ac→Bh..." },
            { val: 2, label: "ルール２：視点タイトル優先", desc: "視点タイトルごとに完結して採番。例）桁下(Cr→Dp...)→A1橋台(Ac...)→..." },
          ].map(({ val, label, desc }) => (
            <div
              key={val}
              style={{ ...s.ruleCard, ...(rule === val ? s.ruleCardActive : {}) }}
              onClick={() => onRuleChange(val)}
            >
              <div style={s.ruleTitle}>
                <div style={{ ...s.ruleRadio, ...(rule === val ? s.ruleRadioActive : {}) }} />
                {label}
              </div>
              <div style={s.ruleDesc}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 写真ラベル */}
      <div style={s.section}>
        <h4 style={s.sectionTitle}>写真ラベル</h4>
        <div style={s.ruleGrid}>
          {["写真", "写真番号", "写"].map(label => (
            <div
              key={label}
              style={{ ...s.ruleCard, ...(photoLabel === label ? s.ruleCardActive : {}) }}
              onClick={() => onPhotoLabelChange(label)}
            >
              <div style={s.ruleTitle}>
                <div style={{ ...s.ruleRadio, ...(photoLabel === label ? s.ruleRadioActive : {}) }} />
                {label}
              </div>
              <div style={s.ruleDesc}>例）{label}-1, {label}-2...</div>
            </div>
          ))}
        </div>
      </div>

      {/* 径間別開始番号 */}
      {spans.length > 0 && (
        <div style={s.section}>
          <h4 style={s.sectionTitle}>径間別開始番号（任意）</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* ヘッダー */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 60 }}></span>
              <span style={{ fontSize: 11, color: "#64748b", width: 70, textAlign: "center" }}>損傷写真</span>
              <span style={{ fontSize: 11, color: "#16a34a", width: 90, textAlign: "center" }}>NON写真</span>
            </div>
            {spans.map(sp => (
              <div key={sp} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <label style={{ fontSize: 12, color: "#64748b", minWidth: 60 }}>第{sp}径間</label>
                <input
                  style={s.numInput}
                  type="number"
                  min="1"
                  placeholder="自動"
                  value={spanStartNums[sp] || ""}
                  onChange={e => onSpanStartNumsChange(prev => ({
                    ...prev,
                    [sp]: e.target.value ? parseInt(e.target.value) : undefined,
                  }))}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>NON</span>
                  <input
                    style={{ ...s.numInput, borderColor: "#86efac" }}
                    type="number"
                    min="1"
                    placeholder="1001"
                    value={(nonStartNums || {})[sp] || ""}
                    onChange={e => onNonStartNumsChange(prev => ({
                      ...prev,
                      [sp]: e.target.value ? parseInt(e.target.value) : undefined,
                    }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 視点順変更（ルール2のみ） */}
      {rule === 2 && viewOrder && viewOrder.length > 0 && (
        <div style={s.section}>
          <h4 style={s.sectionTitle}>視点の順番（ドラッグまたは↑↓ボタンで変更）</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {viewOrder.map((title, i) => (
              <div
                key={i}
                draggable
                onDragStart={e => handleDragStart(e, i)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, i)}
                style={s.viewItem}
              >
                <span style={s.dragHandle}>⠿</span>
                <span style={s.viewNum}>{i + 1}</span>
                <span style={s.viewTitle2}>{title}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={s.arrowBtn} onClick={() => moveView(i, -1)} disabled={i === 0}>↑</button>
                  <button style={s.arrowBtn} onClick={() => moveView(i, 1)} disabled={i === viewOrder.length - 1}>↓</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* メモテンプレート設定 */}
      <div style={s.section}>
        <h4 style={s.sectionTitle}>メモ文章テンプレート</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { key: "normal",   label: "通常（a以外）" },
            { key: "repaired", label: "補修済み（a）" },
            { key: "none",     label: "損傷なし（a）" },
          ].map(({ key, label }) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <label style={{ fontSize: 12, color: "#64748b" }}>{label}</label>
              <input
                style={{ ...s.numInput, width: "100%", textAlign: "left", fontSize: 12 }}
                value={(memoTemplates || {})[key] || ""}
                onChange={e => onMemoTemplatesChange({ ...(memoTemplates || {}), [key]: e.target.value })}
              />
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#94a3b8" }}>使用可能な変数：{"{部材名}"} {"{損傷種類}"}</div>
        </div>
      </div>

      {/* 適用ボタン */}
      <div style={{ marginTop: 20 }}>
        <button style={s.applyBtn} onClick={handleApply} disabled={!damages || damages.length === 0}>
          {applied ? "採番しました ✓" : "採番を実行"}
        </button>
        {damages && damages.length > 0 && (
          <span style={{ marginLeft: 12, fontSize: 13, color: "#64748b" }}>
            対象: {damages.filter(d => !d.isExtra && !d.isNote).length}件
          </span>
        )}
      </div>
    </div>
  );
}

const s = {
  section:        { marginBottom: 24 },
  sectionTitle:   { fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 10, marginTop: 0 },
  ruleGrid:       { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 },
  ruleCard:       { border: "2px solid #e2e8f0", borderRadius: 10, padding: 14, cursor: "pointer", transition: "all .2s" },
  ruleCardActive: { border: "2px solid #1e3a5f", background: "rgba(30,58,95,.04)" },
  ruleTitle:      { fontSize: 13, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8, color: "#1e293b" },
  ruleDesc:       { fontSize: 12, color: "#64748b" },
  ruleRadio:      { width: 14, height: 14, borderRadius: "50%", border: "2px solid #e2e8f0", flexShrink: 0 },
  ruleRadioActive:{ border: "4px solid #1e3a5f" },
  numInput:       { width: 70, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, textAlign: "center" },
  applyBtn:       { padding: "10px 28px", fontSize: 14, fontWeight: 700, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" },
  viewItem:       { display: "flex", alignItems: "center", gap: 10, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: "8px 12px", cursor: "grab" },
  dragHandle:     { color: "#64748b", fontSize: 16, cursor: "grab" },
  viewNum:        { color: "#4f8ef7", fontWeight: 700, fontSize: 13, minWidth: 20 },
  viewTitle2:     { flex: 1, color: "#e2e8f0", fontSize: 13 },
  arrowBtn:       { padding: "2px 8px", fontSize: 12, background: "#334155", border: "1px solid #475569", borderRadius: 4, color: "#e2e8f0", cursor: "pointer" },
};
