import * as WAValidator from 'multicoin-address-validator'
import * as walletUtils from 'adanize-wallet-utils'

import {
    MESSAGES,
    ADAHANDLE_POLICY,
    CARDANO_EXPLORER,
    CARDANO_EXPLORER_CARDANOSCAN,
    CARDANO_EXPLORER_ADAEX
} from '../config'

import {
    koiosRequest,
    blockFrostRequest,
    adaHandleRequest,
    artAssetRequest,
    artRequest
} from '../requests'

import {
    getBlockfrostId,
    getCardanoRequestNetwork,
    convertStringToHex
} from '../utils'

/**
 * Get address from $handle
 * @param {string} handle $name_handle
 * @param {object} options 
 * @returns object
 */
export const cardanoAddressFromAdaHandle = async (handle, options = {}) => {
    const {
        onlyAddr = false
    } = options
    if (handle.startsWith('$')) {
        try {
            let asset = convertStringToHex(handle.slice(1))
            let response = await adaHandleRequest(asset, options)

            if (typeof (response) === "undefined") {
                return {
                    code: 404,
                    data: `The handle ${handle} not found`
                }
            }

            return onlyAddr ? response : {
                code: 200,
                data: response
            }
        } catch (error) {
            return {
                code: error.code,
                data: error.data
            }
        }
    } else {
        return {
            code: 404,
            data: 'The handle must be passed with $ at the beginning, e.g. $cardano'
        }
    }
}

/**
 * Get $handle from wallet
 * @param {string} wallet nami, ccvault, flint, gero, typhon, cardwallet, yoroi
 * @param {object} options network: 0 for testnet and network: 1 for mainnet / default = 1 (mainnet)
 * @returns 
 */
export const walletCardanoAdaHandle = async (wallet, options = {}) => {
    let policy = ADAHANDLE_POLICY[getCardanoRequestNetwork(options)]
    let assets

    try {
        assets = await walletUtils.searchNft(wallet, policy)
    } catch (error) {
        return {
            code: 404,
            data: error.info || error.message || error
        }
    }

    if (assets && assets.length > 0) {
        return {
            code: 200,
            data: assets.length == 1 ? '$' + asset[0]['asset_name'] : assets.map((element) => {
                return '$' + element['asset_name']
            })
        }
    }

    return {
        code: 404,
        data: 'Ada Handle not found on wallet: ' + wallet
    }
}

/**
 * Get ADA address from Resolver
 * @param {string} art
 * @param {object} options It also extends cardanoAddressFromAdaHandle(handle, options) options if you want to use Blockfrost for example
 * @returns object
 */
export const getAda = async (art, options = {}) => {
    // if it is default ADA address
    if (WAValidator.validate(art, 'ada')) {
        return {
            code: 200,
            data: art
        };
    }

    // If starting with $ is a handle 
    if (art.startsWith('$')) {
        return await cardanoAddressFromAdaHandle(art, options)
    }

    // Otherwise it's an ART 
    return await artAssetRequest('ada', art, options)
}

/**
 * Return information of account by stake_address or address
 * @param {string} address stake_address or address
 * @param {object} options blockfrost_id if use Blockfrost, network 0 for testnet and 1 mainnet, onlyStake to return stake_address
 * @returns 
 */
export const cardanoAccountInformation = async (address, options = {}) => {
    const {
        blockfrost_id = null, network = 1, onlyStake = false
    } = options

    if (!address.startsWith('stake') && !address.startsWith('addr')) {
        return {
            code: 404,
            data: MESSAGES.cardano.accountValidAddresses
        }
    }

    let response

    try {
        if (address.startsWith('addr')) {
            if (!blockfrost_id) {
                response = await koiosRequest(`address_info?_address=${address}`, {
                    network: network
                })
                let data = response.data

                if (typeof (data.length) == "undefined" && typeof (data) == "object") {
                    address = data.stake_address
                } else {
                    return {
                        code: 404,
                        data: MESSAGES.cardano.dataAccountNotFound
                    }
                }
            } else {
                response = await blockFrostRequest(`addresses/${address}`, {
                    blockfrost_id: blockfrost_id,
                    network: network
                })
                let data = response.data

                if (response.code == 200) {
                    address = data.stake_address
                } else {
                    return {
                        code: 404,
                        data: MESSAGES.cardano.dataAccountNotFound
                    }
                }
            }
        }

        if (onlyStake) {
            return {
                code: 200,
                data: address
            }
        }

        if (!blockfrost_id) {
            response = await koiosRequest(`account_info?_address=${address}`, {
                network: network
            })
            let data = response.data

            if (typeof (data.length) == "undefined" && typeof (data) == "object") {
                return {
                    code: 200,
                    data: {
                        active: data.status == 'registered' ? true : false,
                        stake_address: address,
                        pool_id: data.delegated_pool,
                        reserves: data.reserves,
                        withdrawals: data.withdrawals,
                        rewards: data.rewards,
                        treasury: data.treasury,
                        balance: data.total_balance
                    }
                }
            }
        } else {
            response = await blockFrostRequest(`accounts/${address}`, {
                blockfrost_id: blockfrost_id,
                network: network
            })
            let data = response.data

            if (response.code == 200) {
                return {
                    code: 200,
                    data: {
                        active: data.active,
                        stake_address: address,
                        pool_id: data.pool_id,
                        reserves: data.reserves_sum,
                        withdrawals: data.withdrawals_sum,
                        rewards: data.rewards_sum,
                        treasury: data.treasury_sum,
                        balance: data.controlled_amount
                    }
                }
            }
        }
    } catch (error) {}

    return {
        code: 404,
        data: MESSAGES.cardano.dataAccountNotFound
    }
}

/**
 * Get stake_address by address
 * @param {string} address address
 * @param {object} options same options in cardanoAccountInformation
 * @returns 
 */
export const cardanoStakeAddress = async (address, options = {}) => {
    if (address.startsWith('stake')) {
        return {
            code: 200,
            data: address,
        }
    }

    let response = await cardanoAccountInformation(address, Object.assign(options, {
        onlyStake: true
    }))

    return {
        code: response.code,
        data: response.data,
    }
}

/**
 * Get pool_id by stake_address or address
 * @param {string} address stake_address or address
 * @param {object} options same options in cardanoAccountInformation
 * @returns 
 */
export const cardanoPoolIdByAddress = async (address, options = {}) => {
    let response
    try {
        response = await cardanoAccountInformation(address, options)
    } catch (error) {
        return {
            code: 404,
            data: MESSAGES.cardano.poolNotFound
        }
    }

    if (typeof (response.data['pool_id']) !== 'undefined' && response.data['pool_id']) {
        return {
            code: 200,
            data: response.data['pool_id']
        }
    }

    return {
        code: 404,
        data: MESSAGES.cardano.poolNotFound
    }
}

/**
 * Get Pool info (metadata) by stake_address or address
 * @param {string} address stake_address or address
 * @param {object} options same options in cardanoAccountInformation
 * @returns 
 */
export const cardanoPoolInfoByAddress = async (address, options = {}) => {
    const {
        blockfrost_id = null, network = 1
    } = options

    let response, data

    try {
        response = await cardanoPoolIdByAddress(address, options)
    } catch (error) {
        return {
            code: 404,
            data: MESSAGES.cardano.poolNotFound
        }
    }

    if (response.code == 200) {
        if (!blockfrost_id) {
            response = await koiosRequest(`pool_info`, {
                network: network,
                body: {
                    _pool_bech32_ids: [
                        response.data
                    ]
                },
                method: 'POST'
            })
            data = response.data

            return {
                code: 200,
                data: {
                    pool_id_bech32: data.pool_id_bech32 || null,
                    pool_id_hex: data.pool_id_hex || null,
                    homepage: data.meta_json.homepage || null,
                    name: data.meta_json.name || null,
                    description: data.meta_json.description || null,
                    ticker: data.meta_json.ticker || null,
                }
            }

        } else {
            response = await blockFrostRequest(`pools/${response.data}/metadata`, {
                blockfrost_id: blockfrost_id,
                network: network
            })
            data = response.data

            return {
                code: 200,
                data: {
                    pool_id_bech32: data.pool_id || null,
                    pool_id_hex: data.hex || null,
                    homepage: data.homepage || null,
                    name: data.name || null,
                    description: data.description || null,
                    ticker: data.ticker || null
                }
            }
        }
    }

    return {
        code: 404,
        data: MESSAGES.cardano.poolNotFound
    }
}

/**
 * Get information from latest epoch, including parameters and data from the last block. 
 * @param {object} options same options in cardanoAccountInformation
 * @returns 
 */
export const cardanoLatestEpoch = async (options = {}) => {
    const {
        blockfrost_id = null, network = 1
    } = options

    try {
        if (!blockfrost_id) {
            let tip = await koiosRequest(`tip`, {
                network: network,
            })
            let epoch = await koiosRequest(`epoch_info?_epoch_no=${tip.data.epoch}`, {
                network: network,
            })
            let parameters = await koiosRequest(`epoch_params?_epoch_no=${tip.data.epoch}`, {
                network: network,
            })

            epoch = epoch.data
            parameters = parameters.data

            return {
                code: 200,
                data: {
                    epoch: epoch.epoch_no,
                    first_block_time: new Date(epoch.first_block_time).getTime(),
                    last_block_time: new Date(epoch.last_block_time).getTime(),
                    block_count: epoch.blk_count,
                    tx_count: epoch.tx_count,
                    output: epoch.out_sum,
                    fees: epoch.fees,
                    active_stake: epoch.active_stake,
                    parameters: {
                        from_origin_request: parameters,
                        to_transaction: {
                            linearFee: {
                                minFeeA: parameters.min_fee_a.toString(),
                                minFeeB: parameters.min_fee_b.toString(),
                            },
                            minUtxo: parameters.min_utxo_value.toString(),
                            poolDeposit: parameters.pool_deposit.toString(),
                            keyDeposit: parameters.key_deposit.toString(),
                            coinsPerUtxoWord: parameters.coins_per_utxo_word.toString(),
                            maxValSize: parameters.max_val_size.toString(),
                            priceMem: parameters.price_mem,
                            priceStep: parameters.price_step,
                            maxTxSize: parseInt(parameters.max_tx_size),
                            slot: parseInt(tip.data.abs_slot),
                        }
                    }
                }
            }
        } else {
            let epoch = await blockFrostRequest(`epochs/latest`, {
                blockfrost_id: blockfrost_id,
                network: network
            })
            let block = await blockFrostRequest(`blocks/latest`, {
                blockfrost_id: blockfrost_id,
                network: network
            })
            let parameters = await blockFrostRequest(`epochs/latest/parameters`, {
                blockfrost_id: blockfrost_id,
                network: network
            })

            epoch = epoch.data
            block = block.data
            parameters = parameters.data

            return {
                code: 200,
                data: {
                    epoch: epoch.epoch,
                    first_block_time: epoch.first_block_time,
                    last_block_time: epoch.last_block_time,
                    block_count: epoch.block_count,
                    tx_count: epoch.tx_count,
                    output: epoch.output,
                    fees: epoch.fees,
                    active_stake: epoch.active_stake,
                    parameters: {
                        from_origin_request: parameters,
                        to_transaction: {
                            linearFee: {
                                minFeeA: parameters.min_fee_a.toString(),
                                minFeeB: parameters.min_fee_b.toString(),
                            },
                            minUtxo: parameters.min_utxo || '1000000',
                            poolDeposit: parameters.pool_deposit,
                            keyDeposit: parameters.key_deposit,
                            coinsPerUtxoWord: parameters.coins_per_utxo_word,
                            maxValSize: parameters.max_val_size,
                            priceMem: parameters.price_mem,
                            priceStep: parameters.price_step,
                            maxTxSize: parseInt(parameters.max_tx_size),
                            slot: parseInt(block.slot),
                        }
                    }
                }
            }
        }
    } catch (error) {
        return {
            code: 404,
            data: MESSAGES.cardano.epochError
        }
    }
}

/**
 * Get information about Protocol Parameters based on last epoch and block
 * @param {object} options same options in cardanoAccountInformation
 * @returns 
 */
export const cardanoProtocolParameters = async (options = {}) => {
    let latestEpoch = await cardanoLatestEpoch(options)

    if (!latestEpoch || typeof (latestEpoch.data.parameters) === 'undefined' || latestEpoch.code == 404) {
        return {
            code: 404,
            data: MESSAGES.cardano.epochError
        }
    }

    return {
        code: 200,
        data: latestEpoch.data.parameters
    }
}

/**
 * 
 * @param {string} unit Concatenation of the policy_id and hex-encoded asset_name
 * @param {object} options blockfrost_id if use Blockfrost, network 0 for testnet and 1 mainnet
 */
export const cardanoAssetInfoByUnit = async (unit, options = {}) => {
    let response
    let asset_policy = unit.slice(0, 56)
    let asset_name = unit.slice(56)

    if (!getBlockfrostId(options)) {
        response = await koiosRequest(`asset_info?_asset_policy=${asset_policy}&_asset_name=${asset_name}`, {
            network: getCardanoRequestNetwork(options),
        })

        if (response.code != 200 || response.length <= 0 || typeof (response.data.policy_id) === "undefined") {
            return {
                code: 404,
                data: MESSAGES.cardano.assetNotFound
            }
        }

        let data = response.data

        return {
            code: 200,
            data: {
                unit: data.policy_id + data.asset_name,
                policy_id: data.policy_id,
                asset_name: data.asset_name,
                fingerprint: data.fingerprint,
                quantity: data.total_supply,
                metadata: data.token_registry_metadata || data.minting_tx_metadata['json'] || null
            }
        }
    } else {
        response = await blockFrostRequest(`assets/${unit}`, {
            blockfrost_id: getBlockfrostId(options),
            network: getCardanoRequestNetwork(options)
        })

        if (response.code != 200) {
            return {
                code: 404,
                data: MESSAGES.cardano.assetNotFound
            }
        }

        let data = response.data

        return {
            code: 200,
            data: {
                unit: data.asset,
                policy_id: data.policy_id,
                asset_name: data.asset_name,
                fingerprint: data.fingerprint,
                quantity: data.quantity,
                metadata: data.metadata || data.onchain_metadata || null
            }
        }
    }
}

/**
 * Get transaction info by tx_hash
 * @param {string} tx transaction hash
 * @param {object} options same options in cardanoAccountInformation
 * @returns 
 */
export const cardanoTx = async (tx, options = {}) => {
    let response, data

    if (!getBlockfrostId(options)) {
        response = await koiosRequest(`tx_info`, {
            network: getCardanoRequestNetwork(options),
            body: {
                _tx_hashes: [
                    tx
                ]
            },
            method: 'POST'
        })
        data = response.data
    } else {
        response = await blockFrostRequest(`txs/${tx}`, {
            blockfrost_id: getBlockfrostId(options),
            network: getCardanoRequestNetwork(options)
        })
        data = response.data
    }

    if (typeof (response.data) !== "object" || (typeof (response.data) === "object" && response.data.length <= 0)) {
        return {
            code: 404,
            data: 'Transaction not found.'
        }
    }

    return {
        code: 200,
        data: {
            info: data,
            explorers: {
                cardano: CARDANO_EXPLORER[getCardanoRequestNetwork(options)] + tx,
                cardanoscan: CARDANO_EXPLORER_CARDANOSCAN[getCardanoRequestNetwork(options)] + tx,
                adaex: CARDANO_EXPLORER_ADAEX[getCardanoRequestNetwork(options)] + tx,
            }
        }
    }
}

/**
 * Verify if transaction was created
 * @param {string} tx transaction hash
 * @param {object} options same options in cardanoAccountInformation
 * @returns 
 */
export const cardanoVerifyTxCreated = async (tx, options = {}) => {
    let transaction = await cardanoTx(tx, options)
    if (transaction.code == 200) {
        return true;
    }

    return false
}

/**
 * Verify if transaction was created
 * @param {string} tx transaction hash
 * @param {object} options same options in cardanoAccountInformation
 * @returns 
 */
export const cardanoVerifyTxCreatedEvery = async (tx, options = {}) => {
    let {
        seconds = 20, tries = null
    } = options

    if (seconds < 20) {
        return {
            code: 404,
            data: 'For security, minimum value for seconds option is 20'
        }
    }

    let nowTries = 0
    return new Promise(async (resolve) => {
        let transaction = await cardanoTx(tx, options)

        if (!tries) tries = 45

        const interval = setInterval(async () => {
            nowTries++

            if (transaction.code == 200 || nowTries >= tries) {
                clearInterval(interval)
                resolve({
                    code: transaction.code,
                    data: transaction.code == 200 ? {
                        created: transaction.code == 200 ? true : false,
                        info: transaction.code == 200 ? transaction.data.info : null,
                        explorers: transaction.code == 200 ? transaction.data.explorers : null,
                    } : null
                })
            }

        }, transaction.code == 200 ? 1 : seconds * 1000)
    })
}

/**
 * Get all assets from wallet selected
 * @param {string} wallet nami, ccvault, flint, gero, typhon, cardwallet, yoroi
 * @returns mixed
 */
export const walletCardanoAssets = async (wallet) => {
    let assets
    try {
        assets = await walletUtils.getNfts(wallet)
    } catch (error) {
        return {
            code: 404,
            data: error.info || error.message || 'Assets not found.'
        }
    }

    if (assets && assets.length > 0) {
        return {
            code: 200,
            data: assets
        }
    }

    return {
        code: 404,
        data: 'Assets not found on wallet: ' + wallet
    }
}

/**
 * Search assets inside wallet selected
 * @param {string} wallet nami, ccvault, flint, gero, typhon, cardwallet, yoroi
 * @param {string} query data to be fetched, using % at the start will search for any record that contains the data
 * @param {string} query name of column to be searched: token, asset_hex, asset_name, policy_id
 * @returns mixed
 */
export const walletCardanoSearchAssets = async (wallet, query, type = "policy_id") => {
    let assets
    try {
        assets = await walletUtils.searchNft(wallet)
    } catch (error) {
        return {
            code: 404,
            data: error.info || error.message || 'Asset not found.'
        }
    }

    if (assets && assets.length > 0) {
        return {
            code: 200,
            data: assets
        }
    }

    return {
        code: 404,
        data: 'Asset not found on wallet: ' + wallet
    }
}

/**
 * Get only one change address from wallet selected.
 * @param {string} wallet nami, ccvault, flint, gero, typhon, cardwallet, yoroi
 * @returns object
 */
export const walletCardanoChangeAddress = async (wallet) => {
    try {
        let address = await walletUtils.getChangeAddressString(wallet)

        if (!address) {
            throw 'No address found for this wallet.'
        }

        return {
            code: 200,
            data: address
        }
    } catch (error) {
        return {
            code: 404,
            data: error.info || error.message || error
        }
    }
}

/**
 * Get only one unused address from wallet selected.
 * @param {string} wallet nami, ccvault, flint, gero, typhon, cardwallet, yoroi
 * @returns object
 */
export const walletCardanoUnusedAddress = async (wallet) => {
    try {
        let address = await walletUtils.getUnusedAddressString(wallet)

        if (!address) {
            throw 'No address found for this wallet.'
        }

        return {
            code: 200,
            data: address
        }
    } catch (error) {
        return {
            code: 404,
            data: error.info || error.message || error
        }
    }
}

/**
 * Get only one reward address from wallet selected.
 * @param {string} wallet nami, ccvault, flint, gero, typhon, cardwallet, yoroi
 * @returns object
 */
export const walletCardanoRewardAddress = async (wallet) => {
    try {
        let address = await walletUtils.getRewardAddressString(wallet)

        if (!address) {
            throw 'No address found for this wallet.'
        }

        return {
            code: 200,
            data: address
        }
    } catch (error) {
        return {
            code: 404,
            data: error.info || error.message || error
        }
    }
}

/**
 * Get network name from wallet selected.
 * @param {string} wallet nami, ccvault, flint, gero, typhon, cardwallet, yoroi
 * @returns object
 */
export const walletCardanoNetworkName = async (wallet) => {
    try {
        let network = await walletUtils.getNetworkString(wallet)

        if (!network) {
            throw 'No network found for this wallet.'
        }

        return {
            code: 200,
            data: network
        }
    } catch (error) {
        return {
            code: 404,
            data: error.info || error.message || error
        }
    }
}

/**
 * Get network ID from wallet selected.
 * @param {string} wallet nami, ccvault, flint, gero, typhon, cardwallet, yoroi
 * @returns object
 */
export const walletCardanoNetworkId = async (wallet) => {
    try {
        let network = await walletUtils.getNetworkId(wallet)

        if (network !== 0 && network !== 1) {
            throw 'No network found for this wallet.'
        }

        return {
            code: 200,
            data: network
        }
    } catch (error) {
        return {
            code: 404,
            data: error.info || error.message || error
        }
    }
}

/**
 * Returns network uptime information in %
 * @param {object} options 
 * @returns 
 */
export const cardanoHealth = async (options = {}) => {
    return await artRequest('?art-action=cardano-health', options)
}

export {
    cardanoMakeSimpleTransaction,
    cardanoMakeMultipleTransaction
} from './transaction'