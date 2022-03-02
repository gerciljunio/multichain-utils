import {
    ethereumRequest,
    httpGet
} from '../requests'

import {
    MESSAGES,
    ETHEREUM_EXPLORER
} from '../config'

export const ethereumTx = async (tx, options = {}) => {
    let url = ethereumRequest(options)
    
    let transaction = await httpGet(`${url}`, {
        method: 'POST',
        body: {
            jsonrpc: '2.0',
            method: 'eth_getTransactionByHash',
            params: [
                tx
            ],
            id: 1
        }
    })

    if (typeof(transaction.data.error) !== 'undefined') {
        return {
            code: 404,
            data: transaction.data.error.message
        }
    }

    return {
        code: 200,
        data: {
            info: transaction.data.result,
            explorers: {
                etherscan: ETHEREUM_EXPLORER[0] + tx,
            }
        }
    }
}

export const ethereumVerifyTxCreated = async (tx, options = {}) => {
    let transaction = await ethereumTx(tx, options)
    if (transaction.code == 200) {
        return true;
    }

    return false
}

export const ethereumVerifyTxCreatedEvery = async (tx, options = {}) => {
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
        let transaction = await ethereumTx(tx, options)

        if (!tries) tries = 45

        const interval = setInterval(async () => {
            nowTries++

            if (transaction.code == 200 || nowTries >= tries) {
                clearInterval(interval)
                resolve({
                    code: transaction.code,
                    data: transaction.code == 200 ? {
                        created: transaction.code == 200 ? true : false,
                        info: transaction.code == 200 ? transaction.data : null,
                        explorers: transaction.code == 200 ? transaction.data.explorers : null,
                    } : null
                })
            }

        }, transaction.code == 200 ? 1 : seconds * 1000)
    })
}

export const polygonTx = async (tx, options = {}) => {
    return {
        code: 404,
        data: MESSAGES.onlyGlobalCardanoEthereumForNow
    }
}

export const polygonVerifyTxCreated = async (tx, options = {}) => {
    return {
        code: 404,
        data: MESSAGES.onlyGlobalCardanoEthereumForNow
    }
}

export const polygonVerifyTxCreatedEvery = async (tx, options = {}) => {
    return {
        code: 404,
        data: MESSAGES.onlyGlobalCardanoEthereumForNow
    }
}

export const bscTx = async (tx, options = {}) => {
    return {
        code: 404,
        data: MESSAGES.onlyGlobalCardanoEthereumForNow
    }
}

export const bscVerifyTxCreated = async (tx, options = {}) => {
    return {
        code: 404,
        data: MESSAGES.onlyGlobalCardanoEthereumForNow
    }
}

export const bscVerifyTxCreatedEvery = async (tx, options = {}) => {
    return {
        code: 404,
        data: MESSAGES.onlyGlobalCardanoEthereumForNow
    }
}