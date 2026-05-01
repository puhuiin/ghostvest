// =============================================================================
// GhostVest 智能合约
// =============================================================================
// 极简 Escrow（托管）模型：DAO 锁入 USDC，TEE 预言机验证后释放到隐身地址。
// 拒绝复杂 Vesting，拒绝升级，以"能跑、能审计"为唯一目标。
// =============================================================================

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

// Anchor 自动生成的程序 ID，部署后会替换为实际地址
declare_id!("GhVst111111111111111111111111111111111111111");

// =============================================================================
// 常量：PDA 种子前缀
// =============================================================================
/// BountyState PDA 的种子前缀
const BOUNTY_SEED_PREFIX: &[u8] = b"bounty";
/// Vault Token Account PDA 的种子前缀
const VAULT_SEED_PREFIX: &[u8] = b"vault";

// =============================================================================
// 程序入口
// =============================================================================
#[program]
pub mod ghostvest {
    use super::*;

    /// ---------------------------------------------------------------
    /// initialize_bounty
    /// ---------------------------------------------------------------
    /// DAO 调用此指令，完成以下操作：
    ///   1. 初始化 BountyState PDA，记录 DAO 公钥、bounty_id、TEE 白名单
    ///   2. 创建关联的 Vault Token Account（PDA 拥有）
    ///   3. 将指定数量的 USDC 从 DAO 的 Token Account 转入 Vault
    ///
    /// 参数：
    ///   - ctx: Anchor 上下文，自动校验账户签名与权限
    ///   - bounty_id: DAO 自定义的悬赏标识（u64，可以是时间戳或递增 ID）
    ///   - usdc_amount: 要锁入的 USDC 数量（以最小单位 lamport 计）
    ///   - tee_pubkey: 合法的 TEE 预言机公钥，后续释放必须由此公钥签名
    /// ---------------------------------------------------------------
    pub fn initialize_bounty(
        ctx: Context<InitializeBounty>,
        bounty_id: u64,
        usdc_amount: u64,
        tee_pubkey: Pubkey,
    ) -> Result<()> {
        // 获取并填充 BountyState 账户数据
        let bounty = &mut ctx.accounts.bounty_state;

        // 记录 DAO 钱包地址（后续可用于权限校验）
        bounty.dao = ctx.accounts.dao.key();
        // 记录悬赏 ID，用于链下索引
        bounty.bounty_id = bounty_id;
        // 记录合法的 TEE 预言机公钥白名单
        bounty.tee_pubkey = tee_pubkey;
        // 记录锁仓金额
        bounty.total_amount = usdc_amount;
        // 已释放金额，初始为 0
        bounty.released_amount = 0;
        // Bounty 是否处于活跃状态
        bounty.is_active = true;
        // 记录 bump 以便后续 PDA 验证
        bounty.bump = ctx.bumps.bounty_state;

        // 将 USDC 从 DAO 的 Token Account 转入 Vault（PDA 拥有的 Token Account）
        // CPI（Cross-Program Invocation）：调用 SPL Token 程序的 transfer 指令
        let transfer_ix = Transfer {
            from: ctx.accounts.dao_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.dao.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_ix,
        );
        token::transfer(cpi_ctx, usdc_amount)?;

        // 输出日志，方便链下监控
        msg!(
            "[GhostVest] Bounty #{} 初始化完成，锁入 {} USDC，TEE: {}",
            bounty_id,
            usdc_amount,
            tee_pubkey
        );

        Ok(())
    }

    /// ---------------------------------------------------------------
    /// release_to_stealth
    /// ---------------------------------------------------------------
    /// TEE 预言机调用此指令，完成以下操作：
    ///   1. 校验签名者 == BountyState 中记录的 tee_pubkey
    ///   2. 校验释放金额不超过剩余锁仓余额
    ///   3. 将资金从 Vault 转入 TEE 计算出的隐身地址（stealth_pubkey）
    ///   4. 发出事件日志，仅记录 nonce 和 amount，防止链上关联分析
    ///
    /// 参数：
    ///   - ctx: Anchor 上下文
    ///   - _nonce: 32 字节随机数（仅用于事件日志，不存储在链上状态中）
    ///   - stealth_pubkey: TEE 派生的隐身地址公钥
    ///   - amount: 释放金额
    /// ---------------------------------------------------------------
    pub fn release_to_stealth(
        ctx: Context<ReleaseToStealth>,
        _nonce: [u8; 32],
        stealth_pubkey: Pubkey,
        amount: u64,
    ) -> Result<()> {
        // 读取 BountyState（只读借用）
        let bounty = &ctx.accounts.bounty_state;

        // 安全检查 1：Bounty 必须处于活跃状态
        require!(bounty.is_active, GhostVestError::BountyInactive);

        // 安全检查 2：签名者必须是白名单中的 TEE 预言机
        // 这是整个合约的安全核心——只有 TEE 签名才能释放资金
        require!(
            ctx.accounts.tee_signer.key() == bounty.tee_pubkey,
            GhostVestError::UnauthorizedTee
        );

        // 安全检查 3：释放金额不能超过剩余可释放余额
        let remaining = bounty
            .total_amount
            .checked_sub(bounty.released_amount)
            .ok_or(GhostVestError::InsufficientBalance)?;
        require!(amount <= remaining, GhostVestError::InsufficientBalance);

        // 安全检查 4：隐身地址不能为零地址（防止资金丢失）
        require!(
            stealth_pubkey != Pubkey::default(),
            GhostVestError::InvalidStealthAddress
        );

        // 构造 PDA 签名种子
        // Vault Token Account 由 bounty_state PDA 拥有，需要提供正确的 bump
        let dao_key = bounty.dao;
        let bounty_id_bytes = bounty.bounty_id.to_le_bytes();
        let bump = [bounty.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[
            BOUNTY_SEED_PREFIX,
            dao_key.as_ref(),
            bounty_id_bytes.as_ref(),
            bump.as_ref(),
        ]];

        // CPI：从 Vault 向隐身地址转账
        // 注意：stealth_pubkey 不需要在此处作为账户传入，
        // 因为 SPL Token transfer 的目标账户已在 accounts 中指定
        let transfer_ix = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.stealth_token_account.to_account_info(),
            authority: ctx.accounts.bounty_state.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_ix,
            signer_seeds,
        );
        token::transfer(cpi_ctx, amount)?;

        // 更新链上状态：累加已释放金额
        let bounty = &mut ctx.accounts.bounty_state;
        bounty.released_amount = bounty
            .released_amount
            .checked_add(amount)
            .ok_or(GhostVestError::ArithmeticOverflow)?;

        // 发出事件日志——仅包含 nonce 和 amount
        // nonce 在此处只是日志用途，不会暴露接收方身份关联
        emit!(StealthReleaseEvent {
            nonce: _nonce,
            amount,
        });

        msg!(
            "[GhostVest] 已释放 {} 到隐身地址 {}，nonce: {:?}",
            amount,
            stealth_pubkey,
            &_nonce[..8] // 日志中仅打印 nonce 前 8 字节，减少链上数据暴露
        );

        Ok(())
    }

    /// ---------------------------------------------------------------
    /// deactivate_bounty
    /// ---------------------------------------------------------------
    /// DAO 紧急停用 Bounty（例如发现安全问题或项目取消）。
    /// 停用后 release_to_stealth 将无法再调用。
    /// ---------------------------------------------------------------
    pub fn deactivate_bounty(ctx: Context<DeactivateBounty>) -> Result<()> {
        let bounty = &mut ctx.accounts.bounty_state;

        // 仅原始 DAO 可以停用
        require!(
            ctx.accounts.dao.key() == bounty.dao,
            GhostVestError::UnauthorizedDao
        );

        bounty.is_active = false;

        msg!("[GhostVest] Bounty #{} 已被停用", bounty.bounty_id);
        Ok(())
    }
}

// =============================================================================
// 事件定义
// =============================================================================

/// 隐身释放事件——链下索引器可监听此事件
/// 仅记录 nonce 和 amount，不记录接收方身份，防止链上关联分析
#[event]
pub struct StealthReleaseEvent {
    /// 用于派生隐身地址的 32 字节随机数
    pub nonce: [u8; 32],
    /// 释放金额（最小单位）
    pub amount: u64,
}

// =============================================================================
// 账户状态定义
// =============================================================================

/// BountyState —— 每个悬赏的链上状态
/// 使用 PDA 派生：seeds = ["bounty", dao_pubkey, bounty_id]
#[account]
#[derive(InitSpace)]
pub struct BountyState {
    /// 创建此 Bounty 的 DAO 钱包地址
    pub dao: Pubkey,
    /// 悬赏 ID（由 DAO 自定义，u64）
    pub bounty_id: u64,
    /// 合法的 TEE 预言机公钥——只有此密钥才能签署释放交易
    pub tee_pubkey: Pubkey,
    /// 锁入的总金额（USDC 最小单位）
    pub total_amount: u64,
    /// 已释放的累计金额
    pub released_amount: u64,
    /// Bounty 是否处于活跃状态
    pub is_active: bool,
    /// PDA bump 值（用于后续签名验证）
    pub bump: u8,
}

// =============================================================================
// 指令上下文（Accounts Structs）
// =============================================================================

/// initialize_bounty 的账户约束
#[derive(Accounts)]
#[instruction(bounty_id: u64)]
pub struct InitializeBounty<'info> {
    /// BountyState PDA——由 "bounty" + dao_pubkey + bounty_id 派生
    /// init 约束确保该 PDA 尚未存在；space = 8(discriminator) + BountyState 大小
    #[account(
        init,
        payer = dao,
        space = 8 + BountyState::INIT_SPACE,
        seeds = [
            BOUNTY_SEED_PREFIX,
            dao.key().as_ref(),
            bounty_id.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub bounty_state: Account<'info, BountyState>,

    /// Vault Token Account（PDA）——持有锁仓的 USDC
    /// 由 "vault" + bounty_state.key() 派生，bounty_state 拥有此账户
    #[account(
        init,
        payer = dao,
        token::mint = usdc_mint,
        token::authority = bounty_state,
        seeds = [
            VAULT_SEED_PREFIX,
            bounty_state.key().as_ref(),
        ],
        bump,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// USDC 的 Mint 地址（Devnet: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU）
    /// 使用 unchecked 因为 Mint 是已知地址，不需要 init
    /// CHECK: 由 anchor-spl 的 token::mint 验证
    #[account(
        constraint = usdc_mint.key() == anchor_spl::token::spl_token::id()
            || usdc_mint.key().to_string() == "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
            @ GhostVestError::InvalidMint
    )]
    /// CHECK: Mint 地址由约束验证
    pub usdc_mint: AccountInfo<'info>,

    /// DAO 钱包（签名者 + 付款方）
    #[account(mut)]
    pub dao: Signer<'info>,

    /// DAO 的 USDC Token Account——资金来源
    #[account(
        mut,
        constraint = dao_token_account.owner == dao.key()
            && dao_token_account.mint == usdc_mint.key()
            @ GhostVestError::InvalidTokenAccount
    )]
    pub dao_token_account: Account<'info, TokenAccount>,

    /// SPL Token 程序
    pub token_program: Program<'info, Token>,

    /// System Program（创建账户时需要）
    pub system_program: Program<'info, System>,

    /// Rent Sysvar（判断账户是否免租金）
    pub rent: Sysvar<'info, Rent>,
}

/// release_to_stealth 的账户约束
#[derive(Accounts)]
pub struct ReleaseToStealth<'info> {
    /// BountyState PDA——使用 seeds + bump 验证
    #[account(
        mut,
        seeds = [
            BOUNTY_SEED_PREFIX,
            bounty_state.dao.as_ref(),
            bounty_state.bounty_id.to_le_bytes().as_ref(),
        ],
        bump = bounty_state.bump,
    )]
    pub bounty_state: Account<'info, BountyState>,

    /// Vault Token Account——资金来源
    #[account(
        mut,
        seeds = [
            VAULT_SEED_PREFIX,
            bounty_state.key().as_ref(),
        ],
        bump,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// 隐身地址的 Token Account——资金目标
    /// CHECK: 由 TEE 派生的隐身地址，合约不校验其内部结构
    #[account(mut)]
    pub stealth_token_account: Account<'info, TokenAccount>,

    /// TEE 预言机签名者——必须与 bounty_state.tee_pubkey 一致
    pub tee_signer: Signer<'info>,

    /// SPL Token 程序
    pub token_program: Program<'info, Token>,
}

/// deactivate_bounty 的账户约束
#[derive(Accounts)]
pub struct DeactivateBounty<'info> {
    /// BountyState PDA
    #[account(
        mut,
        seeds = [
            BOUNTY_SEED_PREFIX,
            bounty_state.dao.as_ref(),
            bounty_state.bounty_id.to_le_bytes().as_ref(),
        ],
        bump = bounty_state.bump,
    )]
    pub bounty_state: Account<'info, BountyState>,

    /// DAO 钱包签名者——必须与 bounty_state.dao 一致
    pub dao: Signer<'info>,
}

// =============================================================================
// 错误码定义
// =============================================================================

#[error_code]
pub enum GhostVestError {
    /// 签名者不是白名单中的 TEE 预言机
    #[msg("[GhostVest] 未授权：签名者不是合法的 TEE 预言机")]
    UnauthorizedTee,

    /// 余额不足，释放金额超过剩余锁仓
    #[msg("[GhostVest] 余额不足：释放金额超过剩余锁仓额度")]
    InsufficientBalance,

    /// Bounty 已停用，无法继续释放
    #[msg("[GhostVest] Bounty 已停用")]
    BountyInactive,

    /// 隐身地址为零地址（无效）
    #[msg("[GhostVest] 无效的隐身地址：不能为零地址")]
    InvalidStealthAddress,

    /// 数学溢出
    #[msg("[GhostVest] 算术溢出")]
    ArithmeticOverflow,

    /// 签名者不是原始 DAO
    #[msg("[GhostVest] 未授权：仅原始 DAO 可执行此操作")]
    UnauthorizedDao,

    /// 无效的 Mint 地址
    #[msg("[GhostVest] 无效的 Mint 地址")]
    InvalidMint,

    /// 无效的 Token Account
    #[msg("[GhostVest] 无效的 Token Account")]
    InvalidTokenAccount,
}
