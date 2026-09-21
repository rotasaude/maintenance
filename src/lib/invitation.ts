// O link do convite é /invitations#<token> (rake maintainer:invite). O
// fragmento nunca vai ao servidor; ainda assim ele fica no histórico do
// navegador — por isso é lido UMA vez e a URL é limpa na hora (spec §5).
export function readInvitationToken(location: Location, history: History): string | null {
  if (location.pathname !== "/invitations") return null;
  const raw = location.hash.replace(/^#/, "");
  if (raw === "") return null;

  history.replaceState(null, "", "/");
  return decodeURIComponent(raw);
}
