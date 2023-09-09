import type { Datatype } from "./types";

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

type GenericMethod = {
  command: string;
  params: readonly { name: string; type: Datatype; autocomplete?: string }[];
  response: readonly { name: string; type: Datatype; autocomplete?: string }[];
};
export const METHODS = [
  {
    section: "blob",
    commands: [
      {
        command: "submit",
        params: [
          { name: "namespace", type: "hex", autocomplete: "namespace" },
          { name: "data", type: "data", autocomplete: undefined },
        ],
        response: [
          { name: "height", type: "number", autocomplete: "height" },
          { name: "commitment", type: "string", autocomplete: "commitment" },
        ],
      },
      {
        command: "get",
        params: [
          { name: "height", type: "number", autocomplete: "height" },
          { name: "namespace", type: "hex", autocomplete: "namespace" },
          { name: "commitment", type: "string", autocomplete: "commitment" },
        ],
        response: [
          { name: "namespace", type: "string", autocomplete: undefined },
          { name: "data", type: "string", autocomplete: undefined },
          { name: "share_version", type: "number", autocomplete: undefined },
          { name: "commitment", type: "string", autocomplete: "commitment" },
        ],
      },
      {
        command: "get-all",
        params: [
          { name: "height", type: "number", autocomplete: "height" },
          { name: "namespace", type: "hex", autocomplete: "namespace" },
        ],
        response: [
          { name: "namespace", type: "string", autocomplete: undefined },
          { name: "data", type: "string", autocomplete: undefined },
          { name: "share_version", type: "number", autocomplete: undefined },
          { name: "commitment", type: "string", autocomplete: "commitment" },
        ],
      },
      {
        command: "get-proof",
        params: [
          { name: "height", type: "number", autocomplete: "height" },
          { name: "namespace", type: "hex", autocomplete: "namespace" },
          { name: "commitment", type: "string", autocomplete: "commitment" },
        ],
        response: [
          { name: "start", type: "number", autocomplete: undefined },
          { name: "end", type: "number", autocomplete: undefined },
          { name: "nodes", type: "[]string", autocomplete: undefined },
          { name: "leaf_hash", type: "string", autocomplete: undefined },
          {
            name: "is_max_namespace_id_ignored",
            type: "boolean",
            autocomplete: undefined,
          },
        ],
      },
    ],
  },
  {
    section: "state",
    commands: [
      {
        command: "AccountAddress",
        params: [],
        response: [
          { name: "address", type: "string", autocomplete: "address" },
        ],
      },
      {
        command: "Balance",
        params: [],
        response: [
          { name: "denom", type: "string", autocomplete: undefined },
          { name: "amount", type: "string", autocomplete: undefined },
        ],
      },
      {
        command: "BalanceForAddress",
        params: [{ name: "address", type: "string", autocomplete: "address" }],
        response: [
          { name: "denom", type: "string", autocomplete: undefined },
          { name: "amount", type: "string", autocomplete: undefined },
        ],
      },
      {
        command: "BeginRedelegate",
        params: [
          { name: "srcValAddr", type: "string", autocomplete: "val-address" },
          { name: "dstValAddr", type: "string", autocomplete: "val-address" },
          { name: "amount", type: "number", autocomplete: undefined },
          { name: "fee", type: "number", autocomplete: undefined },
          { name: "gasLim", type: "number", autocomplete: undefined },
        ],
        response: [
          { name: "height", type: "number", autocomplete: "height" },
          { name: "txhash", type: "string", autocomplete: "txhash" },
          { name: "data", type: "string", autocomplete: undefined },
          { name: "raw_log", type: "string", autocomplete: undefined },
          { name: "logs", type: "json", autocomplete: undefined },
          { name: "gas_wanted", type: "number", autocomplete: undefined },
          { name: "gas_used", type: "number", autocomplete: undefined },
          { name: "events", type: "json", autocomplete: undefined },
        ],
      },
      {
        command: "IsStopped",
        params: [],
        response: [{ name: "value", type: "boolean", autocomplete: undefined }],
      },
    ],
  },
] as { section: string; commands: GenericMethod[] }[];
