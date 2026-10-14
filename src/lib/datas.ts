// ==============================================
// Datas
// ==============================================
// Tudo em "dias" no fuso de quem usa, nunca em UTC. Um copo d'água às 22h em
// Porto Alegre é do dia de hoje; em UTC já seria amanhã. Por isso nada aqui
// usa toISOString().

/** O dia de uma data, "AAAA-MM-DD", no fuso local. */
export function chaveDia(data: Date = new Date()): string {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

/** "AAAA-MM-DD" de volta para Date, à meia-noite local. */
export function dataDaChave(chave: string): Date {
  const [a, m, d] = chave.split("-").map(Number);
  return new Date(a, m - 1, d);
}

/** Soma (ou subtrai) dias a uma chave. Atravessa mês, ano e bissexto. */
export function somarDias(chave: string, dias: number): string {
  const data = dataDaChave(chave);
  data.setDate(data.getDate() + dias);
  return chaveDia(data);
}

/** As últimas N chaves, em ordem cronológica, terminando em `ate`. */
export function ultimosDias(n: number, ate: string = chaveDia()): string[] {
  const dias: string[] = [];
  for (let atras = n - 1; atras >= 0; atras--) dias.push(somarDias(ate, -atras));
  return dias;
}

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_LONGOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "Seg", "Ter"... */
export function diaDaSemanaCurto(chave: string): string {
  return DIAS_CURTOS[dataDaChave(chave).getDay()];
}

/** "Quarta, 14 de outubro" */
export function dataPorExtenso(data: Date = new Date()): string {
  const dia = DIAS_LONGOS[data.getDay()];
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${data.getDate()} de ${MESES_LONGOS[data.getMonth()]}`;
}

/** "14 out" */
export function dataCurta(chave: string): string {
  const d = dataDaChave(chave);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** "Bom dia", "Boa tarde" ou "Boa noite", pela hora. */
export function saudacao(hora: number = new Date().getHours()): string {
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** "08:05" */
export function horaMinuto(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Idade em anos completos a partir de "AAAA-MM-DD". */
export function idade(nascimento: string, hoje: Date = new Date()): number {
  const n = dataDaChave(nascimento);
  let anos = hoje.getFullYear() - n.getFullYear();
  const fezAniversario =
    hoje.getMonth() > n.getMonth() ||
    (hoje.getMonth() === n.getMonth() && hoje.getDate() >= n.getDate());
  if (!fezAniversario) anos--;
  return anos;
}
