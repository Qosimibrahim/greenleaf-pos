// Mocked Supabase client directing requests to our local Express / MongoDB backend.
import type { Database } from './types';
import { api, getApiBaseUrl, getApiOrigin } from '@/lib/api';

// In-memory callbacks for auth state changes
const authStateListeners: Array<(event: string, session: any) => void> = [];

// Helper to get JWT token from localStorage — uses the same key as useAuth hook
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  // Primary key used by the new useAuth hook
  const direct = localStorage.getItem("auth_token");
  if (direct) return direct;
  // Legacy fallback
  const sessionStr = localStorage.getItem("supabase_session");
  if (!sessionStr) return null;
  try {
    const session = JSON.parse(sessionStr);
    return session.access_token || null;
  } catch {
    return null;
  }
}

function normalizeUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = getApiBaseUrl();
  let cleanPath = url;
  if (cleanPath.startsWith("/api/")) cleanPath = cleanPath.slice(5);
  else if (cleanPath.startsWith("api/")) cleanPath = cleanPath.slice(4);
  else if (cleanPath.startsWith("/api")) cleanPath = cleanPath.slice(4);
  else if (cleanPath.startsWith("/")) cleanPath = cleanPath.slice(1);
  return `${base}/${cleanPath}`;
}

// Helper to make fetch requests
async function makeRequest(url: string, method: string, body?: any, isMultipart = false) {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = isMultipart ? body : JSON.stringify(body);
  }

  const fullUrl = normalizeUrl(url);
  const response = await fetch(fullUrl, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

class QueryBuilder {
  private table: string;
  private filters: Record<string, any> = {};
  private inFilters: Record<string, string[]> = {};
  private orFilter: string | null = null;
  private limitVal: number | null = null;
  private orderCol: string | null = null;
  private orderAsc = true;
  private action: "select" | "insert" | "update" | "delete" = "select";
  private payload: any = null;
  private isSingle = false;
  private isMaybeSingle = false;

  constructor(table: string) {
    this.table = table;
  }

  select(fields?: string) {
    this.action = "select";
    return this;
  }

  insert(payload: any) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: any) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters[column] = value;
    return this;
  }

  in(column: string, values: any[]) {
    this.inFilters[column] = values;
    return this;
  }

  or(expr: string) {
    this.orFilter = expr;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this.limitVal = n;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async then(onfulfilled: any, onrejected?: any) {
    try {
      const result = await this.execute();
      return onfulfilled(result);
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  private async execute() {
    try {
      let apiPath = `/api/${this.table}`;
      
      if (this.table === "staff_payroll") apiPath = "/api/staff-payroll";
      if (this.table === "payroll_runs") apiPath = "/api/payroll-runs";
      if (this.table === "payroll_run_items") apiPath = "/api/payroll-run-items";
      if (this.table === "tax_settings") apiPath = "/api/tax_settings";
      if (this.table === "user_roles") apiPath = "/api/user_roles";

      if (this.action === "select") {
        const queryParams = new URLSearchParams();
        
        if (this.table === "products" && this.orFilter) {
          const match = this.orFilter.match(/(?:barcode\.eq\.|sku\.eq\.)([^,)]+)/);
          if (match && match[1]) {
            queryParams.append("sku", match[1]);
          }
        }
        
        for (const [col, val] of Object.entries(this.filters)) {
          queryParams.append(col, val);
        }
        for (const [col, vals] of Object.entries(this.inFilters)) {
          queryParams.append(col, vals.join(","));
        }

        const url = `${apiPath}?${queryParams.toString()}`;
        const data = await makeRequest(url, "GET");

        let formattedData = data;
        if (Array.isArray(data)) {
          if (this.isSingle || this.isMaybeSingle) {
            formattedData = data[0] || null;
            if (this.isSingle && !formattedData) {
              throw new Error("No record found");
            }
          }
        } else if (this.isSingle || this.isMaybeSingle) {
          formattedData = data;
        }

        return { data: formattedData, error: null };
      }

      if (this.action === "insert") {
        // Intercept paid invoice insertion: create draft then post to /api/ledger
        if (this.table === "invoices" && this.payload?.status === "paid") {
          const bankAccountId = this.payload.bank_account_id;
          const paymentMethod = this.payload.payment_method;
          
          // Insert draft first
          const draftPayload = { ...this.payload, status: "draft" };
          delete draftPayload.bank_account_id;
          delete draftPayload.payment_method;
          delete draftPayload.paid_at;
          
          const draftRes = await makeRequest(apiPath, "POST", draftPayload);
          
          // Call ledger API to process payment and post balancing debits/credits
          const paidRes = await makeRequest("/api/ledger", "POST", {
            invoice_id: draftRes.id,
            payment_method: paymentMethod || "cash",
            bank_account_id: bankAccountId,
          });
          
          return { data: paidRes, error: null };
        }

        const data = await makeRequest(apiPath, "POST", this.payload);
        return { data, error: null };
      }

      if (this.action === "update") {
        const targetId = this.filters.id || this.filters.user_id;
        if (!targetId) throw new Error("Update targeted ID is missing");
        
        // Intercept paid invoice status update: call ledger API instead
        if (this.table === "invoices" && this.payload?.status === "paid") {
          const paidRes = await makeRequest("/api/ledger", "POST", {
            invoice_id: targetId,
            payment_method: this.payload.payment_method || "cash",
            bank_account_id: this.payload.bank_account_id,
          });
          return { data: paidRes, error: null };
        }

        const data = await makeRequest(`${apiPath}/${targetId}`, "PUT", this.payload);
        return { data, error: null };
      }

      if (this.action === "delete") {
        const targetId = this.filters.id;
        if (!targetId) throw new Error("Delete targeted ID is missing");

        const data = await makeRequest(`${apiPath}/${targetId}`, "DELETE");
        return { data, error: null };
      }

      throw new Error(`Unsupported action: ${this.action}`);
    } catch (error: any) {
      console.error(`Supabase Client Mock error on table ${this.table}:`, error);
      return { data: null, error: { message: error.message || "Request failed" } };
    }
  }
}

export const supabase = {
  auth: {
    async getUser() {
      try {
        const session = await this.getSession();
        if (session.data.session) {
          return { data: { user: session.data.session.user }, error: null };
        }
        return { data: { user: null }, error: new Error("No active user session") };
      } catch (err: any) {
        return { data: { user: null }, error: err };
      }
    },

    async getSession() {
      if (typeof window === "undefined") {
        return { data: { session: null }, error: null };
      }
      try {
        const data = await api.get<any>("/auth/session");
        if (data.session) {
          localStorage.setItem("supabase_session", JSON.stringify(data.session));
          return { data: { session: data.session }, error: null };
        }
        localStorage.removeItem("supabase_session");
        return { data: { session: null }, error: null };
      } catch {
        const local = localStorage.getItem("supabase_session");
        if (local) {
          return { data: { session: JSON.parse(local) }, error: null };
        }
        return { data: { session: null }, error: null };
      }
    },

    async signInWithPassword({ email, password }: any) {
      try {
        const data = await api.post<any>("/auth/signin", { email, password });
        if (data.access_token) {
          localStorage.setItem("supabase_session", JSON.stringify(data));
          authStateListeners.forEach((listener) => listener("SIGNED_IN", data));
          return { data: { user: data.user, session: data }, error: null };
        }
        throw new Error("Invalid response from signin server");
      } catch (err: any) {
        return { data: { user: null, session: null }, error: err };
      }
    },

    async signUp({ email, password, options }: any) {
      try {
        const data = await api.post<any>("/auth/signup", {
          email,
          password,
          fullName: options?.data?.full_name,
        });
        if (data.access_token) {
          localStorage.setItem("supabase_session", JSON.stringify(data));
          authStateListeners.forEach((listener) => listener("SIGNED_IN", data));
          return { data: { user: data.user, session: data }, error: null };
        }
        throw new Error("Invalid response from signup server");
      } catch (err: any) {
        return { data: { user: null, session: null }, error: err };
      }
    },

    async signOut() {
      if (typeof window !== "undefined") {
        localStorage.removeItem("supabase_session");
      }
      authStateListeners.forEach((listener) => listener("SIGNED_OUT", null));
      return { error: null };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      authStateListeners.push(callback);
      this.getSession().then(({ data }) => {
        callback(data.session ? "SIGNED_IN" : "SIGNED_OUT", data.session);
      });
      return {
        data: {
          subscription: {
            unsubscribe() {
              const index = authStateListeners.indexOf(callback);
              if (index > -1) authStateListeners.splice(index, 1);
            },
          },
        },
      };
    },
  },

  from(table: keyof Database["public"]["Tables"] | string) {
    return new QueryBuilder(table);
  },

  storage: {
    from(bucket: string) {
      return {
        async upload(storagePath: string, file: File) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            
            const result = await makeRequest("/api/storage/upload", "POST", formData, true);
            return { data: { path: result.path }, error: null };
          } catch (err: any) {
            return { data: null, error: err };
          }
        },

        async remove(paths: string[]) {
          return { data: true, error: null };
        },

        async createSignedUrl(storagePath: string, expiresIn: number) {
          const filename = storagePath.split("/").pop();
          const origin = getApiOrigin();
          const signedUrl = `${origin}/uploads/${filename}`;
          return { data: { signedUrl }, error: null };
        },

        async createSignedUrls(paths: string[], expiresIn: number) {
          const origin = getApiOrigin();
          const signedUrls = paths.map((p) => {
            const filename = p.split("/").pop();
            return {
              path: p,
              signedUrl: `${origin}/uploads/${filename}`,
            };
          });
          return { data: signedUrls, error: null };
        },
      };
    },
  },
};
