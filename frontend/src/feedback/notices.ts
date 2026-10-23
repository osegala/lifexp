export type NoticeVariant = "success" | "info" | "error" | "warning";
export type NoticeRewards = { xp?: number; coins?: number; worldPoints?: number };
export type GameNotice = { id: number; title: string; message?: string; variant: NoticeVariant; duration: number };

type Snapshot = { pending: GameNotice[]; blockers: string[] };
let snapshot: Snapshot = { pending: [], blockers: [] };
let nextId = 0;
const listeners = new Set<() => void>();
function update(next: Snapshot) { snapshot = next; listeners.forEach(listener => listener()); }
export const getGameNotices = () => snapshot;
export const subscribeGameNotices = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Display-only, session-local feedback. Call at the existing status/alert point. */
export function showGameNotice(title: string, message?: string, variant: NoticeVariant = "info") {
  const notice = { id: ++nextId, title, message, variant, duration: variant === "error" ? 8000 : 6000 };
  update({ ...snapshot, pending: [...snapshot.pending, notice] });
}
export function dismissGameNotice(id: number) {
  update({ ...snapshot, pending: snapshot.pending.filter(notice => notice.id !== id) });
}
export function setGameFeedbackActive(key: string, active: boolean) {
  const blockers = snapshot.blockers.filter(item => item !== key);
  if (active) blockers.push(key);
  update({ ...snapshot, blockers });
}
export function clearGameNotices() { update({ pending: [], blockers: [] }); }
