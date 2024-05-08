import { HttpAgent } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import type { Principal } from "@dfinity/principal";
import {  createActor, CreateActorOptions } from "./civic_canister_backend/index";
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';

const canisterId = "asrmz-lmaaa-aaaaa-qaaeq-cai" //hardcoded civic canister id, get it using dfx canister id civic_canister_backend

// The <canisterId>.localhost URL is used as opposed to setting the canister id as a parameter
// since the latter is brittle with regards to transitively loaded resources.
const local_ii_url = `http://${process.env.INTERNET_IDENTITY_CANISTER_ID}.localhost:4943`;


let principal: Principal | undefined;

export type ClaimValue = { 'Date' : string } |
  { 'Text' : string } |
  { 'Boolean' : boolean } |
  { 'Number' : bigint } |
  { 'Claim' : Claim };

export type ClaimRecord = [string, ClaimValue];



export type Claim = {
  claims: ClaimRecord[];
};


export interface StoredCredential {
  id: string;
  type_: string[];
  context: string[];
  issuer: string;
  claim: Claim[];
}

// Autofills the <input> for the II Url to point to the correct canister.
document.body.onload = () => {
  let iiUrl;

  if (process.env.DFX_NETWORK === "local") {
    iiUrl = local_ii_url;
  } else if (process.env.DFX_NETWORK === "ic") {
    iiUrl = `https://${process.env.INTERNET_IDENTITY_CANISTER_ID}.ic0.app`;
  } else {
    // fall back to local
    iiUrl = local_ii_url;
  }
  document.querySelector<HTMLInputElement>("#iiUrl")!.value = iiUrl;
};


async function createAgentWithIdentity() {
  // secret key generated with https://github.com/krpeacock/node-identity-pem/blob/main/index.js
  const privKey = new Uint8Array( [
    73, 186, 183, 223, 243, 86,  48, 148,
   83, 221,  41,  75, 229, 70,  56,  65,
  247, 179, 125,  33, 172, 58, 152,  14,
  160, 114,  17,  22, 118,  0,  41, 243
  ]) ; 

  const identity = Secp256k1KeyIdentity.fromSecretKey(privKey);

  // Create an HttpAgent with the identity
  const agent = new HttpAgent({ identity });

  console.log('Using Civic Principal:', identity.getPrincipal().toText());

  return agent;
}


document.getElementById("loginBtn")?.addEventListener("click", async () => {
  // First we have to create and AuthClient.
  const authClient = await AuthClient.create();

  // Find out which URL should be used for login.
  const iiUrl = document.querySelector<HTMLInputElement>("#iiUrl")!.value;


  // Call authClient.login(...) to login with Internet Identity. This will open a new tab
  // with the login prompt. The code has to wait for the login process to complete.
  // We can either use the callback functions directly or wrap in a promise.
  await new Promise<void>((resolve, reject) => {
    authClient.login({
      identityProvider: iiUrl,
      derivationOrigin: `http://${canisterId}.localhost:4943`,
      onSuccess: resolve,
      onError: reject,
    });
  });

  // At this point we're authenticated, and we can get the identity from the auth client:
  const identity = authClient.getIdentity();
  principal = identity.getPrincipal();
  
  // show principal and credential button 
  document.getElementById("credentialBtn")!.style.display = 'inline';
  document.getElementById("loginStatus")!.innerText = "User Principal from Civic Canister POV: " + principal.toText();


});

document.getElementById("credentialBtn")?.addEventListener("click", async () => {

  const agent = await createAgentWithIdentity();

  const option : CreateActorOptions = {
    agent: agent, 
  }

  const civic_canister = createActor(canisterId, option);
  const id: ClaimRecord = ["id", {Text: "did:example:c276e12ec21ebfeb1f712ebc6f1"}]
  const name: ClaimRecord = ["name", {Text: "Example University"}]
  const degreeType: ClaimRecord = ["degreeType", {Text: "MBA"}]
  // Example Credential with mixed claims
  const alumniOfClaim : Claim = {
    claims: [id, name, degreeType]
  }
    
  const mixedClaim: Claim = {
    claims: [
      ["Is over 18", { Boolean: true }], 
      ["name", { Text: "Max Mustermann"}], 
      ["alumniOf", {Claim: alumniOfClaim}]
    ]
  };


  const credential: StoredCredential = {
    id: "urn:uuid:6a9c92a9-2530-4e2b-9776-530467e9bbe0",
    type_: ["VerifiableCredential", "VerifiedAdult"],
    context: ["https://www.w3.org/2018/credentials/v1", "https://www.w3.org/2018/credentials/examples/v1"],
    issuer: "https://civic.com",
    claim: [mixedClaim]
  };
  try {
    console.log("Adding a new credential", credential);
    if (principal===undefined || credential.claim === undefined) {
      throw new Error("Principal is undefined");
    }
    const credentialResponse = await civic_canister.add_credentials(principal, [credential]);

    console.log("Credential added:", credentialResponse);
    document.getElementById("credentialStatus")!.innerText = credentialResponse;
  } catch (error) {
    console.error("Error adding credential:", error);
    document.getElementById("credentialStatus")!.innerText = "Error adding credential: " + error;
  }

});
