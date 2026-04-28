function toHalfWidth(str) {
  return String(str)
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[，、,]/g, "");
}

function formatNumber(input) {
  const raw = toHalfWidth(input.value).replace(/[^\d]/g, "");
  input.value = raw ? Number(raw).toLocaleString("ja-JP") : "";
}

// ─── 計算ロジック（純粋関数） ────────────────────────────────────

function calculateKokuho(data, inputs) {
  const { income, family, preschool, under18, care, salaryPensionCount, fixedAssetTax } = inputs;

  // 資産割
  const assetLevyMedical = data.assetLevy ? Math.round(fixedAssetTax * (data.assetLevy.medical || 0)) : 0;
  const assetLevySupport = data.assetLevy ? Math.round(fixedAssetTax * (data.assetLevy.support || 0)) : 0;
  const assetLevyCare    = data.assetLevy ? Math.round(fixedAssetTax * (data.assetLevy.care    || 0)) : 0;

  const baseIncome = Math.max(income - data.basicDeduction, 0);

  // 所得割
  const medicalIncome = Math.round(baseIncome * data.rate.medical);
  const supportIncome = Math.round(baseIncome * data.rate.support);
  const careIncome    = care > 0 ? Math.round(baseIncome * data.rate.care) : 0;

  // 均等割
  const medicalPerCapita = family * data.perCapita.medical;
  const supportPerCapita = family * data.perCapita.support;
  const carePerCapita    = care  * data.perCapita.care;

  // 平等割
  const medicalHousehold = data.household?.medical || 0;
  const supportHousehold = data.household?.support || 0;
  const careHousehold    = care > 0 ? (data.household?.care || 0) : 0;

  // 未就学児軽減
  const preschoolReductionMedical = Math.round(
    preschool * data.perCapita.medical * (data.preschoolReduction?.medicalPerCapitaRate || 0)
  );
  const preschoolReductionSupport = Math.round(
    preschool * data.perCapita.support * (data.preschoolReduction?.supportPerCapitaRate || 0)
  );
  const preschoolReduction = preschoolReductionMedical + preschoolReductionSupport;

  // 軽減判定
  const B = Math.max(salaryPensionCount, 1);
  const salaryPensionAdd = data.reduction?.salaryPensionAdd || 0;
  const extraForIncomeEarners = salaryPensionAdd * (B - 1);

  const sevenTenthsLimit =
    (data.reduction?.standards?.sevenTenths?.base || 0) +
    ((data.reduction?.standards?.sevenTenths?.perPersonAdd || 0) * family) +
    extraForIncomeEarners;

  const fiveTenthsLimit =
    (data.reduction?.standards?.fiveTenths?.base || 0) +
    ((data.reduction?.standards?.fiveTenths?.perPersonAdd || 0) * family) +
    extraForIncomeEarners;

  const twoTenthsLimit =
    (data.reduction?.standards?.twoTenths?.base || 0) +
    ((data.reduction?.standards?.twoTenths?.perPersonAdd || 0) * family) +
    extraForIncomeEarners;

  let reductionLabel = "軽減なし";
  let reductionRate  = 0;

  if (income <= sevenTenthsLimit) {
    reductionLabel = "7割軽減";
    reductionRate  = data.reduction?.ratios?.sevenTenths || 0;
  } else if (income <= fiveTenthsLimit) {
    reductionLabel = "5割軽減";
    reductionRate  = data.reduction?.ratios?.fiveTenths || 0;
  } else if (income <= twoTenthsLimit) {
    reductionLabel = "2割軽減";
    reductionRate  = data.reduction?.ratios?.twoTenths || 0;
  }

  // 子ども・子育て支援金分（R8新設・0なら無効）
  const childcareCfg        = data.childcareLevy;
  const childcareRate       = childcareCfg?.rate      || 0;
  const childcarePerCapita  = childcareCfg?.perCapita || 0;
  const childcareHousehold  = childcareCfg?.household || 0;
  const childcareIncome     = childcareRate > 0 ? Math.round(baseIncome * childcareRate) : 0;
  const under18Count        = (childcareCfg?.under18Reduction && childcareRate > 0) ? Math.min(under18 || 0, family) : 0;
  const childcarePerCapitaTotal = (family - under18Count) * childcarePerCapita;
  const childcareHouseholdTotal = childcareRate > 0 ? childcareHousehold : 0;

  // 軽減額（均等割＋平等割に適用）
  const medicalReduction   = Math.round((medicalPerCapita  + medicalHousehold)         * reductionRate);
  const supportReduction   = Math.round((supportPerCapita  + supportHousehold)         * reductionRate);
  const careReduction      = Math.round((carePerCapita     + careHousehold)            * reductionRate);
  const childcareReduction = Math.round((childcarePerCapitaTotal + childcareHouseholdTotal) * reductionRate);

  // 区分別合計
  let medicalTotal   = medicalIncome  + medicalPerCapita        + medicalHousehold         + assetLevyMedical - preschoolReductionMedical - medicalReduction;
  let supportTotal   = supportIncome  + supportPerCapita        + supportHousehold         + assetLevySupport - preschoolReductionSupport - supportReduction;
  let careTotal      = careIncome     + carePerCapita           + careHousehold            + assetLevyCare    - careReduction;
  let childcareTotal = childcareIncome + childcarePerCapitaTotal + childcareHouseholdTotal                    - childcareReduction;

  medicalTotal   = Math.min(Math.max(medicalTotal,   0), data.caps.medical);
  supportTotal   = Math.min(Math.max(supportTotal,   0), data.caps.support);
  careTotal      = Math.min(Math.max(careTotal,      0), data.caps.care);
  childcareTotal = Math.min(Math.max(childcareTotal, 0), childcareCfg?.cap ?? 30000);

  const total           = medicalTotal + supportTotal + careTotal + childcareTotal;
  const monthly         = Math.round(total / 12);
  const totalReduction  = medicalReduction + supportReduction + careReduction + childcareReduction;
  const assetLevyTotal  = assetLevyMedical + assetLevySupport + assetLevyCare;

  return {
    medicalTotal, supportTotal, careTotal, childcareTotal,
    total, monthly,
    preschoolReduction, totalReduction,
    reductionLabel, assetLevyTotal
  };
}

// ─── データ取得（キャッシュ付き） ────────────────────────────────

const _kokuhoDataCache = new Map();

async function loadKokuhoData(city) {
  if (_kokuhoDataCache.has(city)) return _kokuhoDataCache.get(city);
  const promise = (async () => {
    let res = await fetch(`/data/municipalities/${city}/kokuho-2026.json`, { cache: "no-store" });
    if (!res.ok) res = await fetch(`/data/municipalities/${city}/kokuho-2025.json`, { cache: "no-store" });
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

    const r = calculateKokuho(data, inputs);

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

window.calc = calc;

(function() {
  const income = document.getElementById('income');
  if (!income) return;
  income.addEventListener('compositionend', function() {
    const el = this;
    setTimeout(function() { formatNumber(el); }, 0);
  });
  income.addEventListener('blur', function() {
    formatNumber(this);
  });
})();

// ページ読み込み時に資産割入力欄を表示制御
(async function() {
  try {
    const data = await loadKokuhoData(getCurrentCity());
    if (data.assetLevy) {
      const group = document.getElementById("assetLevyGroup");
      if (group) group.style.display = "";
    }
  } catch (e) {}
})();
