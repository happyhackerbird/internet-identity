/* A simple civic_canister that authenticates the user with Internet Identity and that
 * then issues a credential against the user principal.
 */

import { HttpAgent } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import type { Principal } from "@dfinity/principal";
import {  createActor, CreateActorOptions } from "../../declarations/civic_canister_backend/index";

const canisterId = "bkyz2-fmaaa-aaaaa-qaaaq-cai" //hardcoded civic canister id
// process.env.CIVIC_CANISTER_BACKEND_ID;

// The <canisterId>.localhost URL is used as opposed to setting the canister id as a parameter
// since the latter is brittle with regards to transitively loaded resources.
const local_ii_url = `http://${process.env.INTERNET_IDENTITY_CANISTER_ID}.localhost:4943`;

let principal: Principal | undefined;
let civic_canister: _SERVICE | undefined;


export interface ClaimValue {
  Boolean?: boolean;
  Date?: string;
  Text?: string;
  Number?: number;
  Claim?: Claim;
}

export type ClaimRecord = {
  text: string;
  value: ClaimValue;
};

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

document.getElementById("loginBtn")?.addEventListener("click", async () => {
  // When the user clicks, we start the login process.
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
      onSuccess: resolve,
      onError: reject,
    });
  });

  // At this point we're authenticated, and we can get the identity from the auth client:
  const identity = authClient.getIdentity();
  principal = identity.getPrincipal();
  
  // Using the identity obtained from the auth client, we can create an agent to interact with the IC.
  const agent = new HttpAgent({ identity });
  // Using the interface description of our civic_canister, we create an actor that we use to call the service methods.
  // civic_canister = Actor.createActor(webapp_idl, {
  //   agent,
  //   canisterId: canisterId!,
  // });

  const option : CreateActorOptions = {
    agent: agent, 
  }

  civic_canister = createActor(canisterId, option);

  // show principal and credential button 
  document.getElementById("credentialBtn")!.style.display = 'inline';
  document.getElementById("loginStatus")!.innerText = "User Principal from Civic Canister POV: " + principal.toText();


});

document.getElementById("credentialBtn")?.addEventListener("click", async () => {
  // const alumniOfClaim : Claim = {
  //   claims: [
  //     ["id", {Text: "did:example:c276e12ec21ebfeb1f712ebc6f1"}],
  //    [ "name", {Text: "Example University"}],
  //    [ "degreeType", {Text: "MBA"}]
  //   ]
  // }
  
  const claimRecord: ClaimRecord = {
    text: "id",
    value: { Text: "did:example:c276e12ec21ebfeb1f712ebc6f1" }
  };
  
  const isOver18Claim: Claim = {
    claims: [
      claimRecord,
      // ["name", { Text: "Max Mustermann"}], 
      // ["alumniOf", {Claim: alumniOfClaim}]
    ]
  };


  const credential: StoredCredential = {
    id: "urn:uuid:6a9c92a9-2530-4e2b-9776-530467e9bbe0",
    type_: ["VerifiableCredential", "VerifiedAdult"],
    context: ["https://www.w3.org/2018/credentials/v1", "https://www.w3.org/2018/credentials/examples/v1"],
    issuer: "https://civic.com",
    claim: [isOver18Claim]
  };
  try {
    console.log("adding a new credential", credential);
    const credentialResponse = await civic_canister.add_credentials(principal, [credential]);

    console.log("Credential added:", credentialResponse);
    document.getElementById("credentialStatus")!.innerText = "Response: " + credentialResponse;
  } catch (error) {
    console.error("Error adding credential:", error);
    document.getElementById("credentialStatus")!.innerText = "Error adding credential: " + error;
  }

});
