export const NETWORKS = {
  "arabica-10": {
    coreIp: "consensus-validator.celestia-arabica-10.com" as const,
    network: "arabica" as const,
    usefulLinks: [
      {
        name: "Faucet",
        url: "https://faucet.celestia-arabica-10.com",
        text: "https://faucet.celestia-arabica-10.com",
      },
      {
        name: "Block Explorer",
        url: "https://explorer.celestia-arabica-10.com",
        text: "https://explorer.celestia-arabica-10.com",
      },
    ],
  },
  "mocha-4": {
    coreIp: "rpc-mocha.pops.one" as const,
    network: "mocha" as const,
    usefulLinks: [
      {
        name: "Faucet",
        url: "https://discord.com/invite/YsnTPcSfWQ",
        text: "Join Celestia's Discord Channel",
      },
      {
        name: "Block Explorer",
        url: "https://celestia.explorers.guru",
        text: "https://celestia.explorers.guru",
      },
    ],
  },
};
