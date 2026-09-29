use anchor_lang::prelude::*;

use crate::state::{DisputeOutcome, TradeStatus};

#[event]
pub struct TradeCreated {
    pub trade: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub value: u64,
    pub deposit: u64,
}

#[event]
pub struct DepositMade {
    pub trade: Pubkey,
    pub party: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RemainderPaid {
    pub trade: Pubkey,
    pub amount: u64,
}

/// Emitted whenever escrowed funds leave the trade account
#[event]
pub struct TradeSettled {
    pub trade: Pubkey,
    pub to_buyer: u64,
    pub to_seller: u64,
    pub status: TradeStatus,
}

#[event]
pub struct DisputeOpened {
    pub trade: Pubkey,
    pub by: Pubkey,
}

#[event]
pub struct DisputeResolved {
    pub trade: Pubkey,
    pub outcome: DisputeOutcome,
}
