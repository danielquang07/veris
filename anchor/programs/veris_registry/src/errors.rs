use anchor_lang::prelude::*;

#[error_code]
pub enum RegistryError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Registry is paused")]
    Paused,
    #[msg("Hash must not be all zeros")]
    InvalidHash,
    #[msg("Scam type is out of range")]
    ScamTypeOutOfRange,
}
