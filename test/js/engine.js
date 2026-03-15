async function calc() {
  const result = document.getElementById("result");

  try {
    const income =
      Number((document.getElementById("income").value || "").replace(/,/g, "")) || 0;
    const family =
      Number(document.getElementById("family").value || 0);
    const preschool =
      Number(document.getElementById("preschool").value || 0);
    const care =
      Number(document.getElementById("care").value || 0);
    const salaryPensionCount =
      Number(document.getElementById("salaryPensionCount")?.value || 1);

    const params = new URLSearchParams(location.search);
    const city = params.get("city") || "chigasaki";

    const response = await fetch(`./data/municipalities/${city}/kokuho-2025.json`);
    if (!response.ok) {
      throw new Error("JSON読み込み失敗");
    }

    const data = await response.json();

    const baseIncome = Math.max(income - data.basicDeduction, 0);

    // 所得割
    const medicalIncome = Math.round(baseIncome * data.rate.medical);
    const supportIncome = Math.round(baseIncome * data.rate.support);
    const careIncome = Math.round(baseIncome * data.rate.care);

    // 均等割
    const medicalPerCapita = family * data.perCapita.medical;
    const supportPerCapita = family * data.perCapita.support;
    const carePerCapita = care * data.perCapita.care;

    // 平等割
    const medicalHousehold = data.household?.medical || 0;
    const supportHousehold = data.household?.support || 0;
    const careHousehold = care > 0 ? (data.household?.care || 0) : 0;

    // 未就学児軽減（均等割の医療分・支援分のみ）
    const preschoolReductionMedical = Math.round(
      preschool * data.perCapita.medical * (data.preschoolReduction?.medicalPerCapitaRate || 0)
    );
    const preschoolReductionSupport = Math.round(
      preschool * data.perCapita.support * (data.preschoolReduction?.supportPerCapitaRate || 0)
    );
    const preschoolReduction = preschoolReductionMedical + preschoolReductionSupport;

    // 軽減判定
    const B = Math.max(salaryPensionCount, 1);
    const extraForIncomeEarners = 100000 * (B - 1);

    const sevenTenthsLimit = 430000 + extraForIncomeEarners;
    const fiveTenthsLimit = 430000 + (305000 * family) + extraForIncomeEarners;
    const twoTenthsLimit = 430000 + (560000 * family) + extraForIncomeEarners;

    let reductionLabel = "軽減なし";
    let reductionRate = 0;

    if (income <= sevenTenthsLimit) {
      reductionLabel = "7割軽減";
      reductionRate = 0.7;
    } else if (income <= fiveTenthsLimit) {
      reductionLabel = "5割軽減";
      reductionRate = 0.5;
    } else if (income <= twoTenthsLimit) {
      reductionLabel = "2割軽減";
      reductionRate = 0.2;
    }

    // 軽減は均等割・平等割に適用
    const medicalReductionBase = medicalPerCapita + medicalHousehold;
    const supportReductionBase = supportPerCapita + supportHousehold;
    const careReductionBase = carePerCapita + careHousehold;

    const medicalReduction = Math.round(medicalReductionBase * reductionRate);
    const supportReduction = Math.round(supportReductionBase * reductionRate);
    const careReduction = Math.round(careReductionBase * reductionRate);

    // 区分別合計
    let medicalTotal =
      medicalIncome + medicalPerCapita + medicalHousehold - preschoolReductionMedical - medicalReduction;

    let supportTotal =
      supportIncome + supportPerCapita + supportHousehold - preschoolReductionSupport - supportReduction;

    let careTotal =
      careIncome + carePerCapita + careHousehold - careReduction;

    medicalTotal = Math.max(medicalTotal, 0);
    supportTotal = Math.max(supportTotal, 0);
    careTotal = Math.max(careTotal, 0);

    // 限度額
    medicalTotal = Math.min(medicalTotal, data.caps.medical);
    supportTotal = Math.min(supportTotal, data.caps.support);
    careTotal = Math.min(careTotal, data.caps.care);

    const total = medicalTotal + supportTotal + careTotal;
    const monthly = Math.round(total / 12);
    const totalReduction = medicalReduction + supportReduction + careReduction;

    result.innerHTML =
      '<div class="result-row"><div class="result-label">医療分</div><div class="amount">' + medicalTotal.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">支援分</div><div class="amount">' + supportTotal.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">介護分</div><div class="amount">' + careTotal.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">未就学児軽減</div><div class="amount">-' + preschoolReduction.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">法定軽減</div><div class="amount">-' + totalReduction.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">軽減判定</div><div class="amount">' + reductionLabel + '</div></div>' +
      '<div class="result-row"><div class="result-label">年間保険料（概算）</div><div class="amount">約 ' + total.toLocaleString() + ' 円</div></div>' +
　　　　'<div class="result-row"><div class="result-label">月額目安</div><div class="amount">約 ' + monthly.toLocaleString() + ' 円</div></div>';

  } catch (error) {
    result.innerHTML =
      '<div class="result-label">計算エラー</div>' +
      '<div class="monthly">' + error.message + '</div>';
  }
}

window.calc = calc;
