import { useState, useRef } from "react";

export default function SituationPhotos({ situationPhotos, sourcePhotos, photos, numberingLabel, onUpdate, onImportExcel, onSave }) {
  const [activeSpan, setActiveSpan] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const fileRef = useRef(null);

  const label = numberingLabel || "写真";

  const spans = [...new Set((situationPhotos || []).map(sp => sp.spanNo))].sort((a, b) => a - b);
  const currentSpan = activeSpan !== null && spans.includes(activeSpan) ? activeSpan : (spans[0] ?? null);
  const filtered = (situationPhotos || []).filter(sp => sp.spanNo === currentSpan);

  function renumber(arr) {
    return arr.map((sp, i) => ({ ...sp, photoNum: i + 1 }));
  }

  // ① STEP1取込済み（控え）を採用して表示
  function handleAdoptSource() {
    const src = sourcePhotos || [];
    if (src.length === 0) {
      alert("STEP1で前回調書を取り込んでください。取込済みの現地状況写真がありません。");
      return;
    }
    onUpdate(renumber(src.map(sp => ({ ...sp }))));
  }

  // ② Excel取込（ファイル選択 → 親へ委譲）
  function handleImportExcel() {
    if (fileRef.current) fileRef.current.click();
  }

  function handleExcelSelected(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (onImportExcel) onImportExcel(file);
  }

  // リセット：採用済みデータを破棄し①②の入口画面に戻す
  function handleReset() {
    if (!window.confirm("現在の現地状況写真をリセットして、取り込み選択に戻りますか？")) return;
    onUpdate([]);
  }

  function handleAdd() {
    const next = (situationPhotos || []).length + 1;
    const newItem = { photoNum: next, spanNo: currentSpan ?? 1, memo: "", assignedKey: "" };
    onUpdate(renumber([...(situationPhotos || []), newItem]));
  }

  function handleDelete(globalIdx) {
    const arr = (situationPhotos || []).filter((_, i) => i !== globalIdx);
    onUpdate(renumber(arr));
  }

  function handleMemo(globalIdx, val) {
    const arr = (situationPhotos || []).map((sp, i) => i === globalIdx ? { ...sp, memo: val } : sp);
    onUpdate(arr);
  }

  function handleAssign(globalIdx, photoName) {
    const entry = Object.entries(photos || {}).find(([, v]) => v.name === photoName);
    const assignedKey = entry ? entry[0] : "";
    const arr = (situationPhotos || []).map((sp, i) => i === globalIdx ? { ...sp, assignedKey } : sp);
    onUpdate(arr);
  }

  // 様式-1 全景写真の選択（単一選択：1枚チェックで他は自動解除）
  function handleZenkei(globalIdx, checked) {
    const arr = (situationPhotos || []).map((sp, i) => {
      if (i === globalIdx) return { ...sp, zenkei: checked };
      return checked ? { ...sp, zenkei: false } : sp;
    });
    onUpdate(arr);
  }

  function handleDrop(toFilteredIdx) {
    if (dragFrom === null || dragFrom === toFilteredIdx) return;
    const globalIndices = filtered.map(sp => (situationPhotos || []).indexOf(sp));
    const fromGlobal = globalIndices[dragFrom];
    const toGlobal = globalIndices[toFilteredIdx];
    const arr = [...(situationPhotos || [])];
    const [item] = arr.splice(fromGlobal, 1);
    const insertAt = fromGlobal < toGlobal ? toGlobal - 1 : toGlobal;
    arr.splice(insertAt, 0, item);
    onUpdate(renumber(arr));
    setDragFrom(null);
  }

  const photoKeys = Object.keys(photos || {});

  // 未採用時：①②の入口画面
  if (!situationPhotos || situationPhotos.length === 0) {
    return (
      <div style={st.entryWrap}>
        <p style={st.entryHint}>現地状況写真の取り込み方法を選択してください。</p>
        <div style={st.entryBtnRow}>
          <button style={st.entryBtn1} onClick={handleAdoptSource}>
            ① 前回調書から取り込む
            <span style={st.entrySub}>STEP1で取り込んだ情報を採用</span>
          </button>
          <button style={st.entryBtn2} onClick={handleImportExcel}>
            ② Excelから取り込む
            <span style={st.entrySub}>現地状況写真リスト(.xlsx)</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.xlsm"
          style={{ display: "none" }}
          onChange={handleExcelSelected}
        />
        <div style={st.entryFooter}>
          <button style={st.addBtn} onClick={handleAdd}>+ 手動で写真を追加</button>
          {onSave && <button style={st.saveBtn} onClick={onSave}>保存</button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={st.toolRow}>
        <button style={st.addBtn} onClick={handleAdd}>+ 写真を追加</button>
        <span style={st.hint}>ドラッグで並び替え → 写真番号を自動更新</span>
        <div style={st.toolRight}>
          <button style={st.resetBtn} onClick={handleReset}>リセット</button>
          {onSave && <button style={st.saveBtn} onClick={onSave}>保存</button>}
        </div>
      </div>

      {spans.length > 1 && (
        <div style={st.tabBar}>
          {spans.map(s => (
            <button
              key={s}
              style={{ ...st.tab, ...(s === currentSpan ? st.tabActive : {}) }}
              onClick={() => setActiveSpan(s)}
            >
              径間{s}
            </button>
          ))}
        </div>
      )}

      <div style={st.grid}>
        {filtered.map((sp, fi) => {
          const globalIdx = (situationPhotos || []).indexOf(sp);
          const previewUrl = sp.assignedKey && photos[sp.assignedKey] ? photos[sp.assignedKey].url : null;
          const assignedName = sp.assignedKey && photos[sp.assignedKey] ? photos[sp.assignedKey].name : "";

          return (
            <div
              key={globalIdx}
              style={{ ...st.card, ...(sp.zenkei ? st.cardZenkei : {}), ...(dragFrom === fi ? { opacity: 0.4 } : {}) }}
              draggable
              onDragStart={() => setDragFrom(fi)}
              onDragEnd={() => setDragFrom(null)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(fi)}
            >
              <div style={st.cardHeader}>
                <span style={st.dragHint}>↕ ドラッグで並び替え</span>
                <button style={st.deleteBtn} onClick={() => handleDelete(globalIdx)} title="削除">×</button>
              </div>

              {previewUrl
                ? <img src={previewUrl} alt="" style={st.preview} />
                : <div style={st.previewEmpty} />
              }

              <div style={st.badge}>{label}-{sp.photoNum}</div>
              <div style={st.spanLabel}>径間 {sp.spanNo}</div>

              <label style={st.zenkeiRow}>
                <input
                  type="checkbox"
                  checked={!!sp.zenkei}
                  onChange={e => handleZenkei(globalIdx, e.target.checked)}
                />
                <span>様式-1の全景に使う</span>
              </label>

              <div style={st.fieldWrap}>
                <div style={st.fieldLabel}>メモ</div>
                <textarea
                  style={st.textarea}
                  rows={2}
                  defaultValue={sp.memo || ""}
                  onBlur={e => handleMemo(globalIdx, e.target.value)}
                />
              </div>

              <div style={st.fieldWrap}>
                <div style={st.fieldLabel}>写真ファイル</div>
                <input
                  list="sitPhotoDatalist"
                  style={st.input}
                  placeholder="4桁入力で絞り込み..."
                  defaultValue={assignedName}
                  onBlur={e => handleAssign(globalIdx, e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <datalist id="sitPhotoDatalist">
        {photoKeys.map(k => (
          <option key={k} value={photos[k].name} />
        ))}
      </datalist>
    </div>
  );
}

const st = {
  toolRow: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12 },
  addBtn: { background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer" },
  saveBtn: { background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer" },
  resetBtn: { background: "#fff", color: "#b45309", border: "1px solid #f59e0b", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer" },
  toolRight: { display: "flex", gap: 10, marginLeft: "auto" },
  hint: { fontSize: 11, color: "#94a3b8" },
  empty: { color: "#94a3b8", fontSize: 13 },
  tabBar: { display: "flex", gap: 6, marginBottom: 14 },
  tab: { background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer" },
  tabActive: { background: "#1e3a5f", color: "#fff" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
  card: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, cursor: "grab" },
  cardZenkei: { border: "2px solid #0d9488", background: "#f0fdfa" },
  zenkeiRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0d9488", fontWeight: 700, marginBottom: 6, cursor: "pointer" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  dragHint: { fontSize: 10, color: "#94a3b8" },
  deleteBtn: { background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16, padding: "0 4px", lineHeight: 1 },
  preview: { width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 6, marginBottom: 6, display: "block" },
  previewEmpty: { width: "100%", aspectRatio: "4/3", background: "#e2e8f0", borderRadius: 6, marginBottom: 6 },
  badge: { fontSize: 12, fontWeight: 700, color: "#1e3a5f", marginBottom: 2 },
  spanLabel: { fontSize: 11, color: "#94a3b8", marginBottom: 6 },
  fieldWrap: { marginBottom: 6 },
  fieldLabel: { fontSize: 11, color: "#64748b", marginBottom: 2 },
  textarea: { width: "100%", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 7px", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" },
  input: { width: "100%", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 7px", boxSizing: "border-box", fontFamily: "inherit" },
  entryWrap: { padding: "8px 0" },
  entryHint: { fontSize: 13, color: "#475569", marginBottom: 14 },
  entryBtnRow: { display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 },
  entryBtn1: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 10, padding: "16px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", minWidth: 220 },
  entryBtn2: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, background: "#fff", color: "#1e3a5f", border: "2px solid #1e3a5f", borderRadius: 10, padding: "16px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", minWidth: 220 },
  entrySub: { fontSize: 11, fontWeight: 400, opacity: 0.85 },
  entryFooter: { display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: 14 },
};
