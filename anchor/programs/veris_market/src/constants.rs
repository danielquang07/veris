use anchor_lang::prelude::*;

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";

#[constant]
pub const TRADE_SEED: &[u8] = b"trade";

/// Trade value (lamports) at which the deposit rises from 30% to 50%.
/// Same placeholder as HIGH_DEPOSIT_THRESHOLD in lib/tempWallet.ts (200 SOL).
pub const HIGH_DEPOSIT_THRESHOLD: u64 = 200_000_000_000;

#[constant]
pub const LOW_DEPOSIT_BPS: u64 = 3_000;

#[constant]
pub const HIGH_DEPOSIT_BPS: u64 = 5_000;

pub const BPS_DENOMINATOR: u64 = 10_000;

/// Max length (bytes) of the item name stored on the trade
pub const MAX_ITEM_LEN: usize = 40;

/// Each stage (deposit, pay remainder, deliver) must finish within this window
#[constant]
pub const MIN_STAGE_SECS: i64 = 60;

#[constant]
pub const MAX_STAGE_SECS: i64 = 7 * 24 * 60 * 60;
