use anchor_lang::prelude::*;

#[event]
pub struct ScamReported {
    pub report: Pubkey,
    pub reporter: Pubkey,
    pub reported: Pubkey,
    pub scam_type: u8,
    pub timestamp: i64,
}

#[event]
pub struct AiResultLogged {
    pub ai_result: Pubkey,
    pub subject: Pubkey,
    pub risk_score: u8,
    pub timestamp: i64,
}
