import * as WAValidator from 'multicoin-address-validator'

import {
    UNSTOPPABLEDOMAINS,
    IPFS_GATEWAYS,
    CARDANO_WALLETS,
    ETHEREUM_WALLETS,
    SOLANA_WALLETS,
    MESSAGES,
    CHAINS
} from './config'

import {
    artRequest,
    artAssetRequest,
    web3Request,
    unstoppableRequestAddress,
    unstoppableRequestIpfsHash
} from './requests'

import {
    endsWithAny,
} from './utils'

import {
    cardanoMakeSimpleTransaction,
    cardanoMakeMultipleTransaction,
    cardanoTx,
    cardanoVerifyTxCreated,
    cardanoVerifyTxCreatedEvery
} from './cardano'

import * as ethereumUtils from './ethereum'
import * as solanaUtils from './solana'

/**
 * Get ETH address from Resolver
 * @param {string} art 
 * @param {object} options
 * @returns object
 */
export const getEth = async (art, options = {}) => {
    // if it is default ETH address
    if (WAValidator.validate(art, 'eth')) {
        return {
            code: 200,
            data: art
        };
    }

    // If UNSTOPPABLE DOMAINS
    if (endsWithAny(UNSTOPPABLEDOMAINS, art)) {
        try {
            let address = await unstoppableRequestAddress(art, 'ETH')
            if (address) {
                return {
                    code: 200,
                    data: address
                };
            } else {
                return {
                    code: 404,
                    data: 'Record not found for Unstoppable Domain'
                };
            }
        } catch (error) {
            return {
                code: 404,
                data: error.info || error.message || error.data.message || 'Record not found for Unstoppable Domain'
            };
        }
    }

    // If ENS
    if (art.endsWith('.eth')) {
        let ens = await getEns(art, options)
        if (ens.code == 200) {
            return {
                code: ens.code,
                data: ens.data
            }
        } else {
            return {
                code: ens.code,
                data: 'Record not found for ENS address'
            }
        }
    }

    return await artAssetRequest('eth', art, options)
}

/**
 * Get BSC address from Resolver
 * @param {string} art 
 * @param {object} options
 * @returns object
 */
export const getBsc = async (art, options = {}) => {
    // if it is default BSC address
    if (WAValidator.validate(art, 'bnb')) {
        return {
            code: 200,
            data: art
        };
    }

    return await artAssetRequest('bsc', art, options)
}

/**
 * Get SOL address from Resolver
 * @param {string} art 
 * @param {object} options
 * @returns 
 */
export const getSol = async (art, options = {}) => {
    // if it is default SOL address
    if (WAValidator.validate(art, 'sol')) {
        return {
            code: 200,
            data: art
        };
    }

    return await artAssetRequest('sol', art, options)
}

/**
 * Get MATIC address from Resolver
 * @param {string} art 
 * @param {object} options
 * @returns object
 */
export const getMatic = async (art, options = {}) => {
    // if it is default MATIC address
    if (WAValidator.validate(art, 'matic')) {
        return {
            code: 200,
            data: art
        };
    }

    return await artAssetRequest('matic', art, options)
}

/**
 * Get IPFS HASH
 * @param {string} art 
 * @param {object} options url = if true return hash with url, for ENS use infura_id or alchemy_id
 * @returns object
 */
export const getIpfsHash = async (art, options = {}) => {
    const { url = null } = options

    // If UNSTOPPABLE DOMAINS
    if (endsWithAny(UNSTOPPABLEDOMAINS, art)) {
        try {
            let udIpfsHash = await unstoppableRequestIpfsHash(art)
            if (udIpfsHash) {
                return {
                    code: 200,
                    data: url ? IPFS_GATEWAYS[url] + '/' + udIpfsHash : udIpfsHash
                };
            } else {
                return {
                    code: 404,
                    data: 'Record not found for Unstoppable Domain'
                };
            }
        } catch (error) {
            return {
                code: 404,
                data: error.info || error.message || error.data.message || 'Record not found for Unstoppable Domain'
            };
        }
    }

    // If ENS
    if (art.endsWith('.eth')) {
        try {
            const web3 = web3Request(options)
            let { protocolType = null, decoded = null } = await web3.eth.ens.getContenthash(art)
            if (protocolType == 'ipfs' && decoded) {
                return {
                    code: 200,
                    data: url ? IPFS_GATEWAYS[url] + '/' + decoded : decoded
                };
            }
        } catch (error) {
            return {
                code: 404,
                data: typeof(error) == 'string' ? error : 'Record not found for ENS address'
            };
        }
    }

    let hash = await artAssetRequest('ipfs_hash', art, options)
    return url ? IPFS_GATEWAYS[url] + '/' + hash : hash
}

/**
 * Get IPFS URL
 * @param {string} art 
 * @param {string} provider pinata, cloudflare, ipfs
 * @param {object} options 
 * @returns 
 */
export const getIpfsUrl = async (art, options = {}) => {
    const { provider = 'cloudflare' } = options

    return await getIpfsHash(art, Object.assign(options, {
        url: provider
    }))
}

/**
 * Get Resolvers supported by Adanize Resolver Tool (ART)
 * @param {object} options
 * @returns object
 */
export const getAdanizeResolvers = async (options = {}) => {
    return await artRequest('?art-action=resolvers', options)
}

/**
 * Get all Adanize Domains
 * @param {object} options
 * @returns object
 */
export const getAdanizeDomains = async (options = {}) => {
    return await artRequest('', options)
}

/**
 * Get ENS address from Resolver
 * @param {string} domain
 * @param {object} options
 * @returns object
 */
 export const getEns = async (domain, options = {}) => {
    // if it is default ETH address
    if (WAValidator.validate(domain, 'eth')) {
        return {
            code: 200,
            data: domain
        };
    }

    if (!domain.endsWith('.eth')) {
        return {
            code: 404,
            data: 'Domain must end with .eth.'
        }
    }

    try {
        const web3 = web3Request(options)
        let address = await web3.eth.ens.getAddress(domain)

        if (!address || address == '0x0000000000000000000000000000000000000000') {
            return {
                code: 404,
                data: `Domain ${domain} not found.`
            }
        }

        return {
            code: 200,
            data: address
        }
    } catch (error) {
        return {
            code: 404,
            data: error
        }
    }
}

/**
 * Detect model chain by address
 * @param {string} addr
 * @param {string} ethTarget
 * @returns object
 */
export const detectModelChainByAsset = (addr, ethTarget = null) => {
    if (WAValidator.validate(addr, 'ada')) {
        return {
            address: addr,
            model: 'ada'
        };

    } else if(WAValidator.validate(addr, 'eth')) {
        // If ethTarget is null and detects a valid address it will always return ETH
        // If necessary you can use BSC or MATIC only for reference in the return according to your usage
        return {
            address: addr,
            model: ethTarget || 'eth'
        };

    } else if(WAValidator.validate(addr, 'sol')) {
        return {
            address: addr,
            model: 'sol'
        };

    } else {
        return {
            address: null,
            model: 'No model chain detected'
        };
    }
}

/**
 * Extend WAValidator pack
 * https://github.com/christsim/multicoin-address-validator
 * @param {string} addr
 * @returns 
 */
export const addressValidator = (addr, currency, network = null) => {
    if (network) {
        if (WAValidator.validate(addr, currency, network)) {
            return true;
        } else {
            return false;
        }
    } else {
        if (WAValidator.validate(addr, currency)) {
            return true;
        } else {
            return false;
        }
    }
}

/**
 * Make simples transactions from wallets in multiple networks
 * @param {string} wallet 
 * @param {object} params
 * @param {object} options 
 */
export const walletSimpleTransaction = async (wallet, {
    address,
    amount = 0,
    assets = [],
    metadata = null,
    metadataLabel = '721'
}, options = {}) => {
    if (CARDANO_WALLETS.includes(wallet)) {
        return await cardanoMakeSimpleTransaction(wallet, {
            address: address,
            amount: amount,
            assets: assets,
            metadata: metadata,
            metadataLabel: metadataLabel
        }, options)

    } else if (ETHEREUM_WALLETS.includes(wallet)) {
        return {
            code: 404,
            data: MESSAGES.cardano.onlyCardanoForNow
        }
    } else if (SOLANA_WALLETS.includes(wallet)) {
        return {
            code: 404,
            data: MESSAGES.cardano.onlyCardanoForNow
        }
    } else {
        return {
            code: 404,
            data: MESSAGES.cardano.onlyCardanoForNow
        }
    }
}

/**
 * Make multiple transactions (when supported) from wallets in multiple networks
 * @param {string} wallet 
 * @param {object} params
 * @param {object} options 
 */
export const walletMultipleTransaction = async (wallet, {
    recipients,
    metadata = null,
    metadataLabel = '721'
}, options = {}) => {
    if (CARDANO_WALLETS.includes(wallet)) {
        return await cardanoMakeMultipleTransaction(wallet, {
            recipients: recipients,
            metadata: metadata,
            metadataLabel: metadataLabel
        }, options)

    } else if (ETHEREUM_WALLETS.includes(wallet)) {
        return {
            code: 404,
            data: MESSAGES.cardano.onlyCardanoForNow
        }
    } else if (SOLANA_WALLETS.includes(wallet)) {
        return {
            code: 404,
            data: MESSAGES.cardano.onlyCardanoForNow
        }
    } else {
        return {
            code: 404,
            data: MESSAGES.cardano.onlyCardanoForNow
        }
    }
}

/**
 * 
 * @param {*} chain cardano, ethereum, bsc, polygon, solana
 * @param {*} options 
 * @returns 
 */
 export const getTx = async (tx, chain = 'cardano', options = {}) => {
    if (chain == 'cardano') {
        // options: blockfrost_id if use Blockfrost, network 0 for testnet and 1 mainnet
        return await cardanoTx(tx, options)

    } else if (chain == 'ethereum') {
        return await ethereumUtils.ethereumTx(tx, options)

    } else if (chain == 'bsc') {
        return await ethereumUtils.bscTx(tx, options)

    } else if (chain == 'polygon') {
        return await ethereumUtils.polygonTx(tx, options)

    } else if (chain == 'solana') {
        return await solanaUtils.solanaTx(tx, options)

    } else {
        return {
            code: 404,
            data: MESSAGES.chainNotFound
        }
    }
}

/**
 * 
 * @param {*} chain cardano, ethereum, bsc, polygon, solana
 * @param {*} options 
 * @returns 
 */
 export const verifyTxCreated = async (tx, chain = 'cardano', options = {}) => {
    if (chain == 'cardano') {
        // options: blockfrost_id if use Blockfrost, network 0 for testnet and 1 mainnet
        return await cardanoVerifyTxCreated(tx, options)

    } else if (chain == 'ethereum') {
        return await ethereumUtils.ethereumVerifyTxCreated(tx, options)

    } else if (chain == 'bsc') {
        return await ethereumUtils.bscVerifyTxCreated(tx, options)

    } else if (chain == 'polygon') {
        return await ethereumUtils.polygonVerifyTxCreated(tx, options)

    } else if (chain == 'solana') {
        return await solanaUtils.solanaVerifyTxCreated(tx, options)

    } else {
        return {
            code: 404,
            data: MESSAGES.chainNotFound
        }
    }
}

/**
 * 
 * @param {*} chain cardano, ethereum, bsc, polygon, solana
 * @param {*} options 
 * @returns 
 */
 export const verifyTxCreatedEvery = async (tx, chain = 'cardano', options = {}) => {
    if (chain == 'cardano') {
        // options: blockfrost_id if use Blockfrost, network 0 for testnet and 1 mainnet
        return await cardanoVerifyTxCreatedEvery(tx, options)

    } else if (chain == 'ethereum') {
        return await ethereumUtils.ethereumVerifyTxCreatedEvery(tx, options)

    } else if (chain == 'bsc') {
        return await ethereumUtils.bscVerifyTxCreatedEvery(tx, options)

    } else if (chain == 'polygon') {
        return await ethereumUtils.polygonVerifyTxCreatedEvery(tx, options)

    } else if (chain == 'solana') {
        return await solanaUtils.solanaVerifyTxCreatedEvery(tx, options)

    } else {
        return {
            code: 404,
            data: MESSAGES.chainNotFound
        }
    }
}

export * from './wallets'
export * from './cardano'