// 国民健康保険料 計算ロジック（純粋関数）
// Browser: <script> で読み込むとグローバル関数として使用可能
// Node:    require('./js/core/kokuho') で { calculateKokuho } を取得

function calculateKokuho(data, inputs) {
  const { income, family, preschool, under18, care, salaryPensionCount, fixedAssetTax,
          reductionJudgmentIncome } = inputs;

  // ① income=undefined 対策：未指定時は 0 として扱う
  const incomeSafe      = income      || 0;
  const familySafe      = Math.max(family || 0, 0);
  // ③ preschool / care が family を超えた場合は family に clamp
  const preschoolSafe   = Math.min(Math.max(preschool || 0, 0), familySafe);
  const careSafe        = Math.min(Math.max(care      || 0, 0), familySafe);

  // 軽減判定に使う所得。擬制世帯主がいる場合は household.js 側が
  // (加入者所得 + 世帯主所得) を計算してここに渡す。未指定時は income にフォールバック。
  const reductionBase = reductionJudgmentIncome ?? incomeSafe;

  // 資産割
  const assetLevyMedical = data.assetLevy ? Math.round(fixedAssetTax * (data.assetLevy.medical || 0)) : 0;
  const assetLevySupport = data.assetLevy ? Math.round(fixedAssetTax * (data.assetLevy.support || 0)) : 0;
  const assetLevyCare    = data.assetLevy ? Math.round(fixedAssetTax * (data.assetLevy.care    || 0)) : 0;

  const baseIncome = Math.max(incomeSafe - data.basicDeduction, 0);

  // 所得割
  const medicalIncome = Math.round(baseIncome * data.rate.medical);
  const supportIncome = Math.round(baseIncome * data.rate.support);
  const careIncome    = careSafe > 0 ? Math.round(baseIncome * data.rate.care) : 0;

  // 均等割
  const medicalPerCapita = familySafe * data.perCapita.medical;
  const supportPerCapita = familySafe * data.perCapita.support;
  const carePerCapita    = careSafe   * data.perCapita.care;

  // 平等割
  const medicalHousehold = data.household?.medical || 0;
  const supportHousehold = data.household?.support || 0;
  const careHousehold    = careSafe > 0 ? (data.household?.care || 0) : 0;

  // 未就学児軽減
  const preschoolReductionMedical = Math.round(
    preschoolSafe * data.perCapita.medical * (data.preschoolReduction?.medicalPerCapitaRate || 0)
  );
  const preschoolReductionSupport = Math.round(
    preschoolSafe * data.perCapita.support * (data.preschoolReduction?.supportPerCapitaRate || 0)
  );
  const preschoolReduction = preschoolReductionMedical + preschoolReductionSupport;

  // 軽減判定
  // ② salaryPensionCount > family 対策：family を上限として clamp
  const B = Math.max(Math.min(salaryPensionCount || 0, familySafe || 1), 1);
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

  if (reductionBase <= sevenTenthsLimit) {
    reductionLabel = "7割軽減";
    reductionRate  = data.reduction?.ratios?.sevenTenths || 0;
  } else if (reductionBase <= fiveTenthsLimit) {
    reductionLabel = "5割軽減";
    reductionRate  = data.reduction?.ratios?.fiveTenths || 0;
  } else if (reductionBase <= twoTenthsLimit) {
    reductionLabel = "2割軽減";
    reductionRate  = data.reduction?.ratios?.twoTenths || 0;
  }

  // 子ども・子育て支援金分（R8新設・0なら無効）
  const childcareCfg        = data.childcareLevy;
  const childcareRate       = childcareCfg?.rate      || 0;
  const childcarePerCapita  = childcareCfg?.perCapita || 0;
  const childcareHousehold  = childcareCfg?.household || 0;
  const childcareIncome     = childcareRate > 0 ? Math.round(baseIncome * childcareRate) : 0;

  // 均等割の計算
  // 新方式: perCapitaAdult が定義されている場合 → 18歳未満は perCapita、18歳以上は perCapitaAdult
  // 旧方式: under18Reduction=true の場合 → 18歳未満は0、18歳以上は perCapita
  // 均等割の計算
  // 新方式(perCapitaAdult あり):
  //   18歳以上 → perCapita + perCapitaAdult（例: 京都市 1,110 + 60 = 1,170円）
  //   18歳未満 → 0（under18Reductionで全額減額）
  // 旧方式(perCapitaAdult なし、under18Reduction: true):
  //   18歳以上 → perCapita のみ（例: 練馬区 1,873円）
  //   18歳未満 → 0
  const u18    = Math.min(under18 || 0, familySafe);
  const adults = familySafe - u18;
  let childcarePerCapitaTotal;
  if (childcareCfg?.perCapitaAdult !== undefined) {
    childcarePerCapitaTotal = adults * (childcarePerCapita + (childcareCfg.perCapitaAdult || 0));
  } else {
    const under18Excluded = (childcareCfg?.under18Reduction && childcareRate > 0) ? u18 : 0;
    childcarePerCapitaTotal = (family - under18Excluded) * childcarePerCapita;
  }
  const childcareHouseholdTotal = childcareRate > 0 ? childcareHousehold : 0;

  // 軽減額（均等割＋平等割に適用）
  const medicalReduction   = Math.round((medicalPerCapita  + medicalHousehold)             * reductionRate);
  const supportReduction   = Math.round((supportPerCapita  + supportHousehold)             * reductionRate);
  const careReduction      = Math.round((carePerCapita     + careHousehold)                * reductionRate);
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

  const total          = medicalTotal + supportTotal + careTotal + childcareTotal;
  const monthly        = Math.round(total / 12);
  const totalReduction = medicalReduction + supportReduction + careReduction + childcareReduction;
  const assetLevyTotal = assetLevyMedical + assetLevySupport + assetLevyCare;

  return {
    medicalTotal, supportTotal, careTotal, childcareTotal,
    total, monthly,
    preschoolReduction, totalReduction,
    reductionLabel, assetLevyTotal,
  };
}

if (typeof module !== 'undefined') module.exports = { calculateKokuho };
