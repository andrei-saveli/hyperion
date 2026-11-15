// Standalone experiment builder. NASA data is supplied by the same adapter as Compare.
const ByteMeStudyView = (function () {
  const byId = (id) => document.getElementById(id);
  const form = byId("study-form");
  const fields = form.elements;
  const runs = [];
  const places = {};
  let nasa;

  function enableNASA(adapter) {
    nasa = adapter;
    byId("study-measurement").innerHTML = adapter.options;
    fields.design.querySelector('[value="nasa"]').disabled = false;
    for (const side of ["a", "b"]) {
      const input = byId(`study-place-${side}`);
      adapter.placePicker(input, byId(`study-place-${side}-list`), (hit) => {
        input.value = hit.name || hit.label;
        places[side] = { ...hit, name: input.value };
      }, false);
      input.addEventListener("input", () => { delete places[side]; });
    }
    syncDesign();
  }

  function useObservation({ lat, lon, name, code }) {
    if (!nasa || !nasa.measurement(code)) return;
    fields.design.value = "nasa";
    byId("study-measurement").value = code;
    const a = byId("study-place-a");
    if (!places.a || places.a.lat !== lat || places.a.lon !== lon) {
      delete places.b;
      byId("study-place-b").value = "";
    }
    places.a = { lat, lon, name };
    a.value = name;
    syncDesign();
    byId("study").scrollIntoView();
    fields.question.focus({ preventScroll: true });
  }

  function syncDesign() {
    const { value } = fields.design;
    const live = value === "nasa";
    const randomized = value === "randomized";
    byId("study-nasa").hidden = !live;
    byId("study-upload").hidden = live;
    byId("study-dates").hidden = randomized;
    fields.records.disabled = live;
    fields.outcome.disabled = live;
    fields.start.disabled = randomized;
    byId("study-format").textContent = randomized
      ? "Use unit, group, outcome. Enter treatment or control for each group and one row per randomized unit. Leave missing outcomes blank."
      : "Use month, affected, reference. Use YYYY-MM and one row per month. Leave missing measurements blank.";
    byId("study-design-help").textContent = randomized
      ? "Use this design only when independent units were randomly assigned to two groups. Keep each unit in its assigned group and use the same outcome for both groups."
      : "Choose a reference that the event did not affect. You need two windows before the event and one after it. The earlier window checks whether the groups already diverged.";
    const measurement = live ? nasa?.measurement(byId("study-measurement").value) : null;
    const units = measurement?.units || (!live && fields.units.value.trim());
    byId("study-units").textContent = units ? `Enter a change in ${units}.` : "Enter the change in the outcome’s units.";
  }

  function planFromForm() {
    const design = fields.design.value;
    const question = fields.question.value.trim(), outcome = fields.outcome.value.trim();
    if (!question || (design !== "nasa" && !outcome)) throw new Error("Enter a research question and name the outcome.");
    const month = fields.start.value;
    if (design !== "randomized" && !ByteMeInvestigation.periodOf(month, "")) {
      throw new Error("Enter the first affected month as YYYY-MM.");
    }
    return {
      design, question, outcome, month,
      units: fields.units.value.trim(), rival: fields.rival.value.trim(),
      magnitude: fields.magnitude.valueAsNumber, direction: Number(fields.direction.value),
      months: Number(fields.windowMonths.value),
    };
  }

  async function analyze(plan) {
    if (plan.design === "nasa") {
      if (!places.a || !places.b) throw new Error("Select both places from the search results.");
      const { a, b } = places;
      const measurement = nasa.measurement(byId("study-measurement").value);
      if (nasa.cell(a, measurement) === nasa.cell(b, measurement)) {
        throw new Error("Both places use the same measurement grid cell. Choose another reference.");
      }
      const description = {
        ...plan, outcome: measurement.name, units: measurement.units,
        source: `${measurement.source}. Affected ${a.name}, reference ${b.name}.`,
      };
      const series = await Promise.all([nasa.series(a, measurement), nasa.series(b, measurement)])
        .catch(() => { throw new Error("Could not load both NASA records. Retry or choose another outcome."); });
      return describeDated(description, ByteMeInvestigation.matchMonths(...series));
    }
    const file = fields.records.files[0];
    if (!file) throw new Error("Choose a CSV file.");
    const rows = ByteMeStudy.parseCSV(await file.text(), plan.design);
    const description = { ...plan, source: file.name };
    return plan.design === "randomized"
      ? describeRandomized(description, ByteMeStudy.randomizedComparison(rows))
      : describeDated(description, ByteMeStudy.monthlyData(rows));
  }

  function valueText(amount, units) {
    return [Number(amount.toPrecision(5)).toString(), units].filter(Boolean).join(" ");
  }

  function predicted(plan, effect) {
    const predictedDirection = plan.direction * effect;
    return plan.magnitude ? predictedDirection >= plan.magnitude : predictedDirection > 0;
  }

  function describeDated(plan, paired) {
    const { month, months, units } = plan;
    const { difference, placebo, count, earlier, before, after } = ByteMeStudy.datedComparison(paired, month, months);
    const coverageIncomplete = count < months;
    const earlierShift = Math.abs(placebo) >= Math.abs(difference);
    const conclusion = coverageIncomplete ? "Missing months leave the prediction open."
      : !predicted(plan, difference) ? "The estimated change falls short of the prediction."
      : earlierShift ? "The estimated change fits the prediction, but the groups already shifted by as much before the event."
      : "The estimated change fits the prediction. The earlier shift was smaller.";
    const alternatives = [12, 24, 36].filter((window) => window !== months)
      .map((window) => [window, ByteMeWorkbench.interventionComparison(paired, month, window)])
      .filter(([, result]) => result && Number.isFinite(result.difference) && Number.isFinite(result.placebo));
    return {
      plan, conclusion,
      evidence: [
        `Event starts ${month}. Each window is ${months} months. ${count} month positions were observed in both groups across all three windows.`,
        `Change in the affected-minus-reference gap after the event was ${valueText(difference, units)}.`,
        `The earlier comparison shifted by ${valueText(placebo, units)}. The gaps were ${valueText(earlier, units)}, ${valueText(before, units)}, and ${valueText(after, units)} across the three windows.`,
        ...alternatives.map(([window, result]) => `Sensitivity with ${window}-month windows. After-event change ${valueText(result.difference, units)}, earlier change ${valueText(result.placebo, units)}, ${result.count} of ${window} matched month positions.`),
      ],
      next: coverageIncomplete ? "Find more complete measurements for both groups and rerun the same prediction."
        : earlierShift ? "Find a reference that tracked the affected group more closely before the event. Look for earlier changes that could explain the shift."
        : "Check whether the reference was unaffected and whether another change around the same time could explain the result.",
    };
  }

  function describeRandomized(plan, result) {
    const { treatment, control, estimate, interval } = result;
    const missing = treatment.missing + control.missing;
    const { units } = plan;
    const directionalBounds = interval?.map((value) => plan.direction * value).sort((a, b) => a - b);
    const conclusion = missing ? "Missing outcomes leave the prediction open."
      : !directionalBounds ? "There is too little variation to assess uncertainty with this method."
      : predicted(plan, directionalBounds[0]) ? "The estimated effect and its interval meet the prediction."
      : !predicted(plan, directionalBounds[1]) ? "The entire interval falls short of the predicted effect."
      : "The interval leaves the prediction open.";
    return {
      plan, conclusion,
      evidence: [
        `Treatment mean ${valueText(treatment.mean, units)} across ${treatment.n} outcomes. Control mean ${valueText(control.mean, units)} across ${control.n} outcomes.`,
        `Treatment minus control was ${valueText(estimate, units)}.`,
        interval ? `Approximate 95% Welch interval ${valueText(interval[0], units)} to ${valueText(interval[1], units)}.` : "No uncertainty interval was computed.",
        `Missing outcomes. Treatment ${treatment.missing}, control ${control.missing}.`,
      ],
      next: missing ? "Check why outcomes went missing in each group before drawing a causal conclusion."
        : "Verify that assignment was random, units were independent, and the outcome was measured the same way in both groups.",
    };
  }

  function predictionText({ outcome, direction, magnitude, units }) {
    return `${outcome} should ${direction > 0 ? "increase" : "decrease"}${magnitude ? ` by at least ${valueText(magnitude, units)}` : ""}.`;
  }

  function runText({ plan, conclusion, evidence, next }) {
    const design = plan.design === "randomized" ? "Randomized treatment and control" : "Dated comparison with a reference group";
    return [plan.question, design, predictionText(plan), plan.source, conclusion, ...evidence,
      plan.rival ? `Rival to investigate. ${plan.rival}` : "", next].filter(Boolean);
  }

  function showRun(run) {
    const { plan, conclusion, evidence, next } = run;
    const output = byId("study-result");
    output.innerHTML = `<div class="box experiment-step">
      <h3 tabindex="-1">${escapeHTML(conclusion)}</h3>
      <p><strong>${escapeHTML(plan.question)}</strong></p>
      <p>${escapeHTML(predictionText(plan))}</p>
      <p class="meta">${escapeHTML(plan.source)}</p>
      <ul>${evidence.map((line) => `<li>${escapeHTML(line)}</li>`).join("")}</ul>
      <h4>What to check next</h4>
      <p>${escapeHTML(next)}</p>
      ${plan.rival ? `<p><strong>Rival to investigate</strong> · ${escapeHTML(plan.rival)}</p>` : ""}
    </div>`;
    output.querySelector("h3").focus();
  }

  function download(filename, content) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function saveRun(run) {
    const index = runs.push(run);
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "evidence-link";
    button.textContent = `Run ${index} · ${run.plan.question} · ${run.conclusion}`;
    button.addEventListener("click", () => showRun(run));
    row.append(button);
    byId("study-run-list").prepend(row);
    byId("study-history").hidden = false;
    showRun(run);
  }

  fields.design.addEventListener("change", syncDesign);
  fields.units.addEventListener("input", syncDesign);
  byId("study-measurement").addEventListener("change", syncDesign);
  byId("study-template").addEventListener("click", () => {
    const randomized = fields.design.value === "randomized";
    const header = ByteMeStudy.headers[fields.design.value].join(",");
    const rows = randomized ? ["T1,treatment,", "T2,treatment,", "C1,control,", "C2,control,"]
      : Array.from({ length: 36 }, (_, i) => `${2020 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")},,`);
    download("byteme-template.csv", [header, ...rows].join("\n") + "\n");
  });
  byId("study-download").addEventListener("click", () => download("byteme-experiment.txt",
    runs.map((run, index) => [`Run ${index + 1}`, ...runText(run)].join("\n")).join("\n\n")));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    const error = byId("study-error");
    error.textContent = "";
    byId("study-result").replaceChildren();
    button.disabled = true;
    button.textContent = "Running…";
    try {
      saveRun(await analyze(planFromForm()));
    } catch (problem) {
      error.textContent = problem.message;
    } finally {
      button.disabled = false;
      button.textContent = "Run my experiment";
    }
  });
  syncDesign();

  return { enableNASA, useObservation };
})();
