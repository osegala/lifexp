export type BillingOption = { id: string; label: string; price: string };
export type BillingProvider = {
  available: boolean;
  identify(userId: string | null): Promise<void>;
  offerings(): Promise<BillingOption[]>;
  purchase(id: string): Promise<void>;
  restore(): Promise<void>;
  manage(): Promise<void>;
};
type State = { busy: boolean; ready: boolean; options: BillingOption[]; verificationPending: boolean;
  error: string | null; message: string | null };

/** SDK results never become entitlements. Only sync + the existing authenticated GET may confirm a plan. */
export class BillingClient {
  private state: State = { busy: false, ready: false, options: [], verificationPending: false, error: null, message: null };
  private userId: string | null = null;
  private revision = 0;
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  readonly provider: BillingProvider;
  private syncPlan: (userId: string) => Promise<boolean>;
  constructor(provider: BillingProvider, syncPlan: (userId: string) => Promise<boolean>) { this.provider = provider; this.syncPlan = syncPlan; }
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private update(patch: Partial<State>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  private serialize<T>(fn: () => Promise<T>) {
    const result = this.queue.catch(() => {}).then(fn); this.queue = result; return result;
  }
  identify = async (id: string | null) => {
    if (id === this.userId && (this.state.ready || !this.provider.available || !id)) return;
    this.userId = id; const revision = ++this.revision;
    this.update({ ready: false, options: [], busy: !!id && this.provider.available, verificationPending: false, error: null, message: null });
    try {
      await this.serialize(() => this.provider.identify(id));
      if (revision === this.revision) this.update({ ready: !!id && this.provider.available });
    } catch { if (revision === this.revision) this.update({ error: "Billing is unavailable. Reopen this screen to retry." }); }
    finally { if (revision === this.revision) this.update({ busy: false }); }
  };
  load = async () => {
    if (!this.userId || !this.provider.available || this.state.busy) return;
    if (!this.state.ready) await this.identify(this.userId);
    if (!this.state.ready || this.state.busy) return;
    const revision = this.revision; this.update({ busy: true, error: null });
    try {
      const options = await this.serialize(() => this.provider.offerings());
      if (revision === this.revision) this.update({ options, error: options.length ? null : "No subscription package is available from the store." });
    } catch { if (revision === this.revision) this.update({ options: [], error: "Could not load store prices. Please retry." }); }
    finally { if (revision === this.revision) this.update({ busy: false }); }
  };
  private run = async (operation: "purchase" | "restore" | "sync" | "manage", option?: string) => {
    if (!this.userId || !this.state.ready || this.state.busy || (operation === "purchase"
      && (this.state.verificationPending || !this.state.options.some(p => p.id === option)))) return;
    const id = this.userId, revision = this.revision;
    this.update({ busy: true, error: null, message: null });
    try {
      if (operation !== "sync") await this.serialize(() => operation === "purchase" ? this.provider.purchase(option!)
        : operation === "restore" ? this.provider.restore() : this.provider.manage());
      if (revision !== this.revision) return;
      if (operation === "manage") { this.update({ message: "Subscription changes are managed by your app store." }); return; }
      this.update({ verificationPending: true, message: "Verifying your plan with Evrenthia…" });
      const premium = await this.syncPlan(id);
      if (revision === this.revision) this.update({ verificationPending: false, message: premium ? "Premium confirmed by Evrenthia."
        : "No active Premium subscription was confirmed. Pending payments may need time to finish." });
    } catch (error) {
      if (revision !== this.revision) return;
      const code = (error as { code?: string; userCancelled?: boolean })?.code;
      this.update({ verificationPending: this.state.verificationPending || code === "20",
        error: (error as { userCancelled?: boolean })?.userCancelled || code === "1" ? null
        : code === "20" ? "Payment is pending. No Premium access has been confirmed yet."
        : this.state.verificationPending ? "Store action completed, but Evrenthia verification failed. Retry verification; do not buy again."
        : "The store action could not finish. Check your connection and retry.", message: code === "1" ? "Purchase canceled." : null });
    } finally { if (revision === this.revision) this.update({ busy: false }); }
  };
  purchase = (id: string) => this.run("purchase", id);
  restore = () => this.run("restore");
  sync = () => this.run("sync");
  manage = () => this.run("manage");
}
