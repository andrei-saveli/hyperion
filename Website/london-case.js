// The case uses the fitted comparison published with this site. It never uses the NASA
// grid-cell observations shown in Explore to estimate a city policy effect.
(function () {
  const $ = (id) => document.getElementById(id);
  const form = $("experiment-prediction");
  const units = "µg/m³";
  const signed = (value) => `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(1)}`;
  let study;
  let prediction;

  function chart(id, weeks, shapes, comparisonName) {
    if (typeof Plotly === "undefined") {
      $(id).hidden = true;
      return;
    }
    const dates = weeks.map(({ date }) => date);
    Plotly.react(id, [
      { x: dates, y: weeks.map((week) => week.observed), name: "Central London",
        type: "scatter", mode: "lines", line: { color: "#0e5e63", width: 2.5 } },
      { x: dates, y: weeks.map((week) => week.control), name: comparisonName,
        type: "scatter", mode: "lines", line: { color: "#be5a4c", width: 2, dash: "dash" } },
    ], {
      shapes, margin: { l: 55, r: 14, t: 12, b: 42 }, hovermode: "x unified",
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      legend: { orientation: "h", y: 1, yanchor: "bottom" },
      yaxis: { title: { text: `Roadside NO₂ (${units})` }, gridcolor: "#e3e9e6" },
    }, { displayModeBar: false, responsive: true });
  }

  function markPeriod(from, to) {
    return { type: "rect", x0: from, x1: to, y0: 0, y1: 1, yref: "paper", layer: "below",
      fillcolor: "rgba(57,155,134,.14)", line: { width: 0 } };
  }

  function showBaseline() {
    const result = ByteMeExperiments.policyTest(study);
    const before = result.weeks.slice(0, result.intervention);
    $("experiment-baseline").hidden = false;
    $("experiment-fit").textContent = `In the eight reserved weeks, London averaged ${signed(result.before.gap)} ${units} relative to the comparison. The typical prediction error was ${result.before.rmse.toFixed(1)} ${units} (root mean square). Shading marks those weeks.`;
    const weightedSites = study.weights.filter(({ weight }) => weight > 0.0001)
      .map(({ site, weight }) => `${site} (${(100 * weight).toFixed(1)}%)`).join(" · ");
    $("experiment-donors").textContent = `The fit used ${study.trainingWeeks} weeks and considered ${study.donorCount} monitors. The weighted monitors were ${weightedSites}.`;
    chart("experiment-pre-chart", before, [
      markPeriod(before[study.trainingWeeks].date, before.at(-1).date),
    ], "Weighted comparison");
  }

  function showResult() {
    const postWeeks = Number($("experiment-window").value) || undefined;
    const adjustBaseline = $("experiment-adjust").checked;
    const omitLargestDonor = $("experiment-omit").checked;
    const result = ByteMeExperiments.policyTest(study, { postWeeks, adjustBaseline, omitLargestDonor });
    $("experiment-result").hidden = false;
    const direction = result.after.gap < 0 ? "below" : result.after.gap > 0 ? "above" : "level with";
    $("experiment-verdict").textContent = adjustBaseline && omitLargestDonor && result.after.gap < 0
      ? "The checks support a contribution from the zone"
      : `London’s NO₂ was ${direction} the comparison after launch`;
    const gap = `${signed(result.after.gap)} ${units} (${signed(result.after.percent)}%)`;
    $("experiment-effect").textContent = `London minus comparison averaged ${gap} over ${result.after.count} weeks. Before launch the unadjusted gap was ${signed(result.before.gap)} ${units}.`;
    const predictions = { lower: "a decrease", similar: "a small change", higher: "an increase" };
    const nextStep = adjustBaseline && omitLargestDonor
      ? "Both checks are active. Change the time window to see how the estimate depends on the weeks used."
      : "Try both checks below before deciding how much of the gap the policy might explain.";
    $("experiment-prediction-check").textContent = `You predicted ${predictions[prediction]}. ${nextStep}`;
    const original = $("experiment-original");
    original.hidden = !adjustBaseline && !omitLargestDonor;
    if (!original.hidden) {
      const initial = ByteMeExperiments.policyTest(study, { postWeeks });
      original.textContent = `The same weeks gave ${signed(initial.after.gap)} ${units} with the original donor mix and baseline.`;
    }
    $("experiment-baseline-check").textContent = adjustBaseline
      ? `With the pre-launch gap carried forward, London is ${direction} its comparison.`
      : "";
    $("experiment-donor-check").textContent = omitLargestDonor
      ? `After removing ${study.omittedDonor}, London is ${direction} its comparison.`
      : "";
    const launch = { type: "line", x0: study.policyStart, x1: study.policyStart, y0: 0, y1: 1, yref: "paper",
      line: { color: "#141a19", dash: "dot", width: 2 } };
    chart("experiment-post-chart", result.weeks, [launch], adjustBaseline ? "Comparison shifted by the pre-launch gap" : "Weighted comparison");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = $("experiment-error");
    const button = form.querySelector('button[type="submit"]');
    const choice = new FormData(form).get("prediction");
    if (!choice) return;
    button.disabled = true;
    error.hidden = true;
    try {
      if (!study) {
        const reply = await fetch("data/london-ulez.json");
        if (!reply.ok) throw new Error("Policy case failed to load");
        study = await reply.json();
      }
      prediction = choice;
      showBaseline();
      if (!$("experiment-result").hidden) showResult();
      $("experiment-baseline").scrollIntoView();
      $("experiment-baseline").querySelector("h3").focus({ preventScroll: true });
    } catch {
      error.textContent = "The London records did not load. Try opening the comparison again.";
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  });

  $("run-experiment").addEventListener("click", () => {
    showResult();
    $("experiment-result").scrollIntoView();
    $("experiment-result").querySelector("h3").focus({ preventScroll: true });
  });
  for (const id of ["experiment-window", "experiment-adjust", "experiment-omit"]) {
    $(id).addEventListener("change", showResult);
  }
})();
