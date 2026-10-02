/** Converte uma foto para WebP no navegador, com no máximo `larguraMax` px de largura. */
export async function paraWebp(arquivo: File, larguraMax = 1200, qualidade = 0.82): Promise<Blob> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, larguraMax / bitmap.width);
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a foto neste navegador.");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", qualidade));
  if (!blob || blob.type !== "image/webp") throw new Error("Este navegador não converte para WebP. Tente pelo Chrome.");
  if (blob.size > 2 * 1024 * 1024) throw new Error("A foto ficou maior que 2 MB. Escolha uma foto menor.");
  return blob;
}
