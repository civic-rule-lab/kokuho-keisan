async function calc() {
  const result = document.getElementById("result");

  try {
    const income = Number(document.getElementById("income").value || 0);
    const family = Number(document.getElementById("family").value || 0);
    const preschool = Number(document.getElementById("preschool").value || 0);
    const care = Number(document.getElementById("care").value || 0);

    const response = await fetch("./data/chigasaki-2025.json");
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
      "年間保険料：約 " + total.toLocaleString() + " 円";
  } catch (error) {
    result.innerHTML = "計算エラー: " + error.message;
  }
}

window.calc = calc;
