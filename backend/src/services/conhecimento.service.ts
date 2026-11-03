import { TipoEquipamento } from "@prisma/client";
import { prisma } from "../lib/prisma";

const PARADAS = new Set(["de", "do", "da", "o", "a", "e", "em", "no", "na", "não", "nao", "com", "um", "uma", "que", "para", "por", "os", "as"]);

export function palavras(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 2 && !PARADAS.has(p));
}

/** Pontua um artigo pela sobreposição de palavras e pela coincidência de marca/modelo. */
export function pontuar(
  artigo: { titulo: string; sintoma: string; tags: string | null; marca: string | null; modelo: string | null },
  busca: { sintoma: string; marca: string; modelo: string },
): number {
  const alvo = new Set(palavras(`${artigo.titulo} ${artigo.sintoma} ${artigo.tags ?? ""}`));
  let pontos = palavras(busca.sintoma).filter((p) => alvo.has(p)).length;
  if (artigo.marca && artigo.marca.toLowerCase() === busca.marca.toLowerCase()) pontos += 2;
  if (artigo.modelo && busca.modelo.toLowerCase().includes(artigo.modelo.toLowerCase())) pontos += 3;
  return pontos;
}

/** Busca os artigos mais relevantes para dar contexto à IA (Seção 17). */
export async function buscarArtigosRelevantes(tipo: TipoEquipamento, marca: string, modelo: string, sintoma: string, limite = 3) {
  const candidatos = await prisma.artigoConhecimento.findMany({
    where: { OR: [{ tipoEquipamento: tipo }, { tipoEquipamento: null }] },
    take: 200,
    orderBy: { updatedAt: "desc" },
  });
  return candidatos
    .map((a) => ({ a, p: pontuar(a, { sintoma, marca, modelo }) }))
    .filter((x) => x.p > 0)
    .sort((x, y) => y.p - x.p)
    .slice(0, limite)
    .map((x) => ({ titulo: x.a.titulo, conteudo: x.a.conteudo.slice(0, 2000) }));
}
