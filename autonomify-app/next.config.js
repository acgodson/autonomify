/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle optional wagmi connector peer dependencies that aren't installed
    const optionalPeers = [
      'porto/internal',
      'porto',
      '@safe-global/safe-apps-sdk',
      '@safe-global/safe-apps-provider',
      '@coinbase/wallet-sdk',
      '@walletconnect/ethereum-provider',
      '@base-org/account',
    ]

    optionalPeers.forEach((mod) => {
      config.resolve.alias[mod] = false
    })

    // Fallback for these modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
      }
      optionalPeers.forEach((mod) => {
        config.resolve.fallback[mod] = false
      })
    }

    return config
  },
}

module.exports = nextConfig
