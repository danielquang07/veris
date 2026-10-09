use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub paused: bool,
    pub bump: u8,
}

impl Config {
    pub const LEN: usize = 8 + 32 + 1 + 1;
}

#[account]
pub struct ScamReport {
    pub reporter: Pubkey,
    pub reported: Pubkey,
    pub scam_type: u8,
    pub evidence_hash: [u8; 32],
    pub description_hash: [u8; 32],
    pub timestamp: i64,
    pub bump: u8,
}

impl ScamReport {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 32 + 32 + 8 + 1;
}

#[account]
pub struct AiResult {
    pub authority: Pubkey,
    pub subject: Pubkey,
    pub risk_score: u8,
    pub model_hash: [u8; 32],
    pub result_hash: [u8; 32],
    pub evidence_uri_hash: [u8; 32],
    pub timestamp: i64,
    pub bump: u8,
}

impl AiResult {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 32 + 32 + 32 + 8 + 1;
}
