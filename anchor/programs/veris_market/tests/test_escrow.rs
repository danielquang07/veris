use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    veris_market::{
        accounts, instruction,
        state::{DisputeOutcome, Trade, TradeStatus},
        CONFIG_SEED, TRADE_SEED,
    },
};

const SOL: u64 = 1_000_000_000;
const STAGE_SECS: i64 = 600;

struct Env {
    svm: LiteSVM,
    program_id: Pubkey,
    admin: Keypair,
    buyer: Keypair,
    seller: Keypair,
    config: Pubkey,
}

impl Env {
    fn new() -> Self {
        let program_id = veris_market::id();
        let mut svm = LiteSVM::new();
        let bytes = include_bytes!(concat!(
            env!("CARGO_TARGET_TMPDIR"),
            "/../deploy/veris_market.so"
        ));
        svm.add_program(program_id, bytes).unwrap();
        let (admin, buyer, seller) = (Keypair::new(), Keypair::new(), Keypair::new());
        for k in [&admin, &buyer, &seller] {
            svm.airdrop(&k.pubkey(), 10 * SOL).unwrap();
        }
        let config = Pubkey::find_program_address(&[CONFIG_SEED], &program_id).0;
        let mut env = Env { svm, program_id, admin, buyer, seller, config };
        let ix = env.ix(
            instruction::InitConfig {}.data(),
            accounts::InitConfig {
                admin: env.admin.pubkey(),
                config,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        let admin = env.admin.insecure_clone();
        env.send(ix, &admin).unwrap();
        env
    }

    fn ix(&self, data: Vec<u8>, metas: Vec<anchor_lang::solana_program::instruction::AccountMeta>) -> Instruction {
        Instruction::new_with_bytes(self.program_id, &data, metas)
    }

    fn send(&mut self, ix: Instruction, signer: &Keypair) -> Result<(), String> {
        let blockhash = self.svm.latest_blockhash();
        let msg = Message::new_with_blockhash(&[ix], Some(&signer.pubkey()), &blockhash);
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[signer]).unwrap();
        let res = self.svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e.err));
        self.svm.expire_blockhash();
        res
    }

    fn balance(&self, k: &Pubkey) -> u64 {
        self.svm.get_balance(k).unwrap_or(0)
    }

    fn trade_pda(&self, id: u64) -> Pubkey {
        Pubkey::find_program_address(
            &[TRADE_SEED, self.buyer.pubkey().as_ref(), &id.to_le_bytes()],
            &self.program_id,
        )
        .0
    }

    fn trade(&self, pda: &Pubkey) -> Trade {
        let acc = self.svm.get_account(pda).unwrap();
        let mut data: &[u8] = &acc.data;
        Trade::try_deserialize(&mut data).unwrap()
    }

    fn create(&mut self, id: u64, value: u64) -> Pubkey {
        let trade = self.trade_pda(id);
        let ix = self.ix(
            instruction::CreateTrade {
                trade_id: id,
                value,
                item: "Long Dao +7".to_string(),
                stage_secs: STAGE_SECS,
            }
            .data(),
            accounts::CreateTrade {
                buyer: self.buyer.pubkey(),
                seller: self.seller.pubkey(),
                trade,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        let buyer = self.buyer.insecure_clone();
        self.send(ix, &buyer).unwrap();
        trade
    }

    fn deposit(&mut self, trade: Pubkey, party: &Keypair) -> Result<(), String> {
        let ix = self.ix(
            instruction::Deposit {}.data(),
            accounts::Deposit {
                party: party.pubkey(),
                trade,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, party)
    }

    fn pay_remainder(&mut self, trade: Pubkey) -> Result<(), String> {
        let ix = self.ix(
            instruction::PayRemainder {}.data(),
            accounts::PayRemainder {
                buyer: self.buyer.pubkey(),
                trade,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        let buyer = self.buyer.insecure_clone();
        self.send(ix, &buyer)
    }

    fn confirm(&mut self, trade: Pubkey, signer: &Keypair, seller_account: Pubkey) -> Result<(), String> {
        let ix = self.ix(
            instruction::ConfirmDelivery {}.data(),
            accounts::ConfirmDelivery {
                signer: signer.pubkey(),
                config: self.config,
                trade,
                buyer: self.buyer.pubkey(),
                seller: seller_account,
            }
            .to_account_metas(None),
        );
        self.send(ix, signer)
    }

    fn admin_action(&mut self, trade: Pubkey, signer: &Keypair, data: Vec<u8>) -> Result<(), String> {
        let ix = self.ix(
            data,
            accounts::AdminAction {
                admin: signer.pubkey(),
                config: self.config,
                trade,
                buyer: self.buyer.pubkey(),
                seller: self.seller.pubkey(),
            }
            .to_account_metas(None),
        );
        self.send(ix, signer)
    }

    fn open_dispute(&mut self, trade: Pubkey, party: &Keypair) -> Result<(), String> {
        let ix = self.ix(
            instruction::OpenDispute {}.data(),
            accounts::OpenDispute { party: party.pubkey(), trade }.to_account_metas(None),
        );
        self.send(ix, party)
    }

    fn claim_timeout(&mut self, trade: Pubkey) -> Result<(), String> {
        let ix = self.ix(
            instruction::ClaimTimeout {}.data(),
            accounts::ClaimTimeout {
                caller: self.admin.pubkey(),
                trade,
                buyer: self.buyer.pubkey(),
                seller: self.seller.pubkey(),
            }
            .to_account_metas(None),
        );
        let admin = self.admin.insecure_clone();
        self.send(ix, &admin)
    }

    fn warp(&mut self, secs: i64) {
        let mut clock: Clock = self.svm.get_sysvar();
        clock.unix_timestamp += secs;
        self.svm.set_sysvar(&clock);
    }
}

#[test]
fn happy_path_pays_seller_value_plus_deposit() {
    let mut env = Env::new();
    let trade = env.create(1, SOL);
    assert_eq!(env.trade(&trade).deposit, SOL * 3 / 10);

    let buyer = env.buyer.insecure_clone();
    let seller = env.seller.insecure_clone();
    env.deposit(trade, &buyer).unwrap();
    assert!(env.deposit(trade, &buyer).is_err(), "double deposit must fail");
    env.deposit(trade, &seller).unwrap();
    assert_eq!(env.trade(&trade).status, TradeStatus::Deposited);

    // Delivery before the buyer pays the rest is rejected
    assert!(env.confirm(trade, &buyer, env.seller.pubkey()).is_err());
    env.pay_remainder(trade).unwrap();
    assert_eq!(env.trade(&trade).balance, SOL + SOL * 3 / 10);

    let seller_before = env.balance(&env.seller.pubkey());
    env.confirm(trade, &buyer, env.seller.pubkey()).unwrap();
    let t = env.trade(&trade);
    assert_eq!(t.status, TradeStatus::Completed);
    assert_eq!(t.balance, 0);
    assert_eq!(env.balance(&env.seller.pubkey()) - seller_before, SOL + SOL * 3 / 10);
}

#[test]
fn funds_cannot_go_to_a_third_wallet() {
    let mut env = Env::new();
    let trade = env.create(2, SOL);
    let (buyer, seller) = (env.buyer.insecure_clone(), env.seller.insecure_clone());
    env.deposit(trade, &buyer).unwrap();
    env.deposit(trade, &seller).unwrap();
    env.pay_remainder(trade).unwrap();

    let attacker = Keypair::new();
    assert!(env.confirm(trade, &buyer, attacker.pubkey()).is_err());
    // A stranger cannot confirm delivery either
    env.svm.airdrop(&attacker.pubkey(), SOL).unwrap();
    assert!(env.confirm(trade, &attacker, env.seller.pubkey()).is_err());
    assert_eq!(env.trade(&trade).status, TradeStatus::Paid);
}

#[test]
fn dispute_refund_both_returns_exact_contributions() {
    let mut env = Env::new();
    let trade = env.create(3, SOL);
    let (buyer, seller) = (env.buyer.insecure_clone(), env.seller.insecure_clone());
    env.deposit(trade, &buyer).unwrap();
    env.deposit(trade, &seller).unwrap();
    env.pay_remainder(trade).unwrap();
    env.open_dispute(trade, &seller).unwrap();
    assert_eq!(env.trade(&trade).status, TradeStatus::Frozen);

    // Only the admin can resolve
    let resolve = instruction::ResolveDispute { outcome: DisputeOutcome::RefundBoth }.data();
    assert!(env.admin_action(trade, &buyer, resolve.clone()).is_err());

    let (b0, s0) = (env.balance(&env.buyer.pubkey()), env.balance(&env.seller.pubkey()));
    let admin = env.admin.insecure_clone();
    env.admin_action(trade, &admin, resolve).unwrap();
    assert_eq!(env.balance(&env.buyer.pubkey()) - b0, SOL);
    assert_eq!(env.balance(&env.seller.pubkey()) - s0, SOL * 3 / 10);
    assert_eq!(env.trade(&trade).status, TradeStatus::Cancelled);
}

#[test]
fn buyer_who_never_pays_loses_deposit_to_seller() {
    let mut env = Env::new();
    let trade = env.create(4, SOL);
    let (buyer, seller) = (env.buyer.insecure_clone(), env.seller.insecure_clone());
    env.deposit(trade, &buyer).unwrap();
    env.deposit(trade, &seller).unwrap();

    assert!(env.claim_timeout(trade).is_err(), "too early");
    env.warp(STAGE_SECS + 1);
    let s0 = env.balance(&env.seller.pubkey());
    env.claim_timeout(trade).unwrap();
    assert_eq!(env.balance(&env.seller.pubkey()) - s0, 2 * (SOL * 3 / 10));
    assert_eq!(env.trade(&trade).status, TradeStatus::Cancelled);
}
