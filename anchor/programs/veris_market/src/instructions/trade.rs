use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::{
    constants::*,
    error::ErrorCode,
    events::*,
    state::{Config, Trade, TradeStatus},
};

/// Move lamports out of the trade account. The program owns it, so it can debit directly.
/// Recipients are always checked against trade.buyer / trade.seller by the account constraints,
/// so escrowed funds can never go to a third wallet.
pub fn pay_out<'info>(trade: &AccountInfo<'info>, to: &AccountInfo<'info>, amount: u64) -> Result<()> {
    if amount > 0 {
        trade.sub_lamports(amount)?;
        to.add_lamports(amount)?;
    }
    Ok(())
}

pub fn settle<'info>(
    trade: &mut Account<'info, Trade>,
    buyer: &AccountInfo<'info>,
    seller: &AccountInfo<'info>,
    to_buyer: u64,
    to_seller: u64,
    status: TradeStatus,
) -> Result<()> {
    let total = to_buyer.checked_add(to_seller).ok_or(ErrorCode::MathOverflow)?;
    require!(total == trade.balance, ErrorCode::MathOverflow);
    let info = trade.to_account_info();
    pay_out(&info, buyer, to_buyer)?;
    pay_out(&info, seller, to_seller)?;
    trade.balance = 0;
    trade.status = status;
    emit!(TradeSettled {
        trade: trade.key(),
        to_buyer,
        to_seller,
        status,
    });
    Ok(())
}

// ---------------------------------------------------------------- create

#[derive(Accounts)]
#[instruction(trade_id: u64)]
pub struct CreateTrade<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: only its address is stored; it receives funds later
    pub seller: UncheckedAccount<'info>,
    #[account(
        init,
        payer = buyer,
        space = 8 + Trade::INIT_SPACE,
        seeds = [TRADE_SEED, buyer.key().as_ref(), &trade_id.to_le_bytes()],
        bump
    )]
    pub trade: Account<'info, Trade>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_trade(
    ctx: Context<CreateTrade>,
    trade_id: u64,
    value: u64,
    item: String,
    stage_secs: i64,
) -> Result<()> {
    require!(value > 0, ErrorCode::InvalidValue);
    require_keys_neq!(ctx.accounts.buyer.key(), ctx.accounts.seller.key(), ErrorCode::SameParty);
    require!(item.len() <= MAX_ITEM_LEN, ErrorCode::ItemTooLong);
    require!(
        (MIN_STAGE_SECS..=MAX_STAGE_SECS).contains(&stage_secs),
        ErrorCode::InvalidStageDuration
    );

    let deposit = Trade::deposit_for(value)?;
    let now = Clock::get()?.unix_timestamp;
    let trade = &mut ctx.accounts.trade;
    trade.set_inner(Trade {
        trade_id,
        buyer: ctx.accounts.buyer.key(),
        seller: ctx.accounts.seller.key(),
        item,
        value,
        deposit,
        buyer_deposited: false,
        seller_deposited: false,
        remainder_paid: false,
        balance: 0,
        status: TradeStatus::AwaitingDeposit,
        status_before_freeze: TradeStatus::AwaitingDeposit,
        stage_secs,
        deadline: now + stage_secs,
        bump: ctx.bumps.trade,
    });

    emit!(TradeCreated {
        trade: trade.key(),
        buyer: trade.buyer,
        seller: trade.seller,
        value,
        deposit,
    });
    Ok(())
}

// ---------------------------------------------------------------- deposit

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub party: Signer<'info>,
    #[account(
        mut,
        seeds = [TRADE_SEED, trade.buyer.as_ref(), &trade.trade_id.to_le_bytes()],
        bump = trade.bump
    )]
    pub trade: Account<'info, Trade>,
    pub system_program: Program<'info, System>,
}

pub fn handle_deposit(ctx: Context<Deposit>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let party = ctx.accounts.party.key();
    let trade = &mut ctx.accounts.trade;

    require!(trade.status == TradeStatus::AwaitingDeposit, ErrorCode::WrongStatus);
    require!(now <= trade.deadline, ErrorCode::DeadlinePassed);

    if party == trade.buyer {
        require!(!trade.buyer_deposited, ErrorCode::AlreadyDeposited);
        trade.buyer_deposited = true;
    } else if party == trade.seller {
        require!(!trade.seller_deposited, ErrorCode::AlreadyDeposited);
        trade.seller_deposited = true;
    } else {
        return err!(ErrorCode::NotAParty);
    }

    let amount = trade.deposit;
    system_program::transfer(
        CpiContext::new(
            system_program::ID,
            system_program::Transfer {
                from: ctx.accounts.party.to_account_info(),
                to: trade.to_account_info(),
            },
        ),
        amount,
    )?;
    trade.balance = trade.balance.checked_add(amount).ok_or(ErrorCode::MathOverflow)?;

    if trade.buyer_deposited && trade.seller_deposited {
        trade.status = TradeStatus::Deposited;
        trade.restart_clock(now);
    }

    emit!(DepositMade {
        trade: trade.key(),
        party,
        amount,
    });
    Ok(())
}

// ---------------------------------------------------------------- pay remainder

#[derive(Accounts)]
pub struct PayRemainder<'info> {
    #[account(mut, address = trade.buyer @ ErrorCode::NotAParty)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [TRADE_SEED, trade.buyer.as_ref(), &trade.trade_id.to_le_bytes()],
        bump = trade.bump
    )]
    pub trade: Account<'info, Trade>,
    pub system_program: Program<'info, System>,
}

pub fn handle_pay_remainder(ctx: Context<PayRemainder>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let trade = &mut ctx.accounts.trade;

    require!(trade.status == TradeStatus::Deposited, ErrorCode::WrongStatus);
    require!(now <= trade.deadline, ErrorCode::DeadlinePassed);

    let amount = trade.remainder();
    system_program::transfer(
        CpiContext::new(
            system_program::ID,
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: trade.to_account_info(),
            },
        ),
        amount,
    )?;
    trade.balance = trade.balance.checked_add(amount).ok_or(ErrorCode::MathOverflow)?;
    trade.remainder_paid = true;
    trade.status = TradeStatus::Paid;
    trade.restart_clock(now);

    emit!(RemainderPaid {
        trade: trade.key(),
        amount,
    });
    Ok(())
}

// ---------------------------------------------------------------- confirm delivery

#[derive(Accounts)]
pub struct ConfirmDelivery<'info> {
    pub signer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
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

/// The buyer (item received) or the game operator (delivery seen by the game server) confirms.
/// The seller gets the price plus their own deposit back.
pub fn handle_confirm_delivery(ctx: Context<ConfirmDelivery>) -> Result<()> {
    let signer = ctx.accounts.signer.key();
    let trade = &mut ctx.accounts.trade;
    require!(
        signer == trade.buyer || signer == ctx.accounts.config.admin,
        ErrorCode::NotBuyerOrAdmin
    );
    require!(trade.status == TradeStatus::Paid, ErrorCode::WrongStatus);

    let all = trade.balance;
    settle(
        trade,
        &ctx.accounts.buyer.to_account_info(),
        &ctx.accounts.seller.to_account_info(),
        0,
        all,
        TradeStatus::Completed,
    )
}

// ---------------------------------------------------------------- timeout

#[derive(Accounts)]
pub struct ClaimTimeout<'info> {
    /// Anyone may crank an expired trade; funds still only go to the two parties
    pub caller: Signer<'info>,
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

/// - AwaitingDeposit: nobody is at fault, refund whoever deposited
/// - Deposited: buyer never paid the rest -> buyer's deposit goes to the seller
/// - Paid: seller never delivered -> buyer gets everything back + the seller's deposit
pub fn handle_claim_timeout(ctx: Context<ClaimTimeout>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let trade = &mut ctx.accounts.trade;
    require!(trade.is_open(), ErrorCode::WrongStatus);
    require!(now > trade.deadline, ErrorCode::DeadlineNotReached);

    let all = trade.balance;
    let (to_buyer, to_seller) = match trade.status {
        TradeStatus::AwaitingDeposit => trade.contributions(),
        TradeStatus::Deposited => (0, all),
        _ => (all, 0),
    };
    settle(
        trade,
        &ctx.accounts.buyer.to_account_info(),
        &ctx.accounts.seller.to_account_info(),
        to_buyer,
        to_seller,
        TradeStatus::Cancelled,
    )
}

// ---------------------------------------------------------------- close

#[derive(Accounts)]
pub struct CloseTrade<'info> {
    #[account(mut, address = trade.buyer @ ErrorCode::NotAParty)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        close = buyer,
        seeds = [TRADE_SEED, trade.buyer.as_ref(), &trade.trade_id.to_le_bytes()],
        bump = trade.bump
    )]
    pub trade: Account<'info, Trade>,
}

/// Returns the account rent to the buyer once the trade is finished
pub fn handle_close_trade(ctx: Context<CloseTrade>) -> Result<()> {
    let trade = &ctx.accounts.trade;
    require!(
        matches!(trade.status, TradeStatus::Completed | TradeStatus::Cancelled),
        ErrorCode::WrongStatus
    );
    require!(trade.balance == 0, ErrorCode::TradeNotSettled);
    Ok(())
}
