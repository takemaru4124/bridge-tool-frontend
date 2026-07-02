 import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import MemberList from "./components/MemberList";
import DamageList from "./components/DamageList";
import NumberingStep from "./components/NumberingStep";
import SituationPhotos from "./components/SituationPhotos";
import BridgeInfoForm from "./components/BridgeInfoForm";
import InspectionPhotos from "./components/InspectionPhotos";
import DxfEdit from "./components/DxfEdit";
import { exportDxf, exportCheckDxf } from "./utils/exportDxf";
import { buildInitialDamages } from "./utils/buildDamages";
import { findPhotoKey } from "./utils/numbering";

// カタカナ→ローマ字変換（Storageフォルダ名用）
const KANA_DIGRAPH = {
  "\u30AD\u30E3":"kya","\u30AD\u30E5":"kyu","\u30AD\u30E7":"kyo",
  "\u30B7\u30E3":"sha","\u30B7\u30E5":"shu","\u30B7\u30E7":"sho",
  "\u30C1\u30E3":"cha","\u30C1\u30E5":"chu","\u30C1\u30E7":"cho",
  "\u30CB\u30E3":"nya","\u30CB\u30E5":"nyu","\u30CB\u30E7":"nyo",
  "\u30D2\u30E3":"hya","\u30D2\u30E5":"hyu","\u30D2\u30E7":"hyo",
  "\u30DF\u30E3":"mya","\u30DF\u30E5":"myu","\u30DF\u30E7":"myo",
  "\u30EA\u30E3":"rya","\u30EA\u30E5":"ryu","\u30EA\u30E7":"ryo",
  "\u30AE\u30E3":"gya","\u30AE\u30E5":"gyu","\u30AE\u30E7":"gyo",
  "\u30B8\u30E3":"ja","\u30B8\u30E5":"ju","\u30B8\u30E7":"jo",
  "\u30D3\u30E3":"bya","\u30D3\u30E5":"byu","\u30D3\u30E7":"byo",
  "\u30D4\u30E3":"pya","\u30D4\u30E5":"pyu","\u30D4\u30E7":"pyo",
};
const KANA_SINGLE = {
  "\u30A2":"a","\u30A4":"i","\u30A6":"u","\u30A8":"e","\u30AA":"o",
  "\u30AB":"ka","\u30AD":"ki","\u30AF":"ku","\u30B1":"ke","\u30B3":"ko",
  "\u30B5":"sa","\u30B7":"shi","\u30B9":"su","\u30BB":"se","\u30BD":"so",
  "\u30BF":"ta","\u30C1":"chi","\u30C4":"tsu","\u30C6":"te","\u30C8":"to",
  "\u30CA":"na","\u30CB":"ni","\u30CC":"nu","\u30CD":"ne","\u30CE":"no",
  "\u30CF":"ha","\u30D2":"hi","\u30D5":"fu","\u30D8":"he","\u30DB":"ho",
  "\u30DE":"ma","\u30DF":"mi","\u30E0":"mu","\u30E1":"me","\u30E2":"mo",
  "\u30E4":"ya","\u30E6":"yu","\u30E8":"yo",
  "\u30E9":"ra","\u30EA":"ri","\u30EB":"ru","\u30EC":"re","\u30ED":"ro",
  "\u30EF":"wa","\u30F2":"o","\u30F3":"n",
  "\u30AC":"ga","\u30AE":"gi","\u30B0":"gu","\u30B2":"ge","\u30B4":"go",
  "\u30B6":"za","\u30B8":"ji","\u30BA":"zu","\u30BC":"ze","\u30BE":"zo",
  "\u30C0":"da","\u30C2":"ji","\u30C5":"zu","\u30C7":"de","\u30C9":"do",
  "\u30D0":"ba","\u30D3":"bi","\u30D6":"bu","\u30D9":"be","\u30DC":"bo",
  "\u30D1":"pa","\u30D4":"pi","\u30D7":"pu","\u30DA":"pe","\u30DD":"po",
  "\u30A1":"a","\u30A3":"i","\u30A5":"u","\u30A7":"e","\u30A9":"o",
  "\u30F4":"vu",
};
function kataToRomaji(kana) {
  if (!kana) return "";
  let out = "";
  let sokuon = false;
  for (let i = 0; i < kana.length; i++) {
    const two = kana.slice(i, i + 2);
    const one = kana[i];
    if (one === "\u30C3") { sokuon = true; continue; }       // ッ
    if (one === "\u30FC") continue;                            // ー（長音は省略）
    let r = "";
    if (KANA_DIGRAPH[two]) { r = KANA_DIGRAPH[two]; i++; }
    else if (KANA_SINGLE[one]) { r = KANA_SINGLE[one]; }
    else continue;                                              // カタカナ以外は無視
    if (sokuon && r) { out += r[0]; sokuon = false; }
    out += r;
  }
  return out;
}

const SUPABASE_URL = "https://plopsosvifjlozsjneqf.supabase.co";
const SUPABASE_KEY = "sb_publishable_l8ZNZi8hR2PLCs8elZXSYg_Q87eWL2w";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const API = "https://bridge-tool-api.onrender.com";

// 旧9系evalキー(s{径間}__p{頁})を新キー(s{径間}__{sheet}__p{頁})へ複製する移行。
// 旧キーはシート未区別のため9-1/9-2/10へ複製（既存値を失わない・冪等）。
function migrateEvals9(evals) {
  if (!evals || typeof evals !== "object") return evals || {};
  const next = { ...evals };
  Object.keys(evals).forEach(k => {
    const m = k.match(/^s(\d+)__p(\d+)$/);
    if (!m) return;
    ["その9-1", "その9-2", "その10"].forEach(sheet => {
      const nk = `s${m[1]}__${sheet}__p${m[2]}`;
      if (!(nk in next)) next[nk] = evals[k];
    });
  });
  return next;
}

// STEP7のシステム別評価 → 構成要素ごとの最悪値(C>B>A)を集約。
// 状況列(活荷重/地震/豪雨/その他×2)ごとに独立して最悪値を取る。空欄""は無視。
const KOSEI_OF_SYSTEM = {
  "床版・床組システム": "joubu",
  "主桁・主構システム": "joubu",
  "立体機能保持システム": "joubu",
  "支点位置保持システム": "kabu",
  "地表面位置保持システム": "kabu",
  "支点反力支持システム": "setsuzoku",
  "その9-1": "failsafe",
  "その9-2": "shinshuku",
};
const JOUKYOU_KEYS = ["katsu", "jishin", "gou", "sonotaJoukyou1", "sonotaJoukyou2"];
function aggregateKoseiEvals(evals) {
  const rank = { A: 1, B: 2, C: 3 };
  const out = {};
  const outKey = {}; // kosei -> jk -> 最悪値を生んだevalsキー(写真番号算出用)
  Object.entries(evals || {}).forEach(([key, ev]) => {
    const m = key.match(/^s\d+__(.+)__p\d+$/);
    if (!m) return;
    const kosei = KOSEI_OF_SYSTEM[m[1]];
    if (!kosei) return;
    if (!out[kosei]) out[kosei] = {};
    if (!outKey[kosei]) outKey[kosei] = {};
    JOUKYOU_KEYS.forEach(jk => {
      const v = ev && ev[jk];
      if ((rank[v] || 0) > (rank[out[kosei][jk]] || 0)) {
        out[kosei][jk] = v;
        outKey[kosei][jk] = key;
      }
    });
  });
  return { agg: out, aggKey: outKey };
}

// 集約値をperf_{構成要素}_{列}形へ整形。その他=その他1/2の最悪値。zentaiはSTEP7ソース無し。
function computePerfAuto(evals) {
  const { agg } = aggregateKoseiEvals(evals);
  const rank = { A: 1, B: 2, C: 3 };
  const worst = (a, b) => ((rank[a] || 0) >= (rank[b] || 0) ? (a || "") : (b || ""));
  const out = {};
  Object.entries(agg).forEach(([kosei, jv]) => {
    out[`perf_${kosei}_katsu`] = jv.katsu || "";
    out[`perf_${kosei}_jishin`] = jv.jishin || "";
    out[`perf_${kosei}_gou`] = jv.gou || "";
    out[`perf_${kosei}_sonota`] = worst(jv.sonotaJoukyou1, jv.sonotaJoukyou2);
  });
  return out;
}

// STEP8写真番号の自動集約。点検記録様式(seqMap=全通し)と道路橋記録様式(orangeMap=チェック済み通し)
// の両方を算出。評価がB/Cの構成要素×状況のみ、その構成要素配下でB/C評価の全ページに含まれる
// 該当写真番号を「すべて」カンマ区切りで集約。評価A・橋全体は対象外。
// 戻り値: { inspection:{kosei:{katsu,jishin,gou}}, chosho:{kosei:{katsu,jishin,gou}} }(値はカンマ区切り文字列)
const CHOSHO_SHEET_TABS = ["その8-1", "その8-2", "その9-1", "その9-2", "その10"];
const CHOSHO_SYSTEM_ORDER = ["床版・床組システム", "主桁・主構システム", "立体機能保持システム",
  "支点反力支持システム", "位置保持システム", "支点位置保持システム", "地表面位置保持システム"];
const CHOSHO_SYSTEM_NONE = "（システム未分類）";
const CHOSHO_PER_BLOCK = 4;
// InspectionPhotosと同一: 8系=s{span}__{system}, 9/10系=s{span}__{sheet}
function _evalGroupKey(it) {
  const sp = it.spanNo || 1;
  const sheet = it.sheet || "";
  const is89 = sheet === "その8-1" || sheet === "その8-2";
  return is89 ? `s${sp}__${it.system || CHOSHO_SYSTEM_NONE}` : `s${sp}__${sheet}`;
}
function computeChoshoPhotoNo(items, evals) {
  const list = (items || []).filter(it => !it.deleted);

  // 採番(seqMap=全通し / orangeMap=チェック済み・最大20)をInspectionPhotosと同順で再現
  const seqOfId = {};
  const orangeOfId = {};
  let seq = 0, orange = 0;
  CHOSHO_SHEET_TABS.forEach(sheet => {
    const sheetItems = list.filter(it => it.sheet === sheet);
    const gm = {};
    sheetItems.forEach(it => {
      const sp = it.spanNo || 1;
      const sys = it.system || CHOSHO_SYSTEM_NONE;
      const key = (sheet === "その8-1" || sheet === "その8-2") ? `s${sp}__${sys}` : `s${sp}`;
      if (!gm[key]) gm[key] = { spanNo: sp, system: sys, items: [] };
      gm[key].items.push(it);
    });
    const groups = Object.values(gm).sort((a, b) => {
      const ai = CHOSHO_SYSTEM_ORDER.indexOf(a.system); const aIdx = ai === -1 ? 99 : ai;
      const bi = CHOSHO_SYSTEM_ORDER.indexOf(b.system); const bIdx = bi === -1 ? 99 : bi;
      return aIdx !== bIdx ? aIdx - bIdx : a.spanNo - b.spanNo;
    });
    groups.forEach(g => {
      const sorted = [...g.items].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
      sorted.forEach(it => {
        seq += 1;
        seqOfId[it.id] = seq;
        if (it.chosho && orange < 20) { orange += 1; orangeOfId[it.id] = orange; }
      });
    });
  });

  // evalsキー(__p{page})ごとのpageItemsを構築(InspectionPhotosと同一の4枚分割)
  const pageItemsOfEvalKey = {};
  const gm2 = {};
  list.forEach(it => {
    const gk = _evalGroupKey(it);
    if (!gm2[gk]) gm2[gk] = [];
    gm2[gk].push(it);
  });
  Object.entries(gm2).forEach(([gkey, glist]) => {
    const sorted = [...glist].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    for (let i = 0; i < Math.max(sorted.length, 1); i += CHOSHO_PER_BLOCK) {
      const pi = Math.floor(i / CHOSHO_PER_BLOCK);
      pageItemsOfEvalKey[`${gkey}__p${pi}`] = sorted.slice(i, i + CHOSHO_PER_BLOCK);
    }
  });

  // 構成要素×状況ごとに、B/C評価を持つ全evalsキー(ページ)を収集
  const rank = { A: 1, B: 2, C: 3 };
  const bcKeysOf = {};
  Object.entries(evals || {}).forEach(([key, ev]) => {
    const m = key.match(/^s\d+__(.+)__p\d+$/);
    if (!m) return;
    const kosei = KOSEI_OF_SYSTEM[m[1]];
    if (!kosei) return;
    ["katsu", "jishin", "gou"].forEach(jk => {
      const v = ev && ev[jk];
      if (!(rank[v] >= 2)) return; // B/Cのみ
      if (!bcKeysOf[kosei]) bcKeysOf[kosei] = {};
      if (!bcKeysOf[kosei][jk]) bcKeysOf[kosei][jk] = [];
      bcKeysOf[kosei][jk].push(key);
    });
  });

  const inspection = {};
  const chosho = {};
  Object.entries(bcKeysOf).forEach(([kosei, jv]) => {
    inspection[kosei] = {};
    chosho[kosei] = {};
    ["katsu", "jishin", "gou"].forEach(jk => {
      const keys = jv[jk] || [];
      const seqNums = [];
      const orangeNums = [];
      keys.forEach(ek => {
        (pageItemsOfEvalKey[ek] || []).forEach(it => {
          if (seqOfId[it.id] != null && !seqNums.includes(seqOfId[it.id])) seqNums.push(seqOfId[it.id]);
          if (orangeOfId[it.id] != null && !orangeNums.includes(orangeOfId[it.id])) orangeNums.push(orangeOfId[it.id]);
        });
      });
      seqNums.sort((a, b) => a - b);
      orangeNums.sort((a, b) => a - b);
      if (seqNums.length) inspection[kosei][jk] = seqNums.join(",");
      if (orangeNums.length) chosho[kosei][jk] = orangeNums.join(",");
    });
  });

  // B/Cを1つも含まず、Aが1つ以上ある構成要素は、その配下の全写真を活荷重列(katsu)に集約
  // (空欄・"-"はA判定を妨げない。例: 伸縮装置=活A・地空・豪空 も対象)
  const { agg: koseiAggForA } = aggregateKoseiEvals(evals);
  Object.entries(koseiAggForA).forEach(([kosei, jv]) => {
    const _vals = [jv.katsu, jv.jishin, jv.gou];
    if (_vals.some(v => v === "B" || v === "C") || !_vals.some(v => v === "A")) return;
    const seqNums = [];
    const orangeNums = [];
    Object.entries(pageItemsOfEvalKey).forEach(([ek, pItems]) => {
      const m = ek.match(/^s\d+__(.+)__p\d+$/);
      if (!m || KOSEI_OF_SYSTEM[m[1]] !== kosei) return;
      pItems.forEach(it => {
        if (seqOfId[it.id] != null && !seqNums.includes(seqOfId[it.id])) seqNums.push(seqOfId[it.id]);
        if (orangeOfId[it.id] != null && !orangeNums.includes(orangeOfId[it.id])) orangeNums.push(orangeOfId[it.id]);
      });
    });
    seqNums.sort((a, b) => a - b);
    orangeNums.sort((a, b) => a - b);
    if (!inspection[kosei]) inspection[kosei] = {};
    if (!chosho[kosei]) chosho[kosei] = {};
    if (seqNums.length) inspection[kosei].katsu = seqNums.join(",");
    if (orangeNums.length) chosho[kosei].katsu = orangeNums.join(",");
  });

  return { inspection, chosho };
}

function MenuDropdown({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button style={styles.menuBtn} onClick={() => setOpen(!open)}>...</button>
      {open && (
        <div style={styles.dropdown}>
          <button style={styles.dropdownItem} onClick={() => { setOpen(false); onEdit(); }}>[編] 名称編集</button>
          <button style={{ ...styles.dropdownItem, color: "#ef4444" }} onClick={() => { setOpen(false); onDelete(); }}>[削] 削除</button>
        </div>
      )}
    </div>
  );
}

export default function BridgeInspectionTool() {
  const [view, setView] = useState("top");
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showFacilityModal, setShowFacilityModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newFacilityName, setNewFacilityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Excel取込
  const [bridgeData, setBridgeData] = useState(null);
  const [membersBySpan, setMembersBySpan] = useState([]);
  const [xlsFile, setXlsFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingInspection, setExportingInspection] = useState(false);
  const [exportingChosho, setExportingChosho] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // DXF取込
  const [dxfFile, setDxfFile] = useState(null);
  const [dxfImporting, setDxfImporting] = useState(false);
  const [dxfData, setDxfData] = useState(null);
  const [dxfError, setDxfError] = useState(null);
  const [dxfDirection, setDxfDirection] = useState("col");

  // 損傷データ（STEP6）
  const [damagesData, setDamagesData] = useState([]);

  // 写真データ（STEP1）
  const [photos, setPhotos] = useState({});
  const [situationPhotos, setSituationPhotos] = useState([]);
  const [situationPhotosSource, setSituationPhotosSource] = useState([]);
  const [inspectionItems, setInspectionItems] = useState([]);
  const [inspectionEvals, setInspectionEvals] = useState({});
  const [nonPhotos, setNonPhotos] = useState([]);
  const [inspectionForm, setInspectionForm] = useState({});
  const [numberingRule, setNumberingRule] = useState(1);
  const [numberingLabel, setNumberingLabel] = useState("写真");
  const [numberingSpanStartNums, setNumberingSpanStartNums] = useState({});
  const [numberingNonStartNums, setNumberingNonStartNums] = useState({});
  const [numberingViewOrder, setNumberingViewOrder] = useState([]);
  const [dxfWorkStatus, setDxfWorkStatus] = useState("done");
  const DEFAULT_MEMO_TEMPLATES = {
    normal:   "{部材名}に{損傷種類}が見られる。",
    repaired: "{部材名}に見られた{損傷種類}は補修済み。",
    none:     "{部材名}に{損傷種類}が見られない。",
  };
  const [memoTemplates, setMemoTemplates] = useState(DEFAULT_MEMO_TEMPLATES);

  // 写真をSupabase Storageへアップロードして公開URLを取得
  const uploadPhotosToStorage = async (files) => {
    if (!selectedFacility) { showToast("施設を選択してください", "error"); return; }
    showToast(`${files.length}枚をアップロード中...`);
    const newPhotos = { ...photos };
    let ok = 0, ng = 0;
    const BATCH = 5;
    for (let i = 0; i < files.length; i += BATCH) {
      await Promise.all(files.slice(i, i + BATCH).map(async f => {
        const key = f.name.replace(/\.[^.]+$/, "").replace(/\s/g, "_");
        // フォルダ名：{業務作成年}_{フリガナのローマ字}（例：2026_yokonehashi）
        const year = selectedProject?.createdAt ? new Date(selectedProject.createdAt).getFullYear() : new Date().getFullYear();
        const roma = kataToRomaji((bridgeData || {})["\u30D5\u30EA\u30AC\u30CA"] || "");
        const folder = `${year}_${roma || selectedFacility.id}`;
        const path = `${folder}/${f.name.replace(/\s/g, "_")}`;
        try {
          const { error } = await supabase.storage.from("photos").upload(path, f, { upsert: true });
          if (error) throw error;
          const { data } = supabase.storage.from("photos").getPublicUrl(path);
          newPhotos[key] = { name: f.name, url: data.publicUrl };
          ok++;
        } catch {
          // 失敗時は従来通り画面内のみで使用（保存されない）
          newPhotos[key] = { name: f.name, url: URL.createObjectURL(f) };
          ng++;
        }
      }));
    }
    setPhotos(newPhotos);
    // アップロード完了後すぐにphotos_metaを保存（stale closure回避のため明示的に渡す）
    const httpPhotos = Object.fromEntries(
      Object.entries(newPhotos).filter(([, v]) => (v.url || "").startsWith("http"))
    );
    await handleSaveAll({ photos_meta: httpPhotos });
    showToast(
      ng === 0
        ? `${ok}枚アップロード完了（計${Object.keys(newPhotos).length}枚）`
        : `${ok}枚成功 / ${ng}枚失敗（失敗分はリロードで消えます）`,
      ng ? "error" : "success"
    );
  };

  // 保存：画面上の全データをbridge_dataにまとめて保存（Excel等と同じ全データ共通保存）
  const handleSaveAll = async (overrides = {}) => {
    if (!selectedFacility) { showToast("施設が選択されていません", "error"); throw new Error("施設が選択されていません"); }
    const fullBd = {
      ...(bridgeData || {}),
      members_by_span: membersBySpan,
      damages_data: damagesData,
      situation_photos: situationPhotos,
      inspection_items: inspectionItems,
      inspection_evals: inspectionEvals,
      non_photos: nonPhotos,
      inspection_form: inspectionForm,
      numbering_rule: numberingRule,
      numbering_label: numberingLabel,
      numbering_span_start_nums: numberingSpanStartNums,
      numbering_non_start_nums: numberingNonStartNums,
      numbering_view_order: numberingViewOrder,
      memo_templates: memoTemplates,
      dxf_work_status: dxfWorkStatus,
      photos_meta: Object.fromEntries(
        Object.entries(photos || {}).filter(([, v]) => (v.url || "").startsWith("http"))
      ),
      ...overrides,
    };
    setBridgeData(fullBd);
    const { error } = await supabase.from("facilities").update({ bridge_data: fullBd }).eq("id", selectedFacility.id);
    if (error) { showToast("保存に失敗しました: " + error.message, "error"); throw new Error(error.message); }
    showToast("保存しました");
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadProjects = async () => {
    setLoading(true);
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects((data || []).map(p => ({ ...p, createdAt: p.created_at })));
    setLoading(false);
  };

  const loadFacilities = async (project) => {
    const { data } = await supabase.from("facilities").select("*").eq("project_id", project.id).order("created_at", { ascending: false });
    setFacilities(data || []);
  };

  useEffect(() => { loadProjects(); }, []);

  const addProject = async () => {
    if (!newProjectName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("projects").insert({ name: newProjectName.trim() });
    if (error) { showToast("追加エラー: " + error.message, "error"); setSaving(false); return; }
    setNewProjectName("");
    setShowProjectModal(false);
    setSaving(false);
    showToast("業務を追加しました");
    await loadProjects();
  };

  const addFacility = async () => {
    if (!newFacilityName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("facilities").insert({ name: newFacilityName.trim(), project_id: selectedProject.id });
    if (error) { showToast("追加エラー: " + error.message, "error"); setSaving(false); return; }
    setNewFacilityName("");
    setShowFacilityModal(false);
    setSaving(false);
    showToast("施設を追加しました");
    await loadFacilities(selectedProject);
  };

  const saveEdit = async () => {
    if (!editTarget?.name?.trim()) return;
    setSaving(true);
    const table = editTarget.type === "project" ? "projects" : "facilities";
    const { error } = await supabase.from(table).update({ name: editTarget.name }).eq("id", editTarget.item.id);
    if (error) { showToast("更新エラー: " + error.message, "error"); setSaving(false); return; }
    setSaving(false);
    setEditTarget(null);
    showToast("更新しました");
    if (editTarget.type === "project") await loadProjects();
    else await loadFacilities(selectedProject);
  };

  const deleteItem = async (type, item) => {
    const table = type === "project" ? "projects" : "facilities";
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    if (error) { showToast("削除エラー: " + error.message, "error"); return; }
    showToast("削除しました");
    if (type === "project") await loadProjects();
    else await loadFacilities(selectedProject);
  };

  const selectProject = async (project) => {
    setSelectedProject(project);
    await loadFacilities(project);
    setView("facilities");
  };

  const selectFacility = async (facility) => {
    setSelectedFacility(facility);
    setXlsFile(null);
    setDxfFile(null);
    setDxfError(null);
    setView("work");

    // Supabaseから最新データを取得
    const { data } = await supabase
      .from("facilities")
      .select("*")
      .eq("id", facility.id)
      .single();

    const bd = data?.bridge_data || null;
    if (bd) {
      setBridgeData(bd);
      setMembersBySpan(bd.members_by_span || []);
      setDamagesData(bd.damages_data || []);
      setSituationPhotos(bd.situation_photos || []);
      setSituationPhotosSource(bd.situation_photos_source || []);
      setInspectionItems(bd.inspection_items || []);
      setInspectionEvals(migrateEvals9(bd.inspection_evals || {}));
      setNonPhotos(bd.non_photos || []);
      setInspectionForm(bd.inspection_form || {});
      setPhotos(bd.photos_meta ? bd.photos_meta : {});
      // 採番設定・メモテンプレート・DXF作業状態を復元
      setNumberingRule(bd.numbering_rule || 1);
      setNumberingLabel(bd.numbering_label || "写真");
      setNumberingSpanStartNums(bd.numbering_span_start_nums || {});
      setNumberingNonStartNums(bd.numbering_non_start_nums || {});
      setMemoTemplates(bd.memo_templates || DEFAULT_MEMO_TEMPLATES);
      setDxfWorkStatus(bd.dxf_work_status || "done");
      // DXFデータを復元
      if (bd.dxf_spans) {
        setDxfData({
          groups: bd.dxf_groups || [],
          element_numbers: bd.element_numbers || {},
          dxf_spans: bd.dxf_spans,
          raw_text: bd.dxf_raw_text || null,
        });
        setDxfDirection(bd.dxf_direction || "col");
        // viewOrderを復元（未保存の場合はdxf_spansから生成）
        const savedViewOrder = bd.numbering_view_order;
        if (savedViewOrder && savedViewOrder.length > 0) {
          setNumberingViewOrder(savedViewOrder);
        } else {
          const initialViewOrder = bd.dxf_spans.flatMap(s => s.views || []);
          setNumberingViewOrder(initialViewOrder);
        }
      } else {
        setDxfData(null);
        setDxfDirection("col");
      }
    } else {
      setBridgeData(null);
      setMembersBySpan([]);
      setDxfData(null);
      setDxfDirection("col");
      // 前の施設のデータが残らないよう初期化
      setDamagesData([]);
      setSituationPhotos([]);
      setSituationPhotosSource([]);
      setInspectionItems([]);
      setInspectionEvals({});
      setNonPhotos([]);
      setInspectionForm({});
      setPhotos({});
      setNumberingViewOrder([]);
      // 採番設定・メモテンプレート・DXF作業状態を初期化
      setNumberingRule(1);
      setNumberingLabel("写真");
      setNumberingSpanStartNums({});
      setNumberingNonStartNums({});
      setMemoTemplates(DEFAULT_MEMO_TEMPLATES);
      setDxfWorkStatus("done");
    }
  };

  const goBack = () => {
    if (view === "work") setView("facilities");
    else if (view === "facilities") { setView("top"); loadProjects(); }
  };

  // Excel取込
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setXlsFile(f);
    // ※bridgeDataはリセットしない（DXFと独立して管理）
  };

  // DXF取込
  const handleDxfImport = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".dxf")) {
      setDxfError(".dxf ファイルを選択してください");
      return;
    }
    setDxfFile(file);
    setDxfError(null);
    setDxfImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("direction", dxfDirection);
      const res = await fetch(`${API}/extract-dxf`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setDxfData(json);
      // viewOrderを初期化（dxf_spansの視点順）
      if (json.dxf_spans) {
        const initialViewOrder = json.dxf_spans.flatMap(s => s.views || []);
        setNumberingViewOrder(initialViewOrder);
      }

      // DXFから損傷データを生成（再アップ時もorigPhotoLabelをDXFから再取得）
      const freshDamages = buildInitialDamages(json.groups, json.dxf_spans);
      const mergedDamages = (damagesData && damagesData.length > 0)
        ? damagesData.map(d => {
            const fresh = freshDamages.find(f =>
              f.symbol === d.symbol &&
              f.elementNoCurrent === d.elementNoCurrent &&
              f.dmgType === d.dmgType &&
              f.prevDeg === d.prevDeg &&
              f.spanNo === d.spanNo
            );
            return fresh ? { ...d, origPhotoLabel: fresh.origPhotoLabel, photoFile: fresh.photoFile } : d;
          })
        : freshDamages;
      const mergedWithStatus = mergedDamages.map(d => ({ ...d, workStatus: dxfWorkStatus }));
      setDamagesData(mergedWithStatus);
      const currentBd = bridgeData || {};
      const updatedBd = {
        ...currentBd,
        dxf_spans: json.dxf_spans,
        element_numbers: json.element_numbers,
        dxf_groups: json.groups,
        dxf_direction: dxfDirection,
        dxf_file_name: file.name,
        dxf_raw_text: json.raw_text || null,
        damages_data: mergedWithStatus,
        dxf_work_status: dxfWorkStatus,
      };
      setBridgeData(updatedBd);
      await supabase.from("facilities").update({ bridge_data: updatedBd }).eq("id", selectedFacility.id);
      showToast("DXF取込完了");
    } catch (e) {
      setDxfError("DXF取込エラー: " + e.message);
      showToast("DXF取込エラー: " + e.message, "error");
    } finally {
      setDxfImporting(false);
    }
  };

  const handleImport = async () => {
    if (!xlsFile) return;
    setImporting(true);
    try {
      const form1 = new FormData();
      form1.append("file", xlsFile);
      const res1 = await fetch(`${API}/parse-excel`, { method: "POST", body: form1 });
      const json1 = await res1.json();
      if (json1.status !== "ok") { showToast("取込エラー", "error"); setImporting(false); return; }
      const form2 = new FormData();
      form2.append("file", xlsFile);
      const res2 = await fetch(`${API}/extract-members`, { method: "POST", body: form2 });
      const json2 = await res2.json();
      let sitPhotos = [];
      try {
        const form3 = new FormData();
        form3.append("file", xlsFile);
        const res3 = await fetch(`${API}/extract-situation-photos`, { method: "POST", body: form3 });
        const json3 = await res3.json();
        sitPhotos = json3.situation_photos || [];
      } catch {
        // 失敗しても取込続行
      }
      // 既存のDXFデータを保持しつつExcelデータをマージ
      const newBridgeData = {
        ...(bridgeData || {}),
        ...json1.data,
        members_by_span: json2.spans || [],
        prev_summary: json2.prev_summary || {},
        situation_photos_source: sitPhotos,
      };
      setBridgeData(newBridgeData);
      setMembersBySpan(json2.spans || []);
      setSituationPhotosSource(sitPhotos);
      await supabase.from("facilities").update({ bridge_data: newBridgeData }).eq("id", selectedFacility.id);
      showToast("取込完了");
    } catch {
      showToast("APIに接続できません（start_api.batを起動してください）", "error");
    }
    setImporting(false);
  };

  const handleImportSituationExcel = async (file) => {
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/extract-situation-photos-list`, { method: "POST", body: form });
      const json = await res.json();
      if (json.status !== "ok") { showToast("取込エラー", "error"); return; }
      const list = json.situation_photos || [];
      const adopted = list.map((p, i) => {
        const key = findPhotoKey(p.photoFileRaw || "", photos);
        return { photoNum: i + 1, spanNo: p.spanNo, memo: p.memo || "", assignedKey: key || "" };
      });
      setSituationPhotos(adopted);
      const newBd = { ...(bridgeData || {}), situation_photos: adopted };
      setBridgeData(newBd);
      await supabase.from("facilities").update({ bridge_data: newBd }).eq("id", selectedFacility.id);
      showToast("Excel取込完了");
    } catch {
      showToast("APIに接続できません（start_api.batを起動してください）", "error");
    }
  };

  const handleExport = async () => {
    if (!bridgeData) { showToast("出力するデータがありません", "error"); return; }
    setExporting(true);
    try {
      // 写真をbase64に変換（photosステートから直接取得）
      const photosBase64 = {};
      await Promise.all(Object.entries(photos || {}).map(async ([key, meta]) => {
        try {
          const resp = await fetch(meta.url);
          const blob = await resp.blob();
          await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = e => { photosBase64[key] = e.target.result; res(); };
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });
        } catch(e) { /* 取得失敗は無視 */ }
      }));

      // damages_dataのphotoFileからassignedKeyを解決
      const resolvedDamages = (bridgeData.damages_data || []).map(d => {
        if (!d.photoFile) return d;
        const key = d.photoFile.replace(/\.[^.]+$/, "").replace(/\s/g, "_");
        return { ...d, assignedKey: photosBase64[key] ? key : "" };
      });

      // NON写真のphotoFileは既にphotosキー。base64に存在するもののみ有効化
      const resolvedNonPhotos = (nonPhotos || []).map(n => {
        if (!n.photoFile) return n;
        return { ...n, photoFile: photosBase64[n.photoFile] ? n.photoFile : "" };
      });

      const exportData = { ...bridgeData, damages_data: resolvedDamages, non_photos: resolvedNonPhotos, photos_base64: photosBase64, memo_templates: memoTemplates, inspection_form: inspectionForm };
      const res = await fetch(`${API}/export-from-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportData)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast("出力エラー: " + (err.detail || res.status), "error");
        setExporting(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bridgeData?.橋梁名 || "調書"}_データ記録様式.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("データ記録様式を出力しました");
    } catch {
      showToast("APIに接続できません", "error");
    }
    setExporting(false);
  };

  const handleExportChosho = async () => {
    setExportingChosho(true);
    try {
      // オレンジ写真(チェック済み)のみ対象にphotoキーを解決
      // カードと同じ現state(inspectionItems)を使う（photoFile一致を保証）
      const savedItems = inspectionItems || [];
      const neededKeys = new Set();
      const keyByItem = {};
      savedItems.forEach(it => {
        if (it.chosho && it.photoFile) {
          const key = findPhotoKey(it.photoFile, photos);
          if (key && photos[key]) { neededKeys.add(key); keyByItem[it.id] = key; }
        }
      });
      // 様式-1 全景写真（STEP5でチェックした1枚）
      let zenkeiKey = "";
      const zenkeiSp = (situationPhotos || []).find(sp => sp.zenkei && sp.assignedKey);
      if (zenkeiSp && photos[zenkeiSp.assignedKey]) {
        zenkeiKey = zenkeiSp.assignedKey;
        neededKeys.add(zenkeiKey);
      }
      // 必要な画像のみbase64化
      const photosBase64 = {};
      await Promise.all([...neededKeys].map(async (key) => {
        try {
          const resp = await fetch(photos[key].url);
          const blob = await resp.blob();
          await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = e => { photosBase64[key] = e.target.result; res(); };
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });
        } catch (e) { /* 取得失敗は無視 */ }
      }));
      // オレンジ写真にchoshoKeyを付与
      const resolvedItems = savedItems.map(it => {
        const key = keyByItem[it.id];
        return (key && photosBase64[key]) ? { ...it, choshoKey: key } : it;
      });
      const exportData = { ...(bridgeData || {}), inspection_form: inspectionForm, inspection_items: resolvedItems, photos_base64: photosBase64, zenkei_key: (zenkeiKey && photosBase64[zenkeiKey]) ? zenkeiKey : "" };
      const res = await fetch(`${API}/export-chosho`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportData)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast("出力エラー: " + (err.detail || res.status), "error");
        setExportingChosho(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${[bridgeData?.路線名, bridgeData?.橋梁名].filter(Boolean).join("_") || "道路橋記録様式"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("道路橋記録様式を出力しました");
    } catch {
      showToast("APIに接続できません", "error");
    }
    setExportingChosho(false);
  };

  const handleExportInspectionFormat = async () => {
    if (!bridgeData) { showToast("出力するデータがありません", "error"); return; }
    setExportingInspection(true);
    try {
      // 写真をbase64に変換（photosステートから直接取得）
      const photosBase64 = {};
      await Promise.all(Object.entries(photos || {}).map(async ([key, meta]) => {
        try {
          const resp = await fetch(meta.url);
          const blob = await resp.blob();
          await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = e => { photosBase64[key] = e.target.result; res(); };
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });
        } catch(e) { /* 取得失敗は無視 */ }
      }));

      const exportData = { ...bridgeData,
        inspection_items: inspectionItems,
        inspection_evals: inspectionEvals,
      non_photos: nonPhotos,
      inspection_form: inspectionForm,
        photos_base64: photosBase64 };
      const res = await fetch(`${API}/export-inspection-format`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportData)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast("出力エラー: " + (err.detail || res.status), "error");
        setExportingInspection(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bridgeData?.橋梁名 || "調書"}_点検記録様式.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("点検記録様式を出力しました");
    } catch {
      showToast("APIに接続できません", "error");
    }
    setExportingInspection(false);
  };

  const fields = bridgeData ? [
    ["橋梁名", bridgeData.橋梁名],
    ["フリガナ", bridgeData.フリガナ],
    ["路線名", bridgeData.路線名],
    ["管理者", bridgeData.管理者],
    ["所在地", bridgeData.所在地],
    ["橋長(m)", bridgeData.橋長],
    ["径間数", bridgeData.径間数],
    ["上部構造形式", bridgeData.上部構造形式],
    ["完成年", `${bridgeData.完成年号}${bridgeData.完成年}年${bridgeData.完成月}月`],
  ] : [];

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          {view !== "top" && (
            <button style={styles.backBtn} onClick={goBack}>← 戻る</button>
          )}
          <span style={styles.headerTitle}>
            {view === "top" && "橋梁点検ツール"}
            {view === "facilities" && selectedProject?.name}
            {view === "work" && selectedFacility?.name}
          </span>
          {view === "facilities" && <span style={styles.breadcrumb}>業務 / {selectedProject?.name}</span>}
          {view === "work" && <span style={styles.breadcrumb}>{selectedProject?.name} / {selectedFacility?.name}</span>}
        </div>
        {view !== "top" && (
          <button style={styles.homeBtn} onClick={() => { setView("top"); loadProjects(); }}>[Home] トップ</button>
        )}
      </header>

      <main style={styles.main}>
        {loading && view === "top" && <div style={styles.empty}><p style={styles.emptyText}>読み込み中...</p></div>}

        {/* 業務一覧 */}
        {!loading && view === "top" && (
          <div>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>業務一覧</h2>
              <button style={styles.addBtn} onClick={() => setShowProjectModal(true)}>＋ 業務を追加</button>
            </div>
            {projects.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}></div>
                <p style={styles.emptyText}>業務がまだありません</p>
              </div>
            ) : (
              <div style={styles.cardGrid}>
                {projects.map((p) => (
                  <div key={p.id} style={styles.card} onClick={() => selectProject(p)}>
                    <div style={styles.cardIcon}></div>
                    <div style={styles.cardBody}>
                      <div style={styles.cardName}>{p.name}</div>
                      <div style={styles.cardDate}>作成日: {new Date(p.created_at).toLocaleDateString("ja-JP")}</div>
                    </div>
                    <MenuDropdown
                      onEdit={() => setEditTarget({ type: "project", item: p, name: p.name })}
                      onDelete={() => deleteItem("project", p)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 施設一覧 */}
        {view === "facilities" && (
          <div>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>施設一覧</h2>
              <button style={styles.addBtn} onClick={() => setShowFacilityModal(true)}>＋ 施設を追加</button>
            </div>
            {facilities.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}></div>
                <p style={styles.emptyText}>施設がまだありません</p>
              </div>
            ) : (
              <div style={styles.cardGrid}>
                {facilities.map((f) => (
                  <div key={f.id} style={styles.card} onClick={() => selectFacility(f)}>
                    <div style={styles.cardIcon}></div>
                    <div style={styles.cardBody}>
                      <div style={styles.cardName}>{f.name}</div>
                    </div>
                    <MenuDropdown
                      onEdit={() => setEditTarget({ type: "facility", item: f, name: f.name })}
                      onDelete={() => deleteItem("facility", f)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 施設詳細（作業画面）*/}
        {view === "work" && (
          <div style={styles.workLayout}>
            <div style={styles.sidebar}>
              {[
                { step: 1, label: "橋梁情報",   sub: "調書・DXF・写真",       ready: true       },
                { step: 2, label: "部材リスト", sub: "部材の確認・編集",       ready: !!dxfData || (membersBySpan && membersBySpan.length > 0)  },
                { step: 3, label: "採番設定",   sub: "写真番号の採番",         ready: !!dxfData  },
                { step: 4, label: "DXF編集",   sub: "図面の編集",             ready: !!dxfData  },
                { step: 5, label: "現地状況写真", sub: "現地写真の確認",       ready: true       },
                { step: 6, label: "損傷リスト", sub: "損傷の確認・編集",       ready: !!dxfData  },
                { step: 7, label: "部材群毎の性能の評価結果", sub: "点検記録様式の写真", ready: !!dxfData },
                { step: 8, label: "確認・出力", sub: "内容確認と調書出力",     ready: true       },
              ].map(({ step, label, sub, ready }) => (
                <div
                  key={step}
                  style={{ ...styles.stepItem, ...(currentStep === step ? styles.stepItemActive : {}), ...(!ready ? styles.stepItemDisabled : {}) }}
                  onClick={() => ready && setCurrentStep(step)}
                >
                  <div style={{ ...styles.stepNum, ...(currentStep === step ? styles.stepNumActive : {}), ...(!ready ? styles.stepNumDisabled : {}) }}>{step}</div>
                  <div>
                    <div style={{ ...styles.stepLabel, ...(!ready ? { color: "#cbd5e1" } : {}), ...(currentStep === step ? { color: "#1e3a5f", fontWeight: 700 } : {}) }}>{label}</div>
                    <div style={{ ...styles.stepSub, ...(!ready ? { color: "#e2e8f0" } : {}) }}>{ready ? sub : "準備中"}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={styles.stepContent}>
              {currentStep === 1 && (
                <div>
                  {/* 点検調書（任意） */}
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>点検調書の取込（任意）</h3>
                    <div style={styles.importRow}>
                      <input type="file" accept=".xls,.xlsx" onChange={handleFileChange} style={styles.fileInput} />
                      <button style={styles.importBtn} onClick={handleImport} disabled={!xlsFile || importing}>
                        {importing ? "取込中..." : " 取込"}
                      </button>
                    </div>
                  </div>

                  {bridgeData && (
                    <div style={styles.section}>
                      <h3 style={styles.sectionTitle}>橋梁情報</h3>
                      <div style={styles.dataTable}>
                        {fields.map(([label, val]) => (
                          <div key={label} style={styles.dataRow}>
                            <span style={styles.dataLabel}>{label}</span>
                            <span style={styles.dataValue}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* DXFアップロード（必須） */}
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>損傷図DXFの取込</h3>

                    {/* DXF種別選択 */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      {[{ val: "done", label: "①完了DXF" }, { val: "todo", label: "②未作業DXF" }].map(({ val, label }) => (
                        <button key={val}
                          style={{ padding: "6px 16px", fontSize: 13, fontWeight: 700, borderRadius: 6, cursor: "pointer",
                            background: dxfWorkStatus === val ? "#1e3a5f" : "#f1f5f9",
                            color: dxfWorkStatus === val ? "#fff" : "#475569",
                            border: dxfWorkStatus === val ? "2px solid #1e3a5f" : "2px solid #e2e8f0" }}
                          onClick={() => setDxfWorkStatus(val)}>{label}</button>
                      ))}
                    </div>

                    {/* 方向選択 */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#64748b" }}>解析方向：</span>
                      {[
                        { val: "col", label: "列方向（縦並び）" },
                        { val: "row", label: "行方向（横並び）" },
                      ].map(({ val, label }) => (
                        <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                          <input
                            type="radio"
                            name="dxfDirection"
                            value={val}
                            checked={dxfDirection === val}
                            onChange={() => setDxfDirection(val)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>

                    <div style={styles.importRow}>
                      <label style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "8px 16px", borderRadius: 8, cursor: dxfImporting ? "not-allowed" : "pointer",
                        background: dxfImporting ? "#94a3b8" : "#1e3a5f", color: "#fff", border: "none",
                        fontSize: 14, whiteSpace: "nowrap"
                      }}>
                        {dxfImporting ? "解析中..." : (dxfData ? " 再取込" : " DXFを選択")}
                        <input
                          type="file"
                          accept=".dxf"
                          style={{ display: "none" }}
                          disabled={dxfImporting}
                          onChange={e => { if (e.target.files[0]) handleDxfImport(e.target.files[0]); }}
                        />
                      </label>
                      {dxfFile && !dxfImporting && !dxfError && (
                        <span style={{ fontSize: 13, color: "#64748b" }}>{dxfFile.name}</span>
                      )}
                    </div>

                    {/* エラー表示 */}
                    {dxfError && (
                      <div style={{ marginTop: 8, padding: "8px 12px", background: "#fef2f2",
                        border: "1px solid #fca5a5", borderRadius: 6, fontSize: 13, color: "#dc2626" }}>
                        {dxfError}
                      </div>
                    )}

                    {/* 取込成功 */}
                    {dxfData && !dxfImporting && (
                      <div style={{ marginTop: 8, padding: "8px 12px", background: "#f0fdf4",
                        border: "1px solid #86efac", borderRadius: 6, fontSize: 13, color: "#16a34a" }}>
                        取込完了 — 視点グループ: {dxfData.groups ? dxfData.groups.length : 0}件 ／
                        部材種別: {dxfData.element_numbers ? Object.keys(dxfData.element_numbers).length : 0}種
                      </div>
                    )}
                  </div>

                  {/* 写真アップロード */}
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>写真のアップロード</h3>
                    <div
                      style={{
                        border: "2px dashed #cbd5e1", borderRadius: 10, padding: 24,
                        textAlign: "center", cursor: "pointer", background: "#f8fafc",
                      }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={async e => {
                        e.preventDefault();
                        const files = Array.from(e.dataTransfer.files).filter(f => /\.(jpg|jpeg|png)$/i.test(f.name));
                        await uploadPhotosToStorage(files);
                      }}
                      onClick={() => document.getElementById("photoUploadInput").click()}
                    >
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                      <div style={{ fontSize: 13, color: "#64748b" }}>フォルダをドロップ、またはクリックしてフォルダを選択</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>フォルダ内のJPG / PNG をすべて取り込みます</div>
                    </div>
                    <input
                      id="photoUploadInput"
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      multiple
                      webkitdirectory=""
                      style={{ display: "none" }}
                      onChange={async e => {
                        const files = Array.from(e.target.files).filter(f => /\.(jpg|jpeg|png)$/i.test(f.name));
                        e.target.value = "";
                        await uploadPhotosToStorage(files);
                      }}
                    />
                    {Object.keys(photos).length > 0 && (
                      <div style={{ marginTop: 10, fontSize: 13, color: "#16a34a" }}>
                        {Object.keys(photos).length}枚アップロード済
                        <button
                          style={{ marginLeft: 12, fontSize: 11, background: "none", border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 8px", cursor: "pointer", color: "#ef4444" }}
                          onClick={() => { if (window.confirm("写真をすべてクリアしますか？")) setPhotos({}); }}
                        >クリア</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {currentStep === 2 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>部材リスト</h3>
                  {!dxfData && !(membersBySpan && membersBySpan.length > 0) ? (
                    <p style={{ color: "#94a3b8", fontSize: 14 }}>STEP1でDXFまたは前回調書Excelを取り込んでください。</p>
                  ) : (
                    <MemberList
                      membersBySpan={membersBySpan}
                      dxfElementNumbers={dxfData?.element_numbers || []}
                      dxfSpans={dxfData?.dxf_spans || null}
                      onUpdate={async (updatedSpans) => {
                        setMembersBySpan(updatedSpans);
                        await handleSaveAll({ members_by_span: updatedSpans });
                      }}
                    />
                  )}
                </div>
              )}
              {currentStep === 3 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>採番設定</h3>
                  {!dxfData ? (
                    <p style={{ color: "#94a3b8", fontSize: 14 }}>STEP1でDXFを取り込んでください。</p>
                  ) : (
                    <NumberingStep
                      damages={damagesData}
                      dxfSpans={dxfData.dxf_spans}
                      rule={numberingRule}
                      photoLabel={numberingLabel}
                      spanStartNums={numberingSpanStartNums}
                      nonStartNums={numberingNonStartNums}
                      nonPhotos={nonPhotos}
                      viewOrder={numberingViewOrder}
                      onRuleChange={setNumberingRule}
                      onPhotoLabelChange={setNumberingLabel}
                      onSpanStartNumsChange={setNumberingSpanStartNums}
                      onNonStartNumsChange={setNumberingNonStartNums}
                      onViewOrderChange={setNumberingViewOrder}
                      memoTemplates={memoTemplates}
                      onMemoTemplatesChange={setMemoTemplates}
                      onUpdate={async (updatedDamages) => {
                        setDamagesData(updatedDamages);
                        await handleSaveAll({ damages_data: updatedDamages });
                      }}
                      onUpdateNonPhotos={async (updatedNon) => {
                        setNonPhotos(updatedNon);
                        await handleSaveAll({ non_photos: updatedNon });
                      }}
                    />
                  )}
                </div>
              )}
              {currentStep === 4 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>DXF確認</h3>
                  <DxfEdit dxfData={dxfData} />
                </div>
              )}
              {currentStep === 5 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>現地状況写真</h3>
                  <SituationPhotos
                    situationPhotos={situationPhotos}
                    sourcePhotos={situationPhotosSource}
                    photos={photos}
                    numberingLabel={numberingLabel}
                    onUpdate={(updated) => setSituationPhotos(updated)}
                    onImportExcel={handleImportSituationExcel}
                    onSave={async () => await handleSaveAll({ situation_photos: situationPhotos })}
                  />
                </div>
              )}
              {currentStep === 6 && (
                <div style={styles.section}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>損傷リスト</h3>
                    {dxfData && (
                      <div style={{ display: "flex", gap: 8 }}>
                      <button
                        style={{ fontSize: 12, background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: "#1d4ed8" }}
                        onClick={() => exportCheckDxf({
                          rawText: dxfData.raw_text,
                          dxfFileName: dxfFile?.name || 'output.dxf',
                          damagesData: damagesData || [],
                        })}
                      >
                        取込確認DXFを出力
                      </button>
                      <button
                        style={{ fontSize: 12, background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: "#ef4444" }}
                        onClick={async () => {
                          if (!window.confirm("損傷データをDXFの初期状態に戻しますか？\n採番・編集内容はすべて失われます。")) return;
                          const fresh = buildInitialDamages(dxfData.groups, dxfData.dxf_spans);
                          setDamagesData(fresh);
                          const updatedBridgeData = { ...(bridgeData || {}), damages_data: fresh };
                          setBridgeData(updatedBridgeData);
                          await supabase.from("facilities").update({ bridge_data: updatedBridgeData }).eq("id", selectedFacility.id);
                          showToast("損傷データをリセットしました");
                        }}
                      >
                        DXFからリセット
                      </button>
                      </div>
                    )}
                  </div>
                  {!dxfData ? (
                    <p style={{ color: "#94a3b8", fontSize: 14 }}>STEP1でDXFを取り込んでください。</p>
                  ) : (
                    <DamageList
                      dxfGroups={dxfData.groups}
                      dxfSpans={dxfData.dxf_spans}
                      damagesData={damagesData}
                      photos={photos}
                      membersBySpan={membersBySpan}
                      nonPhotos={nonPhotos}
                      numberingRule={numberingRule}
                      numberingLabel={numberingLabel}
                      numberingSpanStartNums={numberingSpanStartNums}
                      numberingNonStartNums={numberingNonStartNums}
                      numberingViewOrder={numberingViewOrder}
                      onRunNumbering={async ({ damages: nd, nonPhotos: nn }) => {
                        setDamagesData(nd);
                        setNonPhotos(nn);
                        await handleSaveAll({ damages_data: nd, non_photos: nn });
                      }}
                      onNonPhotosUpdate={(updated) => setNonPhotos(updated)}
                      onUpdate={async (updatedDamages) => {
                        setDamagesData(updatedDamages);
                        await handleSaveAll({ damages_data: updatedDamages, non_photos: nonPhotos });
                      }}
                      onChangeUnsaved={(updatedDamages) => {
                        setDamagesData(updatedDamages);
                      }}
                    />
                  )}
                </div>
              )}
              {currentStep === 7 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>部材群毎の性能の評価結果</h3>
                  {!dxfData ? (
                    <p style={{ color: "#94a3b8", fontSize: 14 }}>STEP1でDXFを取り込んでください。</p>
                  ) : (
                    <InspectionPhotos
                      items={inspectionItems}
                      evals={inspectionEvals}
                      damagesData={damagesData}
                      membersBySpan={membersBySpan}
                      photos={photos}
                      situationPhotos={situationPhotos}
                      onUpdate={setInspectionItems}
                      onUpdateEvals={setInspectionEvals}
                      onSave={(latestEvals) => handleSaveAll({ inspection_items: inspectionItems, inspection_evals: latestEvals ?? inspectionEvals })}
                    />
                  )}
                </div>
              )}
              {currentStep === 8 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>確認・出力</h3>

                  <BridgeInfoForm
                    bridgeData={bridgeData}
                    inspectionForm={inspectionForm}
                    perfAuto={computePerfAuto(inspectionEvals)}
                    photoNoMap={computeChoshoPhotoNo(inspectionItems, inspectionEvals)}
                    onChange={(f) => setInspectionForm(f)}
                    onSave={async (f) => {
                      const bdKeys = ["橋梁名", "フリガナ", "路線名", "管理者", "所在地"];
                      const f2 = { ...f, ...computePerfAuto(inspectionEvals) };
                      const overrides = { inspection_form: f2 };
                      bdKeys.forEach(k => { if (f2[k] !== undefined && f2[k] !== "") overrides[k] = f2[k]; });
                      await handleSaveAll(overrides);
                    }}
                  />

                  {/* 損傷一覧テーブル */}
                  {damagesData && damagesData.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <h4 style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>損傷一覧（{damagesData.filter(d => !d.isNote).length}件）</h4>
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflowX: "auto", overflowY: "auto", maxHeight: 460 }}>
                        <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
                          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                            <tr style={{ background: "#1e3a5f" }}>
                              {["写真番号","径間","視点","記号","部材名","要素番号","損傷種類","前回","今回","定量値","データ番号","元番号","分類","パターン","メモ"].map(h => (
                                <th key={h} style={{ padding: "5px 8px", color: "#fff", textAlign: "left", whiteSpace: "nowrap", fontWeight: 600 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {damagesData.filter(d => !d.isNote).map((d, i) => (
                              <tr key={d.id || i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                                <td style={{ padding: "4px 8px", whiteSpace: "nowrap", color: "#1d4ed8", fontWeight: 700 }}>{(d.photoLabel || "").replace(/^写真番号-/, "").replace(/^写真-/, "")}</td>
                                <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>第{d.spanNo}径間</td>
                                <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>{d.viewTitle}</td>
                                <td style={{ padding: "4px 8px", fontFamily: "monospace", fontWeight: 700, color: "#4f8ef7" }}>{d.symbol}</td>
                                <td style={{ padding: "4px 8px" }}>{d.memberName}</td>
                                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>
                                  {d.isExtra ? (d.elementNoCurrent || "").split(",")[0].trim() : d.elementNoCurrent}
                                </td>
                                <td style={{ padding: "4px 8px" }}>{(d.dmgType || "").replace(/^([\u2460-\u3247])\1/, "$1")}</td>
                                <td style={{ padding: "4px 8px", textAlign: "center" }}>{d.prevDeg}</td>
                                <td style={{ padding: "4px 8px", textAlign: "center", fontWeight: 700, color: (() => {
                                  const grades = ["a","b","c","d","e"];
                                  const prev = grades.indexOf(d.prevDeg);
                                  const curr = grades.indexOf(d.currDeg);
                                  if (prev === -1 || curr === -1 || prev === curr) return "#1e293b";
                                  return curr > prev ? "#dc2626" : "#2563eb";
                                })() }}>{d.currDeg}</td>
                                <td style={{ padding: "4px 8px" }}>{d.detail}</td>
                                <td style={{ padding: "4px 8px", fontSize: 11, color: "#64748b" }}>{d.photoFile || ""}</td>
                                <td style={{ padding: "4px 8px", fontSize: 11, color: "#64748b" }}>{d.origPhotoLabel || ""}</td>
                                <td style={{ padding: "4px 8px", textAlign: "center" }}>{d.bunrui ? ("分類" + d.bunrui + (d.bunruiText ? ":" + d.bunruiText : "")) : ""}</td>
                                <td style={{ padding: "4px 8px" }}>{d.pattern}</td>
                                <td style={{ padding: "4px 8px" }}>{d.memo}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <button
                    style={{ ...styles.exportBtn, background: "#7c3aed" }}
                    onClick={handleExportChosho}
                    disabled={exportingChosho}
                  >
                    {exportingChosho ? "出力中..." : "道路橋記録様式を出力"}
                  </button>
                  <button style={styles.exportBtn} onClick={handleExport} disabled={exporting || !bridgeData}>
                    {exporting ? "出力中..." : "データ記録様式を出力"}
                  </button>
                  <button
                    style={{ ...styles.exportBtn, background: "#0e7490" }}
                    onClick={handleExportInspectionFormat}
                    disabled={exportingInspection || !bridgeData}
                  >
                    {exportingInspection ? "出力中..." : "点検記録様式を出力"}
                  </button>
                  <button
                    style={{ ...styles.exportBtn, background: "#94a3b8", cursor: "not-allowed" }}
                    disabled
                    title="テンプレート確定後に対応予定"
                  >
                    データ記録様式(csv)を出力（準備中）
                  </button>
                  {dxfData?.raw_text && (
                    <button
                      style={{ ...styles.exportBtn, background: "#1d4ed8" }}
                      onClick={() => exportDxf({
                        rawText: dxfData.raw_text,
                        dxfFileName: dxfFile?.name || 'output.dxf',
                        damagesData: damagesData || [],
                        numberingLabel,
                        renderData: dxfData.render_data,
                      })}
                    >
                       採番済DXFを出力
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 業務追加モーダル */}
      {showProjectModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>業務を追加</h3>
            <input style={styles.input} value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="業務名を入力" onKeyDown={(e) => e.key === "Enter" && addProject()} autoFocus />
            <div style={styles.modalBtns}>
              <button style={styles.cancelBtn} onClick={() => { setShowProjectModal(false); setNewProjectName(""); }}>キャンセル</button>
              <button style={styles.confirmBtn} onClick={addProject} disabled={saving}>{saving ? "追加中..." : "追加"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 施設追加モーダル */}
      {showFacilityModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>施設を追加</h3>
            <input style={styles.input} value={newFacilityName} onChange={(e) => setNewFacilityName(e.target.value)}
              placeholder="施設名を入力" onKeyDown={(e) => e.key === "Enter" && addFacility()} autoFocus />
            <div style={styles.modalBtns}>
              <button style={styles.cancelBtn} onClick={() => { setShowFacilityModal(false); setNewFacilityName(""); }}>キャンセル</button>
              <button style={styles.confirmBtn} onClick={addFacility} disabled={saving}>{saving ? "追加中..." : "追加"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {editTarget && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>{editTarget.type === "project" ? "業務" : "施設"}名を編集</h3>
            <input style={styles.input} value={editTarget.name}
              onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && saveEdit()} autoFocus />
            <div style={styles.modalBtns}>
              <button style={styles.cancelBtn} onClick={() => setEditTarget(null)}>キャンセル</button>
              <button style={styles.confirmBtn} onClick={saveEdit} disabled={saving}>{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ ...styles.toast, background: toast.type === "error" ? "#ef4444" : "#22c55e" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const styles = {
  app: { minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Helvetica Neue', Arial, sans-serif" },
  header: { background: "#1e3a5f", color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerTitle: { fontSize: 18, fontWeight: 700 },
  breadcrumb: { fontSize: 12, color: "#94a3b8", marginLeft: 4 },
  backBtn: { background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 14, cursor: "pointer" },
  homeBtn: { background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 14, cursor: "pointer" },
  main: { maxWidth: 1100, margin: "0 auto", padding: "24px 16px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: "#1e3a5f", margin: 0 },
  addBtn: { background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer" },
  cardGrid: { display: "flex", flexDirection: "column", gap: 10 },
  card: { background: "#fff", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", cursor: "pointer" },
  cardIcon: { fontSize: 24 },
  cardBody: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: 600, color: "#1e293b" },
  cardDate: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  empty: { textAlign: "center", padding: "60px 20px" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#64748b", fontSize: 16 },
  menuBtn: { background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", padding: "4px 8px", borderRadius: 6 },
  dropdown: { position: "absolute", right: 0, top: "100%", background: "#fff", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 140, zIndex: 100 },
  dropdownItem: { display: "block", width: "100%", padding: "10px 16px", background: "none", border: "none", textAlign: "left", fontSize: 14, cursor: "pointer", color: "#1e293b" },
  section: { background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  importRow: { display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" },
  fileInput: { flex: 1, fontSize: 14, minWidth: 0 },
  importBtn: { background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" },
  dataTable: { marginTop: 12, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" },
  dataRow: { display: "flex", borderBottom: "1px solid #f1f5f9", padding: "10px 14px" },
  dataLabel: { width: 140, fontSize: 13, color: "#64748b", flexShrink: 0 },
  dataValue: { fontSize: 14, color: "#1e293b", fontWeight: 500 },
  exportBtn: { marginTop: 16, background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%" },
  workLayout:       { display: "flex", gap: 20, alignItems: "flex-start" },
  sidebar:          { width: 180, flexShrink: 0, background: "#fff", borderRadius: 12, padding: "16px 0", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", position: "sticky", top: 24 },
  stepItem:         { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", borderLeft: "3px solid transparent" },
  stepItemActive:   { background: "#f0f4ff", borderLeft: "3px solid #1e3a5f" },
  stepItemDisabled: { cursor: "not-allowed", opacity: 0.45 },
  stepNum:          { width: 28, height: 28, borderRadius: "50%", background: "#e2e8f0", color: "#64748b", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepNumActive:    { background: "#1e3a5f", color: "#fff" },
  stepNumDisabled:  { background: "#f1f5f9", color: "#cbd5e1" },
  stepLabel:        { fontSize: 13, fontWeight: 600, color: "#334155" },
  stepSub:          { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  stepContent:      { flex: 1, minWidth: 0 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 },
  modal: { background: "#fff", borderRadius: 12, padding: 24, width: "90%", maxWidth: 400, boxSizing: "border-box" },
  modalTitle: { fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16 },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" },
  modalBtns: { display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" },
  cancelBtn: { background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, cursor: "pointer" },
  confirmBtn: { background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", color: "#fff", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 600, zIndex: 300, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" },
};
