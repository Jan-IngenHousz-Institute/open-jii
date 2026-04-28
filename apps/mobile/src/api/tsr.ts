import { initTsrReactQuery } from "@ts-rest/react-query/v5";

import { contract } from "@repo/api/contract";

import { baseClientOptions } from "./fetcher";

export const tsr = initTsrReactQuery(contract, baseClientOptions);
