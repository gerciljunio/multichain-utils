import {
    MESSAGES
} from '../config'

export const solanaTx = async (tx, options = {}) => {
    return {
        code: 404,
        data: MESSAGES.onlyGlobalCardanoEthereumForNow
    }
}

export const solanaVerifyTxCreated = async (tx, options = {}) => {
    return {
        code: 404,
        data: MESSAGES.onlyGlobalCardanoEthereumForNow
    }
}

export const solanaVerifyTxCreatedEvery = async (tx, options = {}) => {
    return {
        code: 404,
        data: MESSAGES.onlyGlobalCardanoEthereumForNow
    }
}