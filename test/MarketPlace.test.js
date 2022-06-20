//const { artifacts, contract } = require("truffle");
const { assert } = require('chai');
const { expectRevert } = require('@openzeppelin/test-helpers');
const { assertion } = require('@openzeppelin/test-helpers/src/expectRevert');
// const { web3Utils } = require('web3-utils');
// const { web3 } = require('web3');

const MarketPlace = artifacts.require('MarketPlace');
const NFTCollection = artifacts.require('NFTCollection');

// var MarketPlace = artifacts.require("../src/contracts/MarketPlace.sol");
// var NFTCollection = artifacts.require("../src/contracts/NFTCollection.sol");

contract('MarketPlace', function (accounts) {
    let theMarketPlace;

    const account_owner = accounts[0];
    const account_1 = accounts[1];
    const account_2 = accounts[2];
    const account_3 = accounts[3];

    beforeEach(async function () {
        theMarketPlace = await MarketPlace.new();
    });

    it('Test: createCollection', async function () {
        await theMarketPlace.createCollection('Symbol', 'SYM', { from: account_1 });
        await theMarketPlace.createCollection('Doodle', 'DOO', { from: account_2 });

        const collectionCount = await theMarketPlace.getCollectionCount();
        assert.equal(collectionCount, 2, "should be 2");

        const collectionitem_1 = await theMarketPlace.getCollection(1);
        assert.equal(collectionitem_1.ownerAddress, account_1, 'Should be account_1')

        const collectionitem_2 = await theMarketPlace.getCollection(2);
        assert.equal(collectionitem_2.ownerAddress, account_2, 'Should be account_2')

        const collectionContract_1 = await NFTCollection.at(collectionitem_1.collectionAddress);

        const name = await collectionContract_1.name();
        const symbol = await collectionContract_1.symbol();

        assert.equal(name, 'Symbol', 'Should be Symbol');
        assert.equal(symbol, 'SYM', 'Should be SYM');

        let canMint = await collectionContract_1.canMint(account_1);
        assert.equal(canMint, true, 'account_1 can mint on Symbol');

        canMint = await collectionContract_1.canMint(account_2);
        assert.equal(canMint, false, 'account_2 cannot mint on Symbol');
    });

    it('Test: Minting', async function () {
        await theMarketPlace.createCollection('Symbol', 'SYM', { from: account_1 });
        const collectionitem_1 = await theMarketPlace.getCollection(1);
        const collectionContract_1 = await NFTCollection.at(collectionitem_1.collectionAddress);
        await collectionContract_1.safeMint('_tokenURI_1', { from: account_1 });
        await collectionContract_1.safeMint('_tokenURI_2', { from: account_1 });

        let errorMessage = 'ERC721PresetMinterPauserAutoId: must have minter role to mint';
        try {
            await collectionContract_1.safeMint('_tokenURI_3', { from: account_2 });
        }
        catch (error) {
            assert.notEqual(error, undefined, 'Error must be thrown');
            assert.isAbove(error.message.search(errorMessage), -1, errorMessage);
        }

        errorMessage = 'The token URI should be unique';
        try {
            await collectionContract_1.safeMint('_tokenURI_2', { from: account_1 });
        }
        catch (error) {
            assert.notEqual(error, undefined, 'Error must be thrown');
            assert.isAbove(error.message.search(errorMessage), -1, errorMessage);
        }
    });

    it('Test: Auction create', async function () {
        await theMarketPlace.createCollection('Symbol', 'SYM', { from: account_1 });
        const collectionitem_1 = await theMarketPlace.getCollection(1);
        const collectionContract_1 = await NFTCollection.at(collectionitem_1.collectionAddress);
        await collectionContract_1.safeMint('_tokenURI_1', { from: account_1 });
        await collectionContract_1.safeMint('_tokenURI_2', { from: account_1 });

        let errorMessage = 'MarketPlace is not approved';
        try {
            await theMarketPlace.createAuction(collectionitem_1.collectionAddress, 1, 0, 2, { from: account_1 });
        }
        catch (error) {
            assert.notEqual(error, undefined, 'Error must be thrown');
            assert.isAbove(error.message.search(errorMessage), -1, errorMessage);
        }

        await collectionContract_1.approve(theMarketPlace.address, 1, { from: account_1 });
        await theMarketPlace.createAuction(collectionitem_1.collectionAddress, 1, 0, 2, { from: account_1 });

        await collectionContract_1.approve(theMarketPlace.address, 2, { from: account_1 });
        await theMarketPlace.createAuction(collectionitem_1.collectionAddress, 2, 0, 3, { from: account_1 });

        const auctionCount = await theMarketPlace.getAuctionCount();
        assert.equal(auctionCount, 2, "should be 2");

        const auction_1 = await theMarketPlace.getAuction(1);
        assert.equal(auction_1.auctionId, 1, 'auction id is 1');
        assert.equal(auction_1.tokenId, 1, 'token id is 1');
        assert.equal(auction_1.buyItNowPrice, 2, 'buyItNowPrice id is 2');
        assert.equal(auction_1.auctionStatus, 0, 'auctionStatus is Running');

        errorMessage = 'Not token owner';
        try {
            await theMarketPlace.createAuction(collectionitem_1.collectionAddress, 1, 0, 1, { from: account_2 });
        }
        catch (error) {
            assert.notEqual(error, undefined, 'Error must be thrown');
            assert.isAbove(error.message.search(errorMessage), -1, errorMessage);
        }
    });

    it('Test: Buy now violations', async function () {
        await theMarketPlace.createCollection('Symbol', 'SYM', { from: account_1 });
        const collectionitem_1 = await theMarketPlace.getCollection(1);
        const collectionContract_1 = await NFTCollection.at(collectionitem_1.collectionAddress);
        await collectionContract_1.safeMint('_tokenURI_1', { from: account_1 });
        await collectionContract_1.safeMint('_tokenURI_2', { from: account_1 });

        await collectionContract_1.approve(theMarketPlace.address, 1, { from: account_1 });
        await theMarketPlace.createAuction(collectionitem_1.collectionAddress, 1, 0, 2, { from: account_1 });

        await collectionContract_1.approve(theMarketPlace.address, 2, { from: account_1 });
        await theMarketPlace.createAuction(collectionitem_1.collectionAddress, 2, 1, 0, { from: account_1 });

        let errorMessage = 'Auction owner cannot buy it';
        try {
            await theMarketPlace.buyNowAuction(1, { from: account_1 });
        }
        catch (error) {
            assert.notEqual(error, undefined, 'Error must be thrown');
            assert.isAbove(error.message.search(errorMessage), -1, errorMessage);
        }

        errorMessage = 'Buy now price is greater';
        try {
            await theMarketPlace.buyNowAuction(1, { from: account_2, value: 1 });
        }
        catch (error) {
            assert.notEqual(error, undefined, 'Error must be thrown');
            assert.isAbove(error.message.search(errorMessage), -1, errorMessage);
        }

        errorMessage = 'Buy now is not allowed';
        try {
            await theMarketPlace.buyNowAuction(2, { from: account_2, value: 1 });
        }
        catch (error) {
            assert.notEqual(error, undefined, 'Error must be thrown');
            assert.isAbove(error.message.search(errorMessage), -1, errorMessage);
        }
    });

    it('Test: Buy now and transfer', async function () {
        await theMarketPlace.createCollection('Symbol', 'SYM', { from: account_1 });
        const collectionitem_1 = await theMarketPlace.getCollection(1);
        const collectionContract_1 = await NFTCollection.at(collectionitem_1.collectionAddress);
        await collectionContract_1.safeMint('_tokenURI_1', { from: account_1 });
        await collectionContract_1.safeMint('_tokenURI_2', { from: account_1 });

        await collectionContract_1.approve(theMarketPlace.address, 1, { from: account_1 });
        await theMarketPlace.createAuction(collectionitem_1.collectionAddress, 1, 0, 2, { from: account_1 });

        await collectionContract_1.approve(theMarketPlace.address, 2, { from: account_1 });
        await theMarketPlace.createAuction(collectionitem_1.collectionAddress, 2, 0, 3, { from: account_1 });

        // buy now other's nft
        await theMarketPlace.buyNowAuction(1, { from: account_2, value: 2 });

        const auction_1_after = await theMarketPlace.getAuction(1);
        assert.equal(auction_1_after.auctionStatus, 2, 'auctionStatus should be Finished');

        const newOwner_1 = await collectionContract_1.ownerOf(1);
        assert.equal(newOwner_1, account_2, 'New owner is account_2')
    });

    it('Test: cancelAuction', async function () {
        await theMarketPlace.createCollection('Symbol', 'SYM', { from: account_1 });
        const collectionitem_1 = await theMarketPlace.getCollection(1);
        const collectionContract_1 = await NFTCollection.at(collectionitem_1.collectionAddress);
        await collectionContract_1.safeMint('_tokenURI_1', { from: account_1 });
        await collectionContract_1.safeMint('_tokenURI_2', { from: account_1 });

        await collectionContract_1.approve(theMarketPlace.address, 1, { from: account_1 });
        await theMarketPlace.createAuction(collectionitem_1.collectionAddress, 1, 0, 2, { from: account_1 });

        let errorMessage = 'Only auction owner can cancel';
        try {
            await theMarketPlace.cancelAuction(1, { from: account_2 });
        }
        catch (error) {
            assert.notEqual(error, undefined, 'Error must be thrown');
            assert.isAbove(error.message.search(errorMessage), -1, errorMessage);
        }

        await theMarketPlace.cancelAuction(1, { from: account_1 });

        const auction_1_after = await theMarketPlace.getAuction(1);
        assert.equal(auction_1_after.auctionStatus, 3, 'auctionStatus is Cancelled');

        // try to buy canceled auction
        errorMessage = 'Auction is not running';
        try{
            await theMarketPlace.buyNowAuction(1, { from: account_2, value: 2 });
        }
        catch (error) {
            assert.notEqual(error, undefined, 'Error must be thrown');
            assert.isAbove(error.message.search(errorMessage), -1, errorMessage);
        }
    });

    it('Test: Tempalte', async function () {
        await theMarketPlace.createCollection('Symbol', 'SYM', { from: account_1 });
        const collectionitem_1 = await theMarketPlace.getCollection(1);
        const collectionContract_1 = await NFTCollection.at(collectionitem_1.collectionAddress);
        await collectionContract_1.safeMint('_tokenURI_1', { from: account_1 });
        await collectionContract_1.safeMint('_tokenURI_2', { from: account_1 });

        await theMarketPlace.createCollection('Doodle', 'DOO', { from: account_2 });
        const collectionitem_2 = await theMarketPlace.getCollection(2);
        const collectionContract_2 = await NFTCollection.at(collectionitem_2.collectionAddress);
        await collectionContract_2.safeMint('_tokenURI_3', { from: account_2 });
        await collectionContract_2.safeMint('_tokenURI_4', { from: account_2 });
    });
});