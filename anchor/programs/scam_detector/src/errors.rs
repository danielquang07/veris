use anchor_lang::prelude::*;

#[error_code]
pub enum ScamDetectorError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Model is paused")]
    Paused,
}
