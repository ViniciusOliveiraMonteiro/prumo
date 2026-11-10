export type ApiResult<T> =
  { status: number; data: T } | { status: number; data: null };

export interface ReadApiClient {
  get<T>(path: string): Promise<ApiResult<T>>;
}

export interface SignInClient {
  signIn(email: string, password: string): Promise<number>;
}
