import React, { useEffect, useState } from 'react'
import { api, ApiError } from './api.js'

const COMMANDS = [
  { value: 'abrir', label: 'Abrir porta' },
  { value: 'fechar', label: 'Fechar porta' },
  { value: 'luz', label: 'Luz interna' },
  { value: 'apagar', label: 'Apagar LEDs' },
  { value: 'tranca_direita', label: 'Abrir tranca' },
  { value: 'tranca_esquerda', label: 'Fechar tranca' },
  { value: 'correta', label: 'Acerto final' },
  { value: 'erro', label: 'Erro' },
]

const safeForTeam = (teamId) => `cofre${String(Number(String(teamId).replace(/\D/g, '')) || 1).padStart(2, '0')}`
const displayError = (error) => error instanceof ApiError && error.status === 409 ? 'Nenhum cofre online para essa operação.' : error.message || 'Não foi possível concluir a operação.'

function App() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname)
    window.addEventListener('popstate', updatePath)
    return () => window.removeEventListener('popstate', updatePath)
  }, [])

  const manager = path === '/gestor'
  return <main className={`app ${manager ? 'manager-theme' : 'player-theme'}`}>
    <nav><strong>INFSEC / COFRINHOS</strong></nav>
    {manager ? <ManagerGate /> : <PlayerScreen />}
  </main>
}

function PlayerScreen() {
  const [teams, setTeams] = useState([])
  const [safes, setSafes] = useState([])
  const [loading, setLoading] = useState(true)
  const [myTeam, setMyTeam] = useState('')
  const [safeId, setSafeId] = useState('')
  const [attempt, setAttempt] = useState('')
  const [stage, setStage] = useState(1)
  const [settings, setSettings] = useState({ stages: 3, passwordLength: 4 })
  const [feedback, setFeedback] = useState({ bons: 0, otimos: 0, message: 'Use quatro dígitos distintos para cada tentativa.' })
  const stageCount = safes.find((safe) => safe.safeId === safeId)?.stages || 0
  const passwordLength = settings.passwordLength || 4
  const safeTeams = teams.filter((team) => team.id !== myTeam && safes.some((safe) => safe.safeId === safeForTeam(team.id)))
  const target = safeTeams.find((team) => safeForTeam(team.id) === safeId)

  useEffect(() => {
    let active = true
    api('/api/game/catalog')
      .then(({ settings: gameSettings, teams: result, safes: availableSafes }) => {
        if (!active) return
        setSettings(gameSettings || { stages: 3, passwordLength: 4 })
        setTeams(result)
        setSafes(availableSafes)
        const firstTeam = result[0]?.id || ''
        const firstTarget = result.find((team) => team.id !== firstTeam)
        setMyTeam(firstTeam)
        setSafeId(firstTarget ? safeForTeam(firstTarget.id) : '')
        if (result.length < 2) setFeedback((current) => ({ ...current, message: 'Aguardando o gestor gerar pelo menos duas equipes.' }))
      })
      .catch(() => { if (active) setFeedback((current) => ({ ...current, message: 'Não foi possível carregar o catálogo do jogo.' })) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function changeTeam(nextTeam) {
    setMyTeam(nextTeam)
    const nextTarget = teams.find((team) => team.id !== nextTeam)
    setSafeId(nextTarget ? safeForTeam(nextTarget.id) : '')
    setStage(1)
    setFeedback({ bons: 0, otimos: 0, message: 'Novo alvo selecionado.' })
  }

  async function sendAttempt() {
    if (!myTeam || !safeId) {
      setFeedback({ bons: 0, otimos: 0, message: 'Aguardando equipes e cofres serem configurados pelo gestor.' })
      return
    }
    if (!new RegExp(`^\\d{${passwordLength}}$`).test(attempt) || new Set(attempt).size !== passwordLength) {
      setFeedback({ bons: 0, otimos: 0, message: `A senha deve ter ${passwordLength} dígitos distintos.` })
      return
    }
    try {
      const result = await api('/api/game/attempt', { method: 'POST', body: JSON.stringify({ attackerTeamId: myTeam, safeId, stage: `etapa${String(stage).padStart(2, '0')}`, attempt }) })
      if (result.status === 'OK') {
        const complete = stage >= stageCount
        setStage((current) => Math.min(stageCount, current + 1))
        setFeedback({ bons: 0, otimos: 0, message: complete ? 'Cofre invadido. Todas as etapas foram concluídas.' : `Etapa ${stage} concluída. Próxima etapa liberada.` })
      } else setFeedback({ bons: result.bons || 0, otimos: result.otimos || 0, message: 'Senha ainda não confere. Ajuste sua tentativa.' })
      setAttempt('')
    } catch (error) { setFeedback({ bons: 0, otimos: 0, message: displayError(error) }) }
  }

  return <section className="player-layout" style={{ '--team-color': teams.find((team) => team.id === myTeam)?.color || '#7fffb3' }}>
    <header><div><p className="eyebrow">OPERADOR</p><h1>Painel de Invasão</h1></div><Status value={loading ? 'Carregando' : 'API ativa'} online={!loading} /></header>
    {teams.length < 2 ? <article className="terminal-card"><p className="hint">Aguardando o gestor gerar as equipes para iniciar o jogo.</p></article> : <>
      <article className="terminal-card identity-card"><label>Minha equipe<select value={myTeam} onChange={(event) => changeTeam(event.target.value)}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.id})</option>)}</select></label></article>
      <article className="terminal-card"><p className="eyebrow">ALVO</p><div className="target-row"><label>Cofre de destino<select value={safeId} onChange={(event) => { setSafeId(event.target.value); setStage(1); setFeedback({ bons: 0, otimos: 0, message: 'Novo cofre selecionado.' }) }}>{safeTeams.map((team) => <option key={team.id} value={safeForTeam(team.id)}>{safeForTeam(team.id)} / {team.name}</option>)}</select></label><span className="color-token" style={{ background: target?.color || '#7fffb3' }} /></div><div className="code-row"><input value={attempt} onChange={(event) => setAttempt(event.target.value.replace(/\D/g, '').slice(0, passwordLength))} onKeyDown={(event) => event.key === 'Enter' && sendAttempt()} inputMode="numeric" placeholder={'0'.repeat(passwordLength)} disabled={stage > stageCount} /><button onClick={sendAttempt} disabled={stage > stageCount}>Enviar senha</button></div><div className="score"><span>Bons <b>{feedback.bons}</b></span><span>Ótimos <b>{feedback.otimos}</b></span></div><p className="hint">{feedback.message}</p><div className="stage-title"><span>Etapas da invasão</span><b>{Math.min(stage - 1, stageCount)}/{stageCount}</b></div><div className="stages">{Array.from({ length: stageCount }, (_, index) => <i key={index} className={index < stage - 1 ? 'solved' : ''} />)}</div></article>
    </>}
  </section>
}

function ManagerGate() {
  const [state, setState] = useState('checking')
  const [username, setUsername] = useState('')

  useEffect(() => {
    const token = sessionStorage.getItem('cofrinho-token')
    if (!token) { setState('login'); return }
    api('/api/auth/me', { token }).then((manager) => { setUsername(manager.username); setState('ready') }).catch(() => { sessionStorage.removeItem('cofrinho-token'); setState('login') })
  }, [])

  if (state === 'checking') return <section className="login-layout"><p>Validando sessão...</p></section>
  if (state === 'login') return <Login onLogin={(manager) => { setUsername(manager.username); setState('ready') }} />
  return <ManagerScreen username={username} onLogout={() => { sessionStorage.removeItem('cofrinho-token'); setState('login') }} />
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const { token } = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      sessionStorage.setItem('cofrinho-token', token)
      const manager = await api('/api/auth/me', { token })
      onLogin(manager)
    } catch (requestError) { sessionStorage.removeItem('cofrinho-token'); setError(displayError(requestError)) }
  }
  return <section className="login-layout"><form className="manager-card login-card" onSubmit={submit}><p className="eyebrow">ACESSO RESTRITO</p><h1>Gestor de Cofres</h1><label>Usuário<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="form-error">{error}</p>}<button className="primary">Entrar</button></form></section>
}

function ManagerScreen({ username, onLogout }) {
  const [teams, setTeams] = useState([])
  const [safes, setSafes] = useState([])
  const [selectedSafeId, setSelectedSafeId] = useState('')
  const [commandTarget, setCommandTarget] = useState('selected')
  const [teamCount, setTeamCount] = useState(10)
  const [detail, setDetail] = useState(null)
  const [message, setMessage] = useState('Carregando dados da API...')
  const [gameConfig, setGameConfig] = useState({ stages: 3, passwordLength: 4, resetSecrets: true })
  const [config, setConfig] = useState({ ownerTeamId: '', doorCloseAngle: 60, reset: false })
  const onlineCount = safes.filter((safe) => safe.online).length

  async function load() {
    try {
      const [teamResponse, safeResponse, settingsResponse] = await Promise.all([api('/api/teams'), api('/api/safes'), api('/api/game/settings')])
      setTeams(teamResponse.teams)
      setSafes(safeResponse.safes)
      setGameConfig((current) => ({ ...current, ...settingsResponse.settings }))
      const first = safeResponse.safes.some((safe) => safe.id === selectedSafeId) ? selectedSafeId : safeResponse.safes[0]?.id || ''
      if (first) await selectSafe(first, safeResponse.safes)
      else { setSelectedSafeId(''); setDetail(null) }
      setMessage('Dados atualizados agora.')
    } catch (error) { setMessage(displayError(error)) }
  }

  async function selectSafe(safeId, availableSafes = safes) {
    setSelectedSafeId(safeId)
    const fallback = availableSafes.find((safe) => safe.id === safeId)
    try {
      const safe = await api(`/api/safes/${safeId}`)
      setDetail(safe)
      setConfig({ ownerTeamId: safe.ownerTeamId, doorCloseAngle: safe.config.doorCloseAngle ?? 60, reset: false })
    } catch (error) { setDetail(fallback || null); setMessage(displayError(error)) }
  }

  useEffect(() => { load() }, [])

  async function generateTeams() {
    try {
      await api('/api/teams/generate', { method: 'POST', body: JSON.stringify({ count: Number(teamCount) }) })
      setSelectedSafeId('')
      setDetail(null)
      setMessage(`${teamCount} equipes e cofres gerados.`)
      await load()
    } catch (error) { setMessage(displayError(error)) }
  }

  async function saveGameConfig() {
    try {
      const response = await api('/api/game/settings', { method: 'PUT', body: JSON.stringify({ stages: Number(gameConfig.stages), passwordLength: Number(gameConfig.passwordLength), resetSecrets: Boolean(gameConfig.resetSecrets) }) })
      setGameConfig((current) => ({ ...current, ...response.settings, resetSecrets: false }))
      setMessage('Configuração geral do jogo atualizada para todos os cofres.')
      await load()
    } catch (error) { setMessage(displayError(error)) }
  }

  async function updateTeam(team, changes) {
    try {
      const updated = await api(`/api/teams/${team.id}`, { method: 'PUT', body: JSON.stringify(changes) })
      setTeams((current) => current.map((item) => item.id === team.id ? updated : item))
      setMessage(`${updated.id} atualizado.`)
      if (changes.color) await load()
    } catch (error) { setMessage(displayError(error)) }
  }

  async function deleteTeam(team) {
    if (!window.confirm(`Remover ${team.name} (${team.id})? O cofre vinculado também será removido.`)) return
    try {
      await api(`/api/teams/${team.id}`, { method: 'DELETE' })
      setMessage(`${team.id} removida.`)
      await load()
    } catch (error) { setMessage(displayError(error)) }
  }

  async function command(commandValue) {
    if (commandTarget === 'selected' && !selectedSafeId) return
    const path = commandTarget === 'all' ? '/api/safes/commands' : `/api/safes/${selectedSafeId}/commands`
    const targetLabel = commandTarget === 'all' ? 'todos os cofres online' : selectedSafeId
    try {
      const result = await api(path, { method: 'POST', body: JSON.stringify({ command: commandValue }) })
      setMessage(`Comando enviado para ${targetLabel}${result.sent ? ` (${result.sent})` : ''}.`)
      await load()
    } catch (error) { setMessage(displayError(error)) }
  }

  async function saveConfig() {
    if (!selectedSafeId) return
    try {
      const safe = await api(`/api/safes/${selectedSafeId}/config`, { method: 'PUT', body: JSON.stringify({ ...config, doorCloseAngle: Number(config.doorCloseAngle) }) })
      setDetail(safe); setSafes((current) => current.map((item) => item.id === safe.id ? safe : item)); setConfig((current) => ({ ...current, reset: false })); setMessage(`${safe.id} configurado.`)
    } catch (error) { setMessage(displayError(error)) }
  }

  async function resetAllSafes() {
    if (!window.confirm('Executar reset geral? Isso fechará as portas, apagará as luzes internas, restaurará as cores e gerará novas senhas para todos os cofres.')) return
    try {
      const result = await api('/api/safes/reset', { method: 'POST' })
      setMessage(`Reset geral executado em ${result.reset} cofres. Online: ${result.sent}.`)
      await load()
    } catch (error) { setMessage(displayError(error)) }
  }

  return <section className="manager-layout"><header><div><p className="eyebrow">ADMINISTRAÇÃO / {username}</p><h1>Gestor de Cofres</h1><p className="manager-message">{message}</p></div><div className="header-actions"><Status value="Autenticado" online /><button onClick={load}>Atualizar</button><button className="danger-button" onClick={resetAllSafes}>Reset geral</button><button className="quiet-button" onClick={onLogout}>Sair</button></div></header>
    <article className="manager-card top-section"><div className="section-heading"><div><p className="eyebrow">COFRES</p><h2>Estado dos dispositivos</h2></div><select value={selectedSafeId} onChange={(event) => selectSafe(event.target.value)}>{safes.map((safe) => <option key={safe.id} value={safe.id}>{safe.id} {safe.online ? 'online' : 'offline'}</option>)}</select></div>{detail ? <div className="safe-detail"><span className={detail.online ? 'online-dot' : 'offline-dot'} /> <b>{detail.id}</b><span>{detail.online ? 'Online' : 'Offline'}</span><span>Dono: {detail.ownerTeamId}</span><span>Etapas: {detail.config.stages}</span><span>Ângulo: {detail.config.doorCloseAngle} graus</span><code>{detail.status ? JSON.stringify(detail.status) : 'Sem status do dispositivo'}</code></div> : <div className="safe-detail">Gere equipes para criar cofres.</div>}<div className="command-scope"><label>Enviar comandos para<select value={commandTarget} onChange={(event) => setCommandTarget(event.target.value)}><option value="selected">Cofre selecionado</option><option value="all">Todos os cofres online ({onlineCount})</option></select></label></div><div className="command-grid">{COMMANDS.map((item) => <button key={item.value} onClick={() => command(item.value)} disabled={commandTarget === 'selected' ? !detail?.online : onlineCount === 0}>{item.label}</button>)}</div></article>
    <article className="manager-card top-section"><p className="eyebrow">EQUIPES</p><h2>Gerar equipes e cofres</h2><div className="controls"><label>Quantidade<input type="number" min="1" max="50" value={teamCount} onChange={(event) => setTeamCount(event.target.value)} /></label><button onClick={generateTeams}>Gerar equipes</button></div></article>
    <div className="manager-columns"><article className="manager-card"><p className="eyebrow">JOGO</p><h2>Configuração geral</h2><div className="controls"><label>Quantidade de etapas/senhas<input type="number" min="1" max="16" value={gameConfig.stages} onChange={(event) => setGameConfig((current) => ({ ...current, stages: event.target.value }))} /></label><label>Dígitos por senha<input type="number" min="3" max="6" value={gameConfig.passwordLength} onChange={(event) => setGameConfig((current) => ({ ...current, passwordLength: event.target.value }))} /></label><label className="checkbox-label"><input type="checkbox" checked={gameConfig.resetSecrets} onChange={(event) => setGameConfig((current) => ({ ...current, resetSecrets: event.target.checked }))} /> Gerar novas senhas</label><button className="primary" onClick={saveGameConfig}>Salvar para todos</button></div></article><article className="manager-card"><p className="eyebrow">COFRE SELECIONADO</p><h2>Configuração individual</h2><div className="controls"><label>Equipe proprietária<select value={config.ownerTeamId} onChange={(event) => setConfig((current) => ({ ...current, ownerTeamId: event.target.value }))}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.id})</option>)}</select></label><label>Ângulo de fechamento da porta<input type="number" min="0" max="180" value={config.doorCloseAngle} onChange={(event) => setConfig((current) => ({ ...current, doorCloseAngle: event.target.value }))} /></label><label className="checkbox-label"><input type="checkbox" checked={config.reset} onChange={(event) => setConfig((current) => ({ ...current, reset: event.target.checked }))} /> Gerar novas senhas deste cofre</label><button className="primary" onClick={saveConfig} disabled={!detail?.online}>Salvar cofre</button></div></article></div>
    <article className="manager-card"><p className="eyebrow">EQUIPES CADASTRADAS</p><div className="team-list">{teams.map((team) => <div className="team-row" key={team.id}><span className="color-token" style={{ background: team.color || '#a8b9cb' }} /><code>{team.id}</code><input defaultValue={team.name} aria-label={`Nome da ${team.id}`} onBlur={(event) => event.target.value !== team.name && updateTeam(team, { name: event.target.value })} /><div className="team-secrets">{Object.entries(team.secrets || {}).map(([stageId, secret]) => <span key={stageId}>{stageId}: <b>{secret}</b></span>)}</div><input type="color" value={team.color || '#a8b9cb'} aria-label={`Cor da ${team.id}`} onChange={(event) => updateTeam(team, { color: event.target.value })} /><button className="remove-team" type="button" aria-label={`Remover ${team.id}`} onClick={() => deleteTeam(team)}>×</button></div>)}</div></article>
  </section>
}

function Status({ value, online }) { return <span className={`status ${online ? 'online' : ''}`}><i />{value}</span> }
export default App
