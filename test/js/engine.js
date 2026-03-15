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

    // 平等割（介護分は介護該当者がいる世帯のみ）
    const medicalHousehold = data.household?.medical || 0;
    const supportHousehold = data.household?.support || 0;
    const careHousehold = care > 0 ? (data.household?.care || 0) : 0;

    // 未就学児軽減（均等割の医療分・支援分のみ簡易反映）
    const preschoolReductionMedical = Math.round(
      preschool * data.perCapita.medical * (data.preschoolReduction?.medicalPerCapitaRate || 0)
    );
    const preschoolReductionSupport = Math.round(
      preschool * data.perCapita.support * (data.preschoolReduction?.supportPerCapitaRate || 0)
    );
    const preschoolReduction = preschoolReductionMedical + preschoolReductionSupport;

    // 区分別合計（軽減前）
    let medicalTotal =
      medicalIncome + medicalPerCapita + medicalHousehold - preschoolReductionMedical;

    let supportTotal =
      supportIncome + supportPerCapita + supportHousehold - preschoolReductionSupport;

    let careTotal =
      careIncome + carePerCapita + careHousehold;

    // マイナス防止
    medicalTotal = Math.max(medicalTotal, 0);
    supportTotal = Math.max(supportTotal, 0);
    careTotal = Math.max(careTotal, 0);

    // 限度額
    medicalTotal = Math.min(medicalTotal, data.caps.medical);
    supportTotal = Math.min(supportTotal, data.caps.support);
    careTotal = Math.min(careTotal, data.caps.care);

    const total = medicalTotal + supportTotal + careTotal;

    result.innerHTML =
      '<div class="result-row"><div class="result-label">医療分</div><div class="amount">' + medicalTotal.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">支援分</div><div class="amount">' + supportTotal.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">介護分</div><div class="amount">' + careTotal.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">未就学児軽減</div><div class="amount">-' + preschoolReduction.toLocaleString() + ' 円</div></div>' +
      '<div class="result-row"><div class="result-label">年間保険料（概算）</div><div class="amount">約 ' + total.toLocaleString() + ' 円</div></div>';

  } catch (error) {
    result.innerHTML =
      '<div class="result-label">計算エラー</div>' +
      '<div class="monthly">' + error.message + '</div>';
  }
}

window.calc = calc;
