// QR do ingresso e do PIX, desenhados no navegador (a imagem do ingresso não sai do app).
import { useEffect, useState } from "react";

import QRCode from "qrcode";

export function QrTexto({
  texto,
  tamanho = 132,
  rotulo,
}: {
  texto: string;
  tamanho?: number;
  rotulo?: string;
}) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let vivo = true;
    void QRCode.toString(texto, {
      type: "svg",
      margin: 1,
      width: tamanho * 2,
      color: { dark: "#231a12", light: "#ffffff" },
    }).then((s) => {
      if (vivo) setSvg(s);
    });
    return () => {
      vivo = false;
    };
  }, [texto, tamanho]);

  return (
    <figure className="inline-block rounded-lg bg-white p-2">
      {svg ? (
        <span
          className="block"
          style={{ width: tamanho, height: tamanho }}
          dangerouslySetInnerHTML={{ __html: svg }}
          aria-hidden="true"
        />
      ) : (
        <span
          className="block bg-muted"
          style={{ width: tamanho, height: tamanho }}
          aria-hidden="true"
        />
      )}
      {rotulo ? (
        <figcaption className="numeros mt-1 text-center text-[11px] text-muted-foreground">
          {rotulo}
        </figcaption>
      ) : null}
    </figure>
  );
}
