import { useNavigate } from 'react-router-dom'
import type { PlanLimitPayload } from '../../domain/plan'
import { Modal } from './ui'

export default function UpgradeModal({
  payload,
  onClose,
}: {
  payload: PlanLimitPayload | null
  onClose: () => void
}) {
  const nav = useNavigate()
  return (
    <Modal
      open={!!payload}
      title="Limite do plano atingido"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Agora não
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onClose()
              nav('../assinatura')
            }}
          >
            Ver planos
          </button>
        </>
      }
    >
      <p className="text-muted">
        Seu plano permite <b className="text-ink">{payload?.limit}</b> jogadores ativos e o grupo já tem{' '}
        <b className="text-ink">{payload?.current}</b>. Ninguém é apagado: é só liberar mais espaço ou subir
        de plano.
      </p>
    </Modal>
  )
}
