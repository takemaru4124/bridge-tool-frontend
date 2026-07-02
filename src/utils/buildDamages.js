// src/utils/buildDamages.js
// 損傷カード構築ロジック（App.jsx・DamageList.jsxの共通化）

// メモ自動生成
export function buildDefaultMemo(memberName, dmgType, detail, subDamages) {
  if (!memberName || !dmgType) return "";
  const stripCircle = s => (s || "").replace(/^[①-⑳㉑-㉖]/, "").trim();
  const mainSymbol = (dmgType || "")[0] || "";
  const mainType = stripCircle(dmgType);
  const subs = (subDamages || []).filter(s => s.dmgType);
  const allTypes = [mainType, ...subs.map(s => stripCircle(s.dmgType))].filter(Boolean);
  let memo = memberName + "に" + allTypes.join("、") + "が見られる。";
  const quantLines = [];
  if (detail) quantLines.push({ symbol: mainSymbol, detail });
  subs.forEach(s => { if (s.detail) quantLines.push({ symbol: (s.dmgType || "")[0] || "", detail: s.detail }); });
  if (quantLines.length === 1) {
    memo += "\n" + quantLines[0].detail;
  } else if (quantLines.length > 1) {
    quantLines.forEach(q => { memo += "\n" + q.symbol + q.detail; });
  }
  return memo;
}


// isExtra用メモ生成（先頭要素のメモ＋残り要素を「要素番号＋損傷の種類」でメモに追記）
export function buildExtraMemo(d, memberName, dmgType, detail, subDamages) {
  const base = buildDefaultMemo(memberName, dmgType, detail, subDamages);
  if (d && d.is_extra) {
    const restDmgs = (d.damages || []).slice(1);
    const restLines = restDmgs.map(rd => {
      const memberPart = rd.member_name || "";
      const sym = rd.symbol || "";
      const elem = rd.element_no_current || "";
      const symElem = [sym, elem].filter(Boolean).join("");
      const memberFull = [memberPart, symElem].filter(Boolean).join(" ");
      const dmg = (rd.damage_no || "") + (rd.type || "");
      const lv = rd.level_current ? "-" + rd.level_current : "";
      return (memberFull + " " + dmg + lv).trim();
    }).filter(Boolean);
    if (restLines.length) return base ? base + "\n" + restLines.join("\n") : restLines.join("\n");
  }
  return base;
}

// dxf_groupsから損傷カードリストを生成
export function buildInitialDamages(dxfGroups, dxfSpans) {
  if (!dxfGroups || dxfGroups.length === 0) return [];
  const damages = [];
  let seq = 1;
  (dxfGroups || []).forEach(group => {
    let spanNo = 1;
    if (dxfSpans) {
      const sp = dxfSpans.find(s => s.views && s.views.includes(group.title));
      if (sp) spanNo = sp.span_no;
    }
    (group.damages || []).forEach(d => {
      if (d.note && !d.is_extra) return;
      const allDmgs = d.damages || [];
      if (allDmgs.length === 0) return;
      const mainDmg = allDmgs[0];
      const subDmgs = allDmgs.slice(1).map(s => ({
        dmgType: (s.damage_no || "") + (s.type || ""),
        prevDeg: s.level_prev || "",
        currDeg: s.level_current || "",
        detail: s.detail || "",
        quant: "",
        bunrui: s.bunrui || "",
        bunruiText: s.bunrui_text || s.bunruiText || "",
        pattern: s.pattern || "",
        memberName: s.member_name || "",
        symbol: s.symbol || "",
        elementNoCurrent: s.element_no_current || "",
      }));
      const memberName = d.member_name || "";
      const dmgType = (mainDmg.damage_no || "") + (mainDmg.type || "");
      const detail = mainDmg.detail || "";
      const photoFiles = (d.photo_file || "").split(",").map(s => s.trim()).filter(Boolean);
      const photoLabels = (d.photo_label || "").split(",").map(s => s.trim()).filter(Boolean);
      const cardCount = Math.max(1, photoFiles.length);
      for (let pi = 0; pi < cardCount; pi++) {
        damages.push({
          id: seq++, spanNo, viewTitle: group.title || "",
          memberName, symbol: d.symbol || "",
          elementNoPrev: d.element_no_prev || "",
          elementNoCurrent: (d.element_no_current || ""),
          dmgType, prevDeg: mainDmg.level_prev || "",
          damageNoPrev: mainDmg.damage_no_prev || "",
          currDeg: mainDmg.level_current || "",
          detail, quant: "",
          bunrui: pi === 0 ? (mainDmg.bunrui || "") : "",
          bunruiText: pi === 0 ? (mainDmg.bunrui_text || mainDmg.bunruiText || "") : "",
          pattern: pi === 0 ? (mainDmg.pattern || "") : "",
          memo: pi === 0 ? (() => {
            let m = buildExtraMemo(d, memberName, dmgType, detail, subDmgs);
            const elems = (d.element_no_current || "").split(",").map(s => s.trim()).filter(Boolean);
            if (d.is_extra) {
              // 上記以外：先頭をメイン要素とし、残り要素をメモに追記
              const rest = elems.slice(1);
              if (rest.length) {
                const line = (d.symbol || "") + rest.join(",");
                m = m ? m + "\n" + line : line;
              }
            } else if (elems.length > 1) {
              // 非上記以外の複数要素：全要素をメモに追記（既存挙動）
              const ec = (d.element_no_current || "");
              m = m ? m + "\n" + (d.symbol || "") + ec : (d.symbol || "") + ec;
            }
            return m;
          })() : "",
          photoLabel: photoLabels[pi] || d.photo_label || "",
          origPhotoLabel: photoLabels[pi] || d.photo_label || "",
          photoFile: photoFiles[pi] || "",
          isAdded: false, isNote: false,
          isExtra: d.is_extra || false,
          editingMember: false,
          subDamages: pi === 0 ? subDmgs : [],
        });
      }
    });
  });
  return damages;
}
