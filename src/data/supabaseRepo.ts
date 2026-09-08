import type { PostgrestError } from '@supabase/supabase-js'
import { assertCanAddPlayer } from '../domain/plan'
import type {
  Lineup,
  LineupPlayer,
  Match,
  MatchEntry,
  Player,
  PlanCode,
  Pos,
  Subscription,
  TeamKey,
  Tenant,
  TenantBranding,
  TenantData,
  VoteState,
} from '../domain/types'
import { RepoError, type Repository } from './repo'
import { getSupabase } from './supabaseClient'
import {
  ENTRY_COLS,
  MATCH_COLS,
  PLAYER_COLS,
  SUB_COLS,
  TENANT_COLS,
  brandingToRow,
  entryToRow,
  formationToText,
  matchFromRow,
  playerFromRow,
  playerPatchToRow,
  statusOf,
  subscriptionFromRow,
  tenantFromRow,
  voteStateToRow,
  type EntryRow,
  type MatchRow,
  type PlayerRow,
  type SubscriptionRow,
  type TenantRow,
} from './supabaseMap'

/**
 * Adapter Supabase da porta `Repository` (ADR-004). Mesma porta do
 * `LocalRepository`: dominio e UI nao sabem qual dos dois esta rodando.
 *
 * Duas coisas que este adapter NAO faz, de proposito:
 *
 * - **Autenticar.** A RLS do 0001_init.sql resolve tudo por `is_member()`, que
 *   depende de `auth.uid()`. Sem sessao todo select volta vazio, o que e
 *   indistinguivel de "grupo sem dados" — por isso `load()` recusa cedo e com
 *   erro proprio, em vez de devolver uma base vazia fingindo sucesso. O login
 *   entra no item 1 da Fase 4.
 * - **Escrever cobranca.** As policies de `subscriptions` e `billing_periods`
 *   sao leitura-apenas: escrita so pelo service role, via webhook do gateway
 *   (item 3 da Fase 4). Tentar um UPDATE daqui a RLS engoliria em silencio, e
 *   a UI acharia que salvou. Os cinco metodos recusam com `not_supported`.
 */
export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const

  /** Preenchido pelo `load`. Toda escrita filtra por ele, nunca so pela RLS. */
  private tenantId: string | null = null

  // ------------------------------------------------------------- utilitarios

  private db() {
    return getSupabase()
  }

  private tid(): string {
    if (!this.tenantId) {
      throw new RepoError('Carregue o grupo antes de gravar.', 'not_loaded')
    }
    return this.tenantId
  }

  /**
   * Converte o erro do PostgREST em `RepoError` com codigo que a UI ja trata.
   * Nenhuma chamada externa deste arquivo escapa sem passar por aqui.
   */
  private fail(error: PostgrestError, fallback: string): never {
    switch (error.code) {
      case '23505': // unique_violation
        throw new RepoError('Ja existe um registro com esses dados.', 'duplicate')
      case '23503': // foreign_key_violation
        throw new RepoError('Registro referenciado por outro dado.', 'in_use')
      case '42501': // insufficient_privilege
      case 'PGRST301':
        throw new RepoError('Sem permissao para esta operacao.', 'forbidden')
      case 'PGRST116': // zero linhas onde se esperava uma
        throw new RepoError('Registro nao encontrado.', 'not_found')
      default:
        throw new RepoError(`${fallback} (${error.code ?? 'erro'}: ${error.message})`, 'db_error')
    }
  }

  private take<T>(res: { data: T | null; error: PostgrestError | null }, fallback: string): T {
    if (res.error) this.fail(res.error, fallback)
    if (res.data === null) throw new RepoError(fallback, 'not_found')
    return res.data
  }

  /** Id do usuario logado. Toda a RLS do 0001_init.sql pende de `auth.uid()`. */
  private async sessionUserId(): Promise<string> {
    const { data, error } = await this.db().auth.getSession()
    if (error) {
      throw new RepoError(`Falha ao verificar a sessao: ${error.message}`, 'auth_required')
    }
    if (!data.session) {
      throw new RepoError('Entre na sua conta para acessar o grupo.', 'auth_required')
    }
    return data.session.user.id
  }

  // -------------------------------------------------------------------- load

  async load(slug: string): Promise<TenantData> {
    await this.sessionUserId()
    const db = this.db()

    const tenantRow = this.take<TenantRow>(
      await db.from('tenants').select(TENANT_COLS).eq('slug', slug).is('deleted_at', null).maybeSingle(),
      'Grupo nao encontrado ou voce nao e membro dele.',
    )
    const tenant = tenantFromRow(tenantRow)
    this.tenantId = tenant.id

    const [playerRows, matchRows, subRow, tallies] = await Promise.all([
      this.fetchPlayers(tenant.id),
      this.fetchMatches(tenant.id),
      this.fetchSubscription(tenant.id),
      this.fetchTallies(tenant.id),
    ])

    const entries = await this.fetchEntries(matchRows.map((m) => m.id))
    const byMatch = new Map<string, EntryRow[]>()
    for (const e of entries) {
      const list = byMatch.get(e.match_id)
      if (list) list.push(e)
      else byMatch.set(e.match_id, [e])
    }

    return {
      tenant,
      players: playerRows.map(playerFromRow),
      matches: matchRows.map((row) =>
        matchFromRow(row, byMatch.get(row.id) ?? [], tallies.get(row.id) ?? {}),
      ),
      subscription: subRow,
    }
  }

  private async fetchPlayers(tenantId: string): Promise<PlayerRow[]> {
    return this.take<PlayerRow[]>(
      await this.db()
        .from('players')
        .select(PLAYER_COLS)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true }),
      'Falha ao carregar os jogadores.',
    )
  }

  private async fetchMatches(tenantId: string): Promise<MatchRow[]> {
    return this.take<MatchRow[]>(
      await this.db()
        .from('matches')
        .select(MATCH_COLS)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('date', { ascending: true }),
      'Falha ao carregar as partidas.',
    )
  }

  private async fetchEntries(matchIds: string[]): Promise<EntryRow[]> {
    if (matchIds.length === 0) return []
    return this.take<EntryRow[]>(
      await this.db().from('match_entries').select(ENTRY_COLS).in('match_id', matchIds),
      'Falha ao carregar as escalacoes.',
    )
  }

  private async fetchSubscription(tenantId: string): Promise<Subscription> {
    const row = this.take<SubscriptionRow>(
      await this.db().from('subscriptions').select(SUB_COLS).eq('tenant_id', tenantId).maybeSingle(),
      'Assinatura do grupo nao encontrada.',
    )
    return subscriptionFromRow(row)
  }

  /**
   * Contagem de votos do grupo inteiro. Vem de RPC `security definer` porque a
   * policy `own_vote_read` so expoe o proprio voto do usuario.
   */
  private async fetchTallies(tenantId: string): Promise<Map<string, Record<string, number>>> {
    const rows = this.take<{ match_id: string; player_id: string; votes: number }[]>(
      await this.db().rpc('craque_tally_tenant', { p_tenant: tenantId }),
      'Falha ao apurar os votos de craque.',
    )
    const out = new Map<string, Record<string, number>>()
    for (const r of rows) {
      const tally = out.get(r.match_id) ?? {}
      tally[r.player_id] = r.votes
      out.set(r.match_id, tally)
    }
    return out
  }

  // ---------------------------------------------------------------- branding

  async updateBranding(patch: Partial<TenantBranding>): Promise<Tenant> {
    const row = brandingToRow(patch)
    if (Object.keys(row).length === 0) {
      const current = this.take<TenantRow>(
        await this.db().from('tenants').select(TENANT_COLS).eq('id', this.tid()).maybeSingle(),
        'Grupo nao encontrado.',
      )
      return tenantFromRow(current)
    }
    const updated = this.take<TenantRow>(
      await this.db().from('tenants').update(row).eq('id', this.tid()).select(TENANT_COLS).single(),
      'Falha ao salvar a identidade do grupo.',
    )
    return tenantFromRow(updated)
  }

  // ---------------------------------------------------------------- jogadores

  async createPlayer(input: { name: string; pos: Pos | null }): Promise<Player> {
    const name = input.name.trim().slice(0, 30)
    if (!name) throw new RepoError('Informe o nome do jogador.', 'invalid')

    const tenantId = this.tid()
    // O limite do plano vale contra o estado atual do banco, nao contra o
    // snapshot que a tela carregou: outro admin pode ter cadastrado no meio.
    const [players, subscription] = await Promise.all([
      this.fetchPlayers(tenantId),
      this.fetchSubscription(tenantId),
    ])
    assertCanAddPlayer(subscription, players.map(playerFromRow))

    const row = this.take<PlayerRow>(
      await this.db()
        .from('players')
        .insert({ tenant_id: tenantId, name, pos: input.pos, is_monthly: true })
        .select(PLAYER_COLS)
        .single(),
      'Falha ao cadastrar o jogador.',
    )
    return playerFromRow(row)
  }

  async updatePlayer(
    id: string,
    patch: Partial<Pick<Player, 'name' | 'pos' | 'photoUrl'>>,
  ): Promise<Player> {
    const row = playerPatchToRow(patch)
    if (row.name !== undefined) {
      const name = String(row.name).trim().slice(0, 30)
      if (!name) throw new RepoError('Informe o nome do jogador.', 'invalid')
      row.name = name
    }
    const updated = this.take<PlayerRow>(
      await this.db()
        .from('players')
        .update(row)
        .eq('id', id)
        .eq('tenant_id', this.tid())
        .select(PLAYER_COLS)
        .single(),
      'Falha ao salvar o jogador.',
    )
    return playerFromRow(updated)
  }

  async deletePlayer(id: string): Promise<void> {
    const used = this.take<{ player_id: string }[]>(
      await this.db().from('match_entries').select('player_id').eq('player_id', id).limit(1),
      'Falha ao verificar as partidas do jogador.',
    )
    if (used.length > 0) {
      throw new RepoError('Jogador ja tem partidas registradas e nao pode ser excluido.', 'in_use')
    }
    // Soft delete: dado nunca some.
    this.take<PlayerRow>(
      await this.db()
        .from('players')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', this.tid())
        .select(PLAYER_COLS)
        .single(),
      'Jogador nao encontrado.',
    )
  }

  // ----------------------------------------------------------------- partidas

  async createMatch(input: {
    date: string
    entries?: MatchEntry[]
    scoreBranco?: number | null
    scorePreto?: number | null
    lineup?: Lineup | null
    pending?: boolean
    escalaPub?: boolean
  }): Promise<Match> {
    const scoreA = input.scoreBranco ?? null
    const scoreB = input.scorePreto ?? null
    const lineup = input.lineup ?? null

    const row = this.take<MatchRow>(
      await this.db()
        .from('matches')
        .insert({
          tenant_id: this.tid(),
          date: input.date,
          status: statusOf(input.pending, scoreA !== null && scoreB !== null),
          score_a: scoreA,
          score_b: scoreB,
          lineup_published: input.escalaPub ?? false,
          lineup,
          formation_a: formationToText(lineup?.formB),
          formation_b: formationToText(lineup?.formP),
          draw_seed: lineup?.seed ?? null,
        })
        .select(MATCH_COLS)
        .single(),
      'Falha ao criar a partida.',
    )

    const entries = input.entries ?? []
    await this.writeEntries(row.id, entries, lineup)
    return matchFromRow(row, entries.map((e) => entryToRow(row.id, e, lineup)), {})
  }

  async updateMatch(
    id: string,
    patch: Partial<
      Pick<Match, 'date' | 'entries' | 'scoreBranco' | 'scorePreto' | 'pending' | 'escalaPub' | 'lineup'>
    >,
  ): Promise<Match> {
    const tenantId = this.tid()
    const current = this.take<MatchRow>(
      await this.db()
        .from('matches')
        .select(MATCH_COLS)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      'Partida nao encontrada.',
    )

    const scoreA = patch.scoreBranco !== undefined ? patch.scoreBranco : current.score_a
    const scoreB = patch.scorePreto !== undefined ? patch.scorePreto : current.score_b
    const lineup = patch.lineup !== undefined ? patch.lineup : current.lineup
    const pending = patch.pending !== undefined ? patch.pending : current.status === 'pending'

    const row: Record<string, unknown> = {
      status: statusOf(pending, scoreA !== null && scoreB !== null),
    }
    if (patch.date !== undefined) row.date = patch.date
    if (patch.scoreBranco !== undefined) row.score_a = patch.scoreBranco
    if (patch.scorePreto !== undefined) row.score_b = patch.scorePreto
    if (patch.escalaPub !== undefined) row.lineup_published = patch.escalaPub
    if (patch.lineup !== undefined) {
      row.lineup = patch.lineup
      row.formation_a = formationToText(patch.lineup?.formB)
      row.formation_b = formationToText(patch.lineup?.formP)
      row.draw_seed = patch.lineup?.seed ?? null
    }

    const updated = this.take<MatchRow>(
      await this.db()
        .from('matches')
        .update(row)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(MATCH_COLS)
        .single(),
      'Falha ao salvar a partida.',
    )

    if (patch.entries !== undefined) await this.writeEntries(id, patch.entries, lineup)
    const entries = await this.fetchEntries([id])
    return matchFromRow(updated, entries, await this.tallyOf(id))
  }

  async deleteMatch(id: string): Promise<void> {
    // Soft delete, igual ao jogador: o historico nunca e apagado de verdade.
    this.take<MatchRow>(
      await this.db()
        .from('matches')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', this.tid())
        .select(MATCH_COLS)
        .single(),
      'Partida nao encontrada.',
    )
  }

  /**
   * Reescreve as entradas de UMA partida. Nao e overwrite de documento: o
   * conjunto de entradas e do proprio jogo, e a UI edita as onze de uma vez.
   */
  private async writeEntries(
    matchId: string,
    entries: MatchEntry[],
    lineup: Lineup | null | undefined,
  ): Promise<void> {
    const del = await this.db().from('match_entries').delete().eq('match_id', matchId)
    if (del.error) this.fail(del.error, 'Falha ao limpar a escalacao anterior.')
    if (entries.length === 0) return

    // Avulso (id "av-*") nao tem row em players: entra so no blob da escalacao,
    // senao a FK match_entries.player_id estoura.
    const rows = entries.filter((e) => !isAvulso(e.playerId)).map((e) => entryToRow(matchId, e, lineup))
    if (rows.length === 0) return
    const ins = await this.db().from('match_entries').insert(rows)
    if (ins.error) this.fail(ins.error, 'Falha ao salvar a escalacao.')
  }

  private async updateMatchField(id: string, row: Record<string, unknown>, fallback: string): Promise<Match> {
    const updated = this.take<MatchRow>(
      await this.db()
        .from('matches')
        .update(row)
        .eq('id', id)
        .eq('tenant_id', this.tid())
        .select(MATCH_COLS)
        .single(),
      fallback,
    )
    const entries = await this.fetchEntries([id])
    return matchFromRow(updated, entries, await this.tallyOf(id))
  }

  async publishLineup(id: string, published: boolean): Promise<Match> {
    return this.updateMatchField(id, { lineup_published: published }, 'Falha ao publicar a escalacao.')
  }

  async setVoteState(id: string, state: VoteState): Promise<Match> {
    return this.updateMatchField(
      id,
      voteStateToRow(state, new Date().toISOString()),
      'Falha ao mudar o estado da votacao.',
    )
  }

  async setCraque(id: string, playerId: string | null): Promise<Match> {
    return this.updateMatchField(id, { craque_player_id: playerId }, 'Falha ao definir o craque.')
  }

  // -------------------------------------------------------------------- voto

  private async tallyOf(matchId: string): Promise<Record<string, number>> {
    const rows = this.take<{ player_id: string; votes: number }[]>(
      await this.db().rpc('craque_tally', { p_match: matchId }),
      'Falha ao apurar os votos.',
    )
    const tally: Record<string, number> = {}
    for (const r of rows) tally[r.player_id] = r.votes
    return tally
  }

  /**
   * O `voterKey` que a UI passa e o `deviceKey()`: um uuid do localStorage, que
   * serve ao adapter local, onde nao existe conta. Aqui ele nao serve — a policy
   * `own_vote_write` exige `voter_key = auth.uid()::text`, entao um voto com
   * chave de aparelho seria recusado pela RLS em toda tentativa. No Supabase o
   * voto e amarrado a conta, que e o vinculo mais forte dos dois.
   */
  async vote(matchId: string, playerId: string, _voterKey: string): Promise<Record<string, number>> {
    const userId = await this.sessionUserId()
    // Voto unico e garantido pela PK (match_id, voter_key) do banco, nao por
    // checagem no cliente: o cliente e quem se quer enganar aqui.
    const ins = await this.db()
      .from('craque_votes')
      .insert({ match_id: matchId, player_id: playerId, voter_key: userId })
    if (ins.error) {
      if (ins.error.code === '23505') {
        throw new RepoError('Voce ja votou nesta partida.', 'already_voted')
      }
      this.fail(ins.error, 'Falha ao registrar o voto.')
    }
    return this.tallyOf(matchId)
  }

  // ---------------------------------------------------------------- cobranca

  /**
   * As policies de `subscriptions` e `billing_periods` sao leitura-apenas: a
   * escrita e do service role, no webhook do gateway. Recusar aqui e o
   * contrario de esconder o problema — um UPDATE daqui passaria sem erro e sem
   * gravar nada, e a tela diria que salvou.
   */
  private billingUnavailable(): never {
    throw new RepoError(
      'Cobranca ainda nao esta ligada neste modo: a escrita passa pelo gateway de pagamento.',
      'not_supported',
    )
  }

  async setPaymentMethod(_onFile: boolean): Promise<Subscription> {
    this.billingUnavailable()
  }

  async setPlan(_code: PlanCode): Promise<Subscription> {
    this.billingUnavailable()
  }

  async activateRecurring(): Promise<Subscription> {
    this.billingUnavailable()
  }

  async buyPeriod(_code?: PlanCode): Promise<Subscription> {
    this.billingUnavailable()
  }

  async cancelRecurring(): Promise<Subscription> {
    this.billingUnavailable()
  }

  // ------------------------------------------------------------- import/reset

  /**
   * Import/reset explicito do admin, atras do modal de confirmacao da UI. E a
   * unica operacao que troca o conjunto inteiro — e por isso ela reescreve os
   * ids: os do dump sao do formato antigo e as tabelas usam uuid do banco.
   */
  async replaceAll(data: { players: Player[]; matches: Match[] }): Promise<TenantData> {
    const tenantId = this.tid()
    const db = this.db()

    const oldMatches = await this.fetchMatches(tenantId)
    if (oldMatches.length > 0) {
      const ids = oldMatches.map((m) => m.id)
      const delEntries = await db.from('match_entries').delete().in('match_id', ids)
      if (delEntries.error) this.fail(delEntries.error, 'Falha ao limpar as escalacoes.')
      const delMatches = await db.from('matches').delete().in('id', ids)
      if (delMatches.error) this.fail(delMatches.error, 'Falha ao limpar as partidas.')
    }
    const delPlayers = await db.from('players').delete().eq('tenant_id', tenantId)
    if (delPlayers.error) this.fail(delPlayers.error, 'Falha ao limpar o elenco.')

    const idMap = new Map<string, string>()
    if (data.players.length > 0) {
      const inserted = this.take<PlayerRow[]>(
        await db
          .from('players')
          .insert(
            data.players.map((p) => ({
              tenant_id: tenantId,
              name: p.name.trim().slice(0, 30),
              pos: p.pos,
              photo_url: p.photoUrl ?? null,
              is_monthly: p.isMonthly ?? true,
              is_app: p.app ?? false,
              legacy_id: p.id,
              deleted_at: p.deletedAt ?? null,
            })),
          )
          .select(PLAYER_COLS + ', legacy_id'),
        'Falha ao importar o elenco.',
      )
      for (const row of inserted as (PlayerRow & { legacy_id: string | null })[]) {
        if (row.legacy_id) idMap.set(row.legacy_id, row.id)
      }
    }

    for (const match of data.matches) {
      const lineup = remapLineup(match.lineup ?? null, idMap)
      const created = this.take<MatchRow>(
        await db
          .from('matches')
          .insert({
            tenant_id: tenantId,
            date: match.date,
            status: statusOf(match.pending, match.scoreBranco !== null && match.scorePreto !== null),
            score_a: match.scoreBranco,
            score_b: match.scorePreto,
            lineup_published: match.escalaPub ?? false,
            craque_player_id: match.craque ? (idMap.get(match.craque) ?? null) : null,
            lineup,
            formation_a: formationToText(lineup?.formB),
            formation_b: formationToText(lineup?.formP),
            draw_seed: lineup?.seed ?? null,
          })
          .select(MATCH_COLS)
          .single(),
        'Falha ao importar a partida.',
      )
      // `writeEntries` ja descarta avulso; aqui so o id precisa virar o novo.
      const entries = match.entries.map((e) => ({
        ...e,
        playerId: idMap.get(e.playerId) ?? e.playerId,
      }))
      await this.writeEntries(created.id, entries, lineup)
    }

    return this.load(await this.slugOf(tenantId))
  }

  private async slugOf(tenantId: string): Promise<string> {
    const row = this.take<{ slug: string }>(
      await this.db().from('tenants').select('slug').eq('id', tenantId).maybeSingle(),
      'Grupo nao encontrado.',
    )
    return row.slug
  }
}

/** Jogador efemero do sorteio: existe so na escalacao, nunca em `players`. */
function isAvulso(playerId: string): boolean {
  return playerId.startsWith('av-')
}

/** Reescreve os ids de jogador dentro do blob da escalacao importada. */
function remapLineup(lineup: Lineup | null, idMap: Map<string, string>): Lineup | null {
  if (!lineup) return null
  const swap = (p: LineupPlayer): LineupPlayer => ({ ...p, id: idMap.get(p.id) ?? p.id })
  const teams = {} as Lineup['teams']
  for (const key of ['branco', 'preto'] as TeamKey[]) {
    const side = lineup.teams?.[key]
    if (!side) continue
    teams[key] = {
      ...side,
      gk: side.gk ? swap(side.gk) : null,
      line: (side.line ?? []).map(swap),
      res: (side.res ?? []).map(swap),
    }
  }
  return { ...lineup, teams }
}
