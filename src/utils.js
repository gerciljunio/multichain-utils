import {
    Buffer
} from 'buffer'

export const timerWait = async (ms = null) => {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            clearTimeout(timer)
            resolve(true)
        }, ms || 300)
    })
}

export const fetchWithTimeout = (url, options, timeout = 7000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeout)
        )
    ]);
}

export const endsWithAny = (arr, string) => {
    return arr.some(function (suffix) {
        return string.endsWith(suffix);
    });
};

export const getBlockfrostId = (options = {}) => {
    if (typeof(options.blockfrost_id) === 'undefined' || !options.blockfrost_id) {
        return null
    }

    return options.blockfrost_id
};

export const getTangocryptoId = (options = {}) => {
    if (typeof(options.tangocrypto_id) === 'undefined' || !options.tangocrypto_id) {
        return null
    }

    return options.tangocrypto_id
};

export const getTangocryptoKey = (options = {}) => {
    if (typeof(options.tangocrypto_key) === 'undefined' || !options.tangocrypto_key) {
        return null
    }

    return options.tangocrypto_key
};

export const getCardanoRequestNetwork = (options = {}) => {
    if (typeof(options.network) === 'undefined' || options.network !== 0 || options.network === 1) {
        return 1
    }

    return 0
};

export const convertStringToHex = (string) => {
    return Buffer.from(string).toString('hex')
};

export const objectIsArray = (object) => {
    return (Object.prototype.toString.call(object) === '[object Array]')
};

export const objectIsGenuine = (object) => {
    return (Object.prototype.toString.call(object) === '[object Object]')
};

export const isValidHttpUrl = (string) => {
    let url;

    try {
        url = new URL(string);
    } catch (_) {
        return false;  
    }

    return url.protocol === "http:" || url.protocol === "https:";
}