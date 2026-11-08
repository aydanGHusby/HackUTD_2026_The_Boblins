# FraudGraph ⚡

**AI-Powered Financial Fraud Detection & Predictive Intelligence Platform**  
*Built for HackUTD 2026*

FraudGraph is an enterprise financial fraud detection and prediction platform that helps banks and financial institutions identify suspicious transactions before they become catastrophic losses. 

Using **NVIDIA Nemotron 3.5 Super (120B)** and a real-time **SpacetimeDB** collaborative architecture, the platform analyzes high-velocity transaction clusters, investigates unusual patterns across account networks, predicts which accounts may be at risk of future fraud, and displays everything on an interactive network graph.

---

## 🌟 Key Features

- **Interactive Financial Network Graph:**
  - Dynamic force-directed graph visualizing accounts (nodes) and transfers (directed edges).
  - Real-time particle stream reflecting money flow velocity.
  - Distinct risk halos: Normal accounts, Monitored/Velocity spikes, Flagged Mule nodes (crimson pulse), and Predicted At-Risk accounts (electric purple dashed aura).
  - Zoom, pan, drag-and-drop node physics, and neighborhood filtering (`Flagged Mules`, `Predicted At-Risk`, `>$10,000`).

- **NVIDIA Nemotron 3.5 Super Forensic Investigation:**
  - Automated deep forensic analysis examining transaction histories, CTR structuring thresholds, velocity spikes, and network topology.
  - Generates an executive forensic dossier with Detection Summary, Identified Fraud Patterns, Red Flags, Risk Level, and Immediate Analyst Actions.

- **⚡ "Predict Future Risks" (Predictive Intelligence):**
  - FraudGraph doesn't just show what happened—it anticipates where risks will emerge next.
  - Nemotron evaluates potential laundering routes and highlights peripheral accounts likely to be targeted next as mules or cash-out points, calculating risk probabilities and estimated timeframes.

- **SpacetimeDB Real-Time Collaboration:**
  - Multi-analyst live state (Sarah Jenkins, Elena Rostova, Marcus Vance) with synchronized presence.
  - Real-time Server-Sent Events (SSE) streaming incoming transactions and investigation updates.
  - Collaborative case management: Flag for Human Review (SAR), Freeze Accounts, and shared case notes.

- **Interactive Scenarios & Traffic Simulation:**
  - **Scenario 1:** *Sarah's Case* (Multi-Hop Smurfing & Offshore Layering into Crypto Gateway Cayman).
  - **Scenario 2:** *Syndicate Circular Wash Loop*.
  - **Scenario 3:** *Compromised Payroll Star-Burst*.
  - Live traffic simulator streaming dynamic banking flows.

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
                           Live Banking Feeds
                       (Instant ACH, Wires, SWIFT)
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
Or run with auto-reload during development:
```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📂 Project Structure

```
├── dist/
│   ├── index.html        # Interactive Frontend & Graph Canvas Engine
│   └── server/
│       └── index.js      # Compiled Server Bundle for Edge / Node
├── src/
│   └── worker.mjs        # Server Compiler & Nemotron API Handlers
├── spacetimedb/
│   ├── schema.rs         # SpacetimeDB Rust Tables & Reducers
│   └── README.md         # SpacetimeDB Integration Documentation
├── server.mjs            # Node.js Server & Real-Time SSE Hub
├── package.json          # Project scripts and configuration
├── .env.example          # Environment variables template
└── README.md             # Project documentation
```

