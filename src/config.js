export const CARDANO_WALLETS = [
    "nami",
    "gerowallet",
    "flint",
    "typhon",
    "ccvault",
    "cardwallet",
    "yoroi",
]

export const ETHEREUM_WALLETS = [
    "metamask",
]

export const SOLANA_WALLETS = [
    "phantom",
    "solflare",
]

export const CHAINS = [
    "cardano",
    "ethereum",
    "bsc",
    "polygon",
    "sol",
]

export const UNSTOPPABLEDOMAINS = [
    ".zil",
    ".crypto",
    ".nft",
    ".blockchain",
    ".bitcoin",
    ".coin",
    ".wallet",
    ".888",
    ".dao",
    ".x"
]

export const IPFS_GATEWAYS = {
    pinata: "https://gateway.pinata.cloud/ipfs/",
    cloudflare: "https://cloudflare-ipfs.com/ipfs/",
    ipfs: "https://ipfs.io/ipfs/",
    dweb: "https://dweb.link/ipfs/",
    cf: "https://cf-ipfs.com/ipfs/",
    astyanax: "https://astyanax.io/ipfs/",
}

export const ADAHANDLE_POLICY = {
    0: "8d18d786e92776c824607fd8e193ec535c79dc61ea2405ddf3b09fe3",
    1: "f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a",
}

export const CARDANO_EXPLORER = {
    0: "https://explorer.cardano-testnet.iohkdev.io/en/transaction?id=",
    1: "https://explorer.cardano.org/en/transaction?id="
}

export const CARDANO_EXPLORER_CARDANOSCAN = {
    0: "https://testnet.cardanoscan.io/transaction/",
    1: "https://cardanoscan.io/transaction/"
}

export const CARDANO_EXPLORER_ADAEX = {
    0: "https://testnet.adaex.org/transaction/",
    1: "https://adaex.org/transaction/"
}

export const ETHEREUM_EXPLORER = {
    0: "https://etherscan.io/tx/",
}

export const MESSAGES = {
    chainNotFound: 'Chain not found.',
    onlyGlobalCardanoEthereumForNow: 'For now, support only for Cardano and Ethereum.',
    cardano: {
        dataAccountNotFound: 'Data for this account not found, if you have never carried out any transactions with this address it is normal for this to occur. It may also be necessary to verify that the search is being performed on the correct network.',
        accountValidAddresses: 'You must enter a valid stake address or a valid default address.',
        poolNotFound: 'Stake Pool not found for this address.',
        epochError: 'There was a problem returning the epoch data, please check that you are entering the correct data.',
        assetNotFound: 'Asset not found.',
        onlyCardanoForNow: 'For now, support only for Cardano wallets: nami, gerowallet, flint, ccvault, typhon, cardwallet, yoroi',
        onlyGlobalCardanoForNow: 'For now, support only for Cardano.',
    }
}