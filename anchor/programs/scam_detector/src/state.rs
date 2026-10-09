use anchor_lang::prelude::*;

pub const INPUT_DIM: usize = 256;
pub const HIDDEN_DIM: usize = 16;
pub const W1_SIZE: usize = INPUT_DIM * HIDDEN_DIM; // 4096

#[account]
pub struct ModelWeights {
    pub admin: Pubkey,
    pub version: u8,
    pub paused: bool,
    pub bump: u8,
    pub w1: [i8; W1_SIZE],
    pub b1: [i32; HIDDEN_DIM],
    pub w2: [i8; HIDDEN_DIM],
    pub b2: i32,
    pub scale_w1: i32,
    pub scale_w2: i32,
    pub scale_b1: i32,
    pub scale_b2: i32,
    pub shift: u8,
    pub k_sigmoid: i32,
}

impl ModelWeights {
    // 8 (discriminator) + 32 + 1 + 1 + 1 + 4096 + 64 + 16 + 4 + 16 + 1 + 4
    pub const LEN: usize = 8 + 32 + 1 + 1 + 1 + W1_SIZE + (HIDDEN_DIM * 4) + HIDDEN_DIM + 4 + 16 + 1 + 4;

    pub const SEED: &'static [u8] = b"model";
}
