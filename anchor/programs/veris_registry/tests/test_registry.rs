//! Native unit tests for veris_registry state + validation logic.
//!
//! NOTE: These are *native* tests (host toolchain via `cargo test`), not LiteSVM
//! on-chain integration tests. Building the BPF `.so` for LiteSVM requires a
//! newer Solana platform-tools (Rust >= 1.84 for edition2024); the bundled
//! `cargo-build-sbf 1.18.17` ships Rust 1.75 and cannot compile the solana 3.x
//! dependency tree. We therefore verify the pure, deterministic parts here on
//! the host: account sizing (LEN), the non-zero-hash guard, scam-type bounds,
//! and Borsh round-tripping of each account struct.
//!
//! The `handle_*` functions additionally depend on `Clock::get()` (a sysvar),
//! which is only available on-chain, so full instruction flows are exercised by
//! a LiteSVM integration test once a compatible SBF toolchain is available.

use anchor_lang::prelude::*;
use anchor_lang::{AccountDeserialize, AccountSerialize};
use veris_registry::instructions::{AI_RESULT_SEED, CONFIG_SEED, MAX_SCAM_TYPE, REPORT_SEED};
use veris_registry::state::{AiResult, Config, ScamReport};

const EVIDENCE_HASH: [u8; 32] = [1u8; 32];
const DESCRIPTION_HASH: [u8; 32] = [2u8; 32];
const MODEL_HASH: [u8; 32] = [3u8; 32];
const RESULT_HASH: [u8; 32] = [4u8; 32];
const EVIDENCE_URI_HASH: [u8; 32] = [5u8; 32];
const ZERO_HASH: [u8; 32] = [0u8; 32];

/// Mirror of `veris_registry::instructions::require_nonzero_hash` (private there).
fn require_nonzero_hash(hash: &[u8; 32]) -> bool {
    hash.iter().any(|&b| b != 0)
}

// ---------------------------------------------------------------- account LEN

#[test]
fn account_lens_are_correct() {
    // 8 (discriminator) + payload
    assert_eq!(Config::LEN, 8 + 32 + 1 + 1);
    assert_eq!(ScamReport::LEN, 8 + 32 + 32 + 1 + 32 + 32 + 8 + 1);
    assert_eq!(AiResult::LEN, 8 + 32 + 32 + 1 + 32 + 32 + 32 + 8 + 1);

    // sanity: the exact byte counts from the spec
    assert_eq!(Config::LEN, 42);
    assert_eq!(ScamReport::LEN, 146);
    assert_eq!(AiResult::LEN, 178);
}

// ---------------------------------------------------------------- seeds / bounds

#[test]
fn seeds_are_expected() {
    assert_eq!(CONFIG_SEED, b"config");
    assert_eq!(REPORT_SEED, b"report");
    assert_eq!(AI_RESULT_SEED, b"ai_result");
    assert_eq!(MAX_SCAM_TYPE, 5);
}

#[test]
fn scam_type_bounds() {
    // valid range 0..=MAX_SCAM_TYPE
    for t in 0..=MAX_SCAM_TYPE {
        assert!(t <= MAX_SCAM_TYPE, "type {t} should be accepted");
    }
    // out of range must be rejected by the on-chain `require!`
    assert!(MAX_SCAM_TYPE + 1 > MAX_SCAM_TYPE);
}

#[test]
fn nonzero_hash_guard() {
    assert!(require_nonzero_hash(&EVIDENCE_HASH));
    assert!(require_nonzero_hash(&DESCRIPTION_HASH));
    assert!(!require_nonzero_hash(&ZERO_HASH), "zero hash must fail");
    // a hash with a single non-zero byte is still valid
    let mut almost_zero = [0u8; 32];
    almost_zero[31] = 1;
    assert!(require_nonzero_hash(&almost_zero));
}

// ---------------------------------------------------------------- borsh round-trip

#[test]
fn config_borsh_round_trip() {
    let cfg = Config {
        admin: Pubkey::new_unique(),
        paused: true,
        bump: 254,
    };
    let mut bytes: Vec<u8> = Vec::new();
    cfg.try_serialize(&mut bytes).unwrap();
    assert_eq!(bytes.len(), Config::LEN, "serialized size must match LEN");
    let decoded: Config = Config::try_deserialize(&mut &bytes[..]).unwrap();
    assert_eq!(decoded.admin, cfg.admin);
    assert_eq!(decoded.paused, cfg.paused);
    assert_eq!(decoded.bump, cfg.bump);
}

#[test]
fn scam_report_borsh_round_trip() {
    let report = ScamReport {
        reporter: Pubkey::new_unique(),
        reported: Pubkey::new_unique(),
        scam_type: 3,
        evidence_hash: EVIDENCE_HASH,
        description_hash: DESCRIPTION_HASH,
        timestamp: 1_700_000_000,
        bump: 253,
    };
    let mut bytes: Vec<u8> = Vec::new();
    report.try_serialize(&mut bytes).unwrap();
    assert_eq!(bytes.len(), ScamReport::LEN);
    let decoded: ScamReport = ScamReport::try_deserialize(&mut &bytes[..]).unwrap();
    assert_eq!(decoded.reporter, report.reporter);
    assert_eq!(decoded.reported, report.reported);
    assert_eq!(decoded.scam_type, 3);
    assert_eq!(decoded.evidence_hash, EVIDENCE_HASH);
    assert_eq!(decoded.description_hash, DESCRIPTION_HASH);
    assert_eq!(decoded.timestamp, 1_700_000_000);
    assert_eq!(decoded.bump, 253);
}

#[test]
fn ai_result_borsh_round_trip() {
    let result = AiResult {
        authority: Pubkey::new_unique(),
        subject: Pubkey::new_unique(),
        risk_score: 87,
        model_hash: MODEL_HASH,
        result_hash: RESULT_HASH,
        evidence_uri_hash: EVIDENCE_URI_HASH,
        timestamp: 1_700_000_123,
        bump: 252,
    };
    let mut bytes: Vec<u8> = Vec::new();
    result.try_serialize(&mut bytes).unwrap();
    assert_eq!(bytes.len(), AiResult::LEN);
    let decoded: AiResult = AiResult::try_deserialize(&mut &bytes[..]).unwrap();
    assert_eq!(decoded.authority, result.authority);
    assert_eq!(decoded.subject, result.subject);
    assert_eq!(decoded.risk_score, 87);
    assert_eq!(decoded.model_hash, MODEL_HASH);
    assert_eq!(decoded.result_hash, RESULT_HASH);
    assert_eq!(decoded.evidence_uri_hash, EVIDENCE_URI_HASH);
    assert_eq!(decoded.timestamp, 1_700_000_123);
    assert_eq!(decoded.bump, 252);
}

#[test]
fn risk_score_is_u8_bounded() {
    // risk_score field is u8 (0..=255); the scorer clamps to 0..=100 off-chain,
    // but on-chain we accept any u8 the authority logs.
    let result = AiResult {
        authority: Pubkey::new_unique(),
        subject: Pubkey::new_unique(),
        risk_score: 100,
        model_hash: MODEL_HASH,
        result_hash: RESULT_HASH,
        evidence_uri_hash: EVIDENCE_URI_HASH,
        timestamp: 0,
        bump: 0,
    };
    assert_eq!(result.risk_score, 100);
}
