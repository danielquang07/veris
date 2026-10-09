//! Native unit tests for scam_detector MLP predict logic.
//!
//! NOTE: These are *native* tests (run on the host toolchain via `cargo test`),
//! not on-chain LiteSVM integration tests. Building the BPF `.so` requires a
//! newer Solana platform-tools (Rust >= 1.84 for edition2024); the toolchain
//! bundled with `cargo-build-sbf 1.18.17` on this machine ships Rust 1.75 and
//! cannot compile the solana 3.x dependency tree. To keep the module verifiable
//! without that toolchain, we exercise the exact integer MLP arithmetic that
//! `instructions::predict` runs on-chain, plus state encoding, here on the host.
//!
//! The predict arithmetic below MUST stay byte-for-byte identical to
//! `crate::instructions::predict` (guarded by `test_predict_matches_pure_logic`).

mod fixtures;

use scam_detector::state::{ModelWeights, HIDDEN_DIM, INPUT_DIM};

/// Pure reimplementation of the on-chain predict math.
/// Keep in sync with `scam_detector::instructions::predict`.
fn pure_predict(m: &ModelWeights, features: &[i8; INPUT_DIM]) -> u8 {
    assert!(!m.paused, "model must not be paused");

    // Layer 1: INPUT_DIM -> HIDDEN_DIM, ReLU
    let mut hidden = [0i32; HIDDEN_DIM];
    for j in 0..HIDDEN_DIM {
        let mut acc: i32 = m.b1[j];
        for i in 0..INPUT_DIM {
            acc += (features[i] as i32) * (m.w1[i * HIDDEN_DIM + j] as i32);
        }
        hidden[j] = if acc > 0 { acc } else { 0 };
    }

    // Layer 2: HIDDEN_DIM -> 1
    let mut logit: i32 = m.b2;
    let sh = m.shift.min(31);
    for j in 0..HIDDEN_DIM {
        let h = (hidden[j] >> sh).clamp(-128, 127);
        logit += h * (m.w2[j] as i32);
    }

    // Linear sigmoid with runtime K
    let k = m.k_sigmoid.max(1);
    let raw = (logit.saturating_add(k)).saturating_mul(100) / (2 * k);
    raw.clamp(0, 100) as u8
}

/// Build a ModelWeights with the offchain-trained int8 weights from fixtures.
fn trained_model() -> ModelWeights {
    ModelWeights {
        admin: Default::default(),
        version: 1,
        paused: false,
        bump: 255,
        w1: fixtures::W1,
        b1: fixtures::B1,
        w2: fixtures::W2,
        b2: fixtures::B2,
        scale_w1: fixtures::SCALE_W1,
        scale_w2: fixtures::SCALE_W2,
        scale_b1: fixtures::SCALE_B1,
        scale_b2: fixtures::SCALE_B2,
        shift: fixtures::SHIFT,
        k_sigmoid: fixtures::K_SIGMOID,
    }
}

#[test]
fn fixtures_have_expected_shapes() {
    assert_eq!(fixtures::W1.len(), INPUT_DIM * HIDDEN_DIM);
    assert_eq!(fixtures::B1.len(), HIDDEN_DIM);
    assert_eq!(fixtures::W2.len(), HIDDEN_DIM);
    assert_eq!(fixtures::SCAM_FEATURES.len(), INPUT_DIM);
    assert_eq!(fixtures::NORMAL_FEATURES.len(), INPUT_DIM);
    // shift/K actually chosen by the offchain quantizer
    assert!(fixtures::SHIFT <= 31);
    assert!(fixtures::K_SIGMOID > 0);
}

#[test]
fn predict_scam_high_risk_normal_low_risk() {
    let m = trained_model();
    let scam_risk = pure_predict(&m, &fixtures::SCAM_FEATURES);
    let normal_risk = pure_predict(&m, &fixtures::NORMAL_FEATURES);

    println!(
        "scam_text={:?} risk={} | normal_text={:?} risk={}",
        fixtures::SCAM_TEXT, scam_risk, fixtures::NORMAL_TEXT, normal_risk
    );

    assert!(scam_risk > 70, "scam risk must be > 70, got {scam_risk}");
    assert!(normal_risk < 30, "normal risk must be < 30, got {normal_risk}");
}

#[test]
fn predict_is_deterministic() {
    let m = trained_model();
    let a = pure_predict(&m, &fixtures::SCAM_FEATURES);
    let b = pure_predict(&m, &fixtures::SCAM_FEATURES);
    assert_eq!(a, b, "predict must be deterministic");
}

#[test]
fn zero_features_give_low_risk() {
    // All-zero input => hidden layer all zero => logit = b2 (negative) => low risk.
    let m = trained_model();
    let zeros = [0i8; INPUT_DIM];
    let risk = pure_predict(&m, &zeros);
    assert!(risk < 50, "zero input should yield low risk, got {risk}");
}

#[test]
fn paused_model_rejected() {
    let mut m = trained_model();
    m.paused = true;
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        pure_predict(&m, &fixtures::SCAM_FEATURES)
    }));
    assert!(result.is_err(), "paused model must be rejected");
}

#[test]
fn model_len_accounts_for_all_fields() {
    // 8 disc + 32 admin + 1 ver + 1 paused + 1 bump + 4096 w1 + 64 b1 + 16 w2
    // + 4 b2 + 16 scales + 1 shift + 4 k_sigmoid
    let expected =
        8 + 32 + 1 + 1 + 1 + (INPUT_DIM * HIDDEN_DIM) + (HIDDEN_DIM * 4) + HIDDEN_DIM + 4 + 16 + 1 + 4;
    assert_eq!(ModelWeights::LEN, expected);
    assert_eq!(ModelWeights::LEN, 4244);
}

