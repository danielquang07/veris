use crate::errors::ScamDetectorError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeModel<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = ModelWeights::LEN,
        seeds = [ModelWeights::SEED, admin.key().as_ref()],
        bump,
    )]
    pub model: Account<'info, ModelWeights>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_model(ctx: Context<InitializeModel>) -> Result<()> {
    let m = &mut ctx.accounts.model;
    m.admin = ctx.accounts.admin.key();
    m.version = 1;
    m.paused = false;
    m.bump = ctx.bumps.model;
    m.w1 = [0i8; W1_SIZE];
    m.b1 = [0i32; HIDDEN_DIM];
    m.w2 = [0i8; HIDDEN_DIM];
    m.b2 = 0;
    m.scale_w1 = 0;
    m.scale_w2 = 0;
    m.scale_b1 = 0;
    m.scale_b2 = 0;
    m.shift = 9;
    m.k_sigmoid = 300_000;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateWeights<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [ModelWeights::SEED, admin.key().as_ref()],
        bump = model.bump,
        has_one = admin @ ScamDetectorError::Unauthorized,
    )]
    pub model: Account<'info, ModelWeights>,
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
    require!(w1.len() == W1_SIZE, ScamDetectorError::Unauthorized);
    require!(b1.len() == HIDDEN_DIM, ScamDetectorError::Unauthorized);
    require!(w2.len() == HIDDEN_DIM, ScamDetectorError::Unauthorized);

    let m = &mut ctx.accounts.model;
    m.w1.copy_from_slice(&w1);
    m.b1.copy_from_slice(&b1);
    m.w2.copy_from_slice(&w2);
    m.b2 = b2;
    m.scale_w1 = scale_w1;
    m.scale_w2 = scale_w2;
    m.scale_b1 = scale_b1;
    m.scale_b2 = scale_b2;
    m.shift = shift;
    m.k_sigmoid = k_sigmoid;
    Ok(())
}

#[derive(Accounts)]
pub struct Predict<'info> {
    #[account(
        seeds = [ModelWeights::SEED, model.admin.as_ref()],
        bump = model.bump,
    )]
    pub model: Account<'info, ModelWeights>,
}

pub fn predict(ctx: Context<Predict>, features: [i8; INPUT_DIM]) -> Result<u8> {
    let m = &ctx.accounts.model;
    require!(!m.paused, ScamDetectorError::Paused);

    // Layer 1: 256 -> 16, ReLU
    let mut hidden = [0i32; HIDDEN_DIM];
    for j in 0..HIDDEN_DIM {
        let mut acc: i32 = m.b1[j];
        for i in 0..INPUT_DIM {
            acc += (features[i] as i32) * (m.w1[i * HIDDEN_DIM + j] as i32);
        }
        hidden[j] = if acc > 0 { acc } else { 0 };
    }

    // Layer 2: 16 -> 1
    let mut logit: i32 = m.b2;
    let sh = m.shift.min(31);
    for j in 0..HIDDEN_DIM {
        let h = (hidden[j] >> sh).clamp(-128, 127);
        logit += h * (m.w2[j] as i32);
    }

    // Linear sigmoid with runtime K
    let k = m.k_sigmoid.max(1);
    let raw = (logit.saturating_add(k)).saturating_mul(100) / (2 * k);
    let risk = raw.clamp(0, 100) as u8;

    msg!("predict: logit={} risk={}", logit, risk);
    Ok(risk)
}
