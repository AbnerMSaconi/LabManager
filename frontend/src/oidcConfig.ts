import { AuthProviderProps } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";

export const oidcConfig: AuthProviderProps = {
  // A URL direta e real do Keycloak
  authority: "http://localhost:8080/realms/ucdb", 
  
  client_id: "labmanager-client",
  redirect_uri: window.location.origin + "/",
  response_type: "code",
  scope: "openid profile email",

  userStore: new WebStorageStateStore({ store: window.localStorage }),

  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};