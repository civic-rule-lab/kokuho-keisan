async function calc() {
  const result = document.getElementById("result");

  try {
    const income = Number(document.getElementById("income").value.replace(/,/g, "") || 0);
    const family = Number(document.getElementById("family").value || 0);
    const preschool = Number(document.getElementById("preschool").value || 0);
    const care = Number(document.getElementById("care").value || 0);

    const params = new URLSearchParams(location.search);
const city = params.get("city") || "chigasaki";
    if (!response.ok) {
      throw new Error("JSON読み込み失敗");
    }

    const data = await response.json();

    const baseIncome = Math.max(income - data.basicDeduction, 0);

    const incomePart =
      baseIncome * data.rate.medical +
      baseIncome * data.rate.support +
      baseIncome * data.rate.care;

    const perCapita =
      family * data.perCapita.medical +
      family * data.perCapita.support +
      care * data.perCapita.care;

    const total = Math.round(incomePart + perCapita);

    result.innerHTML =
  '<div class="result-row">' +
    '<div class="result-label">年間保険料（概算）</div>' +
    '<div class="amount">約 ' + total.toLocaleString() + ' 円</div>' +
  '</div>';
  } catch (error) {
    result.innerHTML =
  '<div class="result-label">計算エラー</div>' +
  '<div class="monthly">' + error.message + '</div>';
  }
}

window.calc = calc;
