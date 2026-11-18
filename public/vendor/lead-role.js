// Agent Office (MIT). Original src/scene/officeLayout.ts, types removed.
export function isLeadRole(role        )          {
  return /\b(lead|leader|manager|director|chief|lider|gerente|diretor|coordenador)\b/i.test(role.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
}

