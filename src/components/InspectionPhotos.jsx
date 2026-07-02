// src/components/InspectionPhotos.jsx
// STEP7: 部材群毎の性能の評価結果（点検記録様式 その8-1/その8-2/その9-1/その9-2/その10）
// レイアウト：径間×システムでブロック化。各ブロックは写真2×2＋評価欄
import { useState } from "react";
import { classifyInspectionSheet, classifyPartSystem, ALL_MEMBERS, DAMAGE_TYPES } from "./DamageList";

const SHEET_TABS = ["その8-1", "その8-2", "その9-1", "その9-2", "その10"];
const SYSTEM_ORDER = [
  "床版・床組システム", "主桁・主構システム", "立体機能保持システム",
  "支点反力支持システム", "位置保持システム", "支点位置保持システム", "地表面位置保持システム",
];
const SYSTEM_NONE = "（システム未分類）";
const PER_BLOCK = 4; // 写真2×2

// 写真キー正規化
function normalizeKey(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/^([a-z])_+(\d)/, "$1___$2");
}
function findPhotoKey(photoFile, photos) {
  if (!photoFile || !photos || Object.keys(photos).length === 0) return null;
  const input = normalizeKey(photoFile.replace(/\.[^.]+$/, "").trim());
  if (!input) return null;
  if (photos[input]) return input;
  const found = Object.keys(photos).find(k => {
    const kn = normalizeKey(k.replace(/\.[^.]+$/, ""));
    return kn === input || kn.includes(input) || input.includes(kn);
  });
  return found || null;
}

// 損傷データ → 新STEP7用アイテム
export function buildInspectionItems(damagesData) {
  return (damagesData || [])
    .filter(d => !d.isNote)
    .map((d, i) => {
      const label = d.photoLabel || "";
      const m = label.match(/(\d+)\s*$/);
      const refNum = m ? m[1] : "";
      return {
        id: "ins-" + (d.id != null ? d.id : i),
        kind: "damage",
        sheet: classifyInspectionSheet(d.symbol),
        system: classifyPartSystem(d.symbol),
        spanNo: d.spanNo || 1,
        refNum,                 // データ記録様式(3-2)の写真番号（参照用）
        symbol: d.symbol || "",
        memberName: d.memberName || "",
        elementNoCurrent: d.elementNoCurrent || "",
        dmgType: d.dmgType || "",
        photoFile: d.photoFile || "",
        order: i,
        deleted: false,
      };
    });
}

// デフォルト値入りの評価欄データ
const GRAY_SHEETS = ["その9-1", "その9-2"];
// シート別グレー仕様（想定する状況の列）。9-1と9-2でグレー列が異なる。
const GRAY_KEYS_BY_SHEET = {
  "その9-1": ["katsu", "gou", "sonotaJoukyou1", "sonotaJoukyou2", "sensaku"],
  "その9-2": ["jishin", "gou", "sonotaJoukyou1", "sonotaJoukyou2"],
};
function grayKeys(sheet) { return GRAY_KEYS_BY_SHEET[sheet] || []; }
function emptyEval(sheet) {
  const gk = grayKeys(sheet);
  const g = k => gk.includes(k);
  return {
    kosei: "", buzaiGun: "", buzaiNo: "", system: "",
    katsu: g("katsu") ? "" : "A", jishin: g("jishin") ? "" : "A", gou: g("gou") ? "" : "A", sonotaJoukyou1: "", sonotaJoukyou2: "",
    hiro: "無", engai: "無", alkali: "無", boshoku: "無", sensaku: g("sensaku") ? "" : "無", shinshuku: "無", sonotaJisho1: "", sonotaJisho2: "",
    kinkyu: "無", iji: "無", shosai: "無", tsuiseki: "無",
    shoken: "【損傷状況・原因・進行性】\n・\n【耐荷性能の評価】\n・\n【耐久性能の評価】\n・\n【措置の必要性】\n・",
  };
}

export default function InspectionPhotos({ items, evals, membersBySpan, photos, situationPhotos, damagesData, onUpdate, onUpdateEvals, onSave }) {
  const [activeTab, setActiveTab] = useState("その8-1");
  const [dragKey, setDragKey] = useState(null);
  const [showSystemModal, setShowSystemModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1=径間選択 2=システム選択
  const [modalSpan, setModalSpan] = useState(null);
  const [sitPhotoModalId, setSitPhotoModalId] = useState(null);

  const list = items || [];
  const evalMap = evals || {};

  // STEP2 部材リスト（プルダウン用）
  const memberOptions = [];
  (membersBySpan || []).forEach(sp => {
    [...(sp.major || []), ...(sp.other || [])].forEach(m => {
      const info = ALL_MEMBERS.find(x => x[0] === m.symbol);
      const name = info ? info[1] : (m.name || m.symbol);
      const els = (m.element_no || "").split(",").map(s => s.trim()).filter(Boolean);
      if (els.length === 0) memberOptions.push({ symbol: m.symbol, name, elementNo: "" });
      else els.forEach(e => memberOptions.push({ symbol: m.symbol, name, elementNo: e }));
    });
  });

  // 当該タブのアイテム（削除済み除く）
  const tabItems = list.filter(it => it.sheet === activeTab && !it.deleted);
  const deletedItems = list.filter(it => it.sheet === activeTab && it.deleted);

  // グループ化：径間 → システム（その8-1/その8-2はシステム細分、他はシステムなし1群）
  function groupKey(spanNo, system) {
    return (activeTab === "その8-1" || activeTab === "その8-2")
      ? `s${spanNo}__${system || SYSTEM_NONE}`
      : `s${spanNo}__${activeTab}`;
  }
  const groupsMap = {};
  tabItems.forEach(it => {
    const key = groupKey(it.spanNo || 1, it.system);
    if (!groupsMap[key]) {
      groupsMap[key] = { key, spanNo: it.spanNo || 1, system: it.system || SYSTEM_NONE, items: [] };
    }
    groupsMap[key].items.push(it);
  });
  // 並び：システム→径間 の順（システム優先）
  const groups = Object.values(groupsMap).sort((a, b) => {
    const ai = SYSTEM_ORDER.indexOf(a.system); const bi = SYSTEM_ORDER.indexOf(b.system);
    const av = ai === -1 ? 99 : ai; const bv = bi === -1 ? 99 : bi;
    if (av !== bv) return av - bv;
    return a.spanNo - b.spanNo;
  });
  // 各グループ内をorder順
  groups.forEach(g => g.items.sort((x, y) => (x.order ?? 9999) - (y.order ?? 9999)));

  // 全シート通しの写真番号マップ（その8-1→その8-2→その9-1→その9-2→その10、表示順）
  const seqMap = {};
  let seq = 1;
  // オレンジ採番（道路橋記録様式用＝チェック済みのみ通し、橋全体で最大20枚）
  const orangeMap = {};
  let orange = 1;
  SHEET_TABS.forEach(sheet => {
    const sheetItems = list.filter(it => it.sheet === sheet && !it.deleted);
    // 当該シートをグループ化して並べる
    const gm = {};
    sheetItems.forEach(it => {
      const key = (sheet === "その8-1" || sheet === "その8-2") ? `s${it.spanNo || 1}__${it.system || SYSTEM_NONE}` : `s${it.spanNo || 1}`;
      if (!gm[key]) gm[key] = { spanNo: it.spanNo || 1, system: it.system || SYSTEM_NONE, items: [] };
      gm[key].items.push(it);
    });
    const gs = Object.values(gm).sort((a, b) => {
      const ai = SYSTEM_ORDER.indexOf(a.system); const bi = SYSTEM_ORDER.indexOf(b.system);
      const av = ai === -1 ? 99 : ai; const bv = bi === -1 ? 99 : bi;
      if (av !== bv) return av - bv;
      return a.spanNo - b.spanNo;
    });
    gs.forEach(g => {
      g.items.sort((x, y) => (x.order ?? 9999) - (y.order ?? 9999));
      g.items.forEach(it => {
        seqMap[it.id] = seq++;
        if (it.chosho && orange <= 20) orangeMap[it.id] = orange++;
      });
    });
  });
  const choshoCount = Object.keys(orangeMap).length;

  function updateItem(id, patch) {
    onUpdate(list.map(it => it.id === id ? { ...it, ...patch } : it));
  }
  function getEval(key) {
    const ev = evalMap[key] || emptyEval(activeTab);
    const gk = grayKeys(activeTab);
    const out = { ...ev };
    if (gk.length) { gk.forEach(k => { out[k] = ""; }); }
    if (activeTab === "その10") {
      ["katsu", "jishin", "gou"].forEach(k => { if (!out[k]) out[k] = "A"; });
    }
    return out;
  }
  function updateEval(key, patch) {
    onUpdateEvals({ ...evalMap, [key]: { ...getEval(key), ...patch } });
  }

  function handleReimport() {
    if (!window.confirm("損傷リスト（STEP6）から取り込み直します。\nSTEP7での編集・削除・追加・評価入力はすべて失われます。よろしいですか？")) return;
    onUpdate(buildInspectionItems(damagesData));
    onUpdateEvals({});
  }

  const SYSTEM_OPTIONS_8_1 = ["床版・床組システム", "主桁・主構システム", "立体機能保持システム"];
  const SYSTEM_OPTIONS_8_2 = ["支点位置保持システム", "支点反力支持システム", "地表面位置保持システム"];

  function handleSave() {
    const fullEvalMap = { ...evalMap };
    const allItems = list.filter(it => !it.deleted);
    const PER_BLOCK_S = 4;
    const gm = {};
    allItems.forEach(it => {
      const sheet = it.sheet || "";
      const is89 = sheet === "その8-1" || sheet === "その8-2";
      const key = is89 ? `s${it.spanNo || 1}__${it.system || SYSTEM_NONE}` : `s${it.spanNo || 1}__${sheet}`;
      if (!gm[key]) gm[key] = { key, count: 0, sheet };
      gm[key].count++;
    });
    Object.values(gm).forEach(g => {
      const pages = Math.max(1, Math.ceil(g.count / PER_BLOCK_S));
      for (let pi = 0; pi < pages; pi++) {
        const ekey = `${g.key}__p${pi}`;
        if (!(ekey in fullEvalMap)) fullEvalMap[ekey] = emptyEval(g.sheet);
      }
    });
    Object.keys(fullEvalMap).forEach(ekey => {
      const sheet = allItems.find(it => {
        const is89 = it.sheet === "その8-1" || it.sheet === "その8-2";
        const k = is89 ? `s${it.spanNo||1}__${it.system||SYSTEM_NONE}` : `s${it.spanNo||1}__${it.sheet}`;
        return ekey.startsWith(k + "__p");
      })?.sheet || "";
      grayKeys(sheet).forEach(k => { fullEvalMap[ekey][k] = ""; });
      if (sheet === "その10") {
        ["katsu", "jishin", "gou"].forEach(k => { if (!fullEvalMap[ekey][k]) fullEvalMap[ekey][k] = "A"; });
      }
    });
    onUpdateEvals(fullEvalMap);
    if (onSave) onSave(fullEvalMap);
  }

  function openSystemModal() {
    setModalStep(1);
    setModalSpan(null);
    setShowSystemModal(true);
  }

  function handleSelectSpan(sp) {
    setModalSpan(sp);
    setModalStep(2);
  }

  function handleAddSystem(system) {
    setShowSystemModal(false);
    const sp = modalSpan;
    const existing = new Set(list.filter(it => it.sheet === activeTab && !it.deleted).map(it => `s${it.spanNo}__${it.system}`));
    const gkey = `s${sp}__${system}`;
    if (existing.has(gkey)) {
      alert("既に同じシステムが追加されています。");
      return;
    }
    const maxOrder = Math.max(0, ...list.map(it => it.order ?? 0));
    onUpdate([...list, {
      id: "sys-" + Date.now() + "-" + sp,
      sheet: activeTab, system, spanNo: sp,
      memberName: "", symbol: "", elementNoCurrent: "",
      dmgType: "NON", photoFile: "", photoLabel: "",
      assignedKey: "", order: maxOrder + 1,
      deleted: false, kind: "manual",
    }]);
  }

  function handleAddManual(spanNo, system) {
    const maxOrder = Math.max(0, ...list.filter(it => it.sheet === activeTab).map(it => it.order ?? 0));
    const newItem = {
      id: "man-" + Date.now(),
      kind: "manual",
      sheet: activeTab,
      system: (activeTab === "その8-1" || activeTab === "その8-2") ? (system === SYSTEM_NONE ? "" : (system || "")) : "",
      spanNo: spanNo || 1,
      refNum: "", symbol: "", memberName: "", elementNoCurrent: "",
      dmgType: "NON", photoFile: "", order: maxOrder + 1, deleted: false,
    };
    onUpdate([...list, newItem]);
  }
  function handleDelete(id) { updateItem(id, { deleted: true }); }
  function handleRestore(id) { updateItem(id, { deleted: false }); }

  function handleDrop(targetId, groupKeyStr) {
    if (!dragKey || dragKey === targetId) { setDragKey(null); return; }
    const groupItems = groups.find(g => g.key === groupKeyStr)?.items || [];
    const ids = groupItems.map(it => it.id);
    const from = ids.indexOf(dragKey); const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragKey(null); return; }
    const arr = [...groupItems];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    const orderMap = {};
    arr.forEach((it, i) => { orderMap[it.id] = i; });
    onUpdate(list.map(it => orderMap[it.id] != null ? { ...it, order: orderMap[it.id] } : it));
    setDragKey(null);
  }

  // 写真1枠
  function PhotoCell({ item }) {
    if (!item) return <div style={st.photoEmpty} />;
    const photoKey = findPhotoKey(item.photoFile, photos);
    const photoUrl = photoKey && photos[photoKey] ? photos[photoKey].url : null;
    const isManual = item.kind === "manual";
    return (
      <div style={{ ...st.photoCell, ...(isManual ? st.photoCellManual : {}), ...(dragKey === item.id ? { opacity: 0.4 } : {}) }}
        draggable
        onDragStart={() => setDragKey(item.id)}
        onDragEnd={() => setDragKey(null)}
        onDragOver={e => e.preventDefault()}
        onDrop={() => handleDrop(item.id, groupKey(item.spanNo, item.system))}>
        <div style={st.photoHeadRow}>
          <span style={st.seqBadge}>写-{seqMap[item.id] || "?"}</span>
          <label style={st.choshoBox} title="道路橋記録様式に使用する写真">
            <span>道路橋</span>
            <input type="checkbox" checked={!!item.chosho}
              disabled={!item.chosho && choshoCount >= 20}
              onChange={() => updateItem(item.id, { chosho: !item.chosho })} />
            {item.chosho && <span style={st.orangeBadge}>写-{orangeMap[item.id]}</span>}
          </label>
          <button style={st.cellDel} onClick={() => handleDelete(item.id)} title="削除">×</button>
        </div>
        {photoUrl ? <img src={photoUrl} alt="" style={st.photoImg} /> : <div style={st.photoPh}>📷</div>}
        <div style={st.refText}>
          {item.sitPhotoNum
            ? `データ記録様式(1)状況写真${item.sitPhotoNum}`
            : item.refNum
              ? `データ記録様式(3-2)損傷写真${item.refNum}`
              : <span style={{ color: "#cbd5e1" }}>（参照写真なし）</span>}
        </div>
        <select style={st.miniSelect}
          value={item.symbol + "|" + item.elementNoCurrent}
          onChange={e => {
            const [sym, el] = e.target.value.split("|");
            const opt = memberOptions.find(o => o.symbol === sym && o.elementNo === el);
            updateItem(item.id, { symbol: sym, elementNoCurrent: el, memberName: opt ? opt.name : item.memberName, sheet: classifyInspectionSheet(sym), system: classifyPartSystem(sym) });
          }}>
          <option value={item.symbol + "|" + item.elementNoCurrent}>{item.memberName}（{item.symbol}{item.elementNoCurrent}）</option>
          {memberOptions.map((o, i) => <option key={i} value={o.symbol + "|" + o.elementNo}>{o.name}（{o.symbol}{o.elementNo}）</option>)}
        </select>
        <select style={st.miniSelect} value={item.dmgType}
          onChange={e => updateItem(item.id, { dmgType: e.target.value })}>
          <option value="NON">NON（損傷なし）</option>
          {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input list={`ip-pl-${item.id}`} style={st.miniInput} value={item.photoFile} placeholder="写真ファイル(4桁)"
          onChange={e => updateItem(item.id, { photoFile: e.target.value })} />
        <datalist id={`ip-pl-${item.id}`}>
          {photos && Object.values(photos).map(p => <option key={p.name} value={p.name} />)}
        </datalist>
        {situationPhotos && situationPhotos.length > 0 && (
          <button style={st.sitPhotoBtn} onClick={() => setSitPhotoModalId(item.id)}>STEP5から選択</button>
        )}
      </div>
    );
  }

  // 評価欄
  function EvalPanel({ gkey, pageItems }) {
    const ev = getEval(gkey);
    const grayCols = grayKeys(activeTab);
    const f = (label, key, w) => {
      const gray = grayCols.includes(key);
      return (
        <div style={{ ...st.evCell, ...(w ? { flex: w } : {}) }}>
          <div style={st.evLabel}>{label}</div>
          <input style={{ ...st.evInput, ...(gray ? { background: "#e2e8f0", color: "#94a3b8" } : {}) }}
            value={ev[key] || ""} onChange={e => updateEval(gkey, { [key]: e.target.value })}
            disabled={gray} />
        </div>
      );
    };

    function generateShoken() {
      const lines = (pageItems || []).filter(it => it && it.dmgType && it.dmgType !== "NON").map(it => {
        const memberName = it.memberName || "";
        const dmgType = it.dmgType || "";
        const photoNum = seqMap[it.id] ? `写真番号${seqMap[it.id]}` : "";
        return `・${memberName}に${dmgType}が見られる。${photoNum ? `(${photoNum})` : ""}`;
      });
      const current = ev.shoken || "";
      const marker = "【損傷状況・原因・進行性】";
      const nextMarker = "【耐荷性能の評価】";
      const markerIdx = current.indexOf(marker);
      const nextIdx = current.indexOf(nextMarker);
      const generated = marker + "\n" + (lines.length > 0 ? lines.join("\n") : "・");
      let newShoken;
      if (markerIdx !== -1 && nextIdx !== -1) {
        newShoken = current.slice(0, markerIdx) + generated + "\n" + current.slice(nextIdx);
      } else if (markerIdx !== -1) {
        newShoken = current.slice(0, markerIdx) + generated;
      } else {
        newShoken = generated + (current ? "\n" + current : "");
      }
      updateEval(gkey, { shoken: newShoken });
    }
    const is10 = activeTab === "その10";
    return (
      <div style={st.evalPanel}>
        <div style={st.evTitle}>想定する状況における部材群の状態の技術的な評価</div>
        <div style={st.evRow}>{f("活荷重", "katsu")}{f("地震", "jishin")}{f("豪雨・出水", "gou")}{!is10 && <>{f("その他()", "sonotaJoukyou1")}{f("その他()", "sonotaJoukyou2")}</>}</div>
        {!is10 && <>
          <div style={st.evTitle}>特定事象等の有無（有もしくは無）</div>
          <div style={st.evRow}>{f("疲労", "hiro")}{f("塩害", "engai")}{f("ASR", "alkali")}{f("防食機能の低下", "boshoku")}{f("洗掘", "sensaku")}{f("伸縮装置からの漏水", "shinshuku")}{f("その他()", "sonotaJisho1")}{f("その他()", "sonotaJisho2")}</div>
        </>}
        <div style={st.evRow}>{f("緊急対応の必要性(E)", "kinkyu", 1)}{f("維持工事等(M)", "iji", 1)}{f("詳細調査(S1)", "shosai", 1)}{f("追跡調査(S2)", "tsuiseki", 1)}</div>
        <div style={st.evCell}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <div style={st.evLabel}>所見</div>
            <button style={st.shokenBtn} onClick={generateShoken}>所見生成</button>
          </div>
          <textarea style={st.evTextarea} value={ev.shoken || ""} onChange={e => updateEval(gkey, { shoken: e.target.value })} />
        </div>
      </div>
    );
  }

  if (!list || list.length === 0) {
    return (
      <div>
        <div style={st.toolRow}><button style={st.reimportBtn} onClick={handleReimport}>損傷リストから取り込み</button></div>
        <p style={st.empty}>まだ取り込まれていません。「損傷リストから取り込み」を押してください。</p>
      </div>
    );
  }

  return (
    <div>
      {/* 上位タブ */}
      <div style={st.tabBar}>
        {SHEET_TABS.map(tab => {
          const count = list.filter(it => it.sheet === tab && !it.deleted).length;
          const choshoInTab = list.filter(it => it.sheet === tab && !it.deleted && it.chosho).length;
          return (
            <button key={tab} style={{ ...st.tab, ...(tab === activeTab ? st.tabActive : {}) }} onClick={() => setActiveTab(tab)}>
              {tab === "その10" ? "その10（その他部材）" : tab} <span style={st.tabCount}>{count}</span>
              {choshoInTab > 0 && <span style={st.tabChosho} title="道路橋記録様式の枚数">{choshoInTab}</span>}
            </button>
          );
        })}
        {(activeTab === "その8-1" || activeTab === "その8-2") && (
          <button style={st.sysAddBtn} onClick={openSystemModal}>+ システム追加</button>
        )}
        <button style={st.reimportBtn} onClick={handleReimport}>取り込み直し</button>
        <button style={st.saveBtn} onClick={handleSave}>保存</button>
      </div>

      {/* 削除済み復活 */}
      {deletedItems.length > 0 && (
        <div style={st.restoreWrap}>
          <span style={st.restoreLabel}>削除済み（クリックで復活）:</span>
          {deletedItems.map(it => (
            <button key={it.id} style={st.restoreBtn} onClick={() => handleRestore(it.id)}>
              {it.memberName ? `${it.memberName}（${it.symbol}${it.elementNoCurrent}）` : "(無題)"} ↩
            </button>
          ))}
        </div>
      )}

      {/* システム追加モーダル */}
      {showSystemModal && (
        <div style={st.modalOverlay} onClick={() => setShowSystemModal(false)}>
          <div style={st.modalBox} onClick={e => e.stopPropagation()}>
            {modalStep === 1 ? (<>
              <div style={st.modalTitle}>① 径間を選択</div>
              {[...new Set(list.filter(it => it.sheet === activeTab).map(it => it.spanNo || 1))].sort((a,b)=>a-b).map(sp => (
                <button key={sp} style={st.modalBtn} onClick={() => handleSelectSpan(sp)}>第{sp}径間</button>
              ))}
              <button style={st.modalCancel} onClick={() => setShowSystemModal(false)}>キャンセル</button>
            </>) : (<>
              <div style={st.modalTitle}>② システムを選択（第{modalSpan}径間）</div>
              {(activeTab === "その8-1" ? SYSTEM_OPTIONS_8_1 : SYSTEM_OPTIONS_8_2).map(sys => {
                const exists = list.some(it => it.sheet === activeTab && !it.deleted && it.system === sys && it.spanNo === modalSpan);
                return (
                  <button key={sys}
                    style={{ ...st.modalBtn, ...(exists ? st.modalBtnDisabled : {}) }}
                    onClick={() => !exists && handleAddSystem(sys)}
                    disabled={exists}>
                    {sys}{exists ? " （追加済み）" : ""}
                  </button>
                );
              })}
              <button style={st.modalCancel} onClick={() => setModalStep(1)}>← 戻る</button>
            </>)}
          </div>
        </div>
      )}

      {/* STEP5現地状況写真選択モーダル */}
      {sitPhotoModalId && (
        <div style={st.modalOverlay} onClick={() => setSitPhotoModalId(null)}>
          <div style={st.modalBox} onClick={e => e.stopPropagation()}>
            <div style={st.modalTitle}>STEP5 現地状況写真を選択</div>
            {(situationPhotos || []).map((sp, i) => {
              const key = sp.assignedKey || "";
              const photoUrl = key && photos && photos[key] ? photos[key].url : null;
              return (
                <div key={i} style={st.sitPhotoItem} onClick={() => {
                  const photoName = key && photos && photos[key] ? photos[key].name : "";
                  updateItem(sitPhotoModalId, { photoFile: photoName, assignedKey: key, sitPhotoNum: sp.photoNum });
                  setSitPhotoModalId(null);
                }}>
                  {photoUrl
                    ? <img src={photoUrl} alt="" style={st.sitPhotoThumb} />
                    : <div style={st.sitPhotoThumbEmpty} />}
                  <span style={st.sitPhotoLabel}>径間{sp.spanNo} 状況写真{sp.photoNum}</span>
                </div>
              );
            })}
            <button style={st.modalCancel} onClick={() => setSitPhotoModalId(null)}>キャンセル</button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <p style={st.empty}>{activeTab} に表示する写真がありません。</p>
      ) : (
        groups.map(g => {
          // PER_BLOCK枚ごとにページ分割
          const pages = [];
          for (let i = 0; i < Math.max(g.items.length, 1); i += PER_BLOCK) {
            pages.push(g.items.slice(i, i + PER_BLOCK));
          }
          return (
            <div key={g.key} style={st.group}>
              <div style={st.groupHead}>
                <span style={st.groupSpan}>第{g.spanNo}径間</span>
                {(activeTab === "その8-1" || activeTab === "その8-2") && <span style={st.groupSys}>{g.system}</span>}
                <button style={st.addBtn} onClick={() => handleAddManual(g.spanNo, g.system)}>+ 写真を追加</button>
              </div>
              {pages.map((pageItems, pi) => (
                <div key={pi} style={st.block}>
                  {/* 左：写真2×2 */}
                  <div style={st.photoGrid}>
                    {[0, 1, 2, 3].map(n => <PhotoCell key={n} item={pageItems[n]} />)}
                  </div>
                  {/* 右：評価欄（ページ単位） */}
                  <EvalPanel gkey={`${g.key}__p${pi}`} pageItems={pageItems} />
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

const st = {
  tabBar: { display: "flex", gap: 6, marginBottom: 14, borderBottom: "2px solid #e2e8f0", paddingBottom: 0, alignItems: "center" },
  tab: { padding: "8px 18px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#94a3b8", borderBottom: "2px solid transparent", marginBottom: -2 },
  tabActive: { color: "#1e3a5f", borderBottom: "2px solid #1e3a5f" },
  tabCount: { background: "#e2e8f0", borderRadius: 10, padding: "1px 7px", fontSize: 11, marginLeft: 4 },
  tabChosho: { background: "#fde3cf", color: "#ea7317", borderRadius: 10, padding: "1px 7px", fontSize: 11, marginLeft: 4, fontWeight: 700 },
  reimportBtn: { marginLeft: "auto", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" },
  saveBtn: { background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 6, padding: "5px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  toolRow: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12 },
  empty: { color: "#94a3b8", fontSize: 13 },
  restoreWrap: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 },
  restoreLabel: { fontSize: 11, color: "#94a3b8" },
  restoreBtn: { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer" },
  group: { marginBottom: 24, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" },
  groupHead: { display: "flex", alignItems: "center", gap: 10, background: "#1e3a5f", color: "#fff", padding: "8px 14px" },
  groupSpan: { fontSize: 13, fontWeight: 700 },
  groupSys: { fontSize: 12, background: "rgba(255,255,255,.2)", borderRadius: 4, padding: "2px 10px" },
  addBtn: { marginLeft: "auto", background: "#fff", color: "#1e3a5f", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 },
  sysAddBtn: { background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", borderRadius: 6, padding: "5px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" },
  modalBox: { background: "#fff", borderRadius: 12, padding: 24, minWidth: 280, maxHeight: "80vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 },
  modalTitle: { fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 4 },
  modalBtn: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer", textAlign: "left", fontWeight: 600, color: "#1e3a5f" },
  modalBtnDisabled: { background: "#f1f5f9", color: "#94a3b8", cursor: "not-allowed", border: "1px solid #e2e8f0" },
  modalCancel: { background: "transparent", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", marginTop: 4 },
  sitPhotoBtn: { width: "100%", marginTop: 4, background: "#f0f9ff", color: "#0369a1", border: "1px solid #7dd3fc", borderRadius: 4, padding: "4px 8px", fontSize: 11, cursor: "pointer" },
  sitPhotoItem: { display: "flex", alignItems: "center", gap: 10, padding: "8px", borderRadius: 6, cursor: "pointer", border: "1px solid #e2e8f0", marginBottom: 4 },
  sitPhotoThumb: { width: 60, height: 45, objectFit: "cover", borderRadius: 4, flexShrink: 0 },
  sitPhotoThumbEmpty: { width: 60, height: 45, background: "#e2e8f0", borderRadius: 4, flexShrink: 0 },
  sitPhotoLabel: { fontSize: 13, color: "#1e293b", fontWeight: 600 },
  shokenBtn: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #93c5fd", borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" },
  block: { display: "grid", gridTemplateColumns: "minmax(380px, 1fr) minmax(360px, 1fr)", gap: 12, padding: 14, borderTop: "1px solid #f1f5f9" },
  photoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 8 },
  photoCell: { border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 4, cursor: "grab", background: "#fff" },
  photoCellManual: { background: "#fffbeb", borderColor: "#fcd34d" },
  photoEmpty: { border: "1px dashed #e2e8f0", borderRadius: 8, minHeight: 180, background: "#fafafa" },
  photoHeadRow: { display: "flex", gap: 4, alignItems: "center", justifyContent: "space-between" },
  seqBadge: { background: "#1e3a5f", color: "#fff", borderRadius: 4, padding: "2px 10px", fontSize: 12, fontWeight: 700 },
  orangeBadge: { background: "#ea7317", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 },
  choshoBox: { display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11, color: "#ea7317" },
  refText: { fontSize: 10, color: "#475569", background: "#f1f5f9", borderRadius: 4, padding: "2px 6px", textAlign: "center" },
  photoImg: { width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 4, display: "block" },
  photoPh: { width: "100%", aspectRatio: "4/3", background: "#e2e8f0", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#94a3b8" },
  miniInput: { flex: 1, padding: "3px 6px", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 11, width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  miniSelect: { padding: "3px 6px", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 11, width: "100%", boxSizing: "border-box", background: "#fff" },
  cellDel: { background: "none", border: "none", color: "#94a3b8", fontSize: 14, cursor: "pointer", lineHeight: 1 },
  evalPanel: { border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8, background: "#f8fafc" },
  evTitle: { fontSize: 11, fontWeight: 700, color: "#475569", borderBottom: "1px solid #e2e8f0", paddingBottom: 3 },
  evRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  evCell: { display: "flex", flexDirection: "column", gap: 2, flex: "1 1 60px", minWidth: 60 },
  evLabel: { fontSize: 10, color: "#64748b" },
  evInput: { padding: "3px 5px", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 11, width: "100%", boxSizing: "border-box" },
  evTextarea: { padding: "4px 6px", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 11, width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", minHeight: 320 },
};
