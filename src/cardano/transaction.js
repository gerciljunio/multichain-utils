import {
    Buffer
} from 'buffer'

import * as wasm from '@emurgo/cardano-serialization-lib-asmjs'
import CoinSelection from './coinSelection'

import * as typhonjs from '@stricahq/typhonjs'

import * as walletUtils from 'adanize-wallet-utils'

import * as cardanoAPI from './index'

import {
    CARDANO_EXPLORER,
    CARDANO_EXPLORER_CARDANOSCAN,
    CARDANO_EXPLORER_ADAEX
} from '../config'

import {
    getCardanoRequestNetwork,
} from '../utils'

/**
 * 
 * @param {*} utxo 
 * @returns 
 */
export const _cardanoUtxoToAssets = (utxo) => {
    let value = utxo.output().amount()
    const assets = [];
    assets.push({
        unit: 'lovelace',
        quantity: value.coin().to_str()
    });
    if (value.multiasset()) {
        const multiAssets = value.multiasset().keys();
        for (let j = 0; j < multiAssets.len(); j++) {
            const policy = multiAssets.get(j);
            const policyAssets = value.multiasset().get(policy);
            const assetNames = policyAssets.keys();
            for (let k = 0; k < assetNames.len(); k++) {
                const policyAsset = assetNames.get(k);
                const quantity = policyAssets.get(policyAsset);
                const asset =
                    Buffer.from(
                        policy.to_bytes()
                    ).toString('hex') + "." +
                    Buffer.from(
                        policyAsset.name()
                    ).toString('ascii')

                assets.push({
                    unit: asset,
                    quantity: quantity.to_str(),
                });
            }
        }
    }
    return assets;
}

/**
 * formatted utxos from cardano.wallet.api.getUtxos()
 * @param {string} wallet 
 * @returns 
 */
 export const cardanoGetUtxosFormatted = async (wallet = "nami") => {
    let walletUtxos = await walletUtils.getUtxosHex(wallet)
    let Utxos = walletUtxos.map(_utx => wasm.TransactionUnspentOutput.from_bytes(
        Buffer.from(
            _utx,
            'hex'
        )
    ))
    let UTXOS = []
    for (let utxo of Utxos) {
        let assets = _cardanoUtxoToAssets(utxo)

        UTXOS.push({
            txHash: Buffer.from(
                utxo.input().transaction_id().to_bytes(),
                'hex'
            ).toString('hex'),
            txId: utxo.input().index(),
            amount: assets
        })
    }
    return UTXOS
}

/**
 * 
 * @param {array} assets 
 * @returns 
 */
export const _cardanoMakeMultiAsset = (assets) => {
    let AssetsMap = {}
    for (let asset of assets) {
        let [policy, assetName] = asset.unit.split('.')
        let quantity = asset.quantity
        if (!Array.isArray(AssetsMap[policy])) {
            AssetsMap[policy] = []
        }
        
        AssetsMap[policy].push({
            "unit": Buffer.from(assetName, 'ascii').toString('hex'),
            "quantity": quantity.toString()
        })

    }

    let multiAsset = wasm.MultiAsset.new()
    for (const policy in AssetsMap) {

        const ScriptHash = wasm.ScriptHash.from_bytes(
            Buffer.from(policy, 'hex')
        )

        const Assets = wasm.Assets.new()
        
        const _assets = AssetsMap[policy]
        
        for (const asset of _assets) {
            const AssetName = wasm.AssetName.new(Buffer.from(asset.unit, 'hex'))
            const BigNum = wasm.BigNum.from_str(asset.quantity.toString())

            Assets.insert(AssetName, BigNum)
        }

        multiAsset.insert(ScriptHash, Assets)
    }

    return multiAsset
}

/**
 * 
 * @param {*} wallet 
 * @param {*} transactionRaw 
 * @returns 
 */
 export const _signSubmitTx = async (wallet = 'nami', transactionRaw) => {
    let transaction = wasm.Transaction.from_bytes(transactionRaw)
    let provider = await walletUtils.extend(wallet)

    const witneses = await provider.signTx(
        Buffer.from(
            transaction.to_bytes()
        ).toString('hex')
    )

    const signedTx = wasm.Transaction.new(
        transaction.body(), 
        wasm.TransactionWitnessSet.from_bytes(
            Buffer.from(
                witneses,
                "hex"
            )
        ),
        transaction.auxiliary_data()
    )

    const txhash = await provider.submitTx(
        Buffer.from(
            signedTx.to_bytes()
        ).toString('hex')
    )
    return txhash
}
  
/**
 * 
 * @param {*}
 * @returns 
 */
export const _cardanoTxBuilder = ({
    PaymentAddress,
    Utxos,
    Outputs,
    ProtocolParameter,
    Metadata = null,
    MetadataLabel = '721',
    Delegation = null,
}) => {
    CoinSelection.setLoader(wasm)

    const MULTIASSET_SIZE = 5000;
    const VALUE_SIZE = 5000;
    const totalAssets = 0

    CoinSelection.setProtocolParameters(
        ProtocolParameter.minUtxo.toString(),
        ProtocolParameter.linearFee.minFeeA.toString(),
        ProtocolParameter.linearFee.minFeeB.toString(),
        ProtocolParameter.maxTxSize.toString()
    )

    let selection

    try {
        selection = CoinSelection.randomImprove(
            Utxos,
            Outputs,
            20 + totalAssets,
        )
    } catch (error) {
        throw `There was a problem, maybe you are trying to send an asset that doesn't exist in the wallet or your wallet doesn't have enough balance for this transaction.`
    }

    const inputs = selection.input;
    const txBuilder = wasm.TransactionBuilder.new(
        wasm.LinearFee.new(
            wasm.BigNum.from_str(ProtocolParameter.linearFee.minFeeA),
            wasm.BigNum.from_str(ProtocolParameter.linearFee.minFeeB)
        ),
        wasm.BigNum.from_str(ProtocolParameter.minUtxo.toString()),
        wasm.BigNum.from_str(ProtocolParameter.poolDeposit.toString()),
        wasm.BigNum.from_str(ProtocolParameter.keyDeposit.toString()),
        MULTIASSET_SIZE,
        MULTIASSET_SIZE
    );

    for (let i = 0; i < inputs.length; i++) {
        const utxo = inputs[i];
        txBuilder.add_input(
            utxo.output().address(),
            utxo.input(),
            utxo.output().amount()
        );
    }

    if (Delegation) {
        let certificates = wasm.Certificates.new();
        if (!Delegation.delegation.active) {
            certificates.add(
                wasm.Certificate.new_stake_registration(
                    wasm.StakeRegistration.new(
                        wasm.StakeCredential.from_keyhash(
                            wasm.Ed25519KeyHash.from_bytes(
                                Buffer.from(Delegation.stakeKeyHash, 'hex')
                            )
                        )
                    )
                )
            )
        }

        let poolKeyHash = Delegation.poolHex
        certificates.add(
            wasm.Certificate.new_stake_delegation(
                wasm.StakeDelegation.new(
                    wasm.StakeCredential.from_keyhash(
                        wasm.Ed25519KeyHash.from_bytes(
                            Buffer.from(Delegation.stakeKeyHash, 'hex')
                        )
                    ),
                    wasm.Ed25519KeyHash.from_bytes(
                        Buffer.from(poolKeyHash, 'hex')
                    )
                )
            )
        );
        txBuilder.set_certs(certificates)
    }


    let AUXILIARY_DATA
    if (Metadata) {
        let METADATA = wasm.GeneralTransactionMetadata.new()
        METADATA.insert(
            wasm.BigNum.from_str(MetadataLabel),
            wasm.encode_json_str_to_metadatum(
                JSON.stringify(Metadata),
                0
            )
        )
        AUXILIARY_DATA = wasm.AuxiliaryData.new()
        AUXILIARY_DATA.set_metadata(METADATA)
        //const auxiliaryDataHash = wasm.hash_auxiliary_data(AUXILIARY_DATA)
        txBuilder.set_auxiliary_data(AUXILIARY_DATA)
    }

    for (let i = 0; i < Outputs.len(); i++) {
        txBuilder.add_output(Outputs.get(i))
    }

    const change = selection.change;
    const changeMultiAssets = change.multiasset();
    // check if change value is too big for single output
    if (changeMultiAssets && change.to_bytes().length * 2 > VALUE_SIZE) {
        const partialChange = wasm.Value.new(
            wasm.BigNum.from_str('0')
        );

        const partialMultiAssets = wasm.MultiAsset.new();
        const policies = changeMultiAssets.keys();
        const makeSplit = () => {
            for (let j = 0; j < changeMultiAssets.len(); j++) {
                const policy = policies.get(j);
                const policyAssets = changeMultiAssets.get(policy);
                const assetNames = policyAssets.keys();
                const assets = wasm.Assets.new();
                for (let k = 0; k < assetNames.len(); k++) {
                    const policyAsset = assetNames.get(k);
                    const quantity = policyAssets.get(policyAsset);
                    assets.insert(policyAsset, quantity);
                    //check size
                    const checkMultiAssets = wasm.MultiAsset.from_bytes(
                        partialMultiAssets.to_bytes()
                    );
                    checkMultiAssets.insert(policy, assets);
                    const checkValue = wasm.Value.new(
                        wasm.BigNum.from_str('0')
                    );
                    checkValue.set_multiasset(checkMultiAssets);
                    if (
                        checkValue.to_bytes().length * 2 >=
                        VALUE_SIZE
                    ) {
                        partialMultiAssets.insert(policy, assets);
                        return;
                    }
                }
                partialMultiAssets.insert(policy, assets);
            }
        };

        makeSplit();
        partialChange.set_multiasset(partialMultiAssets);

        const minAda = wasm.min_ada_required(
            partialChange,
            wasm.BigNum.from_str(ProtocolParameter.minUtxo)
        );
        partialChange.set_coin(minAda);

        txBuilder.add_output(
            wasm.TransactionOutput.new(
                wasm.Address.from_bech32(PaymentAddress),
                partialChange
            )
        );
    }
    txBuilder.add_change_if_needed(
        wasm.Address.from_bech32(PaymentAddress)
    );
    const transaction = wasm.Transaction.new(
        txBuilder.build(),
        wasm.TransactionWitnessSet.new(),
        AUXILIARY_DATA
    )

    const size = transaction.to_bytes().length * 2;
    if (size > ProtocolParameter.maxTxSize) throw ERROR.TX_TOO_BIG;

    return transaction.to_bytes()
}

export const _cardanoTyphonSimpleTransaction = async ({
    address,
    amount = 0,
    assets = [],
    metadata = null,
    metadataLabel = '721'
}, options = {}) => {
    let paymentTransactionResponse, auxiliaryDataCbor

    try {
        const provider = await walletUtils.extend('typhon')

        if (metadata) {
            auxiliaryDataCbor = typhonjs.utils.createAuxiliaryDataCbor({
                metadata: [
                    {
                        label: Number(metadataLabel),
                        data: metadata,
                    },
                ],
            }).toString("hex");
        }
        
        // Send with assets
        if (assets.length > 0) {

            let assetsFormatted = assets.map((item) => {
                let unit = item['unit']
                let policyId = unit.split('.')[0] || null
                let assetName = unit.split('.')[1] || null

                if (!policyId) {
                    throw 'policyID not found.'
                }
                
                if (assetName) {
                    assetName = Buffer.from(assetName).toString('hex')
                }

                return {
                    assetName: assetName,
                    policyId: policyId,
                    amount: item['quantity'].toString(),
                }

            })
            paymentTransactionResponse = await provider.paymentTransaction({
                auxiliaryDataCbor: auxiliaryDataCbor,
                outputs: [
                    Object.assign({
                        address: address,
                        tokens: assetsFormatted,
                    }, amount ? { amount: (Number(amount) * 1000000).toString() } : {}),
                ],
            })

        } else {
            
            // Send WITHOUT assets, simple transaction
            paymentTransactionResponse = await provider.paymentTransaction({
                auxiliaryDataCbor: auxiliaryDataCbor,
                outputs: [
                    {
                        address: address,
                        amount: (Number(amount) * 1000000).toString(),
                    },
                ],
            })

        }

        if (!paymentTransactionResponse.status) {
            return {
                code: 404,
                data: paymentTransactionResponse.error || paymentTransactionResponse.reason || paymentTransactionResponse.data || ''
            }
        } else {
            return {
                code: 200,
                data: {
                    tx: paymentTransactionResponse.data.transactionId,
                    explorers: {
                        cardano: CARDANO_EXPLORER[getCardanoRequestNetwork(options)] + paymentTransactionResponse.data.transactionId,
                        cardanoscan: CARDANO_EXPLORER_CARDANOSCAN[getCardanoRequestNetwork(options)] + paymentTransactionResponse.data.transactionId,
                        adaex: CARDANO_EXPLORER_ADAEX[getCardanoRequestNetwork(options)] + paymentTransactionResponse.data.transactionId,
                    }
                }
            }
        }
    } catch (error) {
        return {
            code: 404,
            data: error.info || error.message || ''
        }
    }
}

/**
 * 
 * @param {*} param0 
 * @param {*} options 
 * @returns 
 */
export const _cardanoTyphonMultipleTransaction = async ({
    recipients,
    metadata = null,
    metadataLabel = '721'
}, options = {}) => {
    let paymentTransactionResponse, auxiliaryDataCbor, transactionData
    let multipleOutputs = []

    try {
        const provider = await walletUtils.extend('typhon')

        if (metadata) {
            auxiliaryDataCbor = typhonjs.utils.createAuxiliaryDataCbor({
                metadata: [
                    {
                        label: Number(metadataLabel),
                        data: metadata,
                    },
                ],
            }).toString("hex");
        }

        for (let recipient of recipients) {
            recipient.assets = !recipient.assets || typeof(recipient.assets) === 'undefined' ? [] : recipient.assets

            // Send with assets
            if (recipient.assets.length > 0) {

                let assetsFormatted = recipient.assets.map((item) => {
                    let unit = item['unit']
                    let policyId = unit.split('.')[0] || null
                    let assetName = unit.split('.')[1] || null

                    if (!policyId) {
                        throw 'policyID not found.'
                    }
                    
                    if (assetName) {
                        assetName = Buffer.from(assetName).toString('hex')
                    }

                    return {
                        assetName: assetName,
                        policyId: policyId,
                        amount: item['quantity'].toString(),
                    }

                })

                multipleOutputs.push(Object.assign({
                    address: recipient.address,
                    tokens: assetsFormatted,
                }, recipient.amount ? { amount: (Number(recipient.amount) * 1000000).toString() } : {}))

            } else {
                
                // Send WITHOUT assets, simple transaction
                multipleOutputs.push({
                    address: recipient.address,
                    amount: (Number(recipient.amount) * 1000000).toString(),
                })

            }
        }

        paymentTransactionResponse = await provider.paymentTransaction({
            auxiliaryDataCbor: auxiliaryDataCbor,
            outputs: multipleOutputs,
        })

        if (!paymentTransactionResponse.status) {
            return {
                code: 404,
                data: paymentTransactionResponse.error || paymentTransactionResponse.reason || paymentTransactionResponse.data || ''
            }
        } else {
            return {
                code: 200,
                data: {
                    tx: paymentTransactionResponse.data.transactionId,
                    explorers: {
                        cardano: CARDANO_EXPLORER[getCardanoRequestNetwork(options)] + paymentTransactionResponse.data.transactionId,
                        cardanoscan: CARDANO_EXPLORER_CARDANOSCAN[getCardanoRequestNetwork(options)] + paymentTransactionResponse.data.transactionId,
                        adaex: CARDANO_EXPLORER_ADAEX[getCardanoRequestNetwork(options)] + paymentTransactionResponse.data.transactionId,
                    }
                }
            }
        }
    } catch (error) {
        return {
            code: 404,
            data: error.info || error.message || ''
        }
    }
}

/**
 * 
 * @param {*} wallet 
 * @param {*} param1 
 * @param {*} options 
 * @returns 
 */
export const cardanoMakeSimpleTransaction = async (wallet, {
    address,
    amount = 0,
    assets = [],
    metadata = null,
    metadataLabel = '721'
}, options = {}) => {

    // For typhon
    if (wallet == 'typhon') {
        return _cardanoTyphonSimpleTransaction({
            address,
            amount,
            assets,
            metadata,
            metadataLabel
        }, options)

    // For all cardano wallets, except Typhon
    } else {

        let PaymentAddress = await walletUtils.getChangeAddressString(wallet)

        let protocolParameter = await cardanoAPI.cardanoProtocolParameters(options)

        if (protocolParameter.code == 404) {
            return {
                code: 404,
                data: protocolParameter.data
            }
        }

        protocolParameter = protocolParameter.data.to_transaction

        const utxos = await walletUtils.getUtxosHex(wallet)

        let parsedUtxos = utxos.map(u => wasm.TransactionUnspentOutput.from_bytes(
            Buffer.from(
                u,
                'hex'
            )
        ))

        let lovelace = Math.floor((amount || 0) * 1000000).toString()

        let receiveAddress = address

        let multiAsset = _cardanoMakeMultiAsset(assets)

        const outputValue = wasm.Value.new(
            wasm.BigNum.from_str(lovelace)
        )

        if((assets || []).length > 0){
            outputValue.set_multiasset(multiAsset)
        }

        let minAda = wasm.min_ada_required(
            outputValue,
            amount == 0 ? wasm.BigNum.from_str("1000000") : wasm.BigNum.from_str(protocolParameter.minUtxo || "1000000")
        )

        if(wasm.BigNum.from_str(lovelace).compare(minAda) < 0){
            outputValue.set_coin(minAda);
        }

        const outputs = wasm.TransactionOutputs.new()
        outputs.add(
            wasm.TransactionOutput.new(
                wasm.Address.from_bech32(receiveAddress),
                outputValue
            )
        )

        let RawTransaction = _cardanoTxBuilder({
            PaymentAddress: String(PaymentAddress),
            Utxos: parsedUtxos,
            Outputs: outputs,
            ProtocolParameter: protocolParameter,
            Metadata: metadata,
            MetadataLabel: metadataLabel,
            Delegation: null,
        })
        
        try {
            let tx = await _signSubmitTx(wallet, RawTransaction)

            if (!tx.match(/^[0-9a-zA-Z]+$/)) {
                return {
                    code: 404,
                    data: tx
                }
            }

            return {
                code: 200,
                data: {
                    tx: tx,
                    explorers: {
                        cardano: CARDANO_EXPLORER[getCardanoRequestNetwork(options)] + tx,
                        cardanoscan: CARDANO_EXPLORER_CARDANOSCAN[getCardanoRequestNetwork(options)] + tx,
                        adaex: CARDANO_EXPLORER_ADAEX[getCardanoRequestNetwork(options)] + tx,
                    }
                }
            }
        } catch (error) {
            return {
                code: 404,
                data: error.info || error.message || ''
            }
        }

    }
}

/**
 * 
 * @param {*} wallet 
 * @param {*} param1 
 * @param {*} options 
 * @returns 
 */
export const cardanoMakeMultipleTransaction = async (wallet, {
    recipients,
    metadata = null,
    metadataLabel = '721'
}, options = {}) => {
    // For typhon
    if (wallet == 'typhon') {
        return _cardanoTyphonMultipleTransaction({
            recipients,
            metadata,
            metadataLabel
        }, options)

    // For all cardano wallets, except Typhon
    } else {
    
        let PaymentAddress = await walletUtils.getChangeAddressString(wallet)

        let protocolParameter = await cardanoAPI.cardanoProtocolParameters(options)

        if (protocolParameter.code == 404) {
            return {
                code: 404,
                data: protocolParameter.data
            }
        }

        protocolParameter = protocolParameter.data.to_transaction

        const utxos = await walletUtils.getUtxosHex(wallet)

        let parsedUtxos = utxos.map(u => wasm.TransactionUnspentOutput.from_bytes(
            Buffer.from(
                u,
                'hex'
            )
        ))

        const outputs = wasm.TransactionOutputs.new()
            
        // Multiple
        for (let recipient of recipients) {

            recipient.amount = recipient.amount == 0 || typeof(recipient.amount) === 'undefined' ? 0 : recipient.amount

            const lovelace = Math.floor((recipient.amount || 0) * 1000000).toString()

            let receiveAddress = recipient.address

            let multiAsset = _cardanoMakeMultiAsset(recipient.assets || [])

            const outputValue = wasm.Value.new(
                wasm.BigNum.from_str(lovelace)
            )

            if((recipient.assets || []).length > 0){
                outputValue.set_multiasset(multiAsset)
            } 
            
            let minAda = wasm.min_ada_required(
                outputValue,
                recipient.amount == 0 ? wasm.BigNum.from_str("1000000") : wasm.BigNum.from_str(protocolParameter.minUtxo || "1000000")
            )
        
            if(wasm.BigNum.from_str(lovelace).compare(minAda) < 0){
                outputValue.set_coin(minAda)
            }

            outputs.add(
                wasm.TransactionOutput.new(
                    wasm.Address.from_bech32(receiveAddress),
                    outputValue
                )
            )
        }

        let RawTransaction = _cardanoTxBuilder({
            PaymentAddress: String(PaymentAddress),
            Utxos: parsedUtxos,
            Outputs: outputs,
            ProtocolParameter: protocolParameter,
            Metadata: metadata,
            MetadataLabel: metadataLabel,
            Delegation: null,
        })
        
        try {
            let tx = await _signSubmitTx(wallet, RawTransaction)

            if (!tx.match(/^[0-9a-zA-Z]+$/)) {
                return {
                    code: 404,
                    data: tx
                }
            }

            return {
                code: 200,
                data: {
                    tx: tx,
                    explorers: {
                        cardano: CARDANO_EXPLORER[getCardanoRequestNetwork(options)] + tx,
                        cardanoscan: CARDANO_EXPLORER_CARDANOSCAN[getCardanoRequestNetwork(options)] + tx,
                        adaex: CARDANO_EXPLORER_ADAEX[getCardanoRequestNetwork(options)] + tx,
                    }
                }
            }
        } catch (error) {
            return {
                code: 404,
                data: error.info || error.message || ''
            }
        }
    }
}