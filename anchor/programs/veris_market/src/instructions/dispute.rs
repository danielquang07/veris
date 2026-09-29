use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    instructions::trade::settle,
    state::{Config, DisputeOutcome, Trade, TradeStatus},
};

// ---------------------------------------------------------------- open

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub party: Signer<'info>,
    #[account(
        mut,
        seeds = [TRADE_SEED, trade.buyer.as_ref(), &trade.trade_id.to_le_bytes()],
        bump = trade.bump
    )]
    pub trade: Account<'info, Trade>,
}

/// Either party freezes the escrow; funds stay put until the admin decides
pub fn handle_open_dispute(ctx: Context<OpenDispute>) -> Result<()> {
    let party = ctx.accounts.party.key();
    let trade = &mut ctx.accounts.trade;
    require!(party == trade.buyer || party == trade.seller, ErrorCode::NotAParty);
    require!(trade.is_open(), ErrorCode::WrongStatus);

    trade.status_before_freeze = trade.status;
    trade.status = TradeStatus::Frozen;

    emit!(DisputeOpened {
        trade: trade.key(),
        by: party,
    });
    Ok(())
}

// ---------------------------------------------------------------- resolve / unfreeze

#[derive(Accounts)]
pub struct AdminAction<'info> {
    pub admin: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ ErrorCode::NotAdmin
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [TRADE_SEED, trade.buyer.as_ref(), &trade.trade_id.to_le_bytes()],
        bump = trade.bump
    )]
    pub trade: Account<'info, Trade>,
    /// CHECK: must be the trade's buyer
    #[account(mut, address = trade.buyer)]
    pub buyer: UncheckedAccount<'info>,
    /// CHECK: must be the trade's seller
    #[account(mut, address = trade.seller)]
    pub seller: UncheckedAccount<'info>,
}

/// - BuyerRight / SellerRight: the right side takes the whole escrow, the wrong side loses its deposit
/// - RefundBoth: each side gets back exactly what it put in
pub fn handle_resolve_dispute(ctx: Context<AdminAction>, outcome: DisputeOutcome) -> Result<()> {
    let trade = &mut ctx.accounts.trade;
    require!(trade.status == TradeStatus::Frozen, ErrorCode::WrongStatus);

    let all = trade.balance;
    let (to_buyer, to_seller, status) = match outcome {
        DisputeOutcome::BuyerRight => (all, 0, TradeStatus::Cancelled),
        DisputeOutcome::SellerRight => (
            0,
            all,
            if trade.remainder_paid {
                TradeStatus::Completed
            } else {
                TradeStatus::Cancelled
            },
        ),
        DisputeOutcome::RefundBoth => {
            let (b, s) = trade.contributions();
            (b, s, TradeStatus::Cancelled)
        }
    };

    let key = trade.key();
    settle(
        trade,
        &ctx.accounts.buyer.to_account_info(),
        &ctx.accounts.seller.to_account_info(),
        to_buyer,
        to_seller,
        status,
    )?;
    emit!(DisputeResolved { trade: key, outcome });
    Ok(())
}

pub fn handle_unfreeze(ctx: Context<AdminAction>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let trade = &mut ctx.accounts.trade;
    require!(trade.status == TradeStatus::Frozen, ErrorCode::WrongStatus);
    trade.status = trade.status_before_freeze;
    trade.restart_clock(now);
    Ok(())
}
