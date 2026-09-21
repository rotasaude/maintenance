import { useState } from "react";
import { Button } from "./Button";

// Confirmação de dois cliques para uma ação destrutiva (Task 7: desativar um
// mantenedor). O primeiro clique só troca o rótulo para `confirmLabel`; é o
// SEGUNDO clique, com o botão já nesse estado, que chama `onConfirm`. Sem
// diálogo, sem rede aqui — quem decide o que "confirmar" significa é quem
// passa `onConfirm`.
type Props = {
  label: string;
  confirmLabel: string;
  onConfirm(): void;
  busy?: boolean;
  disabled?: boolean;
};

export function ConfirmButton({ label, confirmLabel, onConfirm, busy, disabled }: Props) {
  const [ confirming, setConfirming ] = useState(false);

  function handleClick() {
    if (confirming) {
      setConfirming(false);
      onConfirm();
    } else {
      setConfirming(true);
    }
  }

  return (
    <Button onClick={handleClick} busy={busy} disabled={disabled}>
      {confirming ? confirmLabel : label}
    </Button>
  );
}
