console.log("selector.js loaded")
  const registry = {
  kanagawa: {
    name: "神奈川県",
    municipalities: {
      chigasaki: {
        name: "茅ヶ崎市",
        systems: {
          kokuho: {
            name: "国民健康保険",
            pages: {
              simple: {
                name: "かんたん計算",
                url: "./title-test.html"
              },
              income: {
                name: "所得ベース計算",
                url: "./kokuho-income.html"
              }
          }
        }
      }
    }
  }
};

function updateCurrent() {

  const prefecture = document.getElementById("prefecture").value;
  const municipality = document.getElementById("municipality").value;
  const system = document.getElementById("system").value;
  const pageType = document.getElementById("pageType").value;

  const prefectureName = registry[prefecture].name;
  const municipalityName = registry[prefecture].municipalities[municipality].name;
  const systemName = registry[prefecture].municipalities[municipality].systems[system].name;
  const pageName = registry[prefecture].municipalities[municipality].systems[system].pages[pageType].name;

  document.getElementById("currentSelect").textContent =
    `${prefectureName} / ${municipalityName} / ${systemName} / ${pageName}`;

}

function goPage(){

  const prefecture = document.getElementById("prefecture").value;
  const municipality = document.getElementById("municipality").value;
  const system = document.getElementById("system").value;
  const pageType = document.getElementById("pageType").value;

  const url =
    registry[prefecture]
      .municipalities[municipality]
      .systems[system]
      .pages[pageType]
      .url;

  window.location.href = url;

}
