use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod scam_detector {
    use super::*;

    pub fn initialize_model(ctx: Context<InitializeModel>) -> Result<()> {
        instructions::initialize_model(ctx)
    }

    pub fn update_weights(
        ctx: Context<UpdateWeights>,
        w1: Vec<i8>,
        b1: Vec<i32>,
        w2: Vec<i8>,
        b2: i32,
        scale_w1: i32,
        scale_w2: i32,
        scale_b1: i32,
        scale_b2: i32,
        shift: u8,
        k_sigmoid: i32,
    ) -> Result<()> {
        instructions::update_weights(ctx, w1, b1, w2, b2, scale_w1, scale_w2, scale_b1, scale_b2, shift, k_sigmoid)
    }

    pub fn predict(ctx: Context<Predict>, features: [i8; 256]) -> Result<u8> {
        instructions::predict(ctx, features)
    }
}
