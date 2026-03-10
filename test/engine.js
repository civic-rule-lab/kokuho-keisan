async function calc(){

const income = Number(document.getElementById("income").value) || 0;
const family = Number(document.getElementById("family").value) || 0;
const preschool = Number(document.getElementById("preschool").value) || 0;
const care = Number(document.getElementById("care").value) || 0;

const response = await fetch("./chigasaki-2025.json");
const data = await response.json();

let baseIncome = Math.max(income - data.basicDeduction, 0);

let incomePart =
baseIncome * data.rate.medical +
baseIncome * data.rate.support +
baseIncome * data.rate.care;

let perCapita =
family * data.perCapita.medical +
family * data.perCapita.support +
care * data.perCapita.care;

let total = Math.round(incomePart + perCapita);

document.getElementById("result").innerHTML =
"年間保険料：約 " + total.toLocaleString() + " 円";

}

window.calc = calc;
