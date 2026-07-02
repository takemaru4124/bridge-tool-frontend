// src/utils/numbering.js
// 採番ロジック（NumberingStep・DamageList共通）

export const MEMBER_ORDER = [
  "Mg","Cr","St","Ds","Cf","Lu","Ll","Bt","Dt","Pt",
  "Ar","Sa","Ha","Ca","Pa","Rg","Rp","Sc","Ts","Th","Td",
  "Co","Gb","Cn","Pp","Em","Sx",
  "Pw","Pb","Pc","Px",
  "Ap","Ac","Aw","Ax",
  "Ff","Fx",
  "Bh","Ba","Bm","Bc","Bx",
  "Sf","Ss","Sd","Se",
  "Ra","Gf","Fg","Me","Ej","Si","Cu","Pm",
  "Dr","Dp","Dx","Ip","Ut","Ww",
  "Ct","Sw","Cb","Iw","Jo","Lj","Eg","Cx",
];

export function memberIdx(code) {
  const i = MEMBER_ORDER.indexOf(code);
  return i === -1 ? 999 : i;
}

export const CIRCLED = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭","⑮","⑯","⑰","⑱","⑲","⑳","㉑","㉒","㉓","㉔","㉕","㉖"];

export function dmgIdx(dmgType) {
  if (!dmgType) return 999;
  const sym = dmgType[0];
  const i = CIRCLED.indexOf(sym);
  return i === -1 ? 999 : i;
}

// 損傷写真の採番
export function applyNumbering(damages, rule, viewOrder, spanStartNums, photoLabel) {
  let sorted = [...damages];

  if (rule === 1) {
    sorted.sort((a, b) => {
      if (memberIdx(a.symbol) !== memberIdx(b.symbol))
        return memberIdx(a.symbol) - memberIdx(b.symbol);
      if (a.elementNoCurrent !== b.elementNoCurrent)
        return (a.elementNoCurrent || "").localeCompare(b.elementNoCurrent || "");
      return dmgIdx(a.dmgType) - dmgIdx(b.dmgType);
    });
  } else {
    const viewIdx = (title) => {
      const i = (viewOrder || []).indexOf(title);
      return i === -1 ? 999 : i;
    };
    sorted.sort((a, b) => {
      if (viewIdx(a.viewTitle) !== viewIdx(b.viewTitle))
        return viewIdx(a.viewTitle) - viewIdx(b.viewTitle);
      if (memberIdx(a.symbol) !== memberIdx(b.symbol))
        return memberIdx(a.symbol) - memberIdx(b.symbol);
      if (a.elementNoCurrent !== b.elementNoCurrent)
        return (a.elementNoCurrent || "").localeCompare(b.elementNoCurrent || "");
      return dmgIdx(a.dmgType) - dmgIdx(b.dmgType);
    });
  }

  const spanNums = {};
  let globalNum = 1;
  sorted.forEach(d => {
    const sp = d.spanNo || 1;
    if (spanNums[sp] === undefined) {
      const startNum = spanStartNums[sp];
      if (startNum) {
        spanNums[sp] = startNum;
        globalNum = startNum;
      } else {
        spanNums[sp] = globalNum;
      }
    }
    d.photoLabel = `${photoLabel}-${spanNums[sp]}`;
    spanNums[sp]++;
    globalNum = Math.max(globalNum, spanNums[sp]);
  });

  return sorted;
}

// NON写真の採番（径間別開始番号から連番）
export function applyNonNumbering(nonPhotos, nonStartNums, photoLabel) {
  const bySpan = {};
  (nonPhotos || []).forEach(n => {
    const sp = n.spanNo || 1;
    if (!bySpan[sp]) bySpan[sp] = [];
    bySpan[sp].push(n);
  });
  const result = [];
  Object.keys(bySpan).forEach(sp => {
    let num = (nonStartNums || {})[sp] || 1001;
    bySpan[sp].forEach(n => {
      result.push({ ...n, photoLabel: `${photoLabel}-${num}` });
      num++;
    });
  });
  return result;
}

// 損傷＋NONを一括採番（共通実行関数）
export function runFullNumbering({ damages, nonPhotos, rule, photoLabel, spanStartNums, nonStartNums, viewOrder }) {
  const targets = (damages || []).filter(d => !d.isExtra && !d.isNote);
  const numberedDamages = applyNumbering(targets, rule, viewOrder, spanStartNums || {}, photoLabel);
  const extras = (damages || []).filter(d => d.isExtra || d.isNote);
  const resultDamages = [...numberedDamages, ...extras];

  const numberedNon = applyNonNumbering(nonPhotos, nonStartNums || {}, photoLabel);
  const resultNon = numberedNon.map(n => ({
    ...n,
    memo: n.memo && n.memo.trim() ? n.memo : (n.elements || []).join(","),
  }));

  return { damages: resultDamages, nonPhotos: resultNon };
}

// 写真キー正規化（DamageList.jsxと共通）
export function normalizeKey(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/^([a-z])_+(\d)/, "$1___$2");
}

// photoFileから写真を自動マッチ（STEP6と共通）
export function findPhotoKey(photoFile, photos) {
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
