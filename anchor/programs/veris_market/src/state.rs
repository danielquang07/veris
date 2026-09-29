use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode};

/// Market-wide settings. The admin (game operator) resolves disputes and may confirm delivery.
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum TradeStatus {
    AwaitingDeposit,
    Deposited,
    Paid,
    Completed,
    Frozen,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum DisputeOutcome {
    BuyerRight,
    SellerRight,
    RefundBoth,
}

/// One player-to-player item trade. The account itself holds the escrowed lamports.
///
/// Step order: AwaitingDeposit -> Deposited -> (buyer pays the rest) Paid -> (delivery) Completed.
/// The buyer pays the remainder BEFORE delivery; otherwise a buyer could take goods worth 100,
/// abandon a 30 deposit and still be up 70.
#[account]
#[derive(InitSpace)]
pub struct Trade {
    pub trade_id: u64,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    #[max_len(MAX_ITEM_LEN)]
    pub item: String,
    pub value: u64,
    pub deposit: u64,
    pub buyer_deposited: bool,
    pub seller_deposited: bool,
    pub remainder_paid: bool,
    /// Escrowed lamports, excluding the account's rent
    pub balance: u64,
    pub status: TradeStatus,
    pub status_before_freeze: TradeStatus,
    pub stage_secs: i64,
    pub deadline: i64,
    pub bump: u8,
}

impl Trade {
    pub fn deposit_for(value: u64) -> Result<u64> {
        let bps = if value >= HIGH_DEPOSIT_THRESHOLD {
            HIGH_DEPOSIT_BPS
        } else {
            LOW_DEPOSIT_BPS
        };
        let deposit = (value as u128)
            .checked_mul(bps as u128)
            .ok_or(ErrorCode::MathOverflow)?
            / BPS_DENOMINATOR as u128;
        Ok(deposit as u64)
    }

    pub fn remainder(&self) -> u64 {
        self.value - self.deposit
    }

    /// Lamports each side has put into the escrow so far: (buyer, seller)
    pub fn contributions(&self) -> (u64, u64) {
        let buyer = if self.buyer_deposited { self.deposit } else { 0 }
            + if self.remainder_paid { self.remainder() } else { 0 };
        let seller = if self.seller_deposited { self.deposit } else { 0 };
        (buyer, seller)
    }

    pub fn is_open(&self) -> bool {
        matches!(
            self.status,
            TradeStatus::AwaitingDeposit | TradeStatus::Deposited | TradeStatus::Paid
        )
    }

    pub fn restart_clock(&mut self, now: i64) {
        self.deadline = now + self.stage_secs;
    }
}
