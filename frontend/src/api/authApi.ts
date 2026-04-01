import { api } from "./client";
import { User } from "../types";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: { id: number; role: string; full_name: string; registration_number: string };
}

export async function login(registration: string, password: string): Promise<LoginResponse> {
  // FastAPI OAuth2PasswordRequestForm usa campos 'username' e 'password'
  const form = new URLSearchParams();
  form.set("username", registration);
  form.set("password", password);
  return api.postForm<LoginResponse>("/api/v1/auth/login", form);
}

export async function getMe(): Promise<User> {
  return api.get<User>("/api/v1/auth/me");
}
