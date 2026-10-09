use anchor_lang::prelude::*;

use crate::errors::RegistryError;
use crate::events::{AiResultLogged, ScamReported};
use crate::state::{AiResult, Config, ScamReport};

pub const CONFIG_SEED: &[u8] = b"config";
pub const REPORT_SEED: &[u8] = b"report";
pub const AI_RESULT_SEED: &[u8] = b"ai_result";

pub const MAX_SCAM_TYPE: u8 = 5;

fn require_nonzero_hash(hash: &[u8; 32]) -> Result<()> {
    require!(hash.iter().any(|&b| b != 0), RegistryError::InvalidHash);
    Ok(())
}

// ---------------------------------------------------------------- initialize_config

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = Config::LEN,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.paused = false;
    config.bump = ctx.bumps.config;
    Ok(())
}

// ---------------------------------------------------------------- report_scam

#[derive(Accounts)]
#[instruction(report_index: u64)]
pub struct ReportScam<'info> {
    #[account(mut)]
    pub reporter: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    /// CHECK: only its address is stored
    pub reported: UncheckedAccount<'info>,
    #[account(
        init,
        payer = reporter,
        space = ScamReport::LEN,
        seeds = [
            REPORT_SEED,
            reported.key().as_ref(),
            reporter.key().as_ref(),
            &report_index.to_le_bytes(),
        ],
        bump
    )]
    pub report: Account<'info, ScamReport>,
    pub system_program: Program<'info, System>,
}

pub fn handle_report_scam(
    ctx: Context<ReportScam>,
    _report_index: u64,
    scam_type: u8,
    evidence_hash: [u8; 32],
    description_hash: [u8; 32],
) -> Result<()> {
    require!(!ctx.accounts.config.paused, RegistryError::Paused);
    require!(scam_type <= MAX_SCAM_TYPE, RegistryError::ScamTypeOutOfRange);
    require_nonzero_hash(&evidence_hash)?;
    require_nonzero_hash(&description_hash)?;

    let now = Clock::get()?.unix_timestamp;
    let report = &mut ctx.accounts.report;
    report.set_inner(ScamReport {
        reporter: ctx.accounts.reporter.key(),
        reported: ctx.accounts.reported.key(),
        scam_type,
        evidence_hash,
        description_hash,
        timestamp: now,
        bump: ctx.bumps.report,
    });

    emit!(ScamReported {
        report: report.key(),
        reporter: report.reporter,
        reported: report.reported,
        scam_type,
        timestamp: now,
    });
    Ok(())
}

// ---------------------------------------------------------------- log_ai_result

#[derive(Accounts)]
#[instruction(slot: u64)]
pub struct LogAiResult<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.admin == authority.key() @ RegistryError::Unauthorized,
    )]
    pub config: Account<'info, Config>,
    /// CHECK: only its address is stored
    pub subject: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = AiResult::LEN,
        seeds = [
            AI_RESULT_SEED,
            subject.key().as_ref(),
            &slot.to_le_bytes(),
        ],
        bump
    )]
    pub ai_result: Account<'info, AiResult>,
    pub system_program: Program<'info, System>,
}

pub fn handle_log_ai_result(
    ctx: Context<LogAiResult>,
    _slot: u64,
    risk_score: u8,
    model_hash: [u8; 32],
    result_hash: [u8; 32],
    evidence_uri_hash: [u8; 32],
) -> Result<()> {
    require!(!ctx.accounts.config.paused, RegistryError::Paused);
    require_nonzero_hash(&model_hash)?;
    require_nonzero_hash(&result_hash)?;
    require_nonzero_hash(&evidence_uri_hash)?;

    let now = Clock::get()?.unix_timestamp;
    let result = &mut ctx.accounts.ai_result;
    result.set_inner(AiResult {
        authority: ctx.accounts.authority.key(),
        subject: ctx.accounts.subject.key(),
        risk_score,
        model_hash,
        result_hash,
        evidence_uri_hash,
        timestamp: now,
        bump: ctx.bumps.ai_result,
    });

    emit!(AiResultLogged {
        ai_result: result.key(),
        subject: result.subject,
        risk_score,
        timestamp: now,
    });
    Ok(())
}

// ---------------------------------------------------------------- set_paused

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ RegistryError::Unauthorized,
    )]
    pub config: Account<'info, Config>,
}

pub fn handle_set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused;
    Ok(())
}
