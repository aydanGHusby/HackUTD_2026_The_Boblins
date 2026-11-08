# FraudGraph ⚡

**AI-Powered Financial Fraud Detection & Predictive Intelligence Platform**  
*Built for HackUTD 2026*

FraudGraph is an enterprise financial fraud detection and prediction platform that helps banks and financial institutions identify suspicious transactions before they become catastrophic losses. 

Using **NVIDIA Nemotron 3.5 Super (120B)** and a real-time **SpacetimeDB** collaborative architecture, the platform analyzes high-velocity transaction clusters, investigates unusual patterns across account networks, predicts which accounts may be at risk of future fraud, and displays everything on an interactive network graph.

---

## 🔬 IBM AML Synthetic Dataset Integration

FraudGraph is built directly on the structure of **IBM's Transactions for Anti-Money Laundering (AML)** synthetic dataset:

```
Timestamp,From_Bank,From_Account,To_Bank,To_Account,Amount_Paid,Payment_Format,Is_Laundering,Pattern_Type
2026/11/07 09:00,005,ACC-1102,001,ACC-8492,9800.00,ACH,1,Structuring_Inflow
2026/11/07 09:40,001,ACC-8492,099,ACC-9920,29500.00,CrossBorder_Wire,1,Offshore_Layering
2026/11/07 10:00,099,ACC-9920,003,ACC-3310,42000.00,CrossBorder_Wire,1,Future_Predicted_Laundering
```

### The 3-Phase Evaluation Experiment

1. **Phase 1 — Ingest Ground-Truth Dataset:**  
   Import curated IBM synthetic AML transactions and bank accounts into the real-time SpacetimeDB engine, mapping nodes (accounts) and edges (transactions).

2. **Phase 2 — Detect & Investigate ($T \le 09:45\text{ AM}$):**  
   Deterministic anomaly detectors flag sub-$10,000 CTR structuring patterns. **NVIDIA Nemotron** runs automated forensic investigations on the flagged cluster.

3. **Phase 3 — Forecast Emerging Risks & Reveal Ground Truth ($T \ge 10:00\text{ AM}$):**  
   - **Blind Prediction:** Later transactions ($T \ge 10:00\text{ AM}$) are masked from the AI. Nemotron analyzes graph topology and predicts which peripheral accounts will be used next as laundering exit nodes (`ACC-3310` and `ACC-5521`).
   - **Ground Truth Evaluation:** Reveal the future transactions and evaluate Nemotron's early warnings against the actual labeled illicit activity:
     - **Precision:** 100% (2 / 2 flagged accounts confirmed)
     - **Recall:** 100% (All downstream exit points intercepted)
     - **False Positives:** 0 clean accounts over-flagged
     - **Lead Time:** **+45 Minutes early warning** before the $42,000 and $85,000 illicit transfers executed!

---

## 🌟 Key Features

- **Interactive Financial Network Graph:**
  - Dynamic force-directed graph visualizing accounts (nodes) and transfers (directed edges).
  - Real-time particle stream reflecting money flow velocity.
  - Distinct risk halos: Normal accounts, Monitored/Velocity spikes, Flagged Mule nodes (crimson pulse), and Predicted At-Risk accounts (electric purple dashed aura).
  - Interactive hover tooltips displaying account balance, institution, and risk gauges.

- **NVIDIA Nemotron 3.5 Super Forensic Investigation:**
  - Automated deep forensic analysis examining transaction histories, CTR structuring thresholds, velocity spikes, and network topology.
  - Generates executive forensic reports with Detection Summaries, Identified Patterns, Red Flags, Risk Levels, and Immediate Analyst Actions.

- **⚡ "Predict Future Risks" (Predictive Intelligence):**
  - Evaluates potential laundering routes and highlights peripheral accounts likely to be targeted next as mules or cash-out points, calculating risk probabilities and estimated timeframes.

- **⚖️ Human-in-the-Loop Analyst Decisions (YES / NO):**
  - Bank analysts can choose **YES** to confirm fraud (freezing the account and filing a SAR) or **NO** to dismiss the alert as legitimate activity.

- **SpacetimeDB Real-Time Collaboration:**
  - Multi-analyst live state (Sarah Jenkins, Elena Rostova, Marcus Vance) with synchronized presence.
  - Real-time Server-Sent Events (SSE) streaming incoming transactions, investigation updates, and shared case notes.

---

## 🛠️ Architecture

```
                    ┌──────────────────────────────┐
                    │  NVIDIA Nemotron 3.5 Super   │
                    │  (Forensics & Risk Models)   │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
┌──────────────────┐       ┌───────────────────────┐       ┌──────────────────┐
│  Sarah (Analyst) │◄─────►│      SpacetimeDB      │◄─────►│ Elena (Analyst)  │
│  Browser Client  │       │ Real-Time Sync Hub    │       │  Browser Client  │
└──────────────────┘       └───────────────────────┘       └──────────────────┘
                                   ▲
                                   │
                           IBM Synthetic AML
                         Transaction Data Stream
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- NVIDIA API Key with access to `nvidia/nemotron-3.5-super-vl-120b-a12b`

### 2. Configuration
Copy `.env.example` to `.env` and fill in your NVIDIA credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
NVIDIA_API_KEY=your_nvidia_api_key_here
NVIDIA_MODEL=nvidia/nemotron-3.5-super-vl-120b-a12b
PORT=3000
```

### 3. Run Locally
Start the server:
```bash
npm start
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📂 Project Structure

```
├── data/
│   └── ibm_aml_transactions.csv  # Curated IBM Synthetic AML Dataset
├── dist/
│   ├── index.html                # Interactive Frontend, Graph Canvas & Benchmark Engine
│   └── server/
│       └── index.js              # Compiled Server Bundle for Edge / Node
├── src/
│   └── worker.mjs                # Server Compiler & Nemotron API Handlers
├── spacetimedb/
│   ├── schema.rs                 # SpacetimeDB Rust Tables & Reducers
│   └── README.md                 # SpacetimeDB Integration Documentation
├── server.mjs                    # Node.js Server & Real-Time SSE Hub
├── package.json                  # Project scripts and configuration
├── .env.example                  # Environment variables template
└── README.md                     # Project documentation
```
