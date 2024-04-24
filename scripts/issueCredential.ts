import { Actor, HttpAgent } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";

// Define the interface for the canister
const canisterIdl = ({ IDL }) => {
    return IDL.Service({
        whoami: IDL.Func([], [IDL.Principal], ["query"]),
        add_credential: IDL.Func([IDL.Principal, IDL.Vec(IDL.Record({
            id: IDL.Text,
            type_: IDL.Vec(IDL.Text),
            context: IDL.Vec(IDL.Text),
            issuer: IDL.Text,
            claim: IDL.Vec(IDL.Record({
                claims: IDL.Vec(IDL.Record({
                    key: IDL.Text,
                    value: IDL.Variant({
                        Boolean: IDL.Bool,
                        Date: IDL.Text,
                        Text: IDL.Text,
                        Number: IDL.Int64,
                        Claim: IDL.Rec()
                    })
                }))
            }))
        }))], [IDL.Text])
    });
};

export interface CanisterService {
    whoami: () => Promise<Principal>;
    add_credential: (principal: Principal, credentials: StoredCredential[]) => Promise<string>;
}

export interface ClaimValue {
    Boolean?: boolean;
    Date?: string;
    Text?: string;
    Number?: number;
    Claim?: Claim;
}

export interface Claim {
    claims: { [key: string]: ClaimValue };
}

export interface StoredCredential {
    id: string;
    type_: string[];
    context: string[];
    issuer: string;
    claim: Claim[];
}


export async function addCredential() {
    const authClient = await AuthClient.create();
    const identity = authClient.getIdentity();
    const agent = new HttpAgent({ identity });
    const canister = Actor.createActor<CanisterService>(canisterIdl, {
        agent,
        canisterId: process.env.CIVIC_CANISTER_BACKEND_ID!,
    });

    const principal = await canister.whoami();

    const credential: StoredCredential = {
        id: "http://example.edu/credentials/3732",
        type_: ["VerifiableCredential", "VerifiedAdult"],
        context: ["https://www.w3.org/2018/credentials/v1", "https://www.w3.org/2018/credentials/examples/v1"],
        issuer: "https://civic.com",
        claim: [{
            claims: {
                "Is over 18": { Boolean: true }
            }
        }]
    };

    const response = await canister.add_credential(principal, [credential]);
    console.log("Credential added:", response);
}

async function main() {
    try {
        await addCredential();
    } catch (error) {
        console.error("Error in main execution:", error);
    }
}

main();

