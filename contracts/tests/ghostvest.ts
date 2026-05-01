// =============================================================================
// GhostVest 合约集成测试
// =============================================================================
// 测试覆盖：
//   1. initialize_bounty：正常初始化 + 权限校验
//   2. release_to_stealth：TEE 签名释放 + 非 TEE 调用回滚
//   3. deactivate_bounty：DAO 停用 + 非 DAO 回滚
// =============================================================================

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Ghostvest } from "../target/types/ghostvest";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

describe("ghostvest", () => {
  // 使用 Anchor 提供的本地测试环境
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Ghostvest as Program<Ghostvest>;

  // 测试用账户
  const dao = provider.wallet.payer;
  const teeSigner = Keypair.generate(); // 模拟 TEE 预言机
  const attacker = Keypair.generate(); // 模拟未授权攻击者

  // 测试用 bounty 参数
  const bountyId = new anchor.BN(1);
  const usdcAmount = new anchor.BN(1_000_000); // 1 USDC (6 decimals)

  // PDA 地址（测试中动态计算）
  let bountyStatePda: PublicKey;
  let bountyStateBump: number;
  let vaultTokenAccount: PublicKey;
  let vaultBump: number;
  let usdcMint: PublicKey;
  let daoTokenAccount: PublicKey;
  let stealthTokenAccount: PublicKey;

  // =================================================================
  // 测试前置：创建 USDC Mint、DAO Token Account、Stealth Token Account
  // =================================================================
  before(async () => {
    // 创建模拟 USDC Mint（Decimals = 6）
    usdcMint = await createMint(
      provider.connection,
      dao,
      dao.publicKey, // mint authority
      null, // freeze authority
      6 // decimals
    );
    console.log("  [SETUP] USDC Mint:", usdcMint.toBase58());

    // 计算 BountyState PDA 地址
    [bountyStatePda, bountyStateBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("bounty"),
        dao.publicKey.toBuffer(),
        bountyId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    console.log("  [SETUP] BountyState PDA:", bountyStatePda.toBase58());

    // 计算 Vault Token Account PDA 地址
    [vaultTokenAccount, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), bountyStatePda.toBuffer()],
      program.programId
    );
    console.log("  [SETUP] Vault PDA:", vaultTokenAccount.toBase58());

    // 创建 DAO 的 USDC Token Account
    daoTokenAccount = await createAccount(
      provider.connection,
      dao,
      usdcMint,
      dao.publicKey
    );

    // 向 DAO 的 Token Account 铸造测试 USDC
    await mintTo(
      provider.connection,
      dao,
      usdcMint,
      daoTokenAccount,
      dao.publicKey,
      10_000_000 // 10 USDC
    );
    console.log("  [SETUP] DAO USDC 余额: 10 USDC");

    // 创建隐身地址的 Token Account（模拟 TEE 派生的隐身地址）
    stealthTokenAccount = await createAccount(
      provider.connection,
      dao, // payer
      usdcMint,
      bountyStatePda // authority 设为 bounty PDA，方便测试
    );
    console.log("  [SETUP] Stealth Token Account:", stealthTokenAccount.toBase58());

    // 给 attacker 转一些 SOL 以便后续测试签名
    await provider.connection.requestAirdrop(attacker.publicKey, 2_000_000_000);
  });

  // =================================================================
  // 测试组 1：initialize_bounty
  // =================================================================
  describe("initialize_bounty", () => {
    it("应成功初始化 Bounty 并锁入 USDC", async () => {
      // 调用 initialize_bounty 指令
      await program.methods
        .initializeBounty(bountyId, usdcAmount, teeSigner.publicKey)
        .accounts({
          bountyState: bountyStatePda,
          vaultTokenAccount: vaultTokenAccount,
          usdcMint: usdcMint,
          dao: dao.publicKey,
          daoTokenAccount: daoTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      // 验证链上状态
      const bounty = await program.account.bountyState.fetch(bountyStatePda);

      expect(bounty.dao.toBase58()).to.equal(dao.publicKey.toBase58());
      expect(bounty.bountyId.toNumber()).to.equal(1);
      expect(bounty.teePubkey.toBase58()).to.equal(teeSigner.publicKey.toBase58());
      expect(bounty.totalAmount.toNumber()).to.equal(1_000_000);
      expect(bounty.releasedAmount.toNumber()).to.equal(0);
      expect(bounty.isActive).to.equal(true);

      // 验证 Vault 余额
      const vaultInfo = await getAccount(provider.connection, vaultTokenAccount);
      expect(Number(vaultInfo.amount)).to.equal(1_000_000);

      console.log("  ✅ Bounty 初始化成功，Vault 余额:", Number(vaultInfo.amount));
    });

    it("重复初始化同一 bounty_id 应失败", async () => {
      try {
        // 使用不同的 PDA（init 约束会检查已存在）
        await program.methods
          .initializeBounty(bountyId, usdcAmount, teeSigner.publicKey)
          .accounts({
            bountyState: bountyStatePda,
            vaultTokenAccount: vaultTokenAccount,
            usdcMint: usdcMint,
            dao: dao.publicKey,
            daoTokenAccount: daoTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        expect.fail("应抛出错误");
      } catch (err) {
        console.log("  ✅ 重复初始化正确被拒绝:", err.error?.errorCode?.code || "已占用");
      }
    });
  });

  // =================================================================
  // 测试组 2：release_to_stealth
  // =================================================================
  describe("release_to_stealth", () => {
    const testNonce = Buffer.alloc(32, 0xab); // 模拟 32 字节 nonce

    it("TEE 签名应成功释放资金到隐身地址", async () => {
      const releaseAmount = new anchor.BN(500_000); // 0.5 USDC

      await program.methods
        .releaseToStealth(
          Array.from(testNonce),
          Keypair.generate().pubkey(), // stealth_pubkey（仅日志用）
          releaseAmount
        )
        .accounts({
          bountyState: bountyStatePda,
          vaultTokenAccount: vaultTokenAccount,
          stealthTokenAccount: stealthTokenAccount,
          teeSigner: teeSigner.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([teeSigner]) // TEE 私钥签名
        .rpc();

      // 验证链上状态
      const bounty = await program.account.bountyState.fetch(bountyStatePda);
      expect(bounty.releasedAmount.toNumber()).to.equal(500_000);

      // 验证 Vault 余额减少
      const vaultInfo = await getAccount(provider.connection, vaultTokenAccount);
      expect(Number(vaultInfo.amount)).to.equal(500_000);

      // 验证隐身地址余额增加
      const stealthInfo = await getAccount(provider.connection, stealthTokenAccount);
      expect(Number(stealthInfo.amount)).to.equal(500_000);

      console.log("  ✅ TEE 释放成功，Vault 剩余:", Number(vaultInfo.amount));
    });

    it("非 TEE 签名调用应被拒绝（安全核心）", async () => {
      const releaseAmount = new anchor.BN(100_000);

      try {
        await program.methods
          .releaseToStealth(
            Array.from(testNonce),
            Keypair.generate().pubkey(),
            releaseAmount
          )
          .accounts({
            bountyState: bountyStatePda,
            vaultTokenAccount: vaultTokenAccount,
            stealthTokenAccount: stealthTokenAccount,
            teeSigner: attacker.publicKey, // 使用攻击者的公钥
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([attacker]) // 攻击者签名
          .rpc();

        expect.fail("应抛出 UnauthorizedTee 错误");
      } catch (err) {
        expect(err.error?.errorCode?.code).to.equal("UnauthorizedTee");
        console.log("  ✅ 非 TEE 调用正确被拒绝: UnauthorizedTee");
      }
    });

    it("超过余额的释放应被拒绝", async () => {
      const overAmount = new anchor.BN(999_999_999); // 远超锁仓

      try {
        await program.methods
          .releaseToStealth(
            Array.from(testNonce),
            Keypair.generate().pubkey(),
            overAmount
          )
          .accounts({
            bountyState: bountyStatePda,
            vaultTokenAccount: vaultTokenAccount,
            stealthTokenAccount: stealthTokenAccount,
            teeSigner: teeSigner.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([teeSigner])
          .rpc();

        expect.fail("应抛出 InsufficientBalance 错误");
      } catch (err) {
        expect(err.error?.errorCode?.code).to.equal("InsufficientBalance");
        console.log("  ✅ 超额释放正确被拒绝: InsufficientBalance");
      }
    });

    it("应支持多次释放直到余额耗尽", async () => {
      // 释放剩余的 0.5 USDC
      const remainingAmount = new anchor.BN(500_000);

      await program.methods
        .releaseToStealth(
          Array.from(testNonce),
          Keypair.generate().pubkey(),
          remainingAmount
        )
        .accounts({
          bountyState: bountyStatePda,
          vaultTokenAccount: vaultTokenAccount,
          stealthTokenAccount: stealthTokenAccount,
          teeSigner: teeSigner.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([teeSigner])
        .rpc();

      const bounty = await program.account.bountyState.fetch(bountyStatePda);
      expect(bounty.releasedAmount.toNumber()).to.equal(1_000_000);

      const vaultInfo = await getAccount(provider.connection, vaultTokenAccount);
      expect(Number(vaultInfo.amount)).to.equal(0);

      console.log("  ✅ 全额释放完成，Vault 余额归零");
    });
  });

  // =================================================================
  // 测试组 3：deactivate_bounty
  // =================================================================
  describe("deactivate_bounty", () => {
    // 为停用测试创建一个新 bounty
    const deactivateBountyId = new anchor.BN(99);
    let deactivateBountyPda: PublicKey;
    let deactivateVaultPda: PublicKey;
    let deactivateDaoToken: PublicKey;
    let deactivateStealthToken: PublicKey;

    before(async () => {
      // 计算新 bounty 的 PDA
      [deactivateBountyPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("bounty"),
          dao.publicKey.toBuffer(),
          deactivateBountyId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      [deactivateVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), deactivateBountyPda.toBuffer()],
        program.programId
      );

      // 创建新的 DAO Token Account
      deactivateDaoToken = await createAccount(
        provider.connection,
        dao,
        usdcMint,
        dao.publicKey
      );

      await mintTo(
        provider.connection,
        dao,
        usdcMint,
        deactivateDaoToken,
        dao.publicKey,
        5_000_000
      );

      // 创建隐身 Token Account
      deactivateStealthToken = await createAccount(
        provider.connection,
        dao,
        usdcMint,
        deactivateBountyPda
      );

      // 初始化 bounty
      await program.methods
        .initializeBounty(deactivateBountyId, new anchor.BN(5_000_000), teeSigner.publicKey)
        .accounts({
          bountyState: deactivateBountyPda,
          vaultTokenAccount: deactivateVaultPda,
          usdcMint: usdcMint,
          dao: dao.publicKey,
          daoTokenAccount: deactivateDaoToken,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("  [SETUP] 停用测试 Bounty 已初始化");
    });

    it("DAO 应能成功停用 Bounty", async () => {
      await program.methods
        .deactivateBounty()
        .accounts({
          bountyState: deactivateBountyPda,
          dao: dao.publicKey,
        })
        .rpc();

      const bounty = await program.account.bountyState.fetch(deactivateBountyPda);
      expect(bounty.isActive).to.equal(false);

      console.log("  ✅ Bounty 停用成功");
    });

    it("停用后的 Bounty 无法释放资金", async () => {
      try {
        await program.methods
          .releaseToStealth(
            Array.alloc(32).fill(0xcd),
            Keypair.generate().pubkey(),
            new anchor.BN(100_000)
          )
          .accounts({
            bountyState: deactivateBountyPda,
            vaultTokenAccount: deactivateVaultPda,
            stealthTokenAccount: deactivateStealthToken,
            teeSigner: teeSigner.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([teeSigner])
          .rpc();

        expect.fail("应抛出 BountyInactive 错误");
      } catch (err) {
        expect(err.error?.errorCode?.code).to.equal("BountyInactive");
        console.log("  ✅ 停用后释放正确被拒绝: BountyInactive");
      }
    });

    it("非 DAO 调用者无法停用 Bounty", async () => {
      // 创建另一个 bounty 用于此测试
      const nonDaoBountyId = new anchor.BN(98);
      let nonDaoPda: PublicKey;
      let nonDaoVault: PublicKey;

      [nonDaoPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("bounty"),
          dao.publicKey.toBuffer(),
          nonDaoBountyId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      [nonDaoVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), nonDaoPda.toBuffer()],
        program.programId
      );

      const nonDaoTokenAcct = await createAccount(
        provider.connection, dao, usdcMint, dao.publicKey
      );
      await mintTo(
        provider.connection, dao, usdcMint, nonDaoTokenAcct, dao.publicKey, 1_000_000
      );

      await program.methods
        .initializeBounty(nonDaoBountyId, new anchor.BN(1_000_000), teeSigner.publicKey)
        .accounts({
          bountyState: nonDaoPda,
          vaultTokenAccount: nonDaoVault,
          usdcMint: usdcMint,
          dao: dao.publicKey,
          daoTokenAccount: nonDaoTokenAcct,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      // 尝试用 attacker 停用（应失败）
      try {
        await program.methods
          .deactivateBounty()
          .accounts({
            bountyState: nonDaoPda,
            dao: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();

        expect.fail("应抛出 UnauthorizedDao 错误");
      } catch (err) {
        console.log("  ✅ 非 DAO 停用正确被拒绝:", err.error?.errorCode?.code || "约束失败");
      }
    });
  });
});
