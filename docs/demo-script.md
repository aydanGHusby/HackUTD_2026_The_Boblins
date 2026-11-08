# Paper Trail demo script

Two parts: the **video** (under 2 minutes, one voice-over) and the **live demo** for judges (about 6 minutes). Both run on the app from `main`.

Roles, on two laptops or two different browsers (tabs in one browser share one identity):

- **Analyst:** name `Priya Shah`, role **Analyst**.
- **Senior:** name `Jordan Lee`, role **Senior**.

---

## 1. Setup (before recording or judging)

1. **Stop every AI worker.** On every laptop, close any terminal running `npm run worker:spacetime` (it prints `polling SpacetimeDB for queued cases`). A running worker debates every queued case the moment it appears, so cases show "Re-run trial" and the Northgate loan gets debated before you click anything.
2. **Start the app** with the team `.env` in the repo root (`NVIDIA_API_KEY`, `NEMOTRON_THINKING=off`, `SPACETIMEDB_URL`, `SPACETIMEDB_DATABASE=fraudgraph-boblins`):
   ```bash
   npm run dev
   ```
   The app is at http://localhost:3200. Keep the terminal and `.env` off screen: they hold the API key.
3. **Set the identities** in the sidebar (bottom left): name, then the Analyst / Senior switch.
4. **Reset:** as Senior, **Operations → Reset demo data → confirm.** Loads the 12 demo cases, including the CASE-06 fraud ring.
5. **Check:** Operations shows the **Live** badge; Cases lists 12 cases.

Run order: **stop workers → reset → rehearse → reset → record or demo.** Rehearsing uses the cases up.

---

## 2. Video (under 2 minutes)

Record in short clips (macOS: Cmd+Shift+5 → Record Selected Portion) and join them. Cut the ~10 s trial wait to ~2 s in editing. Record the Analyst and Senior in two browser windows side by side so the sign-off arriving is visible.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:12 | Landing page → **Cases** | "Commercial-loan fraud hides across deals: one warehouse pledged twice, one person behind several borrowers. Paper Trail catches it." |
| 0:12–0:30 | **New loan:** Northgate Logistics Holdings, amount `1200000`, purpose "Fleet acquisition", guarantor **Raymond Voss** → **Submit and run risk rules** → flags include **cross deal link**, risk 100 | "A new application comes in. Our risk rules search every other deal and find this borrower shares a director and address with three other companies." |
| 0:30–0:40 | Open the new case (**CASE-13**) → **Network map**: the ring in red, the blue dotted hidden-address line | "The map shows the hidden network, including a shared address no record mentions, found by our code." |
| 0:40–1:05 | **Run trial** → *(cut the wait)* → Risk agent and Legitimacy agent messages appear → click one claim, its records light up | "Two NVIDIA Nemotron agents debate the case: one argues fraud, one argues it's legitimate. Every claim must cite real records; click one and you see what it's based on." |
| 1:05–1:15 | **Credit memo** tab: suggested next step, conditions, documents to request | "A third AI writes a credit memo with a suggested next step. It's a suggestion: a person decides." |
| 1:15–1:35 | Analyst: **Choose the next step → Ask a senior reviewer**, reason, submit → Senior: **Escalations** → the case appears → reason → **Fraud** → the bar ends at **Declined** | "Four-eyes rules: escalations and large approvals need a different senior, and no one approves their own decision." |
| 1:35–1:50 | **Operations** page | "Managers see the whole pipeline live. Code finds the facts, AI argues both sides, and people decide, with every step on the record." |

---

## 3. Live demo for judges (about 6 minutes)

Before judges arrive: after the reset, open **CASE-06** and click **Run trial** (about 10 s) so the ring's debate and memo are ready. Leave **CASE-01** untouched (its seeded fake-citation claim) and **CASE-03 / CASE-04** untouched (sign-off and funding steps).

**0. Opening (15 s).** "Commercial-loan fraud hides *across* deals. Paper Trail finds those links, has two AI agents argue both sides, and leaves the decision to a person, with every step on the record."

**1. The queue (30 s): Cases.** Flagged loans sorted by risk, with the "why flagged" tags. "Every application goes through risk rules automatically. Clean loans are approved straight away; risky ones open a case."

**2. The fraud ring (75 s): CASE-06, Meridian Cold Storage.**
- **Network map:** Raymond Voss's companies in red; the blue dotted line is a shared address no record mentions, found by the code clerk.
- **Evidence:** facts computed by code, e.g. "Connected group owes $5.9M", "guarantor net worth covers 0.19×".
- **Agent discussion:** click a claim and its records light up.
- **Credit memo:** key numbers, suggested next step, conditions, documents to request. "That's a suggestion. The analyst decides."

**3. The fact-checker (20 s): CASE-01, Harbor Freight.** The claim marked **"Hidden · failed citation check"** cites `lien-77`, which doesn't exist. "If an agent cites something that isn't in our records, it's hidden automatically."

**4. Catching fraud at intake (90 s): Analyst → New loan.** Northgate Logistics Holdings, `1200000`, "Fleet acquisition", guarantor **Raymond Voss** → **Submit and run risk rules**. Flags include **cross deal link**, risk 100 → open **CASE-13**: the ring lights up red → **Run trial** (about 10 s). The memo should suggest escalate or decline.

**5. Four eyes on a risky loan (45 s).**
1. Analyst on CASE-13: **Choose the next step → Ask a senior reviewer**, reason, submit.
2. *Optional:* switch the Analyst to Senior to show "Priya Shah made this decision, so a different senior has to sign off." Switch back.
3. Senior → **Escalations:** the case appears within about a second → reason → **Fraud**.
4. Analyst: the bar ends at **Declined**.

**6. The full lifecycle (45 s): CASE-03, Crestview, $2.5M.**
1. Senior → **Escalations:** CASE-03 is listed as **"Over $1M approval"** → reason → **Not fraud**.
2. Analyst → **CASE-03:** **Mark closed**, then **Fund loan**. The bar reaches **Monitored**.
3. **History** tab: every step with who and when.

**7. Operations (30 s).** Cases waiting, time to decision, auto-approved %, decision split, trials run, loans by stage.

**8. Close (15 s).** "Code gathers the facts, two AI agents argue both sides, a third writes the memo, and a person decides, with four-eyes rules and a full audit trail."

---

## 4. If something goes wrong

| Problem | What to do |
|---|---|
| Cases already show "Re-run trial" or get debated by themselves | An AI worker is running somewhere. Stop it (Setup step 1), then reset again. |
| Live trial slow or fails (rate limit) | The intake catch and the red ring don't need AI. Show the debate and memo on pre-run **CASE-06**, and do step 5 on **CASE-04** (already escalated): the Senior signs it off from Escalations. |
| "Analysis interrupted" on Run trial | The laptop running `npm run dev` needs `NVIDIA_API_KEY` in the root `.env`, or the rate limit was hit: wait a moment and click Retry. |
| "Connecting…" or "Offline" badge | Refresh once. If the database is down, the app falls back to demo data on one laptop; skip the two-laptop parts. |
| A judge wants to try it | Let them submit a loan on New loan. Raymond Voss's companies (Meridian, Pinecrest, Silverline, Northgate) trigger the cross-deal flag. |

---

## 5. Likely questions

| Question | Answer |
|---|---|
| Where does the data come from? | Synthetic, hand-built around real commercial-lending fraud patterns (double-pledged collateral, shell companies, guarantor over-exposure, a related-party ring). Real fraud-labelled loan files aren't public. The analysis is real: metrics and cross-deal links are computed by code, the debate runs live, and new loans can be submitted on the spot. |
| Where's the AI/ML? Is there a trained model? | No trained model. NVIDIA Nemotron runs the two arguing agents and the memo; detection is graph analysis in code plus rules. With no labelled commercial-fraud data, a trained classifier would be guesswork. |
| How do you stop the AI making things up? | Code collects the facts, every claim must cite record ids, the fact-checker hides claims with ids that don't exist, and clicking a claim shows its records on the map. |
| How accurate is it? | The AI never decides, so there's no verdict accuracy. What matters is what reaches the analyst: risky loans get flagged, every fact comes from code, every claim cites a real record, and a person makes the call. |
| Why two agents? | One AI gives one opinion that people tend to accept. A debate shows the strongest case for both sides, and the memo shows where they disagree and which document would settle it. |
| How is it secured? | For the demo, identity is a typed name and role. The process is secured: four-eyes approval over $1M, no self-approval, senior-only escalations, full audit trail. In production: bank sign-on and the rules enforced on the server. |
| How is the risk score computed? | 20 plus 30 for each rule that fires, capped at 100. Deliberately simple and explainable. |
| What does "Monitored" do? | Today it marks the stage. Next step: re-run the cross-deal search whenever a new loan arrives and alert on funded loans it touches (Northgate's loan links to already-approved L-1007 and L-1008). |
| Speed and cost? | A trial is 5 model calls, about 10 s. The cross-deal search is one pass over the links; a graph database would take over at very large scale. |
| Why SpacetimeDB? | Several analysts work the same case live: decisions, sign-offs and arguments sync within about a second. |
