// ライフプランの計算モデル（単位: 万円・年次）。simulator/model.js の公開版。
// 個人の数値は持たない: 起点・固定値・既定値はすべて暗号化データ（sim.ledger / sim.consts / sim.defaults）から渡す。
// 前提はすべて「今日の円」（賃金・生活費・年金は物価調整せず、リターンは名目→実質に換算）。

const EDU = [
  // 子の年齢帯ごとの追加費用 万円/年 [0-6, 7-12, 13-15, 16-18, 19-22]（養育+教育の概算）
  [50, 60, 80, 90, 150],   // 公立中心
  [60, 80, 130, 130, 200], // 私立混合
];

function kidCost(courseIdx, kidAge) {
  if (kidAge < 0 || kidAge > 22) return 0;
  const c = EDU[courseIdx];
  if (kidAge <= 6) return c[0];
  if (kidAge <= 12) return c[1];
  if (kidAge <= 15) return c[2];
  if (kidAge <= 18) return c[3];
  return c[4];
}

function pensions(p, K) {
  const kisoH = K.kiso * Math.min(480, K.hMonths) / 480;
  const kouseiH = p.avgH * 5.481 * K.hMonths / 1000;
  const kouseiW = p.avgW * 5.481 * K.wMonths / 1000;
  const adj = p.pensAdj / 100;
  return { h: (kisoH + kouseiH) * adj, w: (K.kiso + kouseiW) * adj };
}

function loanPayment(L, ratePct, years) {
  const r = ratePct / 100;
  if (r === 0) return L / years;
  return L * r / (1 - Math.pow(1 + r, -years));
}

// 1シナリオを回す。戻り: {total[], netWorth[], bankruptAge}（配列の添字0 = age0 歳の年末）
function run(p, riskRate, L, K) {
  let risk = L.risk0, safe = L.safe0;
  let loanBal = 0, annuity = 0, houseVal = 0;
  const inf = (p.inflation ?? 0) / 100;
  const rr = (1 + riskRate) / (1 + inf) - 1;
  const sr = 1.005 / (1 + inf) - 1;
  const pens = pensions(p, K);
  const kidsBirth = Array.from({ length: p.nKids }, (_, i) => K.firstKidAge + i * K.kidGap);
  const total = [], netWorth = [];
  let bankruptAge = null;

  for (let a = L.age0; a <= 90; a++) {
    const w = a - L.wifeDiff;
    const g = Math.pow(1 + p.growth / 100, Math.min(Math.max(a - L.age0, 0), 22));

    let inc = 0;
    if (a < 60) inc += p.netH * g;
    else if (a < 65) inc += p.netH * Math.pow(1 + p.growth / 100, 22) * (p.reemploy / 100);
    if (w < 60) {
      let wInc = p.netW * g;
      for (const b of kidsBirth) { // 産育休・時短の減収
        if (a === b) wInc *= 0.6;
        else if (a === b + 1) wInc *= 0.8;
        else if (a >= b + 2 && a <= b + 4) wInc *= 0.9;
      }
      inc += wInc;
    }
    for (const b of kidsBirth) if (a - b >= 0 && a - b < 18) inc += 12; // 児童手当
    if (a >= 65) inc += pens.h;
    if (w >= 65) inc += pens.w;
    if (a === 60) safe += p.retirePay;
    if (w === 60) safe += p.retirePay * 0.9;

    let rentPart = K.rent;
    let housing = 0;
    if (p.buyHouse && a >= p.buyAge) {
      if (a === p.buyAge) {
        safe -= p.down + p.price * 0.07;
        loanBal = p.price - p.down;
        annuity = loanPayment(loanBal, p.rate, 35);
        houseVal = p.price;
      }
      rentPart = 0;
      if (loanBal > 0.01) {
        const interest = loanBal * p.rate / 100;
        loanBal = Math.max(0, loanBal - (annuity - interest));
        housing += annuity / Math.pow(1 + inf, a - p.buyAge);
      }
      housing += p.price * 0.012;
      houseVal = p.price * (0.4 + 0.6 * Math.max(0, 1 - (a - p.buyAge) / 40));
    }
    const nonRent = p.living - K.rent;
    let livingNow = (a >= 65 ? nonRent * (p.oldRate / 100) : nonRent) + rentPart;
    livingNow += p.yutori + (a >= 65 ? p.wifeSpend * p.oldRate / 100 : p.wifeSpend);
    let kids = 0;
    for (const b of kidsBirth) kids += kidCost(p.eduCourse, a - b);

    const invest = a < 60 ? p.invMonthly * 12 + p.bonusInvest : 0;
    const surplus = inc - livingNow - kids - housing - invest;
    risk += invest + (a < 60 ? K.kabuBonus : 0);
    safe += (a < 60 ? K.nhope : 0) + surplus;
    if (safe < 0) { risk += safe; safe = 0; }
    if (risk < 0 && bankruptAge === null) bankruptAge = a;

    risk *= 1 + rr;
    safe *= 1 + sr;
    total.push(risk + safe);
    netWorth.push(risk + safe + (p.buyHouse && a >= p.buyAge ? houseVal - loanBal : 0));
  }
  return { total, netWorth, bankruptAge };
}

function simulateAll(p, sim) {
  const L = sim.ledger, K = sim.consts;
  return { pess: run(p, 0.02, L, K), mid: run(p, 0.05, L, K), opt: run(p, 0.08, L, K), pens: pensions(p, K) };
}

if (typeof module !== "undefined") module.exports = { simulateAll, pensions };
