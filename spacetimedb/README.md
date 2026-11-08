# FraudGraph SpacetimeDB Real-Time Engine

FraudGraph uses SpacetimeDB as its real-time, relational, multi-client graph synchronization engine.

## Real-Time Architecture

```
                    ┌──────────────────────────────┐
                    │      NVIDIA Nemotron AI       │
                    │   (Forensics & Risk Models)  │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
┌──────────────────┐       ┌───────────────────────┐       ┌──────────────────┐
│  Sarah (Analyst) │◄─────►│      SpacetimeDB      │◄─────►│ Elena (Analyst)  │
│  Browser Client  │       │ Real-Time Sync Engine │       │  Browser Client  │
└──────────────────┘       └───────────────────────┘       └──────────────────┘
                                   ▲
                                   │
                           Live Transactions
                           (ACH, Wire, SWIFT)
```

### Tables
1. `account`: Core bank and business accounts, risk scores (0-100), and statuses.
2. `transfer`: Graph edges representing financial transactions with amounts and flags.
3. `investigation`: Forensic dossiers compiled by NVIDIA Nemotron and bank analysts.
4. `risk_prediction`: Predictive threat intelligence mapping future high-risk accounts.
5. `analyst_session`: Collaborative analyst presence and active views.
6. `case_note`: Real-time collaborative investigation log and notes.

### Reducers
- `create_transfer`: Ingests and evaluates incoming banking transactions.
- `flag_account_review`: Escalates an account to AML / SAR human review.
- `freeze_account`: Temporarily halts outgoing transfers for a compromised node.
- `save_investigation`: Stores full AI forensic report in real time across all clients.
- `save_risk_prediction`: Publishes predicted future risk vectors to all analyst dashboards.
- `add_case_note`: Adds a shared audit comment visible instantly to other analysts.

