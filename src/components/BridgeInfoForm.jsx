// src/components/BridgeInfoForm.jsx
// 点検記録様式 その1（橋梁諸元）編集フォーム
// 1/2(橋梁諸元)はExcelテンプレ「その１」の升目をグリッドで再現。
// 性能評価(2/2)・所見は従来通り表形式で表示。STEP8最上部に配置。
import { useState, useEffect, useRef, Fragment } from "react";

// ── 様式-1 橋梁形式 選択肢（構造形式一覧.xlsx F列より） ──
const KEISHIKI_JOUHU = ["","121-①鋼橋（ボルト又は溶接継手）_Ｉ桁（非合成）","122-①鋼橋（ボルト又は溶接継手）_Ｉ桁（合成）","123-①鋼橋（ボルト又は溶接継手）_Ｉ桁（鋼床版）","124-①鋼橋（ボルト又は溶接継手）_Ｉ桁（不明）","125-①鋼橋（ボルト又は溶接継手）_Ｈ形鋼（非合成）","126-①鋼橋（ボルト又は溶接継手）_Ｈ形鋼（合成）","128-①鋼橋（ボルト又は溶接継手）_Ｈ形鋼（不明）","130-①鋼橋（ボルト又は溶接継手）_鋼桁橋（その他）","131-①鋼橋（ボルト又は溶接継手）_箱桁（非合成）","132-①鋼橋（ボルト又は溶接継手）_箱桁（合成）","133-①鋼橋（ボルト又は溶接継手）_箱桁（鋼床版）","134-①鋼橋（ボルト又は溶接継手）_箱桁（不明）","140-①鋼橋（ボルト又は溶接継手）_トラス橋","150-①鋼橋（ボルト又は溶接継手）_アーチ橋（その他）","151-①鋼橋（ボルト又は溶接継手）_タイドアーチ（アーチ橋）","152-①鋼橋（ボルト又は溶接継手）_ランガー（アーチ橋）","153-①鋼橋（ボルト又は溶接継手）_ローゼ（アーチ橋）","155-①鋼橋（ボルト又は溶接継手）_ニールセン（アーチ橋）","156-①鋼橋（ボルト又は溶接継手）_アーチ橋","160-①鋼橋（ボルト又は溶接継手）_ラーメン橋","172-①鋼橋（ボルト又は溶接継手）_箱桁（斜張橋）","199-①鋼橋（ボルト又は溶接継手）_その他（鋼溶接橋）","221- ②鋼橋（リベット継手）_Ｉ桁（非合成）","222- ②鋼橋（リベット継手）_Ｉ桁（合成）","223- ②鋼橋（リベット継手）_Ｉ桁（鋼床版）","224- ②鋼橋（リベット継手）_Ｉ桁（不明）","225- ②鋼橋（リベット継手）_Ｈ形鋼（非合成）","226- ②鋼橋（リベット継手）_Ｈ形鋼（合成）","228- ②鋼橋（リベット継手）_Ｈ形鋼（不明）","230- ②鋼橋（リベット継手）_鋼桁橋（その他）","231- ②鋼橋（リベット継手）_箱桁（非合成）","232- ②鋼橋（リベット継手）_箱桁（合成）","233- ②鋼橋（リベット継手）_箱桁（鋼床版）","234- ②鋼橋（リベット継手）_箱桁（不明）","240- ②鋼橋（リベット継手）_トラス橋","250- ②鋼橋（リベット継手）_アーチ橋（その他）","251- ②鋼橋（リベット継手）_タイドアーチ（アーチ橋）","252- ②鋼橋（リベット継手）_ランガー（アーチ橋）","253- ②鋼橋（リベット継手）_ローゼ（アーチ橋）","255- ②鋼橋（リベット継手）_ニールセン（アーチ橋）","256- ②鋼橋（リベット継手）_アーチ橋","260- ②鋼橋（リベット継手）_ラーメン橋","299- ②鋼橋（リベット継手）_その他（鋼（鉄）リベット橋）","310-③ＲＣ橋 _ＲＣ床版橋（その他）","311-③ＲＣ橋 _ＲＣ  中実床版","312-③ＲＣ橋 _ＲＣ  中空床版","321-③ＲＣ橋 _ＲＣ  Ｔ桁","330-③ＲＣ橋 _ＲＣ桁橋（その他）","331-③ＲＣ橋 _ＲＣ  箱桁","335-③ＲＣ橋 _ＲＣ溝橋（ＢＯＸカルバート）","336-③ＲＣ橋 _ＲＣ特定溝橋（ＢＯＸカルバート）","350-③ＲＣ橋 _アーチ橋（その他）","356-③ＲＣ橋 _アーチ橋","360-③ＲＣ橋 _ラーメン橋","399-③ＲＣ橋 _その他（ＲＣ橋）","410-④ＰＣ橋_ＰＣ床版橋（その他）","411-④ＰＣ橋_プレテン床版","412-④ＰＣ橋_プレテン中空床版","413-④ＰＣ橋_ポステン中空床版","421-④ＰＣ橋_プレテンＴ桁","422-④ＰＣ橋_プレテンＴ桁（合成）","423-④ＰＣ橋_ポステンＴ桁","424-④ＰＣ橋_ポステンＴ桁（合成）","430-④ＰＣ橋_ＰＣ桁橋（その他）","431-④ＰＣ橋_プレテン箱桁","432-④ＰＣ橋_プレテン箱桁（合成）","433-④ＰＣ橋_ポステン箱桁","434-④ＰＣ橋_ポステン箱桁（合成）","435-④ＰＣ橋_ＰＣ溝橋（ＢＯＸカルバート）","436-④ＰＣ橋_ＰＣ特定溝橋（ＢＯＸカルバート）","450-④ＰＣ橋_アーチ橋（その他）","456-④ＰＣ橋_アーチ橋","460-④ＰＣ橋_ラーメン橋","471-④ＰＣ橋_Ｉ桁（斜張橋）","472-④ＰＣ橋_箱桁（斜張橋）","481-④ＰＣ橋_波形鋼板ウエブ橋","482-④ＰＣ橋_鋼管トラスウエブ橋","499-④ＰＣ橋_その他（ＰＣ橋）","556- ⑤ＳＲＣ橋_アーチ橋","599- ⑤ＳＲＣ橋_その他（ＳＲＣ橋）","650-⑥石橋_アーチ橋（その他）","656-⑥石橋_アーチ橋","699-⑥石橋_その他（石橋）","825-⑧Ｈ形鋼橋（継手なし）_Ｈ形鋼（非合成）","826-⑧Ｈ形鋼橋（継手なし）_Ｈ形鋼（合成）","828-⑧Ｈ形鋼橋（継手なし）_Ｈ形鋼（不明）","830-⑧Ｈ形鋼橋（継手なし）_鋼桁橋（その他）","960-⑨その他_ラーメン橋","972-⑨その他_箱桁（斜張橋）","999-⑨その他_その他"];
const KEISHIKI_KABU = ["","11-重力式橋台","12-半重力式橋台","13-逆Ｔ式橋台","14-控え壁式橋台","15-ラーメン橋台","16-中抜き橋台","17-盛りこぼし橋台","18-小橋台","19-その他（橋台）","20-橋台部ジョイントレス構造","21-壁式橋脚（ＲＣ）","22-壁式橋脚（ＳＲＣ）","23-壁式橋脚（鋼製）","31-柱橋脚（ＲＣ）","32-柱橋脚（ＳＲＣ）","33-柱橋脚（鋼製）","34-柱橋脚１柱円（ＲＣ）","35-柱橋脚１柱円（ＳＲＣ）","36-柱橋脚１柱円（鋼製）","37-柱橋脚１柱小判（ＲＣ）","38-柱橋脚１柱小判（ＳＲＣ）","39-柱橋脚１柱小判（鋼製）","41-ラーメン橋脚（ＲＣ）","42-ラーメン橋脚（ＳＲＣ）","43-ラーメン橋脚（鋼製）","44-柱橋脚１柱角（ＲＣ）","45-柱橋脚１柱角（ＳＲＣ）","46-柱橋脚１柱角（鋼製）","47-Ｔ型橋脚柱角型（ＲＣ）","48-Ｔ型橋脚柱角型（ＳＲＣ）","49-Ｔ型橋脚柱角型（鋼製）","51-二層ラーメン橋脚（ＲＣ）","53-二層ラーメン橋脚（鋼製）","61-Ｔ型橋脚（ＲＣ）","62-Ｔ型橋脚（ＳＲＣ）","63-Ｔ型橋脚（鋼製）","64-Ｔ型橋脚柱円型（ＲＣ）","65-Ｔ型橋脚柱円型（ＳＲＣ）","66-Ｔ型橋脚柱円型（鋼製）","67-Ｔ型橋脚柱小判型（ＲＣ）","68-Ｔ型橋脚柱小判型（ＳＲＣ）","69-Ｔ型橋脚柱小判型（鋼製）","71-Ｉ型橋脚（ＲＣ）","73-Ｉ型橋脚（鋼製）","81-パイルベント橋脚（ＲＣ）","82-パイルベント橋脚（ＳＲＣ）","83-パイルベント橋脚（鋼製）","84-柱橋脚２柱角（ＲＣ）","85-柱橋脚２柱角（ＳＲＣ）","86-柱橋脚２柱角（鋼製）","87-柱橋脚２柱円（ＲＣ）","88-柱橋脚２柱円（ＳＲＣ）","89-柱橋脚２柱円（鋼製）","91-柱橋脚２柱小判（ＲＣ）","92-柱橋脚２柱小判（ＳＲＣ）","98-アーチ拱抬","99-その他（橋脚）"];
const KEISHIKI_KISO = ["","0-直接基礎","1-オープンケーソン","2-ニューマチックケーソン","3-鋼管矢板","4-場所打ぐい","5-既製鋼ぐい","6-既製ＲＣぐい","7-既製ＰＣぐい","8-木ぐい","9-その他","10-鋼管ソイルセメント杭","11-プレボーリング杭","12-深礎（柱状体深礎基礎、組杭深礎基礎）"];

// ── その1(1/2) 升目セル定義（テンプレ結合セル範囲をグリッド座標に直訳） ──
// t:label/input, gc/gr:grid-column/row, x:ラベル文字, k:フォームキー, ml:複数行
const SHEET = [
  { t:"label", gc:"1 / 25", gr:"1 / 3", x:"点検記録様式（その１）　\n橋梁の諸元と定期点検総合結果 （１／２）" },
  { t:"input", gc:"25 / 30", gr:"1 / 3", k:"_hdr1", ml:false },
  { t:"input", gc:"30 / 35", gr:"1 / 3", k:"_hdr2", ml:false },
  { t:"label", gc:"36 / 39", gr:"1 / 3", x:"起点側" },
  { t:"label", gc:"39 / 41", gr:"1 / 2", x:"緯度" },
  { t:"label", gc:"46 / 49", gr:"1 / 3", x:"終点側" },
  { t:"label", gc:"49 / 51", gr:"1 / 2", x:"緯度" },
  { t:"label", gc:"56 / 60", gr:"1 / 3", x:"施設ID" },
  { t:"input", gc:"60 / 69", gr:"1 / 3", k:"施設ID", ml:false },
  { t:"label", gc:"39 / 41", gr:"2 / 3", x:"経度" },
  { t:"label", gc:"49 / 51", gr:"2 / 3", x:"経度" },
  { t:"label", gc:"1 / 7", gr:"4 / 5", x:"フリガナ" },
  { t:"input", gc:"7 / 26", gr:"4 / 5", k:"フリガナ", ml:false },
  { t:"label", gc:"26 / 30", gr:"4 / 6", x:"路 線 名" },
  { t:"input", gc:"30 / 39", gr:"4 / 6", k:"路線名", ml:false },
  { t:"label", gc:"39 / 42", gr:"4 / 8", x:"管　轄" },
  { t:"input", gc:"42 / 49", gr:"4 / 6", k:"管理者", ml:false },
  { t:"input", gc:"49 / 53", gr:"4 / 6", k:"管轄_地方整備局", ml:false },
  { t:"label", gc:"53 / 60", gr:"4 / 6", x:"橋梁コード" },
  { t:"input", gc:"60 / 69", gr:"4 / 6", k:"橋梁コード", ml:false },
  { t:"label", gc:"1 / 7", gr:"5 / 6", x:"橋 梁 名" },
  { t:"input", gc:"7 / 26", gr:"5 / 6", k:"橋梁名", ml:false },
  { t:"label", gc:"1 / 7", gr:"6 / 8", x:"所 在 地" },
  { t:"label", gc:"7 / 9", gr:"6 / 7", x:"自" },
  { t:"input", gc:"9 / 26", gr:"6 / 7", k:"所在地", ml:false },
  { t:"label", gc:"26 / 30", gr:"6 / 8", x:"距 離 標" },
  { t:"label", gc:"30 / 32", gr:"6 / 7", x:"自" },
  { t:"input", gc:"32 / 39", gr:"6 / 7", k:"距離標自", ml:false },
  { t:"input", gc:"42 / 49", gr:"6 / 7", k:"事務所名", ml:false },
  { t:"input", gc:"49 / 53", gr:"6 / 7", k:"管轄_事務所", ml:false },
  { t:"label", gc:"53 / 60", gr:"6 / 7", x:"調書更新年月日" },
  { t:"input", gc:"60 / 69", gr:"6 / 7", k:"調書更新年月日", ml:false },
  { t:"label", gc:"7 / 9", gr:"7 / 8", x:"至" },
  { t:"input", gc:"9 / 26", gr:"7 / 8", k:"所在地至", ml:false },
  { t:"label", gc:"30 / 32", gr:"7 / 8", x:"至" },
  { t:"input", gc:"32 / 39", gr:"7 / 8", k:"距離標至", ml:false },
  { t:"input", gc:"42 / 49", gr:"7 / 8", k:"出張所名", ml:false },
  { t:"input", gc:"49 / 53", gr:"7 / 8", k:"管轄_出張所", ml:false },
  { t:"label", gc:"1 / 7", gr:"9 / 10", x:"供用開始日" },
  { t:"input", gc:"7 / 13", gr:"9 / 10", k:"供用開始日", ml:true },
  { t:"label", gc:"13 / 15", gr:"9 / 10", x:"橋長" },
  { t:"input", gc:"15 / 20", gr:"9 / 10", k:"橋長", ml:false },
  { t:"label", gc:"20 / 26", gr:"9 / 10", x:"活荷重・等級" },
  { t:"label", gc:"39 / 46", gr:"9 / 10", x:"適用示方書" },
  { t:"input", gc:"46 / 69", gr:"9 / 10", k:"適用示方書", ml:false },
  { t:"label", gc:"1 / 7", gr:"10 / 13", x:"上部構造形式" },
  { t:"input", gc:"7 / 20", gr:"10 / 13", k:"上部構造形式", ml:true },
  { t:"label", gc:"20 / 22", gr:"10 / 12", x:"幅員" },
  { t:"label", gc:"22 / 26", gr:"10 / 11", x:"全 　幅 　員" },
  { t:"input", gc:"26 / 31", gr:"10 / 11", k:"全幅員", ml:false },
  { t:"label", gc:"31 / 35", gr:"10 / 11", x:"地覆幅" },
  { t:"label", gc:"35 / 39", gr:"10 / 11", x:"歩道幅" },
  { t:"label", gc:"39 / 46", gr:"10 / 11", x:"車道幅・車線" },
  { t:"label", gc:"46 / 53", gr:"10 / 11", x:"車道幅・車線" },
  { t:"label", gc:"53 / 57", gr:"10 / 11", x:"歩道幅" },
  { t:"label", gc:"57 / 61", gr:"10 / 11", x:"地覆幅" },
  { t:"label", gc:"61 / 65", gr:"10 / 11", x:"中央帯" },
  { t:"label", gc:"65 / 69", gr:"10 / 11", x:"中央\n分離帯" },
  { t:"label", gc:"22 / 26", gr:"11 / 12", x:"有 効 幅 員" },
  { t:"input", gc:"26 / 31", gr:"11 / 12", k:"有効幅員", ml:false },
  { t:"input", gc:"31 / 35", gr:"11 / 12", k:"地覆幅左", ml:false },
  { t:"input", gc:"35 / 39", gr:"11 / 12", k:"歩道幅左", ml:false },
  { t:"input", gc:"39 / 43", gr:"11 / 12", k:"車道幅左", ml:false },
  { t:"input", gc:"43 / 46", gr:"11 / 12", k:"車線数左", ml:false },
  { t:"input", gc:"46 / 50", gr:"11 / 12", k:"車道幅右", ml:false },
  { t:"input", gc:"50 / 53", gr:"11 / 12", k:"車線数右", ml:false },
  { t:"input", gc:"53 / 57", gr:"11 / 12", k:"歩道幅右", ml:false },
  { t:"input", gc:"57 / 61", gr:"11 / 12", k:"地覆幅右", ml:false },
  { t:"input", gc:"61 / 65", gr:"11 / 12", k:"中央帯", ml:false },
  { t:"input", gc:"65 / 69", gr:"11 / 12", k:"中央分離帯", ml:false },
  { t:"label", gc:"20 / 26", gr:"12 / 13", x:"代替路の有無" },
  { t:"select", gc:"26 / 32", gr:"12 / 13", k:"代替路有無", opts:["", "有", "無"] },
  { t:"label", gc:"32 / 38", gr:"12 / 13", x:"自専道or一般道" },
  { t:"select", gc:"38 / 45", gr:"12 / 13", k:"自専道一般道", opts:["", "自専道", "一般道"] },
  { t:"label", gc:"45 / 51", gr:"12 / 13", x:"緊急輸送道路" },
  { t:"select", gc:"51 / 57", gr:"12 / 13", k:"緊急輸送道路", opts:["", "一次", "二次", "三次", "市町村指定", "指定無し"] },
  { t:"label", gc:"57 / 59", gr:"12 / 16", x:"交通条件" },
  { t:"label", gc:"59 / 63", gr:"12 / 13", x:"調  査  年" },
  { t:"input", gc:"63 / 69", gr:"12 / 13", k:"調査年", ml:false },
  { t:"label", gc:"1 / 7", gr:"13 / 16", x:"下部構造形式" },
  { t:"input", gc:"7 / 20", gr:"13 / 16", k:"下部構造形式", ml:true },
  { t:"label", gc:"20 / 26", gr:"13 / 14", x:"路下条件" },
  { t:"label", gc:"38 / 45", gr:"13 / 14", x:"占用物件(名称)" },
  { t:"label", gc:"59 / 63", gr:"13 / 15", x:"交  通  量" },
  { t:"input", gc:"63 / 67", gr:"13 / 14", k:"交通量", ml:false },
  { t:"label", gc:"67 / 69", gr:"13 / 14", x:"台" },
  { t:"label", gc:"20 / 26", gr:"14 / 19", x:"備考" },
  { t:"input", gc:"26 / 57", gr:"14 / 19", k:"備考", ml:true },
  { t:"label", gc:"63 / 69", gr:"14 / 15", x:"昼間12時間" },
  { t:"label", gc:"59 / 63", gr:"15 / 16", x:"大型混入率" },
  { t:"input", gc:"63 / 67", gr:"15 / 16", k:"大型混入率", ml:false },
  { t:"label", gc:"67 / 69", gr:"15 / 16", x:"％" },
  { t:"label", gc:"1 / 7", gr:"16 / 19", x:"基礎形式" },
  { t:"input", gc:"7 / 20", gr:"16 / 19", k:"基礎形式", ml:true },
  { t:"label", gc:"57 / 59", gr:"16 / 19", x:"荷重制限" },
  { t:"label", gc:"59 / 63", gr:"16 / 17", x:"実  施  年" },
  { t:"label", gc:"59 / 63", gr:"17 / 19", x:"制 限 重 量" },
  { t:"input", gc:"63 / 67", gr:"17 / 19", k:"制限重量", ml:false },
  { t:"label", gc:"67 / 69", gr:"17 / 19", x:"ｔ " },
  { t:"input", gc:"26 / 39", gr:"9 / 10", k:"活荷重等級", ml:false },
  { t:"input", gc:"26 / 38", gr:"13 / 14", k:"路下条件", ml:false },
  { t:"input", gc:"45 / 59", gr:"13 / 14", k:"占用物件", ml:true },
  { t:"input", gc:"63 / 67", gr:"16 / 17", k:"荷重制限実施年", ml:false },
  { t:"input", gc:"41 / 46", gr:"1 / 2", k:"起点側緯度", ml:false },
  { t:"input", gc:"41 / 46", gr:"2 / 3", k:"起点側経度", ml:false },
  { t:"input", gc:"51 / 56", gr:"1 / 2", k:"終点側緯度", ml:false },
  { t:"input", gc:"51 / 56", gr:"2 / 3", k:"終点側経度", ml:false },
];

// 入力欄キー一覧（転記・初期化用）
const FORM_KEYS = SHEET.filter(c => c.t === "input").map(c => c.k);

// ラベル文言セルの既定値（編集可・クリアすると出力からも消える）
const DEFAULTS = { "管轄_地方整備局": "地方整備局", "管轄_事務所": "事務所", "管轄_出張所": "出張所" };

// 性能評価総括（2/2）の構成要素行
const PERF_ROWS = [
  { key: "zentai",   label: "橋（全体として）" },
  { key: "joubu",    label: "上部構造" },
  { key: "setsuzoku",label: "上下部接続部" },
  { key: "kabu",     label: "下部構造" },
  { key: "failsafe", label: "その他（フェールセーフ）" },
  { key: "shinshuku",label: "その他（伸縮装置）" },
];
const PERF_COLS = [
  { key: "katsu",  label: "活荷重" },
  { key: "jishin", label: "地震" },
  { key: "gou",    label: "豪雨・出水" },
  { key: "sonota", label: "その他" },
];
// STEP7から自動反映（編集不可）する構成要素。zentai(橋全体)はソース無し＝手動。
const AUTO_KOSEI = new Set(["joubu", "setsuzoku", "kabu", "failsafe", "shinshuku"]);

// bridgeDataから初期値を転記（保存済み優先 → bridgeData同名キー）
function buildInitial(bridgeData, saved) {
  const out = {};
  FORM_KEYS.forEach(k => {
    const hasSavedKey = saved && (k in saved);
    if (k in DEFAULTS) {
      // ラベル文言: 保存済みがあれば空でも尊重（クリア保持）、無ければ既定文言を表示
      out[k] = hasSavedKey ? saved[k] : DEFAULTS[k];
    } else if (saved && saved[k] !== undefined && saved[k] !== "") {
      out[k] = saved[k];
    } else if (bridgeData && bridgeData[k] !== undefined && bridgeData[k] !== null) {
      out[k] = String(bridgeData[k]);
    } else {
      out[k] = "";
    }
  });
  // FIELDS外キー（性能評価perf_系・所見など）も保存済みから全引き継ぎ
  if (saved && typeof saved === "object") {
    Object.keys(saved).forEach(k => { if (!(k in out)) out[k] = saved[k]; });
  }
  return out;
}

function renderText(x) {
  return x.split("\n").map((line, i) => (
    <Fragment key={i}>{i > 0 && <br />}{line}</Fragment>
  ));
}

export default function BridgeInfoForm({ bridgeData, inspectionForm, perfAuto, photoNoMap, onChange, onSave }) {
  const [form, setForm] = useState(() => buildInitial(bridgeData, inspectionForm));
  const [collapsed, setCollapsed] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);
  const editedRef = useRef(false);

  useEffect(() => {
    if (editedRef.current) return;
    setForm(buildInitial(bridgeData, inspectionForm));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeData, inspectionForm]);

  const update = (key, val) => {
    editedRef.current = true;
    const next = { ...form, [key]: val };
    setForm(next);
    onChange && onChange(next);
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave(form);
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 2000);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h4 style={s.title}>点検記録様式 その1（橋梁諸元）</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.toggleBtn} onClick={() => setCollapsed(c => !c)}>
            {collapsed ? "展開 ▼" : "折りたたむ ▲"}
          </button>
          <button style={s.saveBtn} onClick={handleSave}>
            {savedFlag ? "保存しました ✓" : "保存"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ marginTop: 12 }}>
          <p style={s.note}>前回調書から転記された値です。Excel様式（その1 1/2）の配置で確認・編集できます。</p>

          {/* ── その1(1/2) 升目レイアウト ── */}
          <div style={s.sheetScroll}>
            <div style={s.sheet}>
              {SHEET.map((c, i) => {
                const pos = { gridColumn: c.gc, gridRow: c.gr };
                if (c.t === "label") {
                  return <div key={i} style={{ ...s.lbl, ...pos }}>{renderText(c.x)}</div>;
                }
                return (
                  <div key={i} style={{ ...s.inpCell, ...pos }}>
                    {c.t === "select"
                      ? <select style={s.gInput} value={form[c.k] || ""} onChange={e => update(c.k, e.target.value)}>
                          {c.opts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      : c.ml
                      ? <textarea style={s.gInput} value={form[c.k] || ""} onChange={e => update(c.k, e.target.value)} />
                      : <input style={s.gInput} value={form[c.k] || ""} onChange={e => update(c.k, e.target.value)} />
                    }
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 健全性区分（独立） ── */}
          <div style={s.section}>
            <div style={s.sectionLabel}>告示に基づく健全性の診断の区分</div>
            <div style={s.grid}>
              <div>
                <label style={s.fieldLabel}>健全性区分</label>
                <select style={s.input} value={form["健全性区分"] || ""} onChange={e => update("健全性区分", e.target.value)}>
                  <option value=""></option>
                  <option value="Ⅰ">Ⅰ</option>
                  <option value="Ⅱ">Ⅱ</option>
                  <option value="Ⅲ">Ⅲ</option>
                  <option value="Ⅳ">Ⅳ</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── 様式-1 橋梁形式（構造形式一覧より選択） ── */}
          <div style={s.section}>
            <div style={s.sectionLabel}>橋梁形式（様式-1用・構造形式一覧から選択）</div>
            <div style={s.grid}>
              <div>
                <label style={s.fieldLabel}>上部構造</label>
                <select style={s.input} value={form["様式1_上部構造形式"] || ""} onChange={e => update("様式1_上部構造形式", e.target.value)}>
                  {KEISHIKI_JOUHU.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={s.fieldLabel}>下部構造</label>
                <select style={s.input} value={form["様式1_下部構造形式"] || ""} onChange={e => update("様式1_下部構造形式", e.target.value)}>
                  {KEISHIKI_KABU.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={s.fieldLabel}>基礎構造</label>
                <select style={s.input} value={form["様式1_基礎形式"] || ""} onChange={e => update("様式1_基礎形式", e.target.value)}>
                  {KEISHIKI_KISO.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── 性能評価総括（2/2） ── */}
          <div style={s.section}>
            <div style={s.sectionLabel}>性能の評価結果（想定する状況における各構成要素等の状態の評価）</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
                <thead>
                  <tr>
                    <th style={s.th}>構成要素</th>
                    {PERF_COLS.map(c => <th key={c.key} style={s.th} colSpan={3}>{c.label}</th>)}
                  </tr>
                  <tr>
                    <th style={s.thSub}></th>
                    {PERF_COLS.map(c => (
                      <Fragment key={c.key}>
                        <th style={s.thSub}>評価</th>
                        <th style={{ ...s.thSub, background: "#2563eb" }}>点検</th>
                        <th style={{ ...s.thSub, background: "#ea580c" }}>道路橋</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERF_ROWS.map(r => (
                    <tr key={r.key}>
                      <td style={s.tdLabel}>{r.label}</td>
                      {PERF_COLS.map(c => (
                        <Fragment key={c.key}>
                          <td style={s.td}>
                            {(() => {
                              if (r.key === "zentai" && c.key === "sonota") return <div style={s.diagCell} />;
                              const auto = AUTO_KOSEI.has(r.key);
                              const pk = `perf_${r.key}_${c.key}`;
                              const val = auto ? ((perfAuto && perfAuto[pk]) || "") : (form[pk] || "");
                              return (
                                <select style={{ ...s.cellSelect, ...(auto ? { background: "#f1f5f9", color: "#475569" } : {}) }}
                                  value={val} disabled={auto}
                                  onChange={e => update(pk, e.target.value)}>
                                  <option value=""></option>
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                  <option value="C">C</option>
                                  <option value="-">-</option>
                                </select>
                              );
                            })()}
                          </td>
                          <td style={s.td}>
                            {(() => {
                              if (c.key === "sonota") return null;
                              if (r.key === "zentai") return <div style={s.diagCell} />;
                              const v = photoNoMap && photoNoMap.inspection && photoNoMap.inspection[r.key] && photoNoMap.inspection[r.key][c.key];
                              return v ? <div style={{ ...s.choshoPreview, color: "#2563eb" }}>写-{v}</div> : null;
                            })()}
                          </td>
                          <td style={s.td}>
                            {(() => {
                              if (c.key === "sonota") return null;
                              if (r.key === "zentai") return <div style={s.diagCell} />;
                              const v = photoNoMap && photoNoMap.chosho && photoNoMap.chosho[r.key] && photoNoMap.chosho[r.key][c.key];
                              return v ? <div style={{ ...s.choshoPreview, color: "#ea580c" }}>写-{v}</div> : null;
                            })()}
                          </td>
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 所見・診断員 ── */}
          <div style={s.section}>
            <div style={s.sectionLabel}>橋梁診断員所見・確認情報</div>
            <div style={s.grid}>
              <div style={{ gridColumn: "span 2" }}>
                <label style={s.fieldLabel}>現地確認年月日</label>
                <input style={s.input} value={form["現地確認年月日"] || ""} onChange={e => update("現地確認年月日", e.target.value)} />
              </div>
              <div>
                <label style={s.fieldLabel}>橋梁診断員（会社名）</label>
                <input style={s.input} value={form["診断員会社名"] || ""} onChange={e => {
                  const v = e.target.value;
                  editedRef.current = true;
                  const next = { ...form, "診断員会社名": v, "橋梁診断員": `${v} ${form["診断員氏名"] || ""}`.trim() };
                  setForm(next);
                  onChange && onChange(next);
                }} />
              </div>
              <div>
                <label style={s.fieldLabel}>橋梁診断員（氏名）</label>
                <input style={s.input} value={form["診断員氏名"] || ""} onChange={e => {
                  const v = e.target.value;
                  editedRef.current = true;
                  const next = { ...form, "診断員氏名": v, "橋梁診断員": `${form["診断員会社名"] || ""} ${v}`.trim() };
                  setForm(next);
                  onChange && onChange(next);
                }} />
              </div>
              <div style={{ gridColumn: "span 4" }}>
                <label style={s.fieldLabel}>橋梁診断員所見</label>
                <textarea style={s.textarea} rows={4} value={form["診断員所見"] || ""} onChange={e => update("診断員所見", e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap:        { border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, marginBottom: 24, background: "#fff" },
  header:      { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title:       { margin: 0, fontSize: 14, fontWeight: 700, color: "#1e3a5f" },
  toggleBtn:   { padding: "5px 12px", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, background: "#f8fafc", color: "#64748b", cursor: "pointer" },
  saveBtn:     { padding: "5px 16px", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 6, background: "#0d9488", color: "#fff", cursor: "pointer" },
  note:        { fontSize: 11, color: "#94a3b8", margin: "0 0 12px" },

  // 升目グリッド
  sheetScroll: { overflowX: "auto", marginBottom: 20, border: "2px solid #334155", borderRadius: 4 },
  sheet:       { display: "grid", gridTemplateColumns: "repeat(68, minmax(13px, 1fr))", gridAutoRows: "minmax(28px, auto)", minWidth: 900, background: "#fff" },
  lbl:         { background: "#eef2f7", border: "1px solid #94a3b8", fontSize: 10.5, fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "2px 3px", lineHeight: 1.2, whiteSpace: "normal", overflow: "hidden" },
  inpCell:     { border: "1px solid #cbd5e1", display: "flex", background: "#fff" },
  gInput:      { border: 0, width: "100%", fontSize: 11, padding: "2px 4px", background: "transparent", fontFamily: "inherit", resize: "none", boxSizing: "border-box" },

  // 性能評価・所見（従来）
  section:     { marginBottom: 16 },
  sectionLabel:{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8, borderLeft: "3px solid #1e3a5f", paddingLeft: 8 },
  grid:        { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 },
  fieldLabel:  { display: "block", fontSize: 11, color: "#64748b", marginBottom: 3 },
  input:       { width: "100%", padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, boxSizing: "border-box" },
  textarea:    { width: "100%", padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" },
  th:          { border: "1px solid #cbd5e1", background: "#1e3a5f", color: "#fff", padding: "4px 6px", fontWeight: 600, whiteSpace: "nowrap" },
  thSub:       { border: "1px solid #cbd5e1", background: "#475569", color: "#fff", padding: "3px 6px", fontWeight: 500, fontSize: 10 },
  tdLabel:     { border: "1px solid #cbd5e1", background: "#f8fafc", padding: "4px 8px", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" },
  td:          { border: "1px solid #cbd5e1", padding: 2 },
  cellInput:   { width: 56, padding: "4px 5px", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 11, boxSizing: "border-box", textAlign: "center" },
  choshoPreview: { fontSize: 9, color: "#ea580c", marginTop: 2, whiteSpace: "nowrap" },
  diagCell: { height: 20, background: "#e2e8f0", borderRadius: 2 },
  cellSelect:  { width: 56, padding: "4px 5px", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 11, boxSizing: "border-box", textAlign: "center", background: "#fff", cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
};
