import axios from 'axios'
import * as WAValidator from 'multicoin-address-validator'
import * as Web3 from 'web3'

const {default: Resolution} = require('@unstoppabledomains/resolution');
const resolution = new Resolution();

import {
    errorResolverNotFound
} from './errors'

import {
    timerWait,
    isValidHttpUrl,
    getBlockfrostId,
    getTangocryptoId,
    getTangocryptoKey,
    getCardanoRequestNetwork,
    objectIsArray
} from './utils'

import {
    cardanoAddressFromAdaHandle
} from './cardano'

import {
    ADAHANDLE_POLICY
} from './config'

const artDomainBase = '?art-domain='

/**
 * Requests with Axios
 * @param {string} route 
 * @param {object} options 
 * @returns 
 */
const axiosRequest = async (route, options = {}) => {
    try {
        const { headers, timeoutRequest = 10000, body = {}, method = 'GET' } = options

        let response
        if (method == 'GET') {
            response = await axios.get(route, headers ? {
                timeout: timeoutRequest,
                headers: headers,
                params: body
            } : {
                timeout: timeoutRequest,
                params: body
            })
        } else {
            response = await axios.post(route, body, headers ? {
                timeout: timeoutRequest,
                headers: headers
            } : {
                timeout: timeoutRequest
            })
        }

        return {
            code: response.status,
            data: response.data
        }
    } catch (error) {
        let err = {
            code: error.response.status || 404,
            data: error.response.data.message
        }
        return err
    }
}

/**
 * Requests with GET
 * @param {string} route 
 * @param {object} options 
 * @returns 
 */
export const httpGet = async (route, options = {}) => {
    try {
        const { timeoutMs = null } = options

        // For security reasons and to avoid excessive requests, wait 300ms before executing any request
        // You can increase or decrease this time by passing the timeoutMs key in the options 
        await timerWait(timeoutMs)

        return await axiosRequest(route, options)
    } catch (error) {
        throw {
            code: 404,
            data: 'Request problem, check parameters.'
        }
    }
}

/**
 * Blockfrost request
 * @param {string} route 
 * @param {object} options 
 * @returns 
 */
export const blockFrostRequest = async (route, options = {}) => {    
    let networkSelected = options.network === 0 ? 'testnet' : 'mainnet'
    delete options.network

    if (typeof(options.blockfrost_id) === 'undefined' || !options.blockfrost_id) {
        throw 'blockfrost_id not found'
    }

    let endpoint_mainnet = `https://cardano-mainnet.blockfrost.io/api/v0`
    let endpoint_testnet = `https://cardano-testnet.blockfrost.io/api/v0`

    if (typeof(options.cardano_endpoint_mainnet) !== 'undefined' && isValidHttpUrl(options.cardano_endpoint_mainnet)) {
        endpoint_mainnet = options.cardano_endpoint_mainnet
    }

    if (typeof(options.cardano_endpoint_testnet) !== 'undefined' && isValidHttpUrl(options.cardano_endpoint_testnet)) {
        endpoint_testnet = options.cardano_endpoint_testnet
    }

    let response
    
    if (networkSelected == 0) {
        response = await httpGet(`${endpoint_testnet}/${route}`, {
            headers: {
                'project_id' : options.blockfrost_id
            }
        })
    } else {
        response = await httpGet(`${endpoint_mainnet}/${route}`, {
            headers: {
                'project_id' : options.blockfrost_id
            }
        })
    }

    return {
        code: response.code,
        data: response.data[0] || response.data
    }
}

/**
 * Tangocrypto request
 * @param {string} route 
 * @param {object} options 
 * @returns 
 */
export const tangoCryptoRequest = async (route, options = {}) => {
    let networkSelected = options.network === 0 ? 'testnet' : 'mainnet'
    delete options.network

    if (typeof(getTangocryptoId(options)) === 'undefined' || !getTangocryptoId(options)) {
        throw 'tangocrypto_id not found'
    }

    let endpoint_mainnet = `https://cardano-mainnet.tangocrypto.com/${getTangocryptoId(options)}/v1`
    let endpoint_testnet = `https://cardano-testnet.tangocrypto.com/${getTangocryptoId(options)}/v1`

    if (typeof(options.cardano_endpoint_mainnet) !== 'undefined' && isValidHttpUrl(options.cardano_endpoint_mainnet)) {
        endpoint_mainnet = options.cardano_endpoint_mainnet
    }

    if (typeof(options.cardano_endpoint_testnet) !== 'undefined' && isValidHttpUrl(options.cardano_endpoint_testnet)) {
        endpoint_testnet = options.cardano_endpoint_testnet
    }

    let response
    if (networkSelected == 0) {
        response = await httpGet(`${endpoint_testnet}/${route}`, {
            headers: {
                'x-api-key' : getTangocryptoKey(options)
            }
        })
    } else {
        response = await httpGet(`${endpoint_mainnet}/${route}`, {
            headers: {
                'x-api-key' : getTangocryptoKey(options)
            }
        })
    }

    return {
        code: response.code,
        data: response.data[0] || response.data
    }
}

/**
 * Koios request
 * @param {string} route 
 * @returns 
 */
export const koiosRequest = async (route, options = {}) => {
    const { network = 1 } = options
    let networkSelected = network
    delete options.network

    let endpoint_mainnet = `https://api.koios.rest/api/v0`
    let endpoint_testnet = `https://testnet.koios.rest/api/v0`

    if (typeof(options.cardano_endpoint_mainnet) !== 'undefined' && isValidHttpUrl(options.cardano_endpoint_mainnet)) {
        endpoint_mainnet = options.cardano_endpoint_mainnet
    }

    if (typeof(options.cardano_endpoint_testnet) !== 'undefined' && isValidHttpUrl(options.cardano_endpoint_testnet)) {
        endpoint_testnet = options.cardano_endpoint_testnet
    }

    let response
    if (networkSelected == 0) {
        response = await httpGet(`${endpoint_testnet}/${route}`, options)
    } else {
        response = await httpGet(`${endpoint_mainnet}/${route}`, options)
    }

    let data

    if (objectIsArray(response.data) && response.data.length == 1) {
        data = response.data[0]
    } else if (objectIsArray(response.data) && response.data.length > 1) {
        data = response.data
    } else {
        data = [ response.data ]
    }

    return {
        code: response.code,
        data: data
    }
}

/**
 * Resolve Ada Handle address
 * @param {string} handle 
 * @param {object} options "blockfrost_id" for use Blockfrost API and "network" for 0 = testnet and 1 = mainnet
 * @returns 
 */
export const adaHandleRequest = async (handle, options = {}) => {
    // const { blockfrost_id = null, tangocrypto_id = null, network = 1 } = options
    
    let response

    // blockfrost
    if (getBlockfrostId(options)) {
        response = await blockFrostRequest(`assets/${ADAHANDLE_POLICY[getCardanoRequestNetwork(options)]}${handle}/addresses`, {
            blockfrost_id: getBlockfrostId(options),
            network: getCardanoRequestNetwork(options)
        })
        return response.data.address
    
    // tangocrypto
    } else if (getTangocryptoId(options)) {
        
        try {
            response = await tangoCryptoRequest(`assets/${ADAHANDLE_POLICY[getCardanoRequestNetwork(options)]}${handle}/addresses`, {
                tangocrypto_id: getTangocryptoId(options),
                tangocrypto_key: getTangocryptoKey(options),
                network: getCardanoRequestNetwork(options)
            })
            
            if (response.code == 404) {
                throw ''
            }
            
            return response.data.address || response.data.data.address || response.data.data[0].address
        } catch (error) {
            response = await koiosRequest(`asset_address_list?_asset_policy=${ADAHANDLE_POLICY[getCardanoRequestNetwork(options)]}&_asset_name=${handle}`, {
                network: getCardanoRequestNetwork(options)
            })
            return response.data.payment_address
        }

    // koios
    } else {
        response = await koiosRequest(`asset_address_list?_asset_policy=${ADAHANDLE_POLICY[getCardanoRequestNetwork(options)]}&_asset_name=${handle}`, {
            network: getCardanoRequestNetwork(options)
        })
        return response.data.payment_address
    }
}

/**
 * Request on ART API
 * @param {string} route 
 * @param {object} options 
 * @returns 
 */
export const artRequest = async (route, options = {}) => {
    let response = await httpGet(`https://app.adanize.com/resources/art/${route}`, options)
    return response
}

/**
 * Get asset data from ART API
 * @param {string} asset ADA, SOL, ETH, BSC, MATIC
 * @param {string} art 
 * @returns 
 */
export const artAssetRequest = async (asset, art, options = {}) => {
    try {
        if (WAValidator.validate(art, asset)) {
            return {
                code: 200,
                data: art
            }
        }
    } catch (error) {
    }

    let response = await artRequest(artDomainBase + encodeURIComponent(art), options)
    if (response.code == 200) {
        if (typeof(response.data.assets) !== 'undefined') {
            if (response.data.assets[asset]) {
                if (response.data.assets[asset].startsWith('$')) {
                    return await cardanoAddressFromAdaHandle(response.data.assets[asset], options)
                } else {
                    return {
                        code: 200,
                        data: response.data.assets[asset]
                    }
                }
            } else {
                return errorResolverNotFound(asset)
            }
        } else {
            return errorResolverNotFound(asset)
        }
    }

    return errorResolverNotFound(asset)
}

/**
 * Start Web3 instance with Provider
 * @param {object} options infura_id OR alchemy_id
 * @returns 
 */
 export const web3Request = (options = {}, withWeb3 = true) => {
    const { infura_id, alchemy_id, etherscan_id, params = null } = options

    let provider

    if (infura_id) {
        provider = 'https://mainnet.infura.io/v3/' + infura_id
    } else if (alchemy_id) {
        provider = 'https://eth-mainnet.alchemyapi.io/v2/' + alchemy_id
    } else if (etherscan_id && params) {
        provider = 'https://api.etherscan.io/api?' + params + '&apikey=' + etherscan_id
    } else {
        throw 'To use this method, you need to define an API ID infura_id or alchemy_id in options param.'
    }

    if (withWeb3) {
        return new Web3(provider);
    }

    return provider
}


/**
 * Start Ethereum Request URL
 * @param {object} options same web3Request
 * @returns 
 */
 export const ethereumRequest = (options = {}) => {
    return web3Request(options, false)
}


export const unstoppableRequestAddress = async (domain, currency) => {
    return await resolution.addr(domain, currency)
}


export const unstoppableRequestIpfsHash = async (domain) => {
    return await resolution.ipfsHash(domain)
}