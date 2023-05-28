const { expect } = require('chai');
const { ethers } = require('hardhat');

const { tokens } = require('../utils.js');

describe('Escrow', () => {
  let buyer, seller, inspector, lender;
  let realEstate, escrow;

  beforeEach(async () => {
    [buyer, seller, inspector, lender] = await ethers.getSigners();

    // Deploy
    const RealEstate = await ethers.getContractFactory('RealEstate');
    realEstate = await RealEstate.deploy();

    // console.log('Real Estate address', realEstate.address);

    // Mint
    let transaction = await realEstate
      .connect(seller)
      .mint(
        'https://ipfs.io/ipfs/QmQVcpsjrA6cr1iJjZAodYwmPekYgbnXGo4DFubJiLc2EB/1.json'
      );
    await transaction.wait();

    const Escrow = await ethers.getContractFactory('Escrow');
    escrow = await Escrow.deploy(
      realEstate.address,
      seller.address,
      inspector.address,
      lender.address
    );

    // console.log('Escrow contract address', escrow.address);

    // Approve the NFT transfer
    transaction = await realEstate.connect(seller).approve(escrow.address, 1);
    await transaction.wait();

    // List property
    transaction = await escrow
      .connect(seller)
      .list(1, buyer.address, tokens(10), tokens(5));
    await transaction.wait();
  });

  describe('Deployment', () => {
    it('Returns the NFT Address', async () => {
      const result = await escrow.nftAddress();
      expect(result).to.be.equal(realEstate.address);
    });

    it('Retruns seller', async () => {
      expect(await escrow.seller()).to.be.equal(seller.address);
    });

    it('Returns inspector', async () => {
      const result = await escrow.inspector();
      expect(result).to.be.equal(inspector.address);
    });

    it('Returns lender', async () => {
      const result = await escrow.lender();
      expect(result).to.be.equal(lender.address);
    });
  });

  describe('Listing', () => {
    it('Updates as Listed', async () => {
      expect(await escrow.isListed(1)).to.be.equal(true);
    });

    it('Updates the Ownership', async () => {
      expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address);
    });

    it('Returns the buyer', async () => {
      expect(await escrow.buyer(1)).to.be.equal(buyer.address);
    });

    it('Returns purchase price', async () => {
      expect(await escrow.purchasePrice(1)).to.be.equal(tokens(10));
    });

    it('Returns the escrow Amount', async () => {
      expect(await escrow.escrowAmount(1)).to.be.equal(tokens(5));
    });
  });

  describe('Deposits', async () => {
    it('Updates the contract Balance', async () => {
      const transaction = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) });
      await transaction.wait();
      const result = await escrow.getBalance();
      expect(result).to.be.equal(tokens(5));
    });
  });

  describe('Inspection', () => {
    it('Updates Inspection status to passed', async () => {
      const transaction = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, true);
      await transaction.wait();

      expect(await escrow.inspectionPassed(1)).to.be.equal(true);
    });
  });

  describe('Approval', () => {
    it('Updates Approval Status', async () => {
      let transaction = await escrow.connect(buyer).approveSale(1);
      await transaction.wait();

      transaction = await escrow.connect(seller).approveSale(1);
      await transaction.wait();

      transaction = await escrow.connect(lender).approveSale(1);
      await transaction.wait();

      expect(await escrow.approval(1, buyer.address)).to.be.equal(true);
      expect(await escrow.approval(1, seller.address)).to.be.equal(true);
      expect(await escrow.approval(1, lender.address)).to.be.equal(true);
    });
  });

  describe('Sale', async () => {
    beforeEach(async () => {
      let transaction = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) });
      await transaction.wait();

      transaction = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, true);
      await transaction.wait();

      transaction = await escrow.connect(buyer).approveSale(1);
      await transaction.wait();

      transaction = await escrow.connect(seller).approveSale(1);
      await transaction.wait();

      transaction = await escrow.connect(lender).approveSale(1);
      await transaction.wait();

      await lender.sendTransaction({ to: escrow.address, value: tokens(5) });

      transaction = await escrow.connect(seller).finalizeSale(1);
      await transaction.wait();
    });

    it('Escrow Balance to be zero', async () => {
      expect(await escrow.getBalance()).to.be.equal(0);
    });

    it('Updates the Ownership', async () => {
      expect(await realEstate.ownerOf(1)).to.be.equal(buyer.address);
    });
  });
});
