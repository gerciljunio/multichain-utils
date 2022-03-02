import * as walletUtils from 'adanize-wallet-utils'

/**
 * Get instance from wallet selected
 * @param {string} wallet Cardano (nami, ccvault, flint, gero, typhon, cardwallet, yoroi), Ethereum (metamask), Solana (phantom, solflare)
 * @returns mixed
 */
export const walletInstance = async (wallet) => {
    try {
        let instance = await walletUtils.extend(wallet)
        return {
            code: 200,
            data: instance
        }
    } catch (error) {
        return {
            code: 404,
            data: error.info || error.message || error
        }
    }
}

/**
 * Get address from wallet selected
 * @param {string} wallet Cardano (nami, ccvault, flint, gero, typhon, cardwallet, yoroi), Ethereum (metamask), Solana (phantom, solflare)
 * @param {object} options ethereumChain: eth, bsc or matic / ethereumGetAllAddresses: if true, return all, if false, only one
 * @returns object
 */
export const walletUsedAddress = async (wallet, options = {}) => {
    try {
        let address = await walletUtils.getUsedAddressString(wallet, options)

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