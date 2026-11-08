//! Paper Trail SpacetimeDB Module Schema
//! Real-Time Graph Database and Reducer Architecture for Financial Fraud Detection
//!
//! SpacetimeDB maintains the authoritative state of all monitored accounts,
//! transaction edges, AI investigation reports, predictive risk vectors,
//! and live collaborative analyst sessions.

use spacetimedb::{table, reducer, ReducerContext, Identity, Timestamp};

#[table(name = account, public)]
pub struct Account {
    #[primary_key]
    pub account_id: String,
    pub owner_name: String,
    pub account_type: String,       // e.g. "Personal Checking", "Business Wire", "Offshore VASP"
    pub institution: String,        // e.g. "Chase", "Cayman Commercial Bank"
    pub balance: f64,
    pub risk_score: u8,             // 0 to 100
    pub status: String,             // "normal", "suspicious", "flagged_mule", "predicted_risk", "frozen"
    pub kyc_verified: bool,
    pub country_code: String,
    pub updated_at: Timestamp,
}

#[table(name = transfer, public)]
pub struct Transfer {
    #[primary_key]
    pub transfer_id: String,
    pub from_account: String,
    pub to_account: String,
    pub amount: f64,
    pub currency: String,
    pub transfer_type: String,      // "Instant ACH", "SWIFT Wire", "Fedwire", "P2P"
    pub timestamp: Timestamp,
    pub is_suspicious: bool,
    pub flag_reason: Option<String>,
}

#[table(name = investigation, public)]
pub struct Investigation {
    #[primary_key]
    pub case_id: String,
    pub account_id: String,
    pub analyst_identity: Identity,
    pub analyst_name: String,
    pub risk_level: String,         // "LOW", "MEDIUM", "HIGH", "CRITICAL"
    pub summary: String,
    pub identified_patterns: Vec<String>,
    pub red_flags: Vec<String>,
    pub recommended_actions: Vec<String>,
    pub status: String,             // "open", "flagged_for_review", "frozen", "dismissed"
    pub created_at: Timestamp,
}

#[table(name = risk_prediction, public)]
pub struct RiskPrediction {
    #[primary_key]
    pub prediction_id: String,
    pub trigger_account_id: String,
    pub at_risk_accounts_json: String, // Serialized list of { account_id, risk_score, projected_role, timeframe }
    pub strategic_trajectory: String,
    pub created_at: Timestamp,
}

#[table(name = analyst_session, public)]
pub struct AnalystSession {
    #[primary_key]
    pub identity: Identity,
    pub analyst_name: String,
    pub role: String,
    pub current_view: String,
    pub active_case_id: Option<String>,
    pub is_online: bool,
    pub last_seen: Timestamp,
}

#[table(name = case_note, public)]
pub struct CaseNote {
    #[primary_key]
    pub note_id: String,
    pub case_id: String,
    pub author_name: String,
    pub content: String,
    pub timestamp: Timestamp,
}

// ==========================================
// REDUCERS (Live State Transitions)
// ==========================================

#[reducer]
pub fn create_transfer(ctx: ReducerContext, from: String, to: String, amount: f64, transfer_type: String) {
    let now = ctx.timestamp;
    let transfer_id = format!("TX-{}", now.to_micros());
    
    // Check for suspicious patterns (e.g. structuring under $10,000)
    let is_structuring = amount >= 9000.0 && amount < 10000.0;
    
    Transfer::insert(Transfer {
        transfer_id,
        from_account: from.clone(),
        to_account: to.clone(),
        amount,
        currency: "USD".to_string(),
        transfer_type,
        timestamp: now,
        is_suspicious: is_structuring,
        flag_reason: if is_structuring { Some("Potential Structuring / Smurfing Threshold".to_string()) } else { None },
    });
}

#[reducer]
pub fn flag_account_review(ctx: ReducerContext, account_id: String, reason: String) {
    if let Some(mut acc) = Account::find_by_account_id(&account_id) {
        acc.status = "flagged_mule".to_string();
        acc.risk_score = 92;
        acc.updated_at = ctx.timestamp;
        Account::update_by_account_id(&account_id, acc);
    }
}

#[reducer]
pub fn freeze_account(ctx: ReducerContext, account_id: String) {
    if let Some(mut acc) = Account::find_by_account_id(&account_id) {
        acc.status = "frozen".to_string();
        acc.updated_at = ctx.timestamp;
        Account::update_by_account_id(&account_id, acc);
    }
}

#[reducer]
pub fn save_investigation(
    ctx: ReducerContext,
    case_id: String,
    account_id: String,
    analyst_name: String,
    risk_level: String,
    summary: String,
    identified_patterns: Vec<String>,
    red_flags: Vec<String>,
    recommended_actions: Vec<String>,
) {
    Investigation::insert(Investigation {
        case_id,
        account_id,
        analyst_identity: ctx.sender,
        analyst_name,
        risk_level,
        summary,
        identified_patterns,
        red_flags,
        recommended_actions,
        status: "flagged_for_review".to_string(),
        created_at: ctx.timestamp,
    });
}

#[reducer]
pub fn save_risk_prediction(
    ctx: ReducerContext,
    prediction_id: String,
    trigger_account_id: String,
    at_risk_accounts_json: String,
    strategic_trajectory: String,
) {
    RiskPrediction::insert(RiskPrediction {
        prediction_id,
        trigger_account_id,
        at_risk_accounts_json,
        strategic_trajectory,
        created_at: ctx.timestamp,
    });
}

#[reducer]
pub fn add_case_note(ctx: ReducerContext, case_id: String, author_name: String, content: String) {
    let note_id = format!("NOTE-{}", ctx.timestamp.to_micros());
    CaseNote::insert(CaseNote {
        note_id,
        case_id,
        author_name,
        content,
        timestamp: ctx.timestamp,
    });
}

