// src/components/MemberList.jsx
// HTMLのSTEP2（部材・要素番号の確認・編集）を完全移植
import { useState, useEffect, useRef, useCallback } from "react";

// ===== 部材マスタ（ALL_MEMBERS） =====
const ALL_MEMBERS = [
  ["Mg","主桁","S"],["Cr","横桁","S"],["St","縦桁","S"],["Ds","床版","S"],
  ["Cf","対傾構","S"],["Lu","上横構","S"],["Ll","下横構","S"],
  ["Bt","上・下弦材","S"],["Dt","斜材・垂直材","S"],["Pt","橋門構","S"],
  ["Ar","アーチリブ","S"],["Sa","補剛桁","S"],["Ha","吊り材","S"],
  ["Ca","支柱","S"],["Pa","橋門構","S"],["Rg","主構（桁）","S"],["Rp","主構（脚）","S"],
  ["Sc","斜材","S"],["Ts","塔柱","S"],["Th","塔部水平材","S"],["Td","塔部斜材","S"],
  ["Co","外ケーブル","S"],["Gb","ゲルバー部","S"],["Cn","PC定着部","S"],
  ["Pp","格点","S"],["Em","コンクリート埋込部","S"],["Sx","その他","S"],
  ["Pw","柱部・壁部","P"],["Pb","梁部","P"],["Pc","隅角部・接合部","P"],["Px","その他","P"],
  ["Ap","胸壁","A"],["Ac","竪壁","A"],["Aw","翼壁","A"],["Ax","その他","A"],
  ["Ff","フーチング","F"],["Fx","その他","F"],
  ["Bh","支承本体","B"],["Ba","アンカーボルト","B"],["Bm","沓座モルタル","B"],
  ["Bc","台座コンクリート","B"],["Bx","その他","B"],
  ["Sf","落橋防止システム","E"],["Ss","落橋防止構造","E"],["Sd","横変位拘束構造","E"],["Se","その他","E"],
  ["Ra","高欄","R"],["Gf","防護柵","R"],["Fg","地覆","R"],["Me","中央分離帯","R"],
  ["Ej","伸縮装置","R"],["Si","遮音施設","R"],["Cu","縁石","R"],["Pm","舗装","R"],
  ["Dr","排水ます","D"],["Dp","排水管","D"],["Dx","その他","D"],
  ["Ip","点検施設","I"],["Ut","添架物","U"],["Ww","袖擁壁","W"],
  ["Ct","頂版","C"],["Sw","側壁","C"],["Cb","底版","C"],["Iw","隔壁","C"],
  ["Jo","断面方向連結部","C"],["Lj","縦断方向連結部","C"],
  ["Eg","目地部","C"],["Cx","その他","C"],
];
const MEMBER_ORDER = ALL_MEMBERS.map(m => m[0]);
const MEMBER_MAP = Object.fromEntries(ALL_MEMBERS.map(([code, name, koshu]) => [code, { name, koshu }]));
const MATERIAL_OPTS = ["", "S", "C", "A", "X", "V", "R"];

// ===== 要素番号範囲展開 =====
function expandElemRange(input) {
  const str = input.trim();
  if (!str) return [];
  const segments = str.replace(/\n/g, ",").split(",").map(s => s.trim()).filter(Boolean);
  const result = [];
  segments.forEach(seg => {
    const rangeMatch = seg.match(/^(\d{1,4})[～~\-](\d{1,4})$/);
    if (rangeMatch) {
      const from = parseInt(rangeMatch[1]), to = parseInt(rangeMatch[2]);
      const step = from <= to ? 1 : -1;
      for (let n = from; step > 0 ? n <= to : n >= to; n += step) {
        const s = String(n).padStart(4, "0");
        if (!result.includes(s)) result.push(s);
      }
    } else {
      const v = seg.trim();
      if (v) {
        const s = !isNaN(v) ? String(parseInt(v)).padStart(4, "0") : v;
        if (!result.includes(s)) result.push(s);
      }
    }
  });
  return result;
}

// ===== DXF/Excelデータ → memberDataBySpan に変換 =====
function buildMemberDataBySpan(membersBySpan, dxfSpans) {
  // 全径間番号（和集合）
  const allSpanNos = new Set();
  if (dxfSpans) dxfSpans.forEach(s => allSpanNos.add(s.span_no));
  if (membersBySpan) membersBySpan.forEach(s => allSpanNos.add(s.span_no));

  const bySpan = {};

  for (const spanNo of [...allSpanNos].sort((a, b) => a - b)) {
    const spanData = {};

    // ExcelのデータをベースにMEMBER_MAPで工種・名称を補完
    const excelSpan = membersBySpan ? membersBySpan.find(s => s.span_no === spanNo) : null;
    const excelMembers = [...(excelSpan?.major || []), ...(excelSpan?.other || [])];
    excelMembers.forEach(m => {
      const code = m.symbol;
      if (!code) return;
      const info = MEMBER_MAP[code];
      if (!spanData[code]) {
        spanData[code] = {
          name: info ? info.name : (m.name || code),
          koshu: info ? info.koshu : (m.koshu || ""),
          material: m.zairyo || "",
          elements: [],
          isManualAdded: m.isManualAdded || false,
          manualElements: new Set(m.manualElementsList || []),
          deletedElements: new Set(m.deletedElementsList || []),
          isDeleted: m.isDeleted || false,
        };
      }
      // 要素番号追加
      const ens = m.element_no ? m.element_no.split(",").map(s => s.trim()).filter(Boolean) : [];
      ens.forEach(en => {
        if (!spanData[code].elements.includes(en)) spanData[code].elements.push(en);
      });
    });

    // DXFのデータを追加・補完
    const dxfSpan = dxfSpans ? dxfSpans.find(s => s.span_no === spanNo) : null;
    const dxfMembers = dxfSpan?.members || [];
    dxfMembers.forEach(m => {
      const code = m.symbol;
      if (!code) return;
      const info = MEMBER_MAP[code];
      if (!spanData[code]) {
        spanData[code] = {
          name: info ? info.name : (m.name || code),
          koshu: info ? info.koshu : "",
          material: "",
          elements: [],
          isManualAdded: false,
          manualElements: new Set(),
          isDeleted: false,
        };
      }
      const en = m.element_no;
      if (en && !spanData[code].elements.includes(en)) {
        spanData[code].elements.push(en);
        if (m.is_arrow_current) spanData[code].manualElements.add(en);
      }
    });

    // 要素番号をソート
    Object.values(spanData).forEach(d => {
      d.elements.sort((a, b) => parseInt(a) - parseInt(b));
    });

    // MEMBER_ORDER順に並び替え
    const ordered = {};
    MEMBER_ORDER.forEach(code => { if (spanData[code]) ordered[code] = spanData[code]; });
    Object.keys(spanData).forEach(code => { if (!ordered[code]) ordered[code] = spanData[code]; });

    bySpan[spanNo] = ordered;
  }

  return bySpan;
}

// memberDataBySpan → onUpdateで保存する形式に変換
function toMembersBySpan(memberDataBySpan, dxfSpans) {
  return Object.keys(memberDataBySpan).map(spanNo => {
    const sp = parseInt(spanNo);
    const dxfSpan = dxfSpans ? dxfSpans.find(s => s.span_no === sp) : null;
    const major = Object.entries(memberDataBySpan[sp]).map(([code, data]) => ({
      koshu: data.koshu || "",
      zairyo: data.material || "",
      name: data.name || code,
      symbol: code,
      element_no: data.elements.join(", "),
      isDeleted: data.isDeleted || false,
      manualElementsList: data.manualElements ? [...data.manualElements] : [],
      deletedElementsList: data.deletedElements ? [...data.deletedElements] : [],
      isManualAdded: data.isManualAdded || false,
    }));
    return {
      span_no: sp,
      views: dxfSpan?.views || [],
      major,
      other: [],
    };
  });
}

// ===== 部材行コンポーネント =====
function MemberRow({ code, data, onUpdate, onDelete, onRestore }) {
  const [inputVal, setInputVal] = useState("");

  // ── 長押し+ドラッグで連続追加 ──────────────────────────
  const [dragExtState, setDragExtState] = useState(null);
  const longPressTimerRef = useRef(null);
  const dragExtActiveRef = useRef(false);
  const dragExtInfoRef = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const PX_PER_STEP = 40;
  const LONG_PRESS_MS = 500;

  function parseElemNo(elem) {
    if (!elem || !/^\d{4}$/.test(elem)) return null;
    return { row: parseInt(elem.slice(0, 2)), col: parseInt(elem.slice(2, 4)) };
  }

  // 最新のdataを参照するためrefで保持
  const genPreviewRef = useRef(null);
  genPreviewRef.current = (startElem, direction, steps) => {
    const parsed = parseElemNo(startElem);
    if (!parsed || !direction || steps <= 0) return [];
    const elements = dataRef.current.elements;
    const deleted = dataRef.current.deletedElements;
    const result = [];
    for (let i = 1; i <= steps; i++) {
      let { row, col } = parsed;
      if      (direction === 'h') col += i;
      else if (direction === 'l') col -= i;
      else if (direction === 'v') row += i;
      else if (direction === 'u') row -= i;
      if (col < 1 || col > 99 || row < 1 || row > 99) break;
      const newElem = String(row).padStart(2, '0') + String(col).padStart(2, '0');
      const isGrayed = deleted instanceof Set && deleted.has(newElem);
      // 未追加、またはグレーアウト済み（再アクティブ化対象）を含める
      if (!elements.includes(newElem) || isGrayed) result.push(newElem);
    }
    return result;
  };

  // 複数要素を一括追加（グレー要素は再アクティブ化）
  const activateManyRef = useRef(null);
  activateManyRef.current = (elems) => {
    if (!elems || elems.length === 0) return;
    const d = dataRef.current;
    const newElems = [...d.elements];
    const newManual = new Set(d.manualElements);
    const newDeleted = new Set(d.deletedElements || []);
    let changed = false;
    elems.forEach(elem => {
      if (newDeleted.has(elem)) {
        // グレーアウト済み → 再アクティブ化
        newDeleted.delete(elem);
        changed = true;
      } else if (!newElems.includes(elem)) {
        // 新規追加（緑タグ）
        newElems.push(elem);
        newManual.add(elem);
        changed = true;
      }
    });
    if (!changed) return;
    newElems.sort((a, b) => parseInt(a) - parseInt(b));
    onUpdateRef.current(code, { ...d, elements: newElems, manualElements: newManual, deletedElements: newDeleted });
  };

  // クリックで削除（グレー→再アクティブ、青→その場グレーアウト、緑→完全消去）
  const pendingClickRef = useRef(null);
  const deleteElemByValueRef = useRef(null);
  deleteElemByValueRef.current = (elem) => {
    const d = dataRef.current;
    if (!d.elements.includes(elem)) return;
    const isGrayed = d.deletedElements instanceof Set && d.deletedElements.has(elem);
    if (isGrayed) {
      // グレーアウト済み → 再アクティブ化
      const newDeleted = new Set(d.deletedElements);
      newDeleted.delete(elem);
      onUpdateRef.current(code, { ...d, deletedElements: newDeleted });
      return;
    }
    const isManualElem = d.isManualAdded || (d.manualElements && d.manualElements.has(elem));
    if (isManualElem) {
      // 緑（手動追加）→ 完全消去
      const newElems = d.elements.filter(e => e !== elem);
      const newManual = new Set(d.manualElements);
      newManual.delete(elem);
      onUpdateRef.current(code, { ...d, elements: newElems, manualElements: newManual });
    } else {
      // 青（DXF/Excel）→ その場でグレーアウト（elementsには残す）
      const newDeleted = new Set(d.deletedElements || []);
      newDeleted.add(elem);
      onUpdateRef.current(code, { ...d, deletedElements: newDeleted });
    }
  };

  // window レベルのマウスイベント
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragExtActiveRef.current || !dragExtInfoRef.current) return;
      const info = dragExtInfoRef.current;
      const dx = e.clientX - info.startX;
      const dy = e.clientY - info.startY;
      let dir = info.direction;
      if (!dir && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          dir = dx >= 0 ? 'h' : 'l';  // 右/左
        } else {
          dir = dy >= 0 ? 'v' : 'u';  // 下/上
        }
      }
      const rawDist = dir === 'h' ? dx : dir === 'l' ? -dx : dir === 'v' ? dy : -dy;
      const steps = Math.max(0, Math.floor(rawDist / PX_PER_STEP));
      const preview = genPreviewRef.current(info.startElem, dir, steps);
      const newInfo = { ...info, direction: dir, preview, cursorX: e.clientX, cursorY: e.clientY };
      dragExtInfoRef.current = newInfo;
      setDragExtState({ ...newInfo });
    };
    const onMouseUp = () => {
      if (longPressTimerRef.current) {
        // 短押し（タイマー未発火）→ クリック動作
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        if (pendingClickRef.current) {
          deleteElemByValueRef.current(pendingClickRef.current.elem);
        }
      } else if (dragExtActiveRef.current && dragExtInfoRef.current) {
        // ドラッグ完了 → 一括追加
        activateManyRef.current(dragExtInfoRef.current.preview);
      } else if (pendingClickRef.current) {
        // タイマーなし（グレー要素など）→ 単純クリック動作
        deleteElemByValueRef.current(pendingClickRef.current.elem);
      }
      pendingClickRef.current = null;
      dragExtActiveRef.current = false;
      dragExtInfoRef.current = null;
      setDragExtState(null);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ドラッグ中はbodyのcursorを変更
  useEffect(() => {
    if (dragExtState) {
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [!!dragExtState]);

  function handleBlueTagMouseDown(e, elem) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    pendingClickRef.current = { elem, startX, startY };
    // グレーアウト済み要素は長押しドラッグ不可（クリックで再アクティブのみ）
    const isGrayed = dataRef.current.deletedElements instanceof Set &&
                     dataRef.current.deletedElements.has(elem);
    if (isGrayed) return;
    if (!parseElemNo(elem)) return;
    longPressTimerRef.current = setTimeout(() => {
      pendingClickRef.current = null;
      dragExtActiveRef.current = true;
      const info = { startElem: elem, startX, startY, direction: null, preview: [], cursorX: startX, cursorY: startY };
      dragExtInfoRef.current = info;
      setDragExtState({ ...info });
      longPressTimerRef.current = null;
    }, LONG_PRESS_MS);
  }
  // ──────────────────────────────────────────────────────

  const addByInput = (val) => {
    let v = val.trim();
    if (!v) return;
    if (!isNaN(v)) v = String(parseInt(v)).padStart(4, "0");
    if (data.elements.includes(v)) return;
    const newElems = [...data.elements, v].sort((a, b) => parseInt(a) - parseInt(b));
    const newManual = new Set(data.manualElements);
    newManual.add(v);
    onUpdate(code, { ...data, elements: newElems, manualElements: newManual });
    setInputVal("");
  };

  const isManual = (elem) => data.isManualAdded || (data.manualElements && data.manualElements.has(elem));
  const isGrayedOut = (elem) => data.deletedElements instanceof Set && data.deletedElements.has(elem);

  return (
    <div style={{ ...s.memberRow, ...(data.isDeleted ? s.memberRowDeleted : {}) }} data-member-code={code}>
      {data.isDeleted ? (
        <>
          <div>
            <div style={{ ...s.codeBadge, color: "#94a3b8" }}>{code}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{data.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>削除済み</span>
            <button style={s.restoreBtn} onClick={() => onRestore(code)}>元に戻す</button>
          </div>
        </>
      ) : (
      <>
      {/* 左列：記号・材料 */}
      <div>
        <div style={{ ...s.codeBadge, ...(data.isManualAdded ? s.codeBadgeAdded : {}) }}>{code}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
          <span style={{ fontSize: 10, color: "#64748b" }}>材料</span>
          <select
            style={s.matSelect}
            value={data.material || ""}
            onChange={e => onUpdate(code, { ...data, material: e.target.value })}
          >
            {MATERIAL_OPTS.map(v => <option key={v} value={v}>{v || "　"}</option>)}
          </select>
        </div>
        <button style={s.deleteRowBtn} onClick={() => onDelete(code)} title="部材を削除">×</button>
      </div>

      {/* 右列：要素番号タグエリア（グリッド：末尾2桁=列, 前2桁=行） */}
      <div style={s.elemAreaWrap}>
        {(() => {
          const valid4 = data.elements.filter(e => /^\d{4}$/.test(e));
          const others = data.elements.filter(e => !/^\d{4}$/.test(e));
          const gridRows = [...new Set(valid4.map(e => e.slice(0,2)))].sort();
          const gridCols = [...new Set(valid4.map(e => e.slice(2,4)))].sort();
          return (
            <>
              {gridCols.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols.length}, 52px)`, gap: 4, marginBottom: others.length ? 4 : 0 }}>
                  {gridRows.map(row =>
                    gridCols.map(col => {
                      const elem = row + col;
                      if (!data.elements.includes(elem)) {
                        return <div key={`empty-${row}-${col}`} style={{ height: 26 }} />;
                      }
                      const grayed = isGrayedOut(elem);
                      const manual = isManual(elem);
                      const tagStyle = grayed ? s.elemTagGray
                        : manual ? { ...s.elemTagActive, ...s.elemTagAdded }
                        : s.elemTagActive;
                      return (
                        <span key={elem}
                          style={{ ...tagStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', width: 52 }}
                          onMouseDown={e => handleBlueTagMouseDown(e, elem)}
                          title={grayed ? "クリックで再アクティブ化" : "クリックでグレーアウト / 長押し+ドラッグで連続追加"}
                        >
                          {elem}
                        </span>
                      );
                    })
                  )}
                </div>
              )}
              {others.map(elem => {
                const grayed = isGrayedOut(elem);
                const manual = isManual(elem);
                const tagStyle = grayed ? s.elemTagGray : manual ? { ...s.elemTagActive, ...s.elemTagAdded } : s.elemTagActive;
                return (
                  <span key={elem} style={{ ...tagStyle, cursor: 'pointer' }}
                    onMouseDown={e => handleBlueTagMouseDown(e, elem)}>
                    {elem}
                  </span>
                );
              })}
            </>
          );
        })()}

        {/* 個別追加入力 */}
        <span style={s.elemAddBox}>
          <input
            style={s.elemAddInput}
            type="text"
            maxLength={4}
            placeholder="0000"
            title="4桁入力してEnter"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); addByInput(inputVal); }
            }}
          />
        </span>
      </div>
      </>
      )}

      {/* 長押しドラッグ プレビューオーバーレイ */}
      {dragExtState && (
        <div style={{
          position: 'fixed',
          left: dragExtState.cursorX + 14,
          top: dragExtState.cursorY - 28,
          background: '#1e3a5f',
          color: '#fff',
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 11,
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
          maxWidth: 360,
        }}>
          {dragExtState.direction === 'u' ? '↑' : dragExtState.direction === 'v' ? '↓' : dragExtState.direction === 'l' ? '←' : dragExtState.direction === 'h' ? '→' : '…長押し中'}
          {dragExtState.preview.length > 0
            ? ' ' + dragExtState.preview.join(', ') + ' を追加'
            : dragExtState.direction ? ' （範囲なし）' : ''}
        </div>
      )}
    </div>
  );
}

// ===== 部材追加モーダル =====
function AddMemberModal({ onAdd, onClose }) {
  const [code, setCode] = useState("");
  const [elemInput, setElemInput] = useState("");

  const handleAdd = () => {
    if (!code) { alert("部材を選択してください"); return; }
    const elements = expandElemRange(elemInput);
    onAdd(code, elements);
    onClose();
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <h3 style={{ marginTop: 0, fontSize: 15, color: "#1e3a5f" }}>+ 部材を追加</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={s.formLabel}>部材を選択</label>
          <select style={s.formSelect} value={code} onChange={e => setCode(e.target.value)}>
            <option value="">―― 部材を選択 ――</option>
            {ALL_MEMBERS.map(([c, name]) => (
              <option key={c} value={c}>{c}（{name}）</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={s.formLabel}>要素番号（範囲指定可）</label>
          <textarea
            style={{ ...s.formInput, height: 72, resize: "vertical" }}
            placeholder={"例: 0101-0104\n0201,0202,0301"}
            value={elemInput}
            onChange={e => setElemInput(e.target.value)}
          />
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            範囲: 0101-0104 / カンマ区切り: 0101,0201 / 複合可
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button style={s.cancelBtn} onClick={onClose}>キャンセル</button>
          <button style={s.confirmBtn} onClick={handleAdd}>追加</button>
        </div>
      </div>
    </div>
  );
}

// ===== メインコンポーネント =====
export default function MemberList({ membersBySpan, dxfElementNumbers, dxfSpans, onUpdate }) {
  const [memberDataBySpan, setMemberDataBySpan] = useState(() =>
    buildMemberDataBySpan(membersBySpan, dxfSpans)
  );
  const [activeSpan, setActiveSpan] = useState(() => {
    const keys = Object.keys(buildMemberDataBySpan(membersBySpan, dxfSpans)).map(Number);
    return keys.length > 0 ? keys[0] : 1;
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 初回マウント時のみmembersBySpan+dxfSpanで構築
  // dxfSpansが変わった時（DXF再取込）は prevの編集内容を引き継いで再構築

  useEffect(() => {
    const newData = buildMemberDataBySpan(membersBySpan, dxfSpans);

    // Supabaseから復元した編集情報（保存済みmembersBySpan）を優先して反映
    if (membersBySpan && membersBySpan.length > 0) {
      membersBySpan.forEach(savedSpan => {
        const sp = savedSpan.span_no;
        if (!newData[sp]) return;
        const allSaved = [...(savedSpan.major || []), ...(savedSpan.other || [])];
        allSaved.forEach(saved => {
          const code = saved.symbol;
          if (!code) return;
          if (!newData[sp][code]) {
            // 手動追加部材を復元
            if (saved.isManualAdded) {
              const info = MEMBER_MAP[code];
              newData[sp][code] = {
                name: info ? info.name : (saved.name || code),
                koshu: info ? info.koshu : (saved.koshu || ""),
                material: saved.zairyo || "",
                elements: saved.element_no ? saved.element_no.split(",").map(s => s.trim()).filter(Boolean) : [],
                isManualAdded: true,
                manualElements: new Set(saved.manualElementsList || []),
                deletedElements: new Set(saved.deletedElementsList || []),
                isDeleted: saved.isDeleted || false,
              };
            }
            return;
          }
          // 既存部材の編集情報を復元
          newData[sp][code].isDeleted = saved.isDeleted || false;
          newData[sp][code].material = saved.zairyo || newData[sp][code].material;
          newData[sp][code].manualElements = new Set([...newData[sp][code].manualElements, ...(saved.manualElementsList || [])]);
          newData[sp][code].deletedElements = new Set(saved.deletedElementsList || []);
          newData[sp][code].isManualAdded = saved.isManualAdded || false;
          // 手動追加要素を反映
          if (saved.manualElementsList && saved.manualElementsList.length > 0) {
            saved.manualElementsList.forEach(en => {
              if (!newData[sp][code].elements.includes(en)) {
                newData[sp][code].elements.push(en);
              }
            });
            newData[sp][code].elements.sort((a, b) => parseInt(a) - parseInt(b));
          }
          // グレーアウト要素をelementsに含める（その場グレー表示のため）
          if (saved.deletedElementsList && saved.deletedElementsList.length > 0) {
            saved.deletedElementsList.forEach(en => {
              if (!newData[sp][code].elements.includes(en)) {
                newData[sp][code].elements.push(en);
              }
            });
            newData[sp][code].elements.sort((a, b) => parseInt(a) - parseInt(b));
          }
        });
      });
    }

    const keys = Object.keys(newData).map(Number).sort((a, b) => a - b);
    if (keys.length > 0) setActiveSpan(keys[0]);

    // 行01の欠損要素を自動グレー追加
    // 行02以上の要素がある列に対し、行01が欠けていればグレーで補完
    Object.keys(newData).forEach(sp => {
      Object.keys(newData[sp]).forEach(code => {
        const d = newData[sp][code];
        const valid = d.elements.filter(e => /^\d{4}$/.test(e));
        const colsNeedingRow01 = new Set(
          valid.filter(e => parseInt(e.slice(0,2)) >= 2).map(e => e.slice(2))
        );
        let changed = false;
        const newElems = [...d.elements];
        const newDeleted = new Set(d.deletedElements);
        colsNeedingRow01.forEach(col => {
          const elem01 = '01' + col;
          if (!newElems.includes(elem01)) {
            newElems.push(elem01);
            newDeleted.add(elem01);
            changed = true;
          }
        });
        if (changed) {
          newElems.sort((a, b) => parseInt(a) - parseInt(b));
          newData[sp][code] = { ...d, elements: newElems, deletedElements: newDeleted };
        }
      });
    });

    setMemberDataBySpan(newData);
  }, [dxfSpans]);

  const spans = Object.keys(memberDataBySpan).map(Number).sort((a, b) => a - b);

  const handleUpdateMember = (code, newData) => {
    setMemberDataBySpan(prev => ({
      ...prev,
      [activeSpan]: { ...prev[activeSpan], [code]: newData },
    }));
  };

  const handleDeleteMember = (code) => {
    setMemberDataBySpan(prev => {
      const cur = prev[activeSpan] || {};
      if (!cur[code]) return prev;
      return {
        ...prev,
        [activeSpan]: {
          ...cur,
          [code]: { ...cur[code], isDeleted: true },
        },
      };
    });
  };

  const handleRestoreMember = (code) => {
    setMemberDataBySpan(prev => {
      const cur = prev[activeSpan] || {};
      if (!cur[code]) return prev;
      return {
        ...prev,
        [activeSpan]: {
          ...cur,
          [code]: { ...cur[code], isDeleted: false },
        },
      };
    });
  };

  const handleAddMember = (code, elements) => {
    const info = MEMBER_MAP[code];
    setMemberDataBySpan(prev => {
      const cur = prev[activeSpan] || {};
      const existing = cur[code];
      const newElems = existing
        ? [...new Set([...existing.elements, ...elements])].sort((a, b) => parseInt(a) - parseInt(b))
        : [...elements].sort((a, b) => parseInt(a) - parseInt(b));
      const manualElements = new Set(existing?.manualElements || []);
      elements.forEach(e => manualElements.add(e));

      // MEMBER_ORDER順に並び替え
      const updated = {
        ...cur,
        [code]: {
          name: info ? info.name : code,
          koshu: info ? info.koshu : "",
          material: existing?.material || "",
          elements: newElems,
          isManualAdded: !existing,
          manualElements,
        },
      };
      const ordered = {};
      MEMBER_ORDER.forEach(c => { if (updated[c]) ordered[c] = updated[c]; });
      Object.keys(updated).forEach(c => { if (!ordered[c]) ordered[c] = updated[c]; });
      return { ...prev, [activeSpan]: ordered };
    });
  };

  const handleAddSpan = () => {
    const nextNo = spans.length > 0 ? Math.max(...spans) + 1 : 1;
    setMemberDataBySpan(prev => ({ ...prev, [nextNo]: {} }));
    setActiveSpan(nextNo);
  };

  const handleDeleteSpan = (sp) => {
    const hasData = Object.keys(memberDataBySpan[sp] || {}).length > 0;
    if (hasData && !window.confirm(`径間${sp}には部材データがあります。削除しますか？`)) return;
    setMemberDataBySpan(prev => {
      const next = { ...prev };
      delete next[sp];
      return next;
    });
    if (activeSpan === sp) {
      const remaining = Object.keys(memberDataBySpan).map(Number).filter(n => n !== sp).sort((a, b) => a - b);
      if (remaining.length > 0) setActiveSpan(remaining[0]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(toMembersBySpan(memberDataBySpan, dxfSpans));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert("保存に失敗しました: " + e.message);
    }
    setSaving(false);
  };

  const currentData = memberDataBySpan[activeSpan] || {};
  const dxfSpan = dxfSpans ? dxfSpans.find(s => s.span_no === activeSpan) : null;

  return (
    <div>
      {/* 取込元バッジ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, fontSize: 12 }}>
        {membersBySpan && membersBySpan.length > 0 && (
          <span style={s.badgeBlue}>Excel取込済</span>
        )}
        {dxfSpans && dxfSpans.length > 0 && (
          <span style={s.badgeGreen}>DXF取込済（{dxfSpans.length}径間）</span>
        )}
      </div>

      {/* 説明文 */}
      <div style={s.alertInfo}>
        💡 <strong>青タグをクリック</strong>でグレーアウト（非表示）。<strong>長押し+ドラッグ</strong>で連続追加。グレーをクリックで再アクティブ化。
      </div>

      {/* 径間タブ */}
      {spans.length > 0 && (
        <div style={s.tabBar}>
          {spans.map(sp => (
            <div
              key={sp}
              style={{ ...s.tabBtn, ...(activeSpan === sp ? s.tabBtnActive : {}) }}
              onClick={() => setActiveSpan(sp)}
              onContextMenu={e => { e.preventDefault(); handleDeleteSpan(sp); }}
              title="クリックで切替 / 右クリックで削除"
            >
              径間{sp}
            </div>
          ))}
          <div style={s.tabBtnAdd} onClick={handleAddSpan}>+ 径間追加</div>
        </div>
      )}

      {/* 視点タグ */}
      {dxfSpan?.views && dxfSpan.views.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
          {dxfSpan.views.map((v, i) => (
            <span key={i} style={s.viewTag}>{v}</span>
          ))}
        </div>
      )}

      {/* 部材行エリア */}
      <div style={{ marginTop: 8 }}>
        {Object.keys(currentData).length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13, padding: "12px 0" }}>
            部材がありません。「+ 部材を追加」から追加してください。
          </p>
        ) : (
          Object.entries(currentData).map(([code, data]) => (
            <MemberRow
              key={code}
              code={code}
              data={data}
              onUpdate={handleUpdateMember}
              onDelete={handleDeleteMember}
              onRestore={handleRestoreMember}
            />
          ))
        )}
      </div>

      {/* 部材追加ボタン */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
        <button style={s.addMemberBtn} onClick={() => setShowAddModal(true)}>+ 部材を追加</button>
      </div>

      {/* 保存ボタン */}
      <div style={{ textAlign: "right", marginTop: 12 }}>
        <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
          保存
        </button>
      </div>

      {/* 部材追加モーダル */}
      {showAddModal && (
        <AddMemberModal
          onAdd={handleAddMember}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

// ===== スタイル =====
const s = {
  memberRow: {
    display: "grid", gridTemplateColumns: "90px 1fr", gap: 0,
    borderBottom: "1px solid #e2e8f0", padding: "10px 0", alignItems: "start",
  },
  memberRowDeleted: {
    opacity: 0.5, background: "#f8fafc",
  },
  restoreBtn: {
    padding: "2px 10px", fontSize: 11, background: "#f1f5f9",
    border: "1px solid #cbd5e1", borderRadius: 4, color: "#475569", cursor: "pointer",
  },
  codeBadge: { fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#4f8ef7" },
  codeBadgeAdded: { color: "#34d399" },
  matSelect: {
    width: 54, background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: 4, color: "#1e293b", padding: "1px 2px", fontSize: 11,
  },
  deleteRowBtn: {
    marginTop: 4, background: "none", border: "none", color: "#94a3b8",
    fontSize: 12, cursor: "pointer", padding: "1px 4px",
  },
  elemAreaWrap: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  elemTagActive: {
    display: "inline-flex", alignItems: "center", gap: 3,
    background: "rgba(79,142,247,.15)", border: "1px solid #4f8ef7",
    borderRadius: 5, padding: "3px 9px", fontFamily: "monospace", fontSize: 12, color: "#4f8ef7",
    cursor: "grab", userSelect: "none",
  },
  elemTagAdded: {
    background: "rgba(52,211,153,.12)", border: "1px solid rgba(52,211,153,.4)", color: "#34d399",
  },
  elemTagGray: {
    display: "inline-flex", alignItems: "center",
    background: "rgba(100,116,139,.12)", border: "1px solid rgba(100,116,139,.3)",
    borderRadius: 5, padding: "3px 9px", fontFamily: "monospace", fontSize: 12, color: "#64748b",
    cursor: "pointer", userSelect: "none", transition: "all .15s",
  },
  delBtn: { cursor: "pointer", color: "#94a3b8", fontSize: 13, marginLeft: 2 },
  elemAddBox: { display: "inline-flex", alignItems: "center", marginLeft: 4 },
  elemAddInput: {
    width: 52, background: "#fff", border: "1px dashed #e2e8f0",
    borderRadius: 5, color: "#1e293b", padding: "3px 6px",
    fontFamily: "monospace", fontSize: 12, textAlign: "center",
  },
  tabBar: {
    display: "flex", alignItems: "center", gap: 6, marginBottom: 0,
    borderBottom: "1px solid #e2e8f0", paddingBottom: 8, flexWrap: "wrap",
  },
  tabBtn: {
    padding: "5px 14px", borderRadius: "6px 6px 0 0", fontSize: 12, fontWeight: 600,
    cursor: "pointer", border: "1px solid #e2e8f0", borderBottom: "none",
    background: "#f1f5f9", color: "#475569",
  },
  tabBtnActive: { background: "#fff", color: "#1e3a5f", borderColor: "#1e3a5f" },
  tabBtnAdd: {
    padding: "5px 12px", borderRadius: "6px 6px 0 0", fontSize: 12,
    cursor: "pointer", border: "1px dashed #e2e8f0", borderBottom: "none",
    background: "transparent", color: "#94a3b8",
  },
  viewTag: {
    padding: "2px 10px", background: "#f0fdf4", border: "1px solid #86efac",
    borderRadius: 4, fontSize: 12, color: "#15803d",
  },
  alertInfo: {
    background: "rgba(79,142,247,.06)", border: "1px solid rgba(79,142,247,.2)",
    borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#334155", marginBottom: 12,
  },
  badgeBlue: { padding: "2px 8px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 4 },
  badgeGreen: { padding: "2px 8px", background: "#dcfce7", color: "#15803d", borderRadius: 4 },
  addMemberBtn: {
    padding: "6px 16px", fontSize: 13, fontWeight: 600,
    background: "linear-gradient(135deg,#b45309,#f59e0b)", color: "#fff",
    border: "none", borderRadius: 8, cursor: "pointer",
  },
  saveBtn: {
    padding: "8px 24px", fontSize: 14, background: "#1e3a5f",
    border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600,
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
  },
  modal: {
    background: "#fff", borderRadius: 12, padding: 24, width: "90%", maxWidth: 420,
    boxSizing: "border-box", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  },
  formLabel: { display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 },
  formInput: {
    width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0",
    borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box",
  },
  formSelect: {
    width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0",
    borderRadius: 8, fontSize: 13, background: "#fff", boxSizing: "border-box",
  },
  cancelBtn: {
    background: "#f1f5f9", color: "#475569", border: "none",
    borderRadius: 8, padding: "10px 18px", fontSize: 14, cursor: "pointer",
  },
  confirmBtn: {
    background: "#1e3a5f", color: "#fff", border: "none",
    borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
};
