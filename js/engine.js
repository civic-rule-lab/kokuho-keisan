function toHalfWidth(str) {
  return String(str)
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[，、,]/g, "");
}

function setupNumericInput(id, options) {
  const el = document.getElementById(id);
  if (!el) return;
  const withCommas = !!(options && options.withCommas);
  let isComposing = false;

  function clean() {
    if (isComposing) return;
    el.value = toHalfWidth(el.value).replace(/[^\d]/g, "");
  }

  function commit() {
    const raw = toHalfWidth(el.value).replace(/[^\d]/g, "");
    if (!raw) { el.value = ""; return; }
    el.value = withCommas ? Number(raw).toLocaleString("ja-JP") : raw;
  }

  el.addEventListener('compositionstart', () => { isComposing = true; });
  el.addEventListener('compositionend', () => {
    isComposing = false;
    setTimeout(commit, 0);
  });
  el.addEventListener('input', clean);
  el.addEventListener('blur', commit);
  el.addEventListener('keydown', (e) => {
    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
      e.preventDefault();
    }
  });
}

// calculateKokuho は js/core/kokuho.js で定義（browser: グローバル、Node: require）

// ─── データ取得（キャッシュ付き） ────────────────────────────────

const _kokuhoDataCache = new Map();

async function loadKokuhoData(city) {
  if (_kokuhoDataCache.has(city)) return _kokuhoDataCache.get(city);
  const promise = (async () => {
    const year = window.PUBLISH_YEAR || 2025;
    const res = await fetch(`/data/municipalities/${city}/kokuho-${year}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error("JSON読み込み失敗");
    return await res.json();
  })();
  _kokuhoDataCache.set(city, promise);
  try {
    return await promise;
  } catch (e) {
    _kokuhoDataCache.delete(city);
    throw e;
  }
}

function getCurrentCity() {
  const params = new URLSearchParams(location.search);
  return (typeof CITY_SLUG !== "undefined" ? CITY_SLUG : null) || params.get("city") || "chigasaki";
}

// ─── DOM アダプター ──────────────────────────────────────────────

async function calc() {
  const result = document.getElementById("result");

  try {
    const inputs = {
      income:             Math.max(0, Number(toHalfWidth(document.getElementById("income").value || "").replace(/[^\d]/g, "")) || 0),
      family:             Math.max(1, Number(toHalfWidth(document.getElementById("family").value || "1")) || 1),
      preschool:          Math.max(0, Number(toHalfWidth(document.getElementById("preschool")?.value || "0")) || 0),
      under18:            Math.max(0, Number(toHalfWidth(document.getElementById("under18")?.value || "0")) || 0),
      care:               Math.max(0, Number(toHalfWidth(document.getElementById("care")?.value || "0")) || 0),
      salaryPensionCount: Math.max(1, Number(toHalfWidth(document.getElementById("salaryPensionCount")?.value || "1")) || 1),
      fixedAssetTax:      Math.max(0, Number(toHalfWidth(document.getElementById("fixedAssetTax")?.value || "0").replace(/[^\d]/g, "")) || 0),
    };

    const city = getCurrentCity();
    const data = await loadKokuhoData(city);

    const r = calculateKokuho(inputs, data);

    // GA4: 計算実行イベント
    if (typeof gtag === 'function') {
      const pathParts = location.pathname.split('/').filter(Boolean);
      gtag('event', 'calculate', {
        prefecture: pathParts[0] || 'unknown',
        city: city,
        calc_type: location.pathname.includes('income') ? 'income' : 'simple'
      });
    }

    result.innerHTML =
      '<div class="result-row"><div class="result-label">医療分</div><div class="amount">' + r.medicalTotal.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">支援分</div><div class="amount">' + r.supportTotal.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">介護分</div><div class="amount">' + r.careTotal.toLocaleString() + ' 円</div></div>' +
      (r.childcareTotal > 0 ? '<div class="result-row"><div class="result-label">子ども・子育て支援金分</div><div class="amount">' + r.childcareTotal.toLocaleString() + ' 円</div></div>' : '') +
      (r.assetLevyTotal > 0 ? '<div class="result-row"><div class="result-label">資産割（内訳）</div><div class="amount">' + r.assetLevyTotal.toLocaleString() + ' 円</div></div>' : '') +
      '<div class="result-row"><div class="result-label">未就学児軽減</div><div class="amount">-' + r.preschoolReduction.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">法定軽減</div><div class="amount">-' + r.totalReduction.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">軽減判定</div><div class="amount">' + r.reductionLabel + '</div></div>' +
      '<div class="result-row"><div class="result-label">年間保険料（概算）</div><div class="amount">約 ' + r.total.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">月額目安</div><div class="amount">約 ' + r.monthly.toLocaleString() + ' 円</div></div>';

  } catch (error) {
    result.innerHTML =
      '<div class="result-label">計算エラー</div>' +
      '<div class="monthly">' + error.message + '</div>';
  }
}

// ─── 75歳以上（後期高齢者医療制度）警告 ──────────────────────────
// 全47都道府県の広域連合公式URL（curl で HTTP 200/301/302 を確認済み 2026-05-01）
// 宮城は http://（https 未対応）、鳥取は広域連合サイト接続不能のため県公式ページ
const KOUKI_URLS = {
  hokkaido:  { name:'北海道後期高齢者医療広域連合',   url:'https://iryokouiki-hokkaido.jp/' },
  aomori:    { name:'青森県後期高齢者医療広域連合',   url:'http://www.aomori-kouikirengou.jp/' },
  iwate:     { name:'岩手県後期高齢者医療広域連合',   url:'https://iwate-kouiki.jp/' },
  miyagi:    { name:'宮城県後期高齢者医療広域連合',   url:'https://www.miyagi-kouiki.jp/' },
  akita:     { name:'秋田県後期高齢者医療広域連合',   url:'https://akita-kouiki.jp/' },
  yamagata:  { name:'山形県後期高齢者医療広域連合',   url:'https://www.yamagata-kouiki.jp/' },
  fukushima: { name:'福島県後期高齢者医療広域連合',   url:'https://www.fukushima-kouiki.jp/' },
  ibaraki:   { name:'茨城県後期高齢者医療広域連合',   url:'https://www.kouiki-ibaraki.jp/' },
  tochigi:   { name:'栃木県後期高齢者医療広域連合',   url:'https://www.kouikirengo-tochigi.jp/' },
  gunma:     { name:'群馬県後期高齢者医療広域連合',   url:'https://www.gunma-kouiki.jp/' },
  saitama:   { name:'埼玉県後期高齢者医療広域連合',   url:'https://www.saitama-koukikourei.org/' },
  chiba:     { name:'千葉県後期高齢者医療広域連合',   url:'https://www.kouiki-chiba.jp/' },
  tokyo:     { name:'東京都後期高齢者医療広域連合',   url:'https://www.tokyo-ikiiki.net/' },
  kanagawa:  { name:'神奈川県後期高齢者医療広域連合', url:'https://www.union.kanagawa.lg.jp/' },
  niigata:   { name:'新潟県後期高齢者医療広域連合',   url:'https://www.niigata-kouiki.jp/' },
  toyama:    { name:'富山県後期高齢者医療広域連合',   url:'https://www.toyama-iryou.jp/' },
  ishikawa:  { name:'石川県後期高齢者医療広域連合',   url:'http://www.ishikawa-kouiki.jp/' },
  fukui:     { name:'福井県後期高齢者医療広域連合',   url:'https://www.fukui-kouiki.or.jp/' },
  yamanashi: { name:'山梨県後期高齢者医療広域連合',   url:'https://www.yamanashi-iryoukouiki.jp/' },
  nagano:    { name:'長野県後期高齢者医療広域連合',   url:'https://www.koukikourei-nagano.jp/' },
  gifu:      { name:'岐阜県後期高齢者医療広域連合',   url:'https://www.gikouiki.jp/' },
  shizuoka:  { name:'静岡県後期高齢者医療広域連合',   url:'https://www.shizuoka-ki.jp/' },
  aichi:     { name:'愛知県後期高齢者医療広域連合',   url:'https://www.aichi-kouiki.jp/' },
  mie:       { name:'三重県後期高齢者医療広域連合',   url:'https://mie-kouiki.jp/' },
  shiga:     { name:'滋賀県後期高齢者医療広域連合',   url:'https://www.shigakouiki.jp/' },
  kyoto:     { name:'京都府後期高齢者医療広域連合',   url:'https://kouiki-kyoto.jp/' },
  osaka:     { name:'大阪府後期高齢者医療広域連合',   url:'https://www.kouikirengo-osaka.jp/' },
  hyogo:     { name:'兵庫県後期高齢者医療広域連合',   url:'https://www.kouiki-hyogo.jp/' },
  nara:      { name:'奈良県後期高齢者医療広域連合',   url:'https://www.nara-kouiki.jp/' },
  wakayama:  { name:'和歌山県後期高齢者医療広域連合', url:'https://kouiki-wakayama.jp/' },
  tottori:   { name:'鳥取県後期高齢者医療広域連合',   url:'http://www.koureikouiki-tottori.jp/' },
  shimane:   { name:'島根県後期高齢者医療広域連合',   url:'http://www.shimane-kouiki.jp/' },
  okayama:   { name:'岡山県後期高齢者医療広域連合',   url:'https://www.kouiki-okayama.jp/' },
  hiroshima: { name:'広島県後期高齢者医療広域連合',   url:'https://www.kouiki-hiroshima.jp/' },
  yamaguchi: { name:'山口県後期高齢者医療広域連合',   url:'http://yamaguchi-kouiki.jp/' },
  tokushima: { name:'徳島県後期高齢者医療広域連合',   url:'https://www.koukikourei-tokushima.jp/' },
  kagawa:    { name:'香川県後期高齢者医療広域連合',   url:'https://kagawa-kouiki.jp/' },
  ehime:     { name:'愛媛県後期高齢者医療広域連合',   url:'https://www.ehime-kouiki.jp/' },
  kochi:     { name:'高知県後期高齢者医療広域連合',   url:'https://www.kochi-kouiki.or.jp/' },
  fukuoka:   { name:'福岡県後期高齢者医療広域連合',   url:'https://www.fukuoka-kouki.jp/' },
  saga:      { name:'佐賀県後期高齢者医療広域連合',   url:'https://www.saga-kouiki.jp/' },
  nagasaki:  { name:'長崎県後期高齢者医療広域連合',   url:'https://www.nagasaki-kouiki.net/' },
  kumamoto:  { name:'熊本県後期高齢者医療広域連合',   url:'https://www.kumamoto-kouikirengo.jp/' },
  oita:      { name:'大分県後期高齢者医療広域連合',   url:'http://oita-kouiki.jp/' },
  miyazaki:  { name:'宮崎県後期高齢者医療広域連合',   url:'https://www.miyazaki-kourei-kouiki.jp/' },
  kagoshima: { name:'鹿児島県後期高齢者医療広域連合', url:'https://www.kagoshima-kouiki.jp/' },
  okinawa:   { name:'沖縄県後期高齢者医療広域連合',   url:'https://www.kouiki-okinawa.com/' },
};
// フォールバック（KOUKI_URLSに未登録の場合 ― 現状は全47県が登録済み）
const KOUKI_FALLBACK_URL = 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryouhoken/koukikourei/index.html';

// 広域連合リンクを都道府県に応じて自動設定
function initOver75Link() {
  const linkEl = document.getElementById('over75Link');
  if (!linkEl) return;
  const prefSlug = window.location.pathname.split('/')[1] || '';
  const info = KOUKI_URLS[prefSlug];
  if (info) {
    linkEl.href = info.url;
    linkEl.textContent = info.name + ' ↗';
  }
}

if (typeof window !== 'undefined') {
  window.calc = calc;

  (function() {
    ['income', 'fixedAssetTax'].forEach(id => setupNumericInput(id, { withCommas: true }));
    ['family', 'preschool', 'care', 'salaryPensionCount', 'under18'].forEach(id => setupNumericInput(id));
    initOver75Link();
  })();

  // ページ読み込み時に任意入力欄を表示制御
  (async function() {
    try {
      const data = await loadKokuhoData(getCurrentCity());
      if (data.childcareLevy && (data.childcareLevy.under18Reduction || data.childcareLevy.perCapitaAdult !== undefined)) {
        const g = document.getElementById("under18Group");
        if (g) g.style.display = "";
      }
      if (data.assetLevy) {
        const group = document.getElementById("assetLevyGroup");
        if (group) group.style.display = "";
      }
    } catch (e) {}
  })();
}
