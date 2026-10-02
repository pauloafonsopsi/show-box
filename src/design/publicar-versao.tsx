import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { classeCampo } from "@/design/coxia";

export function PublicarVersao({
  titulo,
  aberto,
  onFechar,
  inicial,
  onPublicar,
  publicando,
}: {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  inicial: string;
  onPublicar: (texto: string) => void;
  publicando: boolean;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        if (!o) {
          setTexto(null);
          onFechar();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">
          A versão publicada nunca é alterada. Escreva o texto inteiro da nova versão; ela passa a valer para as próximas compras.
        </p>
        <textarea
          aria-label="Texto da nova versão"
          rows={14}
          className={classeCampo}
          value={texto ?? inicial}
          onChange={(e) => setTexto(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            className="min-h-11"
            disabled={publicando || !(texto ?? inicial).trim()}
            onClick={() => onPublicar(texto ?? inicial)}
          >
            {publicando ? "Publicando..." : "Publicar nova versão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

