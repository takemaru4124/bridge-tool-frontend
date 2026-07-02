/**
 * DXF出力ユーティリティ（STEP7用）
 * rawText再パース方式 - 旧HTML（bridge_photo_renaming_tool_v1_1_7.html）と同方式
 */

// --- ミニDXFパーサー（旧HTMLのparseDxf相当）---
function _parseDxf(rawText) {
  const lines = rawText.split(/\r?\n/);
  const entities = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i]?.trim() === '0' && i + 1 < lines.length) {
      const etype = lines[i + 1]?.trim();
      if (['TEXT', 'MTEXT', 'LEADER'].includes(etype)) {
        const ent = { type: etype, start: i, codes: {} };
        let j = i + 2;
        while (j < lines.length) {
          if (lines[j]?.trim() === '0') { ent.end = j; break; }
          const c = lines[j]?.trim();
          const v = lines[j + 1]?.trim() ?? '';
          if (!ent.codes[c]) ent.codes[c] = [];
          ent.codes[c].push(v);
          j += 2;
        }
        entities.push(ent);
      }
    }
    i++;
  }
  return { lines, entities };
}

function _gc(ent, code) {
  return (ent.codes[code] ?? [''])[0];
}

const _CIRCLED = /^[①-⑳㉑-㉖]/u;
const _MEMBER_RE = /[A-Z][a-z]+\d{3,4}/;

// MTEXTテキスト内容をパース
function _parseMtextRaw(raw) {
  const clean = raw
    .replace(/\{\\C\d+;([^}]*)\}/g, '$1')
    .replace(/\\C\d+;/g, '')
    .replace(/[{}]/g, '');
  const parts = clean.split('\\\\P').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return _parseLines(parts[0], parts.slice(1).join(' '));
}

// 部材行・損傷行から共通情報を抽出
function _parseLines(memberLine, damageLine) {
  const arrowM = memberLine.match(/([A-Z][a-z]+)\d+→(\d+)/);
  const normM = memberLine.match(/([A-Z][a-z]+)(\d+)/);
  const symbol = (arrowM ?? normM)?.[1] ?? '';
  const elementNo = arrowM
    ? arrowM[2].padStart(4, '0')
    : (normM ? normM[2].padStart(4, '0') : '');
  const dmgTypeM = damageLine.match(/^([①-⑳㉑-㉖][^-\[]*)/u);
  const dmgType = dmgTypeM ? dmgTypeM[1].trim() : '';
  const dmgSymbol = dmgType ? dmgType[0] : '';
  const degM = damageLine.match(/-([a-e])→([a-e])/);
  const prevDeg = degM ? degM[1] : '';
  return { symbol, elementNo, dmgType, dmgSymbol, prevDeg, memberLine, damageLine };
}

// 損傷色付け（旧HTMLと同ロジック）
function applyDamageColor(damageLine, currDeg, prevDeg, memoType) {
  if (!currDeg || !prevDeg) return damageLine;
  const degOrder = ['e', 'd', 'c', 'b', 'a'];
  const pi = degOrder.indexOf(prevDeg);
  const ci = degOrder.indexOf(currDeg);
  if (pi < 0 || ci < 0) return damageLine;

  let color = null, suffix = '';
  if (currDeg === 'a') {
    color = memoType === 'none' ? null : '\\C5;'; suffix = memoType === 'none' ? '(損傷なし)' : '(補修済)';
  } else if (ci < pi) {
    color = '\\C1;';
  } else if (ci > pi) {
    suffix = '(判定の見直し)';
  } else {
    return damageLine;
  }

  const parts = damageLine.split('\\\\P');
  const processed = parts.map(part =>
    part.replace(
      new RegExp(`(-[a-e])(→)(${currDeg}[^\\\\]*)`, 'u'),
      (_, dashDeg, arrow, afterPart) => {
        const colored = arrow + currDeg + suffix + afterPart.slice(1);
        return color ? dashDeg + '{' + color + colored + '}' : dashDeg + colored;
      }
    )
  );
  return processed.join('\\P');
}

// 損傷行を新ランクで更新してから色付け
function _applyUpdate(damageLine, newCurrDeg, prevDeg, memoType) {
  let updated = damageLine;
  if (newCurrDeg) {
    updated = damageLine.replace(/(-[a-e]→)([a-e])/, (_, arrow) => arrow + newCurrDeg);
  }
  return applyDamageColor(updated, newCurrDeg || '', prevDeg || '', memoType);
}

export function exportDxf({ rawText, dxfFileName, damagesData, numberingLabel, renderData }) {
  if (!rawText) {
    alert('DXFデータがありません。DXFを再取込してください。');
    return;
  }

  const { lines: rawLines, entities } = _parseDxf(rawText);
  const resultLines = [...rawLines];

  // --- 1. MTEXT in M-STR-HTXT を収集 ---
  const mtextList = entities.filter(e => {
    if (e.type !== 'MTEXT') return false;
    const layer = _gc(e, '8');
    if (!layer.includes('STR-HTXT')) return false;
    const raw = _gc(e, '1');
    return raw && raw.includes('\\\\P') && raw.length >= 5;
  });

  // --- 2. M-STR-HTXT TEXT（部材・損傷）を収集 ---
  const htxtTexts = entities.filter(e => {
    if (e.type !== 'TEXT') return false;
    const layer = _gc(e, '8');
    if (!layer.includes('STR-HTXT') && !layer.includes('M-STR-TXT')) return false;
    const text = _gc(e, '1');
    if (!text || text.length < 2) return false;
    if (/^\d+(\.\d+)?$/.test(text)) return false;
    if (text.includes('写真')) return false;
    if (text.startsWith('Y')) return false;
    if (text.startsWith('※特')) return false;
    return true;
  });

  const memberTexts = htxtTexts.filter(e => _MEMBER_RE.test(_gc(e, '1')) && !_CIRCLED.test(_gc(e, '1')));
  const damageTexts = htxtTexts.filter(e => _CIRCLED.test(_gc(e, '1')));

  // --- 4. TEXTペアを近傍マッチング（旧HTMLと同方式）---
  const usedDmgStarts = new Set();
  const textPairs = [];
  for (const mt of memberTexts) {
    const mx = +_gc(mt, '10'), my = +_gc(mt, '20');
    let best = null, bestDist = Infinity;
    for (const dt of damageTexts) {
      if (usedDmgStarts.has(dt.start)) continue;
      const dx = Math.abs(mx - (+_gc(dt, '10')));
      const dy = Math.abs(my - (+_gc(dt, '20')));
      if (dx >= 80 || dy >= 40) continue;
      const dist = dx + dy;
      if (dist < bestDist) { bestDist = dist; best = dt; }
    }
    if (!best) continue;
    usedDmgStarts.add(best.start);
    textPairs.push({ memberEnt: mt, damageEnt: best });
  }

  // --- 5. キー索引: symbol:elementNo:dmgSymbol:prevDeg → rawDamageリスト ---
  const rawByKey = {};

  for (const ent of mtextList) {
    const parsed = _parseMtextRaw(_gc(ent, '1'));
    if (!parsed || !parsed.symbol) continue;
    const key = `${parsed.symbol}:${parsed.elementNo}:${parsed.dmgSymbol}:${parsed.prevDeg}`;
    if (!rawByKey[key]) rawByKey[key] = [];
    rawByKey[key].push({
      type: 'mtext',
      start: ent.start,
      x: +_gc(ent, '10'),
      y: +_gc(ent, '20'),
      memberLine: parsed.memberLine,
      damageLine: parsed.damageLine,
    });
  }

  for (const { memberEnt, damageEnt } of textPairs) {
    const memberLine = _gc(memberEnt, '1');
    const damageLine = _gc(damageEnt, '1');
    const parsed = _parseLines(memberLine, damageLine);
    if (!parsed || !parsed.symbol) continue;
    const key = `${parsed.symbol}:${parsed.elementNo}:${parsed.dmgSymbol}:${parsed.prevDeg}`;
    if (!rawByKey[key]) rawByKey[key] = [];
    rawByKey[key].push({
      type: 'textpair',
      start: memberEnt.start,
      dmgStart: damageEnt.start,
      x: +_gc(memberEnt, '10'),
      y: +_gc(damageEnt, '20'),
      memberLine,
      damageLine,
    });
  }

  // --- 6. damagesDataと照合 ---
  const counters = {};
  const matched = [];
  for (const d of damagesData) {
    if (d.isAdded || d.isNote) continue;
    const dmgSym = d.dmgType ? d.dmgType[0] : '';
    const elNo = (d.elementNoCurrent || '').padStart(4, '0');
    const key = `${d.symbol}:${elNo}:${dmgSym}:${d.prevDeg}`;
    if (!counters[key]) counters[key] = 0;
    const rawList = rawByKey[key] || [];
    const raw = rawList[counters[key]];
    counters[key]++;
    if (raw) matched.push({ d, raw });
  }

  // --- 7. 写真TEXT置換（origPhotoLabel→photoLabel直接マッピング）---
  // matchedのspanNoで対象径間を特定し、numByOldNumを構築
  const numByOldNum = {};
  for (const d of damagesData) {
    if (d.isAdded || d.isNote || !d.photoLabel || !d.origPhotoLabel) continue;
    if (d.origPhotoLabel === d.photoLabel) continue;
    const m = d.origPhotoLabel.match(/(\d+)$/);
    if (!m) continue;
    const oldNum = +m[1];
    numByOldNum[oldNum] = d.photoLabel;
  }

  // 写真TEXT（M-STR-HTXT内の「写」を含むTEXT）のstartを収集
  const photoTextStartSet = new Set(
    entities.filter(e => {
      if (e.type !== 'TEXT') return false;
      const layer = _gc(e, '8');
      if (!layer.includes('STR-HTXT')) return false;
      return /写/.test(_gc(e, '1'));
    }).map(e => e.start)
  );

  // --- 8. 書き換えマップ構築 ---
  const damageByStart = {};
  const dmgStartSet = new Set();
  const textPairNewMtext = [];

  for (const { d, raw } of matched) {
    if (raw.type === 'mtext') {
      damageByStart[raw.start] = { d, type: 'mtext' };
    } else {
      damageByStart[raw.start] = { d, type: 'textpair' };
      dmgStartSet.add(raw.dmgStart);
      textPairNewMtext.push({ d, raw });
    }
  }

  // --- 8. 全行スキャン ---
  let i = 0;
  while (i < resultLines.length) {
    const t = resultLines[i]?.trim();

    if (t === '0' && i + 1 < resultLines.length) {
      const nextType = resultLines[i + 1]?.trim();

      // 既存MTEXTを直接書き換え
      if (nextType === 'MTEXT') {
        const entry = damageByStart[i];
        if (entry && entry.type === 'mtext') {
          const { d } = entry;
          let j = i + 2;
          while (j < resultLines.length) {
            if (resultLines[j]?.trim() === '0') break;
            if (resultLines[j]?.trim() === '1' && j + 1 < resultLines.length) {
              const orig = resultLines[j + 1];
              const sep = orig.indexOf('\\P');
              if (sep !== -1) {
                const memberPart = orig.substring(0, sep);
                const damagePart = orig.substring(sep + 2);
                const finalDmg = _applyUpdate(damagePart, d.currDeg || '', d.prevDeg || '', d.memoType || 'normal');
                resultLines[j + 1] = memberPart + '\\P' + finalDmg;
              }
              break;
            }
            j += 2;
          }
        }
      }

      // TEXTペアの内容を空白化（部材TEXT・損傷TEXT）
      if (nextType === 'TEXT') {
        const isMember = damageByStart[i]?.type === 'textpair';
        const isDmg = dmgStartSet.has(i);
        if (isMember || isDmg) {
          let j = i + 2;
          while (j < resultLines.length) {
            if (resultLines[j]?.trim() === '0') break;
            if (resultLines[j]?.trim() === '1') { resultLines[j + 1] = ''; break; }
            j += 2;
          }
        }
        // 写真TEXTの番号をnumByOldNumで置換
        if (photoTextStartSet.has(i)) {
          let j = i + 2;
          while (j < resultLines.length) {
            if (resultLines[j]?.trim() === '0') break;
            if (resultLines[j]?.trim() === '1') {
              const orig = resultLines[j + 1] || '';
              const origNums = (orig.match(/\d+/g) || []).map(Number);
              const merged = origNums.map(n => numByOldNum[n] || null);
              if (merged.some(v => v !== null)) {
                // 置換できた番号だけ更新、できない番号は元テキストから保持
                const prefix = orig.replace(/[\d,]+$/, '').replace(/\d+.*$/, '');
                const label = orig.match(/^([^\d]*)/)?.[ 1] || '';
                const newLabels = origNums.map((n, i) => {
                  if (merged[i]) return merged[i];
                  return label + n;
                });
                const fm = newLabels[0].match(/^(.+-)(\d+)$/);
                const pfx = fm?.[1];
                resultLines[j + 1] = (pfx && newLabels.every(l => l.startsWith(pfx)))
                  ? pfx + newLabels.map(l => l.replace(pfx, '')).join(',')
                  : newLabels.join(',');
              }
              break;
            }
            j += 2;
          }
        }
      }
    }

    i++;
  }

  // --- 9. 新MTEXTをENTITIES末尾に挿入 ---
  const addedDamages = damagesData.filter(d => d.isAdded && !d.isNote);
  const newEntLines = [];
  let hCnt = 0xFF00;

  // テキストペア → 新MTEXT
  for (const { d, raw } of textPairNewMtext) {
    const finalDmg = _applyUpdate(raw.damageLine, d.currDeg || '', d.prevDeg || '', d.memoType || 'normal');
    const content = raw.memberLine + '\\P' + finalDmg;
    const h = (hCnt++).toString(16).toUpperCase();
    newEntLines.push(
      '  0', 'MTEXT', '  5', h, '330', '1F',
      '100', 'AcDbEntity', '  8', 'M-STR-HTXT', ' 48', '2.0',
      '100', 'AcDbMText',
      ' 10', String(raw.x), ' 20', String(raw.y), ' 30', '0.0',
      ' 40', '7.0', ' 41', '0.0', ' 46', '0.0',
      ' 71', '     7', ' 72', '     5',
      '  1', content,
      '  7', 'YOKO_GOTHIC',
      ' 73', '     1', ' 44', '1.0',
    );
  }

  // 追加損傷 → 新MTEXT
  if (addedDamages.length > 0) {
    const viewLastPos = {};
    for (const { d: md, raw } of matched) {
      const vt = md.viewTitle;
      if (!viewLastPos[vt] || raw.y < viewLastPos[vt].y) {
        viewLastPos[vt] = { x: raw.x, y: raw.y };
      }
    }
    addedDamages.forEach((d, idx) => {
      const pos = viewLastPos[d.viewTitle] || { x: 2100, y: -300 };
      const newX = pos.x + 50;
      const newY = pos.y - 50 * (idx + 1);
      const editDeg = d.currDeg || '';
      const prevDeg = d.prevDeg || '';
      const degStr = prevDeg ? `${prevDeg}→${editDeg}` : editDeg;
      const quantStr = d.detail ? `[${d.detail}]` : '';
      const dmgLine = (d.dmgType || '') + '-' + degStr + quantStr;
      const memberPart = (d.symbol || '') + (d.elementNoCurrent || '') + (d.memberName ? ' ' + d.memberName : '');
      const content = '{\\C1;' + memberPart + '\\P' + dmgLine + '}';
      const h = (hCnt++).toString(16).toUpperCase();
      newEntLines.push(
        '  0', 'MTEXT', '  5', h, '330', '1F',
        '100', 'AcDbEntity', '  8', 'M-STR-HTXT', ' 48', '2.0',
        '100', 'AcDbMText',
        ' 10', String(newX), ' 20', String(newY), ' 30', '0.0',
        ' 40', '7.0', ' 41', '0.0', ' 46', '0.0',
        ' 71', '     7', ' 72', '     5',
        '  1', content,
        '  7', 'YOKO_GOTHIC',
        ' 73', '     1', ' 44', '1.0',
      );
    });
  }

  if (newEntLines.length > 0) {
    let insertIdx = -1;
    let inEntities = false;
    for (let k = 0; k < resultLines.length; k++) {
      if (resultLines[k].trim() === 'SECTION' && resultLines[k + 2]?.trim() === 'ENTITIES') inEntities = true;
      if (inEntities && resultLines[k].trim() === 'ENDSEC') { insertIdx = k - 1; break; }
    }
    if (insertIdx !== -1) resultLines.splice(insertIdx, 0, ...newEntLines);
    else resultLines.push(...newEntLines);
  }

  // --- ダウンロード ---
  const blob = new Blob([resultLines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (dxfFileName || 'output.dxf').replace(/\.dxf$/i, '_採番済.dxf');
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportCheckDxf({ rawText, dxfFileName, damagesData }) {
  if (!rawText) {
    alert('DXFデータがありません。DXFを再取込してください。');
    return;
  }

  const { lines: rawLines, entities } = _parseDxf(rawText);
  const resultLines = [...rawLines];

  // 取込済み損傷のx,y座標を収集（damagesDataのphotoFileをキーに）
  const matchedPhotoFiles = new Set(
    (damagesData || [])
      .filter(d => !d.isAdded && !d.isNote && d.photoFile)
      .flatMap(d => d.photoFile.split(',').map(p => p.trim()).filter(Boolean))
  );

  // 写真番号レイヤーのTEXTからphotoFileに対応するものの座標を取得
  const checkPositions = [];
  const matchedPfPositions = [];
  for (const ent of entities) {
    if (ent.type !== 'TEXT') continue;
    if (!_gc(ent, '8').includes('写真番号')) continue;
    const text = _gc(ent, '1');
    if (!text) continue;
    const parts = text.trim().split(',').map(p => p.trim()).filter(Boolean);
    if (parts.some(p => matchedPhotoFiles.has(p))) {
      const px = +_gc(ent, '10'), py = +_gc(ent, '20');
      checkPositions.push({ x: px, y: py });
      matchedPfPositions.push({ x: px, y: py });
    }
  }

  // M-STR-HTXTレイヤーのTEXT/MTEXT（損傷テキスト）を収集
  const damageTextEnts = entities.filter(e => {
    if (!['TEXT', 'MTEXT'].includes(e.type)) return false;
    if (!_gc(e, '8').includes('STR-HTXT')) return false;
    const t = _gc(e, '1');
    return t && !t.startsWith('写真') && !/^[\d.]+$/.test(t);
  });

  // 各P番号座標に最近傍の損傷テキスト座標を探して□追加
  const usedDmgStarts = new Set();
  for (const pf of matchedPfPositions) {
    let best = null, bestDist = Infinity;
    for (const ent of damageTextEnts) {
      if (usedDmgStarts.has(ent.start)) continue;
      const dx = +_gc(ent, '10') - pf.x;
      const dy = +_gc(ent, '20') - pf.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < bestDist) { bestDist = dist; best = ent; }
    }
    if (best) {
      usedDmgStarts.add(best.start);
      checkPositions.push({ x: +_gc(best, '10'), y: +_gc(best, '20') });
    }
  }





  // 各座標に5×5の長方形を追加
  const newEntLines = [];
  let hCnt = 0xEE00;
  const W = 5, H = 5;

  for (const { x, y } of checkPositions) {
    const h1 = (hCnt++).toString(16).toUpperCase();
    // 長方形（LWPOLYLINEで閉じた矩形）
    newEntLines.push(
      '  0', 'LWPOLYLINE', '  5', h1, '330', '1F',
      '100', 'AcDbEntity', '  8', 'M-STR-HTXT', ' 62', '     3',
      '100', 'AcDbPolyline',
      ' 90', '     4',
      ' 70', '     1',
      ' 43', '0.0',
      ' 10', String(x), ' 20', String(y),
      ' 10', String(x + W), ' 20', String(y),
      ' 10', String(x + W), ' 20', String(y + H),
      ' 10', String(x), ' 20', String(y + H),
    );
  }

  // ENTITIESセクション末尾に挿入
  if (newEntLines.length > 0) {
    let insertIdx = -1;
    let inEntities = false;
    for (let k = 0; k < resultLines.length; k++) {
      if (resultLines[k].trim() === 'SECTION' && resultLines[k + 2]?.trim() === 'ENTITIES') inEntities = true;
      if (inEntities && resultLines[k].trim() === 'ENDSEC') { insertIdx = k - 1; break; }
    }
    if (insertIdx !== -1) resultLines.splice(insertIdx, 0, ...newEntLines);
    else resultLines.push(...newEntLines);
  }

  const blob = new Blob([resultLines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (dxfFileName || 'output.dxf').replace(/\.dxf$/i, '_取込確認.dxf');
  a.click();
  URL.revokeObjectURL(a.href);
}
