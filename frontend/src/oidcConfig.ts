import { AuthProviderProps } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";

const KEYCLOAK_URL = "http://localhost:8080/realms/ucdb";

export const oidcConfig: AuthProviderProps = {
  // authority deve ser a URL real do Keycloak para que o issuer do token bata
  authority: KEYCLOAK_URL,

  // metadataUrl via proxy evita bloqueio de CORS no Chrome para o fetch do discovery
  metadataUrl: `${window.location.origin}/keycloak/realms/ucdb/.well-known/openid-configuration`,

  client_id: "labmanager-client",
  redirect_uri: window.location.origin + "/",
  response_type: "code",
  scope: "openid profile email",

  userStore: new WebStorageStateStore({ store: window.localStorage }),

  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};
