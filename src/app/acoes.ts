// Ações usadas em mais de uma tela.

import { useCallback } from "react";
import { dados } from "@/dados";
import { formatarMl } from "@/lib/agua";
import { useAvisos, useEstado } from "./estado";

/**
 * Registra água com "Desfazer" no aviso. Quando o copo faz bater a meta,
 * comemora e marca o hábito do Minha Rotina (se estiver ligado no Perfil).
 */
export function useRegistrarAgua() {
  const { hoje, dia, perfil } = useEstado();
  const avisar = useAvisos();

  return useCallback(
    async (ml: number) => {
      const antes = dia?.aguaMl ?? 0;
      const meta = perfil?.metas.aguaMl ?? 2000;
      navigator.vibrate?.(12);
      const registro = await dados.registrarAgua(ml, hoje);
      const bateu = antes < meta && antes + ml >= meta;
      avisar(bateu ? `Meta de água batida! ${formatarMl(antes + ml)} hoje.` : `+${ml} ml de água`, {
        rotulo: "Desfazer",
        fazer: () => void dados.desfazerAgua(registro, hoje),
      }, 5000);
      if (bateu && perfil?.habitoAguaId) {
        dados
          .marcarHabitoRotina(perfil.habitoAguaId)
          .then((marcou) => marcou && setTimeout(() => avisar("Hábito de água marcado no Minha Rotina ✓"), 1200))
          .catch((e) => console.error("Falha ao marcar o hábito no Rotina:", e));
      }
    },
    [hoje, dia?.aguaMl, perfil?.metas.aguaMl, perfil?.habitoAguaId, avisar]
  );
}
