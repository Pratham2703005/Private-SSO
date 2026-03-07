export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          created_at: string | null;
          updated_at: string | null;
        };
      };
      user_accounts: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          name: string;
          profile_image_url: string | null;
          gender: string | null;
          phone: string | null;
          birthday: string | null;
          language: string | null;
          home_address: string | null;
          work_address: string | null;
          is_primary: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
      };
      authorization_codes: {
        Row: {
          id: string;
          code: string;
          client_id: string;
          user_id: string;
          redirect_uri: string;
          code_challenge: string;
          code_challenge_method: string | null;
          state: string | null;
          scopes: unknown;
          expires_at: string;
          is_redeemed: boolean | null;
          created_at: string | null;
        };
      };
      refresh_tokens: {
        Row: {
          id: string;
          user_id: string | null;
          token_hash: string;
          client_id: string;
          expires_at: string;
          created_at: string | null;
          used_at: string | null;
          replaced_by_token_hash: string | null;
          revoked: boolean | null;
          revoked_at: string | null;
          session_id: string | null;
          account_id: string | null;
          session_binding_hash: string | null;
        };
      };
      grants: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          scopes: unknown;
          granted_at: string;
          revoked_at: string | null;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
      };
      csrf_tokens: {
        Row: {
          id: string;
          token_hash: string;
          session_id: string;
          expires_at: string;
          created_at: string | null;
        };
      };
      sessions: {
        Row: {
          id: string;
          user_id: string | null;
          expires_at: string;
          created_at: string | null;
          active_account_id: string | null;
        };
      };
      session_logons: {
        Row: {
          id: string;
          session_id: string;
          account_id: string;
          logged_in_at: string;
          last_active_at: string | null;
          revoked: boolean | null;
          revoked_at: string | null;
          created_at: string | null;
        };
      };
      oauth_clients: {
        Row: {
          id: string;
          client_id: string;
          client_secret_hash: string;
          client_name: string | null;
          allowed_redirect_uris: unknown;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
      };
    };
  };
}
