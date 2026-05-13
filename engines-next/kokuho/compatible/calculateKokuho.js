'use strict';

/**
 * Legacy-compatible National Health Insurance premium calculator.
 *
 * The argument order intentionally follows the next-engine contract:
 *   calculateKokuho(input, data)
 *
 * This module mirrors the legacy final calculation semantics for the 2025
 * kokuho data shape while keeping the calculator pure. It deliberately omits
 * post-legacy extensions such as childcare levy, asset levy, under-18 handling,
 * and fixed-asset-tax based additions.
 */
function calculateKokuho(input, data) {
  const inputs = input || {};
  const cfg = data || {};

  const {
    income,
    family,
    preschool,
    care,
    salaryPensionCount,
    reductionJudgmentIncome,
  } = inputs;

  const incomeSafe = income || 0;
  const familySafe = Math.max(family || 0, 0);
  const preschoolSafe = Math.min(Math.max(preschool || 0, 0), familySafe);
  const careSafe = Math.min(Math.max(care || 0, 0), familySafe);
  const reductionBase = reductionJudgmentIncome ?? incomeSafe;

  const baseIncome = Math.max(incomeSafe - cfg.basicDeduction, 0);

  const medicalIncome = Math.round(baseIncome * cfg.rate.medical);
  const supportIncome = Math.round(baseIncome * cfg.rate.support);
  const careIncome = careSafe > 0 ? Math.round(baseIncome * cfg.rate.care) : 0;

  const medicalPerCapita = familySafe * cfg.perCapita.medical;
  const supportPerCapita = familySafe * cfg.perCapita.support;
  const carePerCapita = careSafe * cfg.perCapita.care;

  const medicalHousehold = cfg.household?.medical || 0;
  const supportHousehold = cfg.household?.support || 0;
  const careHousehold = careSafe > 0 ? (cfg.household?.care || 0) : 0;

  const preschoolReductionMedical = Math.round(
    preschoolSafe * cfg.perCapita.medical * (cfg.preschoolReduction?.medicalPerCapitaRate || 0)
  );
  const preschoolReductionSupport = Math.round(
    preschoolSafe * cfg.perCapita.support * (cfg.preschoolReduction?.supportPerCapitaRate || 0)
  );
  const preschoolReduction = preschoolReductionMedical + preschoolReductionSupport;

  const salaryPensionPeople = Math.max(Math.min(salaryPensionCount || 0, familySafe || 1), 1);
  const salaryPensionAdd = cfg.reduction?.salaryPensionAdd || 0;
  const extraForIncomeEarners = salaryPensionAdd * Math.max(0, salaryPensionPeople - 1);

  const sevenTenthsLimit =
    (cfg.reduction?.standards?.sevenTenths?.base || 0) +
    ((cfg.reduction?.standards?.sevenTenths?.perPersonAdd || 0) * family) +
    extraForIncomeEarners;

  const fiveTenthsLimit =
    (cfg.reduction?.standards?.fiveTenths?.base || 0) +
    ((cfg.reduction?.standards?.fiveTenths?.perPersonAdd || 0) * family) +
    extraForIncomeEarners;

  const twoTenthsLimit =
    (cfg.reduction?.standards?.twoTenths?.base || 0) +
    ((cfg.reduction?.standards?.twoTenths?.perPersonAdd || 0) * family) +
    extraForIncomeEarners;

  let reductionLabel = '軽減なし';
  let reductionRate = 0;

  if (reductionBase <= sevenTenthsLimit) {
    reductionLabel = '7割軽減';
    reductionRate = cfg.reduction?.ratios?.sevenTenths || 0;
  } else if (reductionBase <= fiveTenthsLimit) {
    reductionLabel = '5割軽減';
    reductionRate = cfg.reduction?.ratios?.fiveTenths || 0;
  } else if (reductionBase <= twoTenthsLimit) {
    reductionLabel = '2割軽減';
    reductionRate = cfg.reduction?.ratios?.twoTenths || 0;
  }

  const medicalReduction = Math.round((medicalPerCapita + medicalHousehold) * reductionRate);
  const supportReduction = Math.round((supportPerCapita + supportHousehold) * reductionRate);
  const careReduction = Math.round((carePerCapita + careHousehold) * reductionRate);

  let medicalTotal =
    medicalIncome +
    medicalPerCapita +
    medicalHousehold -
    preschoolReductionMedical -
    medicalReduction;
  let supportTotal =
    supportIncome +
    supportPerCapita +
    supportHousehold -
    preschoolReductionSupport -
    supportReduction;
  let careTotal =
    careIncome +
    carePerCapita +
    careHousehold -
    careReduction;

  medicalTotal = Math.min(Math.max(medicalTotal, 0), cfg.caps.medical);
  supportTotal = Math.min(Math.max(supportTotal, 0), cfg.caps.support);
  careTotal = Math.min(Math.max(careTotal, 0), cfg.caps.care);

  const total = medicalTotal + supportTotal + careTotal;
  const monthly = Math.round(total / 12);
  const totalReduction = medicalReduction + supportReduction + careReduction;

  const details = {
    inputs: {
      income: incomeSafe,
      family: familySafe,
      preschool: preschoolSafe,
      care: careSafe,
      salaryPensionCount: salaryPensionPeople,
      reductionJudgmentIncome: reductionBase,
    },
    baseIncome,
    incomeBased: {
      medical: medicalIncome,
      support: supportIncome,
      care: careIncome,
    },
    perCapita: {
      medical: medicalPerCapita,
      support: supportPerCapita,
      care: carePerCapita,
    },
    household: {
      medical: medicalHousehold,
      support: supportHousehold,
      care: careHousehold,
    },
    preschoolReduction: {
      medical: preschoolReductionMedical,
      support: preschoolReductionSupport,
      total: preschoolReduction,
    },
    reduction: {
      label: reductionLabel,
      rate: reductionRate,
      salaryPensionAdd,
      extraForIncomeEarners,
      limits: {
        sevenTenths: sevenTenthsLimit,
        fiveTenths: fiveTenthsLimit,
        twoTenths: twoTenthsLimit,
      },
      amount: {
        medical: medicalReduction,
        support: supportReduction,
        care: careReduction,
        total: totalReduction,
      },
    },
    caps: {
      medical: cfg.caps.medical,
      support: cfg.caps.support,
      care: cfg.caps.care,
    },
  };

  const breakdown = {
    medical: {
      income: medicalIncome,
      perCapita: medicalPerCapita,
      household: medicalHousehold,
      preschoolReduction: preschoolReductionMedical,
      reduction: medicalReduction,
      total: medicalTotal,
    },
    support: {
      income: supportIncome,
      perCapita: supportPerCapita,
      household: supportHousehold,
      preschoolReduction: preschoolReductionSupport,
      reduction: supportReduction,
      total: supportTotal,
    },
    care: {
      income: careIncome,
      perCapita: carePerCapita,
      household: careHousehold,
      reduction: careReduction,
      total: careTotal,
    },
  };

  return {
    medicalTotal,
    supportTotal,
    careTotal,
    total,
    monthly,
    preschoolReduction,
    totalReduction,
    reductionLabel,
    details,
    breakdown,
  };
}

module.exports = { calculateKokuho };
