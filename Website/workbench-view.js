// Explore investigation UI. app.js owns the selected place and the shared chart renderer.
function renderFollowUps(measurement) {
  const panel = $("follow-ups");
  if (!state.analysis) {
    panel.hidden = true;
    panel.replaceChildren();
    return;
  }
  const full = state.fullRecord;
  const choices = ByteMeExperiments.relatedLeads(measurement.code, full.series);
  const partner = partnerOf(measurement);
  if (partner && full.series[partner.code]?.values.some(Number.isFinite)) {
    choices.push({
      from: measurement.code, to: partner.code, label: "Check another source", expectedSign: 1,
      prediction: "If the products agree about the direction of change, both should show the same direction over their shared months.",
      alternative: "Differences in coverage, resolution, or how a product defines the measurement can explain a disagreement.",
      nextEvidence: "Check the product descriptions for differences in spatial coverage and what each instrument measures.",
    });
  }
  panel.hidden = false;
  const file = ByteMeWorkbench.openCase(state);
  const { active } = file;
  const options = VARS.filter(({ code }) => code !== measurement.code && full.series[code]?.values.some(Number.isFinite));
  const untested = choices.find((lead) => !ByteMeWorkbench.findEntry(file, lead, state.period));
  const rival = active && availableRival(active);
  panel.innerHTML = `<h3>Investigation workspace</h3>
    <p>What processes might shape ${escapeHTML(measurement.name)} near ${escapeHTML(state.name)}?</p>
    ${choices.length ? `<div class="lead-options">${choices.map(({ to, label }) =>
      `<button type="button" class="pill" data-lead="${to}">${escapeHTML(label)}</button>`).join("")}</div>` : ""}
    ${options.length ? customLeadForm(options, file.entries) : "<p>No other measurement is available for this location.</p>"}
    ${file.entries.length ? renderEvidenceMap(file) : ""}
    ${file.studies.length ? `<div class="workbench-map"><h4>Saved intervention comparisons</h4>
      <ul>${file.studies.map(({ title, summary }) => `<li>
        <details><summary>${escapeHTML(title)}</summary><p>${escapeHTML(summary)}</p></details>
      </li>`).join("")}</ul></div>` : ""}
    ${file.entries.length || file.studies.length ? '<button type="button" class="pill" data-save-notes>Download investigation notes</button>' : ""}
    <div class="lead-evidence"></div>
    <div class="workbench-next">
      <h4>Next step</h4>
      ${workbenchNext(untested, active, rival)}
      <button type="button" class="pill" data-study-event>Study a dated event</button>
      <button type="button" class="pill" data-open-builder>Design an experiment</button>
    </div>`;

  function showResult() {
    renderFollowUps(measurement);
    panel.querySelector(".lead-evidence [tabindex]")?.focus();
  }

  panel.querySelectorAll("[data-lead]").forEach((button) => button.addEventListener("click", () => {
    const lead = choices.find(({ to }) => to === button.dataset.lead);
    ByteMeWorkbench.runLead(file, lead, state.period, state.analysis.series);
    showResult();
  }));
  panel.querySelector("[data-custom-lead]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = event.currentTarget.elements;
    const label = fields.explanation.value.trim();
    if (!label) {
      fields.explanation.value = "";
      fields.explanation.reportValidity();
      return;
    }
    const to = fields.candidate.value, expectedSign = Number(fields.direction.value);
    const driver = fields.role.value === "driver" ? to : measurement.code;
    const prediction = `If this explanation fits, ${measurement.name} and ${variable(to).name} should trend in ${expectedSign === 1 ? "the same direction" : "opposite directions"}.`;
    const original = file.entries.find(({ id }) => id === Number(fields.rivalOf?.value));
    ByteMeWorkbench.runLead(file, { from: measurement.code, to, driver, label, expectedSign, prediction },
      state.period, state.analysis.series, Number(fields.lag.value), original);
    showResult();
  });
  panel.querySelectorAll("[data-entry]").forEach((button) => button.addEventListener("click", () => {
    file.active = file.entries.find(({ id }) => id === Number(button.dataset.entry));
    showResult();
  }));
  panel.querySelector("[data-save-notes]")?.addEventListener("click", () => saveInvestigation(file, measurement));
  panel.querySelector("[data-study-event]").addEventListener("click", () => {
    useExploreInCompare(true);
    $("dated-intervention").open = true;
  });
  panel.querySelector("[data-open-builder]").addEventListener("click", () => ByteMeStudyView.useObservation(state));
  if (active) renderLeadEvidence(panel.querySelector(".lead-evidence"), active, rival, showResult);
}

function customLeadForm(options, entries) {
  const rivals = entries.filter(({ assessment }) => assessment.paired?.count);
  return `<details class="workbench-form">
    <summary>Add your own explanation</summary>
    <form data-custom-lead>
      <label>Explanation<input name="explanation" required maxlength="180" placeholder="What process do you think connects the two measurements?"></label>
      <div class="workbench-fields">
        <label>Other measurement<select name="candidate">${options.map(({ code, name }) =>
          `<option value="${code}">${escapeHTML(name)}</option>`).join("")}</select></label>
        <label>Role of the other measurement<select name="role">
          <option value="driver">Proposed driver</option><option value="outcome">Proposed outcome</option>
        </select></label>
        <label>Predicted trend<select name="direction">
          <option value="1">Same direction</option><option value="-1">Opposite directions</option>
        </select></label>
        <label>Driver comes first by<select name="lag">
          <option value="0">Same month</option>${[1, 2, 3, 6, 12].map((months) =>
            `<option value="${months}">${months} month${months === 1 ? "" : "s"}</option>`).join("")}
        </select></label>
        ${rivals.length ? `<label>Check against<select name="rivalOf">
          <option value="">Current period</option>
          ${rivals.map(({ id, lead }) => `<option value="${id}">Lead ${id} · same months as ${escapeHTML(lead.label)}</option>`).join("")}
        </select></label>` : ""}
      </div>
      <button class="pill on" type="submit">Check prediction</button>
    </form>
  </details>`;
}

const leadStatus = { consistent: "Fits prediction", weakened: "Weakened", insufficient: "Open" };

function renderEvidenceMap(file) {
  return `<div class="workbench-map">
    <h4>Evidence map</h4>
    <p class="meta">Arrows show proposed cause and effect. Select a link to review the evidence from its original period.</p>
    <ul>${file.entries.map((entry) => {
      const { id, lead, assessment, rival, rivalOf } = entry;
      const [from, to] = lead.driver === lead.to ? [lead.to, lead.from] : [lead.from, lead.to];
      return `<li><button type="button" class="evidence-link" data-entry="${id}" aria-pressed="${file.active === entry}">
        <span>${escapeHTML(variable(from).name)} ${lead.driver ? "→" : "↔"} ${escapeHTML(variable(to).name)}</span>
        <span class="meta">${id}. ${escapeHTML(lead.label)} · ${entryCoverage(assessment.paired)}</span>
        <strong class="evidence-status ${assessment.verdict}">${leadStatus[assessment.verdict]}</strong>
        ${rival ? `<span class="meta">Rival · ${leadStatus[rival.assessment.verdict]}</span>` : ""}
        ${rivalOf ? `<span class="meta">Rival to lead ${rivalOf}</span>` : ""}
      </button></li>`;
    }).join("")}</ul>
  </div>`;
}

function entryCoverage(paired) {
  return paired?.count ? `${dateSpan(paired.first, paired.last)} · ${paired.count} shared months` : "No shared observations";
}

function availableRival({ lead, assessment, records }) {
  return assessment.verdict === "weakened" ? ByteMeExperiments.rivalLead(lead, records) : null;
}

function workbenchNext(untested, active, rival) {
  if (rival && !active.rival) return "<p>Run the rival check above on the same observations before setting the original explanation aside.</p>";
  if (untested) return `<p>Check another prediction in the selected period.</p>
    <button type="button" class="pill on" data-lead="${untested.to}">${escapeHTML(untested.label)}</button>`;
  if (active?.assessment.verdict === "insufficient") {
    return "<p>Check the overlap shown above. Try a longer period or a more complete record, then run the prediction again.</p>";
  }
  if (active?.lead.nextEvidence) return `<p>${escapeHTML(active.lead.nextEvidence)}</p>`;
  return "<p>If you know when a suspected cause began, compare the affected place with a reference place over the same months.</p>";
}

function associationText({ association, lag }) {
  if (!association) return "";
  const timing = lag ? `driver ${lag} month${lag === 1 ? "" : "s"} earlier` : "same month";
  return `Correlation after removing seasonal cycles and linear trends is ${num(association.correlation)} (${timing}, ${association.count} pairs).`;
}

function leadFinding(lead, { fits, verdict }) {
  if (verdict === "weakened") return leadCounterEvidence(lead, fits);
  if (verdict === "consistent") return "Both measurements have a clear direction over the same months, and their directions fit the prediction.";
  return "The trend tests did not give both measurements a clear, reliable direction over this period.";
}

function renderLeadEvidence(panel, entry, rival, showResult) {
  const { lead, assessment } = entry;
  const { paired, fits, verdict } = assessment;
  const headlines = {
    consistent: "The records fit this prediction",
    weakened: "The trends weaken this explanation",
    insufficient: "The evidence leaves this lead open",
  };
  const timing = associationText(entry);
  const chartSlots = [lead.from, lead.to].map((code, index) => {
    const id = index === 0 ? "lead-chart-a" : "lead-chart-b";
    return `<div><h4>${escapeHTML(variable(code).name)}</h4><div id="${id}" class="chart"></div></div>`;
  }).join("");
  const explanation = verdict === "weakened"
    ? `<div class="lead-rival">
        <h4>A rival explanation</h4>
        <p>${escapeHTML(lead.alternative ?? "A shared driver or a change in the measurements could account for the observed directions. Add a rival with a different prediction to compare them.")}</p>
        ${entry.rival ? '<div data-rival-result></div>' : rival ? '<button type="button" class="pill" data-test-rival>Check rival prediction</button>' : ""}
      </div>`
    : "";
  panel.innerHTML = `<h4 tabindex="-1">${escapeHTML(lead.label)}</h4><p>${escapeHTML(lead.prediction)}</p>
    ${!ByteMeWorkbench.samePeriod(entry.period, state.period) ? "<p class='meta'>This check used an earlier period selection.</p>" : ""}
    <div class="experiment-finding">
      <h4>${headlines[verdict]}</h4>
      <p class="meta">${entryCoverage(paired)}</p>
      ${paired?.count ? `<p>${verdict === "weakened" ? "<strong>Counter-evidence</strong> · " : ""}${escapeHTML(leadFinding(lead, assessment))}</p>` : ""}
      ${timing ? `<p>${timing} Shared drivers can produce this pattern too.</p>` : ""}
    </div>
    ${explanation}
    ${fits.length ? `<div class="lead-charts">${chartSlots}</div>` : ""}`;
  panel.querySelector("[data-test-rival]")?.addEventListener("click", () => {
    ByteMeWorkbench.runRival(entry, rival);
    showResult();
    $("follow-ups").querySelector("[data-rival-result]")?.focus();
  });
  if (entry.rival) renderRivalResult(panel.querySelector("[data-rival-result]"), entry.rival, paired);
  if (!fits.length) return;
  [lead.from, lead.to].forEach((code, index) => {
    const v = variable(code), id = index === 0 ? "lead-chart-a" : "lead-chart-b";
    const series = { dates: paired.dates, values: paired.values[index] };
    const reference = { dates: state.fullRecord.series[code]?.dates, fit: state.fullRecord.results[code] };
    drawChart(id, fits[index], series, v, false, undefined, reference);
  });
}

function leadCounterEvidence(lead, fits) {
  const names = [variable(lead.from).name, lead.targetName ?? variable(lead.to).name];
  const [first, second] = names.map((name, index) => {
    const fit = fits[index];
    const code = index === 0 ? lead.from : lead.to;
    const units = index === 1 && lead.kind === "evaporation" ? "mm/day" : variable(code).units;
    const verb = fit.direction === "increase" ? "rose" : "fell";
    return `${name} ${verb} (${num(fit.slope_per_decade)} ${units} per decade)`;
  });
  const prediction = lead.expectedSign === 1 ? "the same direction" : "opposite directions";
  return `${first}, while ${second}. The prediction called for ${prediction}.`;
}

function renderRivalResult(panel, { lead: rival, assessment }, originalPair) {
  const { paired, fits, verdict, componentFits } = assessment;
  const findings = {
    consistent: "The trends fit this rival prediction. The mechanism still needs a more direct test.",
    weakened: "The trends also weaken this rival explanation.",
    insufficient: "The observations leave this rival explanation open.",
  };
  const evidence = verdict === "weakened" ? ` ${leadCounterEvidence(rival, fits)}` : "";
  const waterEvidence = componentFits?.every((fit) => Number.isFinite(fit.slope_per_decade))
    ? `<p>Change per decade over those months</p>
      <ul>
        <li>Precipitation ${num(componentFits[0].slope_per_decade)} mm/day</li>
        <li>Evaporation ${num(componentFits[1].slope_per_decade)} mm/day</li>
        <li>Precipitation minus evaporation ${num(fits[1].slope_per_decade)} mm/day</li>
        <li>Root-zone wetness ${num(fits[0].slope_per_decade)} percentage points</li>
      </ul>
      <p>Runoff, irrigation, and changes in water storage can still affect root-zone wetness.</p>`
    : "";
  panel.tabIndex = -1;
  panel.innerHTML = `<p>${escapeHTML(rival.prediction)}</p>
    <p><strong>${findings[verdict]}</strong>${escapeHTML(evidence)}</p>
    <p class="meta">${paired?.count ?? 0} of the original ${originalPair.count} observed months could be used.</p>
    ${waterEvidence}`;
}

function saveInvestigation(file, measurement) {
  const notes = file.entries.map(({ lead, assessment, rival, ...entry }) => [
    `${entry.id}. ${lead.label}${entry.rivalOf ? ` (rival to lead ${entry.rivalOf})` : ""}`,
    lead.prediction, entryCoverage(assessment.paired),
    `${leadStatus[assessment.verdict]}. ${leadFinding(lead, assessment)}`,
    associationText(entry),
    assessment.verdict === "weakened" && lead.alternative ? `Rival explanation. ${lead.alternative}` : "",
    rival ? `${rival.lead.prediction} ${leadStatus[rival.assessment.verdict]}. ${leadFinding(rival.lead, rival.assessment)} ${entryCoverage(rival.assessment.paired)}.` : "",
    lead.nextEvidence ?? "",
  ].filter(Boolean).join("\n"));
  const heading = [state.name, `${measurement.name} (${measurement.source})`,
    "Observational checks of proposed explanations."].join("\n");
  const studies = file.studies.map(({ title, summary }) => `${title}\n${summary}`);
  const url = URL.createObjectURL(new Blob([[heading, ...notes, ...studies].join("\n\n")], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "byteme-investigation.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
