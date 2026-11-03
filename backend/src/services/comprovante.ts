import { Cliente, Equipamento, OrdemServico, Reparo } from "@prisma/client";
import { ROTULO_STATUS } from "./statusOS";

type OSCompleta = OrdemServico & {
  cliente: Cliente;
  equipamento: Equipamento;
  reparos: Reparo[];
  atendente: { nome: string };
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const data = (d?: Date | null) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const moeda = (v: unknown) =>
  v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const numeroOS = (id: number) => `OS-${String(id).padStart(4, "0")}`;

/** RF20 — comprovante imprimível de entrada/entrega do equipamento. */
export function renderComprovante(os: OSCompleta): string {
  const eq = os.equipamento;
  const reparos = os.reparos
    .map((r) => `<li>${esc(r.descricao)}${r.pecasUtilizadas ? ` — peças: ${esc(r.pecasUtilizadas)}` : ""}</li>`)
    .join("");
  const valorFinal = os.reparos.reduce((s, r) => s + Number(r.valorFinal ?? 0), 0);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Comprovante ${numeroOS(os.id)}</title>
<style>
body{font-family:Arial,sans-serif;max-width:720px;margin:24px auto;color:#111;font-size:14px}
h1{font-size:20px;margin:0}.top{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin-top:12px}td{border:1px solid #999;padding:6px;vertical-align:top}
td:first-child{width:32%;background:#f3f3f3;font-weight:bold}.ass{display:flex;gap:40px;margin-top:56px}
.ass div{flex:1;border-top:1px solid #111;text-align:center;padding-top:4px}small{color:#555}
@media print{button{display:none}}
</style></head><body>
<div class="top"><div><h1>Inforcell</h1><small>Assistência técnica — Balsas/MA</small></div>
<div style="text-align:right"><h1>${numeroOS(os.id)}</h1><small>Status: ${ROTULO_STATUS[os.status]}</small></div></div>
<table>
<tr><td>Cliente</td><td>${esc(os.cliente.nome)}<br><small>Tel.: ${esc(os.cliente.telefone)}</small></td></tr>
<tr><td>Equipamento</td><td>${esc(eq.marca)} ${esc(eq.modelo)} (${esc(eq.tipo)})${eq.imei ? `<br><small>IMEI: ${esc(eq.imei)}</small>` : ""}${eq.numeroSerie ? `<br><small>Nº série: ${esc(eq.numeroSerie)}</small>` : ""}</td></tr>
<tr><td>Defeito relatado</td><td>${esc(os.defeitoRelatado)}</td></tr>
<tr><td>Acessórios deixados</td><td>${esc(os.acessorios || "Nenhum")}</td></tr>
<tr><td>Entrada</td><td>${data(os.createdAt)} — atendente: ${esc(os.atendente.nome)}</td></tr>
<tr><td>Previsão de entrega</td><td>${data(os.previsaoEntrega)}</td></tr>
<tr><td>Orçamento</td><td>${moeda(os.valorOrcamento)}</td></tr>
${reparos ? `<tr><td>Serviços realizados</td><td><ul style="margin:0;padding-left:18px">${reparos}</ul></td></tr>
<tr><td>Valor final</td><td>${moeda(valorFinal)}</td></tr>` : ""}
${os.entregueEm ? `<tr><td>Entregue em</td><td>${data(os.entregueEm)}</td></tr>` : ""}
</table>
<p><small>Equipamentos não retirados em até 90 dias após a comunicação de conclusão poderão ter destinação conforme a legislação vigente.</small></p>
<div class="ass"><div>Cliente</div><div>Inforcell</div></div>
<p style="text-align:center"><button onclick="print()">Imprimir</button></p>
</body></html>`;
}
