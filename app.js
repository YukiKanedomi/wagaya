// わが家のお金 — 画面の描画。数値はすべて復号したデータ（D）から計算し、手書きの金額は持たない。
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const man = (v) => Math.round(v / 10000).toLocaleString("ja-JP");            // 円 → 万（整数）
const man1 = (v) => (v / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 1 });
const oku = (m) => (m >= 10000 ? (m / 10000).toFixed(1) + "億" : Math.round(m).toLocaleString("ja-JP") + "万"); // 万円 → 表示
const mon = (ym) => Number(ym.slice(5)) + "月";
const ymd = (s) => s.replace(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/, (_, y, m, d) => `${Number(m)}月${d ? Number(d) + "日" : ""}`);
const RAMP = ["#0E5A45", "#2D7A63", "#529A84", "#7FBAA6", "#AFD6C8", "#DCEEE7"];
const CLS = ["現金", "投資信託", "個別株", "持株会", "元本確保"];
const CLS_LABEL = { 現金: "現金", 投資信託: "投資信託", 個別株: "個別株", 持株会: "持株会", 元本確保: "ニューホープ" };
const store = {
  get(k, d) { try { const v = localStorage.getItem("kakei:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("kakei:" + k, JSON.stringify(v)); } catch { } },
};
let D, simParams;

// ---------- 共通の部品 ----------
const VERD = { good: ["良好", "good"], watch: ["注意", "watch"], act: ["要対応", "act"] };
function evalCards(tab) {
  return `<div class="evals">${D.eval.filter((e) => e.tab === tab).map((e) => `<div class="ev ${VERD[e.verdict][1]}">
    <div class="ev-h"><span class="badge">${VERD[e.verdict][0]}</span><b>${esc(e.title)}</b></div>
    <div class="ev-m">${esc(e.metric)}</div>${e.note ? `<p>${esc(e.note)}</p>` : ""}</div>`).join("")}</div>`;
}
// 横棒で並べて比べる。rows: [[ラベル, 値, 強調?]]
function compareBars(rows, unit = (v) => man(v) + "万") {
  const max = Math.max(...rows.map((r) => r[1]));
  return `<div class="cmp">${rows.map(([l, v, me]) => `<div class="cmp-r ${me ? "me" : ""}"><span>${esc(l)}</span>
    <div class="cmp-b"><i style="width:${Math.max(v / max * 100, 1.5)}%"></i></div><b>${unit(v)}</b></div>`).join("")}</div>`;
}
function spark(vals, w = 92, h = 26) {
  const max = Math.max(...vals, 1), n = vals.length, x = (i) => 2 + (w - 4) * i / (n - 1), y = (v) => h - 3 - (h - 6) * v / max;
  const d = vals.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="${d}" fill="none" stroke="#2D7A63" stroke-width="1.6" stroke-linejoin="round"/><circle cx="${x(n - 1)}" cy="${y(vals[n - 1])}" r="2.6" fill="#0E5A45"/></svg>`;
}
const src = (b) => `${esc(b.name)}（${esc(b.year)}）`;

// ---------- いま ----------
function renderNow() {
  const v = $("#v-now"), cls = CLS.filter((c) => D.byClass[c]), B = D.bench;
  const def = D.ips.defense, f = Math.min(def.pct / 100, 1), C = 2 * Math.PI * 17;
  const r = simulateAll(simParams, D.sim), i60 = 60 - D.sim.ledger.age0;
  const G = D.gains, LOOK = Object.entries(D.look);
  const boj = [["現金・預金", B.boj.cash], ["債券・金・不動産", B.boj.bonds], ["株式", B.boj.stocks + B.boj.funds], ["保険・年金", B.boj.insurance], ["その他", B.boj.other]];
  const MIXC = { "現金・預金": "#C6E35C", "株式": "#0E5A45", "債券・金・不動産": "#7FBAA6", "保険・年金": "#AFD6C8", "その他": "#E4E6EA" };
  const mixBar = (parts, tot) => `<div class="stack tall">${[...parts].sort((a, b) => Object.keys(MIXC).indexOf(a[0]) - Object.keys(MIXC).indexOf(b[0])).map(([k, x]) => `<i style="width:${x / tot * 100}%;background:${MIXC[k]}"></i>`).join("")}</div>`;
  const J = B.jflec;
  v.innerHTML = `
  <div class="hd"><div><div class="d">${ymd(D.asOf)}時点の台帳</div><h1>わが家のいま</h1></div><span class="chip">${D.accounts.length}口座</span></div>
  <div class="bento">
    <div class="t main wide"><div class="l">総資産</div><div class="v">${man(D.total)}<small>万円</small></div>
      <div class="s">${cls.map((c) => `${CLS_LABEL[c]} ${Math.round(D.byClass[c] / D.total * 100)}%`).join("　")}</div>
      <div class="stack">${cls.map((c, i) => `<i style="width:${D.byClass[c] / D.total * 100}%;background:rgba(255,255,255,${[1, .78, .56, .38, .22][i]})"></i>`).join("")}</div></div>
    <div class="t acc"><div class="l">生活防衛資金</div><div class="v">${Math.round(def.pct)}<small>%</small></div>
      <div class="s">${def.pct >= 100 ? `目標${man(def.target)}万を達成` : `目標${man(def.target)}万まで<br>あと${man(def.target - def.actual)}万`}</div>
      <svg class="ring" width="44" height="44"><circle cx="22" cy="22" r="17" stroke="#16181D" opacity=".15" stroke-width="6" fill="none"/><circle cx="22" cy="22" r="17" stroke="#16181D" stroke-width="6" fill="none" stroke-dasharray="${C * f} ${C}" transform="rotate(-90 22 22)" stroke-linecap="round"/></svg></div>
    <div class="t tint" data-go="future"><div class="l">60歳の見通し</div><div class="v">${oku(r.mid.total[i60]).replace(/(億|万)$/, "<small>$1円</small>")}</div>
      <div class="s">悲観 ${oku(r.pess.total[i60])}〜楽観 ${oku(r.opt.total[i60])}</div><span class="sample">未来タブの前提で試算</span></div>
    <div class="t plain wide"><div class="l" style="color:var(--mut)">運用でふえた分（取得価額が分かる口座）</div>
      <div class="v" style="color:var(--m)">+${man(G.gain)}<small>万円</small></div>
      <div class="s" style="color:var(--mut)">${man(G.covered)}万円のうち、入れたお金は${man(G.covered - G.gain)}万円。${Math.round(G.gain / (G.covered - G.gain) * 100)}%ふえています。</div>
      <div class="stack"><i style="width:${(G.covered - G.gain) / G.covered * 100}%;background:#AFD6C8"></i><i style="width:${G.gain / G.covered * 100}%;background:var(--m)"></i></div>
      <div class="keys">${G.parts.map((p) => `<div><span>${esc(p.name)}</span><b class="${p.gain >= 0 ? "pos" : "neg"}">${p.gain >= 0 ? "+" : ""}${man1(p.gain)}万</b></div>`).join("")}</div></div>
  </div>

  <div class="sec">番頭の評価</div>
  ${evalCards("now")}

  <div class="sec">世の中と比べると</div>
  <div class="card">
    <div class="card-h">金融資産の額</div>
    ${compareBars([["わが家", D.total, true], ["30代の平均", J.thirties.mean], ["30代の中央値", J.thirties.median], ["同じ手取り帯の平均", J.byIncome.mean], ["同じ手取り帯の中央値", J.byIncome.median]])}
    <p class="src">二人以上世帯。平均は一部のお金持ちに引っぱられるので、真ん中の世帯を表す中央値も並べています。同じ手取り帯＝世帯の手取り${esc(J.byIncome.label.replace("手取り", ""))}（年齢はさまざま）。出典: ${src(J)}</p>
  </div>
  <div class="card">
    <div class="card-h">資産の中身（投資信託は中身で分けて集計）</div>
    <div class="mix-l">わが家</div>${mixBar(LOOK, D.total)}
    <div class="mix-l">日本の家計全体</div>${mixBar(boj, 100)}
    <div class="legend" style="margin:12px 0 0">${Object.keys(MIXC).map((k) => `<span><i style="background:${MIXC[k]}"></i>${k}</span>`).join("")}</div>
    <div class="mixtbl">${LOOK.map(([k, x]) => `<div><span>${k}</span><b>${Math.round(x / D.total * 100)}%</b><em>${Math.round((boj.find((b) => b[0] === k) || [0, 0])[1])}%</em></div>`).join("")}</div>
    <p class="src">右の灰色の数字が日本の家計全体。出典: ${src(B.boj)}</p>
  </div>

  <div class="sec">口座ごとの残高</div>
  <div class="list">${D.accounts.map((a) => `<div class="row"><span class="dot" style="background:${RAMP[CLS.indexOf(a.cls)]}"></span>
    <div class="n">${esc(a.name)}<small>${CLS_LABEL[a.cls]}${a.asOf ? "・" + ymd(a.asOf) : ""}</small></div><div class="v">${man(a.v)}<small style="font-size:11px;font-weight:500">万円</small></div></div>`).join("")}</div>
  <p class="note">残高は月次レビューで台帳を更新した時点の値です。株価・投信の基準価額は日々動きます。持株会は取得価額が台帳に無いため「ふえた分」に入れていません。</p>
  <div class="foot"><span>データ作成 ${ymd(D.generatedAt)}</span><button id="forget">この端末の鍵を消す</button></div>`;
  $("#forget").onclick = async () => { await Vault.forget(); location.reload(); };
}

// ---------- 流れ ----------
const SPC = { fixed: ["固定費", "#0E5A45"], var: ["変動費", "#7FBAA6"], special: ["特別費（旅行・家電・結婚）", "#C6E35C"] };
const SCOPE = { all: "世帯全体", kyotsu: "共通", kojin: "個人（夫）" };
const SCOPE_NOTE = {
  all: "共通カード＋家賃（共通口座からの口座振替）＋夫の個人カード＋ビューカード（Suica）",
  kyotsu: "共通カード（ゴールドNL）＋家賃・駐車場（共通口座からの口座振替）",
  kojin: "夫の個人カード（三井住友VISA）＋ビューカード（Suicaチャージ）",
};
const GROUPS = (scope) => (scope === "all" ? ["kyotsu", "kojin"] : [scope]);
const sum = (a) => a.reduce((x, y) => x + y, 0);

function barChart(months, key, gs) {
  const W = 340, H = 180, pl = 30, pb = 22, pt = 10, n = months.length, bw = (W - pl) / n * 0.64;
  const cls = (m, c) => sum(gs.map((g) => m[g][c]));
  const parts = (m) => key === "spend" ? [[cls(m, "fixed"), SPC.fixed[1]], [cls(m, "var"), SPC.var[1]], [cls(m, "special"), SPC.special[1]]] : [[m.salary, RAMP[0]], [m.bonus, "#C6E35C"]];
  const tot = months.map((m) => sum(parts(m).map((p) => p[0])));
  const max = Math.max(...tot) * 1.08, avgN = Math.min(12, n), avg = sum(tot.slice(-avgN)) / avgN;
  const y = (v) => pt + (H - pt - pb) * (1 - v / max), x = (i) => pl + (W - pl) / n * (i + 0.5);
  let g = "";
  for (const f of [0.5, 1]) { const v = max * f; g += `<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#ECEDF0"/><text x="${pl - 4}" y="${y(v) + 4}" font-size="9.5" fill="#9A9DA5" text-anchor="end">${Math.round(v / 10000)}万</text>`; }
  months.forEach((m, i) => {
    let base = 0;
    for (const [v, c] of parts(m)) { if (v > 0) g += `<rect x="${x(i) - bw / 2}" y="${y(base + v)}" width="${bw}" height="${y(base) - y(base + v)}" rx="2.5" fill="${c}"/>`; base += v; }
    const mm = Number(m.m.slice(5));
    g += `<text x="${x(i)}" y="${H - 6}" font-size="9" fill="${mm === 1 ? "#16181D" : "#9A9DA5"}" font-weight="${mm === 1 ? 700 : 400}" text-anchor="middle">${mm === 1 ? m.m.slice(2, 4) + "/1" : mm}</text>`;
  });
  g += `<line x1="${pl}" x2="${W}" y1="${y(avg)}" y2="${y(avg)}" stroke="#E0663A" stroke-dasharray="3 3" stroke-width="1.4"/>`;
  g += `<rect x="${pl + 2}" y="${y(avg) - 17}" width="92" height="14" rx="4" fill="#fff" opacity=".92"/><text x="${pl + 6}" y="${y(avg) - 6}" font-size="10" fill="#E0663A" font-weight="700">12か月平均 ${man1(avg)}万</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}

function fixedList(gs) {
  const items = D.spend.fixedItems;
  return gs.map((g) => {
    const its = items.filter((i) => i.g === g), tot = sum(its.map((i) => i.v));
    return `<div class="fx-h"><b>${g === "kyotsu" ? "共通" : "個人（夫）"}</b><span>月 ${tot.toLocaleString("ja-JP")}円</span></div>
    <div class="list">${its.map((i) => `<div class="row"><div class="n">${esc(i.name)}<small>${esc(i.cat)}・${esc(i.freq)}</small></div>
      <div class="v">${i.v.toLocaleString("ja-JP")}<small style="font-size:11px;font-weight:500">円</small></div></div>`).join("")}</div>
    ${annualList(g)}`;
  }).join("");
}

function annualList(g) {
  const its = (D.spend.annual || []).filter((i) => i.g === g);
  if (!its.length) return "";
  const yen = (v) => v.toLocaleString("ja-JP");
  const sub = (i) => i.yearly === 0 ? `前回 ${i.last.slice(0, 7).replace("-", "年")}月の後は請求なし`
    : `${i.month ? `毎年${i.month}月` : "更新月は未確認"}・年${yen(i.yearly)}円${i.usd ? `（${i.usd}ドルの概算）` : ""}`;
  return `<div class="fx-h fx-sub"><b>年払い</b><span>年 ${yen(sum(its.map((i) => i.yearly)))}円＝月 ${yen(sum(its.map((i) => i.v)))}円</span></div>
    <div class="list">${its.map((i) => `<div class="row${i.yearly === 0 ? " off" : ""}"><div class="n">${esc(i.name)}<small>${esc(sub(i))}${i.note ? `<br>${esc(i.note)}` : ""}</small></div>
      <div class="v">${yen(i.v)}<small style="font-size:11px;font-weight:500">円/月</small></div></div>`).join("")}</div>`;
}

function renderFlow() {
  const v = $("#v-flow"), sp = D.spend, mode = store.get("flowMode", "spend"), B = D.bench, S = D.save;
  const scope = store.get("flowScope", "all"), gs = GROUPS(scope), all = scope === "all";
  const ms = sp.months, n = ms.length, last = ms[n - 1];
  const cls = (m, c) => sum(gs.map((g) => m[g][c]));
  const tot = (m) => cls(m, "fixed") + cls(m, "var") + cls(m, "special");
  const core12 = sum(ms.slice(-12).map((m) => cls(m, "fixed") + cls(m, "var"))) / 12;
  const special12 = sum(ms.slice(-12).map((m) => cls(m, "special")));
  const ly = ms.find((m) => m.m === (Number(last.m.slice(0, 4)) - 1) + last.m.slice(4));
  const catRows = Object.entries(sp.cats).filter(([k]) => !["結婚・引越（一時）", "税・ふるさと納税"].includes(k)).map(([k, byG]) => {
    const vals = byG.kyotsu.map((_, i) => sum(gs.map((g) => byG[g][i])));
    if (!sum(vals.slice(-12))) return "";
    const a12 = sum(vals.slice(-12)) / 12, a3 = sum(vals.slice(-3)) / 3;
    const d = a12 ? (a3 - a12) / a12 * 100 : 0, flat = Math.abs(d) < 15;
    return `<div class="row"><div class="n">${esc(k)}<small>${{ fixed: "固定費", var: "変動費", special: "特別費" }[sp.catClass[k]]}・12か月平均 ${man1(a12)}万</small></div>
      ${spark(vals)}<div class="v trend">${man1(a3)}万<span class="delta ${flat ? "" : d > 0 ? "up" : "down"}">${flat ? "横ばい" : (d > 0 ? "+" : "") + Math.round(d) + "%"}</span></div></div>`;
  }).join("");
  const inc = D.income, ni = inc.length;
  const yr = (from, to) => inc.filter((r) => r.m >= from && r.m <= to);
  const base26 = yr("2026-04", "2026-06"), base25 = yr("2025-04", "2025-06");
  const avgSal = (rs) => sum(rs.map((r) => r.salary)) / rs.length;
  const K = B.kakei.workers;
  const amz = sum(["Amazon通販", "その他"].flatMap((k) => ["kyotsu", "kojin"].map((g) => sum(sp.cats[k][g].slice(-12))))) / 12;
  v.innerHTML = `
  <div class="hd"><div><div class="d">明細 ${ms[0].m.replace("-", "年")}月〜</div><h1>お金の流れ</h1></div><span class="chip">${n}か月分</span></div>
  <div class="seg" id="scopeSeg">${Object.entries(SCOPE).map(([k, t]) => `<button data-s="${k}" class="${scope === k ? "on" : ""}">${t}</button>`).join("")}</div>
  <div class="bento">
    <div class="t main wide"><div class="l">ひと月の支出（12か月平均・特別費除く）</div><div class="v">${man(core12)}<small>万円</small></div>
      <div class="s">${scope !== "kojin" ? `うち家賃・駐車場 ${man(sp.rent)}万円。` : ""}特別費を入れると${man(core12 + special12 / 12)}万円。${all ? `<br>${esc(B.kakei.basisShort)}は ${man(K.consumption)}万円（持ち家込み）` : ""}</div></div>
    ${all ? `<div class="t acc"><div class="l">先取り貯蓄</div><div class="v">${S.rate}<small>%</small></div><div class="s">年${man(S.autoTotal)}万円<br>世帯手取りに対して</div></div>` : ""}
    <div class="t tint${all ? "" : " wide"}"><div class="l">特別費（12か月）</div><div class="v">${man(special12)}<small>万円</small></div><div class="s">旅行・家電・結婚関連</div></div>
  </div>
  <p class="note">${esc(SCOPE[scope])}＝${esc(SCOPE_NOTE[scope])}。妻の個人カード・車のリース（妻側払い）と積立は含みません。${scope !== "kyotsu" && Object.keys(sp.commute || {}).length ? `通勤定期（${Object.entries(sp.commute).map(([m, v]) => `${Number(m.slice(5))}月 ${man1(v)}万`).join("・")}）は会社の交通費で戻るので除いています。` : ""}</p>

  ${all ? `<div class="sec">番頭の評価</div>${evalCards("flow")}` : ""}

  <div class="sec">固定費の一覧（ひと月あたり）</div>
  ${fixedList(gs)}
  <p class="note">直近の明細から、毎月かかっている支払先を拾っています。水道光熱は季節で変わるので12か月の平均です。年払いは台帳に載せたもので、カードに請求があるものは最新の額で更新しています。月割は目安で、上の支出にはその月の実額で入っています。</p>

  <div class="sec">月ごとの推移</div>
  <div class="seg" id="flowSeg"><button data-m="spend" class="${mode === "spend" ? "on" : ""}">出ていくお金</button><button data-m="income" class="${mode === "income" ? "on" : ""}">入るお金（夫の手取り）</button></div>
  ${mode === "spend" ? `
    <div class="legend">${Object.values(SPC).map(([t, c]) => `<span><i style="background:${c}"></i>${t}</span>`).join("")}</div>
    <div class="chart">${barChart(ms, "spend", gs)}</div>
    ${ly ? `<div class="yoy"><div><span>${mon(last.m)}支払</span><b>${man(tot(last))}万</b></div><div><span>去年の${mon(ly.m)}</span><b>${man(tot(ly))}万</b></div>
      <div><span>差</span><b class="${tot(last) > tot(ly) ? "up" : "down"}">${tot(last) > tot(ly) ? "+" : ""}${man(tot(last) - tot(ly))}万</b></div></div>` : ""}
    <p class="note">横軸は支払月。${scope !== "kojin" ? `家賃は直近3か月の口座振替の平均（${man1(sp.rent)}万円）を毎月に置いています。` : ""}</p>` : `
    <div class="legend"><span><i style="background:${RAMP[0]}"></i>給与</span><span><i style="background:#C6E35C"></i>賞与</span><span>ゆうちょ入金ベース</span></div>
    <div class="chart">${barChart(inc, "income")}</div>
    <div class="yoy"><div><span>4〜6月の給与（今年）</span><b>${man1(avgSal(base26))}万</b></div><div><span>去年の同時期</span><b>${man1(avgSal(base25))}万</b></div>
      <div><span>差</span><b>${avgSal(base26) >= avgSal(base25) ? "+" : ""}${Math.round((avgSal(base26) / avgSal(base25) - 1) * 100)}%</b></div></div>
    <p class="note">夫の口座への振込額（手取り）。1月・7月は交通費（定期代）と年末調整が乗っています。${mon(inc[ni - 1].m)}分まで反映。</p>`}

  <div class="sec">費目ごとの動き（直近3か月の平均）</div>
  <div class="list cats">${catRows}</div>
  <p class="note">線は${n}か月の推移。右の％は12か月平均と比べた直近3か月の増減です（±15%以内は横ばい）。</p>

  ${all ? `<div class="sec">世の中と比べると</div>
  <div class="card">
    <div class="card-h">費目別（ひと月あたり）</div>
    <div class="pair-l"><span><i style="background:var(--m)"></i>わが家（12か月平均）</span><span><i style="background:#D5D8DD"></i>${esc(B.kakei.basisShort)}</span></div>
    ${D.compare.filter((c) => c.name !== "住まい（家賃）").map((c, _, cs) => { const mx = Math.max(...cs.flatMap((x) => [x.ours, x.avg])); return `<div class="pair"><span>${esc(c.name)}</span>
      <div class="pb"><i class="o" style="width:${c.ours / mx * 100}%"></i><i class="a" style="width:${c.avg / mx * 100}%"></i></div>
      <b>${man1(c.ours)}<em>${man1(c.avg)}</em></b></div>`; }).join("")}
    <p class="src">単位は万円。家賃（わが家${man1(D.compare[0].ours)}万・平均の世帯の住居費${man1(D.compare[0].avg)}万）は差が大きいので外しています。食費は外食を除き、娯楽・旅行はサブスクを含みます。平均の世帯は${esc(B.kakei.basisNote)}。わが家の数字は明細の分類によるもので、Amazon・その他（月${man1(amz)}万円）は比べていません。出典: ${src(B.kakei)}</p>
  </div>
  <div class="card">
    <div class="card-h">年収（額面）</div>
    ${compareBars([["夫", D.incomeInfo.selfGross, true], ["妻", D.incomeInfo.spouseGross, true], ["30代前半男性の平均", B.nta.m30_34], ["30代前半女性の平均", B.nta.f30_34], ["全体の平均", B.nta.avg]])}
    <p class="src">夫は2025年度の給与明細、妻は本人申告。出典: ${src(B.nta)}</p>
  </div>` : ""}`;
  $("#flowSeg").onclick = (e) => { const m = e.target.dataset.m; if (m) { store.set("flowMode", m); renderFlow(); } };
  $("#scopeSeg").onclick = (e) => { const s = e.target.dataset.s; if (s) { store.set("flowScope", s); renderFlow(); } };
}

// ---------- 未来 ----------
const SLIDERS = [
  { k: "invMonthly", t: "毎月の積立", u: "万円", min: 0, max: 25, step: 0.5 },
  { k: "living", t: "世帯の生活費（年）", u: "万円", min: 400, max: 800, step: 10 },
  { k: "inflation", t: "物価上昇率", u: "%", min: 0, max: 3, step: 0.5 },
];
const SEGS = [
  { k: "nKids", t: "子ども", opts: [[0, "なし"], [1, "1人"], [2, "2人"], [3, "3人"]] },
  { k: "eduCourse", t: "教育", opts: [[0, "公立中心"], [1, "私立あり"]] },
  { k: "buyHouse", t: "住まい", opts: [[0, "賃貸のまま"], [1, "38歳で購入"]] },
];

function fanChart(r, toAge) {
  const a0 = D.sim.ledger.age0, N = toAge - a0 + 1;
  const S = { pess: r.pess.total.slice(0, N), mid: r.mid.total.slice(0, N), opt: r.opt.total.slice(0, N) };
  const W = 340, H = 200, pl = 8, pr = 46, pt = 12, pb = 22, max = Math.max(...S.opt) * 1.06;
  const x = (i) => pl + (W - pl - pr) * i / (N - 1), y = (v) => pt + (H - pt - pb) * (1 - Math.max(v, 0) / max);
  const path = (a) => a.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  const area = "M" + S.opt.map((v, i) => `${x(i)} ${y(v)}`).join(" L") + " L" + S.pess.map((v, i) => `${x(i)} ${y(v)}`).reverse().join(" L") + "Z";
  let g = `<defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2D7A63" stop-opacity=".22"/><stop offset="1" stop-color="#2D7A63" stop-opacity=".03"/></linearGradient></defs>`;
  [0.33, 0.66].forEach((f) => g += `<line x1="${pl}" x2="${W - pr}" y1="${pt + (H - pt - pb) * f}" y2="${pt + (H - pt - pb) * f}" stroke="#ECEDF0"/>`);
  g += `<path d="${area}" fill="url(#fg)"/>`;
  g += `<path d="${path(S.opt)}" stroke="#7FBAA6" stroke-width="1.6" fill="none"/><path d="${path(S.pess)}" stroke="#E0663A" stroke-width="1.6" fill="none" stroke-dasharray="4 3"/>`;
  g += `<path d="${path(S.mid)}" stroke="#0E5A45" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  const now = D.total / 10000;
  g += `<circle cx="${x(0)}" cy="${y(now)}" r="9" fill="#C6E35C" opacity=".7"/><circle cx="${x(0)}" cy="${y(now)}" r="4.5" fill="#0E5A45"/>`;
  const ticks = toAge <= 60 ? [40, 50, 60] : [40, 50, 60, 70, 80, 90];
  ticks.forEach((t) => g += `<text x="${x(t - a0)}" y="${H - 6}" font-size="10" fill="#9A9DA5" text-anchor="middle">${t}${t === ticks[ticks.length - 1] ? "歳" : ""}</text>`);
  [["opt", "#2D7A63"], ["mid", "#0E5A45"], ["pess", "#E0663A"]].forEach(([k, c]) => g += `<text x="${W - pr + 5}" y="${y(S[k][N - 1]) + 4}" fill="${c}" font-size="10.5" font-weight="700">${oku(S[k][N - 1])}</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="資産の見通し">${g}</svg>`;
}

function renderFuture() {
  const v = $("#v-future"), toAge = store.get("toAge", 60), r = simulateAll(simParams, D.sim), a0 = D.sim.ledger.age0;
  const at = (s, age) => s.total[age - a0];
  const ages = [40, 50, 60, 65, 90];
  const broke = r.pess.bankruptAge;
  v.innerHTML = `
  <div class="hd"><div><div class="d">楽観8%・中立5%・悲観2%（名目）</div><h1>お金の未来</h1></div><span class="chip">今日の円で表示</span></div>
  <div class="fan">
    <div class="big"><div style="font-size:12px;color:var(--mut);font-weight:700">${toAge}歳時点（中立）</div>
      <div style="font-size:32px;font-weight:800;letter-spacing:-.02em;line-height:1.2">${oku(at(r.mid, toAge))}<small style="font-size:15px">円</small></div></div>
    <div class="seg" style="margin:10px 8px 6px" id="ageSeg"><button data-a="60" class="${toAge === 60 ? "on" : ""}">60歳まで</button><button data-a="90" class="${toAge === 90 ? "on" : ""}">90歳まで</button></div>
    ${fanChart(r, toAge)}
    <div class="legend" style="margin:6px 8px 4px"><span><i style="background:#0E5A45"></i>中立</span><span><i style="background:#7FBAA6"></i>楽観</span><span><i style="background:#E0663A"></i>悲観</span><span><i style="background:#C6E35C"></i>いま</span></div>
  </div>
  ${broke ? `<div class="warnbox">悲観シナリオでは ${broke}歳で資金が底をつきます。前提を見直す目安にしてください。</div>` : ""}
  <div class="ctl">
    ${SLIDERS.map((s) => `<div class="sl"><label>${s.t}<b>${simParams[s.k]}${s.u}</b></label><input type="range" data-k="${s.k}" min="${s.min}" max="${s.max}" step="${s.step}" value="${simParams[s.k]}"></div>`).join("")}
    ${SEGS.map((s) => `<div class="sl"><label>${s.t}</label><div class="seg" data-k="${s.k}">${s.opts.map(([val, t]) => `<button data-v="${val}" class="${simParams[s.k] === val ? "on" : ""}">${t}</button>`).join("")}</div></div>`).join("")}
  </div>
  <button class="reset" id="simReset">前提を既定値に戻す</button>
  <div class="sec">年齢ごとの資産（金融資産・万円）</div>
  <div class="list" style="padding:4px 12px 8px"><table class="tbl"><tr><th>年齢</th><th>悲観</th><th>中立</th><th>楽観</th></tr>
    ${ages.map((a) => `<tr><td>${a}歳</td><td>${oku(at(r.pess, a))}</td><td class="mid">${oku(at(r.mid, a))}</td><td>${oku(at(r.opt, a))}</td></tr>`).join("")}</table></div>
  <p class="note">いまの点は台帳の総資産（${man(D.total)}万円）、線は各年末の試算です。年金は給付調整${simParams.pensAdj}%を織り込み、子どもは${D.sim.consts.firstKidAge}歳から${D.sim.consts.kidGap}年ごと。相場の予測ではなく、前提を置いたときの幅です。</p>`;
  v.querySelectorAll("input[type=range]").forEach((el) => {
    el.oninput = () => { simParams[el.dataset.k] = Number(el.value); el.previousElementSibling.querySelector("b").textContent = el.value + SLIDERS.find((s) => s.k === el.dataset.k).u; };
    el.onchange = () => { store.set("sim", simParams); renderFuture(); renderNow(); };
  });
  v.querySelectorAll(".seg[data-k]").forEach((el) => el.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    simParams[el.dataset.k] = Number(b.dataset.v); store.set("sim", simParams); renderFuture(); renderNow();
  });
  $("#ageSeg").onclick = (e) => { const a = e.target.dataset.a; if (a) { store.set("toAge", Number(a)); renderFuture(); } };
  $("#simReset").onclick = () => { simParams = { ...D.sim.defaults }; store.set("sim", null); renderFuture(); renderNow(); };
}

// ---------- タブ・起動 ----------
function go(tab) {
  document.querySelectorAll(".view").forEach((s) => s.hidden = s.dataset.tab !== tab);
  document.querySelectorAll("#tabbar button").forEach((b) => b.classList.toggle("on", b.dataset.go === tab));
  if (location.hash.slice(1) !== tab) history.replaceState(null, "", "#" + tab);
  scrollTo(0, 0);
}

function start(data) {
  D = data;
  simParams = { ...D.sim.defaults, ...(store.get("sim", null) || {}) };
  $("#lock").hidden = true; $("#app").hidden = false; $("#tabbar").hidden = false;
  renderNow(); renderFlow(); renderFuture();
  document.body.addEventListener("click", (e) => { const t = e.target.closest("[data-go]"); if (t) go(t.dataset.go); });
  const h = location.hash.slice(1);
  go(["now", "flow", "future"].includes(h) ? h : "now");
}

(async () => {
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { });
  let enc;
  try { enc = await Vault.fetchEnc(); } catch (e) { $("#lock").hidden = false; $("#lockMsg").textContent = "データを読み込めませんでした。通信を確認してください。"; return; }
  const saved = await Vault.unlockWithSaved(enc);
  if (saved) return start(saved);
  $("#lock").hidden = false;
  $("#lockForm").onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("#unlockBtn"), msg = $("#lockMsg");
    btn.disabled = true; btn.textContent = "確認しています…"; msg.textContent = "";
    try { start(await Vault.unlock(enc, $("#pass").value)); }
    catch { msg.textContent = "合言葉が違います。"; btn.disabled = false; btn.textContent = "開く"; }
  };
})();
