// src/components/DamageList.jsx
import { useState, useEffect, useRef } from "react";
import { buildDefaultMemo, buildInitialDamages } from "../utils/buildDamages";
import { runFullNumbering } from "../utils/numbering";

// 写真キー正規化（前回HTMLのnormalizeKeyと同じ）
function normalizeKey(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/^([a-z])_+(\d)/, "$1___$2");
}

// photoFileから写真を自動マッチ
function findPhotoKey(photoFile, photos) {
  if (!photoFile || !photos || Object.keys(photos).length === 0) return null;
  // 拡張子を除いた値で比較
  const input = normalizeKey(photoFile.replace(/\.[^.]+$/, "").trim());
  if (!input) return null;
  // 完全一致
  if (photos[input]) return input;
  // 写真キー側も拡張子なしで比較
  const found = Object.keys(photos).find(k => {
    const kn = normalizeKey(k.replace(/\.[^.]+$/, ""));
    return kn === input || kn.includes(input) || input.includes(kn);
  });
  return found || null;
}

// 部材記号 → 部材群システム（その8のサブタブ・Excelシステム名欄用）
// 戻り値: システム名（該当なしは ""）
export function classifyPartSystem(symbol) {
  if (!symbol) return "";
  const sym = symbol.trim();
  const MAP = {
    // 床版・床組
    "Ds": "床版・床組システム", "St": "床版・床組システム",
    // 主桁・主構（主構系も仮設定でここ）
    "Mg": "主桁・主構システム",
    "Bt": "主桁・主構システム", "Dt": "主桁・主構システム", "Pt": "主桁・主構システム",
    "Ar": "主桁・主構システム", "Sa": "主桁・主構システム", "Ha": "主桁・主構システム",
    "Ca": "主桁・主構システム", "Pa": "主桁・主構システム", "Rg": "主桁・主構システム",
    "Rp": "主桁・主構システム", "Sc": "主桁・主構システム", "Ts": "主桁・主構システム",
    "Th": "主桁・主構システム", "Td": "主桁・主構システム", "Co": "主桁・主構システム",
    "Gb": "主桁・主構システム", "Cn": "主桁・主構システム", "Pp": "主桁・主構システム",
    "Em": "主桁・主構システム", "Sx": "主桁・主構システム",
    // 立体機能保持
    "Cr": "立体機能保持システム", "Cf": "立体機能保持システム",
    "Lu": "立体機能保持システム", "Ll": "立体機能保持システム",
    // 支点反力支持（支承部・基本）
    "Bh": "支点反力支持システム", "Ba": "支点反力支持システム",
    "Bm": "支点反力支持システム", "Bc": "支点反力支持システム", "Bx": "支点反力支持システム",
    // 支点位置保持（橋脚・橋台躯体）
    "Pw": "支点位置保持システム", "Pb": "支点位置保持システム",
    "Pc": "支点位置保持システム", "Px": "支点位置保持システム",
    "Ap": "支点位置保持システム", "Ac": "支点位置保持システム",
    "Aw": "支点位置保持システム", "Ax": "支点位置保持システム",
    // 地表面位置保持（基礎）
    "Ff": "地表面位置保持システム", "Fx": "地表面位置保持システム",
  };
  return MAP[sym] || "";
}

// 部材記号 → 点検記録様式シート振り分け
// 戻り値: "その8-1" / "その8-2" / "その9-1" / "その9-2" / "その10"
export function classifyInspectionSheet(symbol) {
  if (!symbol) return "その10";
  const sym = symbol.trim();
  // その9-1：落橋防止構造Ss、横変位制限構造Sd
  if (["Ss", "Sd"].includes(sym)) return "その9-1";
  // その9-2：伸縮装置Ej
  if (sym === "Ej") return "その9-2";
  // その8-2：下部構造(橋台Ap,Ac／基礎Ff)＋支承部(Bh,Ba,Bm,Bc)
  const SONO8_2 = ["Ap", "Ac", "Ff", "Bh", "Ba", "Bm", "Bc"];
  if (SONO8_2.includes(sym)) return "その8-2";
  // その8-1：主桁Mg/横桁Cr/床版Ds＋上部構造その他＋その他下部構造・支承部
  const SONO8_1 = [
    "Mg", "Cr", "Ds",
    // 上部構造その他
    "St", "Cf", "Lu", "Ll", "Bt", "Dt", "Pt", "Ar", "Sa", "Ha", "Ca", "Pa",
    "Rg", "Rp", "Sc", "Ts", "Th", "Td", "Co", "Gb", "Cn", "Pp", "Em", "Sx",
    // 下部構造その他
    "Pw", "Pb", "Pc", "Px", "Aw", "Ax", "Fx",
    // 支承部その他
    "Bx",
  ];
  if (SONO8_1.includes(sym)) return "その8-1";
  // その10：上記以外（路上・排水・点検施設・添架物・袖擁壁・溝橋部材など）
  return "その10";
}

export const DAMAGE_TYPES = [
  "①腐食","②亀裂","③ゆるみ・脱落","④破断","⑤防食機能の劣化",
  "⑥ひびわれ","⑦剥離・鉄筋露出","⑧漏水・遊離石灰","⑨抜け落ち","⑩補修・補強材の損傷",
  "⑪床版ひびわれ","⑫うき","⑬遊間の異常","⑭路面の凹凸","⑮舗装の異常",
  "⑯支承部の機能障害","⑰その他","⑱定着部の異常","⑲変色・劣化","⑳漏水・滞水",
  "㉑異常な音・振動","㉒異常なたわみ","㉓変形・欠損","㉔土砂詰まり","㉕沈下・移動・傾斜","㉖洗掘",
];

const DAMAGE_GRADES = {
  "①腐食":{default:["a","b","c","d","e"]},
  "②亀裂":{default:["a","c","e"]},
  "③ゆるみ・脱落":{default:["a","c","e"]},
  "④破断":{default:["a","e"]},
  "⑤防食機能の劣化":{default:["a","b","c","d","e"],"1":["a","c","d","e"],"2":["a","c","e"],"3":["a","b","c","d","e"]},
  "⑥ひびわれ":{default:["a","b","c","d","e"]},
  "⑦剥離・鉄筋露出":{default:["a","c","d","e"]},
  "⑧漏水・遊離石灰":{default:["a","c","d","e"]},
  "⑨抜け落ち":{default:["a","e"]},
  "⑩補修・補強材の損傷":{default:["a","b","c","d","e"]},
  "⑪床版ひびわれ":{default:["a","b","c","d","e"]},
  "⑫うき":{default:["a","e"]},
  "⑬遊間の異常":{default:["a","c","e"]},
  "⑭路面の凹凸":{default:["a","c","e"]},
  "⑮舗装の異常":{default:["a","c","e"]},
  "⑯支承部の機能障害":{default:["a","e"]},
  "⑰その他":{default:["a","e"]},
  "⑱定着部の異常":{default:["a","c","e"]},
  "⑲変色・劣化":{default:["a","e"]},
  "⑳漏水・滞水":{default:["a","e"]},
  "㉑異常な音・振動":{default:["a","e"]},
  "㉒異常なたわみ":{default:["a","e"]},
  "㉓変形・欠損":{default:["a","c","e"]},
  "㉔土砂詰まり":{default:["a","e"]},
  "㉕沈下・移動・傾斜":{default:["a","e"]},
  "㉖洗掘":{default:["a","c","e"]},
};

export const ALL_MEMBERS = [
  ["Mg","主桁"],["Cr","横桁"],["St","縦桁"],["Ds","床版"],["Cf","対傾構"],
  ["Lu","上横構"],["Ll","下横構"],["Bt","上・下弦材"],["Dt","斜材・垂直材"],
  ["Ar","アーチリブ"],["Sa","補剛桁"],["Ha","吊り材"],["Ca","支柱"],
  ["Rg","主構（桁）"],["Rp","主構（脚）"],["Sc","斜材"],["Ts","塔柱"],
  ["Pw","柱部・壁部"],["Pb","梁部"],["Pc","隅角部"],
  ["Ap","胸壁"],["Ac","竪壁"],["Aw","翼壁"],
  ["Ff","フーチング"],["Bh","支承本体"],["Ba","アンカーボルト"],
  ["Bm","沓座モルタル"],["Bc","台座コンクリート"],
  ["Sf","落橋防止システム"],["Ss","落橋防止構造"],["Sd","横変位拘束構造"],
  ["Ra","高欄"],["Gf","防護柵"],["Fg","地覆"],["Ej","伸縮装置"],
  ["Dr","排水ます"],["Dp","排水管"],["Ip","点検施設"],["Ww","袖擁壁"],
];

function getValidGrades(dmgType, bunrui) {
  const entry = dmgType ? DAMAGE_GRADES[dmgType] : null;
  if (!entry) return ["a","b","c","d","e"];
  if (bunrui && entry[bunrui]) return entry[bunrui];
  return entry.default;
}

// 損傷程度セレクト
function DegSelect({ dmgType, bunrui, value, onChange }) {
  const valid = getValidGrades(dmgType, bunrui);
  return (
    <select style={s.editSelect} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">―</option>
      {["a","b","c","d","e"].map(v => (
        <option key={v} value={v} disabled={!valid.includes(v)}
          style={{ color: !valid.includes(v) ? "#94a3b8" : undefined }}>
          {v}{!valid.includes(v) ? " ✕" : ""}
        </option>
      ))}
    </select>
  );
}

// 損傷カード（ドラッグ並び替え対応）
// ===== NONカードフォーム =====
function NonCardForm({ selectedKeys, editingGroup, photos, spanNo, spanMembers, otherUsedKeys, onSave, onDelete, onCancel }) {
  const [photoFile, setPhotoFile] = useState(editingGroup?.photoFile || "");
  const [memo, setMemo] = useState(editingGroup?.memo || "");
  const [elements, setElements] = useState(selectedKeys);
  const photoKeys = Object.keys(photos || {});
  const previewUrl = photoFile && photos[photoFile] ? photos[photoFile].url : null;

  // 要素のトグル（選択/解除）
  const toggleElem = (key) => {
    setElements(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleSave = () => {
    if (elements.length === 0) { alert("要素を1つ以上選択してください。"); return; }
    onSave({
      id: editingGroup?.id || Date.now(),
      spanNo,
      elements,
      photoFile,
      memo,
    });
  };

  // 編集中カード自身の要素は使用済みから除外（自分は選択可能）
  const selfSet = new Set(elements);
  const usedByOthers = new Set(otherUsedKeys || []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 360, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#1e3a5f" }}>NON写真カード</h3>
          <button style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" }} onClick={onCancel}>×</button>
        </div>

        {/* 写真プレビュー */}
        {previewUrl
          ? <img src={previewUrl} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 8, marginBottom: 12 }} />
          : <div style={{ width: "100%", aspectRatio: "4/3", background: "#f1f5f9", borderRadius: 8, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>写真なし</div>
        }

        {/* 要素選択グリッド（緑=選択中、グレー=未選択、クリックでトグル） */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>対象要素（クリックで追加/削除）</div>
          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
            {(spanMembers || []).map(member => {
              // この部材の選択可能要素 = 自分が選択中 or 他で未使用
              const chips = member.elements.filter(e => {
                const key = member.symbol + e;
                return selfSet.has(key) || !usedByOthers.has(key);
              });
              if (chips.length === 0) return null;
              return (
                <div key={member.symbol} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 5 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", minWidth: 26, paddingTop: 3, flexShrink: 0 }}>{member.symbol}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {chips.map(e => {
                      const key = member.symbol + e;
                      const isSel = selfSet.has(key);
                      return (
                        <span key={key}
                          style={{ padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer", userSelect: "none",
                            border: isSel ? "1.5px solid #22c55e" : "1.5px solid #cbd5e1",
                            background: isSel ? "#f0fdf4" : "#f8fafc",
                            color: isSel ? "#16a34a" : "#94a3b8" }}
                          onClick={() => toggleElem(key)}
                        >
                          {e}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>選択中 {elements.length}件</div>
        </div>

        {/* 写真ファイル */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>写真ファイル</div>
          <input
            list="nonPhotoList"
            style={{ width: "100%", padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
            placeholder="4桁入力で絞り込み..."
            defaultValue={photoFile ? (photos[photoFile]?.name || "") : ""}
            onBlur={e => {
              const entry = Object.entries(photos || {}).find(([,v]) => v.name === e.target.value);
              setPhotoFile(entry ? entry[0] : "");
            }}
          />
          <datalist id="nonPhotoList">
            {photoKeys.map(k => <option key={k} value={photos[k].name} />)}
          </datalist>
        </div>

        {/* メモ */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>メモ</div>
          <textarea
            style={{ width: "100%", padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
            rows={3}
            value={memo}
            onChange={e => setMemo(e.target.value)}
          />
        </div>

        {/* ボタン */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {editingGroup && (
            <button style={{ padding: "7px 14px", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 13, color: "#ef4444", background: "none" }}
              onClick={() => { if (window.confirm("このNONカードを削除しますか？")) onDelete(editingGroup.id); }}>
              削除
            </button>
          )}
          <button style={{ padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 13 }} onClick={onCancel}>キャンセル</button>
          <button style={{ padding: "7px 18px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }} onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}

// ===== 損傷カード =====
function DamageCard({ d, index, photos, onUpdate, onDelete, onDragStart, onDragOver, onDrop, isDragOver }) {
  const upd = (field, val) => onUpdate(d.id, { ...d, [field]: val });

  // 写真の自動マッチ
  const photoKey = findPhotoKey(d.photoFile, photos);
  const photoUrl = photoKey && photos[photoKey] ? photos[photoKey].url : null;

  // 部材名編集モード
  const memberSelect = d.editingMember ? (
    <div>
      <div style={s.fieldLabel}>部材記号・要素番号</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 4, marginTop: 2 }}>
        <select style={s.editSelect} value={d.symbol}
          onChange={e => {
            const info = ALL_MEMBERS.find(m => m[0] === e.target.value);
            upd("symbol", e.target.value);
            if (info) onUpdate(d.id, { ...d, symbol: e.target.value, memberName: info[1] });
          }}>
          <option value="">―</option>
          {ALL_MEMBERS.map(([code, name]) => (
            <option key={code} value={code}>{code}（{name}）</option>
          ))}
        </select>
        <input style={s.editInput} value={d.elementNoCurrent}
          placeholder="要素番号"
          onChange={e => upd("elementNoCurrent", e.target.value)} />
        <button style={s.iconBtn} onClick={() => upd("editingMember", false)}>✕</button>
      </div>
    </div>
  ) : (
    <div>
      <div style={s.fieldLabel}>部材名</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
        <span style={{ fontSize: 13, color: "#1e293b", flex: 1 }}>
          {d.memberName} {d.symbol}{d.isExtra ? (d.elementNoCurrent || "").split(",")[0].trim() : d.elementNoCurrent}
        </span>
        <button style={s.iconBtn} onClick={() => upd("editingMember", true)} title="編集">✎</button>
      </div>
    </div>
  );

  if (d.isNote) {
    return (
      <div style={{ ...s.card, background: "#fffbeb", borderLeft: "3px solid #f59e0b" }}>
        <div style={{ fontSize: 11, color: "#92400e", marginBottom: 4 }}>備考</div>
        <div style={{ fontSize: 12, color: "#78350f" }}>{d.detail}</div>
        <button style={s.deleteBtn} onClick={() => onDelete(d.id)}>✕</button>
      </div>
    );
  }

  return (
    <div
      style={{ ...s.card, ...(d.isAdded ? { borderLeft: "3px solid #34d399" } : {}), ...(isDragOver ? { outline: "2px dashed #4f8ef7", outlineOffset: 2 } : {}) }}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={() => onDrop(index)}
    >
      {d.isAdded && <span style={s.addedBadge}>追加</span>}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 4 }}>
        <button style={s.deleteBtn} onClick={() => onDelete(d.id)}>✕</button>
      </div>

      {/* 写真プレビュー */}
      {photoUrl
        ? <img src={photoUrl} alt="" style={{ width: "100%", height: "auto", borderRadius: 6, marginBottom: 4, display: "block" }} />
        : <div style={s.photoPlaceholder}>📷</div>
      }

      {/* 写真番号 */}
      {d.photoLabel && (
        <div style={s.numBadge}>{d.photoLabel}</div>
      )}

      {/* 部材名（編集可） */}
      <div style={s.fieldWrap}>{memberSelect}</div>

      {/* 損傷の種類 */}
      <div style={s.fieldWrap}>
        <div style={s.fieldLabel}>損傷の種類</div>
        <select style={s.editSelect} value={d.dmgType}
          onChange={e => {
            const newMemo = buildDefaultMemo(d.memberName, e.target.value, d.detail, d.subDamages);
            onUpdate(d.id, { ...d, dmgType: e.target.value, memo: newMemo });
          }}>
          <option value="">― 未選択 ―</option>
          {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* 定量的に取得した値 */}
      <div style={s.fieldWrap}>
        <div style={s.fieldLabel}>定量的に取得した値</div>
        <input style={s.editInput} value={d.detail}
          onChange={e => {
            const newMemo = buildDefaultMemo(d.memberName, d.dmgType, e.target.value, d.subDamages);
            onUpdate(d.id, { ...d, detail: e.target.value, memo: newMemo });
          }} />
      </div>

      {/* 損傷程度 前回→今回 */}
      <div style={s.fieldWrap}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 4 }}>
          <div>
            <div style={s.fieldLabel}>前回</div>
            <input style={{ ...s.editInput, textAlign: "center" }} value={d.prevDeg}
              onChange={e => upd("prevDeg", e.target.value)} />
          </div>
          <div style={{ color: "#64748b", marginTop: 14, fontSize: 14 }}>→</div>
          <div>
            <div style={s.fieldLabel}>今回</div>
            <DegSelect dmgType={d.dmgType} bunrui={d.bunrui}
              value={d.currDeg} onChange={v => upd("currDeg", v)} />
          </div>
        </div>
      </div>

      {/* 分類・損傷パターン */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={s.fieldWrap}>
          <div style={s.fieldLabel}>分類</div>
          <input style={s.editInput}
            value={d.bunrui ? ("分類" + d.bunrui + (d.bunruiText ? ":" + d.bunruiText : "")) : ""}
            placeholder="例: 分類6:後打ちコンクリート"
            onChange={e => {
              const val = e.target.value;
              const m = val.match(/^分類(\d)(?::(.*))?$/);
              if (m) {
                upd("bunrui", m[1]);
                onUpdate(d.id, { ...d, bunrui: m[1], bunruiText: m[2] || "" });
              } else {
                upd("bunrui", val);
                onUpdate(d.id, { ...d, bunrui: val, bunruiText: "" });
              }
            }}
          />
        </div>
        <div style={s.fieldWrap}>
          <div style={s.fieldLabel}>損傷パターン</div>
          <input style={s.editInput} value={d.pattern}
            placeholder="パターン番号等" onChange={e => upd("pattern", e.target.value)} />
        </div>
      </div>

      {/* 写真ファイル */}
      <div style={s.fieldWrap}>
        <div style={s.fieldLabel}>写真ファイル{photoKey && <span style={{ color: "#16a34a", marginLeft: 6 }}>✓ マッチ済</span>}</div>
        <input
          style={{ ...s.editInput, ...(photoKey ? { borderColor: "#86efac" } : {}) }}
          list={`photolist-${d.id}`}
          value={d.photoFile}
          placeholder="4桁入力で絞り込み..."
          onChange={e => upd("photoFile", e.target.value)}
        />
        <datalist id={`photolist-${d.id}`}>
          {photos && Object.values(photos).map(p => (
            <option key={p.name} value={p.name} />
          ))}
        </datalist>
      </div>

      {/* メモ */}
      <div style={s.fieldWrap}>
        <div style={s.fieldLabel}>メモ</div>
        <textarea style={{ ...s.editInput, height: 56, resize: "vertical" }}
          value={d.memo} onChange={e => upd("memo", e.target.value)} />
      </div>

      {/* 補修済み・損傷なし（排他選択） */}
      <div style={{ display: "flex", gap: 12, margin: "6px 0" }}>
        {[{ key: "repaired", label: "補修済み" }, { key: "none", label: "損傷なし" }].map(({ key, label }) => (
          <label key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer", color: "#475569" }}>
            <input type="radio" name={`memoType-${d.id}`}
              checked={d.memoType === key}
              onChange={() => upd("memoType", d.memoType === key ? "normal" : key)}
            />
            {label}
          </label>
        ))}
      </div>

      {/* サブ損傷（その他の損傷） */}
      <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 8, marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: "#64748b" }}>その他の損傷</div>
          <button
            style={{ fontSize: 11, background: "rgba(79,142,247,.15)", border: "1px solid #4f8ef7", borderRadius: 4, color: "#4f8ef7", cursor: "pointer", padding: "2px 8px" }}
            onClick={() => {
              const newSubs = [...(d.subDamages || []), { memberName: "", symbol: "", elementNoCurrent: "", dmgType: "", prevDeg: "", currDeg: "", detail: "", quant: "", bunrui: "", pattern: "" }];
              upd("subDamages", newSubs);
            }}
          >+ 追加</button>
        </div>
        {(d.subDamages || []).map((sub, si) => (
          <div key={si} style={{ background: "rgba(0,0,0,.04)", borderRadius: 6, padding: 8, marginBottom: 6, position: "relative" }}>
            <button
              style={{ position: "absolute", top: 4, right: 4, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}
              onClick={() => { const ns = d.subDamages.filter((_,i)=>i!==si); upd("subDamages", ns); }}
            >✕</button>
            <div style={s.fieldWrap}>
              <div style={s.fieldLabel}>部材名</div>
              <input style={s.editInput} value={sub.memberName || ""}
                onChange={e => { const ns=[...d.subDamages]; ns[si]={...ns[si],memberName:e.target.value}; upd("subDamages",ns); }}
                placeholder="例: 排水ます" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div style={s.fieldWrap}>
                <div style={s.fieldLabel}>部材記号</div>
                <input style={s.editInput} value={sub.symbol || ""}
                  onChange={e => { const ns=[...d.subDamages]; ns[si]={...ns[si],symbol:e.target.value}; upd("subDamages",ns); }}
                  placeholder="例: Dr" />
              </div>
              <div style={s.fieldWrap}>
                <div style={s.fieldLabel}>要素番号</div>
                <input style={s.editInput} value={sub.elementNoCurrent || ""}
                  onChange={e => { const ns=[...d.subDamages]; ns[si]={...ns[si],elementNoCurrent:e.target.value}; upd("subDamages",ns); }}
                  placeholder="例: 0201" />
              </div>
            </div>
            <div style={s.fieldWrap}>
              <div style={s.fieldLabel}>損傷の種類</div>
              <select style={s.editSelect} value={sub.dmgType}
                onChange={e => { const ns=[...d.subDamages]; ns[si]={...ns[si],dmgType:e.target.value}; upd("subDamages",ns); }}>
                <option value="">― 未選択 ―</option>
                {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={s.fieldWrap}>
              <div style={s.fieldLabel}>定量的に取得した値</div>
              <input style={s.editInput} value={sub.detail}
                onChange={e => { const ns=[...d.subDamages]; ns[si]={...ns[si],detail:e.target.value}; upd("subDamages",ns); }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 4, marginTop: 4 }}>
              <div>
                <div style={s.fieldLabel}>前回損傷程度</div>
                <input style={{ ...s.editInput, textAlign: "center" }} value={sub.prevDeg}
                  onChange={e => { const ns=[...d.subDamages]; ns[si]={...ns[si],prevDeg:e.target.value}; upd("subDamages",ns); }} />
              </div>
              <div style={{ color: "#64748b", marginTop: 14 }}>→</div>
              <div>
                <div style={s.fieldLabel}>今回損傷程度</div>
                <DegSelect dmgType={sub.dmgType} bunrui=""
                  value={sub.currDeg} onChange={v => { const ns=[...d.subDamages]; ns[si]={...ns[si],currDeg:v}; upd("subDamages",ns); }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 損傷追加モーダル
function AddDamageModal({ dxfSpans, onAdd, onClose }) {
  const [form, setForm] = useState({
    spanNo: dxfSpans?.[0]?.span_no || 1,
    viewTitle: dxfSpans?.[0]?.views?.[0] || "",
    memberName: "", symbol: "", elementNoCurrent: "",
    dmgType: "", prevDeg: "", currDeg: "", detail: "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const currentSpan = dxfSpans?.find(s => s.span_no === form.spanNo);

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <h3 style={{ marginTop: 0, fontSize: 15, color: "#1e3a5f" }}>+ 損傷を追加</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={s.fieldWrap}>
            <div style={s.fieldLabel}>径間</div>
            <select style={s.editSelect} value={form.spanNo}
              onChange={e => { set("spanNo", parseInt(e.target.value)); set("viewTitle", ""); }}>
              {(dxfSpans || []).map(sp => (
                <option key={sp.span_no} value={sp.span_no}>第{sp.span_no}径間</option>
              ))}
            </select>
          </div>
          <div style={s.fieldWrap}>
            <div style={s.fieldLabel}>視点</div>
            <select style={s.editSelect} value={form.viewTitle} onChange={e => set("viewTitle", e.target.value)}>
              <option value="">― 選択 ―</option>
              {(currentSpan?.views || []).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div style={s.fieldWrap}>
            <div style={s.fieldLabel}>部材名</div>
            <input style={s.editInput} value={form.memberName} onChange={e => set("memberName", e.target.value)} />
          </div>
          <div style={s.fieldWrap}>
            <div style={s.fieldLabel}>記号</div>
            <select style={s.editSelect} value={form.symbol}
              onChange={e => {
                const info = ALL_MEMBERS.find(m => m[0] === e.target.value);
                setForm(f => ({ ...f, symbol: e.target.value, memberName: info ? info[1] : f.memberName }));
              }}>
              <option value="">―</option>
              {ALL_MEMBERS.map(([code, name]) => <option key={code} value={code}>{code}（{name}）</option>)}
            </select>
          </div>
          <div style={s.fieldWrap}>
            <div style={s.fieldLabel}>要素番号</div>
            <input style={s.editInput} value={form.elementNoCurrent} onChange={e => set("elementNoCurrent", e.target.value)} />
          </div>
          <div style={s.fieldWrap}>
            <div style={s.fieldLabel}>損傷の種類</div>
            <select style={s.editSelect} value={form.dmgType} onChange={e => set("dmgType", e.target.value)}>
              <option value="">― 未選択 ―</option>
              {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ ...s.fieldWrap, gridColumn: "1 / -1" }}>
            <div style={s.fieldLabel}>損傷程度（前回→今回）</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input style={{ ...s.editInput, width: 44, textAlign: "center" }}
                placeholder="前回" value={form.prevDeg} onChange={e => set("prevDeg", e.target.value)} />
              <span>→</span>
              <DegSelect dmgType={form.dmgType} bunrui="" value={form.currDeg} onChange={v => set("currDeg", v)} />
            </div>
          </div>
          <div style={{ ...s.fieldWrap, gridColumn: "1 / -1" }}>
            <div style={s.fieldLabel}>定量値</div>
            <input style={s.editInput} value={form.detail} onChange={e => set("detail", e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button style={s.cancelBtn} onClick={onClose}>キャンセル</button>
          <button style={s.confirmBtn} onClick={() => {
            if (!form.dmgType || !form.currDeg) { alert("損傷の種類と今回損傷程度は必須です"); return; }
            const memo = buildDefaultMemo(form.memberName, form.dmgType, form.detail, []);
            onAdd({ ...form, id: Date.now(), isAdded: true, memo, bunrui: "", pattern: "", photoFile: "", photoLabel: "", isNote: false, editingMember: false });
            onClose();
          }}>追加</button>
        </div>
      </div>
    </div>
  );
}

// ===== メインコンポーネント =====
export default function DamageList({ dxfGroups, dxfSpans, damagesData, photos, membersBySpan, nonPhotos, numberingRule, numberingLabel, numberingSpanStartNums, numberingNonStartNums, numberingViewOrder, onRunNumbering, onNonPhotosUpdate, onUpdate, onChangeUnsaved }) {
  const [damages, setDamages] = useState(() =>
    damagesData && damagesData.length > 0
      ? damagesData
      : buildInitialDamages(dxfGroups, dxfSpans)
  );
  const [activeSpan, setActiveSpan] = useState(1);
  const [activeView, setActiveView] = useState("__all__");
  const [showAddModal, setShowAddModal] = useState(false);
  const [numbered, setNumbered] = useState(false);

  // 採番実行（損傷＋NON一括、STEP3の設定を使用）
  const handleRunNumbering = async () => {
    const result = runFullNumbering({
      damages,
      nonPhotos,
      rule: numberingRule || 1,
      photoLabel: numberingLabel || "写真",
      spanStartNums: numberingSpanStartNums || {},
      nonStartNums: numberingNonStartNums || {},
      viewOrder: numberingViewOrder || [],
    });
    try {
      await onRunNumbering(result);
      setDamages(result.damages);
      setNumbered(true);
      setTimeout(() => setNumbered(false), 2000);
    } catch (e) {
      alert("採番の保存に失敗しました: " + (e?.message || e));
    }
  };
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dragSrcIdx = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // ── NONタブ state ─────────────────────────────────────
  const [nonSelected, setNonSelected] = useState(new Set());
  const [showNonPopup, setShowNonPopup] = useState(false);
  const [showNonCard, setShowNonCard] = useState(false);
  const [editingNonGroup, setEditingNonGroup] = useState(null);
  const nonMouseDownRef = useRef(false); // マウス押下中フラグ
  const nonPendingActionRef = useRef(null); // mouseup後の処理

  // NON要素のステータス判定
  const getNonElemStatus = (symbol, elemNo) => {
    const key = symbol + elemNo;
    if (damages.some(d => d.symbol === symbol && d.elementNoCurrent === elemNo && d.spanNo === activeSpan))
      return 'damage';
    if ((nonPhotos || []).some(n => n.spanNo === activeSpan && n.elements.includes(key)))
      return 'non';
    return 'none';
  };

  // 現在の径間のアクティブ部材・要素を取得
  const getSpanMembers = () => {
    const spanData = (membersBySpan || []).find(s => s.span_no === activeSpan);
    if (!spanData) return [];
    return (spanData.major || []).filter(m => !m.isDeleted).map(m => {
      const allElems = (m.element_no || "").split(",").map(e => e.trim()).filter(Boolean);
      const deletedSet = new Set(m.deletedElementsList || []);
      const activeElems = allElems.filter(e => !/^\d{4}$/.test(e) || !deletedSet.has(e));
      return { symbol: m.symbol, name: m.name, elements: activeElems };
    }).filter(m => m.elements.length > 0);
  };

  // NON: window mousemove/mouseup（elementFromPoint方式）
  useEffect(() => {
    const onMove = (e) => {
      if (!nonMouseDownRef.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.dataset.nonKey) {
        setNonSelected(prev => {
          if (prev.has(el.dataset.nonKey)) return prev;
          return new Set([...prev, el.dataset.nonKey]);
        });
      }
    };
    const onUp = () => {
      if (!nonMouseDownRef.current) return;
      nonMouseDownRef.current = false;
      document.body.style.userSelect = '';
      if (nonPendingActionRef.current) {
        nonPendingActionRef.current();
        nonPendingActionRef.current = null;
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleNonElemMouseDown = (e, key, status) => {
    if (status === 'damage') return;
    e.preventDefault();
    document.body.style.userSelect = 'none';
    nonMouseDownRef.current = true;
    if (status === 'non') {
      // グリーン → 既存グループを編集
      const group = (nonPhotos || []).find(n => n.spanNo === activeSpan && n.elements.includes(key));
      nonMouseDownRef.current = false;
      document.body.style.userSelect = '';
      setNonSelected(new Set(group?.elements || [key]));
      setEditingNonGroup(group || null);
      setShowNonCard(true);
      return;
    }
    // 新規選択開始
    setNonSelected(new Set([key]));
    nonPendingActionRef.current = () => {
      setNonSelected(prev => {
        if (prev.size > 1) {
          setShowNonPopup(true);
        } else if (prev.size === 1) {
          setEditingNonGroup(null);
          setShowNonCard(true);
        }
        return prev;
      });
    };
  };

  const handleNonSave = (group) => {
    const prev = nonPhotos || [];
    let updated;
    if (editingNonGroup) {
      updated = prev.map(n => n.id === editingNonGroup.id ? group : n);
    } else {
      updated = [...prev, group];
    }
    onNonPhotosUpdate && onNonPhotosUpdate(updated);
    setShowNonCard(false);
    setShowNonPopup(false);
    setNonSelected(new Set());
    setEditingNonGroup(null);
  };

  const handleNonDelete = (groupId) => {
    const updated = (nonPhotos || []).filter(n => n.id !== groupId);
    onNonPhotosUpdate && onNonPhotosUpdate(updated);
    setShowNonCard(false);
    setNonSelected(new Set());
    setEditingNonGroup(null);
  };
  // ──────────────────────────────────────────────────────

  useEffect(() => {
    if (damagesData && damagesData.length > 0) {
      // damagesDataが更新された場合（採番実行後など）はそのまま使う
      setDamages(damagesData);
    } else if (dxfGroups) {
      // DXFデータから初期構築
      setDamages(buildInitialDamages(dxfGroups, dxfSpans));
    }
  }, [dxfGroups, dxfSpans, damagesData]);

  const spans = dxfSpans
    ? dxfSpans.map(s => s.span_no)
    : [...new Set(damages.map(d => d.spanNo))].sort((a,b)=>a-b);

  const currentSpan = dxfSpans?.find(s => s.span_no === activeSpan);
  const views = currentSpan?.views || [];

  const filtered = damages.filter(d => {
    if (d.spanNo !== activeSpan) return false;
    if (activeView === "__all__") return true;
    return d.viewTitle === activeView;
  });

  const handleDragStart = (idx) => { dragSrcIdx.current = idx; };
  const handleDragOver = (idx) => { setDragOverIdx(idx); };
  const handleDrop = (idx) => {
    const src = dragSrcIdx.current;
    if (src === null || src === idx) { setDragOverIdx(null); return; }
    // filteredのインデックスをdamages全体のインデックスに変換
    const filteredList = damages.filter(d => {
      if (d.spanNo !== activeSpan) return false;
      if (activeView === "__all__") return true;
      return d.viewTitle === activeView;
    });
    const srcDamage = filteredList[src];
    const dstDamage = filteredList[idx];
    const srcGlobal = damages.indexOf(srcDamage);
    const dstGlobal = damages.indexOf(dstDamage);
    const next = [...damages];
    next.splice(srcGlobal, 1);
    next.splice(dstGlobal, 0, srcDamage);
    setDamages(next);
    if (onChangeUnsaved) onChangeUnsaved(next);
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  };

  const handleUpdate = (id, updated) => {
    const next = damages.map(d => d.id === id ? updated : d);
    setDamages(next);
    if (onChangeUnsaved) onChangeUnsaved(next);
  };
  const handleDelete = (id) => {
    if (!window.confirm("削除しますか？")) return;
    const next = damages.filter(d => d.id !== id);
    setDamages(next);
    if (onChangeUnsaved) onChangeUnsaved(next);
  };
  const handleAdd = (nd) => {
    const next = [...damages, nd];
    setDamages(next);
    if (onChangeUnsaved) onChangeUnsaved(next);
    setActiveSpan(nd.spanNo);
    setActiveView(nd.viewTitle || "__all__");
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onUpdate(damages); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { alert("保存に失敗しました: " + e.message); }
    setSaving(false);
  };

  return (
    <div>
      {/* 径間タブ */}
      <div style={{ ...s.tabBar, display: "flex", alignItems: "center" }}>
        {spans.map(sp => (
          <button key={sp} style={{ ...s.tabBtn, ...(activeSpan === sp ? s.tabBtnActive : {}) }}
            onClick={() => { setActiveSpan(sp); setActiveView("__all__"); }}>
            第{sp}径間 <span style={s.tabCount}>{damages.filter(d => d.spanNo === sp).length}</span>
          </button>
        ))}
        <button
          style={{ marginLeft: "auto", padding: "7px 18px", background: numbered ? "#16a34a" : "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          onClick={handleRunNumbering}
          title="採番ルール（STEP3）に従い損傷写真・NON写真を一括採番します"
        >
          {numbered ? "採番しました ✓" : "採番を実行"}
        </button>
      </div>

      {/* 視点サブタブ */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "6px 0 10px" }}>
        <button style={{ ...s.subTabBtn, ...(activeView === "__all__" ? s.subTabBtnActive : {}) }}
          onClick={() => setActiveView("__all__")}>
          すべて <span style={s.tabCount}>{damages.filter(d => d.spanNo === activeSpan).length}</span>
        </button>
        {views.map(v => (
          <button key={v} style={{ ...s.subTabBtn, ...(activeView === v ? s.subTabBtnActive : {}) }}
            onClick={() => setActiveView(v)}>
            {v} <span style={s.tabCount}>{damages.filter(d => d.spanNo === activeSpan && d.viewTitle === v).length}</span>
          </button>
        ))}
        <button style={{ ...s.subTabBtn, ...(activeView === "__non__" ? s.subTabBtnActive : {}), color: activeView === "__non__" ? "#1e3a5f" : "#94a3b8" }}
          onClick={() => setActiveView("__non__")}>
          NON <span style={s.tabCount}>{(nonPhotos || []).filter(n => n.spanNo === activeSpan).length}</span>
        </button>
        <button style={s.addViewBtn} onClick={() => setShowAddModal(true)}>+ 損傷追加</button>
      </div>

      {/* 損傷カード（3列） */}
      {activeView === "__non__" ? (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* 左：登録済みNONカード */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* 選択中バナー */}
            {nonSelected.size > 0 && !showNonCard && (
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "#1d4ed8", flex: 1 }}>
                  {[...nonSelected].join("、")} を選択中
                </span>
                <button style={{ padding: "5px 14px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}
                  onClick={() => { setEditingNonGroup(null); setShowNonCard(true); }}>カード作成</button>
                <button style={{ padding: "5px 10px", background: "none", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#94a3b8" }}
                  onClick={() => setNonSelected(new Set())}>解除</button>
              </div>
            )}

            {/* 登録済みNONカード 3列 */}
            {(nonPhotos || []).filter(n => n.spanNo === activeSpan).length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>右のNON写真候補から要素を選択してカードを作成してください</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {(nonPhotos || []).filter(n => n.spanNo === activeSpan).map(group => {
                  const previewUrl = group.photoFile && photos[group.photoFile] ? photos[group.photoFile].url : null;
                  return (
                    <div key={group.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                      {previewUrl
                        ? <img src={previewUrl} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 6, marginBottom: 8, display: "block", cursor: "pointer" }}
                            onClick={() => { setNonSelected(new Set(group.elements)); setEditingNonGroup(group); setShowNonCard(true); }} />
                        : <div style={{ width: "100%", aspectRatio: "4/3", background: "#e2e8f0", borderRadius: 6, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
                            onClick={() => { setNonSelected(new Set(group.elements)); setEditingNonGroup(group); setShowNonCard(true); }}>写真なし</div>
                      }

                      {/* 写真番号バッジ */}
                      <div style={{ background: "#eff6ff", borderRadius: 4, padding: "3px 8px", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f" }}>
                          {group.photoLabel || "（未採番）"}
                        </span>
                      </div>

                      {/* 要素番号 */}
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>要素番号</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
                        {group.elements.map(k => (
                          <span key={k} style={{ background: "#f0fdf4", border: "1px solid #22c55e", color: "#16a34a", borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>{k}</span>
                        ))}
                      </div>

                      {/* メモ欄（編集可能） */}
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>メモ</div>
                      <textarea
                        style={{ width: "100%", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 7px", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 6 }}
                        rows={2}
                        defaultValue={group.memo || ""}
                        onBlur={e => {
                          if (e.target.value === (group.memo || "")) return;
                          const updated = (nonPhotos || []).map(n => n.id === group.id ? { ...n, memo: e.target.value } : n);
                          onNonPhotosUpdate && onNonPhotosUpdate(updated);
                        }}
                      />

                      {/* 写真ファイル編集ボタン */}
                      <button style={{ width: "100%", padding: "5px", fontSize: 11, background: "none", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", color: "#64748b" }}
                        onClick={() => { setNonSelected(new Set(group.elements)); setEditingNonGroup(group); setShowNonCard(true); }}>
                        写真・要素を編集
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 右サイドバー：NON写真候補（未登録要素のみ） */}
          <div style={{ width: 200, flexShrink: 0, borderLeft: "1px solid #e2e8f0", paddingLeft: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", marginBottom: 2 }}>📋 NON写真候補</div>
            {(() => {
              const noneElems = getSpanMembers().flatMap(m =>
                m.elements.filter(e => getNonElemStatus(m.symbol, e) === 'none').map(e => ({ symbol: m.symbol, name: m.name, elemNo: e, key: m.symbol + e }))
              );
              const grouped = noneElems.reduce((acc, item) => {
                const g = acc.find(a => a.symbol === item.symbol);
                if (g) g.elems.push(item);
                else acc.push({ symbol: item.symbol, name: item.name, elems: [item] });
                return acc;
              }, []);
              return (
                <>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 10 }}>
                    未登録 {noneElems.length}件｜クリック/ドラッグで選択
                  </div>
                  {grouped.length === 0 && <p style={{ fontSize: 11, color: "#22c55e" }}>✓ 全要素登録済み</p>}
                  {grouped.map(g => (
                    <div key={g.symbol} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", minWidth: 26, paddingTop: 3, flexShrink: 0 }}>{g.symbol}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {g.elems.map(item => {
                          const isSelected = nonSelected.has(item.key);
                          return (
                            <span key={item.key}
                              data-non-key={item.key}
                              style={{ padding: "3px 7px", borderRadius: 4, border: isSelected ? "1.5px solid #1e3a5f" : "1.5px solid #cbd5e1", background: isSelected ? "#eff6ff" : "#f8fafc", color: isSelected ? "#1e3a5f" : "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", userSelect: "none", outline: isSelected ? "2px solid #bfdbfe" : "none" }}
                              onMouseDown={e => handleNonElemMouseDown(e, item.key, 'none')}
                              title="クリックで選択・ドラッグで範囲選択"
                            >
                              {item.elemNo}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 9, color: "#cbd5e1", marginTop: 12, lineHeight: 1.6 }}>
                    クリック → 単体選択<br/>
                    ドラッグ → 範囲選択<br/>
                    → カード作成
                  </div>
                </>
              );
            })()}
          </div>

          {/* 選択ポップアップ（ドラッグ複数選択後） */}
          {showNonPopup && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 24, minWidth: 320, maxWidth: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#1e3a5f" }}>選択中の要素</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, minHeight: 40, border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                  {[...nonSelected].map(k => (
                    <span key={k} style={{ background: "#e0f2fe", color: "#0369a1", borderRadius: 4, padding: "2px 8px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                      {k}
                      <span style={{ cursor: "pointer", color: "#94a3b8" }} onClick={() => setNonSelected(prev => { const s = new Set(prev); s.delete(k); return s; })}>×</span>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button style={{ padding: "7px 18px", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
                    onClick={() => { setShowNonPopup(false); setNonSelected(new Set()); }}>キャンセル</button>
                  <button style={{ padding: "7px 18px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}
                    onClick={() => { setShowNonPopup(false); setEditingNonGroup(null); setShowNonCard(true); }}>確定</button>
                </div>
              </div>
            </div>
          )}

          {/* NONカードフォーム */}
          {showNonCard && (
            <NonCardForm
              selectedKeys={[...nonSelected]}
              editingGroup={editingNonGroup}
              photos={photos}
              spanNo={activeSpan}
              spanMembers={getSpanMembers()}
              otherUsedKeys={(nonPhotos || []).filter(n => n.spanNo === activeSpan && (!editingNonGroup || n.id !== editingNonGroup.id)).flatMap(n => n.elements)}
              onSave={handleNonSave}
              onDelete={handleNonDelete}
              onCancel={() => { setShowNonCard(false); setNonSelected(new Set()); setEditingNonGroup(null); }}
            />
          )}
        </div>
      ) : (
      <div style={s.cardGrid}>
        {filtered.length === 0
          ? <p style={{ color: "#94a3b8", fontSize: 13 }}>損傷データがありません</p>
          : filtered.map((d, i) => (
            <DamageCard key={d.id} d={d} index={i}
              photos={photos || {}}
              onUpdate={handleUpdate} onDelete={handleDelete}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragOver={dragOverIdx === i}
            />
          ))
        }
      </div>
      )}

      {/* 保存 */}
      <div style={{ textAlign: "right", marginTop: 16 }}>
        <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
          保存
        </button>
      </div>

      {showAddModal && (
        <AddDamageModal dxfSpans={dxfSpans} onAdd={handleAdd} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

const s = {
  tabBar:         { display: "flex", gap: 4, flexWrap: "wrap", borderBottom: "2px solid #e2e8f0", paddingBottom: 0 },
  tabBtn:         { padding: "6px 14px", border: "1px solid #e2e8f0", borderBottom: "none", borderRadius: "6px 6px 0 0", background: "#f1f5f9", cursor: "pointer", fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 6 },
  tabBtnActive:   { background: "#fff", color: "#1e3a5f", fontWeight: 700, border: "1px solid #1e3a5f", borderBottom: "none" },
  subTabBtn:      { padding: "4px 12px", border: "1px solid #e2e8f0", borderRadius: 6, background: "#f8fafc", cursor: "pointer", fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 },
  subTabBtnActive:{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #93c5fd", fontWeight: 600 },
  addViewBtn:     { padding: "4px 12px", border: "1px dashed #cbd5e1", borderRadius: 6, background: "transparent", cursor: "pointer", fontSize: 12, color: "#94a3b8" },
  tabCount:       { background: "#e2e8f0", borderRadius: 10, padding: "1px 6px", fontSize: 11 },
  cardGrid:       { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
  card:           { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, position: "relative", display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)" },
  photoPlaceholder:{ width: "100%", height: 200, background: "#e2e8f0", borderRadius: 6, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#94a3b8" },
  numBadge:       { display: "inline-block", background: "rgba(79,142,247,.15)", color: "#4f8ef7", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 },
  addedBadge:     { position: "absolute", top: 8, right: 36, background: "#d1fae5", color: "#065f46", fontSize: 10, padding: "2px 6px", borderRadius: 4 },
  fieldWrap:      { display: "flex", flexDirection: "column", gap: 2 },
  fieldLabel:     { fontSize: 11, color: "#64748b" },
  editSelect:     { padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, background: "#fff", width: "100%" },
  editInput:      { padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, width: "100%", boxSizing: "border-box" },
  iconBtn:        { background: "none", border: "1px solid #e2e8f0", borderRadius: 4, cursor: "pointer", fontSize: 12, padding: "2px 6px", color: "#475569" },
  statusBtn:       { padding: "2px 8px", fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 4, background: "#f1f5f9", color: "#64748b", cursor: "pointer" },
  statusBtnActive: { background: "#1e3a5f", color: "#fff", border: "1px solid #1e3a5f" },
  inspChkWrap:    { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 6, padding: "5px 8px" },
  inspChkLabel:   { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0369a1", cursor: "pointer" },
  inspChkSheet:   { fontSize: 11, fontWeight: 700, color: "#0e7490", background: "#cffafe", borderRadius: 4, padding: "1px 8px" },
  deleteBtn:      { position: "absolute", top: 8, right: 8, background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer" },
  saveBtn:        { padding: "8px 24px", fontSize: 14, background: "#1e3a5f", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600 },
  overlay:        { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 },
  modal:          { background: "#fff", borderRadius: 12, padding: 24, width: "90%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" },
  cancelBtn:      { background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, cursor: "pointer" },
  confirmBtn:     { background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};
