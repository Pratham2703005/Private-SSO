import axios from 'axios';

export class TestHttpClient {
  private cookieJar: Record<string, string> = {};
  private baseURL = 'http://localhost:3000';

  async loginWithCredentials(email: string, password: string) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/auth/login`,
        { email, password },
        {
          headers: this.getCookieHeader(),
          withCredentials: true,
          validateStatus: () => true
        }
      );
      
      const setCookieHeaders = response.headers['set-cookie'];
      if (setCookieHeaders) {
        this.storeCookies(setCookieHeaders);
      }
      
      return {
        status: response.status,
        data: response.data
      };
    } catch (error: any) {
      return {
        status: error.response?.status || 500,
        error: error.message
      };
    }
  }

  async checkSession() {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/auth/session`,
        {
          headers: this.getCookieHeader(),
          withCredentials: true,
          validateStatus: () => true
        }
      );
      
      return {
        status: response.status,
        data: response.data
      };
    } catch (error: any) {
      return {
        status: error.response?.status || 500,
        error: error.message
      };
    }
  }

  async logout() {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/auth/logout`,
        {},
        {
          headers: this.getCookieHeader(),
          withCredentials: true,
          validateStatus: () => true
        }
      );
      
      const setCookieHeaders = response.headers['set-cookie'];
      if (setCookieHeaders) {
        this.storeCookies(setCookieHeaders);
      }
      
      return {
        status: response.status,
        data: response.data
      };
    } catch (error: any) {
      return {
        status: error.response?.status || 500,
        error: error.message
      };
    }
  }

  getAllCookies(): Record<string, string> {
    return { ...this.cookieJar };
  }

  getAuthCookies(): Record<string, string> {
    const authCookies: Record<string, string> = {};
    const authCookieRegex = /sso|session|auth|token/i;
    
    Object.entries(this.cookieJar).forEach(([name, value]) => {
      if (authCookieRegex.test(name)) {
        authCookies[name] = value;
      }
    });
    
    return authCookies;
  }

  async authorizeWithSession(clientId: string, redirectUri: string, state: string, codeChallenge?: string, ttlSeconds?: number) {
    try {
      const params: Record<string, any> = {
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scopes: 'profile,email'
      };

      if (codeChallenge) {
        params.code_challenge = codeChallenge;
      }

      if (ttlSeconds) {
        params.ttl_seconds = ttlSeconds;
      }

      const url = `${this.baseURL}/api/auth/authorize?${Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&')}`;

      console.log('[authorizeWithSession] Making request to:', url);

      const response = await axios.get(
        `${this.baseURL}/api/auth/authorize`,
        {
          params,
          headers: this.getCookieHeader(),
          withCredentials: true,
          validateStatus: () => true,
          maxRedirects: 0 // Don't follow redirects, we want to check the Location header
        }
      );

      const locationHeader = response.headers['location'] || '';
      
      console.log('[authorizeWithSession] Response status:', response.status);
      console.log('[authorizeWithSession] Location header:', locationHeader);
      console.log('[authorizeWithSession] Response body:', response.data);

      return {
        status: response.status,
        headers: response.headers,
        locationHeader,
        body: response.data
      };
    } catch (error: any) {
      console.error('[authorizeWithSession] Error:', error.message);
      return {
        status: error.response?.status || 500,
        headers: error.response?.headers || {},
        locationHeader: '',
        error: error.message
      };
    }
  }

  getCookie(name: string): string | null {
    return this.cookieJar[name] || null;
  }

  private getCookieHeader(): Record<string, string> {
    if (Object.keys(this.cookieJar).length === 0) {
      return {};
    }
    const cookieString = Object.entries(this.cookieJar)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    return { Cookie: cookieString };
  }

  private storeCookies(setCookieHeaders: string | string[]) {
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    
    headers.forEach(header => {
      const [cookiePart] = header.split(';');
      const [name, value] = cookiePart.split('=');
      if (name && value) {
        if (header.includes('Max-Age=0')) {
          delete this.cookieJar[name.trim()];
        } else {
          this.cookieJar[name.trim()] = value.trim();
        }
      }
    });
  }
}
