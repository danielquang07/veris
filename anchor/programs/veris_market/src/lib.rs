pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("BhG6x6u5PHKwf97eZBEuAnTQhBv6ErEAnDe8YUHCjxG");

/// Veris Market: escrow for player-to-player item trades in Hao Khi Dai Viet.
/// Both sides deposit, the buyer pays the rest into escrow, delivery releases funds to the seller.
/// Funds can only ever leave to the trade's buyer or seller.
#[program]
pub mod veris_market {
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>) -> Result<()> {
        instructions::config::handle_init_config(ctx)
    }

    pub fn set_admin(ctx: Context<SetAdmin>, new_admin: Pubkey) -> Result<()> {
        instructions::config::handle_set_admin(ctx, new_admin)
    }

    pub fn create_trade(
        ctx: Context<CreateTrade>,
        trade_id: u64,
        value: u64,
        item: String,
        stage_secs: i64,
    ) -> Result<()> {
        instructions::trade::handle_create_trade(ctx, trade_id, value, item, stage_secs)
    }

    pub fn deposit(ctx: Context<Deposit>) -> Result<()> {
        instructions::trade::handle_deposit(ctx)
    }

    pub fn pay_remainder(ctx: Context<PayRemainder>) -> Result<()> {
        instructions::trade::handle_pay_remainder(ctx)
    }

    pub fn confirm_delivery(ctx: Context<ConfirmDelivery>) -> Result<()> {
        instructions::trade::handle_confirm_delivery(ctx)
    }

    pub fn claim_timeout(ctx: Context<ClaimTimeout>) -> Result<()> {
        instructions::trade::handle_claim_timeout(ctx)
    }

    pub fn open_dispute(ctx: Context<OpenDispute>) -> Result<()> {
        instructions::dispute::handle_open_dispute(ctx)
    }

    pub fn resolve_dispute(ctx: Context<AdminAction>, outcome: DisputeOutcome) -> Result<()> {
        instructions::dispute::handle_resolve_dispute(ctx, outcome)
    }

    pub fn unfreeze(ctx: Context<AdminAction>) -> Result<()> {
        instructions::dispute::handle_unfreeze(ctx)
    }

    pub fn close_trade(ctx: Context<CloseTrade>) -> Result<()> {
        instructions::trade::handle_close_trade(ctx)
    }
}
