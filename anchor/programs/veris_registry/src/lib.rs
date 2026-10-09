use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod veris_registry {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        instructions::handle_initialize_config(ctx)
    }

    pub fn report_scam(
        ctx: Context<ReportScam>,
        report_index: u64,
        scam_type: u8,
        evidence_hash: [u8; 32],
        description_hash: [u8; 32],
    ) -> Result<()> {
        instructions::handle_report_scam(ctx, report_index, scam_type, evidence_hash, description_hash)
    }

    pub fn log_ai_result(
        ctx: Context<LogAiResult>,
        slot: u64,
        risk_score: u8,
        model_hash: [u8; 32],
        result_hash: [u8; 32],
        evidence_uri_hash: [u8; 32],
    ) -> Result<()> {
        instructions::handle_log_ai_result(ctx, slot, risk_score, model_hash, result_hash, evidence_uri_hash)
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        instructions::handle_set_paused(ctx, paused)
    }
}
