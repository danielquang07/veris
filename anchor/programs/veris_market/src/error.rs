use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Trade value must be greater than 0")]
    InvalidValue,
    #[msg("Buyer and seller must be different wallets")]
    SameParty,
    #[msg("Item name is too long")]
    ItemTooLong,
    #[msg("Stage duration is out of range")]
    InvalidStageDuration,
    #[msg("Signer is not a party of this trade")]
    NotAParty,
    #[msg("Only the market admin can do this")]
    NotAdmin,
    #[msg("Only the buyer or the market admin can confirm delivery")]
    NotBuyerOrAdmin,
    #[msg("The trade is not at the right step for this action")]
    WrongStatus,
    #[msg("This party has already deposited")]
    AlreadyDeposited,
    #[msg("The deadline for this step has passed")]
    DeadlinePassed,
    #[msg("The deadline for this step has not passed yet")]
    DeadlineNotReached,
    #[msg("Trade still holds funds")]
    TradeNotSettled,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
