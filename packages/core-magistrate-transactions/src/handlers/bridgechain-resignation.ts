import { Container, Contracts, Utils } from "@arkecosystem/core-kernel";
import { Transactions as MagistrateTransactions } from "@arkecosystem/core-magistrate-crypto";
import { Interfaces as MagistrateInterfaces } from "@arkecosystem/core-magistrate-crypto";
import { Handlers, TransactionReader } from "@arkecosystem/core-transactions";
import { Interfaces, Managers, Transactions } from "@arkecosystem/crypto";

import {
    BridgechainIsNotRegisteredError,
    BridgechainIsResignedError,
    BusinessIsResignedError,
    WalletIsNotBusinessError,
} from "../errors";
import { MagistrateApplicationEvents } from "../events";
import { IBridgechainWalletAttributes, IBusinessWalletAttributes } from "../interfaces";
import { BridgechainRegistrationTransactionHandler } from "./bridgechain-registration";

@Container.injectable()
export class BridgechainResignationTransactionHandler extends Handlers.TransactionHandler {
    public getConstructor(): Transactions.TransactionConstructor {
        return MagistrateTransactions.BridgechainResignationTransaction;
    }

    public dependencies(): ReadonlyArray<Handlers.TransactionHandlerConstructor> {
        return [BridgechainRegistrationTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["business.bridgechians.bridgechian.resigned"];
    }

    public async isActivated(): Promise<boolean> {
        return !!Managers.configManager.getMilestone().aip11;
    }

    public async bootstrap(
        connection: Contracts.Database.Connection,
        walletRepository: Contracts.State.WalletRepository,
    ): Promise<void> {
        const reader: TransactionReader = await TransactionReader.create(connection, this.getConstructor());

        while (reader.hasNext()) {
            const transactions = await reader.read();

            for (const transaction of transactions) {
                Utils.assert.defined<string>(transaction.senderPublicKey);

                const wallet: Contracts.State.Wallet = walletRepository.findByPublicKey(transaction.senderPublicKey);

                const businessAttributes: IBusinessWalletAttributes = wallet.getAttribute<IBusinessWalletAttributes>(
                    "business",
                );

                Utils.assert.defined<Record<string, IBridgechainWalletAttributes>>(businessAttributes.bridgechains);

                businessAttributes.bridgechains[transaction.asset.bridgechainResignation.bridgechainId].resigned = true;

                wallet.setAttribute<IBusinessWalletAttributes>("business", businessAttributes);
                walletRepository.reindex(wallet);
            }
        }
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
        databaseWalletRepository: Contracts.State.WalletRepository,
    ): Promise<void> {
        if (!wallet.hasAttribute("business")) {
            throw new WalletIsNotBusinessError();
        }

        const businessAttributes: IBusinessWalletAttributes = wallet.getAttribute<IBusinessWalletAttributes>(
            "business",
        );

        if (businessAttributes.resigned) {
            throw new BusinessIsResignedError();
        }

        Utils.assert.defined<MagistrateInterfaces.IBridgechainResignationAsset>(
            transaction.data.asset?.bridgechainResignation,
        );

        const bridgechainResignation: MagistrateInterfaces.IBridgechainResignationAsset =
            transaction.data.asset.bridgechainResignation;

        Utils.assert.defined<Record<string, IBridgechainWalletAttributes>>(businessAttributes.bridgechains);

        const bridgechainAttributes: IBridgechainWalletAttributes =
            businessAttributes.bridgechains[bridgechainResignation.bridgechainId.toString()];

        if (!bridgechainAttributes) {
            throw new BridgechainIsNotRegisteredError();
        }

        if (bridgechainAttributes.resigned) {
            throw new BridgechainIsResignedError();
        }

        return super.throwIfCannotBeApplied(transaction, wallet, databaseWalletRepository);
    }

    public emitEvents(transaction: Interfaces.ITransaction, emitter: Contracts.Kernel.Events.EventDispatcher): void {
        emitter.dispatch(MagistrateApplicationEvents.BridgechainResigned, transaction.data);
    }

    public async canEnterTransactionPool(
        data: Interfaces.ITransactionData,
        pool: Contracts.TransactionPool.Connection,
        processor: Contracts.TransactionPool.Processor,
    ): Promise<boolean> {
        if (await this.typeFromSenderAlreadyInPool(data, pool, processor)) {
            const wallet: Contracts.State.Wallet = pool.walletRepository.findByPublicKey(data.senderPublicKey);

            processor.pushError(
                data,
                "ERR_PENDING",
                `Bridgechain resignation for "${wallet.getAttribute("business")}" already in the pool`,
            );

            return false;
        }

        return true;
    }

    public async applyToSender(
        transaction: Interfaces.ITransaction,
        walletRepository: Contracts.State.WalletRepository,
    ): Promise<void> {
        await super.applyToSender(transaction, walletRepository);

        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        const businessAttributes: IBusinessWalletAttributes = walletRepository
            .findByPublicKey(transaction.data.senderPublicKey)
            .getAttribute<IBusinessWalletAttributes>("business");

        Utils.assert.defined<MagistrateInterfaces.IBridgechainResignationAsset>(
            transaction.data.asset?.bridgechainResignation,
        );

        const bridgechainResignation: MagistrateInterfaces.IBridgechainResignationAsset =
            transaction.data.asset.bridgechainResignation;

        Utils.assert.defined<Record<string, IBridgechainWalletAttributes>>(businessAttributes.bridgechains);

        businessAttributes.bridgechains[bridgechainResignation.bridgechainId.toString()].resigned = true;
    }

    public async revertForSender(
        transaction: Interfaces.ITransaction,
        walletRepository: Contracts.State.WalletRepository,
    ): Promise<void> {
        await super.revertForSender(transaction, walletRepository);

        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        const businessAttributes: IBusinessWalletAttributes = walletRepository
            .findByPublicKey(transaction.data.senderPublicKey)
            .getAttribute<IBusinessWalletAttributes>("business");

        Utils.assert.defined<MagistrateInterfaces.IBridgechainResignationAsset>(
            transaction.data.asset?.bridgechainResignation,
        );

        const bridgechainResignation: MagistrateInterfaces.IBridgechainResignationAsset =
            transaction.data.asset.bridgechainResignation;

        Utils.assert.defined<Record<string, IBridgechainWalletAttributes>>(businessAttributes.bridgechains);

        businessAttributes.bridgechains[bridgechainResignation.bridgechainId.toString()].resigned = false;
    }

    public async applyToRecipient(
        transaction: Interfaces.ITransaction,
        walletRepository: Contracts.State.WalletRepository,
        // tslint:disable-next-line: no-empty
    ): Promise<void> {}

    public async revertForRecipient(
        transaction: Interfaces.ITransaction,
        walletRepository: Contracts.State.WalletRepository,
        // tslint:disable-next-line:no-empty
    ): Promise<void> {}
}